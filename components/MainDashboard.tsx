'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { QrCode, ShieldAlert } from 'lucide-react';
import PhoneShell from './PhoneShell';
import QRScanner from './QRScanner';
import ActionModal from './ActionModal';
import BottomNav, { type RiderTab } from './BottomNav';
import ReportFaultPanel from './ReportFaultPanel';
import LostFoundPanel from './LostFoundPanel';
import IdentityGate from './IdentityGate';
import DynamicIsland from './DynamicIsland';
import useRideTracker from '@/hooks/useRideTracker';
import { loadRiderIdentity, type RiderIdentity } from '@/lib/rider-identity';
import { clearStoredRide, loadStoredRide, saveStoredRide } from '@/lib/active-ride';
import { dropOffCycle, getActiveCycleForUser, getHubs, pingRideTrack } from '@/app/actions';
import type { CycleDetail, HubSummary } from '@/lib/types';
import { availableCount, faultCount } from '@/lib/types';
import { formatDistance, formatDuration, hubsForPickup, isNearHub, nearestOpenDock } from '@/lib/geo';
import SlideToConfirm from './SlideToConfirm';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-[#3a5238] flex items-center justify-center text-white/80 text-sm font-semibold tracking-tight">
      Loading campus map…
    </div>
  ),
});

