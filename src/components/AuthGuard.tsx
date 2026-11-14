'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AUTH_KEY, clearAuthUser, fetchSession, logout, setAuthUser } from '@/lib/auth';

/** Keluar otomatis bila tidak ada aktivitas selama ini. Isi 0 untuk mematikan. */
const IDLE_MS = 60 * 60 * 1000; // 60 menit

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      // Sesi diverifikasi ke server (cookie httpOnly). Bila offline, cache terakhir dipakai
      // agar kasir tidak terlempar keluar hanya karena koneksi putus sesaat.
      const { user, offline } = await fetchSession();
      if (cancelled) return;

      if (user) {
        if (!offline) setAuthUser(user);
      } else {
        clearAuthUser();
      }

      if (!user && pathname !== '/login') {
        router.replace('/login');
        return;
      }

      if (user && pathname === '/login') {
        router.replace('/');
        return;
      }

      setChecked(true);
    };

    check();

    // Logout / login di tab lain langsung tersinkron
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_KEY || e.key === null) check();
    };
    window.addEventListener('storage', onStorage);

    // Cek kedaluwarsa sesi berkala
    const timer = window.setInterval(check, 60_000);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
      window.clearInterval(timer);
    };
  }, [pathname, router]);

  // Keluar otomatis saat tidak ada aktivitas
  useEffect(() => {
    if (!IDLE_MS || pathname === '/login') return;

    let timer: ReturnType<typeof setTimeout> = setTimeout(logout, IDLE_MS);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(logout, IDLE_MS);
    };
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [pathname]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)]">
        <p className="text-sm font-medium text-slate-500">Memeriksa sesi login...</p>
      </div>
    );
  }

  return <>{children}</>;
}