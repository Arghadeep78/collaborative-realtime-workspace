import { useCallback, useRef, useState } from 'react';
import { FLUSH_MS } from './boardConstants.js';

/**
 * Native-pointer drag for a single absolutely-positioned element.
 *
 * Screen-space pointer deltas are divided by the live canvas `scale` to convert
 * back into slide units. `onPreview` fires every move for buttery local motion;
 * `onCommit` is throttled to FLUSH_MS so we don't flood the Yjs socket during a
 * continuous drag, with a guaranteed final commit on pointer-up.
 *
 * @param {object}   opts
 * @param {() => number} opts.getScale   reads the current canvas→screen scale
 * @param {(x:number,y:number)=>void} opts.onPreview  local-only position update
 * @param {(x:number,y:number)=>void} opts.onCommit   write {x,y} to Yjs
 * @param {(x:number,y:number)=>void} [opts.onEnd]    fired once on pointer-up
 * @param {number} [opts.snapStep]      if >0, positions snap to this grid step
 */
export function useElementDrag({ getScale, onPreview, onCommit, onEnd, snapStep = 0 }) {
  const [dragging, setDragging] = useState(false);
  const ref = useRef(null);
  // Latest callbacks/options without re-creating the listeners mid-drag.
  const cb = useRef({});
  cb.current = { onPreview, onCommit, onEnd, snapStep, getScale };

  const startDrag = useCallback((e, element) => {
    // Only left button; ignore if starting on an interactive child handled it.
    if (e.button !== 0) return;
    e.stopPropagation();
    const scale = cb.current.getScale() || 1;
    ref.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: element.x,
      origY: element.y,
      latest: { x: element.x, y: element.y },
      lastWrite: 0,
    };
    setDragging(true);

    const snap = (v) => {
      const step = cb.current.snapStep;
      return step > 0 ? Math.round(v / step) * step : v;
    };

    const onMove = (ev) => {
      const s = ref.current;
      if (!s) return;
      const sc = cb.current.getScale() || scale;
      const x = snap(s.origX + (ev.clientX - s.startX) / sc);
      const y = snap(s.origY + (ev.clientY - s.startY) / sc);
      s.latest = { x, y };
      cb.current.onPreview(x, y);
      const now = performance.now();
      if (now - s.lastWrite >= FLUSH_MS) {
        s.lastWrite = now;
        cb.current.onCommit(x, y);
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const s = ref.current;
      if (s) {
        cb.current.onCommit(s.latest.x, s.latest.y); // guaranteed final write
        cb.current.onEnd?.(s.latest.x, s.latest.y);
      }
      ref.current = null;
      setDragging(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, []);

  return { dragging, startDrag };
}
