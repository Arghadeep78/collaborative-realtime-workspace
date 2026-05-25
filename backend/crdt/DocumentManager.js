import * as Y from 'yjs';
import Whiteboard from '../models/whiteboardModel.js';

/**
 * @typedef {import('ws').WebSocket} WebSocket
 */

/**
 * Manages in-memory Y.Doc instances for active boards.
 * Handles loading from MongoDB, dirty-tracking for write-behind persistence,
 * and garbage collection of idle documents.
 */
class DocumentManager {
  constructor() {
    /** @type {Map<string, Y.Doc>} */
    this.docs = new Map();
    /** @type {Map<string, Promise<Y.Doc>>} - Prevents concurrent loads for the same board */
    this.loading = new Map();
    /** @type {Map<string, Set<WebSocket>>} */
    this.connections = new Map();
    /** @type {Set<string>} - Board IDs with un-persisted changes */
    this.dirtyDocs = new Set();
    /** @type {Map<string, NodeJS.Timeout>} */
    this.gcTimers = new Map();
    /** @type {Set<string>} - Boards with a compaction pass in flight (guards against double-compaction on concurrent cold loads) */
    this.compacting = new Set();
    /** @type {((boardId: string) => void) | null} - Called when a doc is evicted from memory */
    this.onDocEvicted = null;
    /** @type {((boardId: string, oldDoc: Y.Doc, newDoc: Y.Doc) => void) | null} - Called when a doc instance is swapped (e.g. after async compaction) so WSServer can rewire its `update` listener */
    this.onDocSwapped = null;
    this.GC_DELAY_MS = 5 * 60 * 1000;

    // Compaction thresholds. Yjs docs grow monotonically: every erased shape
    // leaves a tombstone, and the 50ms-throttled record writes during a drag
    // leave a long per-key history chain. encodeStateAsUpdate serialises all of
    // it, so yjsState keeps growing even when the shape count is constant.
    // On cold load we rebuild a fresh doc from the current logical values to
    // drop that history — but only when it's big enough to matter and the
    // rebuild actually saves space, to avoid churning small/healthy docs.
    this.COMPACT_MIN_BYTES = 64 * 1024;
    this.COMPACT_SAVE_RATIO = 0.8;
  }

  /**
   * Get or create a Y.Doc for the given board ID.
   * Concurrent calls for the same ID share a single MongoDB load.
   * @param {string} boardId
   * @param {object} [preloadedBoard] - Optional pre-fetched board doc to avoid a second MongoDB query
   * @returns {Promise<Y.Doc>}
   */
  async getDoc(boardId, preloadedBoard) {
    if (this.docs.has(boardId)) {
      this._cancelGC(boardId);
      return this.docs.get(boardId);
    }
    if (this.loading.has(boardId)) {
      return this.loading.get(boardId);
    }

    const loadPromise = this._loadDoc(boardId, preloadedBoard);
    this.loading.set(boardId, loadPromise);
    try {
      return await loadPromise;
    } finally {
      this.loading.delete(boardId);
    }
  }

  /** @param {string} boardId @param {object} [preloadedBoard] */
  async _loadDoc(boardId, preloadedBoard) {
    const ydoc = new Y.Doc();
    this.docs.set(boardId, ydoc);

    const board = preloadedBoard || await Whiteboard.findOne({ id: boardId }).lean();
    if (board?.yjsState?.buffer) {
      Y.applyUpdate(ydoc, new Uint8Array(board.yjsState.buffer));
    }

    // Defer compaction off the cold-load path. Rebuilding a fresh doc
    // (encode → deep-clone → re-encode) for a large board can block the event
    // loop for 50–200ms; doing it here would make the first client wait — and
    // queue every other board's WS traffic behind it. Instead we hand back the
    // un-compacted doc immediately so the sync handshake can start, and run
    // compaction after the current turn via setImmediate (see _scheduleCompaction).
    this._scheduleCompaction(boardId);
    return ydoc;
  }

  /**
   * Run history compaction asynchronously, after the cold-load path has
   * returned and the first client's sync handshake is underway.
   *
   * Why async: rebuilding a fresh doc (encode → deep-clone → re-encode) for a
   * large board blocks the Node event loop for 50–200ms. Doing it on the cold
   * load path makes the first client wait and queues every other board's WS
   * traffic behind it. Running it in a later `setImmediate` turn lets the sync
   * handshake go out first ("serve then optimize").
   *
   * The rebuilt doc is a *different* Y.Doc instance, so swapping it in requires
   * rewiring every holder of the old reference. The `onDocSwapped` callback
   * lets WSServer move its `update` listener and re-sync peers; the live
   * read/write paths there resolve the doc fresh from `docs` on each message,
   * so they pick up the new instance automatically. The `compacting` flag
   * keeps two concurrent cold loads from scheduling the pass twice.
   *
   * @param {string} boardId
   */
  _scheduleCompaction(boardId) {
    if (this.compacting.has(boardId)) return; // a pass is already pending
    this.compacting.add(boardId);

    setImmediate(() => {
      this.compacting.delete(boardId);
      const ydoc = this.docs.get(boardId);
      if (!ydoc) return; // evicted before we got here

      const compacted = this._compact(boardId, ydoc);
      if (compacted === ydoc) return; // not worth it / failed — left as-is

      // Atomic swap: update the map first so any message arriving after this
      // point resolves the new doc, then let WSServer rewire its listener and
      // push the compacted state to attached peers, then destroy the old doc.
      this.docs.set(boardId, compacted);
      if (this.onDocSwapped) this.onDocSwapped(boardId, ydoc, compacted);
      ydoc.destroy();
    });
  }

