'use server';

import { CabRequestStatus, CabScope } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Put a cab request in front of the staff.
 *
 * Deliberately does not dispatch anything — there is no vehicle system to
 * talk to. It records the ask so a person at the desk can act on it, which is
 * why the caller's confirmation says what was sent rather than that a cab is
 * coming.
 */
export async function requestCab(input: {
  userId: string;
  pickup: string;
  destination: string;
  scope: CabScope;
  /** ISO string from the form, or null for "as soon as possible". */
  whenAt?: string | null;
  note?: string | null;
}) {
  const pickup = input.pickup.trim();
  const destination = input.destination.trim();

  if (!pickup) throw new Error('Where should the cab pick you up?');
  if (!destination) throw new Error('Where are you going?');

  const row = await prisma.cabRequest.create({
    data: {
      requestedById: input.userId,
      pickup,
      destination,
      scope: input.scope,
      whenAt: input.whenAt ? new Date(input.whenAt) : null,
      note: input.note?.trim() || null,
    },
  });

  return { id: row.id, createdAt: row.createdAt };
}

/**
 * The queue for the staff console: anything still to be acted on first, then
 * today's finished requests so the desk can see what has already happened.
 */
export async function getCabRequests(limit = 40) {
  const rows = await prisma.cabRequest.findMany({
    include: { requestedBy: true },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  });

  return rows.map((r) => ({
    id: r.id,
    pickup: r.pickup,
    destination: r.destination,
    whenAt: r.whenAt,
    scope: r.scope,
    status: r.status,
    note: r.note,
    createdAt: r.createdAt,
    requestedBy: { name: r.requestedBy.name, phone: r.requestedBy.phone },
  }));
}

export type CabRequestRow = Awaited<ReturnType<typeof getCabRequests>>[number];

/** How many requests are still waiting on someone — drives the tab badge. */
export async function getOpenCabCount() {
  return prisma.cabRequest.count({
    where: { status: { in: [CabRequestStatus.REQUESTED, CabRequestStatus.ACCEPTED] } },
  });
}

/** Move a request along. Nothing is deleted; the row keeps its history. */
export async function setCabStatus(id: string, status: CabRequestStatus) {
  await prisma.cabRequest.update({ where: { id }, data: { status } });
}

/** A rider's own requests, so the Ride tab can show what they already asked. */
export async function getMyCabRequests(userId: string, limit = 5) {
  const rows = await prisma.cabRequest.findMany({
    where: { requestedById: userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    pickup: r.pickup,
    destination: r.destination,
    whenAt: r.whenAt,
    scope: r.scope,
    status: r.status,
    createdAt: r.createdAt,
  }));
}
