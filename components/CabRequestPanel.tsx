'use client';

import { useEffect, useState } from 'react';
import { Car, CheckCircle2, Phone, Clock } from 'lucide-react';
import { requestCab, getMyCabRequests } from '@/app/cab-actions';
import { getOrCreateUser } from '@/app/actions';
import { saveRiderIdentity, type RiderIdentity } from '@/lib/rider-identity';

/**
 * Asking for a cab — across the campus, or out to the airport or station.
 *
 * This is a request, not a booking. Nothing dispatches a vehicle; the ask
 * lands in the staff console for a person to act on. The confirmation
 * therefore says what was sent and gives the desk's number, rather than
 * implying a cab is on its way — the difference matters to someone standing
 * outside with a suitcase.
 */

type Scope = 'INSIDE' | 'OUTSIDE';
type MyRequest = Awaited<ReturnType<typeof getMyCabRequests>>[number];

const STATUS_WORDS: Record<string, string> = {
  REQUESTED: 'Waiting for the desk',
  ACCEPTED: 'Accepted',
  COMPLETED: 'Done',
  CANCELLED: 'Cancelled',
};

export default function CabRequestPanel({
  userId,
  riderName,
  riderPhone,
  onIdentityChange,
}: {
  userId: string | null;
  riderName: string;
  riderPhone: string;
  onIdentityChange?: (identity: RiderIdentity) => void;
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>('INSIDE');
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [when, setWhen] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [mine, setMine] = useState<MyRequest[]>([]);

  // Same shape as LostFoundPanel: an edit overrides the saved identity without
  // an effect writing props into state.
  const [nameEdit, setNameEdit] = useState<string | null>(null);
  const [phoneEdit, setPhoneEdit] = useState<string | null>(null);
  const name = nameEdit ?? riderName;
  const phone = phoneEdit ?? riderPhone;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const id = setTimeout(() => {
      void getMyCabRequests(userId).then((r) => {
        if (!cancelled) setMine(r);
      });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [userId, status]);

  const canSend = pickup.trim() && destination.trim() && name.trim() && phone.trim();

  const submit = async () => {
    if (!canSend) return;
    setStatus('sending');
    setMessage('');
    try {
      // The rider may not have identified yet — the same upsert-by-phone the
      // lost & found form uses, so one person is one User either way.
      let id = userId;
      if (!id) {
        const user = await getOrCreateUser(name, phone);
        const identity = { id: user.id, name: user.name, phone: user.phone };
        saveRiderIdentity(identity);
        onIdentityChange?.(identity);
        id = user.id;
      }

      await requestCab({
        userId: id,
        pickup,
        destination,
        scope,
        whenAt: when ? new Date(when).toISOString() : null,
      });
      setStatus('sent');
    } catch (err: unknown) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Could not send the request.');
    }
  };

  const reset = () => {
    setPickup('');
    setDestination('');
    setWhen('');
    setStatus('idle');
    setMessage('');
    setOpen(false);
  };

  if (status === 'sent') {
    return (
      <div className="yc-info-card yc-cab-card">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-[var(--primary-dark)]" aria-hidden />
          <div className="min-w-0">
            <p className="yc-title yc-title-sm">Request sent to the desk</p>
            <p className="yc-body-sm mt-1.5">
              {pickup} to {destination}
              {when ? `, for ${new Date(when).toLocaleString()}` : ', as soon as possible'}.
            </p>
            {/* Not a confirmation. Someone has to see this and act on it. */}
            <p className="yc-route-hours mt-2">
              <Clock className="w-3 h-3 shrink-0 mt-[2px]" aria-hidden />
              <span>
                Nobody has accepted it yet. To check or change it, call the desk
                on{' '}
                <a href="tel:+918300083111" className="yc-info-tel">
                  +91 83000 83111
                </a>
                .
              </span>
            </p>
            <button type="button" onClick={reset} className="yc-btn-ghost mt-2.5">
              Ask for another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="yc-cab-section">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="yc-eyebrow">Isha cab</p>
          <p className="yc-title yc-title-sm mt-1">Ask for a cab</p>
          <p className="yc-body-sm mt-1">
            Across the campus, or out to the airport, the station or the city.
          </p>
        </div>
        <Car className="w-5 h-5 shrink-0 mt-1 opacity-45" aria-hidden />
      </div>

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="yc-cab-open">
          Ask for a cab
        </button>
      ) : (
        <div className="mt-3 space-y-2.5">
          {/* Inside or outside decides which vehicle the desk sends, so it is
              asked first and as a choice rather than free text. */}
          <div className="yc-cab-scope" role="radiogroup" aria-label="Where to">
            {(['INSIDE', 'OUTSIDE'] as Scope[]).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={scope === s}
                onClick={() => setScope(s)}
                className={`yc-cab-scope-btn${scope === s ? ' is-active' : ''}`}
              >
                {s === 'INSIDE' ? 'Within the ashram' : 'Outside'}
              </button>
            ))}
          </div>

          <div>
            <label className="yc-eyebrow block mb-1" htmlFor="cab-pickup">
              Pick up from
            </label>
            <input
              id="cab-pickup"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              placeholder={scope === 'INSIDE' ? 'Welcome Point' : 'Main Gate'}
              className="yc-field w-full"
            />
          </div>

          <div>
            <label className="yc-eyebrow block mb-1" htmlFor="cab-dest">
              Going to
            </label>
            <input
              id="cab-dest"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder={scope === 'INSIDE' ? 'Biksha Hall' : 'Coimbatore airport'}
              className="yc-field w-full"
            />
          </div>

          <div>
            <label className="yc-eyebrow block mb-1" htmlFor="cab-when">
              When
            </label>
            <input
              id="cab-when"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="yc-field w-full"
            />
            <p className="yc-meta mt-1">Leave empty for as soon as possible.</p>
          </div>

          {/* Only asked when it is not already known, same as the fault report. */}
          {(!riderName || !riderPhone) && (
            <div className="grid grid-cols-2 gap-2">
              <input
                value={name}
                onChange={(e) => setNameEdit(e.target.value)}
                placeholder="Your name"
                className="yc-field w-full"
                aria-label="Your name"
              />
              <input
                value={phone}
                onChange={(e) => setPhoneEdit(e.target.value)}
                placeholder="Phone"
                inputMode="tel"
                className="yc-field w-full"
                aria-label="Your phone number"
              />
            </div>
          )}

          {message && <p className="yc-cab-error">{message}</p>}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSend || status === 'sending'}
            className="yc-btn-primary"
          >
            {status === 'sending' ? 'Sending…' : 'Send to the desk'}
          </button>
          <button type="button" onClick={reset} className="yc-btn-ghost">
            Cancel
          </button>
        </div>
      )}

      {mine.length > 0 && !open && (
        <div className="yc-cab-mine">
          <p className="yc-eyebrow">You asked for</p>
          <ul>
            {mine.map((r) => (
              <li key={r.id}>
                <span className="min-w-0">
                  {r.pickup} → {r.destination}
                </span>
                <span className="yc-meta shrink-0">
                  {STATUS_WORDS[r.status] ?? r.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="yc-info-foot">
        <Phone className="w-3 h-3 shrink-0 mt-[2px] opacity-55" aria-hidden />
        <span>
          A request reaches the desk, where someone arranges the cab — it is
          not an automatic booking.
        </span>
      </p>
    </div>
  );
}
