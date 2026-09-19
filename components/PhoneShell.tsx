'use client';

import type { ReactNode } from 'react';

/** Desktop/tablet: iPhone bezel. Real phones: full-bleed screen. */
export default function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="yc-phone-stage">
      <div className="yc-phone" aria-label="Isha Sahayata mobile prototype">
        <div className="yc-phone-bezel" aria-hidden>
          <div className="yc-phone-island" />
          <div className="yc-phone-speaker" />
        </div>
        <div className="yc-phone-screen">{children}</div>
        <div className="yc-phone-home" aria-hidden />
      </div>
    </div>
  );
}
