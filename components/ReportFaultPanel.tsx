'use client';

import { useState } from 'react';
import { Camera, QrCode, ShieldAlert, CheckCircle2, X } from 'lucide-react';
import { reportFault } from '@/app/actions';

/**
 * Standalone fault reporting, reachable from the bottom nav without unlocking
 * a cycle first.
 *
 * The common case this serves: someone walks past a cycle that is obviously
 * broken and wants to flag it. Previously that meant scanning to check the
 * cycle out, which is both wrong and something people won't do.
 */

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read photo'));
    reader.readAsDataURL(file);
  });
}

interface Triage {
  category: string;
  severity: string;
  safeToRide: boolean;
  summary: string;
}

export default function ReportFaultPanel({
  userId,
  userPos,
  onScanRequest,
  prefilledQr,
  onDone,
  onNeedIdentity,
}: {
  userId: string | null;
  userPos: [number, number] | null;
  onScanRequest: () => void;
  prefilledQr?: string | null;
  onDone: () => void;
  /** Called when a report is ready but the rider has not identified yet. */
  onNeedIdentity: () => void;
}) {
  const [qrCode, setQrCode] = useState(prefilledQr ?? '');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [triage, setTriage] = useState<Triage | null>(null);

  const canSubmit = qrCode.trim().length > 0 && notes.trim().length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    if (!userId) {
      onNeedIdentity();
      return;
    }
    setStatus('sending');
    try {
      const [lat, lng] = userPos ?? [undefined, undefined];
      const result = await reportFault(
        qrCode,
        userId,
        notes,
        lat,
        lng,
        photo ?? undefined
      );
      setTriage(result.triage);
      setStatus('done');
    } catch (error: unknown) {
      setMessage(
        error instanceof Error ? error.message : 'Could not send the report.'
      );
      setStatus('error');
    }
  };

  if (status === 'done') {
    const unsafe = triage && !triage.safeToRide;
    return (
      <div className="yc-sheet yc-sheet-solid p-5 text-center">
        {unsafe ? (
          <ShieldAlert className="w-12 h-12 mx-auto mb-2" style={{ color: '#d03b3b' }} />
        ) : (
          <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-emerald-600" />
        )}
        <h3 className="yc-title yc-title-md" style={unsafe ? { color: '#d03b3b' } : undefined}>
          {unsafe ? 'Do not ride this cycle' : 'Thank you — reported'}
        </h3>
        <p className="yc-body-sm mt-1">
          {unsafe
            ? 'It has been pulled from service and staff are notified.'
            : 'Staff have been notified and will service it.'}
        </p>

        {triage && (
          <div className="mt-3 p-3 rounded-[1.05rem] text-left" style={{ background: 'var(--surface-2)' }}>
            <p className="yc-eyebrow mb-1">Assessed automatically</p>
            <p className="text-xs font-semibold">{triage.summary}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/70">
                {triage.severity}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/70">
                {triage.category}
              </span>
            </div>
          </div>
        )}

        <button type="button" onClick={onDone} className="yc-btn-primary w-full mt-4">
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="yc-sheet yc-sheet-solid p-5 space-y-3">
      <div>
        <h3 className="yc-title yc-title-md">Report a problem</h3>
        <p className="yc-body-sm mt-0.5">
          Flag a cycle that needs staff attention. You do not need to unlock it.
        </p>
      </div>

      <div>
        <label className="yc-eyebrow block mb-1">Cycle code</label>
        <div className="flex gap-2 items-stretch min-w-0">
          <input
            value={qrCode}
            onChange={(e) => setQrCode(e.target.value.toUpperCase())}
            placeholder="ISHA-CYC-101"
            className="yc-field is-flex yc-mono"
            inputMode="text"
            autoCapitalize="characters"
          />
          <button
            type="button"
            onClick={onScanRequest}
            className="yc-btn-ghost is-icon shrink-0"
            aria-label="Scan the code instead"
          >
            <QrCode className="w-4 h-4" />
          </button>
        </div>
        <p className="yc-meta mt-1">Printed on the cycle frame, or scan it.</p>
      </div>

      <div>
        <label className="yc-eyebrow block mb-1">What is wrong?</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Back brake barely works…"
          className="yc-field w-full resize-none"
        />
      </div>

      <div>
        {photo ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt="Attached fault photo"
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
            <span className="text-xs font-semibold">Add a photo (helps staff)</span>
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
      </div>

      {status === 'error' && (
        <p className="text-xs" style={{ color: '#d03b3b' }}>
          {message}
        </p>
      )}

      {!userId && (
        <p className="yc-meta">
          You will be asked for your name and phone before the report is sent.
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit || status === 'sending'}
        className="yc-btn-primary w-full disabled:opacity-50"
      >
        {status === 'sending' ? 'Sending…' : 'Send report'}
      </button>
    </div>
  );
}
