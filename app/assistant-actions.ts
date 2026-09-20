'use server';

import { prisma } from '@/lib/prisma';
import { haversineMeters, compassDirection, formatDistance, walkingMinutes } from '@/lib/geo';
import { askForText, providerLabel, type ChatTurn } from '@/lib/ai';
import {
  CAMPUS_LANDMARKS,
  knowledgeIsEmpty,
  publicFacts,
} from '@/lib/ashram-knowledge';

/**
 * Sahayata AI — the visitor assistant behind the floating button.
 *
 * The design constraint that shapes everything here: a visitor asking "when
 * does the temple open" will act on the answer. So the assistant is allowed to
 * state only two kinds of thing — live data read from this database, and facts
 * a human has confirmed in lib/ashram-knowledge.ts — and is instructed to say
 * it does not know about anything else rather than fill the gap from training
 * data. A model's recollection of a timing is not a source.
 */

/** Cap on turns kept, so a long session cannot grow the prompt without bound. */
const MAX_HISTORY = 8;

/**
 * Live campus state, so "where can I get a cycle" has a real answer.
 *
 * When the rider has shared their location, each stand is given with its
 * distance and compass direction from them. Without it the assistant could
 * only ever answer "which stand has cycles", never "which one should I walk
 * to" — and the coordinates to answer that were already in the database,
 * surveyed, just never passed to the model.
 */
async function liveContext(at: [number, number] | null): Promise<string> {
  const hubs = await prisma.hub.findMany({
    include: { cycles: { select: { status: true } } },
    orderBy: { name: 'asc' },
  });

  const withDistance = hubs.map((hub) => {
    const available = hub.cycles.filter((c) => c.status === 'AVAILABLE').length;
    const pos: [number, number] | null =
      hub.latitude != null && hub.longitude != null
        ? [hub.latitude, hub.longitude]
        : null;
    const metres = at && pos ? haversineMeters(at, pos) : null;
    return { hub, available, pos, metres };
  });

  // Nearest first when we know where they are: the order itself is information
  // the model can lean on, and it keeps the closest option in the first line.
  if (at) withDistance.sort((a, b) => (a.metres ?? 1e9) - (b.metres ?? 1e9));

  const lines = withDistance.map(({ hub, available, pos, metres }) => {
    const base = `- ${hub.name}: ${available} cycle(s) ready now, ${hub.capacity} docks total`;
    if (metres == null || !pos) return base;
    return `${base}, ${formatDistance(metres)} ${compassDirection(at!, pos)} of the visitor (about ${walkingMinutes(metres)} min walk)`;
  });

  const waiting = await prisma.lostFoundItem.count({
    where: { kind: 'FOUND', status: 'OPEN' },
  });

  return [
    at
      ? 'LIVE CYCLE AVAILABILITY (read just now, nearest to the visitor first):'
      : 'LIVE CYCLE AVAILABILITY (read from the database just now):',
    ...lines,
    '',
    `LOST & FOUND: ${waiting} item(s) handed in and waiting to be claimed.`,
    '',
    at
      ? "The visitor's location is known, so distances above are from where they are standing. Quote them."
      : 'The visitor has not shared their location, so no distances are available. Do not guess how far anything is; name the stand and let them find it on the map.',
  ].join('\n');
}

function buildSystemPrompt(live: string): string {
  const facts = publicFacts();

  const factBlock = facts.length
    ? facts.map((f) => `- ${f.topic}: ${f.detail}`).join('\n')
    : '(No ashram timings or services have been confirmed yet. You do not know any of them.)';

  return `You are Sahayata AI, the assistant inside the Isha Sahayata app, which serves the campus cycle-share and lost & found.

You help visitors with getting around the campus.

WHAT YOU KNOW
${factBlock}

CAMPUS LANDMARKS (these are the cycle stands, and double as directions):
${CAMPUS_LANDMARKS.map((l) => `- ${l}`).join('\n')}

${live}

HOW TO ANSWER
- Answer only from the information above. It is the whole of what you know.
- If you are asked about a timing, a ritual, a cart route, a pick-up point or
  any service that does not appear above, say plainly that you do not have that
  information and suggest asking at the Main Gate desk. Do NOT guess, and do
  NOT answer from general knowledge about Isha or the Isha Yoga Center — an
  outdated timing sends someone across the campus for nothing.
- Never invent a time, a phone number, a route or a place name.
- Be brief: two or three sentences is usually right. This is read on a phone.
- Be warm and plain-spoken. No flowery language.
- For cycle availability, quote the live numbers above; they are current.
- When a distance is given, use it: "Spanda Hall, about 250 m north-east, 3 minutes" is
  the useful answer. Weigh it against availability — a stand two minutes further with
  fifteen cycles beats the nearest one with a single cycle.
- Do NOT give turn-by-turn walking directions. You know where things are, not which
  paths connect them; name the landmark and the direction and let the map do the rest.`;
}

export interface AssistantReply {
  reply: string;
  provider: string;
  /** True when no facts are confirmed yet — the UI warns staff, not visitors. */
  unconfigured: boolean;
}

/**
 * Whether any ashram fact has been confirmed, asked before the first question.
 *
 * askAssistant already returns this, but only once an answer comes back. The
 * warning needs to be up before that: the visitor most likely to be misled is
 * the one still deciding what to ask, looking at an opener like "How do I get
 * to Biksha Hall?" with no sign that timings are unavailable.
 */
export async function assistantNeedsSetup(): Promise<boolean> {
  return knowledgeIsEmpty();
}

export async function askAssistant(
  history: ChatTurn[],
  /** The rider's position, when they have shared it. */
  at?: [number, number] | null
): Promise<AssistantReply> {
  const trimmed = history.slice(-MAX_HISTORY);
  if (trimmed.length === 0 || trimmed[trimmed.length - 1].role !== 'user') {
    throw new Error('Ask a question to begin.');
  }

  const live = await liveContext(at ?? null);
  const { data, provider } = await askForText(buildSystemPrompt(live), trimmed);

  if (!data) {
    return {
      reply:
        'I cannot reach the assistant just now. For anything urgent, the desk at Main Gate can help.',
      provider: providerLabel('none'),
      unconfigured: knowledgeIsEmpty(),
    };
  }

  return {
    reply: data.trim(),
    provider: providerLabel(provider),
    unconfigured: knowledgeIsEmpty(),
  };
}
