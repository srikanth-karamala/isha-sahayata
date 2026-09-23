'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ShuttleRoute } from '@/app/shuttle-actions';

/**
 * The campus shuttle network, drawn as an underground-style metro diagram.
 *
 * Deliberately **not** geographic, and this is the second design. The first
 * plotted the real latitude and longitude of every stop, which was accurate
 * and unreadable: four stops sit within 130m of Welcome Point while Adiyogi is
 * 866m south, so a faithful plot crushed half the network into a knot of
 * overlapping labels and spent a third of the frame on empty ground between
 * the two clusters. Every attempt to fix the legibility traded away the
 * accuracy that was the point of plotting positions at all.
 *
 * A metro diagram resolves that by abandoning geography outright. Lines run
 * horizontally at a fixed pitch, turn through rounded elbows to leave a shared
 * interchange, and stops sit at even spacing regardless of the real distance
 * between them. The London tube map works the same way and is the better for
 * it: a passenger needs to know which line to take and where it calls, not how
 * many metres lie between two platforms.
 *
 * Interchange topology is the one thing that survives. Welcome Point serves
 * four routes, so it is drawn once as a junction with its lines fanning out,
 * rather than repeated at the head of four separate rows.
 *
 * The stop coordinates in the database are still worth keeping: they are what
 * a future geographic layer would draw on the real campus map, and they are
 * what proved that two routes were stored back to front.
 *
 * ## About the moving vehicles
 *
 * Nothing on this campus is tracked. There is no GPS on a buggy, no feed, no
 * position to render. The animation illustrates where a route runs and in
 * which direction, and says so in three places: the caption, the footnote, and
 * the SVG's aria-label for anyone using a screen reader.
 *
 * This matters. A visitor who waits at a stop because a moving dot suggested a
 * buggy was coming has been misled by the app — the same failure as a
 * confidently wrong darshan timing. The mitigation available without removing
 * the motion is to keep the vehicles reading as diagrammatic: an even
 * unhurried pace no real vehicle keeps, no pause at stops, and a loop rather
 * than a terminus. Do not "improve" this with realistic dwell times or varying
 * speeds. Every step toward realism is a step toward a lie.
 *
 * Motion is disabled entirely under `prefers-reduced-motion`.
 */

const LINE_GAP = 64;
const STOP_GAP = 158;
const TOP = 56;
const HUB_X = 150;
const ELBOW = 20;
/** Clear of the hub's elbow before the first stop of a branching line. */
const BRANCH_LEAD = 54;

const LINE_COLORS = ['#D98324', '#3F7D58', '#3E5F8A', '#A34A6B', '#7A6299'];
const BULLOCK_COLOR = '#8A7E70';

interface Lane {
  route: ShuttleRoute;
  color: string;
  index: number;
  y: number;
  startX: number;
  points: { name: string; x: number; y: number }[];
  fromHub: boolean;
}

