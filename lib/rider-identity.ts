// Client-side helpers for the lightweight rider identity stored after
// getOrCreateUser() runs server-side. No password — just enough to tie
// checkouts/returns/faults to a real person on this device.

export interface RiderIdentity {
  id: string;
  name: string;
  phone: string;
}

const STORAGE_KEY = 'yc_rider_identity';

export function loadRiderIdentity(): RiderIdentity | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.id && parsed?.name && parsed?.phone) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveRiderIdentity(identity: RiderIdentity) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

export function clearRiderIdentity() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
