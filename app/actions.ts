'use server';

import { prisma } from '@/lib/prisma';
import { triageFaultReport, SEVERITY_RANK } from '@/lib/triage';
import { revalidatePath } from 'next/cache';
import { getFleetSummary, getHubBalances, getTodayDemand } from '@/lib/analytics';
import type { CycleStatus } from '@prisma/client';
import type { CycleDetail, HubSummary } from '@/lib/types';

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const hubInclude = {
  cycles: {
    select: {
      id: true,
      qrCode: true,
      status: true,
    },
  },
} as const;

const PATH_POINT_LIMIT = 500;

async function replaceRidePathPoints(rideId: string, path: [number, number][]) {
  const points = path.slice(-PATH_POINT_LIMIT);
  await prisma.$transaction([
    prisma.ridePathPoint.deleteMany({ where: { rideId } }),
    ...(points.length
      ? [
          prisma.ridePathPoint.createMany({
            data: points.map(([latitude, longitude], seq) => ({
              rideId,
              seq,
              latitude,
              longitude,
            })),
          }),
        ]
      : []),
  ]);
}

async function completeActiveRide(
  cycleId: string,
  extra: {
    endHubId?: string;
    distanceMeters?: number;
    lat?: number;
    lng?: number;
    path?: [number, number][];
  }
) {
  const ride = await prisma.ride.findFirst({
    where: { cycleId, status: 'ACTIVE' },
    orderBy: { startedAt: 'desc' },
  });
  if (!ride) return;
  await prisma.ride.update({
    where: { id: ride.id },
    data: {
      status: 'COMPLETED',
      endedAt: new Date(),
      endHubId: extra.endHubId ?? ride.endHubId,
      distanceMeters: extra.distanceMeters ?? ride.distanceMeters,
      lastLat: extra.lat ?? ride.lastLat,
      lastLng: extra.lng ?? ride.lastLng,
    },
  });
  if (extra.path) {
    await replaceRidePathPoints(ride.id, extra.path);
  }
}

function toCycleDetail(cycle: {
  id: string;
  qrCode: string;
  status: CycleStatus;
  currentHubId: string;
  heldByUserId: string | null;
  issueNotes: string | null;
  currentHub: { id: string; name: string } | null;
  heldByUser?: { name: string; phone: string } | null;
}): CycleDetail {
  return {
    id: cycle.id,
    qrCode: cycle.qrCode,
    status: cycle.status,
    currentHubId: cycle.currentHubId,
    heldByUserId: cycle.heldByUserId,
    issueNotes: cycle.issueNotes,
    currentHub: cycle.currentHub,
    heldByUser: cycle.heldByUser
      ? { name: cycle.heldByUser.name, phone: cycle.heldByUser.phone }
      : null,
  };
}

export async function getTodayStats() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [ridesToday, completedRidesToday] = await Promise.all([
    prisma.auditLog.count({
      where: { action: 'CHECKOUT', createdAt: { gte: startOfToday } },
    }),
    prisma.auditLog.findMany({
      where: { action: 'DROP_OFF', createdAt: { gte: startOfToday } },
      include: { startHub: true, endHub: true },
    }),
  ]);

  const kmCoveredToday = completedRidesToday.reduce((total, log) => {
    if (log.distanceMeters != null) {
      return total + log.distanceMeters / 1000;
    }
    const start = log.startHub;
    const end = log.endHub;
    if (
      start?.latitude != null &&
      start?.longitude != null &&
      end?.latitude != null &&
      end?.longitude != null
    ) {
      const meters = haversineMeters(
        start.latitude,
        start.longitude,
        end.latitude,
        end.longitude
      );
      return total + meters / 1000;
    }
    return total;
  }, 0);

  return {
    ridesToday,
    kmCoveredToday: Math.round(kmCoveredToday * 10) / 10,
  };
}

export async function getHubs(): Promise<HubSummary[]> {
  return await prisma.hub.findMany({
    include: hubInclude,
  });
}

export async function getCycleByQr(qrCode: string): Promise<CycleDetail | null> {
  const cycle = await prisma.cycle.findUnique({
    where: { qrCode: qrCode.trim().toUpperCase() },
    include: {
      currentHub: { select: { id: true, name: true } },
      heldByUser: { select: { name: true, phone: true } },
    },
  });
  return cycle ? toCycleDetail(cycle) : null;
}

