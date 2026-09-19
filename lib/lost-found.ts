import Anthropic from '@anthropic-ai/sdk';
import { ItemCategory, LostFoundKind } from '@prisma/client';

/**
 * AI matching for lost and found reports.
 *
 * Two people describe the same object completely differently. Someone loses "my
 * black steel water bottle, the one with a dent"; someone else hands in "dark
 * flask, scratched, left near Biksha". Keyword search finds neither from the
 * other — the words barely overlap — but they are plainly the same bottle.
 *
 * Claude reads both descriptions and scores the pairing, which is the whole
 * reason this feature is worth building rather than a search box.
 *
 * As everywhere else in this app, a deterministic fallback runs when no API key
 * is configured, so the feature degrades rather than disappearing.
 */

export interface ScoredMatch {
  /** Id of the candidate item being scored against the subject. */
  candidateId: string;
  /** 0-100 confidence that these two reports describe the same object. */
  score: number;
  reasoning: string;
}

export interface MatchOutcome {
  matches: ScoredMatch[];
  source: 'ai' | 'fallback';
}

export interface ClassifiedItem {
  category: ItemCategory;
  title: string;
  source: 'ai' | 'fallback';
}

/**
 * Suggestions at or above this score are shown to the person who reported.
 *
 * Set at 35 rather than 60 because the offline fallback cannot tell that
 * "flask" and "bottle" are the same object and scores real matches in the
 * thirties. Claude scores those same pairs in the eighties, so the threshold
 * mainly matters when the API is unavailable; the UI shows the score beside
 * every suggestion so a weak one reads as weak.
 */
export const MATCH_THRESHOLD = 35;

export interface CandidateItem {
  id: string;
  description: string;
  placeNote: string | null;
  hubName: string | null;
  occurredAt: Date;
  category: ItemCategory | null;
}

const CLASSIFY_SYSTEM = `You label lost-and-found reports for the Isha Yoga Center campus. People describe things informally and briefly.

Give each report a category from the fixed list, and a short staff-facing title: the object itself plus its most identifying detail, at most six words, no pleasantries. "Black steel water bottle, dented" is a good title. "Lost item report" is not.

Judge only from what the person wrote. Do not invent details they did not give.`;

const MATCH_SYSTEM = `You match lost-and-found reports at the Isha Yoga Center campus.

You are given one report and several candidate reports from the opposite side (a lost item against found items, or a found item against lost ones). Score how likely each candidate describes the SAME physical object.

What matters, in order:
- The object itself. A bottle is never a bag, whatever else matches.
- Distinguishing details: colour, material, brand, damage, contents, size.
- Timing. A thing cannot be found before it was lost; a found report days earlier than the loss is almost certainly a different object.
- Place. Nearby locations support a match, but campus items travel, so distance alone should not rule a pairing out.

Scoring:
- 85-100: distinctive details align and nothing contradicts. Confident.
- 60-84: same kind of object and compatible details, but generic or partly unverified.
- 30-59: same category, nothing else to go on.
- 0-29: different objects, or the timing makes it impossible.

Most pairs are NOT matches. Do not inflate scores to be helpful — a wrong confident match sends someone to collect a stranger's belongings. Score generously only when the details genuinely line up.

The reasoning is one sentence a person reads to decide whether to go and look.`;

const CLASSIFY_SCHEMA = {
  type: 'object' as const,
  properties: {
    category: { type: 'string' as const, enum: Object.values(ItemCategory) },
    title: { type: 'string' as const },
  },
  required: ['category', 'title'],
  additionalProperties: false,
};

const MATCH_SCHEMA = {
  type: 'object' as const,
  properties: {
    matches: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          candidateId: { type: 'string' as const },
          score: { type: 'integer' as const, minimum: 0, maximum: 100 },
          reasoning: { type: 'string' as const },
        },
        required: ['candidateId', 'score', 'reasoning'],
        additionalProperties: false,
      },
    },
  },
  required: ['matches'],
  additionalProperties: false,
};

