'use server';

import { prisma } from '@/lib/prisma';

/**
 * The shuttle routes, each with its stops in order.
 *
 * Ordered so the buggies come before the bullock carts, and alphabetically
 * within each — there is no meaningful frequency or priority to sort by, and
 * a stable order is worth more than an arbitrary one that shifts.
 */
export async function getShuttleRoutes() {
  const routes = await prisma.shuttleRoute.findMany({
    include: {
      stops: {
        orderBy: { position: 'asc' },
        include: { stop: true },
      },
    },
    orderBy: [{ kind: 'asc' }, { name: 'asc' }],
  });

  return routes.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    hours: r.hours,
    hoursChecked: r.hoursCheckedAt !== null,
    stops: r.stops.map((s) => ({
      id: s.stop.id,
      name: s.stop.name,
      note: s.stop.note,
      /** True once someone has surveyed it; the map layer waits on this. */
      located: s.stop.latitude !== null && s.stop.longitude !== null,
      // Passed through for the map. Null until someone surveys the stop —
      // never estimated, so a route with an unlocated stop simply is not
      // drawn rather than being drawn through a guess.
      latitude: s.stop.latitude,
      longitude: s.stop.longitude,
    })),
  }));
}

export type ShuttleRoute = Awaited<ReturnType<typeof getShuttleRoutes>>[number];

/**
 * Which routes call at a given stop, for answering "what can I catch from
 * Welcome Point". Matched on the name because that is what a visitor reads
 * off a sign, not an id.
 */
export async function getRoutesFromStop(stopName: string) {
  const routes = await getShuttleRoutes();
  return routes.filter((r) =>
    r.stops.some((s) => s.name.toLowerCase() === stopName.toLowerCase())
  );
}
