'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { LostFoundKind, LostFoundStatus } from '@prisma/client';
import {
  classifyItem,
  findMatches,
  MATCH_THRESHOLD,
  type CandidateItem,
} from '@/lib/lost-found';

/**
 * Lost and found: reporting, matching and claiming.
 *
 * Matching runs once when a report is filed, against the open reports on the
 * opposite side, and the results are stored. Scoring on every page load would
 * re-spend the same tokens to produce an answer that had not changed.
 */

/** How many candidates go to the model in one matching call. */
const MAX_CANDIDATES = 25;

/** Reports older than this are not matched against — the trail is cold. */
const CANDIDATE_WINDOW_DAYS = 60;

function windowStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - CANDIDATE_WINDOW_DAYS);
  return d;
}

export async function reportLostOrFound(input: {
  kind: LostFoundKind;
  description: string;
  userId: string;
  hubId?: string | null;
  placeNote?: string | null;
  occurredAt?: string | null;
  photoDataUrl?: string | null;
  lat?: number;
  lng?: number;
}) {
  const description = input.description.trim();
  if (!description) {
    throw new Error('Please describe the item so it can be matched.');
  }

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new Error('Please add your name and phone first.');

  let photoUrl: string | null = null;
  let photo: { mediaType: string; data: string } | null = null;
  if (input.photoDataUrl) {
    const { saveUploadDataUrl, loadUploadForAi } = await import('@/lib/uploads');
    photoUrl = await saveUploadDataUrl(input.photoDataUrl, 'lost-found');
    // Read it straight back for the vision call. A found object is often
    // described in two words ("Deposit token") while the photo carries the
    // detail that identifies it — a number painted on the thing.
    photo = await loadUploadForAi(photoUrl);
  }

  // The model labels the report so staff lists stay scannable, and reads the
  // photo when there is one; the description is what matching then compares.
  const classified = await classifyItem(description, input.kind, photo);

  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

  const item = await prisma.lostFoundItem.create({
    data: {
      kind: input.kind,
      description,
      category: classified.category,
      title: classified.title,
      photoUrl,
      hubId: input.hubId || null,
      placeNote: input.placeNote?.trim() || null,
      occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
      reportedById: input.userId,
      latitude: input.lat ?? null,
      longitude: input.lng ?? null,
    },
    include: { hub: true },
  });

  const matchCount = await runMatching(item.id);

  revalidatePath('/');
  revalidatePath('/admin');

  return {
    success: true,
    item,
    classifiedBy: classified.source,
    matchCount,
  };
}

/**
 * Score a report against open reports on the opposite side and store the
 * results. Returns how many suggestions cleared the display threshold.
 */
export async function runMatching(itemId: string): Promise<number> {
  const item = await prisma.lostFoundItem.findUnique({
    where: { id: itemId },
    include: { hub: true },
  });
  if (!item || item.status !== LostFoundStatus.OPEN) return 0;

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
  if (rows.length === 0) return 0;

  const candidates: CandidateItem[] = rows.map((r) => ({
    id: r.id,
    description: r.description,
    placeNote: r.placeNote,
    hubName: r.hub?.name ?? null,
    occurredAt: r.occurredAt,
    category: r.category,
  }));

  const outcome = await findMatches(
    {
      description: item.description,
      category: item.category,
      kind: item.kind,
      occurredAt: item.occurredAt,
      placeNote: item.placeNote,
      hubName: item.hub?.name ?? null,
    },
    candidates
  );

  // Only a model's scoring is persisted. findMatches returns no matches when
  // it could not reach one, so this loop simply does not run then, and the
  // report stays unpaired for a person to look at.
  for (const match of outcome.matches) {
    if (match.score < 30) continue; // not worth persisting
    const pairs = [
      { sourceId: item.id, targetId: match.candidateId },
      { sourceId: match.candidateId, targetId: item.id },
    ];
    for (const pair of pairs) {
      await prisma.matchSuggestion.upsert({
        where: { sourceId_targetId: pair },
        update: {
          score: match.score,
          reasoning: match.reasoning,
          byAi: true,
        },
        create: {
          ...pair,
          score: match.score,
          reasoning: match.reasoning,
          byAi: true,
        },
      });
    }
  }

  return outcome.matches.filter((m) => m.score >= MATCH_THRESHOLD).length;
}