export default function MainDashboard({ initialHubs }: { initialHubs: HubSummary[] }) {
  const [hubs, setHubs] = useState(initialHubs);
  const [showScanner, setShowScanner] = useState(false);
  const [needsIdentity, setNeedsIdentity] = useState(false);
  const [activeQr, setActiveQr] = useState<string | null>(null);
  const [rider, setRider] = useState<RiderIdentity | null>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);
  const [activeRide, setActiveRide] = useState<CycleDetail | null>(null);
  const [islandOpen, setIslandOpen] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(true);
  // Set when a reported fault comes back unsafe — the rider must be told.
  const [faultVerdict, setFaultVerdict] = useState<string | null>(null);
  const [tab, setTab] = useState<RiderTab>('cycles');
  // When the report panel asks for a scan, the scanned code lands here.
  const [scanTarget, setScanTarget] = useState<'unlock' | 'report'>('unlock');
  const [reportQr, setReportQr] = useState<string | null>(null);

  // The map earns its place on the Cycles tab and during a ride; elsewhere it
  // is decoration behind a full-height panel.
  const showMap = tab === 'cycles' || Boolean(activeRide);
  const slideRef = useRef<HTMLDivElement>(null);
  const sheetDragY = useRef(0);
  const tracker = useRideTracker();
  const trackerRef = useRef(tracker);
  trackerRef.current = tracker;

  const refreshHubs = async () => {
    const next = await getHubs();
    setHubs(next);
    return next;
  };

  useEffect(() => {
    setRider(loadRiderIdentity());
    setCheckedStorage(true);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshHubs();
    }, 7000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!checkedStorage || !rider) return;
    let cancelled = false;

    getActiveCycleForUser(rider.id).then((cycle) => {
      if (cancelled) return;
      if (cycle) {
        setActiveRide(cycle);
        saveStoredRide({ qrCode: cycle.qrCode, startedAt: loadStoredRide()?.startedAt ?? Date.now() });
        if (!tracker.isTracking) {
          tracker.reset();
          tracker.start();
        }
      } else {
        const stored = loadStoredRide();
        if (stored) clearStoredRide();
        setActiveRide(null);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedStorage, rider?.id]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserPos([position.coords.latitude, position.coords.longitude]);
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 8000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!activeRide || !rider) return;
    const id = window.setInterval(() => {
      const live = trackerRef.current;
      if (!live.isTracking || !live.currentPos) return;
      void pingRideTrack(
        activeRide.qrCode,
        rider.id,
        live.currentPos[0],
        live.currentPos[1],
        live.distanceMeters,
        live.ridePath
      );
    }, 5000);
    return () => window.clearInterval(id);
  }, [activeRide?.qrCode, rider?.id]);

  const origin = tracker.currentPos ?? userPos;
  const nearbyPickup = useMemo(() => hubsForPickup(hubs, origin), [hubs, origin]);
  const nearestWithBike = nearbyPickup.find(({ hub }) => availableCount(hub) > 0) ?? null;
  const dropTarget = useMemo(() => nearestOpenDock(hubs, origin), [hubs, origin]);
  const nearDrop = Boolean(
    activeRide && dropTarget && (origin ? isNearHub(dropTarget.hub, origin) : true)
  );

  useEffect(() => {
    if (nearDrop) {
      setIslandOpen(true);
      setSheetExpanded(true);
    }
  }, [nearDrop]);

  const selectedHub = hubs.find((hub) => hub.id === selectedHubId) ?? null;
  const sheetRows = selectedHub
    ? [
        {
          hub: selectedHub,
          meters: nearbyPickup.find((n) => n.hub.id === selectedHub.id)?.meters ?? Number.POSITIVE_INFINITY,
        },
      ]
    : nearbyPickup.slice(0, sheetExpanded ? 5 : 2);

  const didAutoSelectRef = useRef(false);
  useEffect(() => {
    if (didAutoSelectRef.current || selectedHubId || activeRide || !nearestWithBike) return;
    if (!Number.isFinite(nearestWithBike.meters)) return;
    didAutoSelectRef.current = true;
    setSelectedHubId(nearestWithBike.hub.id);
  }, [nearestWithBike, selectedHubId, activeRide]);

  const headerReady = nearestWithBike
    ? availableCount(nearestWithBike.hub)
    : hubs.reduce((sum, hub) => sum + availableCount(hub), 0);
  const headerMeta = nearestWithBike
    ? Number.isFinite(nearestWithBike.meters)
      ? `${nearestWithBike.hub.name.split(' ')[0]} · ${formatDistance(nearestWithBike.meters)}`
      : nearestWithBike.hub.name
    : userPos
      ? 'no bikes near'
      : 'campus';

  const islandMode = nearDrop ? 'near-drop' : activeRide ? 'riding' : 'idle';

  const confirmNearDrop = async () => {
    if (!activeRide || !rider || !dropTarget) return;
    const [lat, lng] = origin ?? [];
    try {
      await dropOffCycle(
        activeRide.qrCode,
        dropTarget.hub.id,
        rider.id,
        lat,
        lng,
        tracker.distanceMeters
      );
      await endRideLocally();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Could not drop off.');
    }
  };

  const openScan = () => {
    setIslandOpen(false);
    if (rider) setShowScanner(true);
    else setNeedsIdentity(true);
  };

  const openReturn = () => {
    if (!activeRide) return;
    if (rider) setActiveQr(activeRide.qrCode);
    else setNeedsIdentity(true);
  };

  const endRideLocally = async () => {
    setActiveRide(null);
    clearStoredRide();
    tracker.stop();
    tracker.reset();
    setActiveQr(null);
    setIslandOpen(false);
    await refreshHubs();
  };

  const focusDropOff = () => {
    setSheetExpanded(true);
    setIslandOpen(false);
    window.requestAnimationFrame(() => {
      slideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const onSheetHandlePointerDown = (e: React.PointerEvent) => {
    sheetDragY.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onSheetHandlePointerUp = (e: React.PointerEvent) => {
    const dy = e.clientY - sheetDragY.current;
    if (dy < -28) setSheetExpanded(true);
    else if (dy > 28) setSheetExpanded(false);
  };

  return (
    <PhoneShell>
      <div className="yc-app">
        {/* Report and Lost & Found have nothing to do with location, so the
            map is not rendered behind them: it adds no information, its
            controls sit over content they do not act on, and it keeps a WebGL
            canvas running behind an opaque panel. An active ride always shows
            the map, whichever tab is selected. */}
        {showMap ? (
          <div className="yc-app-map">
            <MapView
              hubs={hubs}
              selectedHubId={selectedHubId}
              followRider={Boolean(activeRide)}
              currentPos={tracker.currentPos}
              ridePath={tracker.ridePath}
              onSelectHub={(id) => {
                setSelectedHubId(id);
                setSheetExpanded(true);
              }}
              onUserLocated={setUserPos}
            />
          </div>
        ) : (
          <div className="yc-app-plain" aria-hidden />
        )}

        <DynamicIsland
          mode={islandMode}
          expanded={islandOpen}
          onToggle={() => setIslandOpen((v) => !v)}
          onSwipeDown={() => {
            setSheetExpanded(true);
            setIslandOpen(false);
          }}
          onFocusDropOff={focusDropOff}
          readyCount={headerReady}
          nearbyLabel={headerMeta}
          qrCode={activeRide?.qrCode}
          distanceMeters={tracker.distanceMeters}
          elapsedSeconds={tracker.elapsedSeconds}
          dropHubName={dropTarget?.hub.name ?? null}
        />

        <div className="yc-app-ui">
          <header className="px-3 pb-1" style={{ paddingTop: 'var(--header-top)' }}>
            <div className="yc-glass yc-glass-header flex items-center gap-3 px-3.5 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/isha-logo.jpeg"
                alt="Isha Foundation"
                className="h-10 w-10 rounded-[0.85rem] object-cover shrink-0 ring-1 ring-white/50"
              />
              <div className="min-w-0 flex-1 pr-1">
                <p className="yc-eyebrow">Isha Yoga Center</p>
                <h1 className="yc-display text-[19px] truncate mt-0.5">Yellow Cycle</h1>
              </div>
              <div className="text-right shrink-0 pl-2.5 border-l border-[var(--separator)] max-w-[7.5rem]">
                <p className="yc-title yc-title-sm tabular-nums leading-none">{headerReady}</p>
                <p className="yc-meta mt-1 truncate" title={headerMeta}>
                  {userPos || tracker.currentPos ? 'near you' : 'ready'}
                </p>
                {(userPos || tracker.currentPos) && (
                  <p className="yc-meta mt-0.5 truncate opacity-80">{headerMeta}</p>
                )}
              </div>
            </div>
            {showMap && !userPos && !tracker.currentPos && !activeRide && (
              <button
                type="button"
                onClick={() => {
                  navigator.geolocation?.getCurrentPosition(
                    (position) => {
                      setUserPos([position.coords.latitude, position.coords.longitude]);
                    },
                    () => undefined,
                    { enableHighAccuracy: true, timeout: 12000 }
                  );
                }}
                className="yc-glass mt-2 w-full text-left px-3.5 py-2.5 rounded-[1.1rem] text-[12px] text-[var(--ink-2)]"
              >
                Share location to sort docks by distance — tap here or use Locate.
              </button>
            )}
          </header>

          {showMap && <div className="yc-app-spacer" />}

          <div
            className={`yc-bottom-stack ${sheetExpanded ? 'is-expanded' : 'is-peek'}${
              showMap ? '' : ' is-full'
            }`}
          >
            {activeRide ? (
              <div className="yc-sheet p-4" ref={slideRef}>
                <div
                  className="yc-sheet-handle yc-sheet-handle-hit"
                  onPointerDown={onSheetHandlePointerDown}
                  onPointerUp={onSheetHandlePointerUp}
                  role="separator"
                  aria-label={sheetExpanded ? 'Swipe down to collapse' : 'Swipe up to expand'}
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="yc-eyebrow">Step 2 · Riding</p>
                    <p className="yc-mono yc-title yc-title-md truncate mt-1.5">{activeRide.qrCode}</p>
                    {rider && sheetExpanded && (
                      <p className="yc-body-sm mt-1.5 truncate">
                        {rider.name} · {rider.phone}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <p className="yc-title yc-title-md tabular-nums">
                      {(tracker.distanceMeters / 1000).toFixed(2)} km
                    </p>
                    <p className="yc-meta mt-1">{formatDuration(tracker.elapsedSeconds)}</p>
                  </div>
                </div>
                {sheetExpanded && (
                  <>
                    <p className="yc-body mt-3.5 mb-3">
                      {nearDrop && dropTarget
                        ? `You are at ${dropTarget.hub.name}. Slide to leave the cycle here.`
                        : dropTarget
                          ? `Nearest open dock: ${dropTarget.hub.name}${
                              Number.isFinite(dropTarget.meters)
                                ? ` · ${formatDistance(dropTarget.meters)}`
                                : ''
                            }. Ride closer to slide-drop.`
                          : 'Ride to a dock, then return the cycle so the map count updates.'}
                    </p>
                    <SlideToConfirm
                      armed={nearDrop}
                      armedLabel={
                        dropTarget
                          ? origin
                            ? `Slide to drop off · ${dropTarget.hub.name}`
                            : `No GPS · slide if at ${dropTarget.hub.name}`
                          : 'Slide to drop off'
                      }
                      disabledLabel={
                        dropTarget
                          ? `Get within ~75 m of ${dropTarget.hub.name}`
                          : 'No open dock nearby'
                      }
                      onConfirm={() => {
                        void confirmNearDrop();
                      }}
                    />
                    <button type="button" onClick={openReturn} className="yc-btn-ghost mt-2">
                      Choose another dock
                    </button>
                    <button type="button" onClick={openScan} className="yc-btn-ghost mt-1">
                      Scan a different code
                    </button>
                  </>
                )}
                {!sheetExpanded && (
                  <p className="yc-meta mt-2 text-center">Swipe handle up for drop-off controls</p>
                )}
              </div>
            ) : tab === 'report' ? (
              <ReportFaultPanel
                userId={rider?.id ?? null}
                userPos={userPos}
                prefilledQr={reportQr}
                onScanRequest={() => {
                  setScanTarget('report');
                  setShowScanner(true);
                }}
                onDone={() => {
                  setReportQr(null);
                  setTab('cycles');
                  void refreshHubs();
                }}
                onNeedIdentity={() => setNeedsIdentity(true)}
              />
            ) : tab === 'lost-found' ? (
              <LostFoundPanel
                userId={rider?.id ?? null}
                hubs={hubs}
                userPos={userPos}
                onNeedIdentity={() => setNeedsIdentity(true)}
              />
            ) : (
              <>
                <div className="yc-sheet">
                  <div
                    className="yc-sheet-handle yc-sheet-handle-hit"
                    onPointerDown={onSheetHandlePointerDown}
                    onPointerUp={onSheetHandlePointerUp}
                    role="separator"
                    aria-label={sheetExpanded ? 'Swipe down to collapse' : 'Swipe up to expand'}
                  />
                  <div className="px-4 pt-1 pb-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="yc-eyebrow">Step 1 · Find a dock</p>
                      <p className="yc-title yc-title-sm mt-1.5 truncate">
                        {selectedHub ? selectedHub.name : 'Nearby docks'}
                      </p>
                      {selectedHub && (
                        <p className="yc-body-sm mt-1.5">
                          <span className="yc-strong text-[var(--ink)]">{availableCount(selectedHub)}</span>
                          {' '}
                          yellow cycle{availableCount(selectedHub) === 1 ? '' : 's'} ready now
                        </p>
                      )}
                    </div>
                    {selectedHub && (
                      <button
                        type="button"
                        onClick={() => setSelectedHubId(null)}
                        className="yc-strong text-[var(--muted)] shrink-0 min-h-11 min-w-11 px-3 rounded-2xl border border-[var(--separator)] bg-white/50 text-[13px]"
                      >
                        All
                      </button>
                    )}
                  </div>

                  <div
                    className={`overflow-y-auto overscroll-contain divide-y divide-[var(--separator)] ${
                      sheetExpanded ? 'max-h-40' : 'max-h-[4.5rem]'
                    }`}
                  >
                    {sheetRows.map(({ hub, meters }) => {
                      const available = availableCount(hub);
                      const faults = faultCount(hub);
                      const selected = hub.id === selectedHubId;
                      return (
                        <button
                          key={hub.id}
                          type="button"
                          onClick={() => {
                            setSelectedHubId(hub.id);
                            setSheetExpanded(true);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 text-left min-h-[3.5rem] transition-colors ${
                            selected ? 'bg-primary/18' : 'active:bg-black/[0.03]'
                          }`}
                        >
                          <div
                            className={`w-11 h-11 rounded-[1.05rem] flex items-center justify-center shrink-0 text-[15px] yc-strong shadow-sm ${
                              faults > 0
                                ? 'bg-rose-100 text-rose-800'
                                : available === 0
                                  ? 'bg-[var(--surface-2)] text-[var(--faint)]'
                                  : 'bg-primary text-[var(--ink)]'
                            }`}
                          >
                            {available}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="yc-title yc-title-sm truncate">{hub.name}</p>
                            <p className="yc-body-sm mt-1">
                              {available === 0 ? 'No bikes right now' : `${available} available`}
                              {Number.isFinite(meters) ? ` · ${formatDistance(meters)}` : ''}
                              {faults > 0 ? ` · ${faults} with staff` : ''}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1.5 px-3">
                  <button type="button" onClick={openScan} className="yc-btn-fab">
                    <QrCode className="w-5 h-5" />
                    Scan to unlock
                  </button>
                  {checkedStorage && !rider && (
                    <p className="yc-meta text-center px-4 max-w-[18rem]">
                      First scan asks for your name and phone, then unlocks the cycle.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Nav sits below the sheet; hidden during an active ride so the
                drop-off controls stay the only thing to act on. */}
            {!activeRide && <BottomNav active={tab} onChange={setTab} />}
          </div>
        </div>

        {needsIdentity && (
          <IdentityGate
            onClose={() => setNeedsIdentity(false)}
            onIdentified={(identity) => {
              setRider(identity);
              setNeedsIdentity(false);
              setShowScanner(true);
            }}
          />
        )}

        {showScanner && (
          <QRScanner
            onScanSuccess={(code) => {
              setShowScanner(false);
              if (scanTarget === 'report') {
                setReportQr(code);
                setScanTarget('unlock');
                setTab('report');
                return;
              }
              setActiveQr(code);
            }}
            onClose={() => {
              setShowScanner(false);
              setScanTarget('unlock');
            }}
          />
        )}

        {faultVerdict && (
          <div className="absolute inset-x-0 bottom-0 z-50 p-4" role="alert">
            <div
              className="yc-glass-sheet p-4 flex items-start gap-3"
              style={{ borderTop: '3px solid #d03b3b' }}
            >
              <ShieldAlert
                className="w-5 h-5 shrink-0 mt-0.5"
                style={{ color: '#d03b3b' }}
              />
              <div className="flex-1 min-w-0">
                <p className="yc-title yc-title-sm" style={{ color: '#d03b3b' }}>
                  Do not ride this cycle
                </p>
                <p className="yc-body-sm mt-0.5">{faultVerdict}</p>
                <p className="yc-meta mt-1">
                  It has been pulled from service and staff are notified.
                </p>
              </div>
              <button
                onClick={() => setFaultVerdict(null)}
                className="yc-btn-ghost text-xs px-3 py-1.5 shrink-0"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {activeQr && rider && (
          <ActionModal
            qrCode={activeQr}
            hubs={hubs}
            userId={rider.id}
            tracker={tracker}
            userPos={userPos}
            activeRideQr={activeRide?.qrCode ?? null}
            onClose={() => setActiveQr(null)}
            onUnlocked={async (code) => {
              saveStoredRide({ qrCode: code, startedAt: Date.now() });
              tracker.reset();
              tracker.start();
              setActiveRide({
                id: code,
                qrCode: code,
                status: 'IN_USE',
                currentHubId: '',
                heldByUserId: rider.id,
                issueNotes: null,
                currentHub: null,
                heldByUser: { name: rider.name, phone: rider.phone },
              });
              setActiveQr(null);
              setSelectedHubId(null);
              setSheetExpanded(true);
              await refreshHubs();
            }}
            onReturned={async () => {
              await endRideLocally();
            }}
            onFaulted={async (triage) => {
              await endRideLocally();
              // An unsafe verdict is the one thing the rider must not miss.
              if (triage && !triage.safeToRide) {
                setFaultVerdict(triage.summary);
              }
            }}
          />
        )}
      </div>
    </PhoneShell>
  );
}