export async function getActiveCycleForUser(userId: string): Promise<CycleDetail | null> {
  const cycle = await prisma.cycle.findFirst({
    where: { heldByUserId: userId, status: 'IN_USE' },
    include: {
      currentHub: { select: { id: true, name: true } },
      heldByUser: { select: { name: true, phone: true } },
    },
  });
  return cycle ? toCycleDetail(cycle) : null;
}

export async function getOrCreateUser(name: string, phone: string) {
  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();

  if (!trimmedName) throw new Error('Name is required');
  if (!/^[0-9+\-\s]{7,15}$/.test(trimmedPhone)) {
    throw new Error('Enter a valid phone number');
  }

  const user = await prisma.user.upsert({
    where: { phone: trimmedPhone },
    update: { name: trimmedName },
    create: { name: trimmedName, phone: trimmedPhone },
  });

  return user;
}

export async function checkoutCycle(qrCode: string, userId: string) {
  const code = qrCode.trim().toUpperCase();
  const cycle = await prisma.cycle.findUnique({ where: { qrCode: code } });

  if (!cycle) throw new Error('Cycle not found');
  if (cycle.status !== 'AVAILABLE') {
    throw new Error(`This cycle is currently ${cycle.status.replace('_', ' ').toLowerCase()}`);
  }

  const alreadyRiding = await prisma.cycle.findFirst({
    where: { heldByUserId: userId, status: 'IN_USE' },
  });
  if (alreadyRiding) {
    throw new Error(`You already have ${alreadyRiding.qrCode}. Return it before unlocking another.`);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Rider profile not found. Sign in again.');

  const updatedCycle = await prisma.cycle.update({
    where: { qrCode: code },
    data: { status: 'IN_USE', heldByUserId: userId },
  });

  await prisma.auditLog.create({
    data: {
      cycleId: cycle.id,
      userId,
      startHubId: cycle.currentHubId,
      action: 'CHECKOUT',
    },
  });

  await prisma.ride.create({
    data: {
      cycleId: cycle.id,
      userId,
      qrCode: code,
      startHubId: cycle.currentHubId,
      status: 'ACTIVE',
    },
  });

  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true, cycle: updatedCycle };
}

export async function dropOffCycle(
  qrCode: string,
  targetHubId: string,
  userId: string,
  lat?: number,
  lng?: number,
  distanceMeters?: number
) {
  const code = qrCode.trim().toUpperCase();
  const cycle = await prisma.cycle.findUnique({ where: { qrCode: code } });

  if (!cycle) throw new Error('Cycle not found');
  if (cycle.status !== 'IN_USE') {
    throw new Error('This cycle is not on a ride. Unlock it first.');
  }
  if (cycle.heldByUserId && cycle.heldByUserId !== userId) {
    throw new Error('This cycle was checked out by someone else. Ask them to return it, or flag staff.');
  }

  const hub = await prisma.hub.findUnique({ where: { id: targetHubId } });
  if (!hub) throw new Error('Station not found');

  const occupied = await prisma.cycle.count({
    where: {
      currentHubId: targetHubId,
      status: { in: ['AVAILABLE', 'MAINTENANCE'] },
    },
  });
  if (occupied >= hub.capacity) {
    throw new Error(`${hub.name} is full (${hub.capacity} docks). Try the next nearest station.`);
  }

  const updatedCycle = await prisma.cycle.update({
    where: { qrCode: code },
    data: {
      status: 'AVAILABLE',
      currentHubId: targetHubId,
      latitude: lat ?? null,
      longitude: lng ?? null,
      heldByUserId: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      cycleId: cycle.id,
      userId,
      startHubId: cycle.currentHubId,
      endHubId: targetHubId,
      latitude: lat ?? null,
      longitude: lng ?? null,
      distanceMeters: distanceMeters && distanceMeters > 0 ? distanceMeters : null,
      action: 'DROP_OFF',
    },
  });

  await completeActiveRide(cycle.id, {
    endHubId: targetHubId,
    distanceMeters,
    lat,
    lng,
  });

  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true, cycle: updatedCycle };
}

