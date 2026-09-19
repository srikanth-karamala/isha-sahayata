'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bike, Flag, MapPin, Phone, User, X } from 'lucide-react';
import { checkoutCycle, dropOffCycle, getCycleByQr, reportFault } from '@/app/actions';
import type { RideTracker } from '@/hooks/useRideTracker';
import type { CycleDetail, HubSummary } from '@/lib/types';
import { occupiedCount, availableCount } from '@/lib/types';
import { formatDistance, hubsByDistance, isNearHub } from '@/lib/geo';
import SlideToConfirm from './SlideToConfirm';
import SwipeDismiss from './SwipeDismiss';

interface ActionModalProps {
  qrCode: string;
  hubs: HubSummary[];
  userId: string;
  tracker: RideTracker;
  userPos: [number, number] | null;
  activeRideQr: string | null;
  onClose: () => void;
  onUnlocked: (qrCode: string) => void;
  onReturned: () => void;
  /** Receives the AI triage verdict so the rider can be warned when the
      cycle they just reported is unsafe to ride. */
  onFaulted: (triage?: { safeToRide: boolean; summary: string }) => void;
}

type View = 'loading' | 'ready' | 'fault-form' | 'working' | 'success' | 'error';

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read photo'));
    reader.readAsDataURL(file);
  });
}

