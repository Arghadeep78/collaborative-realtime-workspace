import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { getBoardTypes, makeId, LOCAL_ORIGIN, myColor } from './boardConstants.js';

// Transaction origin tag for local edits. Shared with the per-user UndoManager
// so it can track only the transactions this client authored.
const LOCAL = LOCAL_ORIGIN;

/**
 * Bridges the new document schema (`pages` Y.Array + `elements` Y.Map) to React
 * state, and exposes mutation helpers that write plain-JSON values back to Yjs.
 *
 * This replaces the old tldraw store ↔ Yjs bridge with something much smaller:
 * element values are plain objects (no nested Yjs types), so a shallow observe
 * on each shared type is enough — any add / delete / value-replace re-syncs.
 *
 * @param {import('yjs').Doc|null} ydoc
 * @returns pages, elements, and CRUD helpers
 */
export function useBoardSync(ydoc) {
  const [pages, setPages] = useState([]);
  const [sections, setSections] = useState([]);
  const [elements, setElements] = useState({});
  const [votes, setVotes] = useState({});
  const [comments, setComments] = useState({});
  const ydocRef = useRef(ydoc);
  ydocRef.current = ydoc;

  useEffect(() => {
    if (!ydoc) return;
    const { yPages, ySections, yElements, yVotes, yComments } = getBoardTypes(ydoc);

    const syncPages = () => {
      const arr = yPages.toArray().map((p) => ({ ...p }));
      arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setPages(arr);
    };
    const syncSections = () => {
      const arr = ySections.toArray().map((s) => ({ ...s }));
      arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setSections(arr);
    };
    const syncElements = () => setElements(yElements.toJSON());
    const syncVotes = () => setVotes(yVotes.toJSON());
    const syncComments = () => setComments(yComments.toJSON());

    syncPages();
    syncSections();
    syncElements();
    syncVotes();
    syncComments();
    yPages.observe(syncPages);
    ySections.observe(syncSections);
    yElements.observe(syncElements);
    yVotes.observeDeep(syncVotes); // Use observeDeep so nested Map changes trigger re-sync!
    yComments.observeDeep(syncComments); // nested per-element Map → observeDeep

    return () => {
      yPages.unobserve(syncPages);
      ySections.unobserve(syncSections);
      yElements.unobserve(syncElements);
      yVotes.unobserveDeep(syncVotes);
      yComments.unobserveDeep(syncComments);
    };
  }, [ydoc]);

  // multiKey=true uses "email:optionId" as the map key so multiple votes per
  // user can coexist (multi-choice polls). Single-choice polls use just email.
  const castPollVote = useCallback((pollId, optionId, user, multiKey = false) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const yVotes = doc.getMap('votes');
    doc.transact(() => {
      let yPoll = yVotes.get(pollId);
      if (!(yPoll instanceof Y.Map)) {
        // First vote on this poll — create its nested Y.Map. (Server-side
        // compaction preserves nested Y.Maps, so an existing poll is always a
        // Y.Map here; this branch only fires when no one has voted yet.)
        // NOTE: a pre-a55fdba flattening compaction could in theory have left a
        // plain-object poll in old persisted data — that's accepted as not worth
        // handling; such legacy boards are out of scope.
        yPoll = new Y.Map();
        yVotes.set(pollId, yPoll);
      }
      const key = multiKey ? `${user.email}:${optionId}` : user.email;
      yPoll.set(key, { optionId, ...user });
    }, LOCAL);
  }, []);

  const removePollVote = useCallback((pollId, email) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const yVotes = doc.getMap('votes');
    doc.transact(() => {
      const yPoll = yVotes.get(pollId);
      if (yPoll instanceof Y.Map) yPoll.delete(email);
    }, LOCAL);
  }, []);

  // ── Comments ────────────────────────────────────────────────────────────────
  // Same nested-Y.Map shape as votes: comments → { [elementId]: Y.Map<commentId,
  // record> }. observeDeep above re-syncs on any nested change. Backend
  // compaction (on room teardown) rebuilds these nested Y.Maps rather than
  // flattening them, so threads survive a cold load with their structure intact.

  /** Add a comment to an element. `user` is { name, email, color? }. */
  const addComment = useCallback((elementId, text, user) => {
    const doc = ydocRef.current;
    const body = (text || '').trim();
    if (!doc || !elementId || !body) return null;
    const yComments = doc.getMap('comments');
    const commentId = makeId('cm');
    doc.transact(() => {
      let thread = yComments.get(elementId);
      if (!(thread instanceof Y.Map)) {
        // First comment on this element — create its nested thread Y.Map.
        // (Compaction preserves nested Y.Maps, so an element with existing
        // comments always has a Y.Map here.)
        thread = new Y.Map();
        yComments.set(elementId, thread);
      }
      thread.set(commentId, {
        id: commentId,
        text: body,
        author: user?.name || user?.email || 'Anonymous',
        authorEmail: user?.email || '',
        color: user?.color || myColor,
        createdAt: Date.now(),
      });
    }, LOCAL);
    return commentId;
  }, []);

  /** Delete a single comment from an element's thread. */
  const removeComment = useCallback((elementId, commentId) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const yComments = doc.getMap('comments');
    doc.transact(() => {
      const thread = yComments.get(elementId);
      if (thread instanceof Y.Map) {
        thread.delete(commentId);
        if (thread.size === 0) yComments.delete(elementId);
      }
    }, LOCAL);
  }, []);

  // ── Element mutations ──────────────────────────────────────────────────────

  /** Create an element. Caller supplies type/pageId/geometry/props/createdBy. */
  const addElement = useCallback((el) => {
    const doc = ydocRef.current;
    if (!doc) return null;
    const id = el.id || makeId(el.type || 'el');
    const record = { z: 1, props: {}, ...el, id };
    doc.transact(() => doc.getMap('elements').set(id, record), LOCAL);
    return id;
  }, []);

  /**
   * Apply many element patches in a single transaction (one Yjs update / one
   * socket frame) — used by the layout engine to re-arrange a whole slide.
   * Each entry is `{ id, ...patch }`.
   */
  const bulkUpdate = useCallback((updates) => {
    const doc = ydocRef.current;
    if (!doc || !updates?.length) return;
    const yElements = doc.getMap('elements');
    doc.transact(() => {
      updates.forEach(({ id, ...patch }) => {
        const prev = yElements.get(id);
        if (prev) yElements.set(id, { ...prev, ...patch });
      });
    }, LOCAL);
  }, []);

  /** Shallow-merge a patch into an existing element (whole value replaced). */
  const updateElement = useCallback((id, patch) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const yElements = doc.getMap('elements');
    const prev = yElements.get(id);
    if (!prev) return;
    doc.transact(() => yElements.set(id, { ...prev, ...patch }), LOCAL);
  }, []);

  /** Merge into an element's `props` sub-object specifically. */
  const updateElementProps = useCallback((id, propsPatch) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const yElements = doc.getMap('elements');
    const prev = yElements.get(id);
    if (!prev) return;
    doc.transact(
      () => yElements.set(id, { ...prev, props: { ...prev.props, ...propsPatch } }),
      LOCAL,
    );
  }, []);

  const removeElement = useCallback((id) => {
    const doc = ydocRef.current;
    if (!doc) return;
    doc.transact(() => {
      doc.getMap('elements').delete(id);
      doc.getMap('comments').delete(id); // drop the element's comment thread too
    }, LOCAL);
  }, []);

  /**
   * Reorder one element within its page's z-stack. `mode` is 'front' | 'back' |
   * 'forward' | 'backward'. The whole page is normalized to contiguous 1..n z
   * values in a single transaction, so concurrent reorders from different
   * clients converge on the same stack (per-key LWW) instead of colliding on a
   * shared max. The z ordering is back→front (higher z renders on top).
   */
  const applyLayerOrder = useCallback((id, mode) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const yElements = doc.getMap('elements');
    const target = yElements.get(id);
    if (!target) return;

    const siblings = [];
    yElements.forEach((v, key) => {
      if (v.pageId === target.pageId && v.type !== 'connector') {
        siblings.push({ key, z: v.z ?? 0 });
      }
    });
    // Deterministic tiebreak on id so every client normalizes identically.
    siblings.sort((a, b) => a.z - b.z || (a.key < b.key ? -1 : 1));

    const idx = siblings.findIndex((s) => s.key === id);
    if (idx === -1) return;
    let newIdx;
    if (mode === 'front') newIdx = siblings.length - 1;
    else if (mode === 'back') newIdx = 0;
    else if (mode === 'forward') newIdx = Math.min(siblings.length - 1, idx + 1);
    else if (mode === 'backward') newIdx = Math.max(0, idx - 1);
    else return;
    if (newIdx === idx) return;

    const [moved] = siblings.splice(idx, 1);
    siblings.splice(newIdx, 0, moved);

    doc.transact(() => {
      siblings.forEach((s, i) => {
        const z = i + 1;
        const prev = yElements.get(s.key);
        if (prev && (prev.z ?? 0) !== z) yElements.set(s.key, { ...prev, z });
      });
    }, LOCAL);
  }, []);

  const bringToFront  = useCallback((id) => applyLayerOrder(id, 'front'),    [applyLayerOrder]);
  const sendToBack    = useCallback((id) => applyLayerOrder(id, 'back'),     [applyLayerOrder]);
  const bringForward  = useCallback((id) => applyLayerOrder(id, 'forward'),  [applyLayerOrder]);
  const sendBackward  = useCallback((id) => applyLayerOrder(id, 'backward'), [applyLayerOrder]);

  // ── Page mutations ─────────────────────────────────────────────────────────

  const addPage = useCallback((title, sectionId) => {
    const doc = ydocRef.current;
    if (!doc) return null;
    const yPages = doc.getArray('pages');
    const id = makeId('page');
    const order = yPages.length
      ? Math.max(...yPages.toArray().map((p) => p.order ?? 0)) + 1
      : 0;
    const record = { id, title: title || `Subsection ${yPages.length + 1}`, order };
    if (sectionId) record.sectionId = sectionId;
    doc.transact(() => yPages.push([record]), LOCAL);
    return id;
  }, []);

  const updatePage = useCallback((id, patch) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const yPages = doc.getArray('pages');
    const idx = yPages.toArray().findIndex((p) => p.id === id);
    if (idx === -1) return;
    doc.transact(() => {
      const prev = yPages.get(idx);
      yPages.delete(idx, 1);
      yPages.insert(idx, [{ ...prev, ...patch }]);
    }, LOCAL);
  }, []);

  const renamePage = useCallback((id, title) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const yPages = doc.getArray('pages');
    const idx = yPages.toArray().findIndex((p) => p.id === id);
    if (idx === -1) return;
    doc.transact(() => {
      const prev = yPages.get(idx);
      yPages.delete(idx, 1);
      yPages.insert(idx, [{ ...prev, title }]);
    }, LOCAL);
  }, []);

  const movePage = useCallback((draggedId, targetId) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const yPages = doc.getArray('pages');
    const arr = yPages.toArray();
    
    const sorted = [...arr].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const dragIdx = sorted.findIndex((p) => p.id === draggedId);
    const targetIdx = sorted.findIndex((p) => p.id === targetId);
    
    if (dragIdx === -1 || targetIdx === -1 || dragIdx === targetIdx) return;

    let newOrder;
    if (dragIdx < targetIdx) {
      // Place after targetIdx
      const afterTarget = sorted[targetIdx + 1];
      if (afterTarget) {
        newOrder = ((sorted[targetIdx].order ?? 0) + (afterTarget.order ?? 0)) / 2;
      } else {
        newOrder = (sorted[targetIdx].order ?? 0) + 1;
      }
    } else {
      // Place before targetIdx
      const beforeTarget = sorted[targetIdx - 1];
      if (beforeTarget) {
        newOrder = ((sorted[targetIdx].order ?? 0) + (beforeTarget.order ?? 0)) / 2;
      } else {
        newOrder = (sorted[targetIdx].order ?? 0) - 1;
      }
    }

    const actualDragIdx = arr.findIndex((p) => p.id === draggedId);
    if (actualDragIdx !== -1) {
      const item = arr[actualDragIdx];
      doc.transact(() => {
        yPages.delete(actualDragIdx, 1);
        yPages.insert(actualDragIdx, [{ ...item, order: newOrder }]);
      }, LOCAL);
    }
  }, []);

  const deletePage = useCallback((id) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const yPages = doc.getArray('pages');
    const idx = yPages.toArray().findIndex((p) => p.id === id);
    if (idx === -1) return;
    doc.transact(() => {
      yPages.delete(idx, 1);
      // Cascade: drop every element that lived on the removed slide.
      const yElements = doc.getMap('elements');
      const orphans = [];
      yElements.forEach((v, key) => {
        if (v.pageId === id) orphans.push(key);
      });
      orphans.forEach((key) => yElements.delete(key));
    }, LOCAL);
  }, []);

  // ── Section mutations ──────────────────────────────────────────────────────

  const addSection = useCallback((title) => {
    const doc = ydocRef.current;
    if (!doc) return null;
    const ySections = doc.getArray('sections');
    const id = makeId('sec');
    const order = ySections.length
      ? Math.max(...ySections.toArray().map((s) => s.order ?? 0)) + 1
      : 0;
    doc.transact(() => ySections.push([{ id, title: title || 'New Section', order }]), LOCAL);
    return id;
  }, []);

  const renameSection = useCallback((id, title) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const ySections = doc.getArray('sections');
    const idx = ySections.toArray().findIndex((s) => s.id === id);
    if (idx === -1) return;
    doc.transact(() => {
      const prev = ySections.get(idx);
      ySections.delete(idx, 1);
      ySections.insert(idx, [{ ...prev, title }]);
    }, LOCAL);
  }, []);

  const deleteSection = useCallback((id) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const ySections = doc.getArray('sections');
    const idx = ySections.toArray().findIndex((s) => s.id === id);
    if (idx === -1) return;
    doc.transact(() => {
      ySections.delete(idx, 1);
      // Unassign pages that belonged to this section (move them to General).
      // Patch each affected page individually — replacing the whole array in one
      // shot is a destructive CRDT operation that can silently clobber concurrent
      // page additions from other peers.
      const yPages = doc.getArray('pages');
      const arr = yPages.toArray();
      arr.forEach((p, i) => {
        if (p.sectionId === id) {
          const { sectionId: _removed, ...rest } = p;
          yPages.delete(i, 1);
          yPages.insert(i, [rest]);
        }
      });
    }, LOCAL);
  }, []);

  /**
   * Ensure the board has at least one page. Runs inside a transaction and
   * re-checks length so concurrent clients don't each seed a page. Returns the
   * id of the first page if it created one, else null.
   */
  const ensureFirstPage = useCallback(() => {
    const doc = ydocRef.current;
    if (!doc) return null;
    const yPages = doc.getArray('pages');
    if (yPages.length > 0) return null;
    const id = makeId('page');
    doc.transact(() => {
      if (yPages.length === 0) yPages.push([{ id, title: 'Subsection 1', order: 0 }]);
    }, LOCAL);
    return id;
  }, []);

  return {
    pages,
    sections,
    elements,
    votes,
    comments,
    castPollVote,
    removePollVote,
    addComment,
    removeComment,
    addElement,
    updateElement,
    updateElementProps,
    bulkUpdate,
    removeElement,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    addPage,
    updatePage,
    renamePage,
    deletePage,
    movePage,
    ensureFirstPage,
    addSection,
    renameSection,
    deleteSection,
  };
}