/** Open reports filed by one person, with their suggested matches. */
export async function getMyReports(userId: string) {
  if (!userId) return [];

  const items = await prisma.lostFoundItem.findMany({
    where: { reportedById: userId },
    include: {
      hub: true,
      matchesAsSource: {
        where: { dismissed: false, score: { gte: MATCH_THRESHOLD } },
        orderBy: { score: 'desc' },
        include: {
          target: { include: { hub: true, reportedBy: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return items;
}

/**
 * Open reports of one kind, newest first — the public browse list.
 *
 * Deliberately does NOT include the reporter. This runs from the rider client
 * component, so anything selected here is serialised into every rider's page
 * whether it is rendered or not; contact details belong only in the staff
 * query below.
 */
export async function getOpenItems(kind: LostFoundKind, limit = 30) {
  return prisma.lostFoundItem.findMany({
    where: { kind, status: LostFoundStatus.OPEN },
    include: { hub: true },
    orderBy: { occurredAt: 'desc' },
    take: limit,
  });
}


/**
 * Mark a pair as reunited. Both reports close together — the object has one
 * owner, so leaving either side open would keep matching a solved case.
 */
export async function confirmMatch(itemId: string, matchedItemId: string) {
  await prisma.$transaction([
    prisma.lostFoundItem.update({
      where: { id: itemId },
      data: { status: LostFoundStatus.CLAIMED },
    }),
    prisma.lostFoundItem.update({
      where: { id: matchedItemId },
      data: { status: LostFoundStatus.CLAIMED },
    }),
  ]);

  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true };
}

export async function dismissMatch(sourceId: string, targetId: string) {
  await prisma.matchSuggestion.updateMany({
    where: {
      OR: [
        { sourceId, targetId },
        { sourceId: targetId, targetId: sourceId },
      ],
    },
    data: { dismissed: true },
  });
  revalidatePath('/');
  return { success: true };
}

/** Counts and the strongest open pairings, for the staff dashboard. */
export async function getLostFoundSummary() {
  const [openLost, openFound, claimed, topMatches] = await Promise.all([
    prisma.lostFoundItem.count({
      where: { kind: LostFoundKind.LOST, status: LostFoundStatus.OPEN },
    }),
    prisma.lostFoundItem.count({
      where: { kind: LostFoundKind.FOUND, status: LostFoundStatus.OPEN },
    }),
    prisma.lostFoundItem.count({ where: { status: LostFoundStatus.CLAIMED } }),
    prisma.matchSuggestion.findMany({
      where: {
        dismissed: false,
        score: { gte: MATCH_THRESHOLD },
        source: { kind: LostFoundKind.LOST, status: LostFoundStatus.OPEN },
        target: { status: LostFoundStatus.OPEN },
      },
      orderBy: { score: 'desc' },
      take: 5,
      include: {
        source: { include: { reportedBy: true, hub: true } },
        target: { include: { reportedBy: true, hub: true } },
      },
    }),
  ]);

  return { openLost, openFound, claimed, topMatches };
}

/**
 * Every open report, newest first, each with its best AI-scored partner.
 *
 * One query for the whole staff page. The board used to be two sections —
 * pairings, then everything the matcher could not pair — which meant a report
 * moved between sections depending on whether a match existed, and staff had
 * to look in two places to answer "what just came in?". Here the feed is
 * always in arrival order and the pairing, when there is one, hangs off the
 * report it belongs to.
 */
export async function getOpenFeed(limit = 40) {
  const items = await prisma.lostFoundItem.findMany({
    where: { status: LostFoundStatus.OPEN },
    include: {
      hub: true,
      reportedBy: true,
      matchesAsSource: {
        where: {
          dismissed: false,
          score: { gte: MATCH_THRESHOLD },
          target: { status: LostFoundStatus.OPEN },
        },
        orderBy: { score: 'desc' },
        take: 1,
        include: { target: { include: { reportedBy: true, hub: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return items.map((item) => {
    const best = item.matchesAsSource[0];
    return {
      id: item.id,
      kind: item.kind,
      title: item.title,
      description: item.description,
      photoUrl: item.photoUrl,
      category: item.category,
      occurredAt: item.occurredAt,
      createdAt: item.createdAt,
      placeNote: item.placeNote,
      hub: item.hub ? { name: item.hub.name } : null,
      reportedBy: { name: item.reportedBy.name, phone: item.reportedBy.phone },
      match: best
        ? {
            id: best.id,
            score: best.score,
            reasoning: best.reasoning,
            other: {
              id: best.target.id,
              kind: best.target.kind,
              title: best.target.title,
              description: best.target.description,
              photoUrl: best.target.photoUrl,
              placeNote: best.target.placeNote,
              hub: best.target.hub ? { name: best.target.hub.name } : null,
              reportedBy: {
                name: best.target.reportedBy.name,
                phone: best.target.reportedBy.phone,
              },
            },
          }
        : null,
    };
  });
}
