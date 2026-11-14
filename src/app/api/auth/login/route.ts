import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, SESSION_LONG_S, SESSION_SHORT_S, signSession } from '@/lib/session';
import { DUMMY_HASH, findUser, getClientIp, isSameOrigin, verifyPassword } from '@/lib/auth.server';
import { MAX_ATTEMPTS, checkLimit, recordFailure, recordSuccess } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GENERIC_ERROR = 'Username atau password salah.';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const tooMany = (retryAfter: number) =>
  NextResponse.json(
    {
      ok: false,
      error: `Terlalu banyak percobaan. Coba lagi dalam ${retryAfter >= 60 ? `${Math.ceil(retryAfter / 60)} menit` : `${retryAfter} detik`}.`,
      retryAfter,
      max: MAX_ATTEMPTS,
    },
    { status: 429, headers: { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store' } }
  );

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req.headers)) {
    return NextResponse.json({ ok: false, error: 'Permintaan ditolak.' }, { status: 403 });
  }

  let body: { username?: unknown; password?: unknown; remember?: unknown; website?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Permintaan tidak valid.' }, { status: 400 });
  }

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const remember = body.remember === true;

  if (!username || !password || username.length > 64 || password.length > 128) {
    return NextResponse.json({ ok: false, error: 'Isi username dan password dengan benar.' }, { status: 400 });
  }

  // Honeypot: kolom tersembunyi yang tidak diisi manusia
  if (typeof body.website === 'string' && body.website.length > 0) {
    await sleep(800);
    return NextResponse.json({ ok: false, error: GENERIC_ERROR, max: MAX_ATTEMPTS }, { status: 401 });
  }

  const ip = getClientIp(req.headers);

  const limit = checkLimit(ip, username);
  if (!limit.allowed) return tooMany(limit.retryAfter);

  // Selalu hitung hash (dummy bila akun tak ada) supaya waktu respons seragam
  const user = findUser(username);
  const passOk = await verifyPassword(password, user?.hash ?? DUMMY_HASH);

  if (!user || !passOk) {
    const fail = recordFailure(ip, username);
    await sleep(350 + Math.random() * 250); // memperlambat tebakan beruntun
    if (fail.locked) return tooMany(fail.retryAfter);
    return NextResponse.json(
      { ok: false, error: GENERIC_ERROR, remaining: fail.remaining, max: MAX_ATTEMPTS },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  recordSuccess(ip, username);

  const ttl = remember ? SESSION_LONG_S : SESSION_SHORT_S;
  let token: string;
  try {
    token = await signSession({ u: user.username, n: user.name, r: user.role, exp: Math.floor(Date.now() / 1000) + ttl });
  } catch (e) {
    console.error('[auth]', e);
    return NextResponse.json({ ok: false, error: 'Server belum dikonfigurasi (AUTH_SECRET).' }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true, username: user.username, name: user.name, role: user.role }, { headers: { 'Cache-Control': 'no-store' } });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(remember ? { maxAge: ttl } : {}), // tanpa maxAge = hilang saat browser ditutup
  });
  return res;
}