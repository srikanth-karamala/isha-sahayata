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
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-3xl border border-stone-200 w-full max-w-sm p-7 space-y-5"
    >
      <div className="flex flex-col items-center text-center gap-2">
        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
          <Lock className="w-6 h-6 text-stone-900" />
        </div>
        <h1 className="text-lg font-semibold text-stone-900">Staff access</h1>
        <p className="text-xs text-stone-500">Enter the maintenance passcode.</p>
      </div>

      <div>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          autoFocus
          className="w-full bg-stone-50 border border-stone-200 text-stone-900 text-sm rounded-2xl p-3 outline-none focus:border-stone-400"
        />
        {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
      </div>

      <button
        type="submit"
        disabled={isPending || !passcode}
        className="w-full py-3 bg-primary text-stone-900 font-semibold text-sm rounded-2xl disabled:opacity-50"
      >
        {isPending ? 'Checking…' : 'Enter'}
      </button>
    </form>
  );
}
