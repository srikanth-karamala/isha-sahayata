import {
  AuditAction,
  Cycle,
  CycleStatus,
  PrismaClient,
  RideStatus,
  User,
} from '@prisma/client';
import { fallbackTriage } from '../lib/triage';

const prisma = new PrismaClient();

/**
 * Generates a demonstration fleet and three weeks of ride history on top of the
 * hubs created by prisma/seed.ts.
 *
 * The history is synthetic but deliberately not uniform: campus cycle demand
 * follows the daily rhythm (morning sadhana, the midday meal at Biksha Hall,
 * evening return to the accommodation blocks), and the analytics and
 * rebalancing views are only meaningful if the data carries those peaks and
 * directional flows. Rides are generated from per-hour weights and per-hub
 * origin/destination preferences rather than at random, and each ride writes a
 * real Ride row with a measured distance so the dashboard reports measured
 * values rather than estimates.
 *
 * Run with: pnpm db:history
 * This clears rides, audit logs and cycles (hubs are preserved).
 */

const DAYS_OF_HISTORY = 21;
const FLEET_SIZE = 60;

/** Share of the fleet initially parked at each hub, by name. */
const INITIAL_SHARE: Record<string, number> = {
  'Main Gate': 0.27,
  'Spanda Hall': 0.2,
  'Opposite Spanda Hall': 0.13,
  'Biksha Hall': 0.17,
  Kondrai: 0.11,
  'Sivapadam 2': 0.12,
};

/** Relative ride volume by hour of day (0-23). */
const HOURLY_WEIGHTS = [
  0.2, 0.1, 0.1, 0.3, 2.5, 4.0, 3.2, 2.4, 2.0, 1.8, 1.6, 2.2,
  4.5, 3.8, 1.9, 1.7, 2.0, 2.8, 3.6, 3.0, 1.6, 0.9, 0.5, 0.3,
];

function destinationWeights(hour: number, hubNames: string[]): number[] {
  const isMeal = hour === 12 || hour === 13 || hour === 7;
  const isEarly = hour >= 4 && hour <= 6;
  const isEvening = hour >= 17 && hour <= 20;
  // Visitors arrive through the Main Gate late morning and leave late evening,
  // so the gate is a strong destination only inside that window — otherwise it
  // becomes a sink that swallows the whole fleet over three weeks.
  const isArrival = hour >= 9 && hour <= 11;

  return hubNames.map((name) => {
    if (isMeal && name === 'Biksha Hall') return 6;
    if (isEarly && (name === 'Spanda Hall' || name === 'Opposite Spanda Hall')) return 5;
    if (isEvening && (name === 'Kondrai' || name === 'Sivapadam 2')) return 4;
    if (name === 'Main Gate') return isArrival ? 3 : 0.5;
    return 1;
  });
}

/** Mirrors the destination bias so the fleet circulates instead of draining. */
function originWeights(hour: number, hubNames: string[]): number[] {
  const afterMeal = hour === 13 || hour === 14 || hour === 8;
  const isEarly = hour >= 4 && hour <= 7;
  const isEvening = hour >= 18 && hour <= 21;

  return hubNames.map((name) => {
    if (name === 'Main Gate') return isEarly || isEvening ? 4 : 1.5;
    if (afterMeal && name === 'Biksha Hall') return 5;
    if (isEvening && (name === 'Spanda Hall' || name === 'Opposite Spanda Hall')) return 3;
    return 1;
  });
}

