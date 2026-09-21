import type { HubSummary } from './types';
import { availableCount, occupiedCount } from './types';

/** Ashram core, near Spanda Hall (OSM). */
export const CAMPUS_CENTER: [number, number] = [10.9799, 76.7369];

/** Rider must be about this close to confirm drop-off by slide. */
export const DROP_OFF_RADIUS_M = 75;

/**
 * How far from the campus a reported position can be and still be believed.
 *
 * The campus is about 2 km across, so 25 km is generous — it covers Coimbatore
 * city and the airport, where someone might legitimately open the app on the
 * way in and want to see what is available before they arrive.
 *
 * Beyond that the position is not a long walk, it is wrong. A desktop browser
 * or a phone on Wi-Fi will happily report a city-level location hundreds of
 * kilometres away, derived from an IP address rather than a satellite, and
 * report it with complete confidence. Quoting a distance from such a fix
 * produced "Biksha Hall is 441 km south-west of you, about 5,653 minutes
 * walk" — which is arithmetically correct and useless.
 */
export const PLAUSIBLE_RADIUS_M = 25_000;

/**
 * Whether a reported position is close enough to the campus to be usable.
 *
 * Used to decide whether to quote distances at all. When this is false the
 * honest answer is to say nothing about distance rather than to compute one
 * from a fix that is not really where the person is standing.
 */
export function isPlausibleCampusPosition(pos: [number, number] | null): boolean {
  if (!pos) return false;
  const [lat, lng] = pos;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  // A swapped lat/lng lands outside these bounds, as does a null-island 0,0.
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return haversineMeters(pos, CAMPUS_CENTER) <= PLAUSIBLE_RADIUS_M;
}

/** MapLibre uses [lng, lat]. App GPS uses [lat, lng]. */
export function toLngLat(pos: [number, number]): [number, number] {
  return [pos[1], pos[0]];
}

export function haversineMeters(
  a: [number, number],
  b: [number, number]
) {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function hubPosition(hub: Pick<HubSummary, 'latitude' | 'longitude'>): [number, number] | null {
  if (hub.latitude == null || hub.longitude == null) return null;
  return [hub.latitude, hub.longitude];
}

export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function hubsByDistance(hubs: HubSummary[], from: [number, number] | null) {
  return [...hubs]
    .map((hub) => {
      const pos = hubPosition(hub);
      return {
        hub,
        meters: from && pos ? haversineMeters(from, pos) : Number.POSITIVE_INFINITY,
      };
    })
    .sort((a, b) => a.meters - b.meters);
}

/** Closest docks first, but docks with ready bikes beat empty ones — find a bike fast. */
export function hubsForPickup(hubs: HubSummary[], from: [number, number] | null) {
  return hubsByDistance(hubs, from).sort((a, b) => {
    const aHas = availableCount(a.hub) > 0 ? 0 : 1;
    const bHas = availableCount(b.hub) > 0 ? 0 : 1;
    if (aHas !== bHas) return aHas - bHas;
    return a.meters - b.meters;
  });
}

export function nearestOpenDock(hubs: HubSummary[], from: [number, number] | null) {
  return hubsByDistance(hubs, from).find(({ hub }) => occupiedCount(hub) < hub.capacity) ?? null;
}

export function isNearHub(
  hub: Pick<HubSummary, 'latitude' | 'longitude'>,
  from: [number, number] | null,
  radiusM = DROP_OFF_RADIUS_M
) {
  const pos = hubPosition(hub);
  if (!from || !pos) return false;
  return haversineMeters(from, pos) <= radiusM;
}

/**
 * Compass direction from one point to another, as a word.
 *
 * For the assistant rather than the map: "north-east of you" is something a
 * visitor can act on while walking, where a bearing in degrees is not. Eight
 * points is the right resolution — finer would imply a precision that phone
 * GPS under tree cover does not have.
 */
export function compassDirection(
  from: [number, number],
  to: [number, number]
): string {
  const points = [
    'north', 'north-east', 'east', 'south-east',
    'south', 'south-west', 'west', 'north-west',
  ];
  return points[Math.round(bearingDegrees(from, to) / 45) % 8];
}

/**
 * Initial bearing from one point to another, in degrees clockwise from true
 * north (0-360).
 *
 * compassDirection() buckets this into one of eight words, which is right for
 * prose a walker can act on and wrong for anything that needs the number — a
 * rotated map icon, for instance. Both now share this one formula rather than
 * keeping two copies of the spherical trigonometry.
 */
export function bearingDegrees(
  from: [number, number],
  to: [number, number]
): number {
  const [lat1, lng1] = from;
  const [lat2, lng2] = to;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/**
 * The point `t` of the way from `a` to `b`, with `t` clamped to 0-1.
 *
 * Linear in latitude and longitude rather than along a great circle. Over a
 * campus about 1.5 km across the difference is well under a centimetre —
 * far below anything the satellite imagery could show — so the simpler
 * arithmetic is the honest choice rather than a shortcut.
 */
export function interpolatePosition(
  a: [number, number],
  b: [number, number],
  t: number
): [number, number] {
  const k = Math.min(1, Math.max(0, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

/** Total length of a polyline in metres. Zero for fewer than two points. */
export function pathLengthMeters(path: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += haversineMeters(path[i - 1], path[i]);
  }
  return total;
}

/**
 * Distance from the start of the path to each of its vertices.
 *
 * Precomputed so a point can be found along a path without re-summing every
 * segment on each animation frame. The array is the same length as `path`,
 * and its first element is always 0.
 */
export function cumulativeDistances(path: [number, number][]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    out.push(out[i - 1] + haversineMeters(path[i - 1], path[i]));
  }
  return out;
}

/**
 * Position and heading at `meters` along a path.
 *
 * Returns null for a path of fewer than two points; `meters` is clamped to
 * the path's length. Pass `cumulative` from cumulativeDistances() when
 * calling this repeatedly — recomputing it is the entire cost of this
 * function, and in an animation loop it is the difference between a few
 * microseconds and a few milliseconds.
 *
 * The bearing is returned even where nothing currently rotates: it falls out
 * of the same computation for free, and it is what any later triangle or
 * sprite marker would need.
 */
export function pointAlongPath(
  path: [number, number][],
  meters: number,
  cumulative?: number[]
): { position: [number, number]; bearing: number } | null {
  if (path.length < 2) return null;
  const cum = cumulative ?? cumulativeDistances(path);
  const total = cum[cum.length - 1];
  if (total === 0) return { position: path[0], bearing: 0 };

  const target = Math.min(total, Math.max(0, meters));

  // Walk forward to the segment containing `target`. Paths here have a
  // handful of vertices, so a linear scan beats the bookkeeping of a binary
  // search and is easier to read.
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;

  const segStart = cum[i - 1];
  const segLength = cum[i] - segStart;
  const t = segLength === 0 ? 0 : (target - segStart) / segLength;

  return {
    position: interpolatePosition(path[i - 1], path[i], t),
    bearing: bearingDegrees(path[i - 1], path[i]),
  };
}

/**
 * Rough walking time, for phrasing rather than navigation.
 *
 * 1.3 m/s is an unhurried walk. Deliberately coarse: the campus paths are not
 * straight lines between coordinates, so a minute-accurate estimate would be
 * false precision. Under a minute reads as "less than a minute" rather than
 * "0 minutes".
 */
export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 1.3 / 60));
}