const CATEGORY_KEYWORDS: [ItemCategory, string[]][] = [
  [ItemCategory.BOTTLE, ['bottle', 'flask', 'tumbler', 'thermos', 'sipper']],
  [ItemCategory.CLOTHING, ['shawl', 'jacket', 'scarf', 'kurta', 'dhoti', 'sweater', 'towel', 'cloth', 'angavastram']],
  [ItemCategory.BAG, ['bag', 'backpack', 'pouch', 'rucksack', 'sack', 'purse']],
  [ItemCategory.ELECTRONICS, ['phone', 'charger', 'earphone', 'headphone', 'laptop', 'cable', 'watch', 'camera', 'power bank']],
  [ItemCategory.DOCUMENTS, ['id card', 'passport', 'wallet', 'card', 'ticket', 'licence', 'license', 'document']],
  [ItemCategory.EYEWEAR, ['spectacle', 'glasses', 'sunglass', 'goggle']],
  [ItemCategory.JEWELLERY, ['ring', 'chain', 'bracelet', 'rudraksha', 'mala', 'earring', 'bangle', 'pendant']],
  [ItemCategory.KEYS, ['key', 'keychain', 'keys']],
  [ItemCategory.BOOK, ['book', 'diary', 'notebook', 'journal']],
];

/** Keyword categoriser used when Claude is unavailable. */
export function fallbackClassify(description: string): ClassifiedItem {
  const text = description.toLowerCase();
  let category: ItemCategory = ItemCategory.OTHER;

  for (const [cat, words] of CATEGORY_KEYWORDS) {
    if (words.some((w) => text.includes(w))) {
      category = cat;
      break;
    }
  }

  const trimmed = description.trim();
  const title = trimmed.length > 42 ? `${trimmed.slice(0, 39)}...` : trimmed;

  return { category, title, source: 'fallback' };
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'my', 'i', 'it', 'is', 'was', 'near', 'at', 'in', 'on',
  'with', 'and', 'of', 'to', 'lost', 'found', 'have', 'has', 'left', 'one',
  'that', 'this', 'there', 'some', 'somewhere', 'think', 'maybe',
]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

/**
 * Word-overlap matcher used when Claude is unavailable. Much weaker than the
 * AI path — it cannot tell that "flask" and "bottle" are the same thing — so it
 * scores conservatively and leans on the shared category.
 */
export function fallbackMatch(
  subject: { description: string; category: ItemCategory | null; occurredAt: Date },
  candidates: CandidateItem[]
): MatchOutcome {
  const subjectWords = tokens(subject.description);

  const matches = candidates
    .map((candidate) => {
      const candidateWords = tokens(candidate.description);
      let shared = 0;
      for (const w of subjectWords) if (candidateWords.has(w)) shared++;

      const union = subjectWords.size + candidateWords.size - shared;
      const overlap = union > 0 ? shared / union : 0;

      const sameCategory =
        subject.category != null && subject.category === candidate.category;

      // Weight the shared category heavily — with no semantic understanding it
      // is the most reliable signal available.
      let score = Math.round(overlap * 55 + (sameCategory ? 35 : 0));

      // An item found before it was lost is very unlikely to be the same one.
      const daysApart =
        Math.abs(candidate.occurredAt.getTime() - subject.occurredAt.getTime()) /
        86_400_000;
      if (daysApart > 14) score = Math.round(score * 0.6);

      return {
        candidateId: candidate.id,
        score: Math.min(score, 90),
        reasoning: sameCategory
          ? `Same category, ${shared} matching word${shared === 1 ? '' : 's'} in the descriptions.`
          : `${shared} matching word${shared === 1 ? '' : 's'} in the descriptions.`,
      };
    })
    .filter((m) => m.score > 25)
    .sort((a, b) => b.score - a.score);

  return { matches, source: 'fallback' };
}

