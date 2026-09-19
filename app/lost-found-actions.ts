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
  if (input.photoDataUrl) {
    const { saveUploadDataUrl } = await import('@/lib/uploads');
    photoUrl = await saveUploadDataUrl(input.photoDataUrl, 'lost-found');
  }

  // Claude labels the report so staff lists stay scannable; the description
  // itself is what matching actually reads.
  const classified = await classifyItem(description, input.kind);

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

  // Store a suggestion per direction so either party sees it from their side.
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
          byAi: outcome.source === 'ai',
        },
        create: {
          ...pair,
          score: match.score,
          reasoning: match.reasoning,
          byAi: outcome.source === 'ai',
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

/** Open reports of one kind, newest first — the public browse list. */
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
