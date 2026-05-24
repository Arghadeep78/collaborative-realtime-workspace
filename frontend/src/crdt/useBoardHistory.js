import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { getBoardTypes, LOCAL_ORIGIN } from '../Components/Board/boardConstants.js';

/**
 * Per-user undo/redo for the board.
 *
 * A Yjs UndoManager captures changes by transaction origin. Every local edit in
 * useBoardSync is tagged with LOCAL_ORIGIN, while edits arriving from peers carry
 * the WebSocket provider's origin. By tracking only LOCAL_ORIGIN, this manager
 * builds an undo stack of *this* client's work alone — undo/redo never touches a
 * teammate's elements, which is the expected collaborative UX.
 *
 * Both the elements map and the pages array are tracked so creating, moving,
 * editing, deleting, and slide changes are all reversible.
 *
 * @param {import('yjs').Doc|null} ydoc
 * @returns {{ undo: () => void, redo: () => void, canUndo: boolean, canRedo: boolean }}
 */
export function useBoardHistory(ydoc) {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const managerRef = useRef(null);

  useEffect(() => {
    if (!ydoc) return;
    const { yPages, yElements } = getBoardTypes(ydoc);

    const manager = new Y.UndoManager([yElements, yPages], {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
      // Group rapid successive edits (e.g. a continuous drag flushed every
      // ~50ms) into a single undo step instead of dozens.
      captureTimeout: 400,
    });
    managerRef.current = manager;

    const refresh = () => {
      setCanUndo(manager.canUndo());
      setCanRedo(manager.canRedo());
    };
    manager.on('stack-item-added', refresh);
    manager.on('stack-item-popped', refresh);
    manager.on('stack-cleared', refresh);
    refresh();

    return () => {
      manager.destroy();
      managerRef.current = null;
      setCanUndo(false);
      setCanRedo(false);
    };
  }, [ydoc]);

  const undo = useCallback(() => managerRef.current?.undo(), []);
  const redo = useCallback(() => managerRef.current?.redo(), []);

  return { undo, redo, canUndo, canRedo };
}
