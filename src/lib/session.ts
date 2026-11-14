/**
 * Sesi bertanda tangan (HMAC-SHA256) memakai Web Crypto.
 * Aman dipakai di middleware/proxy maupun route handler.
 */
export const COOKIE_NAME = 'toserba_session';

export interface Session {
  u: string; // username
  n: string; // nama tampilan
  r: string; // peran
  exp: number; // kedaluwarsa (detik epoch)
}

const enc = new TextEncoder();

function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  // Hanya untuk pengembangan lokal. Di produksi AUTH_SECRET WAJIB diisi (gagal tertutup).
  if (process.env.NODE_ENV !== 'production') return 'dev-only-secret-ganti-di-env-local';
  return '';
}

const toB64u = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromB64u = (str: string) => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

async function getKey(): Promise<CryptoKey | null> {
  const secret = getSecret();
  if (!secret) return null;
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signSession(payload: Session): Promise<string> {
  const key = await getKey();
  if (!key) throw new Error('AUTH_SECRET belum diatur (minimal 16 karakter).');
  const data = toB64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return `${data}.${toB64u(sig)}`;
}

export async function verifySession(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const key = await getKey();
    if (!key) return null;
    // crypto.subtle.verify membandingkan dengan waktu konstan
    const ok = await crypto.subtle.verify('HMAC', key, fromB64u(sig), enc.encode(data));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64u(data))) as Session;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_SHORT_S = 8 * 60 * 60; // 8 jam (tanpa "Ingat saya")
export const SESSION_LONG_S = 7 * 24 * 60 * 60; // 7 hari