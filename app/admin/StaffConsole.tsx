'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Bike, Search, ArrowLeft, LogOut } from 'lucide-react';
import { adminLogout } from './auth-actions';

export type StaffTab = 'overview' | 'cycles' | 'lost-found';

/**
 * Shell for the staff console: a sidebar rail, a greeting header, and the panel
 * for the selected tab.
 *
 * Three destinations rather than one long page, because a coordinator arrives
 * with a specific question — what needs doing this morning, which cycles are out
 * of service, has anyone handed in a lost bottle — and should not scroll past
 * two of those to reach the third.
 *
 * The rail is a left sidebar on desktop, where there is horizontal room to
 * spare and a persistent nav helps orientation, and collapses to a fixed bottom
 * bar on phones (see .s-side / .s-tabs in globals.css).
 */
export default function StaffConsole({
  maintenanceCount,
  unsafeCount,
  lostFoundCount,
  overview,
  cycles,
  lostFound,
}: {
  maintenanceCount: number;
  unsafeCount: number;
  lostFoundCount: number;
  overview: ReactNode;
  cycles: ReactNode;
  lostFound: ReactNode;
}) {
  const [tab, setTab] = useState<StaffTab>('overview');

  const tabs: {
    id: StaffTab;
    label: string;
    Icon: typeof Bike;
    count?: number;
    alert?: boolean;
  }[] = [
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
    {
      id: 'cycles',
      label: 'Cycles',
      Icon: Bike,
      count: maintenanceCount || undefined,
      alert: unsafeCount > 0,
    },
    {
      id: 'lost-found',
      label: 'Lost & Found',
      Icon: Search,
      count: lostFoundCount || undefined,
    },
  ];

  const panels: Record<StaffTab, ReactNode> = {
    overview,
    cycles,
    'lost-found': lostFound,
  };

  const heading: Record<StaffTab, { title: string; blurb: string }> = {
    overview: {
      title: 'Overview',
      blurb: 'What the fleet is doing right now, and what to do about it.',
    },
    cycles: {
      title: 'Cycles',
      blurb: 'Reported faults, triaged by danger, and live rides in progress.',
    },
    'lost-found': {
      title: 'Lost & Found',
      blurb: 'Open reports and the pairs the matcher thinks describe one object.',
    },
  };

  return (
    <div className="yc-staff min-h-dvh">
      <div className="s-shell">
        {/* Sidebar: brand, destinations, and the exits. */}
        <aside className="s-side">
          <div className="s-side-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/isha-logo.png"
              alt=""
              width={36}
              height={36}
              className="rounded-[0.7rem] shrink-0"
            />
            <div className="min-w-0">
              <p className="s-side-title">Isha Sahayata</p>
              <p className="s-side-sub">Staff console</p>
            </div>
          </div>

          <nav className="s-tabs" aria-label="Console sections">
            {tabs.map(({ id, label, Icon, count, alert }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`s-tab ${tab === id ? 'is-active' : ''}`}
                aria-current={tab === id ? 'page' : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="s-tab-label">{label}</span>
                {count != null && (
                  <span className={`s-tab-count ${alert ? 'is-alert' : ''}`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="s-side-foot">
            <Link href="/" className="s-btn s-btn-quiet w-full">
              <ArrowLeft className="w-4 h-4" />
              <span>Rider app</span>
            </Link>
            <form action={adminLogout}>
              <button type="submit" className="s-btn s-btn-quiet w-full">
                <LogOut className="w-4 h-4" />
                <span>Log out</span>
              </button>
            </form>
          </div>
        </aside>

        <main className="s-main">
          <header className="s-main-head">
            <h1 className="s-h1">{heading[tab].title}</h1>
            <p className="s-meta mt-1">{heading[tab].blurb}</p>
          </header>

          {/* Resolved to a single node rather than three conditional siblings:
              siblings make React treat the panels as a list and ask for keys. */}
          <div className="s-tab-body">{panels[tab]}</div>
        </main>
      </div>
    </div>
  );
}
