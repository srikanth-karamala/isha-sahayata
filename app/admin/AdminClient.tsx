'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { repairCycle, getActiveRides } from '@/app/actions';
import { adminLogout } from './auth-actions';
import { Wrench, CheckCircle2, MapPin, AlertTriangle, ArrowLeft, LogOut, Camera, ShieldAlert, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { CycleStatus, HubSummary, LiveRide } from '@/lib/types';
import type { FaultCategory, FaultSeverity } from '@prisma/client';
import { formatDistance } from '@/lib/geo';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-72 bg-[#3a5238] rounded-[1.25rem] flex items-center justify-center text-white/70 text-xs font-semibold tracking-tight">
      Loading live map
    </div>
  ),
});

interface Cycle {
  id: string;
  qrCode: string;
  status: CycleStatus;
  issueNotes?: string | null;
  issuePhotoUrl?: string | null;
  faultCategory?: FaultCategory | null;
  faultSeverity?: FaultSeverity | null;
  safeToRide?: boolean | null;
  faultSummary?: string | null;
  triagedAt?: Date | null;
  latitude?: number | null;
  longitude?: number | null;
  updatedAt: Date;
  currentHub: {
    id: string;
    name: string;
  };
}

interface TodayStats {
  ridesToday: number;
  kmCoveredToday: number;
}

/** Severity badge styling. Colour never stands alone — each badge is labelled. */
const SEVERITY_STYLE: Record<FaultSeverity, string> = {
  CRITICAL: 'bg-rose-100 text-rose-900 ring-rose-200',
  HIGH: 'bg-orange-100 text-orange-900 ring-orange-200',
  MEDIUM: 'bg-amber-100 text-amber-900 ring-amber-200',
  LOW: 'bg-stone-100 text-stone-700 ring-stone-200',
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read photo'));
    reader.readAsDataURL(file);
  });
}

