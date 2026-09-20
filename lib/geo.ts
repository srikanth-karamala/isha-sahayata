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
  const [lat1, lng1] = from;
  const [lat2, lng2] = to;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  const deg = (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
  const points = [
    'north', 'north-east', 'east', 'south-east',
    'south', 'south-west', 'west', 'north-west',
  ];
  return points[Math.round(deg / 45) % 8];
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
