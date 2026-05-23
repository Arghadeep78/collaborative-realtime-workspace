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
