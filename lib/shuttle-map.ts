// Geometry and colours for drawing the shuttle routes on the campus map.
//
// Everything here is pure: given the same routes and the same elapsed time it
// returns the same positions, so it can be tested without a map, a browser or
// a clock. The component that draws it owns all the MapLibre state.

import {
  bearingDegrees,
  cumulativeDistances,
  pathLengthMeters,
  pointAlongPath,
} from './geo';
import type { ShuttleRoute } from '@/app/shuttle-actions';

/**
 * Stable per-route colours.
 *
 * Seven, because there are seven routes and they overlap heavily on a campus
 * 1.5 km across — colour is the first thing that tells them apart. The app's
 * amber leads, and the rest are chosen to stay distinguishable against the
 * green canopy the imagery is mostly made of.
 *
 * Index by the route's sorted position rather than by the order the server
 * happened to return, so a route keeps its colour when another is added.
 */
export const ROUTE_COLORS = [
  '#f5b700',
  '#2f7d95',
  '#b5543a',
  '#5c7a3f',
  '#7a5ba6',
  '#c2803a',
  '#3f6d8f',
] as const;

export function routeColor(index: number): string {
  return ROUTE_COLORS[index % ROUTE_COLORS.length];
}

/** A route reduced to what the map needs, with the per-frame work precomputed. */
export interface RouteGeometry {
  routeId: string;
  name: string;
  kind: 'BUGGY' | 'BULLOCK';
  color: string;
  /** Only the stops that have been surveyed, in route order. */
  path: [number, number][];
  cumulative: number[];
  lengthMeters: number;
}

/**
 * Where a vehicle marker sits.
 *
 * `fixedAt` is the honest bit: null means this position came from the
 * illustrative loop rather than from a device, and the map derives its
 * "not live tracking" label from that absence. A separate boolean flag could
 * drift out of step with the data; a missing timestamp cannot.
 */
export interface ShuttleVehiclePosition {
  routeId: string;
  position: [number, number];
  bearing: number | null;
  fixedAt: Date | null;
}

/**
 * Build drawable geometry from the routes.
 *
 * Stops without coordinates are dropped rather than guessed, and a route left
 * with fewer than two located stops is omitted entirely — there is no line to
 * draw through one point, and inventing the other end would be exactly the
 * kind of unverified claim the rest of the app refuses to make.
 */
export function buildRouteGeometry(routes: ShuttleRoute[]): RouteGeometry[] {
  return routes
    .map((route, index) => {
      const path = route.stops
        .filter((s) => s.located && s.latitude != null && s.longitude != null)
        .map((s) => [s.latitude as number, s.longitude as number] as [number, number]);

      return {
        routeId: route.id,
        name: route.name,
        kind: route.kind,
        color: routeColor(index),
        path,
        cumulative: cumulativeDistances(path),
        lengthMeters: pathLengthMeters(path),
      };
    })
    .filter((g) => g.path.length >= 2 && g.lengthMeters > 0);
}

/**
 * How long a marker takes to traverse a route once, in milliseconds.
 *
 * Derived from the route's length at a walking-ish 2.5 m/s so a short hop does
 * not crawl and a long route does not race, then clamped so nothing is either
 * hypnotically slow or distractingly fast. This is emphatically not a claim
 * about how fast a buggy travels — it is a drawing rate, which is why the
 * caller must show the illustrative label.
 */
function loopDurationMs(lengthMeters: number): number {
  const raw = (lengthMeters / 2.5) * 1000;
  return Math.min(60_000, Math.max(12_000, raw));
}

/**
 * Where each route's illustrative marker sits at `elapsedMs`.
 *
 * Markers run out and back rather than teleporting from the end of a route to
 * its start: a dot that jumps backwards reads as a glitch, and these routes
 * are two-way anyway. Each route is offset within its own cycle so they do not
 * all set off together, which would look staged.
 */
export function illustrativeVehicles(
  geometry: RouteGeometry[],
  elapsedMs: number
): ShuttleVehiclePosition[] {
  const out: ShuttleVehiclePosition[] = [];

  for (let i = 0; i < geometry.length; i++) {
    const g = geometry[i];
    const duration = loopDurationMs(g.lengthMeters);
    // A stagger derived from the index, so the pattern is stable between
    // frames and between reloads.
    const offset = (duration / geometry.length) * i;
    const phase = ((elapsedMs + offset) % (duration * 2)) / duration;

    // 0->1 outbound, 1->0 back again.
    const progress = phase <= 1 ? phase : 2 - phase;
    const along = pointAlongPath(g.path, progress * g.lengthMeters, g.cumulative);
    if (!along) continue;

    out.push({
      routeId: g.routeId,
      position: along.position,
      // Reverse the heading on the return leg, so the marker points the way
      // it is actually moving.
      bearing:
        phase <= 1
          ? along.bearing
          : (along.bearing + 180) % 360,
      fixedAt: null,
    });
  }

  return out;
}

/** Every located stop across all routes, deduplicated by name. */
export function locatedStops(
  routes: ShuttleRoute[]
): { name: string; note: string | null; position: [number, number] }[] {
  const seen = new Map<string, { name: string; note: string | null; position: [number, number] }>();
  for (const route of routes) {
    for (const s of route.stops) {
      if (!s.located || s.latitude == null || s.longitude == null) continue;
      if (seen.has(s.name)) continue;
      seen.set(s.name, {
        name: s.name,
        note: s.note,
        position: [s.latitude, s.longitude],
      });
    }
  }
  return [...seen.values()];
}

/** Re-exported so callers do not need to reach into lib/geo for one helper. */
export { bearingDegrees };
