'use client';

import { useState } from 'react';
import {
  PackageSearch,
  HandHeart,
  Phone,
  CheckCircle2,
  AlertTriangle,
  ImageOff,
} from 'lucide-react';
import { confirmMatch, getOpenFeed } from '@/app/lost-found-actions';

/**
 * Lost and found, staff view.
 *
 * One list, newest first, and nothing else.
 *
 * The previous version split the page in two: suggested pairings at the top,
 * then everything the matcher could not pair below. That made a report move
 * between sections depending on whether a match happened to exist, so "what
 * just came in?" — the question staff actually open this page with — could not
 * be answered by looking in one place. It also meant the newest report could
 * sit at the bottom of the page.
 *
 * Now every open report is one row in arrival order, and a suggested partner
 * hangs off the row it belongs to. A row is either actionable (it has a
 * pairing, so there is a button) or it is not (a person has to look). That is
 * the whole model.
 *
 * Matching is AI-only by choice. Word-overlap scoring used to fill this page
 * with suggestions like "same category, 1 matching word" at 43%, which look
 * like findings but tell staff nothing the two descriptions side by side do
 * not. When the model cannot be reached, no suggestion is stored and the row
 * simply says so.
 */

type Feed = Awaited<ReturnType<typeof getOpenFeed>>;
type Item = Feed[number];

