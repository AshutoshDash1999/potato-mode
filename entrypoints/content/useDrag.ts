// Drag a fixed-position element around the viewport with pointer events.
// Elements marked [data-nodrag] (buttons) inside the handle don't start a drag.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PanelPos } from '~/lib/state';

const MARGIN = 8;
const DRAG_THRESHOLD = 4;

export function useDrag(initial: PanelPos | null, defaultWidth: number, onSave: (p: PanelPos) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PanelPos>(
    () => initial ?? { x: window.innerWidth - defaultWidth - 24, y: 24, minimized: false },
  );
  const posRef = useRef(pos);
  posRef.current = pos;

  const drag = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  /** True right after a drag ends, so the click that follows can be ignored. */
  const justDragged = useRef(false);

  const clamp = useCallback((x: number, y: number) => {
    const el = ref.current;
    const w = el?.offsetWidth ?? defaultWidth;
    const h = el?.offsetHeight ?? 80;
    return {
      x: Math.round(Math.min(Math.max(MARGIN, x), Math.max(MARGIN, window.innerWidth - w - MARGIN))),
      y: Math.round(Math.min(Math.max(MARGIN, y), Math.max(MARGIN, window.innerHeight - h - MARGIN))),
    };
  }, [defaultWidth]);

  const reclamp = useCallback(() => {
    setPos((p) => {
      const c = clamp(p.x, p.y);
      return c.x === p.x && c.y === p.y ? p : { ...p, ...c };
    });
  }, [clamp]);

  // Keep on screen after resize and after minimise/expand changes the size.
  useLayoutEffect(reclamp, [pos.minimized, reclamp]);
  useEffect(() => {
    window.addEventListener('resize', reclamp);
    return () => window.removeEventListener('resize', reclamp);
  }, [reclamp]);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    if ((e.target as Element).closest('[data-nodrag]')) return;
    drag.current = { px: e.clientX, py: e.clientY, x: posRef.current.x, y: posRef.current.y, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!d.moved) {
      // Capture only once it's really a drag, so plain clicks still reach buttons.
      e.currentTarget.setPointerCapture(e.pointerId);
      d.moved = true;
    }
    setPos((p) => ({ ...p, ...clamp(d.x + dx, d.y + dy) }));
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 0);
      onSave(posRef.current);
    }
  };

  const setMinimized = (minimized: boolean) => {
    const next = { ...posRef.current, minimized };
    setPos(next);
    onSave(next);
  };

  return {
    ref,
    pos,
    setMinimized,
    justDragged,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
