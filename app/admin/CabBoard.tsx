'use client';

import { useState } from 'react';
import { Phone, Clock, Check, X } from 'lucide-react';
import { setCabStatus, type CabRequestRow } from '@/app/cab-actions';

/**
 * The cab queue.
 *
 * Read at a desk by someone deciding what to do next, so the ordering is by
 * what still needs action rather than by recency alone, and each row carries
 * the phone number as a tappable link — arranging a cab means calling the
 * person back.
 */

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Waiting',
  ACCEPTED: 'Accepted',
  COMPLETED: 'Done',
  CANCELLED: 'Cancelled',
};

function whenLabel(row: CabRequestRow) {
  if (!row.whenAt) return 'As soon as possible';
  const d = new Date(row.whenAt);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function askedLabel(createdAt: Date) {
  const mins = Math.round((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
}

export default function CabBoard({ requests }: { requests: CabRequestRow[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [rows, setRows] = useState(requests);

  const advance = async (id: string, status: 'ACCEPTED' | 'COMPLETED' | 'CANCELLED') => {
    setBusy(id);
    try {
      await setCabStatus(id, status);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    } finally {
      setBusy(null);
    }
  };

  const waiting = rows.filter((r) => r.status === 'REQUESTED' || r.status === 'ACCEPTED');
  const settled = rows.filter((r) => r.status === 'COMPLETED' || r.status === 'CANCELLED');

  if (rows.length === 0) {
    return (
      <p className="s-body">Nobody is waiting for a cab.</p>
    );
  }

  const card = (r: CabRequestRow) => (
    <li key={r.id} className="s-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="s-h3">
            {r.pickup} &rarr; {r.destination}
          </p>
          <p className="s-meta mt-1">
            {r.requestedBy.name}
            {' · '}
            {r.scope === 'OUTSIDE' ? 'Outside the ashram' : 'Within the ashram'}
            {' · asked '}
            {askedLabel(r.createdAt)}
          </p>
          <p className="s-meta mt-1 flex items-center gap-1.5">
            <Clock className="w-3 h-3 shrink-0" aria-hidden />
            {whenLabel(r)}
          </p>
          {r.note && <p className="s-body-sm mt-1.5">{r.note}</p>}
          <a className="s-contact mt-1.5" href={`tel:${r.requestedBy.phone}`}>
            <Phone className="w-3 h-3 shrink-0" aria-hidden />
            {r.requestedBy.phone}
          </a>
        </div>
        <span className={`s-chip ${r.status === 'REQUESTED' ? 's-chip-alert' : 's-chip-neutral'}`}>
          {STATUS_LABEL[r.status] ?? r.status}
        </span>
      </div>

      {(r.status === 'REQUESTED' || r.status === 'ACCEPTED') && (
        <div className="flex items-center gap-2 mt-3">
          {r.status === 'REQUESTED' && (
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => void advance(r.id, 'ACCEPTED')}
              className="s-btn s-btn-primary"
            >
              <Check className="w-3.5 h-3.5" aria-hidden />
              Accept
            </button>
          )}
          {r.status === 'ACCEPTED' && (
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => void advance(r.id, 'COMPLETED')}
              className="s-btn s-btn-primary"
            >
              <Check className="w-3.5 h-3.5" aria-hidden />
              Done
            </button>
          )}
          <button
            type="button"
            disabled={busy === r.id}
            onClick={() => void advance(r.id, 'CANCELLED')}
            className="s-btn s-btn-quiet"
          >
            <X className="w-3.5 h-3.5" aria-hidden />
            Cancel
          </button>
        </div>
      )}
    </li>
  );

  return (
    <div className="space-y-5">
      {waiting.length > 0 && (
        <section>
          <h3 className="s-h2">
            Waiting <span className="s-count">{waiting.length}</span>
          </h3>
          <ul className="s-feed">{waiting.map(card)}</ul>
        </section>
      )}

      {settled.length > 0 && (
        <section>
          <h3 className="s-h2">
            Settled <span className="s-count">{settled.length}</span>
          </h3>
          <ul className="s-feed">{settled.map(card)}</ul>
        </section>
      )}
    </div>
  );
}
