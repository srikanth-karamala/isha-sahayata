// The shuttle routes, from the ashram's published route list — the same
// source as the confirmed entries in lib/ashram-knowledge.ts.
//
// Only the routes and their stops are recorded here. The hours are left null
// because nobody has read them off the board at the shuttle stand, and a
// guessed timetable is the one thing this feature must not ship: someone who
// waits at a stop for a service that stopped running an hour ago has been
// misled by the app.
//
// Stop coordinates are likewise absent. Only the six cycle stands have been
// surveyed. The list view does not need them; the map layer will.
import { PrismaClient, ShuttleKind } from '@prisma/client';

const prisma = new PrismaClient();

/** Stops in the order the route calls at them. */
const ROUTES: { name: string; kind: ShuttleKind; stops: string[] }[] = [
  { name: 'Sarpa Vasal – Adiyogi', kind: 'BUGGY', stops: ['Sarpa Vasal', 'Adiyogi'] },
  // Kalabhairava first: coming south from Sarpa Vasal it is 811m out against
  // Adiyogi's 866m, and Srikanth confirmed the order against the campus on 23
  // September. Stored the other way round until then, which drew the route
  // backwards on the map.
  { name: 'Kalabhairava – Adiyogi', kind: 'BUGGY', stops: ['Kalabhairava', 'Adiyogi'] },
  {
    // Brahmaputra is 73m from Welcome Point and Nalanda 132m, so the buggy
    // reaches Brahmaputra first. Also stored backwards until 23 September.
    name: 'Welcome Point – Brahmaputra – Nalanda',
    kind: 'BUGGY',
    stops: ['Welcome Point', 'Brahmaputra', 'Nalanda'],
  },
  {
    name: 'Welcome Point – Isha Home School',
    kind: 'BUGGY',
    stops: ['Welcome Point', 'Isha Home School'],
  },
  {
    name: 'Welcome Point – Shivapadam 3 & 4',
    kind: 'BUGGY',
    stops: ['Welcome Point', 'Shivapadam 3', 'Shivapadam 4'],
  },
  { name: 'Bullock cart · Sarpa Vasal – Adiyogi', kind: 'BULLOCK', stops: ['Sarpa Vasal', 'Adiyogi'] },
  {
    name: 'Bullock cart · Welcome Point – Metal Bridge',
    kind: 'BULLOCK',
    stops: ['Welcome Point', 'Metal Bridge near Bhiksha Hall'],
  },
];

/** Notes for the stops whose names are not self-explanatory on a sign. */
const NOTES: Record<string, string> = {
  'Metal Bridge near Bhiksha Hall': 'The footbridge beside the dining hall.',
  'Welcome Point': 'Where most routes begin.',
};

async function main() {
  await prisma.shuttleRouteStop.deleteMany();
  await prisma.shuttleRoute.deleteMany();
  await prisma.shuttleStop.deleteMany();

  const names = [...new Set(ROUTES.flatMap((r) => r.stops))];
  const stops = new Map<string, string>();
  for (const name of names) {
    const row = await prisma.shuttleStop.create({
      data: { name, note: NOTES[name] ?? null },
    });
    stops.set(name, row.id);
  }
  console.log(`created ${stops.size} stops`);

  for (const r of ROUTES) {
    const route = await prisma.shuttleRoute.create({
      data: { name: r.name, kind: r.kind },
    });
    for (let i = 0; i < r.stops.length; i++) {
      await prisma.shuttleRouteStop.create({
        data: { routeId: route.id, stopId: stops.get(r.stops[i])!, position: i },
      });
    }
  }
  console.log(`created ${ROUTES.length} routes`);
}

main().finally(() => prisma.$disconnect());
