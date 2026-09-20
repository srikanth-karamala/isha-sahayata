'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bike, Bus, Search, Info } from 'lucide-react';

export type RiderTab = 'cycles' | 'ride' | 'lost-found' | 'info';

/**
 * Persistent bottom navigation for the rider app.
 *
 * Four destinations, one per service. Reporting a fault used to sit here as a
 * fifth: it was promoted out of the checkout flow because the common case is
 * walking up to a visibly broken cycle and wanting to flag it without
 * unlocking it first. That reasoning still holds, but a fault is always about
 * a cycle, so it now lives as an action inside the Cycles tab rather than a
 * top-level peer of the services. Five tabs left each one ~75px wide on a
 * phone and made "Lost & Found" wrap.
 */
export default function BottomNav({
  active,
  onChange,
}: {
  active: RiderTab;
  onChange: (tab: RiderTab) => void;
}) {
  const tabs: { id: RiderTab; label: string; Icon: typeof Bike }[] = [
    { id: 'cycles', label: 'Cycles', Icon: Bike },
    { id: 'ride', label: 'Ride', Icon: Bus },
    { id: 'lost-found', label: 'Lost & Found', Icon: Search },
    { id: 'info', label: 'Info', Icon: Info },
  ];

  // The selected tab's amber fill is drawn once, behind the buttons, and moved
  // to whichever is active — so it travels between tabs rather than vanishing
  // here and reappearing there. Its position has to be measured, because the
  // buttons are sized by their labels and "Lost & Found" is much wider than
  // "Ride".
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  // Before paint, so the pill is never briefly in the wrong place.
  useLayoutEffect(() => {
    const el = itemRefs.current[active];
    const nav = navRef.current;
    if (!el || !nav) return;
    setPill({ x: el.offsetLeft, w: el.offsetWidth });
  }, [active]);

  // Labels reflow when the viewport changes, so the measurement has to follow.
  useEffect(() => {
    const onResize = () => {
      const el = itemRefs.current[active];
      if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active]);

  return (
    <nav className="yc-nav" aria-label="Main" ref={navRef}>
      {/* Hidden until measured: a pill at 0,0 on the first frame would be
          visible as a flash in the corner. */}
      {pill && (
        <span
          className="yc-nav-pill"
          aria-hidden="true"
          style={{ transform: `translateX(${pill.x}px)`, width: pill.w }}
        />
      )}
      {tabs.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            ref={(el) => {
              itemRefs.current[id] = el;
            }}
            onClick={() => onChange(id)}
            className={`yc-nav-item ${isActive ? 'is-active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="w-[1.15rem] h-[1.15rem]" strokeWidth={isActive ? 2.4 : 1.9} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