/** Classify a report into a category and a short title. Never throws. */
export async function classifyItem(
  description: string,
  kind: LostFoundKind
): Promise<ClassifiedItem> {
  const text = description?.trim();
  if (!text) {
    return { category: ItemCategory.OTHER, title: 'Unspecified item', source: 'fallback' };
  }
  if (!process.env.ANTHROPIC_API_KEY) return fallbackClassify(text);

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 800,
      system: CLASSIFY_SYSTEM,
      output_config: {
        format: { type: 'json_schema', schema: CLASSIFY_SCHEMA },
        effort: 'low',
      },
      messages: [
        {
          role: 'user',
          content: `${kind === 'LOST' ? 'Lost' : 'Found'} item report:\n\n"${text}"`,
        },
      ],
    });

    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') return fallbackClassify(text);

    const parsed = JSON.parse(block.text) as { category: ItemCategory; title: string };
    if (
      !Object.values(ItemCategory).includes(parsed.category) ||
      typeof parsed.title !== 'string' ||
      !parsed.title.trim()
    ) {
      return fallbackClassify(text);
    }

    return { category: parsed.category, title: parsed.title.trim(), source: 'ai' };
  } catch (error) {
    console.error('[lost-found] classify failed, using fallback:', error);
    return fallbackClassify(text);
  }
}

function describeCandidate(c: CandidateItem): string {
  const place = c.hubName ?? c.placeNote ?? 'location not given';
  return `- id: ${c.id}
  description: "${c.description}"
  where: ${place}
  when: ${c.occurredAt.toISOString().slice(0, 16).replace('T', ' ')}`;
}

/**
 * Score a report against candidates from the opposite side. Never throws —
 * falls back to word overlap so the feature still returns something useful.
 */
export async function findMatches(
  subject: {
    description: string;
    category: ItemCategory | null;
    kind: LostFoundKind;
    occurredAt: Date;
    placeNote: string | null;
    hubName: string | null;
  },
  candidates: CandidateItem[]
): Promise<MatchOutcome> {
  if (candidates.length === 0) return { matches: [], source: 'fallback' };
  if (!process.env.ANTHROPIC_API_KEY) return fallbackMatch(subject, candidates);

  try {
    const client = new Anthropic();
    const subjectPlace = subject.hubName ?? subject.placeNote ?? 'location not given';
    const opposite = subject.kind === 'LOST' ? 'found' : 'lost';

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4000,
      system: MATCH_SYSTEM,
      output_config: {
        format: { type: 'json_schema', schema: MATCH_SCHEMA },
        effort: 'low',
      },
      messages: [
        {
          role: 'user',
          content: `The report to match (${subject.kind.toLowerCase()}):
  description: "${subject.description}"
  where: ${subjectPlace}
  when: ${subject.occurredAt.toISOString().slice(0, 16).replace('T', ' ')}

Candidate ${opposite} reports:
${candidates.map(describeCandidate).join('\n')}

Score every candidate. Return the candidateId exactly as given.`,
        },
      ],
    });

    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') return fallbackMatch(subject, candidates);

    const parsed = JSON.parse(block.text) as { matches: ScoredMatch[] };
    if (!Array.isArray(parsed.matches)) return fallbackMatch(subject, candidates);

    // Drop anything referencing an id we did not send — a hallucinated id would
    // otherwise become a dangling suggestion row.
    const validIds = new Set(candidates.map((c) => c.id));
    const matches = parsed.matches
      .filter(
        (m) =>
          validIds.has(m.candidateId) &&
          typeof m.score === 'number' &&
          m.score >= 0 &&
          m.score <= 100
      )
      .sort((a, b) => b.score - a.score);

    return { matches, source: 'ai' };
  } catch (error) {
    console.error('[lost-found] matching failed, using fallback:', error);
    return fallbackMatch(subject, candidates);
  }
}
