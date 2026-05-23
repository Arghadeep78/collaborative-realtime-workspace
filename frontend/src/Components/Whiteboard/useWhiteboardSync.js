
import { useCallback, useEffect, useRef } from 'react';

export function useWhiteboardSync({ ydoc, editorRef, setTimer, setVotes, setComments }) {
  const bindingActiveRef = useRef(false);
  const bindingCleanupRef = useRef(null);
  const boundYdocRef = useRef(null);

  const bindStore = useCallback((editor) => {
    if (!editor || !ydoc) return;
    if (bindingActiveRef.current && boundYdocRef.current === ydoc && editorRef.current === editor) return;

    if (bindingCleanupRef.current) {
      bindingCleanupRef.current();
      bindingCleanupRef.current = null;
    }

    bindingActiveRef.current = true;
    boundYdocRef.current = ydoc;
    editorRef.current = editor;

    const yRecords = ydoc.getMap('tldraw_records');
    const yMeta = ydoc.getMap('tldraw');

    let isApplyingRemote = false;
    let isApplyingLocal = false;

    // Migrate from legacy full-snapshot or load incremental records
    if (yRecords.size === 0 && yMeta.size > 0) {
      try {
        const raw = yMeta.get('snapshot');
        if (raw) {
          const snap = JSON.parse(raw);
          editor.store.loadSnapshot(snap);
          ydoc.transact(() => {
            const allRecords = editor.store.allRecords();
            for (const rec of allRecords) {
              yRecords.set(rec.id, JSON.stringify(rec));
            }
          }, 'tldraw-init');
        }
      } catch (e) {
        console.warn('[tldraw] legacy snapshot migration failed:', e);
      }
    } else if (yRecords.size > 0) {
      try {
        isApplyingRemote = true;
        const records = [];
        yRecords.forEach((val) => {
          try { records.push(JSON.parse(val)); } catch (_) { /* skip */ }
        });
        if (records.length > 0) editor.store.put(records);
      } catch (e) {
        console.warn('[tldraw] incremental load failed:', e);
      } finally {
        isApplyingRemote = false;
      }
    }

    // tldraw → Yjs (debounced)
    let pendingChanges = { added: {}, updated: {}, removed: {} };
    let flushTimer = null;

    const flushToYjs = () => {
      flushTimer = null;
      const { added, updated, removed } = pendingChanges;
      pendingChanges = { added: {}, updated: {}, removed: {} };

      const addedEntries = Object.values(added);
      const updatedEntries = Object.values(updated);
      const removedIds = Object.keys(removed);

      if (addedEntries.length === 0 && updatedEntries.length === 0 && removedIds.length === 0) return;

      isApplyingLocal = true;
      ydoc.transact(() => {
        for (const rec of addedEntries) yRecords.set(rec.id, JSON.stringify(rec));
        for (const rec of updatedEntries) yRecords.set(rec.id, JSON.stringify(rec));
        for (const id of removedIds) yRecords.delete(id);
      }, 'tldraw');
      isApplyingLocal = false;
    };

    const unsubscribeTldraw = editor.store.listen(({ changes }) => {
      if (isApplyingRemote || !changes) return;

      for (const rec of Object.values(changes.added)) {
        delete pendingChanges.removed[rec.id];
        pendingChanges.added[rec.id] = rec;
      }
      for (const [, to] of Object.values(changes.updated)) {
        if (pendingChanges.added[to.id]) {
          pendingChanges.added[to.id] = to;
        } else {
          pendingChanges.updated[to.id] = to;
        }
        delete pendingChanges.removed[to.id];
      }
      for (const rec of Object.values(changes.removed)) {
        delete pendingChanges.added[rec.id];
        delete pendingChanges.updated[rec.id];
        pendingChanges.removed[rec.id] = true;
      }

      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(flushToYjs, 100);
    }, { scope: 'document' });

    // Yjs → tldraw
    const onYjsChange = (event, transaction) => {
      if (transaction.origin === 'tldraw' || transaction.origin === 'tldraw-init') return;
      if (isApplyingLocal) return;

      isApplyingRemote = true;
      try {
        const toPut = [];
        const toRemove = [];

        event.changes.keys.forEach((change, key) => {
          if (change.action === 'add' || change.action === 'update') {
            try {
              const rec = JSON.parse(yRecords.get(key));
              toPut.push(rec);
            } catch (_) { /* skip */ }
          } else if (change.action === 'delete') {
            toRemove.push({ id: key, typeName: key.split(':')[0] });
          }
        });

        if (toPut.length > 0 || toRemove.length > 0) {
          editor.store.mergeRemoteChanges(() => {
            if (toPut.length > 0) editor.store.put(toPut);
            if (toRemove.length > 0) {
              const existingIds = toRemove
                .map(r => r.id)
                .filter(id => { try { return !!editor.store.get(id); } catch { return false; } });
              if (existingIds.length > 0) editor.store.remove(existingIds);
            }
          });
        }
      } catch (e) {
        console.warn('[tldraw] failed to apply Yjs incremental update:', e);
      } finally {
        isApplyingRemote = false;
      }
    };
    yRecords.observe(onYjsChange);

    // Shared state: timer, votes, comments
    const ySystem = ydoc.getMap('system');
    const yVotes = ydoc.getMap('votes');
    const yComments = ydoc.getArray('comments');

    const onSystemChange = () => {
      const currentTimer = ySystem.get('timer');
      if (currentTimer) setTimer(currentTimer);
    };
    const onVotesChange = () => setVotes(yVotes.toJSON());
    const onCommentsChange = () => setComments(yComments.toArray());

    ySystem.observe(onSystemChange);
    yVotes.observe(onVotesChange);
    yComments.observe(onCommentsChange);

    onSystemChange();
    onVotesChange();
    onCommentsChange();

    const cleanup = () => {
      if (flushTimer) { clearTimeout(flushTimer); flushToYjs(); }
      unsubscribeTldraw();
      yRecords.unobserve(onYjsChange);
      ySystem.unobserve(onSystemChange);
      yVotes.unobserve(onVotesChange);
      yComments.unobserve(onCommentsChange);
      bindingActiveRef.current = false;
      boundYdocRef.current = null;
    };

    bindingCleanupRef.current = cleanup;
    return cleanup;
  }, [ydoc]);

  // Re-bind when ydoc becomes available
  useEffect(() => {
    if (ydoc && editorRef.current) {
      const cleanup = bindStore(editorRef.current);
      return cleanup;
    }
  }, [ydoc, bindStore]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bindingCleanupRef.current) {
        bindingCleanupRef.current();
        bindingCleanupRef.current = null;
      }
    };
  }, []);

  return { bindStore };
}
