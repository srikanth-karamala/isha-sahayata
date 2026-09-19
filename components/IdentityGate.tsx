'use client';

import { useState } from 'react';
import { User, ArrowRight, X } from 'lucide-react';
import { getOrCreateUser } from '@/app/actions';
import { saveRiderIdentity } from '@/lib/rider-identity';
import SwipeDismiss from './SwipeDismiss';

interface IdentityGateProps {
  onIdentified: (identity: { id: string; name: string; phone: string }) => void;
  onClose?: () => void;
}

export default function IdentityGate({ onIdentified, onClose }: IdentityGateProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await getOrCreateUser(name, phone);
      const identity = { id: user.id, name: user.name, phone: user.phone };
      saveRiderIdentity(identity);
      onIdentified(identity);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SwipeDismiss onDismiss={() => onClose?.()}>
      <form onSubmit={handleSubmit}>
        <div className="px-5 pt-2 pb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[1.1rem] bg-primary flex items-center justify-center shadow-sm ring-1 ring-white/40">
              <User className="w-5 h-5 text-[var(--ink)]" />
            </div>
            <div>
              <p className="yc-eyebrow">Quick introduction</p>
              <h3 className="yc-display text-[22px] mt-1">Who is riding?</h3>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-black/[0.04] text-[var(--muted)]"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          <p className="yc-body-sm">
            Name and phone only — so the cycle you unlock is tied back to you.
          </p>

          <div>
            <label className="yc-strong block text-[12.5px] text-[var(--ink-2)] mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Arun Kumar"
              autoFocus
              className="yc-field"
            />
          </div>

          <div>
            <label className="yc-strong block text-[12.5px] text-[var(--ink-2)] mb-1.5">Phone number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className="yc-field"
            />
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || !name.trim() || !phone.trim()}
            className="yc-btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              'Continuing…'
            ) : (
              <>
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <p className="yc-meta text-center">Swipe down or from the left edge to cancel</p>
        </div>
      </form>
    </SwipeDismiss>
  );
}
