'use client';

import { useEffect, useState } from 'react';

/**
 * Launch screen: the Isha mark and the app's name, held briefly while the
 * first data load settles, then faded out.
 *
 * It uses the app's own --serif token for the wordmark, so if the real Fedra
 * Serif files are ever added the name picks them up without a change here.
 */

const HOLD_MS = 1200;
const FADE_MS = 420;

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Respect a reduced-motion preference by skipping the hold entirely.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      onDone();
      return;
    }

    const fade = setTimeout(() => setLeaving(true), HOLD_MS);
    const done = setTimeout(onDone, HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div
      className={`yc-splash${leaving ? ' is-leaving' : ''}`}
      role="status"
      aria-label="Isha Sahayata is starting"
    >
      <div className="yc-splash-mark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/isha-logo.png" alt="" width={84} height={84} />
      </div>
      <p className="yc-splash-eyebrow">Isha Yoga Center</p>
      <h1 className="yc-splash-name">Isha Sahayata</h1>
      <p className="yc-splash-tag">सहायता &middot; assistance</p>
    </div>
  );
}