function whenLabel(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const hours = (Date.now() - d.getTime()) / 3_600_000;
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

function placeOf(i: { hub: { name: string } | null; placeNote: string | null }) {
  return i.hub?.name ?? i.placeNote ?? 'place not given';
}

/** Lost and handed-in read differently at a glance, so they are marked. */
function KindTag({ kind }: { kind: string }) {
  const lost = kind === 'LOST';
  return (
    <span className={`s-kind ${lost ? 's-kind-lost' : 's-kind-found'}`}>
      {lost ? (
        <PackageSearch className="w-3 h-3" aria-hidden />
      ) : (
        <HandHeart className="w-3 h-3" aria-hidden />
      )}
      {lost ? 'Lost' : 'Handed in'}
    </span>
  );
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  // No photo: a small camera-off glyph rather than an empty grey square, which
  // read as a broken image. Keeps rows aligned down the column either way.
  if (!src)
    return (
      <div className="s-thumb s-thumb-empty" aria-hidden>
        <ImageOff className="w-4 h-4" />
      </div>
    );
  return (
    // Opens full size: staff read numbers and markings off these photos.
    <a href={src} target="_blank" rel="noreferrer" className="shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="s-thumb" />
    </a>
  );
}

export default function LostFoundBoard({
  feed,
  claimed,
  aiAvailable,
}: {
  feed: Feed;
  claimed: number;
  aiAvailable: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);

  // A pairing is stored in both directions so either party sees it from their
  // side, which means a matched pair arrives here as two rows describing the
  // same reunion. Keep the first — the feed is newest-first, so that is the
  // side that just came in — and drop the partner's own row. Without this the
  // page repeats every pair, the bug commit b9b6672 fixed in the old layout.
  const shown = new Set<string>();
  const rows = feed.filter((i) => {
    if (done.includes(i.id) || (i.match && done.includes(i.match.other.id))) return false;
    if (shown.has(i.id)) return false;
    shown.add(i.id);
    if (i.match) shown.add(i.match.other.id);
    return true;
  });
  // Three groups, each item in exactly one of them. Matched pairs go full
  // width at the top: they are the finishable work, and a pairing needs the
  // width to show both items side by side with the reason. What is left
  // splits by side, so staff scanning for "did anyone hand in a blue bag?"
  // read one column instead of filtering a mixed list.
  const matched = rows.filter((i) => i.match);
  const unmatchedLost = rows.filter((i) => !i.match && i.kind === 'LOST');
  const unmatchedFound = rows.filter((i) => !i.match && i.kind === 'FOUND');

  const confirmPair = async (item: Item) => {
    if (!item.match) return;
    setBusy(item.id);
    try {
      await confirmMatch(item.id, item.match.other.id);
      setDone((d) => [...d, item.id, item.match!.other.id]);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="s-h2">Open reports</h2>
        <p className="s-meta mt-0.5">
          {rows.length} open
          {matched.length > 0 && ` · ${matched.length} ready to close`}
          {claimed > 0 && ` · ${claimed} reunited so far`}. Newest first.
        </p>
      </div>

      {!aiAvailable && (
        <div className="s-note" role="status">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />
          <span>
            <b>Matching is unavailable.</b> No model could be reached, so no
            pairings are being suggested. The reports below are still complete —
            they need reading by eye.
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="s-body">Nothing open. Everything reported has been closed.</p>
      ) : (
        <>
          {matched.length > 0 && (
            <section className="s-card p-4">
              <h3 className="s-h3 mb-2">
                Ready to close
                <span className="s-count">{matched.length}</span>
              </h3>
              <ul className="s-feed">
                {matched.map((item) => (
                  <Row
                    key={item.id}
                    item={item}
                    busy={busy === item.id}
                    onConfirm={() => void confirmPair(item)}
                  />
                ))}
              </ul>
            </section>
          )}

          <div className="s-split">
            <section className="s-card p-4">
              <h3 className="s-h3 mb-2 flex items-center gap-1.5">
                <PackageSearch className="w-3.5 h-3.5" aria-hidden />
                Lost
                <span className="s-count">{unmatchedLost.length}</span>
              </h3>
              {unmatchedLost.length === 0 ? (
                <p className="s-meta">Nothing waiting.</p>
              ) : (
                <ul className="s-feed">
                  {unmatchedLost.map((item) => (
                    <Row
                      key={item.id}
                      item={item}
                      busy={false}
                      onConfirm={() => {}}
                      showKind={false}
                    />
                  ))}
                </ul>
              )}
            </section>

            <section className="s-card p-4">
              <h3 className="s-h3 mb-2 flex items-center gap-1.5">
                <HandHeart className="w-3.5 h-3.5" aria-hidden />
                Handed in
                <span className="s-count">{unmatchedFound.length}</span>
              </h3>
              {unmatchedFound.length === 0 ? (
                <p className="s-meta">Nothing waiting.</p>
              ) : (
                <ul className="s-feed">
                  {unmatchedFound.map((item) => (
                    <Row
                      key={item.id}
                      item={item}
                      busy={false}
                      onConfirm={() => {}}
                      showKind={false}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Row({
  item,
  busy,
  onConfirm,
  /** Hidden inside the Lost / Handed in columns, where the heading says it. */
  showKind = true,
}: {
  item: Item;
  busy: boolean;
  onConfirm: () => void;
  showKind?: boolean;
}) {
  const label = item.title ?? item.description;

  return (
    <li className="s-feed-row">
      <div className="flex gap-3">
        <Thumb src={item.photoUrl} alt={`Photo of ${label}`} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="s-h3 min-w-0">{label}</p>
            <span className="s-meta shrink-0">{whenLabel(item.createdAt)}</span>
          </div>

          <p className="s-meta mt-1 flex items-center gap-2 flex-wrap">
            {showKind && <KindTag kind={item.kind} />}
            {item.reportedBy.name} · {placeOf(item)}
          </p>

          {/* The description stays visible even when a title was generated
              from it: the title is a summary, and staff matching by eye need
              the words the person actually wrote. */}
          {item.title && item.description !== item.title && (
            <p className="s-body-sm mt-1">{item.description}</p>
          )}

          <a className="s-contact mt-1.5" href={`tel:${item.reportedBy.phone}`}>
            <Phone className="w-3 h-3 shrink-0" />
            {item.reportedBy.phone}
          </a>
        </div>
      </div>

      {item.match && (
        <div className="s-pair">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`s-chip ${
                item.match.score >= 85 ? 's-chip-good' : 's-chip-neutral'
              }`}
            >
              {item.match.score}% match
            </span>
            <span className="s-meta">Scored by AI</span>
          </div>

          <div className="flex gap-3">
            <Thumb
              src={item.match.other.photoUrl}
              alt={`Photo of ${item.match.other.title ?? item.match.other.description}`}
            />
            <div className="min-w-0 flex-1">
              <p className="s-h3">
                {item.match.other.title ?? item.match.other.description}
              </p>
              <p className="s-meta mt-1 flex items-center gap-2 flex-wrap">
                <KindTag kind={item.match.other.kind} />
                {item.match.other.reportedBy.name} · {placeOf(item.match.other)}
              </p>
              <a
                className="s-contact mt-1.5"
                href={`tel:${item.match.other.reportedBy.phone}`}
              >
                <Phone className="w-3 h-3 shrink-0" />
                {item.match.other.reportedBy.phone}
              </a>
            </div>
          </div>

          <p className="s-body-sm mt-2">{item.match.reasoning}</p>

          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="s-btn s-btn-primary mt-3"
          >
            <CheckCircle2 className="w-4 h-4" />
            {busy ? 'Closing…' : 'Confirm reunion'}
          </button>
        </div>
      )}
    </li>
  );
}
