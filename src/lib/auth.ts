/**
 * Sisi klien untuk autentikasi berbasis server.
 * Verifikasi password, sesi (cookie httpOnly), dan rate limit ada di server:
 *   src/app/api/auth/*  +  src/lib/auth.server.ts  +  src/middleware.ts
 * localStorage di sini HANYA cache nama/peran untuk tampilan, bukan bukti login.
 */
export const AUTH_KEY = 'toserba-auth';

export interface AuthUser {
  username: string;
  name: string;
  role: string;
}

/** Profil bawaan untuk tampilan (password TIDAK ada di sisi klien). */
export const DEFAULT_USER = {
  username: 'admin',
  name: 'Admin Toko',
  role: 'Pemilik',
};

export function getAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;

  try {
    const data = localStorage.getItem(AUTH_KEY);
    return data ? (JSON.parse(data) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setAuthUser(user: AuthUser) {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  } catch {}
}

export function clearAuthUser() {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {}
}

export interface LoginResult {
  ok: boolean;
  status: number; // 0 = gagal terhubung
  error?: string;
  remaining?: number; // sisa percobaan (dari server)
  retryAfter?: number; // detik, bila dikunci (429)
  user?: AuthUser;
}

/** Kirim kredensial ke server. Server yang menentukan benar/salah dan mengunci bila perlu. */
export async function loginRequest(
  username: string,
  password: string,
  remember: boolean,
  website = ''
): Promise<LoginResult> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, remember, website }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.ok) {
      const user: AuthUser = { username: data.username ?? username.trim(), name: data.name, role: data.role };
      setAuthUser(user);
      return { ok: true, status: res.status, user };
    }

    return {
      ok: false,
      status: res.status,
      error: data.error,
      remaining: typeof data.remaining === 'number' ? data.remaining : undefined,
      retryAfter: typeof data.retryAfter === 'number' ? data.retryAfter : undefined,
    };
  } catch {
    return { ok: false, status: 0, error: 'Tidak dapat terhubung ke server. Periksa koneksi Anda.' };
  }
}

/** Tanyakan ke server apakah sesi (cookie) masih sah. Bila offline, pakai cache terakhir. */
export async function fetchSession(): Promise<{ user: AuthUser | null; offline: boolean }> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!res.ok) return { user: null, offline: false };
    const d = await res.json();
    return d?.ok
      ? { user: { username: d.username, name: d.name, role: d.role }, offline: false }
      : { user: null, offline: false };
  } catch {
    return { user: getAuthUser(), offline: true };
  }
}

/** Keluar: hapus cache, akhiri sesi di server, lalu ke halaman login. */
export function logout() {
  clearAuthUser();

  fetch('/api/auth/logout', { method: 'POST', keepalive: true })
    .catch(() => {})
    .finally(() => {
      window.location.href = '/login';
    });
}