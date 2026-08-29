import type { HubSummary } from './types';
import { availableCount, occupiedCount } from './types';

/** Ashram core, near Spanda Hall (OSM). */
export const CAMPUS_CENTER: [number, number] = [10.9799, 76.7369];

/** Rider must be about this close to confirm drop-off by slide. */
export const DROP_OFF_RADIUS_M = 75;

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
