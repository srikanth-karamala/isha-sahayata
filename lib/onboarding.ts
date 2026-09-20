// Whether this device has seen the "what is Sahayata" introduction.
//
// Deliberately separate from rider identity: the introduction explains what
// the app is, which someone needs before they are asked for a name and phone.
// Keeping the two apart means a rider who clears their identity (or is asked
// for it again) does not have to sit through the introduction a second time.

const STORAGE_KEY = 'sahayata_onboarded_v1';

export function hasSeenOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Private browsing and blocked site data both throw here. Treating that
    // as "seen" avoids showing the introduction on every single launch to
    // someone whose browser will never remember the answer.
    return true;
  }
}

export function markOnboardingSeen() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Nothing to do — the introduction is a nicety, not a gate.
  }
}
