'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bus, MapPin, ArrowRight, Clock, Tractor } from 'lucide-react';
import { getShuttleRoutes, type ShuttleRoute } from '@/app/shuttle-actions';
import CabRequestPanel from './CabRequestPanel';
import ShuttleMetroMap from './ShuttleMetroMap';
import type { RiderIdentity } from '@/lib/rider-identity';

/**
 * Ride — the shuttles and bullock carts that cross the campus.
 *
 * The question this answers is "which one do I take from where I am", so the
 * default view is by starting point rather than by route name: you know where
 * you are standing, and you may never have heard of "Welcome Point – Nalanda
 * – Brahmaputra".
 *
 * The routes and their stops are confirmed, from the ashram's published list.
 * The hours are not — nobody has read them off the board at the stand — so
 * every route says so rather than showing a timetable nobody checked. That is
 * the same rule the Info tab follows, and for the same reason: someone who
 * waits at a stop for a service that stopped running an hour ago has been
 * misled by the app.
 */
export default function RidePanel({
  userId,
  riderName,
  riderPhone,
  onIdentityChange,
}: {
  userId: string | null;
  riderName: string;
  riderPhone: string;
  onIdentityChange?: (identity: RiderIdentity) => void;
}) {
  const [routes, setRoutes] = useState<ShuttleRoute[] | null>(null);
  const [from, setFrom] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getShuttleRoutes().then((r) => {
      if (!cancelled) setRoutes(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Every stop, with how many routes call there and which kinds of vehicle.
   *
   * The kind matters at the moment of choosing: a bullock cart and an e-buggy
   * are different propositions, and a visitor deciding where to walk should
   * see which one actually serves a stop before they get there rather than
   * after.
   */
  const stops = useMemo(() => {
    if (!routes) return [];
    const seen = new Map<string, { count: number; buggy: boolean; bullock: boolean }>();
    for (const r of routes) {
      for (const s of r.stops) {
        const at = seen.get(s.name) ?? { count: 0, buggy: false, bullock: false };
        at.count += 1;
        if (r.kind === 'BULLOCK') at.bullock = true;
        else at.buggy = true;
        seen.set(s.name, at);
      }
    }
    // Busiest first: the stop serving most routes is the likeliest to be
    // where someone is standing when they open this.
    return [...seen.entries()]
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
      .map(([name, at]) => ({ name, ...at }));
  }, [routes]);

  const shown = useMemo(() => {
    if (!routes) return [];
    if (!from) return routes;
    return routes.filter((r) => r.stops.some((s) => s.name === from));
  }, [routes, from]);

  return (
    <div className="yc-sheet yc-info-panel">
      <div className="px-4 pt-3.5 pb-2">
        <p className="yc-eyebrow">Ride</p>
        <h2 className="yc-title yc-title-md mt-1.5">
          {from ? `Leaving from ${from}` : 'Shuttles across the campus'}
        </h2>
      </div>

      {/* Filter by where you are. "All routes" first so the unfiltered view is
          always one tap away rather than needing a cleared selection. */}
      {stops.length > 0 && (
        <div className="yc-info-tabs" role="tablist" aria-label="Starting point">
          <button
            type="button"
            role="tab"
            aria-selected={from === null}
            onClick={() => setFrom(null)}
            className={`yc-info-tab${from === null ? ' is-active' : ''}`}
          >
            All routes
          </button>
          {stops.map(({ name, buggy, bullock }) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={from === name}
              onClick={() => setFrom(name)}
              className={`yc-info-tab${from === name ? ' is-active' : ''}`}
              title={`${name} — served by ${[buggy && 'e-buggy', bullock && 'bullock cart']
                .filter(Boolean)
                .join(' and ')}`}
            >
              {name}
              {/* Which vehicle serves this stop, so the choice is visible
                  before walking there. Icons carry a title and the button's
                  own label spells it out, so this is never colour or shape
                  alone. */}
              <span className="yc-tab-modes" aria-hidden="true">
                {buggy && <Bus className="w-3 h-3" />}
                {bullock && <Tractor className="w-3 h-3" />}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="yc-info-body">
        {/* The diagram above the list, because it answers a different
            question: which lines exist and where they meet, rather than the
            detail of any one of them. Rendered only once the routes have
            loaded — an empty diagram is worse than none. */}
        {routes !== null && routes.length > 0 && (
          <div className="mb-3">
            <ShuttleMetroMap
              routes={routes}
              selectedStop={from}
              onSelectStop={(name) => setFrom((cur) => (cur === name ? null : name))}
            />
          </div>
        )}

        {/* One notice for the lot. The routes are confirmed from the ashram's
            published list; the hours are not, and saying so once is more
            likely to be read than saying it seven times. */}
        {routes !== null && routes.some((r) => !r.hours || !r.hoursChecked) && (
          <p className="yc-route-hours yc-route-hours-lead">
            <Clock className="w-3 h-3 shrink-0 mt-[2px]" aria-hidden />
            <span>
              Running hours have not been confirmed on site. The stand itself,
              or the Main Gate desk, has today&rsquo;s times.
            </span>
          </p>
        )}

        {routes === null ? (
          <p className="yc-body-sm px-1">Loading routes…</p>
        ) : shown.length === 0 ? (
          <div className="yc-info-empty">
            <Bus className="w-6 h-6 opacity-40" aria-hidden />
            <p className="yc-body-sm mt-2.5">No route calls at this stop.</p>
            {/* Without this the tab is a dead end: a filter matching nothing
                left the whole panel empty with no way back but guessing. */}
            <button
              type="button"
              onClick={() => setFrom(null)}
              className="yc-btn-ghost mt-2"
            >
              Show all routes
            </button>
          </div>
        ) : (
          <ul className="yc-info-list">
            {shown.map((r) => (
              <li key={r.id} className="yc-info-card">
                <div className="flex items-start justify-between gap-2.5">
                  <p className="yc-title yc-title-sm">{r.name}</p>
                  {r.kind === 'BULLOCK' && (
                    <span className="yc-info-chip" title="Bullock cart, not an electric buggy">
                      Bullock
                    </span>
                  )}
                </div>

                {/* The stops in order, which is the answer to "does this one
                    go where I am going". */}
                <ol className="yc-route-stops">
                  {r.stops.map((s, i) => (
                    <li key={s.id}>
                      <MapPin className="w-3.5 h-3.5 shrink-0 opacity-55" aria-hidden />
                      <span className={s.name === from ? 'yc-strong' : undefined}>
                        {s.name}
                      </span>
                      {i < r.stops.length - 1 && (
                        <ArrowRight className="w-3 h-3 shrink-0 opacity-35" aria-hidden />
                      )}
                    </li>
                  ))}
                </ol>

                {/* Only the routes whose hours someone has actually read off
                    the board carry a line here. The rest are covered once, at
                    the top — repeating the same caveat down seven cards
                    trains people to stop reading it. */}
                {r.hours && r.hoursChecked && (
                  <p className="yc-route-hours">
                    <Clock className="w-3 h-3 shrink-0 mt-[2px]" aria-hidden />
                    <span>{r.hours}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Asking for a cab sits below the routes: a shuttle is the free
            option most people want, and the cab is what you fall back to when
            no route serves your errand. */}
        <CabRequestPanel
          userId={userId}
          riderName={riderName}
          riderPhone={riderPhone}
          onIdentityChange={onIdentityChange}
        />
      </div>
    </div>
  );
}
