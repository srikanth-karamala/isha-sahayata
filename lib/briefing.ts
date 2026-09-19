import type { FleetSummary, HubBalance, HourlyDemand } from '@/lib/analytics';
import { askForJson, activeProvider } from '@/lib/ai';

/**
 * The morning briefing: the day's fleet numbers rewritten as the three or four
 * things a coordinator should actually do about them.
 *
 * Charts show what happened; this says what to do. Claude receives only the
 * aggregates computed in lib/analytics.ts — never rider identities or raw logs.
 * As with triage, a deterministic fallback keeps the panel populated when no
 * API key is configured.
 */

export interface Briefing {
  headline: string;
  actions: string[];
  source: 'anthropic' | 'groq' | 'fallback';
}

const SYSTEM_PROMPT = `You write the morning operations briefing for the shared-cycle fleet at the Isha Yoga Center campus. Your reader is the coordinator who decides where staff go this morning.

Write for someone who has thirty seconds. Be concrete and specific: name hubs, use the numbers you are given, and say what to do rather than describing the situation. Never invent a number that is not in the data.

The headline is one sentence on the single most important thing about the fleet right now.

Each action is one short imperative sentence naming a hub or a cycle where relevant. Give between two and four actions, most urgent first. If the fleet is in good shape, say so plainly rather than manufacturing work.`;

const BRIEFING_SCHEMA = {
  type: 'object' as const,
  properties: {
    headline: { type: 'string' as const },
    actions: {
      type: 'array' as const,
      items: { type: 'string' as const },
      minItems: 2,
      maxItems: 4,
    },
  },
  required: ['headline', 'actions'],
  additionalProperties: false,
};

/** Rule-based briefing used when Claude is unavailable. */
export function fallbackBriefing(
  summary: FleetSummary,
  hubs: HubBalance[]
): Briefing {
  const actions: string[] = [];

  const empty = hubs.filter((h) => h.status === 'EMPTY');
  const low = hubs.filter((h) => h.status === 'LOW');
  const full = hubs.filter((h) => h.status === 'FULL');
  const surplus = [...hubs].sort((a, b) => b.available - a.available)[0];

  for (const hub of empty) {
    actions.push(
      `${hub.name} has no cycles available — move some from ${surplus?.name ?? 'the nearest hub'}.`
    );
  }
  for (const hub of low.slice(0, 2)) {
    actions.push(
      `${hub.name} is down to ${hub.available} of ${hub.capacity} — top it up this morning.`
    );
  }
  for (const hub of full.slice(0, 1)) {
    actions.push(
      `${hub.name} is near capacity at ${hub.available}/${hub.capacity} — redistribute before the midday peak.`
    );
  }
  if (summary.unsafeCycles > 0) {
    actions.push(
      `${summary.unsafeCycles} cycle(s) are flagged unsafe to ride — service these before anything else.`
    );
  }
  if (actions.length === 0) {
    actions.push('All hubs are within healthy range — no redistribution needed.');
    actions.push(
      `${summary.maintenance} cycle(s) in maintenance; clear the queue when convenient.`
    );
  }

  const headline =
    summary.unsafeCycles > 0
      ? `${summary.unsafeCycles} unsafe cycle(s) need immediate attention; ${summary.available} of ${summary.totalCycles} cycles are available.`
      : empty.length + low.length > 0
        ? `${empty.length + low.length} hub(s) need restocking; ${summary.available} of ${summary.totalCycles} cycles are available.`
        : `Fleet is healthy: ${summary.available} of ${summary.totalCycles} cycles available across ${hubs.length} hubs.`;

  return { headline, actions: actions.slice(0, 4), source: 'fallback' };
}

export async function generateBriefing(
  summary: FleetSummary,
  hubs: HubBalance[],
  demand: HourlyDemand[]
): Promise<Briefing> {
  if (activeProvider() === 'none') {
    return fallbackBriefing(summary, hubs);
  }

  // Only the aggregates go to the model — no rider ids, no raw ride logs.
  const peak = [...demand].sort((a, b) => b.rides - a.rides).slice(0, 3);
  const payload = {
    fleet: summary, // includes kmThisWeek, measured from real GPS ride paths
    hubs: hubs.map((h) => ({
      name: h.name,
      available: h.available,
      capacity: h.capacity,
      status: h.status,
      netOutflowLast24h: h.netOutflow,
    })),
    busiestHours: peak.map((p) => ({ hour: p.hour, avgRides: p.rides })),
    now: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
  };

  const { data, provider } = await askForJson<Omit<Briefing, 'source'>>({
    system: SYSTEM_PROMPT,
    schemaName: 'morning_briefing',
    schema: BRIEFING_SCHEMA,
    maxTokens: 2000,
    user: `Current fleet state:\n\n${JSON.stringify(payload, null, 2)}`,
  });

  if (
    !data ||
    typeof data.headline !== 'string' ||
    !Array.isArray(data.actions) ||
    data.actions.length === 0
  ) {
    return fallbackBriefing(summary, hubs);
  }

  return { ...data, source: provider === 'none' ? 'fallback' : provider };
}
