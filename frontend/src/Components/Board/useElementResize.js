import { useCallback, useRef, useState } from 'react';
import { FLUSH_MS, MIN_W, MIN_H } from './boardConstants.js';

/**
 * Native-pointer resize from the bottom-right handle. Same scale-correction and
 * throttle/commit discipline as {@link useElementDrag}. Phase 1 ships a single
 * SE handle (w/h only); edge/corner handles can be layered on later.
 *
 * @param {object} opts
 * @param {() => number} opts.getScale
 * @param {(w:number,h:number)=>void} opts.onPreview  local-only size update
 * @param {(w:number,h:number)=>void} opts.onCommit   write {w,h} to Yjs
 */
export function useElementResize({ getScale, onPreview, onCommit }) {
  const [resizing, setResizing] = useState(false);
  const ref = useRef(null);

  const startResize = useCallback(
    (e, element) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const scale = getScale() || 1;
      ref.current = {
        startX: e.clientX,
        startY: e.clientY,
        origW: element.w,
        origH: element.h,
        latest: { w: element.w, h: element.h },
        lastWrite: 0,
      };
      setResizing(true);

      const onMove = (ev) => {
        const s = ref.current;
        if (!s) return;
        const sc = getScale() || scale;
        const w = Math.max(MIN_W, s.origW + (ev.clientX - s.startX) / sc);
        const h = Math.max(MIN_H, s.origH + (ev.clientY - s.startY) / sc);
        s.latest = { w, h };
        onPreview(w, h);
        const now = performance.now();
        if (now - s.lastWrite >= FLUSH_MS) {
          s.lastWrite = now;
          onCommit(w, h);
        }
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        const s = ref.current;
        if (s) onCommit(s.latest.w, s.latest.h);
        ref.current = null;
        setResizing(false);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [getScale, onPreview, onCommit],
  );

  return { resizing, startResize };
}