function weightedPick(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

/** Straight-line distance in metres between two lat/lng points. */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const RIDER_NAMES = [
  'Anand', 'Meera', 'Ravi', 'Lakshmi', 'Karthik', 'Divya', 'Suresh', 'Priya',
  'Vikram', 'Nandini', 'Arjun', 'Shanti', 'Rajesh', 'Kavitha', 'Ganesh',
];

const FAULT_REPORTS = [
  'Back brake barely works, had to drag my feet to stop near Biksha',
  'Chain came off twice on the slope to Kondrai',
  'Front tyre completely flat',
  'Gears keep skipping when I pedal hard',
  'Seat slips down whenever I sit, cannot adjust it',
  'Handlebar feels loose and wobbles when turning',
  'Bell is broken, no sound at all',
];

async function main() {
  const hubs = await prisma.hub.findMany();
  if (hubs.length === 0) {
    throw new Error('No hubs found. Run `pnpm db:seed` first to create stations.');
  }
  const hubNames = hubs.map((h) => h.name);

  console.log('Clearing rides, logs and cycles (hubs preserved)...');
  await prisma.ridePathPoint.deleteMany();
  await prisma.ride.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.cycle.deleteMany();
  await prisma.user.deleteMany();

  console.log(`Creating ${RIDER_NAMES.length} riders...`);
  const users: User[] = [];
  for (let i = 0; i < RIDER_NAMES.length; i++) {
    users.push(
      await prisma.user.create({
        data: {
          name: RIDER_NAMES[i],
          phone: `9${String(800000000 + i * 7919).slice(0, 9)}`,
        },
      })
    );
  }

  console.log(`Creating ${FLEET_SIZE} cycles...`);
  const cycles: Cycle[] = [];
  let n = 101;
  for (let i = 0; i < hubs.length; i++) {
    const share = INITIAL_SHARE[hubs[i].name] ?? 1 / hubs.length;
    const count =
      i === hubs.length - 1
        ? FLEET_SIZE - cycles.length
        : Math.round(FLEET_SIZE * share);

    for (let c = 0; c < count; c++) {
      cycles.push(
        await prisma.cycle.create({
          data: {
            qrCode: `ISHA-CYC-${n++}`,
            status: CycleStatus.AVAILABLE,
            currentHubId: hubs[i].id,
          },
        })
      );
    }
  }

  console.log(`Generating ${DAYS_OF_HISTORY} days of ride history...`);

  // A cycle can only be taken from the hub it was last left at.
  const cycleLocation = new Map<string, string>();
  for (const c of cycles) cycleLocation.set(c.id, c.currentHubId);

  const now = new Date();
  let rideCount = 0;

  for (let dayOffset = DAYS_OF_HISTORY - 1; dayOffset >= 0; dayOffset--) {
    const day = new Date(now);
    day.setDate(day.getDate() - dayOffset);

    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const dayVolume = isWeekend ? 1.35 : 1.0;

    for (let hour = 0; hour < 24; hour++) {
      if (dayOffset === 0 && hour > now.getHours()) break;

      // Overnight redistribution: staff return cycles from the outlying
      // accommodation hubs to the main hubs before dawn.
      if (hour === 3) {
        for (const hub of hubs) {
          const parked = cycles.filter((c) => cycleLocation.get(c.id) === hub.id);
          const overflow = parked.length - hub.capacity;
          if (overflow <= 0) continue;
          for (const c of parked.slice(0, overflow)) {
            const room = hubs.map((h) =>
              h.id === hub.id
                ? 0
                : Math.max(
                    0,
                    h.capacity -
                      cycles.filter((x) => cycleLocation.get(x.id) === h.id).length
                  )
            );
            if (room.every((r) => r === 0)) break;
            cycleLocation.set(c.id, hubs[weightedPick(room)].id);
          }
        }
      }

      const expected = HOURLY_WEIGHTS[hour] * dayVolume * 1.6;
      const rides = Math.round(expected + (Math.random() - 0.5) * expected * 0.6);

      for (let r = 0; r < rides; r++) {
        const startHub = hubs[weightedPick(originWeights(hour, hubNames))];
        const availableHere = cycles.filter(
          (c) => cycleLocation.get(c.id) === startHub.id
        );
        if (availableHere.length === 0) continue;

        const cycle =
          availableHere[Math.floor(Math.random() * availableHere.length)];
        const destWeights = destinationWeights(hour, hubNames).map((w, i) =>
          hubs[i].id === startHub.id ? 0 : w
        );
        const endHub = hubs[weightedPick(destWeights)];
        const user = users[Math.floor(Math.random() * users.length)];

        const startedAt = new Date(day);
        startedAt.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
        const minutes = 4 + Math.floor(Math.random() * 15);
        const endedAt = new Date(startedAt.getTime() + minutes * 60_000);
        if (endedAt > now) continue;

        // Real riders don't travel in straight lines; add a plausible overhead.
        const straight =
          startHub.latitude != null &&
          startHub.longitude != null &&
          endHub.latitude != null &&
          endHub.longitude != null
            ? haversineMeters(
                startHub.latitude,
                startHub.longitude,
                endHub.latitude,
                endHub.longitude
              )
            : 400;
        const distanceMeters = Math.round(straight * (1.15 + Math.random() * 0.35));

        await prisma.ride.create({
          data: {
            cycleId: cycle.id,
            userId: user.id,
            qrCode: cycle.qrCode,
            status: RideStatus.COMPLETED,
            distanceMeters,
            lastLat: endHub.latitude,
            lastLng: endHub.longitude,
            startHubId: startHub.id,
            endHubId: endHub.id,
            startedAt,
            endedAt,
          },
        });

        await prisma.auditLog.createMany({
          data: [
            {
              cycleId: cycle.id,
              userId: user.id,
              startHubId: startHub.id,
              action: AuditAction.CHECKOUT,
              createdAt: startedAt,
            },
            {
              cycleId: cycle.id,
              userId: user.id,
              startHubId: startHub.id,
              endHubId: endHub.id,
              latitude: endHub.latitude,
              longitude: endHub.longitude,
              distanceMeters,
              action: AuditAction.DROP_OFF,
              createdAt: endedAt,
            },
          ],
        });

        cycleLocation.set(cycle.id, endHub.id);
        rideCount++;
      }
    }
  }

  console.log('Settling final cycle positions...');
  for (const [cycleId, hubId] of cycleLocation.entries()) {
    await prisma.cycle.update({
      where: { id: cycleId },
      data: { currentHubId: hubId },
    });
  }

  // A few cycles are out for maintenance, pre-triaged with the offline
  // classifier so the queue has content before any live AI call is made.
  console.log('Flagging maintenance cycles with triage...');
  for (let i = 0; i < FAULT_REPORTS.length; i++) {
    const notes = FAULT_REPORTS[i];
    const triage = fallbackTriage(notes);
    const reportedAt = new Date(now.getTime() - Math.random() * 3 * 24 * 3600_000);
    const cycle = cycles[i];

    await prisma.cycle.update({
      where: { id: cycle.id },
      data: {
        status: CycleStatus.MAINTENANCE,
        issueNotes: notes,
        faultCategory: triage.category,
        faultSeverity: triage.severity,
        safeToRide: triage.safeToRide,
        faultSummary: triage.summary,
        triagedAt: reportedAt,
      },
    });

    await prisma.auditLog.create({
      data: {
        cycleId: cycle.id,
        userId: users[i % users.length].id,
        startHubId: cycleLocation.get(cycle.id)!,
        action: AuditAction.REPORT_FAULT,
        createdAt: reportedAt,
      },
    });
  }

  const [hubCount, cycleCount, rideTotal, logCount] = await Promise.all([
    prisma.hub.count(),
    prisma.cycle.count(),
    prisma.ride.count(),
    prisma.auditLog.count(),
  ]);

  console.log(
    `\nHistory seeded: ${hubCount} hubs, ${cycleCount} cycles, ${rideTotal} rides, ` +
      `${logCount} audit logs (${FAULT_REPORTS.length} cycles in maintenance).`
  );
  console.log(`Generated ${rideCount} rides across ${DAYS_OF_HISTORY} days.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
