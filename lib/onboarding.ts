// Whether this device has seen the "what is Sahayata" introduction.
//
// Deliberately separate from rider identity: the introduction explains what
// the app is, which someone needs before they are asked for a name and phone.
// Keeping the two apart means a rider who clears their identity (or is asked
// for it again) does not have to sit through the introduction a second time.

const STORAGE_KEY = 'sahayata_onboarded_v1';

/**
 * Demo mode: show the introduction on every launch instead of once per device.
 *
 * Set NEXT_PUBLIC_ONBOARDING_ALWAYS=1 to turn this on. It exists because the
 * introduction is the part of the app worth showing off, and "once per device"
 * means it can only ever be demonstrated on a browser nobody has opened yet —
 * clearing site data between runs is a poor way to give a demo.
 *
 * An environment flag rather than a hardcoded change so that demo behaviour
 * cannot reach real users by accident: a visitor who is made to re-read the
 * introduction on every single launch will stop reading it. Read at module
 * load because NEXT_PUBLIC_ values are inlined at build time; changing it
 * requires a rebuild, which is the right friction for a mode that should be
 * deliberate.
 */
export const ALWAYS_SHOW_ONBOARDING =
  process.env.NEXT_PUBLIC_ONBOARDING_ALWAYS === '1';

export function hasSeenOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  // In demo mode nothing counts as seen, so the introduction returns on every
  // load — including a plain refresh.
  if (ALWAYS_SHOW_ONBOARDING) return false;
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
  // Recording it in demo mode would be harmless but misleading: the flag is
  // what decides, so leave storage untouched and the intent stays legible.
  if (ALWAYS_SHOW_ONBOARDING) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Nothing to do — the introduction is a nicety, not a gate.
  }
}

/**
 * Forget that the introduction was seen, so the next launch shows it again.
 *
 * The way to demonstrate the introduction on a build that is not in demo
 * mode — including the one people are testing on right now.
 */
export function resetOnboarding() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}