export default function ShuttleMetroMap({
  routes,
  selectedStop,
  onSelectStop,
}: {
  routes: ShuttleRoute[];
  selectedStop?: string | null;
  onSelectStop?: (name: string) => void;
}) {
  const [reduced, setReduced] = useState(false);
  const [t, setT] = useState(0);
  const frame = useRef<number | null>(null);
  /**
   * 1 fits the whole diagram to the panel; above that it overflows and the
   * container scrolls. Fit is the resting state because the first thing a
   * visitor needs is the shape of the network, not a detail of it.
   */
  const [zoom, setZoom] = useState(1);
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 2.6;
  const ZOOM_STEP = 0.35;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (reduced) return;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      setT((((now - start) / 15000) % 1 + 1) % 1);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [reduced]);

  const { lanes, hub, width, height } = useMemo(() => {
    // Whichever stop the most routes start from becomes the interchange.
    const starts = new Map<string, number>();
    for (const r of routes) {
      const first = r.stops[0]?.name;
      if (first) starts.set(first, (starts.get(first) ?? 0) + 1);
    }
    let hubName: string | null = null;
    let best = 1;
    for (const [name, n] of starts) {
      if (n > best) {
        hubName = name;
        best = n;
      }
    }

    // Routes off the hub are drawn together, so their elbows fan from one
    // junction instead of crossing the lines that do not share it.
    const ordered = [...routes].sort((a, b) => {
      const ah = a.stops[0]?.name === hubName ? 0 : 1;
      const bh = b.stops[0]?.name === hubName ? 0 : 1;
      return ah - bh;
    });

    let buggyIndex = 0;
    const built: Lane[] = ordered.map((route, i) => {
      const isBullock = route.kind === 'BULLOCK';
      const fromHub = hubName !== null && route.stops[0]?.name === hubName;
      const y = TOP + i * LINE_GAP;
      const startX = HUB_X + (fromHub ? BRANCH_LEAD : 0);

      return {
        route,
        color: isBullock ? BULLOCK_COLOR : LINE_COLORS[buggyIndex++ % LINE_COLORS.length],
        index: i,
        y,
        startX,
        fromHub,
        points: (fromHub ? route.stops.slice(1) : route.stops).map((s, n) => ({
          name: s.name,
          x: startX + n * STOP_GAP,
          y,
        })),
      };
    });

    const hubLanes = built.filter((l) => l.fromHub);
    const hubY = hubLanes.length
      ? hubLanes.reduce((a, l) => a + l.y, 0) / hubLanes.length
      : TOP;

    const rightmost = Math.max(...built.map((l) => l.points[l.points.length - 1]?.x ?? 0), 0);

    return {
      lanes: built,
      hub: hubName ? { name: hubName, x: HUB_X, y: hubY } : null,
      width: rightmost + 190,
      height: TOP + built.length * LINE_GAP + 20,
    };
  }, [routes]);

  if (lanes.length === 0) return null;

  /** Hub, rounded elbow, then a straight run — the reference's geometry. */
  const pathFor = (l: Lane) => {
    const end = l.points[l.points.length - 1];
    if (!end) return '';
    if (!l.fromHub || !hub) return `M ${l.startX} ${l.y} L ${end.x} ${l.y}`;

    const dy = l.y - hub.y;
    if (Math.abs(dy) < 1) return `M ${hub.x} ${hub.y} L ${end.x} ${l.y}`;

    const dir = dy > 0 ? 1 : -1;
    const cx = hub.x + ELBOW;
    return [
      `M ${hub.x} ${hub.y}`,
      `L ${cx - ELBOW} ${hub.y}`,
      `Q ${cx} ${hub.y} ${cx} ${hub.y + dir * ELBOW}`,
      `L ${cx} ${l.y - dir * ELBOW}`,
      `Q ${cx} ${l.y} ${cx + ELBOW} ${l.y}`,
      `L ${end.x} ${l.y}`,
    ].join(' ');
  };

  /**
   * Out to the terminus and back again, because a shuttle returns — drawing
   * only the outward leg would imply a one-way service.
   *
   * The cycle is: run out, hold briefly at the far end, run back, hold at the
   * start. The holds are what make it read as a shuttle turning around rather
   * than a dot sliding back and forth. Each lane is offset in the cycle so the
   * seven vehicles are not in lockstep, which would look mechanical.
   *
   * None of this encodes a real frequency. No route in this database has its
   * hours or interval recorded — every one is NEVER CHECKED — so any apparent
   * timing here is an artefact of the animation, not a timetable. Do not tune
   * these numbers to suggest "every ten minutes" or any other interval until
   * somebody has read the real one off the board at the stand.
   */
  const vehicleAt = (l: Lane, f: number) => {
    const end = l.points[l.points.length - 1];
    if (!end) return null;
    const from = l.fromHub && hub ? hub.x + ELBOW * 2 : l.startX;

    // Stagger each lane so they do not all depart together.
    const phase = (f + l.index * 0.13) % 1;

    const RUN = 0.4;   // outward
    const HOLD = 0.1;  // turnaround at the terminus
    let progress: number;
    let outbound = true;
    if (phase < RUN) {
      progress = phase / RUN;
    } else if (phase < RUN + HOLD) {
      progress = 1;
    } else if (phase < RUN * 2 + HOLD) {
      progress = 1 - (phase - RUN - HOLD) / RUN;
      outbound = false;
    } else {
      progress = 0;
      outbound = false;
    }

    // Ease in and out so it slows into each stop rather than snapping.
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    return { x: from + (end.x - from) * eased, y: l.y, outbound };
  };

  return (
    <div className="yc-metro">
      <p className="yc-metro-caption">
        <span className="yc-metro-flag">Illustration</span>
        <span>
          A route diagram, not a map. Stops are evenly spaced and the lines do
          not follow the roads, so{' '}
          <strong>distances here mean nothing</strong> — and the vehicles are
          drawn, not tracked.
        </span>
      </p>

      <div className="yc-metro-stage">
        <div className="yc-metro-zoom" role="group" aria-label="Zoom the route diagram">
          <button
            type="button"
            className="yc-metro-zoom-btn"
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
            disabled={zoom <= ZOOM_MIN}
            aria-label="Zoom out"
          >
            &minus;
          </button>
          <button
            type="button"
            className="yc-metro-zoom-btn"
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
            disabled={zoom >= ZOOM_MAX}
            aria-label="Zoom in"
          >
            +
          </button>
          {/* Only offered once zoomed, so it is not a control that does
              nothing most of the time. */}
          {zoom > ZOOM_MIN && (
            <button
              type="button"
              className="yc-metro-zoom-btn is-reset"
              onClick={() => setZoom(ZOOM_MIN)}
              aria-label="Fit the whole diagram"
            >
              Fit
            </button>
          )}
        </div>

      <div className="yc-metro-scroll">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          // At rest the drawing scales to the panel so the whole network is
          // visible; zoomed in it takes a real pixel width and the container
          // scrolls to it.
          width={zoom === 1 ? '100%' : width * zoom}
          height={zoom === 1 ? undefined : height * zoom}
          preserveAspectRatio="xMidYMid meet"
          className="yc-metro-svg"
          role="img"
          aria-label={`Diagram of ${lanes.length} campus shuttle routes${
            hub ? `, four of them running from ${hub.name}` : ''
          }. Vehicle markers are illustrative and do not show real positions.`}
        >
          {lanes.map((l) => (
            <path
              key={l.route.id}
              d={pathFor(l)}
              fill="none"
              stroke={l.color}
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={l.route.kind === 'BULLOCK' ? '1 14' : undefined}
              opacity={l.route.kind === 'BULLOCK' ? 0.85 : 1}
            />
          ))}

          {!reduced &&
            lanes.map((l) => {
              const at = vehicleAt(l, t);
              if (!at) return null;
              return (
                <g
                  key={`v-${l.route.id}`}
                  transform={`translate(${at.x} ${at.y}) scale(${at.outbound ? 1 : -1} 1)`}
                  aria-hidden="true"
                >
                  <rect x={-10} y={-6.5} width={20} height={13} rx={3} fill={l.color} />
                  <rect x={-6} y={-3.5} width={12} height={4} rx={1} fill="var(--paper, #fff)" opacity={0.85} />
                  {/* A nose, so which way it is heading is visible. */}
                  <path d="M 10 -3 L 13.5 0 L 10 3 Z" fill={l.color} />
                </g>
              );
            })}

          {lanes.map((l) =>
            l.points.map((pt, n) => {
              const isSelected =
                selectedStop != null && selectedStop.toLowerCase() === pt.name.toLowerCase();
              const isLast = n === l.points.length - 1;
              return (
                <g
                  key={`${l.route.id}-${pt.name}`}
                  className="yc-metro-stop"
                  onClick={() => onSelectStop?.(pt.name)}
                  role={onSelectStop ? 'button' : undefined}
                  tabIndex={onSelectStop ? 0 : undefined}
                  aria-label={onSelectStop ? `Routes calling at ${pt.name}` : undefined}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectStop?.(pt.name);
                    }
                  }}
                >
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={7}
                    fill="var(--paper, #fff)"
                    stroke={isSelected ? 'var(--ink, #1c1917)' : l.color}
                    strokeWidth={isSelected ? 4.5 : 3.5}
                  />
                  <text x={pt.x} y={pt.y - 16} textAnchor="middle" className="yc-metro-stop-halo" aria-hidden="true">
                    {pt.name}
                  </text>
                  <text
                    x={pt.x}
                    y={pt.y - 16}
                    textAnchor="middle"
                    className={`yc-metro-stop-label${isSelected ? ' is-selected' : ''}`}
                  >
                    {pt.name}
                  </text>

                  {/* The terminus carries the line's number, as the reference
                      does: it identifies the route, not the stop. */}
                  {isLast && <circle cx={pt.x + 30} cy={pt.y} r={9.5} fill={l.color} />}
                  {isLast && (
                    <text x={pt.x + 30} y={pt.y + 4} textAnchor="middle" className="yc-metro-index">
                      {l.index + 1}
                    </text>
                  )}
                </g>
              );
            })
          )}

          {hub && (
            <g
              className="yc-metro-stop"
              onClick={() => onSelectStop?.(hub.name)}
              role={onSelectStop ? 'button' : undefined}
              tabIndex={onSelectStop ? 0 : undefined}
              aria-label={onSelectStop ? `Routes calling at ${hub.name}` : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectStop?.(hub.name);
                }
              }}
            >
              <circle cx={hub.x} cy={hub.y} r={15} fill="none" stroke="var(--ink-2, #3f3a34)" strokeWidth={1.4} opacity={0.4} />
              <circle cx={hub.x} cy={hub.y} r={10} fill="var(--paper, #fff)" stroke="var(--ink, #1c1917)" strokeWidth={4} />
              <text x={hub.x - 22} y={hub.y + 4} textAnchor="end" className="yc-metro-stop-halo" aria-hidden="true">
                {hub.name}
              </text>
              <text x={hub.x - 22} y={hub.y + 4} textAnchor="end" className="yc-metro-stop-label is-hub">
                {hub.name}
              </text>
            </g>
          )}
        </svg>
      </div>
      </div>

      <ol className="yc-metro-legend">
        {lanes.map((l) => (
          <li key={l.route.id} className="yc-metro-legend-item">
            <span className="yc-metro-legend-num" style={{ background: l.color }}>
              {l.index + 1}
            </span>
            <span className="yc-metro-legend-text">
              <span className="yc-metro-legend-name">{l.route.name}</span>
              <span className="yc-metro-legend-kind">
                {l.route.kind === 'BULLOCK' ? 'Bullock cart' : 'E-buggy'} ·{' '}
                {l.route.stops.length} stops
              </span>
            </span>
          </li>
        ))}
      </ol>

      <p className="yc-metro-foot">
        Vehicles are illustrative: they run out and back because a shuttle
        returns, but nothing on this campus is tracked and{' '}
        <strong>no running times have been confirmed</strong>. Ask at the stand
        or the Main Gate desk for today&rsquo;s frequency.
      </p>
    </div>
  );
}
