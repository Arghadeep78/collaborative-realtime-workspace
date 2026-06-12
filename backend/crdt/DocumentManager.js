import * as Y from 'yjs';
import Whiteboard from '../models/whiteboardModel.js';

const C = '\x1b[35m'; // magenta
const R = '\x1b[0m';
const log  = (...a) => console.log(`${C}[DocumentManager]${R}`, ...a);
const lerr = (...a) => console.error(`${C}[DocumentManager]${R}`, ...a);

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
    /** @type {((boardId: string) => void) | null} - Called when a doc is evicted from memory */
    this.onDocEvicted = null;
    this.GC_DELAY_MS = 5 * 60 * 1000;

    // Compaction thresholds. Yjs docs grow monotonically: every erased shape
    // leaves a tombstone, and the 50ms-throttled record writes during a drag
    // leave a long per-key history chain. encodeStateAsUpdate serialises all of
    // it, so yjsState keeps growing even when the shape count is constant.
    // We compact when the last peer leaves a room (see _flushIfDirty), rebuilding
    // the state from the doc's current logical values to drop that history —
    // but only when it's big enough to matter and the rebuild actually saves
    // space, to avoid churning small/healthy docs.
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

    return ydoc;
  }

  /**
   * Produce a compacted snapshot of the doc's current state, discarding
   * accumulated CRDT history (tombstones, GC structs, per-key write chains) by
   * replaying the live logical values into a throwaway fresh doc and encoding
   * that. Returns the slimmer bytes, or `null` when compaction isn't worth it
   * (doc too small, or the rebuild doesn't save enough space) — the caller then
   * persists the un-compacted state instead.
   *
   * Called only when a room goes empty (see _flushIfDirty), so:
   *   - it never runs on the cold-load handshake path (no client is waiting);
   *   - no live socket holds the doc reference, so there's nothing to swap or
   *     rewire — we just encode a snapshot and let the original doc be GC'd.
   *
   * Nested Yjs types are reconstructed (not flattened to plain JSON): the
   * `votes`/`comments` maps hold a Y.Map per poll/element so concurrent
   * mutations merge, and flattening them to plain objects would break the
   * client's vote/comment mutations after a cold load. `clone` recurses to
   * preserve that structure, so the reloaded doc looks identical to the live one.
   *
   * @param {string} boardId
   * @param {Y.Doc} ydoc
   * @returns {Uint8Array | null} compacted state bytes, or null to skip
   */
  _compactState(boardId, ydoc) {
    let originalSize;
    try {
      originalSize = Y.encodeStateAsUpdate(ydoc).byteLength;
    } catch {
      return null;
    }
    if (originalSize < this.COMPACT_MIN_BYTES) return null;

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

      const compacted = Y.encodeStateAsUpdate(fresh);
      if (compacted.byteLength >= originalSize * this.COMPACT_SAVE_RATIO) {
        return null; // not worth it — persist the un-compacted state instead
      }
      log(`compacted ${boardId}: ${originalSize}B → ${compacted.byteLength}B`);
      return compacted;
    } catch (err) {
      lerr(`compaction failed for ${boardId}:`, err.message);
      return null;
    } finally {
      fresh.destroy();
    }
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
        // Compact + write dirty state to MongoDB when the last peer leaves.
        // Fire-and-forget: _flushIfDirty clears the dirty flag synchronously, so
        // the GC timer below (which only evicts once dirty is clear) can't race
        // the in-flight write; the doc stays in memory until the 5-min timer.
        this._flushIfDirty(boardId).catch(() => {});
        this._scheduleGC(boardId);
      }
    }
  }

  /**
   * Compact (if worthwhile) and write the Y.Doc state to MongoDB if dirty.
   * Called when the last connection leaves a room, so:
   *   - it closes the 30s write-behind window — without it a quick reload or
   *     server restart would serve a stale cold-load and lose edits since the
   *     last scheduler tick;
   *   - it's the natural moment to compact: the room is empty, so the rebuild
   *     never blocks a client's handshake, and the slim state is what we persist
   *     so the next cold load is both small and cheap to replay.
   *
   * This is the only writer here that touches MongoDB directly; the periodic
   * scheduler enqueues BullMQ jobs instead. A room only goes empty once per
   * lifetime, so there's no concurrent flush for the same board to serialise
   * against — we clear the dirty flag up front and re-mark it on failure so the
   * next scheduler tick retries.
   *
   * @param {string} boardId
   */
  async _flushIfDirty(boardId) {
    if (!this.dirtyDocs.has(boardId)) return;
    const ydoc = this.docs.get(boardId);
    if (!ydoc) return;

    // Compact while the room is empty; fall back to the raw state when the doc
    // is too small to bother or the rebuild wouldn't save enough space.
    const state = this._compactState(boardId, ydoc) || Y.encodeStateAsUpdate(ydoc);
    this.clearDirty(boardId);

    try {
      await Whiteboard.updateOne(
        { id: boardId },
        { $set: { yjsState: Buffer.from(state) } },
      );
      log(`Flushed boardId: ${boardId} (${state.byteLength}B) on room-empty`);
    } catch (err) {
      this.markDirty(boardId);
      lerr(`Flush failed for boardId: ${boardId} — re-marked dirty:`, err.message);
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
