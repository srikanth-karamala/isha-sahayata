'use client';

import { useRef, useState, type ReactNode } from 'react';

/** Swipe down on the sheet / edge-swipe from left to dismiss overlays. */
export default function SwipeDismiss({
  onDismiss,
  children,
}: {
  onDismiss: () => void;
  children: ReactNode;
}) {
  const startX = useRef(0);
  const startY = useRef(0);
  const edge = useRef(false);
  const active = useRef(false);
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setOffsetY(0);
    setDragging(false);
    edge.current = false;
    active.current = false;
  };

  const shouldIgnore = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el?.closest) return false;
    if (el.closest('input, textarea, select, button, a, [data-swipe-ignore]')) return true;
    return false;
  };

  return (
    <div
      className="yc-overlay"
      onPointerDown={(e) => {
        const fromHandle = Boolean((e.target as HTMLElement).closest?.('.yc-sheet-handle'));
        const fromEdge = e.clientX <= 28;
        if (!fromHandle && !fromEdge && shouldIgnore(e.target)) return;
        startX.current = e.clientX;
        startY.current = e.clientY;
        edge.current = fromEdge;
        active.current = true;
        setDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!active.current || !dragging) return;
        const dx = e.clientX - startX.current;
        const dy = e.clientY - startY.current;
        if (edge.current && dx > 12 && Math.abs(dx) > Math.abs(dy)) return;
        if (dy > 0 && Math.abs(dy) > Math.abs(dx)) {
          setOffsetY(Math.min(dy, 220));
        }
      }}
      onPointerUp={(e) => {
        if (!active.current || !dragging) return;
        const dx = e.clientX - startX.current;
        const dy = e.clientY - startY.current;
        const dismissEdge = edge.current && dx > 72 && Math.abs(dx) > Math.abs(dy);
        const dismissDown = dy > 96 && Math.abs(dy) > Math.abs(dx);
        reset();
        if (dismissEdge || dismissDown) onDismiss();
      }}
      onPointerCancel={reset}
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        className="yc-overlay-card"
        style={
          offsetY
            ? {
                transform: `translateY(${offsetY}px)`,
                opacity: Math.max(0.45, 1 - offsetY / 280),
                transition: dragging ? 'none' : undefined,
              }
            : undefined
        }
      >
        <div className="yc-sheet-handle" aria-hidden />
        {children}
      </div>
    </div>
  );
}
