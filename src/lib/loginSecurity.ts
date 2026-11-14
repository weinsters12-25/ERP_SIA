/**
 * Penjaga login di sisi klien (progresif) — lapisan TAMPILAN.
 *
 * Penentu sesungguhnya adalah server (src/lib/rateLimit.ts). Modul ini:
 *  - memberi umpan balik instan (indikator percobaan, hitung mundur),
 *  - menahan penekanan tombol berulang dari browser yang sama,
 *  - menyalin status kunci dari server (applyServerLock / applyServerFailure),
 *    sehingga hitung mundur tetap muncul setelah halaman dimuat ulang.
 *
 * Menghapus localStorage TIDAK menghapus kunci di server.
 */

export const GUARD_KEY = 'toserba-login-guard';
export const MAX_ATTEMPTS = 5;

/** Durasi kunci per level (ms): 30 dtk, 1, 5, 15, 30 menit — sama dengan server. */
const LOCK_STEPS_MS = [30_000, 60_000, 300_000, 900_000, 1_800_000];
/** Hitungan gagal direset bila tidak ada percobaan baru selama ini. */
const FAIL_WINDOW_MS = 15 * 60 * 1000;
/** Level kunci direset bila tenang selama ini. */
const LEVEL_RESET_MS = 60 * 60 * 1000;
/** Batas atas kunci yang dipercaya dari server (kunci per-IP bisa sampai 10 menit). */
const MAX_TRUSTED_LOCK_MS = 60 * 60 * 1000;

interface GuardState {
  fails: number;
  lockLevel: number;
  lockUntil: number;
  lockTotal: number;
  lastFail: number;
}

export interface GuardStatus {
  locked: boolean;
  remainingMs: number;
  lockDurationMs: number;
  attemptsLeft: number;
}

const empty = (): GuardState => ({ fails: 0, lockLevel: 0, lockUntil: 0, lockTotal: 0, lastFail: 0 });

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

function read(now = Date.now()): GuardState {
  if (typeof window === 'undefined') return empty();
  try {
    const raw = localStorage.getItem(GUARD_KEY);
    if (!raw) return empty();
    const p = JSON.parse(raw) as Partial<GuardState>;
    const s: GuardState = {
      fails: Math.min(num(p.fails), MAX_ATTEMPTS),
      lockLevel: Math.min(num(p.lockLevel), 50),
      lockUntil: num(p.lockUntil),
      lockTotal: num(p.lockTotal),
      lastFail: num(p.lastFail),
    };

    // Jam sistem dimundurkan: jangan percaya timestamp di masa depan
    if (s.lastFail > now) s.lastFail = now;
    if (s.lockUntil - now > MAX_TRUSTED_LOCK_MS) s.lockUntil = now + MAX_TRUSTED_LOCK_MS;

    const locked = s.lockUntil > now;
    if (!locked && s.lastFail && now - s.lastFail > FAIL_WINDOW_MS) s.fails = 0;
    if (!locked && s.lastFail && now - s.lastFail > LEVEL_RESET_MS) s.lockLevel = 0;
    return s;
  } catch {
    return empty();
  }
}

function write(s: GuardState) {
  try {
    localStorage.setItem(GUARD_KEY, JSON.stringify(s));
  } catch {
    /* penyimpanan penuh / diblokir: abaikan */
  }
}

function toStatus(s: GuardState, now = Date.now()): GuardStatus {
  const remainingMs = Math.max(0, s.lockUntil - now);
  const locked = remainingMs > 0;
  const step = LOCK_STEPS_MS[Math.min(Math.max(s.lockLevel - 1, 0), LOCK_STEPS_MS.length - 1)];
  return {
    locked,
    remainingMs,
    lockDurationMs: locked ? s.lockTotal || step : 0,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - s.fails),
  };
}

export function getGuardStatus(): GuardStatus {
  const now = Date.now();
  return toStatus(read(now), now);
}

/** Catat satu percobaan gagal (dipakai bila server tidak mengirim sisa percobaan). */
export function registerFailure(): GuardStatus {
  const now = Date.now();
  const s = read(now);
  s.fails += 1;
  s.lastFail = now;

  if (s.fails >= MAX_ATTEMPTS) {
    const step = LOCK_STEPS_MS[Math.min(s.lockLevel, LOCK_STEPS_MS.length - 1)];
    s.lockUntil = now + step;
    s.lockTotal = step;
    s.lockLevel += 1;
    s.fails = 0;
  }

  write(s);
  return toStatus(s, now);
}

/** Salin kunci dari server (respons 429) ke tampilan. */
export function applyServerLock(retryAfterSeconds: number): GuardStatus {
  const now = Date.now();
  const s = read(now);
  const ms = Math.min(Math.max(retryAfterSeconds, 1) * 1000, MAX_TRUSTED_LOCK_MS);
  s.lockUntil = now + ms;
  s.lockTotal = ms;
  s.lockLevel = Math.max(s.lockLevel, 1);
  s.fails = 0;
  s.lastFail = now;
  write(s);
  return toStatus(s, now);
}

/** Salin sisa percobaan dari server (respons 401) ke tampilan. */
export function applyServerFailure(remaining: number): GuardStatus {
  const now = Date.now();
  const s = read(now);
  s.fails = Math.min(Math.max(MAX_ATTEMPTS - remaining, 0), MAX_ATTEMPTS);
  s.lastFail = now;
  write(s);
  return toStatus(s, now);
}

export function registerSuccess() {
  try {
    localStorage.removeItem(GUARD_KEY);
  } catch {
    /* abaikan */
  }
}

export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}