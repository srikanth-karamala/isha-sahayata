'use client';

import { useEffect, useState } from 'react';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Bike,
  Clock,
  Table2,
  BarChart3,
  Route,
} from 'lucide-react';
import { getLiveOverview } from '@/app/actions';
import type { FleetSummary, HubBalance, HourlyDemand } from '@/lib/analytics';
import type { Briefing } from '@/lib/briefing';

/** How often the overview re-reads the numbers that change during a shift. */
const REFRESH_MS = 10_000;

/**
 * Fleet insight panels for the admin dashboard.
 *
 * Built on the app's own tokens (--paper, --ink, --primary, yc-panel) so these
 * read as part of the existing surface rather than a bolted-on dashboard.
 *
 * Chart magnitude uses a single-hue amber ramp validated against the light
 * surface; hub state uses a reserved status palette. Status colour never
 * carries meaning alone — each state ships with an icon and a text label.
 */

const AMBER = {
  100: '#e0a021',
  200: '#ca8a04',
  300: '#a06f08',
};

const STATUS = {
  EMPTY: { color: '#d03b3b', label: 'Empty', Icon: CircleAlert },
  LOW: { color: '#fab219', label: 'Low', Icon: AlertTriangle },
  HEALTHY: { color: '#0ca30c', label: 'Healthy', Icon: CheckCircle2 },
  FULL: { color: '#256abf', label: 'At capacity', Icon: CircleAlert },
} as const;

const INK = {
  muted: 'rgba(28, 25, 23, 0.45)',
  grid: 'rgba(28, 25, 23, 0.10)',
  axis: 'rgba(28, 25, 23, 0.20)',
  secondary: 'rgba(28, 25, 23, 0.58)',
};

function StatTile({
  label,
  value,
  unit,
  Icon,
  alert = false,
  note,
}: {
  label: string;
  value: number | string;
  unit?: string;
  Icon: typeof Bike;
  alert?: boolean;
  /** One line of context under the number — what it is measured against. */
  note?: string;
}) {
  return (
    <div className="yc-panel p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <Icon
          className="w-4 h-4"
          style={{ color: alert ? STATUS.EMPTY.color : 'var(--primary-dark)' }}
        />
        <p className="yc-eyebrow">{label}</p>
      </div>
      <p
        className="text-3xl font-black leading-none"
        style={{ color: alert ? STATUS.EMPTY.color : 'var(--ink)' }}
      >
        {value}
        {unit && (
          <span className="text-sm font-bold ml-1" style={{ color: INK.muted }}>
            {unit}
          </span>
        )}
      </p>
      {note && (
        <p className="yc-meta mt-2 leading-snug">{note}</p>
      )}
    </div>
  );
}

