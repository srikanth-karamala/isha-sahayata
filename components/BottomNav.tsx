'use client';

import { Bike, Search, Wrench } from 'lucide-react';

export type RiderTab = 'cycles' | 'report' | 'lost-found';

/**
 * Persistent bottom navigation for the rider app.
 *
 * "Report" is a first-class destination rather than something buried behind a
 * checkout: the common case is walking up to a visibly broken cycle and wanting
 * to flag it without unlocking it first.
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
    { id: 'report', label: 'Report', Icon: Wrench },
    { id: 'lost-found', label: 'Lost & Found', Icon: Search },
  ];

  return (
    <nav className="yc-nav" aria-label="Main">
      {tabs.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
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