export default function AdminClient({
  initialMaintenanceCycles,
  hubs,
  stats,
  initialLiveRides,
}: {
  initialMaintenanceCycles: Cycle[];
  hubs: HubSummary[];
  stats: TodayStats;
  initialLiveRides: LiveRide[];
}) {
  const router = useRouter();
  const [cycles, setCycles] = useState(initialMaintenanceCycles);
  const [liveRides, setLiveRides] = useState(initialLiveRides);
  const [selectedHubs, setSelectedHubs] = useState<Record<string, string>>({});
  const [repairPhotos, setRepairPhotos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setCycles(initialMaintenanceCycles);
  }, [initialMaintenanceCycles]);

  useEffect(() => {
    setLiveRides(initialLiveRides);
  }, [initialLiveRides]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void getActiveRides().then(setLiveRides);
    }, 6000);
    return () => window.clearInterval(id);
  }, []);

  const handleRepair = async (qrCode: string) => {
    const targetHubId = selectedHubs[qrCode] || hubs[0]?.id;
    const photo = repairPhotos[qrCode];
    if (!targetHubId) return;
    if (!photo) {
      alert('Take a photo of the repaired cycle before confirming.');
      return;
    }

    setLoading(qrCode);
    try {
      await repairCycle(qrCode, targetHubId, photo);
      setCycles((prev) => prev.filter((cycle) => cycle.qrCode !== qrCode));
      setMessage(`Cycle ${qrCode} marked repaired and back on the dock.`);
      setTimeout(() => setMessage(null), 3000);
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update cycle');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="yc-panel flex justify-between items-center px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[1.05rem] bg-primary flex items-center justify-center shadow-sm ring-1 ring-white/40">
            <Wrench className="w-5 h-5 text-[var(--ink)]" />
          </div>
          <div>
            <h2 className="yc-title yc-title-md">Maintenance</h2>
            <p className="yc-meta mt-0.5">
              {cycles.length} cycle{cycles.length === 1 ? '' : 's'} with staff
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1 px-3 py-2 rounded-full bg-black/[0.05] text-[var(--ink-2)] text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Rider map</span>
          </Link>
          <form action={adminLogout}>
            <button
              type="submit"
              className="flex items-center gap-1 px-3 py-2 rounded-full bg-black/[0.05] text-[var(--ink-2)] text-xs font-semibold"
            >
              <LogOut className="w-4 h-4" />
              <span>Log out</span>
            </button>
          </form>
        </div>
      </div>

      {/* Live map takes the width it needs; the single stat sits beside it
          rather than spanning a full row on its own. */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px] gap-4 items-start">
        <div className="yc-panel overflow-hidden order-2 xl:order-1">
        <div className="px-4 py-3 border-b border-[var(--separator)] flex items-center justify-between">
          <p className="yc-title yc-title-sm">Live rides</p>
          <p className="yc-meta">{liveRides.length} active</p>
        </div>
        <div className="h-72 xl:h-[22rem] relative">
          <MapView
            hubs={hubs}
            selectedHubId={null}
            followRider={false}
            currentPos={null}
            ridePath={[]}
            liveRides={liveRides}
            showLocate={false}
          />
        </div>
        {liveRides.length > 0 && (
          <div className="divide-y divide-[var(--separator)] max-h-40 overflow-y-auto">
            {liveRides.map((ride) => (
              <div key={ride.id} className="px-4 py-2.5 flex justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="yc-mono yc-strong">{ride.qrCode}</p>
                  <p className="yc-meta truncate mt-0.5">
                    {ride.riderName}
                    {ride.riderPhone ? ` · ${ride.riderPhone}` : ''}
                  </p>
                </div>
                <p className="yc-meta shrink-0">{formatDistance(ride.distanceMeters)}</p>
              </div>
            ))}
          </div>
        )}
        </div>

        <div className="yc-panel p-4 order-1 xl:order-2">
          <p className="yc-eyebrow">Km covered today</p>
          <p className="yc-title text-[28px] mt-1 tabular-nums">
            {stats.kmCoveredToday.toFixed(1)}
          </p>
          <p className="yc-meta mt-2">
            Measured from GPS ride paths recorded today.
          </p>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50/90 text-emerald-800 rounded-[1.1rem] text-xs flex items-center gap-2 border border-emerald-200/80 backdrop-blur-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {cycles.length === 0 ? (
        <div className="yc-panel p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="yc-title yc-title-md">All cycles operational</h3>
          <p className="yc-body-sm mt-1">Nothing is currently flagged for maintenance.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {cycles.map((cycle) => (
            <div key={cycle.id} className="yc-panel p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="yc-mono yc-strong text-sm bg-rose-100 text-rose-900 px-3 py-1 rounded-full">
                    {cycle.qrCode}
                  </span>
                  <span className="yc-meta">
                    Updated: {new Date(cycle.updatedAt).toLocaleTimeString()}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {/* AI triage: category, urgency and the safe-to-ride verdict */}
                  {cycle.faultSeverity && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ${
                          SEVERITY_STYLE[cycle.faultSeverity]
                        }`}
                      >
                        {cycle.faultSeverity}
                      </span>
                      {cycle.faultCategory && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 ring-1 ring-stone-200">
                          {cycle.faultCategory}
                        </span>
                      )}
                      {cycle.safeToRide === false && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-600 text-white flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          Unsafe to ride
                        </span>
                      )}
                      <span className="yc-meta flex items-center gap-0.5 ml-auto text-[9px]">
                        <Sparkles className="w-2.5 h-2.5" />
                        AI triaged
                      </span>
                    </div>
                  )}

                  {/* The summary is a condensed restatement; hide it when it just
                      repeats the rider's own words (as the offline fallback does). */}
                  {cycle.faultSummary &&
                    cycle.faultSummary.replace(/\.\.\.$/, '').trim() !==
                      (cycle.issueNotes ?? '').slice(0, 67).trim() && (
                      <p className="text-xs font-semibold text-[var(--ink)]">
                        {cycle.faultSummary}
                      </p>
                    )}

                  <div className="bg-rose-50/90 border border-rose-100 p-3 rounded-[1.05rem]">
                    <p className="text-xs font-semibold text-rose-900 mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Reported fault</span>
                    </p>
                    <p className="yc-body-sm text-[var(--ink-2)]">{cycle.issueNotes || 'No notes provided'}</p>
                    {cycle.issuePhotoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cycle.issuePhotoUrl}
                        alt={`Fault on ${cycle.qrCode}`}
                        className="mt-2 w-full max-h-36 object-cover rounded-xl border border-rose-100"
                      />
                    )}
                  </div>

                  <div className="yc-meta flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Last hub: {cycle.currentHub.name}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--separator)] pt-3 space-y-2">
                <label className="block yc-meta">Deploy to station</label>
                <select
                  value={selectedHubs[cycle.qrCode] || hubs[0]?.id}
                  onChange={(e) => setSelectedHubs({ ...selectedHubs, [cycle.qrCode]: e.target.value })}
                  className="yc-field py-2 text-xs"
                >
                  {hubs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>

                <label className="yc-meta flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5" />
                  Repair photo required
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void readFileAsDataUrl(file).then((dataUrl) => {
                      setRepairPhotos((prev) => ({ ...prev, [cycle.qrCode]: dataUrl }));
                    });
                  }}
                  className="block w-full text-xs text-[var(--muted)]"
                />
                {repairPhotos[cycle.qrCode] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={repairPhotos[cycle.qrCode]}
                    alt="Repair proof"
                    className="w-full max-h-28 object-cover rounded-xl border border-[var(--separator)]"
                  />
                )}

                <button
                  onClick={() => handleRepair(cycle.qrCode)}
                  disabled={loading === cycle.qrCode || !repairPhotos[cycle.qrCode]}
                  className="w-full px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-[1rem] disabled:opacity-50 transition-transform active:scale-[0.98]"
                >
                  {loading === cycle.qrCode ? 'Updating…' : 'Confirm repaired'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
