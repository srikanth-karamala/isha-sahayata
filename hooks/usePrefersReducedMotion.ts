'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the visitor has asked for reduced motion, kept current.
 *
 * SplashScreen reads the media query once, which is right for something that
 * decides a 1.2-second hold and is then gone. An animation that runs for as
 * long as a tab is open has to notice the preference changing — someone who
 * turns it on mid-session is asking for the motion to stop now, not on the
 * next reload.
 *
 * useSyncExternalStore rather than useState plus an effect: the preference is
 * a value owned outside React, which is precisely what this hook is for, and
 * it avoids the cascading render that setting state in an effect body causes.
 * The server snapshot is false because the query cannot be read while
 * rendering there, and assuming true would suppress motion for everyone on
 * the first frame.
 */
const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia?.(QUERY);
  if (!query) return () => {};
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia?.(QUERY).matches ?? false;
}

function getServerSnapshot(): boolean {
  return false;
}

export default function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
