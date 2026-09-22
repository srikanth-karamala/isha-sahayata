/**
 * Score lost & found reports that were never scored when they were filed.
 *
 * Match suggestions are written once, by `runMatching` in
 * `app/lost-found-actions.ts`, at the moment a report is submitted through the
 * app. Rows inserted straight into the database therefore never get scored:
 * the code that calls the model simply never ran for them. That is what
 * happened to the ten demo reports on production — they were bulk-inserted in
 * a four-second burst, so the staff board had nothing to pair and correctly
 * showed nothing.
 *
 * This script closes that gap by running the same matcher over reports that
 * have no suggestions yet. It exists because any future bulk import has the
 * same hole, not only the one that prompted it.
 *
 * It is deliberately conservative:
 *
 *   - Default is a DRY RUN. Nothing is written without `--write`.
 *   - It only ever upserts `MatchSuggestion` rows. It never deletes a report,
 *     a suggestion or anything else — the demo reports cannot be restored from
 *     a seed, so a destructive backfill would be unrecoverable.
 *   - It skips reports that already have suggestions, so re-running it costs
 *     nothing and changes nothing. `--all` overrides that to re-score
 *     everything, for when the prompt has changed.
 *
 * Usage, from the project root:
 *
 *   pnpm db:backfill-matches              # dry run, prints what it would store
 *   pnpm db:backfill-matches --write      # actually store the suggestions
 *   pnpm db:backfill-matches --write --all
 *
 * It writes to whichever database DATABASE_URL points at. Check that first —
 * pointing at production is the usual intent here, and it is not the default
 * in `.env`.
 */

import { PrismaClient, LostFoundKind, LostFoundStatus } from '@prisma/client';
// Relative, not '@/...': ts-node does not resolve the path alias, and an
// aliased import here fails with a module-not-found error that points at this
// file rather than at the real cause.
import { findMatches, MATCH_THRESHOLD, type CandidateItem } from '../lib/lost-found';

const prisma = new PrismaClient();

/** Matches `MAX_CANDIDATES` in app/lost-found-actions.ts. */
const MAX_CANDIDATES = 25;

/**
 * Reports older than this are not matched against.
 *
 * The live path uses 60 days from today. The demo reports are backdated only a
 * few days, so they fall inside it comfortably; a much older import would need
 * this widening rather than the window silently excluding everything.
 */
const CANDIDATE_WINDOW_DAYS = 60;

/** Below this a suggestion is not worth a row. Matches the live path. */
const PERSIST_FLOOR = 30;

/**
 * Pause between matching calls, and how many times to retry one that is
 * rate-limited.
 *
 * The live app scores one report at a time, seconds apart, as people file
 * them — it never approaches a rate limit. A backfill scores every report
 * back-to-back, which does: Groq's free tier allows 8,000 tokens per minute
 * and a single matching call against ~10 candidates costs most of a thousand.
 * Without pacing, the first few reports scored and the rest came back 429,
 * which the script correctly skipped rather than inventing scores for — but
 * that leaves the board half-filled and needs repeated re-runs.
 *
 * Waiting is the right fix rather than raising the limit: a backfill is not
 * urgent, and a slow complete run beats a fast partial one.
 */
const PACE_MS = 8_000;
const RATE_LIMIT_RETRIES = 4;
const RETRY_BACKOFF_MS = 25_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function windowStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - CANDIDATE_WINDOW_DAYS);
  return d;
}

