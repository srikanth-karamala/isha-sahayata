/**
 * Coordinates for the ten shuttle stops.
 *
 * Supplied by Srikanth on 23 September 2026, read off Google Maps. Until then
 * every stop had null latitude and longitude — only the six cycle stands had
 * ever been surveyed — which is why the Ride tab could show a list of routes
 * but not a map of them.
 *
 * These are map readings rather than positions taken standing at each stop, so
 * they are good enough to draw a network whose orientation and relative
 * distances are right, which is what a route diagram needs. Treat them as
 * accurate to the building rather than to the stop sign.
 *
 * Run with: pnpm db:shuttle-coords
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COORDS: Record<string, [number, number]> = {
  'Welcome Point': [10.9812, 76.7365],
  'Sarpa Vasal': [10.98, 76.742],
  'Adiyogi': [10.97236, 76.74045],
  'Kalabhairava': [10.9728, 76.7408],
  'Nalanda': [10.98157, 76.73535],
  'Brahmaputra': [10.9809, 76.7359],
  'Isha Home School': [10.98427, 76.73725],
  'Shivapadam 3': [10.984, 76.739],
  'Shivapadam 4': [10.983, 76.74],
  'Metal Bridge near Bhiksha Hall': [10.9814, 76.737],
};

async function main() {
  for (const [name, [latitude, longitude]] of Object.entries(COORDS)) {
    const res = await prisma.shuttleStop.updateMany({
      where: { name },
      data: { latitude, longitude },
    });
    if (res.count === 0) {
      // A renamed stop would silently keep its null coordinates and drop out
      // of the map, so this is loud rather than ignored.
      console.warn(`  no stop named "${name}" — coordinate not applied`);
    }
  }

  const all = await prisma.shuttleStop.findMany({ orderBy: { name: 'asc' } });
  const located = all.filter((s) => s.latitude !== null);
  console.log(`${located.length} of ${all.length} shuttle stops located.`);
  for (const s of all) {
    console.log(
      `  ${s.name.padEnd(32)} ${
        s.latitude === null ? 'NOT LOCATED' : `${s.latitude}, ${s.longitude}`
      }`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
