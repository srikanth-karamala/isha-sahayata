'use client';

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
