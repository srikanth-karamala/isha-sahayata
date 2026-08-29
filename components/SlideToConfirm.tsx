'use client';

import { useRef, useState } from 'react';

/** Horizontal slide-to-confirm. Disabled until `armed` (e.g. within dock geofence). */
export default function SlideToConfirm({
  label,
  armedLabel,
  disabledLabel,
  armed,
  onConfirm,
  disabled,
}: {
  label?: string;
  armedLabel?: string;
  disabledLabel?: string;
  armed: boolean;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const maxX = useRef(0);
  const confirmed = useRef(false);

  const canUse = armed && !disabled;
  const text = !canUse ? disabledLabel ?? 'Move closer to the dock' : armedLabel ?? label ?? 'Slide to confirm';

  const begin = (clientX: number) => {
    if (!canUse || !trackRef.current) return;
    confirmed.current = false;
    const track = trackRef.current.getBoundingClientRect();
    maxX.current = Math.max(0, track.width - 52);
    startX.current = clientX;
    setDragging(true);
    setDragX(0);
  };

  const move = (clientX: number) => {
    if (!dragging || !canUse) return;
    const next = Math.min(maxX.current, Math.max(0, clientX - startX.current));
    setDragX(next);
    if (next >= maxX.current * 0.92 && !confirmed.current) {
      confirmed.current = true;
      setDragging(false);
      setDragX(maxX.current);
      onConfirm();
    }
  };

  const end = () => {
    if (!dragging) return;
    setDragging(false);
    if (!confirmed.current) setDragX(0);
  };

  return (
    <div
      ref={trackRef}
      className={`yc-slide ${canUse ? 'is-armed' : 'is-locked'}`}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        begin(e.clientX);
      }}
      onPointerMove={(e) => move(e.clientX)}
      onPointerUp={end}
      onPointerCancel={end}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round((dragX / Math.max(maxX.current, 1)) * 100)}
      aria-disabled={!canUse}
      aria-label={text}
    >
      <p className="yc-slide-label">{text}</p>
      <div
        className="yc-slide-knob"
        style={{ transform: `translateX(${dragX}px)` }}
      >
        <span aria-hidden>››</span>
      </div>
    </div>
  );
}
