'use server';

import { prisma } from '@/lib/prisma';
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

/** Live campus state, so "where can I get a cycle" has a real answer. */
async function liveContext(): Promise<string> {
  const hubs = await prisma.hub.findMany({
    include: { cycles: { select: { status: true } } },
    orderBy: { name: 'asc' },
  });

  const lines = hubs.map((hub) => {
    const available = hub.cycles.filter((c) => c.status === 'AVAILABLE').length;
    return `- ${hub.name}: ${available} cycle(s) ready now, ${hub.capacity} docks total`;
  });

  const waiting = await prisma.lostFoundItem.count({
    where: { kind: 'FOUND', status: 'OPEN' },
  });

  return [
    'LIVE CYCLE AVAILABILITY (read from the database just now):',
    ...lines,
    '',
    `LOST & FOUND: ${waiting} item(s) handed in and waiting to be claimed.`,
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
- For cycle availability, quote the live numbers above; they are current.`;
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

export async function askAssistant(history: ChatTurn[]): Promise<AssistantReply> {
  const trimmed = history.slice(-MAX_HISTORY);
  if (trimmed.length === 0 || trimmed[trimmed.length - 1].role !== 'user') {
    throw new Error('Ask a question to begin.');
  }

  const live = await liveContext();
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