/** Hourly demand: one series, so no legend — the title names it. */
function DemandChart({
  demand,
  updatedAt,
}: {
  demand: HourlyDemand[];
  updatedAt?: string | null;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 720;
  const H = 180;
  const PAD = { top: 24, right: 12, bottom: 26, left: 32 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const max = Math.max(...demand.map((d) => d.rides), 1);
  const x = (h: number) => PAD.left + (h / 23) * plotW;
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const linePath = demand
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(d.hour)} ${y(d.rides)}`)
    .join(' ');
  const areaPath = `${linePath} L ${x(23)} ${PAD.top + plotH} L ${x(0)} ${
    PAD.top + plotH
  } Z`;

  const peak = demand.reduce((a, b) => (b.rides > a.rides ? b : a), demand[0]);
  const active = hover !== null ? demand[hover] : null;

  return (
    <div className="yc-panel p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="yc-title yc-title-sm">Cycle demand by hour</h3>
          <p className="yc-meta">
            Rides started per hour today
            {updatedAt && ` · updated ${updatedAt}`}
          </p>
        </div>
        {active && (
          <div className="text-right">
            <p
              className="text-lg font-black leading-none"
              style={{ color: AMBER[300] }}
            >
              {active.rides}
            </p>
            <p className="yc-meta">
              at {String(active.hour).padStart(2, '0')}:00
            </p>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={
          peak.rides > 0
            ? `Rides started per hour today. Busiest hour so far is ${peak.hour}:00 with ${peak.rides} rides.`
            : 'Rides started per hour today. No rides recorded yet today.'
        }
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="ycDemandFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={AMBER[100]} stopOpacity="0.5" />
            <stop offset="100%" stopColor={AMBER[100]} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(max * t)}
              y2={y(max * t)}
              stroke={INK.grid}
              strokeWidth="1"
            />
            <text
              x={PAD.left - 6}
              y={y(max * t) + 3}
              textAnchor="end"
              fontSize="9"
              fill={INK.muted}
            >
              {Math.round(max * t)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="url(#ycDemandFill)" />
        <path
          d={linePath}
          fill="none"
          stroke={AMBER[200]}
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Before the first ride of the day the series is flat at zero, where a
            marker reading "peak 0" would label noise as a finding. */}
        {peak.rides > 0 && (
          <>
            <circle
              cx={x(peak.hour)}
              cy={y(peak.rides)}
              r="4.5"
              fill={AMBER[300]}
              stroke="#fffcf6"
              strokeWidth="2"
            />
            <text
              x={x(peak.hour)}
              y={Math.max(y(peak.rides) - 10, PAD.top - 4)}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill={INK.secondary}
            >
              peak {peak.rides}
            </text>
          </>
        )}

        {active && (
          <line
            x1={x(active.hour)}
            x2={x(active.hour)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            stroke={AMBER[300]}
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {demand
          .filter((d) => d.hour % 4 === 0)
          .map((d) => (
            <text
              key={d.hour}
              x={x(d.hour)}
              y={H - 8}
              textAnchor="middle"
              fontSize="9"
              fill={INK.muted}
            >
              {String(d.hour).padStart(2, '0')}:00
            </text>
          ))}

        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          stroke={INK.axis}
          strokeWidth="1"
        />

        {demand.map((d) => (
          <rect
            key={d.hour}
            x={x(d.hour) - plotW / 46}
            y={PAD.top}
            width={plotW / 23}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(d.hour)}
          />
        ))}
      </svg>
    </div>
  );
}

function HubBalanceChart({ hubs }: { hubs: HubBalance[] }) {
  const [showTable, setShowTable] = useState(false);
  const sorted = [...hubs].sort((a, b) => a.available - b.available);
  const maxCap = Math.max(...hubs.map((h) => h.capacity), 1);

  return (
    <div className="yc-panel p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="yc-title yc-title-sm">Cycles available by hub</h3>
          <p className="yc-meta">
            Against station capacity, with 24-hour flow direction
          </p>
        </div>
        <button
          onClick={() => setShowTable((s) => !s)}
          className="yc-btn-ghost flex items-center gap-1 text-[10px] px-2 py-1"
        >
          {showTable ? (
            <BarChart3 className="w-3 h-3" />
          ) : (
            <Table2 className="w-3 h-3" />
          )}
          {showTable ? 'Chart' : 'Table'}
        </button>
      </div>

      {showTable ? (
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: INK.muted }}>
              <th className="text-left font-semibold py-1.5">Station</th>
              <th className="text-right font-semibold">Available</th>
              <th className="text-right font-semibold">Capacity</th>
              <th className="text-right font-semibold">Net 24h</th>
              <th className="text-right font-semibold">State</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => (
              <tr key={h.id} style={{ borderTop: '1px solid var(--separator)' }}>
                <td className="py-1.5">{h.name}</td>
                <td className="text-right yc-mono">{h.available}</td>
                <td className="text-right yc-mono" style={{ color: INK.muted }}>
                  {h.capacity}
                </td>
                <td className="text-right yc-mono">
                  {h.netOutflow > 0
                    ? `-${h.netOutflow}`
                    : `+${Math.abs(h.netOutflow)}`}
                </td>
                <td className="text-right">{STATUS[h.status].label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="space-y-3">
          {sorted.map((hub) => {
            const s = STATUS[hub.status];
            const pct = (hub.available / maxCap) * 100;
            const capPct = (hub.capacity / maxCap) * 100;
            return (
              <div key={hub.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <s.Icon
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: s.color }}
                    />
                    <span className="text-xs font-semibold">{hub.name}</span>
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: s.color }}
                    >
                      {s.label}
                    </span>
                  </div>
                  <span className="yc-mono text-[11px]" style={{ color: INK.secondary }}>
                    {hub.available}/{hub.capacity}
                    {hub.netOutflow !== 0 && (
                      <span className="ml-2" style={{ color: INK.muted }}>
                        {hub.netOutflow > 0 ? '↓' : '↑'}
                        {Math.abs(hub.netOutflow)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="relative h-2.5">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${capPct}%`,
                      backgroundColor: 'var(--surface-2)',
                    }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${Math.max(pct, hub.available > 0 ? 4 : 0)}%`,
                      backgroundColor: s.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FleetInsights({
  summary: initialSummary,
  hubs: initialHubs,
  demand: initialDemand,
  briefing,
}: {
  summary: FleetSummary;
  hubs: HubBalance[];
  demand: HourlyDemand[];
  briefing: Briefing;
}) {
  // The page that renders this is a server component, so without polling these
  // three stay frozen at their render-time values for as long as the console is
  // left open — which is most of a shift. The briefing is deliberately not
  // refreshed: it is a model call, and its advice is written for the morning
  // rather than for the current minute.
  const [summary, setSummary] = useState(initialSummary);
  const [hubs, setHubs] = useState(initialHubs);
  const [demand, setDemand] = useState(initialDemand);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const pull = () => {
      void getLiveOverview().then((next) => {
        if (cancelled) return;
        setSummary(next.summary);
        setHubs(next.balances);
        setDemand(next.demand);
        setUpdatedAt(
          new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })
        );
      });
    };

    const id = window.setInterval(pull, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Row 1: briefing beside the KPI grid — the two things a coordinator
          reads first, without scrolling past one to reach the other. */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4 items-start">
        <div
          className="yc-panel p-5"
          style={{
            background:
              'linear-gradient(135deg, rgba(245,183,0,0.14) 0%, var(--surface) 60%)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4" style={{ color: 'var(--primary-dark)' }} />
            <h3 className="yc-title yc-title-sm">Morning briefing</h3>
            <span
              className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--surface-2)', color: INK.secondary }}
            >
              {briefing.source === 'anthropic'
                ? 'Claude'
                : briefing.source === 'groq'
                  ? 'Groq'
                  : 'Offline rules'}
            </span>
          </div>
          <p className="yc-body font-medium mb-3">{briefing.headline}</p>
          <ul className="space-y-1.5">
            {briefing.actions.map((action, i) => (
              <li key={i} className="flex gap-2 yc-body-sm">
                <span
                  className="font-bold shrink-0"
                  style={{ color: 'var(--primary-dark)' }}
                >
                  {i + 1}.
                </span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Rides today"
            value={summary.ridesToday}
            Icon={Bike}
            note={`${summary.ridesThisWeek} in the last 7 days`}
          />
          <StatTile
            label="Available now"
            value={`${summary.available}/${summary.totalCycles}`}
            Icon={CheckCircle2}
            note={`${summary.inUse} out on rides`}
          />
          <StatTile
            label="Avg ride"
            value={summary.avgRideMinutes}
            unit="min"
            Icon={Clock}
            note={`${summary.kmThisWeek} km this week`}
          />
          <StatTile
            label="Unsafe to ride"
            value={summary.unsafeCycles}
            Icon={AlertTriangle}
            alert={summary.unsafeCycles > 0}
            note={`${summary.maintenance} in maintenance`}
          />
        </div>
      </div>

      {/* Row 2: the demand curve needs width; hub availability is a short list
          and sits beside it rather than under it. Stretched rather than
          top-aligned so the two panels end level — the curve is a fixed-ratio
          SVG and would otherwise leave a shelf of empty card beside the list. */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-4 items-stretch">
        <DemandChart demand={demand} updatedAt={updatedAt} />
        <HubBalanceChart hubs={hubs} />
      </div>

      <p className="yc-meta flex items-center gap-1">
        <Route className="w-3 h-3" />
        {summary.kmThisWeek} km ridden this week, measured from GPS ride paths.
        Hub flow compares the last 24 hours of departures against arrivals.
      </p>
    </div>
  );
}
