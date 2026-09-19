'use client';

import { useState, useTransition } from 'react';
import { Lock } from 'lucide-react';
import { adminLogin } from '../auth-actions';

export default function LoginForm() {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      try {
        await adminLogin(passcode);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        if (message !== 'NEXT_REDIRECT') {
          setError(message);
        } else {
          throw err;
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="yc-panel w-full max-w-sm p-7 space-y-5">
      <div className="flex flex-col items-center text-center gap-2">
        <div className="w-12 h-12 rounded-[1.15rem] bg-primary flex items-center justify-center shadow-sm ring-1 ring-white/40">
          <Lock className="w-6 h-6 text-[var(--ink)]" />
        </div>
        <h1 className="yc-display text-[22px]">Staff access</h1>
        <p className="yc-body-sm">Enter the maintenance passcode.</p>
      </div>

      <div>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          autoFocus
          className="yc-field"
        />
        {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
      </div>

      <button
        type="submit"
        disabled={isPending || !passcode}
        className="yc-btn-primary disabled:opacity-50"
      >
        {isPending ? 'Checking…' : 'Enter'}
      </button>
    </form>
  );
}
