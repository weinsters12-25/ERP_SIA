/**
 * Pembatasan percobaan login (rate limiting) — berjalan di server.
 *
 * Aturan:
 *  1. Per akun + IP: 5 kali salah → dikunci. Durasi naik tiap pelanggaran:
 *     30 detik → 1 menit → 5 menit → 15 menit → 30 menit.
 *  2. Per IP: maksimal 30 percobaan / 10 menit (menahan tebak-tebakan banyak akun).
 *
 * CATATAN: penyimpanan ini ada di memori proses. Cocok untuk 1 server / lokal.
 * Bila di-deploy serverless / banyak instance, pindahkan ke Redis (mis. Upstash).
 */
export const MAX_ATTEMPTS = 5;
const LOCK_STEPS_S = [30, 60, 300, 900, 1800]; // sama dengan loginSecurity.ts di klien
const FAIL_WINDOW_MS = 15 * 60_000;
const IP_MAX = 30;
const IP_WINDOW_MS = 10 * 60_000;

interface Entry {
  fails: number;
  first: number;
  lockUntil: number;
  lockCount: number;
  last: number;
}
interface IpEntry {
  count: number;
  start: number;
}

const g = globalThis as unknown as { __toserbaRl?: { acct: Map<string, Entry>; ip: Map<string, IpEntry>; swept: number } };
const store = (g.__toserbaRl ??= { acct: new Map(), ip: new Map(), swept: Date.now() });

const acctKey = (ip: string, username: string) => `${ip}|${username.trim().toLowerCase().slice(0, 64)}`;

function sweep(now: number) {
  if (now - store.swept < 5 * 60_000) return;
  store.swept = now;
  for (const [k, e] of store.acct) if (e.lockUntil < now && now - e.last > 60 * 60_000) store.acct.delete(k);
  for (const [k, e] of store.ip) if (now - e.start > IP_WINDOW_MS) store.ip.delete(k);
}

export interface LimitResult {
  allowed: boolean;
  retryAfter: number; // detik
}

/** Panggil SEBELUM memeriksa password. */
export function checkLimit(ip: string, username: string): LimitResult {
  const now = Date.now();
  sweep(now);

  let ipE = store.ip.get(ip);
  if (!ipE || now - ipE.start > IP_WINDOW_MS) {
    ipE = { count: 0, start: now };
    store.ip.set(ip, ipE);
  }
  ipE.count++;
  if (ipE.count > IP_MAX) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((ipE.start + IP_WINDOW_MS - now) / 1000)) };
  }

  const e = store.acct.get(acctKey(ip, username));
  if (e && e.lockUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((e.lockUntil - now) / 1000) };
  }
  return { allowed: true, retryAfter: 0 };
}

export interface FailResult {
  locked: boolean;
  retryAfter: number;
  remaining: number;
}

export function recordFailure(ip: string, username: string): FailResult {
  const now = Date.now();
  const key = acctKey(ip, username);
  let e = store.acct.get(key);
  if (!e) {
    e = { fails: 0, first: now, lockUntil: 0, lockCount: 0, last: now };
    store.acct.set(key, e);
  }
  if (now - e.first > FAIL_WINDOW_MS) {
    e.fails = 0;
    e.first = now;
  }
  e.fails++;
  e.last = now;

  if (e.fails >= MAX_ATTEMPTS) {
    const step = LOCK_STEPS_S[Math.min(e.lockCount, LOCK_STEPS_S.length - 1)];
    e.lockCount++;
    e.lockUntil = now + step * 1000;
    e.fails = 0;
    e.first = now;
    return { locked: true, retryAfter: step, remaining: 0 };
  }
  return { locked: false, retryAfter: 0, remaining: MAX_ATTEMPTS - e.fails };
}

export function recordSuccess(ip: string, username: string) {
  store.acct.delete(acctKey(ip, username));
}