export default function ActionModal({
  qrCode,
  hubs,
  userId,
  tracker,
  userPos,
  activeRideQr,
  onClose,
  onUnlocked,
  onReturned,
  onFaulted,
}: ActionModalProps) {
  const [view, setView] = useState<View>('loading');
  const [cycle, setCycle] = useState<CycleDetail | null>(null);
  const [faultNotes, setFaultNotes] = useState('');
  const [faultPhoto, setFaultPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const origin = tracker.currentPos ?? userPos;
  const ranked = useMemo(() => hubsByDistance(hubs, origin), [hubs, origin]);
  const [selectedHubId, setSelectedHubId] = useState('');

  useEffect(() => {
    let cancelled = false;
    getCycleByQr(qrCode)
      .then((found) => {
        if (cancelled) return;
        setCycle(found);
        setView('ready');
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setMessage(err.message || 'Could not look up this cycle.');
        setView('error');
      });
    return () => {
      cancelled = true;
    };
  }, [qrCode]);

  useEffect(() => {
    if (!selectedHubId && ranked[0]) {
      const open = ranked.find(({ hub }) => occupiedCount(hub) < hub.capacity);
      setSelectedHubId((open ?? ranked[0]).hub.id);
    }
  }, [ranked, selectedHubId]);

  const selectedHub = hubs.find((hub) => hub.id === selectedHubId) ?? null;
  const nearSelected = selectedHub
    ? origin
      ? isNearHub(selectedHub, origin)
      : true
    : false;
  const selectedMeters = ranked.find((row) => row.hub.id === selectedHubId)?.meters;

  const run = async (action: 'checkout' | 'dropoff' | 'fault') => {
    setView('working');
    try {
      const [lat, lng] = tracker.currentPos ?? userPos ?? [];
      if (action === 'checkout') {
        await checkoutCycle(qrCode, userId);
        onUnlocked(qrCode);
        return;
      }
      if (action === 'dropoff') {
        await dropOffCycle(qrCode, selectedHubId, userId, lat, lng, tracker.distanceMeters);
        onReturned();
        return;
      }
      const result = await reportFault(
        qrCode,
        userId,
        faultNotes,
        lat,
        lng,
        faultPhoto ?? undefined
      );
      onFaulted(result.triage);
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      setMessage(text);
      setView('error');
    }
  };

  const mine = cycle?.status === 'IN_USE' && cycle.heldByUserId === userId;
  const someoneElse = cycle?.status === 'IN_USE' && cycle.heldByUserId && cycle.heldByUserId !== userId;
  const ridingOther = Boolean(activeRideQr && activeRideQr !== qrCode && cycle?.status === 'AVAILABLE');

  return (
    <SwipeDismiss onDismiss={onClose}>
      <div>
        <div className="px-5 pt-2 pb-3 flex items-start justify-between gap-3 border-b border-[var(--separator)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-[1.1rem] bg-primary flex items-center justify-center shrink-0 shadow-sm ring-1 ring-white/40">
              <Bike className="w-5 h-5 text-[var(--ink)]" />
            </div>
            <div className="min-w-0">
              <p className="yc-eyebrow">Yellow cycle</p>
              <h3 className="yc-title yc-title-md yc-mono truncate mt-1">{qrCode}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-black/[0.04] text-[var(--muted)]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {view === 'loading' && (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="w-9 h-9 border-[3px] border-stone-200 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-stone-500">Checking this cycle…</p>
            </div>
          )}

          {view === 'working' && (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="w-9 h-9 border-[3px] border-stone-200 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-stone-500">Updating…</p>
            </div>
          )}

          {view === 'error' && (
            <div className="space-y-4">
              <p className="text-sm text-rose-700">{message}</p>
              <button type="button" onClick={() => setView('ready')} className="yc-btn-primary">
                Try again
              </button>
            </div>
          )}

          {view === 'ready' && cycle?.status === 'MAINTENANCE' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-3">
                <p className="yc-eyebrow text-rose-800">With staff</p>
                <p className="yc-body mt-1.5">{cycle.issueNotes || 'This cycle is flagged for repair.'}</p>
              </div>
              <button type="button" onClick={onClose} className="w-full py-3 bg-stone-100 text-stone-800 font-semibold rounded-2xl min-h-12">
                Back to map
              </button>
            </div>
          )}

          {view === 'ready' && someoneElse && (
            <div className="space-y-4">
              <p className="yc-body">
                This yellow cycle is checked out. Contact the rider below, or ask staff if it looks abandoned.
              </p>
              {cycle?.heldByUser ? (
                <div className="rounded-2xl border border-stone-200 bg-stone-50 px-3.5 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-stone-500" />
                    <div>
                      <p className="yc-eyebrow">Rider</p>
                      <p className="yc-title yc-title-sm mt-1">{cycle.heldByUser.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-stone-500" />
                    <div>
                      <p className="yc-eyebrow">Phone</p>
                      <a
                        href={`tel:${cycle.heldByUser.phone.replace(/\s+/g, '')}`}
                        className="yc-title yc-title-sm mt-1 inline-block underline-offset-2 hover:underline"
                      >
                        {cycle.heldByUser.phone}
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="yc-body-sm">Rider details are not available for this checkout.</p>
              )}
              <button type="button" onClick={onClose} className="w-full py-3 bg-stone-100 text-stone-800 font-semibold rounded-2xl min-h-12">
                Back to map
              </button>
            </div>
          )}

          {view === 'ready' && ridingOther && (
            <div className="space-y-4">
              <p className="text-sm text-stone-600">
                You already have <span className="font-mono font-semibold">{activeRideQr}</span>. Return that cycle before unlocking another.
              </p>
              <button type="button" onClick={onClose} className="w-full py-3 bg-primary text-stone-900 font-semibold rounded-2xl min-h-12">
                Got it
              </button>
            </div>
          )}

          {view === 'ready' && cycle?.status === 'AVAILABLE' && !ridingOther && (
            <div className="space-y-4">
              <p className="text-sm text-stone-600 leading-relaxed">
                Unlock <span className="font-semibold text-stone-900">{cycle.qrCode}</span>
                {cycle.currentHub ? ` at ${cycle.currentHub.name}` : ''}. Give the brakes and tyres a quick look before you roll.
              </p>
              <button type="button" onClick={() => run('checkout')} className="yc-btn-primary">
                Unlock cycle
              </button>
              <button
                type="button"
                onClick={() => setView('fault-form')}
                className="w-full text-sm font-semibold text-rose-700 py-1"
              >
                Report an issue instead
              </button>
            </div>
          )}

          {view === 'ready' && mine && (
            <div className="space-y-4">
              {cycle?.heldByUser && (
                <div className="rounded-2xl border border-primary/30 bg-primary/10 px-3.5 py-3">
                  <p className="yc-eyebrow">Checked out to you</p>
                  <p className="yc-title yc-title-sm mt-1">{cycle.heldByUser.name}</p>
                  <p className="yc-body-sm mt-0.5">{cycle.heldByUser.phone}</p>
                </div>
              )}
              <div>
                <p className="yc-eyebrow">Step 3 · Drop off</p>
                <label className="yc-title yc-title-sm block mt-1.5">Return at which dock?</label>
                <p className="yc-body-sm mt-1">
                  Slide unlocks when you are within ~75 m of the selected dock.
                  {selectedHub && Number.isFinite(selectedMeters)
                    ? ` You are ${formatDistance(selectedMeters!)} from ${selectedHub.name}.`
                    : ''}
                </p>
              </div>
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {ranked.map(({ hub, meters }, index) => {
                  const full = occupiedCount(hub) >= hub.capacity;
                  const selected = selectedHubId === hub.id;
                  const ready = availableCount(hub);
                  const openSlots = Math.max(0, hub.capacity - occupiedCount(hub));
                  const near = isNearHub(hub, origin);
                  return (
                    <button
                      key={hub.id}
                      type="button"
                      disabled={full}
                      onClick={() => setSelectedHubId(hub.id)}
                      className={`w-full flex items-center justify-between gap-3 rounded-[1.15rem] border px-3.5 py-3 text-left min-h-[3.25rem] transition-colors ${
                        selected ? 'border-primary/60 bg-primary/15' : 'border-[var(--separator)] bg-white/45'
                      } ${near && !full ? 'ring-2 ring-emerald-500/35' : ''} ${full ? 'opacity-40' : ''}`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <MapPin className="w-4 h-4 text-stone-400 shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-[15px] font-semibold text-stone-900 truncate">
                            {hub.name}
                            {near && !full ? ' · here' : index === 0 && !full ? ' · nearest' : ''}
                          </span>
                          <span className="block text-xs text-stone-500 mt-0.5">
                            {full ? 'Full' : `${openSlots} open docks · ${ready} ready`}
                          </span>
                        </span>
                      </span>
                      <span className="text-xs font-semibold text-stone-500 shrink-0">
                        {full ? '—' : Number.isFinite(meters) ? formatDistance(meters) : '—'}
                      </span>
                    </button>
                  );
                })}
              </div>
              {tracker.distanceMeters > 0 && (
                <p className="text-xs text-stone-500">
                  Tracked this ride: {(tracker.distanceMeters / 1000).toFixed(2)} km
                </p>
              )}
              <SlideToConfirm
                armed={nearSelected && Boolean(selectedHubId)}
                armedLabel={
                  selectedHub
                    ? origin
                      ? `Slide to drop off · ${selectedHub.name}`
                      : `No GPS · slide if at ${selectedHub.name}`
                    : 'Slide to drop off'
                }
                disabledLabel={
                  selectedHub
                    ? `Move closer to ${selectedHub.name} to unlock`
                    : 'Select a dock first'
                }
                onConfirm={() => {
                  void run('dropoff');
                }}
              />
              <button type="button" onClick={() => setView('fault-form')} className="yc-btn-ghost">
                Report an issue instead
              </button>
            </div>
          )}

          {view === 'fault-form' && (
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-stone-800">What is wrong?</label>
              <textarea
                value={faultNotes}
                onChange={(e) => setFaultNotes(e.target.value)}
                placeholder="Flat tyre, broken pedal, chain skip…"
                className="yc-field min-h-[96px] resize-none"
              />
              <label className="block text-sm font-semibold text-stone-800">Photo (optional, helps staff)</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    setFaultPhoto(null);
                    return;
                  }
                  void readFileAsDataUrl(file).then(setFaultPhoto).catch(() => setFaultPhoto(null));
                }}
                className="block w-full text-xs text-stone-600"
              />
              {faultPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={faultPhoto} alt="Fault preview" className="w-full max-h-40 object-cover rounded-xl border border-stone-200" />
              )}
              <button
                type="button"
                disabled={!faultNotes.trim()}
                onClick={() => run('fault')}
                className="w-full py-3.5 bg-rose-600 text-white font-semibold rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Flag className="w-4 h-4" />
                Send to staff
              </button>
              <button type="button" onClick={() => setView('ready')} className="w-full text-sm font-semibold text-stone-500 py-1">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </SwipeDismiss>
  );
}