export async function reportFault(
  qrCode: string,
  userId: string,
  issueNotes: string,
  lat?: number,
  lng?: number,
  issuePhotoDataUrl?: string
) {
  const code = qrCode.trim().toUpperCase();
  const notes = issueNotes.trim();
  const cycle = await prisma.cycle.findUnique({ where: { qrCode: code } });

  if (!cycle) throw new Error('Cycle not found');
  if (!notes) throw new Error('Please describe the issue so staff can find it.');
  if (cycle.status === 'IN_USE' && cycle.heldByUserId && cycle.heldByUserId !== userId) {
    throw new Error('This cycle was checked out by someone else. Ask them to report the fault, or flag staff.');
  }

  let issuePhotoUrl: string | null = null;
  if (issuePhotoDataUrl) {
    const { saveUploadDataUrl } = await import('@/lib/uploads');
    issuePhotoUrl = await saveUploadDataUrl(issuePhotoDataUrl, 'faults');
  }

  // Claude classifies the report (and the photo, when one was attached) so
  // staff get category, urgency and a safe-to-ride verdict rather than a raw
  // note. Never throws: falls back to a keyword classifier.
  const triage = await triageFaultReport(notes, code, issuePhotoUrl);

  const updatedCycle = await prisma.cycle.update({
    where: { qrCode: code },
    data: {
      status: 'MAINTENANCE',
      issueNotes: notes,
      issuePhotoUrl,
      repairPhotoUrl: null,
      faultCategory: triage.category,
      faultSeverity: triage.severity,
      safeToRide: triage.safeToRide,
      faultSummary: triage.summary,
      triagedAt: new Date(),
      latitude: lat ?? null,
      longitude: lng ?? null,
      heldByUserId: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      cycleId: cycle.id,
      userId,
      startHubId: cycle.currentHubId,
      latitude: lat ?? null,
      longitude: lng ?? null,
      action: 'REPORT_FAULT',
    },
  });

  await completeActiveRide(cycle.id, { lat, lng });

  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true, cycle: updatedCycle, triage };
}

export async function repairCycle(qrCode: string, targetHubId: string, repairPhotoDataUrl: string) {
  const code = qrCode.trim().toUpperCase();
  const cycle = await prisma.cycle.findUnique({ where: { qrCode: code } });

  if (!cycle) throw new Error('Cycle not found');
  if (cycle.status !== 'MAINTENANCE') {
    throw new Error('Only faulted cycles can be marked repaired.');
  }
  if (!repairPhotoDataUrl) {
    throw new Error('Take a photo of the repaired cycle to confirm.');
  }

  const hub = await prisma.hub.findUnique({ where: { id: targetHubId } });
  if (!hub) throw new Error('Station not found');

  const occupied = await prisma.cycle.count({
    where: {
      currentHubId: targetHubId,
      status: { in: ['AVAILABLE', 'MAINTENANCE'] },
      NOT: { id: cycle.id },
    },
  });
  if (occupied >= hub.capacity) {
    throw new Error(`${hub.name} is full. Choose another station.`);
  }

  const { saveUploadDataUrl } = await import('@/lib/uploads');
  const repairPhotoUrl = await saveUploadDataUrl(repairPhotoDataUrl, 'repairs');

  const updatedCycle = await prisma.cycle.update({
    where: { qrCode: code },
    data: {
      status: 'AVAILABLE',
      currentHubId: targetHubId,
      issueNotes: null,
      issuePhotoUrl: null,
      repairPhotoUrl,
      faultCategory: null,
      faultSeverity: null,
      safeToRide: null,
      faultSummary: null,
      triagedAt: null,
      heldByUserId: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      cycleId: cycle.id,
      userId: 'admin-staff',
      startHubId: targetHubId,
      action: 'REPAIRED',
    },
  });

  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true, cycle: updatedCycle };
}

