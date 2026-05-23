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
    /** @type {((boardId: string) => void) | null} - Called when a doc is evicted from memory */
    this.onDocEvicted = null;
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

    // Compact synchronously (no await before this, so no cross-instance Redis
    // update can interleave and be lost). Safe here because no WS peer is
    // attached to this freshly-loaded doc yet — the swap is invisible to
    // clients, who adopt the compacted state via the normal sync handshake.
    const compacted = this._compact(boardId, ydoc);
    if (compacted !== ydoc) {
      this.docs.set(boardId, compacted);
      ydoc.destroy();
    }
    return this.docs.get(boardId);
  }

  /**
   * Rebuild a fresh Y.Doc from the current logical values of every top-level
   * shared type, discarding accumulated CRDT history (tombstones, GC structs,
   * per-key write chains). Returns the original doc unchanged when it's too
   * small to bother with or when the rebuild wouldn't save enough space.
   *
   * Assumes top-level types hold plain JSON-safe values (no nested Yjs types),
   * which holds for this app's schema: tldraw_records / tldraw / system / votes
   * are Y.Maps of strings/numbers/plain objects, comments is a Y.Array of
   * plain objects.
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

    const clone = (v) => (v instanceof Y.AbstractType ? v.toJSON() : v);
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

  /** @returns {string[]} All dirty board IDs (clears the set). */
  flushDirtyIds() {
    const ids = [...this.dirtyDocs];
    this.dirtyDocs.clear();
    return ids;
  }

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
