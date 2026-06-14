import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { getBoardTypes, makeId, LOCAL_ORIGIN, myColor } from './boardConstants.js';
import { GENERAL_SECTION } from './taskConstants.js';

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
    yElements.observeDeep(syncElements); // elements are nested Y.Maps now
    yVotes.observeDeep(syncVotes); // Use observeDeep so nested Map changes trigger re-sync!
    yComments.observeDeep(syncComments); // nested per-element Map → observeDeep

    return () => {
      yPages.unobserve(syncPages);
      ySections.unobserve(syncSections);
      yElements.unobserveDeep(syncElements);
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
  //
  // Each element is stored as a nested Y.Map (top-level keys: type, pageId, x, y,
  // w, h, z, props, …) whose `props` value is itself a Y.Map. Storing fields as
  // individual map keys — rather than one plain object per element — means a
  // concurrent change to *different* fields (e.g. one client sets `assignees`
  // while another sets `status`) merges per-key instead of clobbering the whole
  // element (last-write-wins on the blob). Same nested-Y.Map shape as votes /
  // comments. `toJSON()` in syncElements deep-serialises these back to plain
  // objects, so every reader still sees plain element objects.

  // Write a plain record into the elements map as a nested Y.Map. A nested
  // Y.Map must be *integrated into the document before its children are
  // populated* — populating a detached nested Y.Map and then attaching it drops
  // the children. So we attach the element map first, then fill it, creating and
  // attaching the inner `props` map before setting prop keys on it. Must run
  // inside a transaction. Returns the integrated element Y.Map.
  const writeElementMap = (yElements, id, record) => {
    const m = new Y.Map();
    yElements.set(id, m); // integrate first
    Object.entries(record).forEach(([k, v]) => {
      if (k === 'props') {
        const pm = new Y.Map();
        m.set('props', pm); // attach before populating
        Object.entries(v || {}).forEach(([pk, pv]) => pm.set(pk, pv));
      } else {
        m.set(k, v);
      }
    });
    if (!(m.get('props') instanceof Y.Map)) m.set('props', new Y.Map());
    return m;
  };

  // Return the element's Y.Map, upgrading a legacy plain-object element (from
  // boards saved before this change) to a Y.Map in place on first write. Must be
  // called inside a transaction. Returns null if the element doesn't exist.
  const ensureElementMap = (yElements, id) => {
    const cur = yElements.get(id);
    if (cur instanceof Y.Map) return cur;
    if (cur == null) return null;
    return writeElementMap(yElements, id, cur); // re-attaches as Y.Map in place
  };

  /** Create an element. Caller supplies type/pageId/geometry/props/createdBy. */
  const addElement = useCallback((el) => {
    const doc = ydocRef.current;
    if (!doc) return null;
    const id = el.id || makeId(el.type || 'el');
    const record = { z: 1, props: {}, ...el, id };
    doc.transact(() => writeElementMap(doc.getMap('elements'), id, record), LOCAL);
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
        const m = ensureElementMap(yElements, id);
        if (!m) return;
        Object.entries(patch).forEach(([k, v]) => m.set(k, v));
      });
    }, LOCAL);
  }, []);

  /** Merge a patch into an element's top-level fields (per-key, not whole-blob). */
  const updateElement = useCallback((id, patch) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const yElements = doc.getMap('elements');
    doc.transact(() => {
      const m = ensureElementMap(yElements, id);
      if (!m) return;
      Object.entries(patch).forEach(([k, v]) => m.set(k, v));
    }, LOCAL);
  }, []);

  /** Merge a patch into an element's `props` — per-key, so a concurrent change
   *  to a different prop (e.g. assignees vs status) doesn't clobber it. */
  const updateElementProps = useCallback((id, propsPatch) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const yElements = doc.getMap('elements');
    doc.transact(() => {
      const m = ensureElementMap(yElements, id);
      if (!m) return;
      let props = m.get('props');
      if (!(props instanceof Y.Map)) { props = new Y.Map(); m.set('props', props); }
      Object.entries(propsPatch).forEach(([k, v]) => props.set(k, v));
    }, LOCAL);
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
    // Read a field from an element value that may be a Y.Map (new) or a legacy
    // plain object (boards saved before the per-field migration).
    const field = (v, k) => (v instanceof Y.Map ? v.get(k) : v?.[k]);
    const targetPage = field(target, 'pageId');

    const siblings = [];
    yElements.forEach((v, key) => {
      if (field(v, 'pageId') === targetPage && field(v, 'type') !== 'connector') {
        siblings.push({ key, z: field(v, 'z') ?? 0 });
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
        const m = ensureElementMap(yElements, s.key);
        if (m && (m.get('z') ?? 0) !== z) m.set('z', z);
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
    const record = { id, title: title || 'Untitled', order };
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
      // Adopt the target's section so dropping a subsection onto a page in another
      // section reparents it (cross-section move), not just reorders.
      const targetSectionId = sorted[targetIdx].sectionId;
      doc.transact(() => {
        yPages.delete(actualDragIdx, 1);
        yPages.insert(actualDragIdx, [{ ...item, order: newOrder, sectionId: targetSectionId }]);
      }, LOCAL);
    }
  }, []);

  /**
   * Move a subsection into a section (by id), or out to "no section" when
   * sectionId is undefined. Used when dropping onto an empty section's body.
   * Places it last within the target section's order range.
   */
  const movePageToSection = useCallback((pageId, sectionId) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const yPages = doc.getArray('pages');
    const arr = yPages.toArray();
    const idx = arr.findIndex((p) => p.id === pageId);
    if (idx === -1) return;
    const item = arr[idx];
    if (item.sectionId === sectionId) return;
    const inTarget = arr.filter((p) => p.sectionId === sectionId && p.id !== pageId);
    const maxOrder = inTarget.length
      ? Math.max(...inTarget.map((p) => p.order ?? 0))
      : 0;
    doc.transact(() => {
      yPages.delete(idx, 1);
      yPages.insert(idx, [{ ...item, sectionId, order: maxOrder + 1 }]);
    }, LOCAL);
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
        const pageId = v instanceof Y.Map ? v.get('pageId') : v?.pageId;
        if (pageId === id) orphans.push(key);
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
    doc.transact(() => ySections.push([{ id, title: title || 'Untitled', order }]), LOCAL);
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
   * Ensure the board has a real "General" section and at least one page inside it.
   * "General" is a normal stored section (id `__general__`, order -1 so it sorts
   * first) — renamable and deletable like any other, not a virtual catch-all.
   * Runs inside a transaction and re-checks length so concurrent clients don't
   * each seed. Returns the id of the first page if it created one, else null.
   */
  const ensureFirstPage = useCallback(() => {
    const doc = ydocRef.current;
    if (!doc) return null;
    const yPages = doc.getArray('pages');
    if (yPages.length > 0) return null;
    const id = makeId('page');
    doc.transact(() => {
      if (yPages.length > 0) return;
      const ySections = doc.getArray('sections');
      const hasGeneral = ySections.toArray().some((s) => s.id === GENERAL_SECTION.id);
      if (!hasGeneral) {
        ySections.push([{ id: GENERAL_SECTION.id, title: GENERAL_SECTION.title, order: -1 }]);
      }
      yPages.push([{ id, title: 'Untitled', order: 0, sectionId: GENERAL_SECTION.id }]);
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
    movePageToSection,
    ensureFirstPage,
    addSection,
    renameSection,
    deleteSection,
  };
}
