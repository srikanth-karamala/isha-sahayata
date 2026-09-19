'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { X, Camera, QrCode, Keyboard, ArrowRight, CameraOff } from 'lucide-react';
import SwipeDismiss from './SwipeDismiss';

interface QRScannerProps {
  onScanSuccess: (qrCode: string) => void;
  onClose: () => void;
}

type ScannerHandle = {
  getState: () => number;
  stop: () => Promise<void>;
  clear: () => void;
};

async function safeStop(scanner: ScannerHandle | null) {
  if (!scanner) return;
  try {
    const state = scanner.getState();
    // 2 = SCANNING, 3 = PAUSED — stop() throws a string if called otherwise
    if (state === 2 || state === 3) {
      await scanner.stop();
    }
  } catch {
    // Never started, already stopped, or camera never opened
  }
  try {
    scanner.clear();
  } catch {
    // Viewport already unmounted
  }
}

export default function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const [manualCode, setManualCode] = useState('');
  const [error, setError] = useState('');
  const [cameraState, setCameraState] = useState<'starting' | 'active' | 'denied' | 'unavailable'>('starting');
  const scannerRef = useRef<ScannerHandle | null>(null);
  const hasScannedRef = useRef(false);
  const onScanSuccessRef = useRef(onScanSuccess);
  const uid = useId().replace(/:/g, '');
  const elementId = `yc-qr-${uid}`;

  onScanSuccessRef.current = onScanSuccess;

  useEffect(() => {
    let cancelled = false;
    let startPromise: Promise<null> | null = null;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (cancelled) return;
      if (!document.getElementById(elementId)) return;

      const scanner = new Html5Qrcode(elementId, { verbose: false });
      scannerRef.current = scanner;

      startPromise = scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText: string) => {
          if (hasScannedRef.current) return;
          hasScannedRef.current = true;
          const code = decodedText.trim().toUpperCase();
          void safeStop(scanner).finally(() => {
            onScanSuccessRef.current(code);
          });
        },
        () => undefined
      );

      void startPromise
        .then(() => {
          if (cancelled) {
            void safeStop(scanner);
            return;
          }
          setCameraState('active');
        })
        .catch(() => {
          if (!cancelled) setCameraState('denied');
        });
    }).catch(() => {
      if (!cancelled) setCameraState('unavailable');
    });

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      const pendingStart = startPromise;
      void (async () => {
        try {
          if (pendingStart) await pendingStart;
        } catch {
          // start failed or never began
        }
        await safeStop(scanner);
        scannerRef.current = null;
      })();
    };
  }, [elementId]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = manualCode.trim().toUpperCase();
    if (!formatted) {
      setError('Please enter a valid cycle QR code.');
      return;
    }
    hasScannedRef.current = true;
    void safeStop(scannerRef.current).finally(() => {
      onScanSuccess(formatted);
    });
  };

  return (
    <SwipeDismiss onDismiss={onClose}>
      <div>
        <div className="px-5 pt-2 pb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[1.1rem] bg-primary flex items-center justify-center shadow-sm ring-1 ring-white/40">
              <QrCode className="w-5 h-5 text-[var(--ink)]" />
            </div>
            <div>
              <p className="yc-eyebrow">Frame sticker</p>
              <h3 className="yc-display text-[20px] mt-1">Scan to continue</h3>
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

        <div className="p-5 space-y-5">
          <div className="relative bg-stone-900 rounded-2xl overflow-hidden aspect-video">
            <div id={elementId} className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />

            {cameraState === 'starting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-stone-900">
                <Camera className="w-6 h-6 text-primary mb-2" />
                <p className="text-xs font-medium text-stone-300">Asking for camera…</p>
              </div>
            )}

            {cameraState === 'active' && (
              <p className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-white/80 font-medium">
                Point at the cycle frame sticker
              </p>
            )}

            {(cameraState === 'denied' || cameraState === 'unavailable') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-stone-900">
                <CameraOff className="w-6 h-6 text-rose-400 mb-2" />
                <p className="text-xs font-medium text-stone-300">
                  {cameraState === 'denied' ? 'Camera access denied' : 'Camera unavailable on this device'}
                </p>
                <p className="text-[10px] text-stone-500 mt-1">Type the code below instead</p>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 text-[var(--ink-2)] text-xs font-semibold mb-3">
              <Keyboard className="w-4 h-4" />
              <span>Or type the code</span>
            </div>
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => {
                  setManualCode(e.target.value);
                  setError('');
                }}
                placeholder="e.g. ISHA-CYC-101"
                className="yc-field font-mono uppercase placeholder:normal-case"
              />
              {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
              <button
                type="submit"
                className="yc-btn-primary flex items-center justify-center gap-2"
              >
                <span>Use this code</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
            <p className="yc-meta text-center mt-3">Swipe down or from the left edge to close</p>
          </div>
        </div>
      </div>
    </SwipeDismiss>
  );
}
