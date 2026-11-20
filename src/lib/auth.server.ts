import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Akun & verifikasi password (khusus server / Node.js).
 *
 * AKUN DEFAULT (sama dengan form login lama; ganti sebelum dipakai sungguhan!):
 *   admin / admin123   → Pemilik
 *
 * Untuk mengganti: buat hash dengan `node scripts/hash-password.mjs "PasswordBaru"`
 * lalu isi AUTH_USERS di .env.local (lihat .env.local.example).
 */
export interface AuthUser {
  username: string;
  name: string;
  role: string;
  hash: string; // format: scrypt$<salt hex>$<hash hex>
}

const DEFAULT_USERS: AuthUser[] = [
  {
    username: 'admin',
    name: 'Admin Toko',
    role: 'Pemilik',
    hash: 'scrypt$fe04391e2499cb46e11cc172f83b5f3a$1275c174db7eb0efa124dbe726ea69bf066c9215ac6dc6c4afc7dbd779a640851e3dced8e0e46ee3e5ac23292e27a511a575cf54b6b69324423a719858cb0147',
  },
];

// Hash palsu: dipakai agar waktu respons sama baik akun ada maupun tidak (anti user-enumeration)
export const DUMMY_HASH =
  'scrypt$c68ff2c338e67a03a61c8eb626924868$5f0a61095c025ca1e768f8fb4726f1e8e3d27df759c687d87179d1220bab83fabdc9027d4b67e0c854daf7d3ec1e699575d95dd3f0623102e41f35e6e18615b8';

let warned = false;

function loadUsers(): AuthUser[] {
  const raw = process.env.AUTH_USERS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as AuthUser[];
      if (Array.isArray(parsed) && parsed.every((u) => u.username && u.hash)) {
        return parsed.map((u) => ({ ...u, name: u.name ?? u.username, role: u.role ?? 'Kasir' }));
      }
    } catch {
      console.error('[auth] AUTH_USERS bukan JSON yang valid. Memakai akun default.');
    }
  }
  if (process.env.NODE_ENV === 'production' && !warned) {
    warned = true;
    console.warn('[auth] PERINGATAN: memakai akun default. Atur AUTH_USERS di environment produksi!');
  }
  return DEFAULT_USERS;
}

export const findUser = (username: string): AuthUser | undefined =>
  loadUsers().find((u) => u.username.toLowerCase() === username.trim().toLowerCase());

const scryptAsync = (password: string, salt: Buffer, len: number) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, len, (err, key) => (err ? reject(err) : resolve(key)))
  );

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export function getClientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return headers.get('x-real-ip') ?? 'local';
}

/** Tolak permintaan lintas-situs (CSRF) untuk endpoint yang mengubah state. */
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === headers.get('host');
  } catch {
    return false;
  }
}