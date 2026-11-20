import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/session';
import { isSameOrigin } from '@/lib/auth.server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req.headers)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  return res;
}