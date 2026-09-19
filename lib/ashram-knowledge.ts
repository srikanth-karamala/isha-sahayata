/**
 * What Sahayata AI is allowed to say about the ashram.
 *
 * This file is the assistant's ENTIRE source of truth for anything that is not
 * live app data. It is deliberately a hand-maintained file rather than a
 * scrape of the public site, for two reasons:
 *
 *  1. A scraper that silently goes stale is worse than no scraper at all here.
 *     The questions this bot exists to answer — when does the temple open, when
 *     does the last cart leave — are exactly the ones where a confidently
 *     wrong answer costs someone a wasted walk across campus, or a missed
 *     darshan. A visible file that a human corrects fails loudly instead.
 *  2. Site markup changes without notice; a timing silently becoming null and
 *     rendering as "always open" is a failure mode nobody would catch in review.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  HOW TO MAINTAIN THIS FILE
 *
 *  Every entry carries a `verified` field. Anything marked PLACEHOLDER is a
 *  guess and is NOT shown to visitors — `publicFacts()` filters it out, so an
 *  unverified timing is simply absent rather than wrong. Replace the value,
 *  set `verified: 'confirmed'`, and it starts being used.
 *
 *  Check these against the official noticeboards, not memory, and re-check
 *  after any seasonal change.
 * ────────────────────────────────────────────────────────────────────────────
 */

export type Verification = 'confirmed' | 'PLACEHOLDER';

export interface Fact {
  /** What a visitor would actually ask. */
  topic: string;
  /** The answer, in plain sentences. */
  detail: string;
  verified: Verification;
}

/**
 * Timings, rituals and services.
 *
 * NOTE: every entry below is currently PLACEHOLDER. None of it reaches a
 * visitor until someone confirms it on site. This is intentional — shipping
 * with invented timings would be the single most damaging thing this feature
 * could do.
 */
export const ASHRAM_FACTS: Fact[] = [
  {
    topic: 'Temple timings',
    detail:
      'Confirm the current opening and closing hours, and any midday break, from the noticeboard at the temple entrance.',
    verified: 'PLACEHOLDER',
  },
  {
    topic: 'Daily rituals',
    detail:
      'Confirm the names and times of the daily offerings, and whether visitors may attend each one.',
    verified: 'PLACEHOLDER',
  },
  {
    topic: 'Golf cart service',
    detail:
      'Confirm the hours the carts run, the route they follow, and whether a cart can be requested or only boarded at a stop.',
    verified: 'PLACEHOLDER',
  },
  {
    topic: 'Golf cart pick-up and drop-off points',
    detail:
      'Confirm the list of stops and roughly how long the cart takes between them.',
    verified: 'PLACEHOLDER',
  },
  {
    topic: 'Dining timings',
    detail:
      'Confirm the serving windows for each meal at Biksha Hall.',
    verified: 'PLACEHOLDER',
  },
  {
    topic: 'Accessibility',
    detail:
      'Confirm what assistance exists for visitors who cannot walk long distances, and how to arrange it.',
    verified: 'PLACEHOLDER',
  },
];

/**
 * The cycle hubs, which double as landmarks for directions.
 *
 * These names and capacities are real — they come from prisma/seed.ts, which
 * holds surveyed OpenStreetMap coordinates for the campus — so unlike the
 * timings above, this section is safe to state as fact.
 */
export const CAMPUS_LANDMARKS = [
  'Main Gate — the entrance, and the largest cycle stand (40 docks)',
  'Spanda Hall — 30 docks',
  'Opposite Spanda Hall — 20 docks',
  'Biksha Hall — the dining hall, 25 docks',
  'Kondrai — 15 docks',
  'Sivapadam 2 — 15 docks, at the north end of the campus',
] as const;

/** Only the facts a human has actually confirmed. */
export function publicFacts(): Fact[] {
  return ASHRAM_FACTS.filter((f) => f.verified === 'confirmed');
}

/** True while nobody has confirmed anything — used to warn staff, not visitors. */
export function knowledgeIsEmpty(): boolean {
  return publicFacts().length === 0;
}
