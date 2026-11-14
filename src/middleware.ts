import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifySession } from '@/lib/session';

/**
 * Penjaga halaman: semua rute butuh login kecuali /login dan /api/auth/*.
 *
 * Next.js 16: file ini sudah berganti nama menjadi proxy.ts dan fungsinya `proxy`.
 * middleware.ts masih berjalan (dengan peringatan deprecated). Untuk migrasi:
 *   npx @next/codemod@canary middleware-to-proxy .
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isPublic = pathname === '/login' || pathname.startsWith('/api/auth/');

  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);

  if (!session && !isPublic) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ ok: false, error: 'Belum login.' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    if (pathname !== '/') url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }

  if (session && pathname === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isPublic || pathname.startsWith('/api/')) res.headers.set('Cache-Control', 'no-store');
  return res;
}

export const config = {
  // Lewati file statis (gambar, font, json di /public, dll.)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|json|txt|woff2?)$).*)'],
};