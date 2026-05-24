import { useCallback, useEffect, useRef, useState } from 'react';
import { getBoardTypes, makeId } from './boardConstants.js';

// Transaction origin tag for local edits. We don't *need* it for correctness
// (values are plain JSON, observed shallowly), but tagging keeps intent legible
// and lets future code distinguish local vs remote transactions if needed.
const LOCAL = 'board-local';

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
  const [elements, setElements] = useState({});
  const [votes, setVotes] = useState({});
  const ydocRef = useRef(ydoc);
  ydocRef.current = ydoc;

  useEffect(() => {
    if (!ydoc) return;
    const { yPages, yElements, yVotes } = getBoardTypes(ydoc);

    const syncPages = () => {
      const arr = yPages.toArray().map((p) => ({ ...p }));
      arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setPages(arr);
    };
    const syncElements = () => setElements(yElements.toJSON());
    const syncVotes = () => setVotes(yVotes.toJSON());

    syncPages();
    syncElements();
    syncVotes();
    yPages.observe(syncPages);
    yElements.observe(syncElements);
    yVotes.observe(syncVotes);

    return () => {
      yPages.unobserve(syncPages);
      yElements.unobserve(syncElements);
      yVotes.unobserve(syncVotes);
    };
  }, [ydoc]);

  /**
   * Adjust a poll tally by `delta`, clamped at zero. Tallies live in the reused
   * `votes` Y.Map under flat keys (e.g. `poll:<pollId>:<optionId>`), so the Poll
   * Block needs only this one primitive.
   */
  const bumpVote = useCallback((key, delta) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const yVotes = doc.getMap('votes');
    doc.transact(() => yVotes.set(key, Math.max(0, (yVotes.get(key) || 0) + delta)), LOCAL);
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
    doc.transact(() => doc.getMap('elements').delete(id), LOCAL);
  }, []);

  /** Bring an element to the front (max z + 1) on the active page. */
  const bringToFront = useCallback((id) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const yElements = doc.getMap('elements');
    const prev = yElements.get(id);
    if (!prev) return;
    let maxZ = 0;
    yElements.forEach((v) => {
      if (v.pageId === prev.pageId && (v.z ?? 0) > maxZ) maxZ = v.z;
    });
    if ((prev.z ?? 0) >= maxZ) return;
    doc.transact(() => yElements.set(id, { ...prev, z: maxZ + 1 }), LOCAL);
  }, []);

  // ── Page mutations ─────────────────────────────────────────────────────────

  const addPage = useCallback((title) => {
    const doc = ydocRef.current;
    if (!doc) return null;
    const yPages = doc.getArray('pages');
    const id = makeId('page');
    const order = yPages.length
      ? Math.max(...yPages.toArray().map((p) => p.order ?? 0)) + 1
      : 0;
    doc.transact(
      () => yPages.push([{ id, title: title || `Slide ${yPages.length + 1}`, order }]),
      LOCAL,
    );
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

  /**
   * Ensure the board has at least one slide. Runs inside a transaction and
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
      if (yPages.length === 0) yPages.push([{ id, title: 'Slide 1', order: 0 }]);
    }, LOCAL);
    return id;
  }, []);

  return {
    pages,
    elements,
    votes,
    bumpVote,
    addElement,
    updateElement,
    updateElementProps,
    bulkUpdate,
    removeElement,
    bringToFront,
    addPage,
    updatePage,
    renamePage,
    deletePage,
    ensureFirstPage,
  };
}
