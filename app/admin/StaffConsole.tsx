'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Bike, Search, ArrowLeft, LogOut } from 'lucide-react';
import { adminLogout } from './auth-actions';

export type StaffTab = 'overview' | 'cycles' | 'lost-found';

/**
 * Shell for the staff console: header, tab rail, and the panel for the
 * selected tab.
 *
 * Three tabs rather than one long page, because a coordinator arrives with a
 * specific question — what needs doing this morning, which cycles are out of
 * service, has anyone handed in a lost bottle — and should not scroll past two
 * of those to reach the third.
 *
 * The rail sits above the content on desktop and becomes a fixed bottom bar on
 * phones (see .s-tabs in globals.css).
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

  return (
    <div className="yc-staff min-h-dvh">
      <div className="mx-auto w-full max-w-[1400px] px-4 md:px-7 py-6 md:py-8">
        <header className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="s-eyebrow">Isha Yoga Center</p>
            <h1 className="s-h1 mt-1">Staff console</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/" className="s-btn s-btn-quiet">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Rider app</span>
            </Link>
            <form action={adminLogout}>
              <button type="submit" className="s-btn s-btn-quiet">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </form>
          </div>
        </header>

        <nav className="s-tabs mb-6" aria-label="Console sections">
          {tabs.map(({ id, label, Icon, count, alert }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`s-tab ${tab === id ? 'is-active' : ''}`}
              aria-current={tab === id ? 'page' : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
              {count != null && (
                <span className={`s-tab-count ${alert ? 'is-alert' : ''}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="s-tab-body">
          {tab === 'overview' && overview}
          {tab === 'cycles' && cycles}
          {tab === 'lost-found' && lostFound}
        </div>
      </div>
    </div>
  );
}
