'use client';

import { useRef } from 'react';
import { Bike } from 'lucide-react';
import { formatDuration } from '@/lib/geo';

export type IslandMode = 'idle' | 'riding' | 'near-drop';

interface DynamicIslandProps {
  mode: IslandMode;
  expanded: boolean;
  onToggle: () => void;
  onSwipeDown: () => void;
  onFocusDropOff?: () => void;
  readyCount: number;
  nearbyLabel?: string;
  qrCode?: string | null;
  distanceMeters?: number;
  elapsedSeconds?: number;
  dropHubName?: string | null;
}

function shortQr(code: string) {
  const parts = code.split('-');
  return parts[parts.length - 1] || code.slice(-3);
}

/** Interactive Dynamic Island — status capsule only; Scan lives on the bottom FAB. */
export default function DynamicIsland({
  mode,
  expanded,
  onToggle,
  onSwipeDown,
  onFocusDropOff,
  readyCount,
  nearbyLabel,
  qrCode,
  distanceMeters = 0,
  elapsedSeconds = 0,
  dropHubName,
}: DynamicIslandProps) {
  const startY = useRef(0);
  const startX = useRef(0);
  const dragging = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    const dy = e.clientY - startY.current;
    const dx = e.clientX - startX.current;
    if (dy > 36 && Math.abs(dy) > Math.abs(dx)) {
      onSwipeDown();
      return;
    }
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      if (mode === 'near-drop' && onFocusDropOff) {
        onFocusDropOff();
        return;
      }
      onToggle();
    }
  };

  const km = (distanceMeters / 1000).toFixed(2);
  const compactLabel =
    mode === 'near-drop'
      ? dropHubName
        ? `Drop · ${dropHubName.split(' ')[0]}`
        : 'Drop off'
      : mode === 'riding' && qrCode
        ? `${shortQr(qrCode)} · ${km}`
        : `${readyCount} ready`;

  return (
    <div
      className={`yc-island ${expanded ? 'is-expanded' : ''} ${mode === 'near-drop' ? 'is-alert' : ''} ${mode === 'riding' ? 'is-live' : ''}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={
        mode === 'near-drop'
          ? 'Near a dock — tap for drop-off, swipe down for sheet'
          : mode === 'riding'
            ? 'Active ride — tap for details, swipe down for sheet'
            : 'Isha Sahayata status — tap for tip, swipe down for docks'
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (mode === 'near-drop' && onFocusDropOff) onFocusDropOff();
          else onToggle();
        }
      }}
    >
      <div className="yc-island-compact">
        {mode === 'idle' ? (
          <span className="yc-island-dot" aria-hidden />
        ) : mode === 'near-drop' ? (
          <Bike className="yc-island-icon" aria-hidden />
        ) : (
          <span className="yc-island-pulse" aria-hidden />
        )}
        <span className="yc-island-compact-label">{compactLabel}</span>
        {mode === 'riding' && (
          <span className="yc-island-compact-meta">{formatDuration(elapsedSeconds)}</span>
        )}
      </div>

      {expanded && (
        <div className="yc-island-panel" onPointerDown={(e) => e.stopPropagation()}>
          {mode === 'idle' && (
            <>
              <p className="yc-island-panel-body">
                {nearbyLabel ? `Nearest: ${nearbyLabel}` : 'Find a dock on the map below'}
              </p>
              <p className="yc-island-hint">Swipe down for the list · Scan with the button below</p>
            </>
          )}

          {mode === 'riding' && (
            <>
              <p className="yc-island-panel-title yc-mono">{qrCode}</p>
              <p className="yc-island-panel-body">
                {km} km · {formatDuration(elapsedSeconds)}
              </p>
              <p className="yc-island-hint">
                {dropHubName
                  ? `Nearest open dock: ${dropHubName}`
                  : 'Ride toward a dock to drop off'}
              </p>
            </>
          )}

          {mode === 'near-drop' && (
            <>
              <p className="yc-island-panel-title">Ready to drop off</p>
              <p className="yc-island-panel-body">
                At {dropHubName ?? 'a dock'} — use the slide control in the sheet.
              </p>
              {onFocusDropOff && (
                <button type="button" className="yc-island-cta" onClick={onFocusDropOff}>
                  Show slide to drop off
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
