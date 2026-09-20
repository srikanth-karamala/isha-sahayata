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
/**
 * Where the September 2026 batch of answers came from.
 *
 * The official Isha website, not the noticeboards. Everything carrying this
 * source is `unverified` on purpose: a published page goes stale silently,
 * while a noticeboard is corrected the morning a timing changes, and it is the
 * noticeboard a visitor is standing in front of. Shown with the caveat
 * attached, which is a large improvement on being invisible, but each one
 * still wants five minutes at the right desk to become `confirmed`.
 */
const SOURCE_WEBSITE = 'Official Isha website, 20 September 2026 — NOT yet checked on site';

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
      'The centre is about 30 km west of Coimbatore. Coimbatore airport is about 40 km away and Coimbatore Junction railway station about 30 km. City buses 14D and 14C run from Gandhipuram, and taxis are available from the airport and the station.',
    verified: 'unverified',
    source: SOURCE_WEBSITE,
    // Still to ask at the desk: the time of the LAST bus of the day, which is
    // what a late arrival actually needs and which the website does not give.
  },
  {
    topic: 'Arrival and registration',
    detail:
      'What you need to do on arrival depends on why you are visiting. Visitors coming from outside India are asked to raise a visit request through Isha\'s Overseas Online Portal before travelling. For anything else, the desk at Main Gate will tell you where to report.',
    verified: 'unverified',
    source: SOURCE_WEBSITE,
    // Still to ask at the desk: whether a day visitor needs to register at
    // all, and what identification is required. The website is clear only
    // about overseas visitors.
  },

  // ── Temple and offerings ────────────────────────────────────────────────
  {
    topic: 'Temple timings',
    detail:
      'The Dhyanalinga is open 6:00am to 8:30pm. Linga Bhairavi opens at 6:30am and closes at 8:20pm. Kalabhairava is open 6:30am to 8:00pm. Timings can change seasonally and on special days.',
    // Published with a caveat rather than as fact: these came from a general
    // source, not from the noticeboard at the temple. Withholding them left
    // the assistant unable to answer the question visitors ask most, which
    // helped nobody; stating them flatly would send someone across the campus
    // on a number nobody has checked. Confirm on site, then move to
    // 'confirmed' and stamp `checked`.
    verified: 'unverified',
    source: SOURCE_WEBSITE,
    // Still to ask at the boards:
    //   Linga Bhairavi — the website gives an opening and a closing time but
    //     no midday break, while an earlier source described two sessions.
    //     Worth confirming which is right.
    //   Suryakund / Chandrakund — quoted elsewhere as one 7:30am-8:00pm
    //     window, but 12.5 unbroken hours is unusual for the kunds and reads
    //     like two sessions merged. Deliberately left out until someone can
    //     give the separate morning and evening times.
  },
  {
    topic: 'Daily rituals and offerings',
    detail:
      'The daily schedule includes Guru Pooja, Nada Aradhana, the aratis at the temples, Darshan and Bhakti Sadhana. The noticeboard at each temple entrance carries that day\'s times.',
    verified: 'unverified',
    source: SOURCE_WEBSITE,
    // Still to ask: the actual clock times for each, and whether a visitor may
    // take part or only observe. Naming the rituals without their times is
    // half an answer, so this stays unverified.
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
      'On Amavasya and Purnima the Dhyanalinga takes a milk offering from 6:00am to 1:00pm, and a water offering from 1:00pm to 8:00pm.',
    verified: 'unverified',
    source: SOURCE_WEBSITE,
    // Still to ask: what happens on ordinary days, where a visitor obtains the
    // offering, and whether anyone may take part.
  },

  // ── Getting around the campus ───────────────────────────────────────────
  {
    topic: 'Shuttle and golf cart service',
    detail:
      'Shuttles run on fixed routes across the campus: Sarpa Vasal to Adiyogi, Adiyogi to Kalabhairava, Welcome Point to Nalanda and Brahmaputra, Welcome Point to Isha Home School, and Welcome Point to Shivapadam 3 and 4. A bullock cart also runs from Sarpa Vasal to Adiyogi, and from Welcome Point to the metal bridge near Bhiksha Hall.',
    verified: 'unverified',
    source: SOURCE_WEBSITE,
    // Still to ask at the stand: the HOURS each route runs, the fare if any,
    // and whether a shuttle can be requested or only boarded at a stop. The
    // routes are known; when they run is not.
  },
  {
    topic: 'Shuttle pick-up and drop-off points',
    detail:
      'The named stops are Sarpa Vasal, Adiyogi, Kalabhairava, Welcome Point, Nalanda, Brahmaputra, Isha Home School, Shivapadam 3 and Shivapadam 4, and the metal bridge near Bhiksha Hall.',
    verified: 'unverified',
    source: SOURCE_WEBSITE,
    // Still to ask: roughly how long the shuttle takes between stops.
  },

  // ── Staying and eating ──────────────────────────────────────────────────
  {
    topic: 'Dining timings',
    detail:
      'Bhiksha Hall serves brunch in three sittings, at 9:50am, 10:35am and 11:10am, and dinner at 6:50pm, 7:35pm and 8:10pm.',
    // Confirmed by Srikanth on 20 September 2026 against the sittings in use.
    verified: 'confirmed',
    source: 'Confirmed on site, September 2026',
    checked: '2026-09-20',
    // Note the official spelling is Bhiksha Hall; the cycle stand in
    // prisma/seed.ts is named "Biksha Hall". Worth reconciling one day.
    // Still open: whether day visitors eat here or elsewhere.
  },
  {
    topic: 'Accommodation',
    detail:
      'There are cottages for visitors — Standard, AC and Executive Suite — and other accommodation such as the Nadi Cottages and Nalanda is used for programmes. Booking is through the Isha website or reception.',
    verified: 'unverified',
    source: SOURCE_WEBSITE,
    // Still to ask: check-in and check-out times, which a visitor planning a
    // stay needs and which are not published.
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
      'Traditional Indian attire is asked for, and clothing should cover the upper arms, thighs and ankles. Shorts, capris, and tight or transparent clothing are not permitted.',
    // Confirmed rather than unverified, on the same reasoning as the address:
    // this is a standing policy published by the ashram itself, not a timing
    // that drifts with the season. Someone turned away at a temple entrance
    // for the wrong clothes is a real cost, and hedging the one piece of
    // advice that prevents it would help nobody.
    verified: 'confirmed',
    source: 'Official Isha website — standing dress policy',
    checked: '2026-09-20',
    // Still to ask at the boards: any restriction on photography, footwear or
    // phones, which is not covered here.
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
