import { ItemCategory, LostFoundKind } from '@prisma/client';
import { askForJson, activeProvider } from './ai';

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
  source: 'anthropic' | 'groq' | 'fallback' | 'unavailable';
}

export interface ClassifiedItem {
  /** Null when no model was available to read the report. */
  category: ItemCategory | null;
  /** Null when no model was available; the UI falls back to the description. */
  title: string | null;
  source: 'anthropic' | 'groq' | 'fallback' | 'unavailable';
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

When a photo is attached, read it as well as the words, and put what it shows into the title: a number, a brand, a colour or a shape written on the object identifies it far better than the description usually does. A red plastic token photographed with "378" on it is "Red deposit token, no. 378", not "Deposit token".

Judge only from the words and the photo. Do not invent details that are in neither.`;

const MATCH_SYSTEM = `You match lost-and-found reports at the Isha Yoga Center campus.

You are given one report and several candidate reports from the opposite side (a lost item against found items, or a found item against lost ones). Score how likely each candidate describes the SAME physical object.

What matters, in order:
- The object itself. A bottle is never a bag, whatever else matches.
- Distinguishing details: colour, material, brand, damage, contents, size.
- Timing. A thing cannot be found before it was lost; a found report days earlier than the loss is almost certainly a different object.
- Place. Nearby locations support a match, but campus items travel, so distance alone should not rule a pairing out.

Two people describing the same object rarely use the same words, and you must see past that. "Flask", "bottle", "tumbler" and "sipper" are the same kind of object. "Black", "dark" and "charcoal" are the same colour. "Dented", "scratched" and "banged up" are all a damaged surface, and one person will notice damage the other did not mention. Different wording for a compatible object is NOT evidence against a match — judge whether the two descriptions could be the same physical thing, not whether they read alike.

Treat a detail as contradicting only when both reports state something incompatible: red versus blue, leather versus steel, a child's size versus an adult's. Silence in one report is not a contradiction.

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



/** Classify a report into a category and a short title. Never throws. */
export async function classifyItem(
  description: string,
  kind: LostFoundKind,
  /** Base64 photo, when the reporter attached one. Read alongside the words. */
  image?: { mediaType: string; data: string } | null
): Promise<ClassifiedItem> {
  const text = description?.trim();
  if (!text) {
    return { category: ItemCategory.OTHER, title: 'Unspecified item', source: 'fallback' };
  }
  // No provider configured: say so rather than inventing a category. The
  // keyword classifier is kept for the seed, which runs without a key.
  if (activeProvider() === 'none') {
    return { category: null, title: null, source: 'unavailable' };
  }

  const { data, provider } = await askForJson<{ category: ItemCategory; title: string }>({
    system: CLASSIFY_SYSTEM,
    schemaName: 'lost_found_item',
    schema: CLASSIFY_SCHEMA,
    maxTokens: 800,
    image,
    user: `${kind === 'LOST' ? 'Lost' : 'Found'} item report:\n\n"${text}"${
      image ? '\n\nA photo of the item is attached.' : ''
    }`,
  });

  if (
    !data ||
    !Object.values(ItemCategory).includes(data.category) ||
    typeof data.title !== 'string' ||
    !data.title.trim()
  ) {
    // The call failed or came back malformed. Report that plainly: a keyword
    // guess here produced titles like "Unspecified item" that staff then had
    // to re-read the description to understand anyway.
    return { category: null, title: null, source: 'unavailable' };
  }

  return {
    category: data.category,
    title: data.title.trim(),
    source: provider === 'none' ? 'fallback' : provider,
  };
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
  if (candidates.length === 0) return { matches: [], source: 'unavailable' };
  // AI-only by choice. Word-overlap scoring produced suggestions like "same
  // category, 1 matching word" at 43%, which look like findings but carry no
  // more information than the two descriptions sitting side by side. When the
  // model cannot be reached the page says so and a person looks manually.
  if (activeProvider() === 'none') return { matches: [], source: 'unavailable' };

  const subjectPlace = subject.hubName ?? subject.placeNote ?? 'location not given';
  const opposite = subject.kind === 'LOST' ? 'found' : 'lost';

  const { data, provider } = await askForJson<{ matches: ScoredMatch[] }>({
    system: MATCH_SYSTEM,
    schemaName: 'lost_found_matches',
    schema: MATCH_SCHEMA,
    maxTokens: 4000,
    user: `The report to match (${subject.kind.toLowerCase()}):
  description: "${subject.description}"
  where: ${subjectPlace}
  when: ${subject.occurredAt.toISOString().slice(0, 16).replace('T', ' ')}

Candidate ${opposite} reports:
${candidates.map(describeCandidate).join('\n')}

Score every candidate. Return the candidateId exactly as given.`,
  });

  if (!data || !Array.isArray(data.matches)) return { matches: [], source: 'unavailable' };

  // Drop anything referencing an id we did not send — a hallucinated id would
  // otherwise become a dangling suggestion row.
  const validIds = new Set(candidates.map((c) => c.id));
  const matches = data.matches
    .filter(
      (m) =>
        validIds.has(m.candidateId) &&
        typeof m.score === 'number' &&
        m.score >= 0 &&
        m.score <= 100
    )
    .sort((a, b) => b.score - a.score);

  return { matches, source: provider === 'none' ? 'unavailable' : provider };
}
