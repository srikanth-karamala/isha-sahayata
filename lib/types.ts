export type CycleStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE';

export interface CycleSummary {
  id: string;
  qrCode: string;
  status: string;
}

export interface HubSummary {
  id: string;
  name: string;
  capacity: number;
  latitude: number | null;
  longitude: number | null;
  cycles: CycleSummary[];
}

export interface CycleDetail {
  id: string;
  qrCode: string;
  status: string;
  currentHubId: string;
  heldByUserId: string | null;
  issueNotes: string | null;
  currentHub: {
    id: string;
    name: string;
  } | null;
  /** Present when cycle is IN_USE — who currently holds it */
  heldByUser: {
    name: string;
    phone: string;
  } | null;
}

export function availableCount(hub: HubSummary) {
  return hub.cycles.filter((cycle) => cycle.status === 'AVAILABLE').length;
}

export function faultCount(hub: HubSummary) {
  return hub.cycles.filter((cycle) => cycle.status === 'MAINTENANCE').length;
}

export function occupiedCount(hub: HubSummary) {
  return hub.cycles.filter((cycle) => cycle.status !== 'IN_USE').length;
}

export interface LiveRide {
  id: string;
  qrCode: string;
  userId: string;
  riderName: string;
  riderPhone: string;
  distanceMeters: number;
  lastLat: number | null;
  lastLng: number | null;
  path: [number, number][];
  updatedAt: string;
  startedAt: string;
}
