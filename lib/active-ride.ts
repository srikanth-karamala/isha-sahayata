const STORAGE_KEY = 'yc_active_ride';

export interface StoredRide {
  qrCode: string;
  startedAt: number;
}

export function loadStoredRide(): StoredRide | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRide;
    if (parsed?.qrCode) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveStoredRide(ride: StoredRide) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ride));
}

export function clearStoredRide() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
