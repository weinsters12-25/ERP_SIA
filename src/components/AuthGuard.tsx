'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AUTH_KEY } from '@/lib/auth';

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const isLoggedIn = !!localStorage.getItem(AUTH_KEY);

    if (!isLoggedIn && pathname !== '/login') {
      router.replace('/login');
      return;
    }

    if (isLoggedIn && pathname === '/login') {
      router.replace('/');
      return;
    }

    setChecked(true);
  }, [pathname, router]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)]">
        <p className="text-sm font-medium text-slate-500">
          Memeriksa sesi login...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}