async function main() {
  const write = process.argv.includes('--write');
  const rescoreAll = process.argv.includes('--all');

  // The connection string is secret, so only its shape is printed — enough to
  // tell local Docker from the cloud without putting a credential in a log.
  const url = process.env.DATABASE_URL ?? '';
  // Local is a postgresql:// string against Docker on 127.0.0.1:5434.
  // Production is also a plain postgres:// string, against a remote host —
  // so the scheme does not distinguish them and the host has to. (Vercel's
  // PRISMA_DATABASE_URL is an Accelerate token beginning "eyJ", but the app
  // reads DATABASE_URL, which is direct.)
  const isLocal = url.includes('127.0.0.1') || url.includes('localhost');
  const target = isLocal
    ? 'local Docker'
    : url.startsWith('postgres')
      ? 'REMOTE database — this is almost certainly production'
      : url.startsWith('prisma://') || url.startsWith('eyJ')
        ? 'Prisma Accelerate (cloud)'
        : 'unrecognised host';

  console.log(`Database : ${target}`);
  console.log(`Mode     : ${write ? 'WRITE — suggestions will be stored' : 'DRY RUN — nothing will be written'}`);
  console.log(`Scope    : ${rescoreAll ? 'every open report' : 'reports with no suggestions yet'}`);
  console.log();

  const open = await prisma.lostFoundItem.findMany({
    where: { status: LostFoundStatus.OPEN },
    include: { hub: true, matchesAsSource: { select: { id: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const todo = rescoreAll ? open : open.filter((i) => i.matchesAsSource.length === 0);

  console.log(`${open.length} open reports, ${todo.length} to score.`);
  if (todo.length === 0) {
    console.log('Nothing to do.');
    return;
  }
  console.log();

  let pairsWritten = 0;
  let aboveThreshold = 0;
  let modelUnavailable = false;

  let scored = 0;

  for (const item of todo) {
    // Pace the calls so the free tier's per-minute budget refills. Skipped
    // before the first call, and after one that never reached the model.
    if (scored > 0) await sleep(PACE_MS);

    const opposite =
      item.kind === LostFoundKind.LOST ? LostFoundKind.FOUND : LostFoundKind.LOST;

    const rows = await prisma.lostFoundItem.findMany({
      where: {
        kind: opposite,
        status: LostFoundStatus.OPEN,
        occurredAt: { gte: windowStart() },
      },
      include: { hub: true },
      orderBy: { occurredAt: 'desc' },
      take: MAX_CANDIDATES,
    });

    if (rows.length === 0) {
      console.log(`· ${item.title} — no candidates on the other side, skipped.`);
      continue;
    }

    const candidates: CandidateItem[] = rows.map((r) => ({
      id: r.id,
      description: r.description,
      placeNote: r.placeNote,
      hubName: r.hub?.name ?? null,
      occurredAt: r.occurredAt,
      category: r.category,
    }));

    const subject = {
      description: item.description,
      category: item.category,
      kind: item.kind,
      occurredAt: item.occurredAt,
      placeNote: item.placeNote,
      hubName: item.hub?.name ?? null,
    };

    // `findMatches` swallows the HTTP error and reports 'unavailable', so a
    // rate limit is indistinguishable here from a key being wrong. Retrying a
    // few times with a long wait costs nothing when the key is genuinely bad
    // — it just ends up skipped, as it would have anyway.
    let outcome = await findMatches(subject, candidates);
    for (let attempt = 0; outcome.source === 'unavailable' && attempt < RATE_LIMIT_RETRIES; attempt++) {
      console.log(
        `    (no answer for "${item.title}" — waiting ${RETRY_BACKOFF_MS / 1000}s, retry ${attempt + 1}/${RATE_LIMIT_RETRIES})`
      );
      await sleep(RETRY_BACKOFF_MS);
      outcome = await findMatches(subject, candidates);
    }

    if (outcome.source === 'unavailable') {
      // No model answered. Storing nothing is correct — an unscored report is
      // honest, a fabricated score is not.
      modelUnavailable = true;
      console.log(`· ${item.title} — no model could be reached, skipped.`);
      continue;
    }

    scored++;

    const byId = new Map(rows.map((r) => [r.id, r]));
    const worth = outcome.matches.filter((m) => m.score >= PERSIST_FLOOR);

    if (worth.length === 0) {
      console.log(`· ${item.title} — nothing scored above ${PERSIST_FLOOR}.`);
      continue;
    }

    for (const match of worth) {
      const other = byId.get(match.candidateId);
      const otherTitle = other?.title ?? match.candidateId;
      const mark = match.score >= MATCH_THRESHOLD ? '✓' : ' ';
      if (match.score >= MATCH_THRESHOLD) aboveThreshold++;

      console.log(
        `${mark} ${item.title}  ↔  ${otherTitle}   ${match.score}%  (${outcome.source})`
      );
      console.log(`    ${match.reasoning}`);

      if (!write) continue;

      // Written in both directions so either party sees the suggestion from
      // their own side, exactly as the live path does.
      for (const pair of [
        { sourceId: item.id, targetId: match.candidateId },
        { sourceId: match.candidateId, targetId: item.id },
      ]) {
        await prisma.matchSuggestion.upsert({
          where: { sourceId_targetId: pair },
          update: { score: match.score, reasoning: match.reasoning, byAi: true },
          create: { ...pair, score: match.score, reasoning: match.reasoning, byAi: true },
        });
        pairsWritten++;
      }
    }
  }

  console.log();
  console.log(
    `${aboveThreshold} suggestion(s) at or above the display threshold of ${MATCH_THRESHOLD}%.`
  );

  if (modelUnavailable) {
    console.log(
      'At least one report could not be scored because no model answered. ' +
        'Check GROQ_API_KEY / ANTHROPIC_API_KEY, then re-run — already-scored ' +
        'reports are skipped, so nothing is spent twice.'
    );
  }

  if (write) {
    console.log(`${pairsWritten} suggestion row(s) written (two per pairing).`);
  } else {
    console.log('Dry run — nothing was written. Re-run with --write to store these.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
