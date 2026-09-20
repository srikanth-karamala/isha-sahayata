'use client';

import { Bus, Phone, MapPin } from 'lucide-react';
import { ASHRAM_FACTS, CAMPUS_LANDMARKS } from '@/lib/ashram-knowledge';

/**
 * Ride — shuttles and lifts across the campus.
 *
 * NOT YET BUILT. This tab is deliberately a stub, and it is important that it
 * reads as one rather than as a broken feature.
 *
 * The service needs a data model of its own (vehicles, stops, timings, and
 * possibly requests with an accept/assign step and a staff-side console) and
 * three product questions answered first: fixed-route timetable or on-demand
 * request; who drives; whether a request needs accepting. Guessing at those
 * would mean building the wrong thing twice.
 *
 * Meanwhile the two shuttle entries in `lib/ashram-knowledge.ts` are both
 * PLACEHOLDER — nobody has confirmed the hours, the route or the fare — so
 * there is no honest timetable to show. When someone confirms them the facts
 * appear here automatically, exactly as they do on the Info tab.
 */
export default function RidePanel() {
  const shuttleFacts = ASHRAM_FACTS.filter(
    (f) =>
      f.verified !== 'PLACEHOLDER' &&
      (f.topic === 'Shuttle and golf cart service' ||
        f.topic === 'Shuttle pick-up and drop-off points')
  );

  return (
    <div className="yc-sheet yc-info-panel">
      <div className="px-4 pt-3.5 pb-2">
        <p className="yc-eyebrow">Ride</p>
        <h2 className="yc-title yc-title-md mt-1.5">Shuttles and lifts</h2>
      </div>

      <div className="yc-info-body">
        {shuttleFacts.length > 0 ? (
          <ul className="yc-info-list">
            {shuttleFacts.map((f) => (
              <li key={f.topic} className="yc-info-card">
                <p className="yc-title yc-title-sm">{f.topic}</p>
                <p className="yc-body-sm mt-1.5">{f.detail}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="yc-info-empty">
            <Bus className="w-6 h-6 opacity-40" aria-hidden />
            <p className="yc-title yc-title-sm mt-3">Coming soon</p>
            <p className="yc-body-sm mt-2 max-w-[18rem]">
              Booking a shuttle or asking for a lift across the campus will live
              here. It is not ready yet.
            </p>
            <p className="yc-meta mt-2 max-w-[18rem]">
              The shuttle hours and stops have not been confirmed on site, so
              Sahayata would rather show nothing than a timetable that sends you
              to the wrong place.
            </p>
            <a href="tel:+918300083111" className="yc-btn-ghost mt-3.5">
              <Phone className="w-3.5 h-3.5" aria-hidden />
              Ask the enquiry desk
            </a>
          </div>
        )}

        <div className="yc-info-landmarks">
          <p className="yc-eyebrow">In the meantime</p>
          <p className="yc-meta mt-1 mb-2">
            A yellow cycle is available at each of these stands.
          </p>
          <ul>
            {CAMPUS_LANDMARKS.map((l) => (
              <li key={l}>
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-[2px] opacity-55" aria-hidden />
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
