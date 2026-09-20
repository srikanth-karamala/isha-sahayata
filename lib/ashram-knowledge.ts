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
 *  unverified timing is simply absent rather than wrong. To confirm one:
 *
 *    1. Read the real value on site, at the place named in `source`.
 *    2. Replace `detail` with the answer, in plain sentences.
 *    3. Set `verified: 'confirmed'` and `checked` to today's ISO date.
 *
 *  Check these against the official noticeboards, not memory, and not against
 *  a web page or a language model's recollection — both go stale silently, and
 *  a wrong timing here is worse than no timing. Re-check after any seasonal
 *  change, and treat anything dated more than a few months back as suspect.
 *
 *  Two entries resist being pinned down and should usually stay PLACEHOLDER:
 *  Ekadasi (it moves with the lunar month) and the programme schedule (it
 *  changes monthly). Leaving them unconfirmed makes the assistant refer people
 *  to the desk, which is the right answer for a date-dependent question.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * How much weight a fact can carry.
 *
 *  confirmed   — read off a noticeboard or desk on site. Stated plainly.
 *  unverified  — a plausible value from a source that is not the ashram
 *                itself. Shown, but always with a caveat telling the visitor
 *                to check before relying on it.
 *  PLACEHOLDER — no value at all, only a note on what to go and ask.
 *                Never reaches a visitor.
 *
 * `unverified` exists because the two-state version forced a bad choice:
 * either publish an unchecked timing as fact, or withhold the only answer
 * available and leave the assistant useless for the questions people most
 * often ask. A hedged answer is more useful than silence and more honest
 * than a confident one.
 */
export type Verification = 'confirmed' | 'unverified' | 'PLACEHOLDER';

export interface Fact {
  /** What a visitor would actually ask. */
  topic: string;
  /** The answer, in plain sentences. */
  detail: string;
  verified: Verification;
  /**
   * Where to check this, and where the confirmed value came from.
   *
   * Recorded so a later reader can re-verify without repeating the search for
   * the right noticeboard or desk. Seasonal entries go stale silently, and
   * without a source there is no way to tell a checked fact from a guess that
   * someone marked confirmed.
   */
  source?: string;
  /** ISO date the value was last checked on site. Set it when confirming. */
  checked?: string;
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
  // ── Getting here ────────────────────────────────────────────────────────
  {
    topic: 'Address and phone number',
    detail:
      'The Isha Yoga Center is at Velliangiri Foothills, Ishana Vihar Post, Coimbatore 641114, Tamil Nadu. The general enquiry number is +91 83000 83111.',
    // Confirmed rather than PLACEHOLDER because a postal address and a
    // switchboard number are stable and published in many places, and the
    // cost of one being stale is a redirected letter or a dead line — not a
    // visitor walking across the campus for a darshan that already closed.
    // Timings get no such latitude; see the note on the entries below.
    verified: 'confirmed',
    source: 'Publicly published contact details',
    checked: '2026-09-20',
  },
  {
    topic: 'How to reach the Isha Yoga Center',
    detail:
      'Confirm the distance and usual travel time from Coimbatore city and from Coimbatore airport and railway station, and which public buses serve the centre. Note the last bus of the day, which is what a late arrival actually needs.',
    verified: 'PLACEHOLDER',
    source: 'Reception desk at Main Gate; the official travel page',
  },
  {
    topic: 'Arrival and registration',
    detail:
      'Confirm where a visitor reports on arrival, what identification is required, and whether day visitors need to register at all.',
    verified: 'PLACEHOLDER',
    source: 'Main Gate reception',
  },

