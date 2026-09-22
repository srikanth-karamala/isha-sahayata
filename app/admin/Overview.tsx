import { Sparkles } from 'lucide-react';
import type { FleetSummary } from '@/lib/analytics';
import type { Briefing } from '@/lib/briefing';
import RepairQueue, { type RepairRow } from './RepairQueue';

/**
 * The staff Overview: what the fleet is doing, and what has just broken.
 *
 * This replaced a demand chart and a row of hub capacity bars. Both were
 * honest and neither was useful: on a campus with few rides the chart was a
 * flat line along zero, and the hub bars read "Healthy" six times. A staff
 * member opening the console needs to know how many cycles are running, how
 * many are out, and which ones came in most recently — so that is what the
 * page is now, in that order.
 *
 * Laid out like the Lost & Found board rather than a dashboard, because the
 * two pages answer the same shape of question: here is a queue of things,
 * newest first, each one actionable.
 *
 * The morning briefing stays. It is a model reading the day's aggregates and
 * naming two or three things to do, which is advice rather than decoration,
 * and it is one of the three places this app uses AI.
 */
export default function Overview({
  summary,
  briefing,
  repairs,
}: {
  summary: FleetSummary;
  briefing: Briefing;
  repairs: RepairRow[];
}) {
  const inRepair = summary.maintenance;
  // Anything not in the workshop is on the campus and rideable, whether it is
  // sitting at a stand or currently under someone.
  const running = summary.totalCycles - inRepair;

  // No heading is rendered here: StaffConsole's own header already names the
  // tab, and a second "Overview" directly beneath the first read as a fault.
  return (
    <div className="space-y-4">
      <section className="s-card p-4">
        <h3 className="s-h3 mb-1.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" aria-hidden />
          Morning briefing
          <span className="s-chip s-chip-neutral">
            {briefing.source === 'anthropic'
              ? 'Claude'
              : briefing.source === 'groq'
                ? 'Groq'
                : 'Offline rules'}
          </span>
        </h3>
        <p className="s-body font-medium">{briefing.headline}</p>
        {briefing.actions.length > 0 && (
          <ol className="s-feed mt-2">
            {briefing.actions.map((action, i) => (
              <li key={i} className="s-feed-row s-body-sm">
                {i + 1}. {action}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Three across on any screen with the room: these are read together —
          how many are out there, how many are out, how many are dangerous —
          and s-split is a two-column grid that would orphan the third. */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Count label="Running" value={running} hint={`of ${summary.totalCycles} cycles`} />
        <Count label="In repair" value={inRepair} hint="out of service" />
        <Count
          label="Unsafe to ride"
          value={summary.unsafeCycles}
          hint="pull from service"
          alert={summary.unsafeCycles > 0}
        />
      </div>

      <RepairQueue rows={repairs} />
    </div>
  );
}

function Count({
  label,
  value,
  hint,
  alert = false,
}: {
  label: string;
  value: number;
  hint: string;
  alert?: boolean;
}) {
  return (
    <section className="s-card p-4">
      <p className="s-meta">{label}</p>
      {/* An alerting number is named by its label and its hint as well as
          coloured — the count must not rely on colour on its own. */}
      <p
        className="s-num mt-1"
        style={alert ? { color: 'var(--s-crit)' } : undefined}
      >
        {value}
      </p>
      <p className="s-meta mt-1">{hint}</p>
    </section>
  );
}
