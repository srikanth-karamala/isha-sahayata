import { prisma } from '@/lib/prisma';

/**
 * Fleet analytics for the admin dashboard.
 *
 * Everything here is derived from data the app already records — Ride rows and
 * the AuditLog — but never read back until now. These aggregates answer the
 * three questions a coordinator actually has: when are cycles in demand, where
 * do they pile up, and which hubs are about to run dry.
 *
 * Ride durations and distances come from the Ride model, which tracks real GPS
 * samples, so these are measured rather than estimated.
 */

export interface HourlyDemand {
  hour: number;
  rides: number;
}

export interface HubBalance {
  id: string;
  name: string;
  capacity: number;
  available: number;
  inUse: number;
  maintenance: number;
  /** Departures minus arrivals over the last 24h — positive means draining. */
  netOutflow: number;
  fillRatio: number;
  status: 'EMPTY' | 'LOW' | 'HEALTHY' | 'FULL';
}

export interface FleetSummary {
  totalCycles: number;
  available: number;
  inUse: number;
  maintenance: number;
  ridesToday: number;
  ridesThisWeek: number;
  avgRideMinutes: number;
  kmThisWeek: number;
  unsafeCycles: number;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Headline fleet numbers for the dashboard stat row. */
export async function getFleetSummary(): Promise<FleetSummary> {
  const [cycles, ridesToday, weekRides, unsafeCycles] = await Promise.all([
    prisma.cycle.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.ride.count({ where: { startedAt: { gte: startOfToday() } } }),
    prisma.ride.findMany({
      where: { startedAt: { gte: daysAgo(7) }, status: 'COMPLETED' },
      select: { startedAt: true, endedAt: true, distanceMeters: true },
    }),
    prisma.cycle.count({ where: { safeToRide: false } }),
  ]);

  const byStatus = Object.fromEntries(
    cycles.map((c) => [c.status, c._count._all])
  );

  const durations = weekRides
    .filter((r) => r.endedAt)
    .map((r) => (r.endedAt!.getTime() - r.startedAt.getTime()) / 60_000)
    // Guard against clock skew or abandoned rides distorting the average.
    .filter((m) => m > 0 && m < 180);

  const avgRideMinutes =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

  const kmThisWeek =
    Math.round(
      (weekRides.reduce((sum, r) => sum + (r.distanceMeters ?? 0), 0) / 1000) * 10
    ) / 10;

  return {
    totalCycles: cycles.reduce((sum, c) => sum + c._count._all, 0),
    available: byStatus['AVAILABLE'] ?? 0,
    inUse: byStatus['IN_USE'] ?? 0,
    maintenance: byStatus['MAINTENANCE'] ?? 0,
    ridesToday,
    ridesThisWeek: weekRides.length,
    avgRideMinutes,
    kmThisWeek,
    unsafeCycles,
  };
}

/**
 * Average rides per hour of day across the last `days` days. Averaging rather
 * than summing keeps the shape readable regardless of how much history exists.
 */
export async function getHourlyDemand(days = 14): Promise<HourlyDemand[]> {
  const rides = await prisma.ride.findMany({
    where: { startedAt: { gte: daysAgo(days) } },
    select: { startedAt: true },
  });

  const buckets = new Array(24).fill(0);
  for (const ride of rides) {
    buckets[ride.startedAt.getHours()]++;
  }

  return buckets.map((count, hour) => ({
    hour,
    rides: Math.round((count / days) * 10) / 10,
  }));
}

/**
 * Rides started in each hour of *today*, as whole counts.
 *
 * The averaged 14-day series is the right shape for planning but the wrong one
 * for watching: dividing by 14 means a ride that just happened moves its bar by
 * 0.07, which rounds away to nothing. Staff watching the console during a busy
 * hour need to see the count move, so this counts today's rides directly.
 *
 * Hours later than now are returned as 0 rather than omitted, so the curve
 * keeps a stable 24-point x-axis instead of rescaling as the day fills in.
 */
export async function getTodayDemand(): Promise<HourlyDemand[]> {
  const rides = await prisma.ride.findMany({
    where: { startedAt: { gte: startOfToday() } },
    select: { startedAt: true },
  });

  const buckets = new Array(24).fill(0);
  for (const ride of rides) {
    buckets[ride.startedAt.getHours()]++;
  }

  return buckets.map((count, hour) => ({ hour, rides: count }));
}

/**
 * Current occupancy and recent flow direction per hub. netOutflow is measured
 * over the last 24h, which is what makes rebalancing advice actionable: a hub
 * that is low *and* draining needs cycles before one that is low but refilling.
 */
export async function getHubBalances(): Promise<HubBalance[]> {
  const since = new Date(Date.now() - 24 * 3600_000);

  const [hubs, departures, arrivals] = await Promise.all([
    prisma.hub.findMany({ include: { cycles: true } }),
    prisma.auditLog.groupBy({
      by: ['startHubId'],
      where: { action: 'CHECKOUT', createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.auditLog.groupBy({
      by: ['endHubId'],
      where: { action: 'DROP_OFF', createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  const outMap = new Map(departures.map((d) => [d.startHubId, d._count._all]));
  const inMap = new Map(
    arrivals.filter((a) => a.endHubId).map((a) => [a.endHubId!, a._count._all])
  );

  return hubs.map((hub) => {
    const available = hub.cycles.filter((c) => c.status === 'AVAILABLE').length;
    const inUse = hub.cycles.filter((c) => c.status === 'IN_USE').length;
    const maintenance = hub.cycles.filter((c) => c.status === 'MAINTENANCE').length;
    const fillRatio = hub.capacity > 0 ? available / hub.capacity : 0;

    let status: HubBalance['status'] = 'HEALTHY';
    if (available === 0) status = 'EMPTY';
    else if (fillRatio < 0.15) status = 'LOW';
    else if (fillRatio > 0.9) status = 'FULL';

    return {
      id: hub.id,
      name: hub.name,
      capacity: hub.capacity,
      available,
      inUse,
      maintenance,
      netOutflow: (outMap.get(hub.id) ?? 0) - (inMap.get(hub.id) ?? 0),
      fillRatio,
      status,
    };
  });
}