  // ── Temple and offerings ────────────────────────────────────────────────
  {
    topic: 'Temple timings',
    detail:
      'The Dhyanalinga is generally open from about 6:00am to 8:00pm. The Linga Bhairavi temple is generally open about 6:30am to 1:20pm and again from about 4:20pm to 8:20pm. Both can change seasonally and on special days.',
    // Published with a caveat rather than as fact: these came from a general
    // source, not from the noticeboard at the temple. Withholding them left
    // the assistant unable to answer the question visitors ask most, which
    // helped nobody; stating them flatly would send someone across the campus
    // on a number nobody has checked. Confirm on site, then move to
    // 'confirmed' and stamp `checked`.
    verified: 'unverified',
    source: 'General published information — NOT yet checked on site',
    // Still to ask at the boards:
    //   Dhyanalinga — is there a midday break?
    //   Suryakund / Chandrakund — quoted elsewhere as one 7:30am-8:00pm
    //     window, but 12.5 unbroken hours is unusual for the kunds and reads
    //     like two sessions merged. Deliberately left out until someone can
    //     give the separate morning and evening times.
  },
  {
    topic: 'Daily rituals and offerings',
    detail:
      'Confirm the names and times of the daily offerings at each temple, and whether visitors may attend each one or only observe.',
    verified: 'PLACEHOLDER',
    source: 'Noticeboard at each temple entrance',
  },
  {
    topic: 'Ekadasi and other special days',
    detail:
      'Confirm which days in the current month are observed differently, and how timings change on them. Ekadasi falls twice a lunar month, so this needs a date-aware answer rather than a fixed one — if it cannot be kept current, leave it PLACEHOLDER so the assistant refers people to the desk instead.',
    verified: 'PLACEHOLDER',
    source: 'Temple noticeboard; monthly programme schedule',
  },
  {
    topic: 'Milk offering',
    detail:
      'Confirm the timing of the milk offering, where a visitor obtains the offering, and any restriction on who may participate.',
    verified: 'PLACEHOLDER',
    source: 'Temple noticeboard or the attending volunteer',
  },

  // ── Getting around the campus ───────────────────────────────────────────
  {
    topic: 'Shuttle and golf cart service',
    detail:
      'Confirm the hours the shuttles and carts run, the route they follow, the fare if any, and whether one can be requested or only boarded at a stop.',
    verified: 'PLACEHOLDER',
    source: 'Main Gate desk; the shuttle stand itself',
  },
  {
    topic: 'Shuttle pick-up and drop-off points',
    detail:
      'Confirm the list of stops and roughly how long the shuttle takes between them. The cycle stands in CAMPUS_LANDMARKS below are already accurate and can be named as landmarks alongside these.',
    verified: 'PLACEHOLDER',
    source: 'Main Gate desk',
  },

  // ── Staying and eating ──────────────────────────────────────────────────
  {
    topic: 'Dining timings',
    detail:
      'Confirm the serving windows for each meal at Biksha Hall, and whether day visitors eat there or elsewhere.',
    verified: 'PLACEHOLDER',
    source: 'Noticeboard at Biksha Hall',
  },
  {
    topic: 'Accommodation',
    detail:
      'Confirm what accommodation exists for visitors, how it is booked, and the check-in and check-out times.',
    verified: 'PLACEHOLDER',
    source: 'Reception; the official accommodation page',
  },

  // ── Programmes ──────────────────────────────────────────────────────────
  {
    topic: 'Programmes offered',
    detail:
      'Confirm which programmes are currently open to visitors, their duration, and how to register. Programme schedules change month to month — record the month this was checked, and prefer pointing visitors at the desk over listing dates that will expire.',
    verified: 'PLACEHOLDER',
    source: 'Programme desk; the official programmes page',
  },

  // ── Practical matters ───────────────────────────────────────────────────
  {
    topic: 'Dress code and conduct',
    detail:
      'Confirm what visitors are asked to wear, particularly for entering the temples, and any restriction on photography, footwear or phones.',
    verified: 'PLACEHOLDER',
    source: 'Noticeboard at Main Gate and temple entrances',
  },
  {
    topic: 'Accessibility',
    detail:
      'Confirm what assistance exists for visitors who cannot walk long distances, including wheelchair availability and step-free routes, and how to arrange it.',
    verified: 'PLACEHOLDER',
    source: 'Main Gate reception',
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

/** Everything the assistant may repeat — confirmed outright or hedged. */
export function publicFacts(): Fact[] {
  return ASHRAM_FACTS.filter((f) => f.verified !== 'PLACEHOLDER');
}

/** True when at least one fact on offer still needs checking on site. */
export function hasUnverifiedFacts(): boolean {
  return ASHRAM_FACTS.some((f) => f.verified === 'unverified');
}

/**
 * True while the timings a visitor actually asks about are still unconfirmed.
 *
 * Not simply "no facts at all": confirming the address and phone number left
 * that count non-zero while all thirteen timing and service entries were
 * still PLACEHOLDER, which would have hidden the staff warning at exactly the
 * moment it was still true. What matters is whether the assistant can answer
 * a question about when something happens, so that is what this measures.
 */
export function knowledgeIsEmpty(): boolean {
  const TIMING_TOPICS = ASHRAM_FACTS.filter(
    (f) => f.topic !== 'Address and phone number'
  );
  return TIMING_TOPICS.every((f) => f.verified === 'PLACEHOLDER');
}