// Maintenance queue ordered by triaged urgency rather than report time:
// unsafe cycles first, then by severity, then oldest-reported within a band.
export async function getMaintenanceCycles() {
  const cycles = await prisma.cycle.findMany({
    where: { status: 'MAINTENANCE' },
    include: { currentHub: true },
  });

  return cycles.sort((a, b) => {
    const aUnsafe = a.safeToRide === false ? 1 : 0;
    const bUnsafe = b.safeToRide === false ? 1 : 0;
    if (aUnsafe !== bUnsafe) return bUnsafe - aUnsafe;

    const aRank = a.faultSeverity ? SEVERITY_RANK[a.faultSeverity] : 0;
    const bRank = b.faultSeverity ? SEVERITY_RANK[b.faultSeverity] : 0;
    if (aRank !== bRank) return bRank - aRank;

    return a.updatedAt.getTime() - b.updatedAt.getTime();
  });
}

/**
 * Cycles out of service, newest report first — the staff Overview queue.
 *
 * Deliberately a different order from `getMaintenanceCycles`, which sorts by
 * danger so the most urgent repair is worked on first. That is the right order
 * for the Cycles tab, where someone is choosing what to fix. Overview answers a
 * different question — what has just come in — so it is newest first, and the
 * severity is shown on each row rather than encoded in the position.
 *
 * A fault lives on the cycle row and is overwritten by the next report, so
 * `updatedAt` is the time of the current fault and there is no history of
 * previous ones. Recording each report as its own row, with the rider who
 * raised it, would need a fault-report table; this reads what exists today.
 */
export async function getRepairQueue(limit = 40) {
  const cycles = await prisma.cycle.findMany({
    where: { status: 'MAINTENANCE' },
    include: { currentHub: true },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  return cycles.map((c) => ({
    id: c.id,
    qrCode: c.qrCode,
    // The AI summary when triage ran, the rider's own words when it did not.
    // Never both: staff reading a queue want one line per cycle.
    summary: c.faultSummary ?? c.issueNotes,
    notes: c.issueNotes,
    severity: c.faultSeverity,
    category: c.faultCategory,
    safeToRide: c.safeToRide,
    photoUrl: c.issuePhotoUrl,
    hubName: c.currentHub?.name ?? null,
    reportedAt: c.updatedAt,
  }));
}

export async function pingRideTrack(
  qrCode: string,
  userId: string,
  lat: number,
  lng: number,
  distanceMeters: number,
  path: [number, number][]
) {
  const code = qrCode.trim().toUpperCase();
  const cycle = await prisma.cycle.findUnique({ where: { qrCode: code } });
  if (!cycle || cycle.status !== 'IN_USE' || cycle.heldByUserId !== userId) {
    return { ok: false };
  }

  const ride = await prisma.ride.findFirst({
    where: { cycleId: cycle.id, status: 'ACTIVE' },
    orderBy: { startedAt: 'desc' },
  });
  if (!ride) return { ok: false };

  await prisma.ride.update({
    where: { id: ride.id },
    data: {
      lastLat: lat,
      lastLng: lng,
      distanceMeters,
    },
  });
  await replaceRidePathPoints(ride.id, path);
  await prisma.cycle.update({
    where: { id: cycle.id },
    data: { latitude: lat, longitude: lng },
  });
  return { ok: true };
}

export async function getActiveRides() {
  const rides = await prisma.ride.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, phone: true } },
      pathPoints: {
        orderBy: { seq: 'asc' },
        select: { latitude: true, longitude: true },
      },
    },
  });

  return rides.map((ride) => ({
    id: ride.id,
    qrCode: ride.qrCode,
    userId: ride.userId,
    riderName: ride.user.name,
    riderPhone: ride.user.phone,
    distanceMeters: ride.distanceMeters,
    lastLat: ride.lastLat,
    lastLng: ride.lastLng,
    path: ride.pathPoints.map(
      (point): [number, number] => [point.latitude, point.longitude]
    ),
    updatedAt: ride.updatedAt.toISOString(),
    startedAt: ride.startedAt.toISOString(),
  }));
}

/**
 * The slice of the dashboard that changes minute to minute, in one round trip.
 *
 * The overview tab is a server component, so without this its charts were
 * frozen at the values present when the page was rendered — only the live-rides
 * map polled. Grouping these three means the stat tiles and the demand curve
 * move together rather than tearing against each other between intervals.
 */
export async function getLiveOverview() {
  const [summary, demand, balances] = await Promise.all([
    getFleetSummary(),
    getTodayDemand(),
    getHubBalances(),
  ]);
  return { summary, demand, balances };
}
