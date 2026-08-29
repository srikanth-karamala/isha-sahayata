'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE_NAME } from '@/lib/admin-auth';

// Lightweight passcode gate for /admin — not full auth, just enough to keep
// the maintenance dashboard from being wide open to anyone who finds the URL.
export async function adminLogin(passcode: string) {
  const expected = process.env.ADMIN_PASSCODE;
  if (!expected) throw new Error('Admin passcode is not configured on the server.');

  if (passcode !== expected) {
    throw new Error('Incorrect passcode.');
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours
  });

  redirect('/admin');
}

export async function adminLogout() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  redirect('/admin/login');
}