  /**
   * Rebuild a fresh Y.Doc from the current logical values of every top-level
   * shared type, discarding accumulated CRDT history (tombstones, GC structs,
   * per-key write chains). Returns the original doc unchanged when it's too
   * small to bother with or when the rebuild wouldn't save enough space.
   *
   * Nested Yjs types are reconstructed (not flattened to plain JSON): the
   * `votes` map holds a Y.Map per poll so concurrent voters merge, and
   * flattening it to a plain object would break the client's vote mutations
   * after a cold load. `clone` recurses to preserve that structure.
   *
   * @param {string} boardId @param {Y.Doc} ydoc @returns {Y.Doc}
   */
  _compact(boardId, ydoc) {
    let originalSize;
    try {
      originalSize = Y.encodeStateAsUpdate(ydoc).byteLength;
    } catch {
      return ydoc;
    }
    if (originalSize < this.COMPACT_MIN_BYTES) return ydoc;

    // Deep-clone a value, rebuilding nested Yjs types as fresh (detached)
    // instances so they re-integrate into the compacted doc with their
    // structure — and their CRDT merge semantics — intact.
    const clone = (v) => {
      if (v instanceof Y.Map) {
        const m = new Y.Map();
        v.forEach((val, key) => m.set(key, clone(val)));
        return m;
      }
      if (v instanceof Y.Array) {
        const a = new Y.Array();
        a.push(v.toArray().map(clone));
        return a;
      }
      if (v instanceof Y.Text) {
        const t = new Y.Text();
        t.insert(0, v.toString());
        return t;
      }
      return v instanceof Y.AbstractType ? v.toJSON() : v;
    };
    const fresh = new Y.Doc();
    try {
      fresh.transact(() => {
        ydoc.share.forEach((type, name) => {
          if (type instanceof Y.Map) {
            const dst = fresh.getMap(name);
            type.forEach((value, key) => dst.set(key, clone(value)));
          } else if (type instanceof Y.Array) {
            fresh.getArray(name).push(type.toArray().map(clone));
          } else if (type instanceof Y.Text) {
            fresh.getText(name).insert(0, type.toString());
          }
        });
      });
    } catch (err) {
      console.error(`[DocumentManager] compaction failed for ${boardId}:`, err);
      fresh.destroy();
      return ydoc;
    }

    const compactedSize = Y.encodeStateAsUpdate(fresh).byteLength;
    if (compactedSize >= originalSize * this.COMPACT_SAVE_RATIO) {
      fresh.destroy(); // not worth the swap
      return ydoc;
    }

    // Persist the slimmer state so MongoDB shrinks too — otherwise we'd
    // recompact this same bloat on every cold load.
    this.markDirty(boardId);
    console.log(`[DocumentManager] compacted ${boardId}: ${originalSize}B → ${compactedSize}B`);
    return fresh;
  }

  /** @param {string} boardId @param {WebSocket} ws */
  addConnection(boardId, ws) {
    if (!this.connections.has(boardId)) {
      this.connections.set(boardId, new Set());
    }
    this.connections.get(boardId).add(ws);
    this._cancelGC(boardId);
  }

  /** @param {string} boardId @param {WebSocket} ws */
  removeConnection(boardId, ws) {
    const conns = this.connections.get(boardId);
    if (conns) {
      conns.delete(ws);
      if (conns.size === 0) {
        this.connections.delete(boardId);
        this._scheduleGC(boardId);
      }
    }
  }

  /** @param {string} boardId @returns {Set<WebSocket>} */
  getConnections(boardId) {
    return this.connections.get(boardId) || new Set();
  }

  /** @param {string} boardId */
  markDirty(boardId) {
    this.dirtyDocs.add(boardId);
  }

  /** @returns {string[]} All dirty board IDs without clearing the set. */
  peekDirtyIds() { return [...this.dirtyDocs]; }

  /** @param {string} id */
  clearDirty(id) { this.dirtyDocs.delete(id); }

  /** @param {string} boardId @returns {Uint8Array|null} */
  encodeState(boardId) {
    const ydoc = this.docs.get(boardId);
    return ydoc ? Y.encodeStateAsUpdate(ydoc) : null;
  }

  /** @param {string} boardId */
  _scheduleGC(boardId) {
    this._cancelGC(boardId);
    this.gcTimers.set(
      boardId,
      setTimeout(() => {
        // Still un-persisted: let the next persistence flush finish, then
        // retry eviction. Returning without rescheduling would strand the
        // doc in memory forever (the room is empty, so nothing else will
        // ever re-arm the GC timer).
        if (this.dirtyDocs.has(boardId)) {
          this.gcTimers.delete(boardId);
          this._scheduleGC(boardId);
          return;
        }
        const ydoc = this.docs.get(boardId);
        if (ydoc) {
          ydoc.destroy();
          this.docs.delete(boardId);
        }
        this.gcTimers.delete(boardId);
        if (this.onDocEvicted) this.onDocEvicted(boardId);
      }, this.GC_DELAY_MS)
    );
  }

  /** @param {string} boardId */
  _cancelGC(boardId) {
    const timer = this.gcTimers.get(boardId);
    if (timer) {
      clearTimeout(timer);
      this.gcTimers.delete(boardId);
    }
  }
}

export const documentManager = new DocumentManager();
