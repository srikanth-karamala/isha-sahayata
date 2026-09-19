'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Search,
  Sparkles,
  X,
  HandHeart,
  PackageSearch,
} from 'lucide-react';
import {
  reportLostOrFound,
  getMyReports,
  getOpenItems,
  confirmMatch,
  dismissMatch,
} from '@/app/lost-found-actions';
import type { HubSummary } from '@/lib/types';

/**
 * Lost and found for riders: report what you lost, hand in what you found,
 * and see the pairings Claude thinks describe the same object.
 */

type Mode = 'browse' | 'lost' | 'found' | 'sent';

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read photo'));
    reader.readAsDataURL(file);
  });
}

function whenLabel(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const hours = (Date.now() - d.getTime()) / 3_600_000;
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

type ReportRow = Awaited<ReturnType<typeof getMyReports>>[number];
type OpenRow = Awaited<ReturnType<typeof getOpenItems>>[number];

export default function LostFoundPanel({
  userId,
  hubs,
  userPos,
  onNeedIdentity,
}: {
  userId: string | null;
  hubs: HubSummary[];
  userPos: [number, number] | null;
  onNeedIdentity: () => void;
}) {
  const [mode, setMode] = useState<Mode>('browse');
  const [description, setDescription] = useState('');
  const [hubId, setHubId] = useState('');
  const [placeNote, setPlaceNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ matchCount: number; title: string } | null>(null);

  const [myReports, setMyReports] = useState<ReportRow[]>([]);
  const [recentFound, setRecentFound] = useState<OpenRow[]>([]);

  const refresh = useCallback(async () => {
    const [mine, found] = await Promise.all([
      userId ? getMyReports(userId) : Promise.resolve([] as ReportRow[]),
      getOpenItems('FOUND', 8),
    ]);
    setMyReports(mine);
    setRecentFound(found);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const reset = () => {
    setDescription('');
    setHubId('');
    setPlaceNote('');
    setPhoto(null);
    setError('');
  };

  const submit = async (kind: 'LOST' | 'FOUND') => {
    if (!description.trim()) return;
    if (!userId) {
      onNeedIdentity();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const [lat, lng] = userPos ?? [undefined, undefined];
      const res = await reportLostOrFound({
        kind,
        description,
        userId,
        hubId: hubId || null,
        placeNote,
        photoDataUrl: photo,
        lat,
        lng,
      });
      setResult({
        matchCount: res.matchCount,
        title: res.item.title ?? description.slice(0, 40),
      });
      setMode('sent');
      reset();
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not send the report.');
    } finally {
      setBusy(false);
    }
  };

  // ---- after submitting ----
  if (mode === 'sent' && result) {
    return (
      <div className="yc-sheet yc-sheet-solid p-5 text-center">
        <CheckCircle2 className="w-11 h-11 mx-auto mb-2 text-emerald-600" />
        <h3 className="yc-title yc-title-md">Report filed</h3>
        <p className="yc-body-sm mt-1">{result.title}</p>
        {result.matchCount > 0 ? (
          <div
            className="mt-3 p-3 rounded-[1.05rem] text-left"
            style={{ background: 'var(--surface-2)' }}
          >
            <p className="yc-eyebrow mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {result.matchCount} possible match
              {result.matchCount === 1 ? '' : 'es'} found
            </p>
            <p className="text-xs text-[var(--ink-2)]">
              Open &ldquo;My reports&rdquo; below to see them.
            </p>
          </div>
        ) : (
          <p className="yc-meta mt-3">
            Nothing matches yet. You will see a suggestion here if someone
            reports it.
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setMode('browse');
            setResult(null);
          }}
          className="yc-btn-primary w-full mt-4"
        >
          Done
        </button>
      </div>
    );
  }

  // ---- report form (lost or found) ----
  if (mode === 'lost' || mode === 'found') {
    const isLost = mode === 'lost';
    return (
      <div className="yc-sheet yc-sheet-solid p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="yc-title yc-title-md">
              {isLost ? 'Report something lost' : 'Hand in something found'}
            </h3>
            <p className="yc-body-sm mt-0.5">
              {isLost
                ? 'Describe it as you would to a friend.'
                : 'Describe what you found and where you left it.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMode('browse');
              reset();
            }}
            className="yc-btn-ghost is-icon shrink-0"
            aria-label="Back"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label htmlFor="lf-desc" className="yc-eyebrow block mb-1">
            What is it?
          </label>
          <textarea
            id="lf-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={
              isLost
                ? 'Black steel water bottle with a dent near the base…'
                : 'Dark metal flask, scratched, left at the Biksha Hall desk…'
            }
            className="yc-field w-full resize-none"
          />
          <p className="yc-meta mt-1">
            Colour, material and any damage help most.
          </p>
        </div>

        <div>
          <label htmlFor="lf-hub" className="yc-eyebrow block mb-1">
            Nearest station
          </label>
          <select
            id="lf-hub"
            value={hubId}
            onChange={(e) => setHubId(e.target.value)}
            className="yc-field w-full"
          >
            <option value="">Not sure</option>
            {hubs.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="lf-place" className="yc-eyebrow block mb-1">
            Anything more about the place?
          </label>
          <input
            id="lf-place"
            value={placeNote}
            onChange={(e) => setPlaceNote(e.target.value)}
            placeholder="On the path behind Spanda Hall"
            className="yc-field w-full"
          />
        </div>

        {photo ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt="Attached"
              className="w-full max-h-40 object-cover rounded-[1.05rem]"
            />
            <button
              type="button"
              onClick={() => setPhoto(null)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/55 text-white"
              aria-label="Remove photo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <label className="yc-btn-ghost w-full flex items-center justify-center gap-2 cursor-pointer py-2.5">
            <Camera className="w-4 h-4" />
            <span className="text-xs font-semibold">Add a photo</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setPhoto(await readFileAsDataUrl(file));
              }}
            />
          </label>
        )}

        {error && (
          <p className="text-xs" style={{ color: '#d03b3b' }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => submit(isLost ? 'LOST' : 'FOUND')}
          disabled={!description.trim() || busy}
          className="yc-btn-primary w-full disabled:opacity-50"
        >
          {busy ? 'Checking for matches…' : isLost ? 'Report it lost' : 'Hand it in'}
        </button>
      </div>
    );
  }

  // ---- browse ----
  const openReports = myReports.filter((r) => r.status === 'OPEN');

  return (
    <div className="yc-sheet yc-sheet-solid p-5 space-y-4 max-h-[60vh] overflow-y-auto">
      <div>
        <h3 className="yc-title yc-title-md">Lost &amp; Found</h3>
        <p className="yc-body-sm mt-0.5">
          Describe what went missing. Claude matches it against what others have
          handed in.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode('lost')}
          className="yc-btn-primary flex items-center justify-center gap-2 py-3"
        >
          <PackageSearch className="w-4 h-4" />
          I lost something
        </button>
        <button
          type="button"
          onClick={() => setMode('found')}
          className="yc-btn-ghost flex items-center justify-center gap-2 py-3"
          style={{ border: '1px solid var(--separator)', borderRadius: '1rem' }}
        >
          <HandHeart className="w-4 h-4" />
          I found something
        </button>
      </div>

      {openReports.length > 0 && (
        <div>
          <p className="yc-eyebrow mb-2">My reports</p>
          <div className="space-y-2">
            {openReports.map((report) => (
              <div
                key={report.id}
                className="rounded-[1.05rem] p-3"
                style={{ background: 'var(--surface-2)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">
                      {report.title ?? report.description}
                    </p>
                    <p className="yc-meta mt-0.5">
                      {report.kind === 'LOST' ? 'Lost' : 'Found'} ·{' '}
                      {whenLabel(report.occurredAt)}
                      {report.hub ? ` · ${report.hub.name}` : ''}
                    </p>
                  </div>
                </div>

                {report.matchesAsSource.length > 0 && (
                  <div className="mt-2.5 space-y-2">
                    <p className="yc-eyebrow flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Possible {report.kind === 'LOST' ? 'matches' : 'owners'}
                    </p>
                    {report.matchesAsSource.map((match) => (
                      <div
                        key={match.id}
                        className="rounded-[0.9rem] p-2.5"
                        style={{
                          background: 'var(--card, #fffdf8)',
                          border: '1px solid var(--separator)',
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold min-w-0">
                            {match.target.title ?? match.target.description}
                          </p>
                          <span
                            className="text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded-full"
                            style={{
                              background:
                                match.score >= 85 ? '#dcfce7' : 'var(--surface-2)',
                              color: match.score >= 85 ? '#166534' : 'var(--muted)',
                            }}
                          >
                            {match.score}%
                          </span>
                        </div>
                        <p className="yc-meta mt-1">{match.reasoning}</p>
                        <p className="yc-meta mt-1">
                          {match.target.hub
                            ? `At ${match.target.hub.name}`
                            : match.target.placeNote ?? 'Location not given'}
                          {' · '}
                          {whenLabel(match.target.occurredAt)}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await confirmMatch(report.id, match.targetId);
                              await refresh();
                            }}
                            className="yc-btn-primary flex-1 text-xs py-1.5"
                          >
                            That&apos;s mine
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await dismissMatch(report.id, match.targetId);
                              await refresh();
                            }}
                            className="yc-btn-ghost is-icon text-xs"
                            style={{ border: '1px solid var(--separator)', borderRadius: '0.8rem' }}
                          >
                            Not it
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {report.matchesAsSource.length === 0 && (
                  <p className="yc-meta mt-1.5">No matches yet.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {recentFound.length > 0 && (
        <div>
          <p className="yc-eyebrow mb-2 flex items-center gap-1">
            <Search className="w-3 h-3" />
            Recently handed in
          </p>
          <div className="space-y-1.5">
            {recentFound.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-2 py-1.5"
                style={{ borderBottom: '1px solid var(--separator)' }}
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">
                    {item.title ?? item.description}
                  </p>
                  <p className="yc-meta">
                    {item.hub ? item.hub.name : item.placeNote ?? 'Location not given'}
                  </p>
                </div>
                <p className="yc-meta shrink-0">{whenLabel(item.occurredAt)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {openReports.length === 0 && recentFound.length === 0 && (
        <p className="yc-meta text-center py-2">
          Nothing reported yet. Be the first.
        </p>
      )}
    </div>
  );
}
