'use client';

import { useState } from 'react';
import { Sparkles, PackageSearch, HandHeart, CheckCircle2, Link2, Phone } from 'lucide-react';
import { confirmMatch, getLostFoundSummary } from '@/app/lost-found-actions';

/**
 * Lost and found, staff view.
 *
 * The useful thing for staff is not the list of reports — it is the list of
 * *pairings*: which lost report and which handed-in item look like the same
 * object, ranked by confidence, so a volunteer at the desk can reunite them
 * without reading every entry.
 */

type Summary = Awaited<ReturnType<typeof getLostFoundSummary>>;
type Row = {
  id: string;
  title: string | null;
  description: string;
  hub: { name: string } | null;
  placeNote: string | null;
  occurredAt: Date;
  category: string | null;
  reportedBy: { name: string; phone: string };
};

function whenLabel(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const hours = (Date.now() - d.getTime()) / 3_600_000;
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

function placeOf(item: { hub: { name: string } | null; placeNote: string | null }) {
  return item.hub?.name ?? item.placeNote ?? 'Location not given';
}

export default function LostFoundBoard({
  summary,
  openLostItems,
  openFoundItems,
}: {
  summary: Summary;
  openLostItems: Row[];
  openFoundItems: Row[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);

  const matches = summary.topMatches.filter((m) => !done.includes(m.id));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="s-card p-4">
          <p className="s-eyebrow">Open · lost</p>
          <p className="s-num mt-2">{summary.openLost}</p>
        </div>
        <div className="s-card p-4">
          <p className="s-eyebrow">Open · handed in</p>
          <p className="s-num mt-2">{summary.openFound}</p>
        </div>
        <div className="s-card p-4">
          <p className="s-eyebrow">Reunited</p>
          <p className="s-num mt-2" style={{ color: 'var(--s-good)' }}>
            {summary.claimed}
          </p>
        </div>
      </div>

      {/* The AI's actual job on this page: proposing pairings. */}
      <section className="s-card p-5">
        <div className="flex items-start gap-2 mb-1">
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--s-accent)' }} />
          <div>
            <h2 className="s-h2">Suggested reunions</h2>
            <p className="s-meta mt-0.5">
              Every open report is read and scored for which lost and handed-in
              descriptions look like the same object. Confirming closes both.
            </p>
          </div>
        </div>

        {matches.length === 0 ? (
          <p className="s-body mt-4">
            No pairings above the confidence threshold right now.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {matches.map((match) => {
              const strong = match.score >= 85;
              return (
                <div
                  key={match.id}
                  className="s-card p-4"
                  style={{ background: 'var(--s-surface-2)' }}
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span
                      className={`s-chip ${strong ? 's-chip-good' : 's-chip-neutral'}`}
                    >
                      {match.score}% match
                    </span>
                    <span className="s-meta">
                      {match.byAi ? 'Scored by AI' : 'Offline rules'}
                    </span>
                  </div>

                  <div className="grid md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                    <div>
                      <p className="s-eyebrow flex items-center gap-1.5">
                        <PackageSearch className="w-3 h-3" />
                        Reported lost
                      </p>
                      <p className="s-h3 mt-1.5">
                        {match.source.title ?? match.source.description}
                      </p>
                      <p className="s-meta mt-1">
                        {match.source.reportedBy.name} · {placeOf(match.source)} ·{' '}
                        {whenLabel(match.source.occurredAt)}
                      </p>
                      {/* The number is the point of the pairing: staff have to
                          ring the owner to arrange the handover. */}
                      <a
                        className="s-contact mt-1.5"
                        href={`tel:${match.source.reportedBy.phone}`}
                      >
                        <Phone className="w-3 h-3 shrink-0" />
                        {match.source.reportedBy.phone}
                      </a>
                    </div>

                    <Link2
                      className="w-4 h-4 mx-auto hidden md:block"
                      style={{ color: 'var(--s-faint)' }}
                    />

                    <div>
                      <p className="s-eyebrow flex items-center gap-1.5">
                        <HandHeart className="w-3 h-3" />
                        Handed in
                      </p>
                      <p className="s-h3 mt-1.5">
                        {match.target.title ?? match.target.description}
                      </p>
                      <p className="s-meta mt-1">
                        {match.target.reportedBy.name} · {placeOf(match.target)} ·{' '}
                        {whenLabel(match.target.occurredAt)}
                      </p>
                      <a
                        className="s-contact mt-1.5"
                        href={`tel:${match.target.reportedBy.phone}`}
                      >
                        <Phone className="w-3 h-3 shrink-0" />
                        {match.target.reportedBy.phone}
                      </a>
                    </div>
                  </div>

                  <p
                    className="s-body mt-3 pt-3"
                    style={{ borderTop: '1px solid var(--s-line)' }}
                  >
                    {match.reasoning}
                  </p>

                  <button
                    type="button"
                    disabled={busy === match.id}
                    onClick={async () => {
                      setBusy(match.id);
                      try {
                        await confirmMatch(match.sourceId, match.targetId);
                        setDone((d) => [...d, match.id]);
                      } finally {
                        setBusy(null);
                      }
                    }}
                    className="s-btn s-btn-primary mt-3"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {busy === match.id ? 'Closing…' : 'Confirm reunion'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="s-card p-5">
          <h2 className="s-h2 flex items-center gap-2">
            <PackageSearch className="w-4 h-4" style={{ color: 'var(--s-muted)' }} />
            Reported lost
          </h2>
          <p className="s-meta mt-0.5 mb-3">{openLostItems.length} open</p>
          {openLostItems.length === 0 ? (
            <p className="s-body">Nothing reported lost.</p>
          ) : (
            <ul className="space-y-0">
              {openLostItems.map((item) => (
                <li
                  key={item.id}
                  className="py-2.5"
                  style={{ borderTop: '1px solid var(--s-line-soft)' }}
                >
                  <p className="s-h3">{item.title ?? item.description}</p>
                  <p className="s-meta mt-0.5">
                    {item.reportedBy.name} · {placeOf(item)} ·{' '}
                    {whenLabel(item.occurredAt)}
                  </p>
                  <a className="s-contact mt-1" href={`tel:${item.reportedBy.phone}`}>
                    <Phone className="w-3 h-3 shrink-0" />
                    {item.reportedBy.phone}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="s-card p-5">
          <h2 className="s-h2 flex items-center gap-2">
            <HandHeart className="w-4 h-4" style={{ color: 'var(--s-muted)' }} />
            Handed in
          </h2>
          <p className="s-meta mt-0.5 mb-3">{openFoundItems.length} waiting to be claimed</p>
          {openFoundItems.length === 0 ? (
            <p className="s-body">Nothing handed in.</p>
          ) : (
            <ul className="space-y-0">
              {openFoundItems.map((item) => (
                <li
                  key={item.id}
                  className="py-2.5"
                  style={{ borderTop: '1px solid var(--s-line-soft)' }}
                >
                  <p className="s-h3">{item.title ?? item.description}</p>
                  <p className="s-meta mt-0.5">
                    {item.reportedBy.name} · {placeOf(item)} ·{' '}
                    {whenLabel(item.occurredAt)}
                  </p>
                  <a className="s-contact mt-1" href={`tel:${item.reportedBy.phone}`}>
                    <Phone className="w-3 h-3 shrink-0" />
                    {item.reportedBy.phone}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
