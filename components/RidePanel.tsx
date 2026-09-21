'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bus, MapPin, Phone, ArrowRight, Clock } from 'lucide-react';
import { getShuttleRoutes, type ShuttleRoute } from '@/app/shuttle-actions';

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
export default function RidePanel() {
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

  /** Every stop that at least one route departs from or calls at. */
  const stops = useMemo(() => {
    if (!routes) return [];
    const seen = new Map<string, number>();
    for (const r of routes) {
      for (const s of r.stops) seen.set(s.name, (seen.get(s.name) ?? 0) + 1);
    }
    // Busiest first: the stop serving most routes is the likeliest to be
    // where someone is standing when they open this.
    return [...seen.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
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
          {stops.map(({ name }) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={from === name}
              onClick={() => setFrom(name)}
              className={`yc-info-tab${from === name ? ' is-active' : ''}`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="yc-info-body">
        {routes === null ? (
          <p className="yc-body-sm px-1">Loading routes…</p>
        ) : shown.length === 0 ? (
          <div className="yc-info-empty">
            <Bus className="w-6 h-6 opacity-40" aria-hidden />
            <p className="yc-body-sm mt-2.5">No route calls at this stop.</p>
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

                <p className="yc-route-hours">
                  <Clock className="w-3 h-3 shrink-0 mt-[2px]" aria-hidden />
                  <span>
                    {r.hours && r.hoursChecked
                      ? r.hours
                      : 'Running hours not confirmed — ask at the stand or the Main Gate desk.'}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}

        <p className="yc-info-foot">
          <Phone className="w-3 h-3 shrink-0 mt-[2px] opacity-55" aria-hidden />
          <span>
            Routes are as published by the ashram. For today&rsquo;s running
            times, the desk at Main Gate can help —{' '}
            <a href="tel:+918300083111" className="yc-info-tel">
              +91 83000 83111
            </a>
            .
          </span>
        </p>
      </div>
    </div>
  );
}
