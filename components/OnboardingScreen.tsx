'use client';

import { useState } from 'react';
import { Bike, Bus, Search, Info, ArrowRight } from 'lucide-react';

/**
 * The first thing a new arrival sees, between the splash and the map.
 *
 * Before this existed, a first-time user landed on a campus map with no idea
 * what the app was for or what else it could do — the services below the
 * Cycles tab were effectively undiscoverable. This names the app, says who it
 * is for, and lists what it can help with, one line per service.
 *
 * Two screens rather than one: "what is this" and "what can it do" are
 * different questions, and a single dense screen gets skipped. Both are
 * skippable — someone who just wants a cycle should not have to read.
 */

const SERVICES = [
  {
    Icon: Bike,
    title: 'Cycles',
    body: 'Find a yellow cycle at the nearest stand, scan to unlock, and leave it at any stand when you are done. Report one that is broken.',
  },
  {
    Icon: Bus,
    title: 'Ride',
    body: 'Shuttle timings and lifts across the campus, for when the distance is too far to cycle or you are carrying something.',
  },
  {
    Icon: Search,
    title: 'Lost & Found',
    body: 'Tell us what you lost, or hand in what you found. Sahayata matches the two and tells you when something turns up.',
  },
  {
    Icon: Info,
    title: 'Ashram Info',
    body: 'Timings, places, who to call, and answers to the questions most people arrive with.',
  },
] as const;

export default function OnboardingScreen({
  onDone,
  replayHint = false,
}: {
  onDone: () => void;
  /**
   * True when the app is in demo mode and this will reappear on every launch.
   * Labelled on screen so that whoever sees it knows the repetition is a
   * setting rather than a bug, and knows to turn it off before real use.
   */
  replayHint?: boolean;
}) {
  const [step, setStep] = useState<0 | 1>(0);

  return (
    <div className="yc-onboarding" role="dialog" aria-label="Welcome to Isha Sahayata">
      <div className="yc-onboarding-inner">
        {step === 0 ? (
          <>
            <div className="yc-onboarding-top">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sahayata-mark-64.png"
                alt=""
                aria-hidden="true"
                className="yc-onboarding-mark"
              />
              <p className="yc-eyebrow mt-5">Isha Yoga Center</p>
              <h1 className="yc-display text-[30px] mt-2 leading-tight">
                Welcome to Sahayata
              </h1>
              <p className="yc-body mt-4 max-w-[18rem]">
                Sahayata means help. It is a small app for everyone living and
                working on the campus — to get around, to find what has gone
                missing, and to know what is happening where.
              </p>
            </div>

            <div className="yc-onboarding-actions">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="yc-btn-primary w-full"
              >
                What can it help with
                <ArrowRight className="w-4 h-4" aria-hidden />
              </button>
              <button type="button" onClick={onDone} className="yc-btn-ghost mt-1.5">
                Skip
              </button>
              {replayHint && (
                <p className="yc-onboarding-demo">
                  Demo mode · this introduction shows on every launch
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="yc-onboarding-top is-list">
              <p className="yc-eyebrow">Four things</p>
              <h2 className="yc-display text-[24px] mt-1.5 mb-1">
                What Sahayata can help with
              </h2>

              <ul className="yc-onboarding-list">
                {SERVICES.map(({ Icon, title, body }) => (
                  <li key={title}>
                    <div className="yc-onboarding-icon" aria-hidden>
                      <Icon className="w-[1.1rem] h-[1.1rem]" strokeWidth={1.9} />
                    </div>
                    <div className="min-w-0">
                      <p className="yc-title yc-title-sm">{title}</p>
                      <p className="yc-body-sm mt-1">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="yc-onboarding-actions">
              <button type="button" onClick={onDone} className="yc-btn-primary w-full">
                Get started
                <ArrowRight className="w-4 h-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setStep(0)}
                className="yc-btn-ghost mt-1.5"
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
