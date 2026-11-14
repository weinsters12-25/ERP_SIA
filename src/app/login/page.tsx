'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Leaf,
  Loader2,
  Lock,
  Package,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Timer,
  TrendingUp,
  User,
} from 'lucide-react';
import { DEFAULT_USER, loginRequest } from '@/lib/auth';
import {
  GUARD_KEY,
  MAX_ATTEMPTS,
  applyServerFailure,
  applyServerLock,
  formatCountdown,
  getGuardStatus,
  registerFailure,
  registerSuccess,
  type GuardStatus,
} from '@/lib/loginSecurity';

/** Kotak "Informasi Login" hanya tampil saat development, tidak di production. */
const SHOW_DEMO_CREDENTIALS = process.env.NODE_ENV !== 'production';
/** Password demo hanya ada di build development (hilang otomatis dari build production). */
const DEMO_PASSWORD = SHOW_DEMO_CREDENTIALS ? 'admin123' : '';

const FEATURES = [
  { icon: ShoppingCart, title: 'Kasir POS Cepat', desc: 'Transaksi tunai dan bon dengan pintasan keyboard dan cetak struk otomatis.' },
  { icon: Package, title: 'Stok FEFO Otomatis', desc: 'Barang dengan kadaluarsa terdekat selalu terjual lebih dulu.' },
  { icon: BookOpen, title: 'Jurnal Otomatis', desc: 'Setiap penjualan, pembelian, dan biaya langsung tercatat double-entry.' },
  { icon: TrendingUp, title: 'Piutang Terkendali', desc: 'Pantau bon pelanggan dan kirim pengingat WhatsApp dalam satu klik.' },
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function getGreeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

/** Tujuan setelah login: hanya path internal (cegah open redirect). */
function getNextPath() {
  const n = new URLSearchParams(window.location.search).get('next');
  return n && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/login') && !n.includes('\\') ? n : '/';
}

const INITIAL_STATUS: GuardStatus = {
  locked: false,
  remainingMs: 0,
  lockDurationMs: 0,
  attemptsLeft: MAX_ATTEMPTS,
};

export default function LoginPage() {
  const reduceMotion = useReducedMotion();
  const formControls = useAnimationControls();

  const passwordRef = useRef<HTMLInputElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState('');
  const [status, setStatus] = useState<GuardStatus>(INITIAL_STATUS);
  const [greeting, setGreeting] = useState('Selamat datang');
  const [featureIndex, setFeatureIndex] = useState(0);

  /* ---------- parallax panel kiri ---------- */
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });
  const blobAx = useTransform(sx, (v) => v * 50);
  const blobAy = useTransform(sy, (v) => v * 50);
  const blobBx = useTransform(sx, (v) => v * -40);
  const blobBy = useTransform(sy, (v) => v * -40);
  const chipX = useTransform(sx, (v) => v * 18);
  const chipY = useTransform(sy, (v) => v * 18);

  const onPanelMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };

  /* ---------- inisialisasi ---------- */
  useEffect(() => {
    setGreeting(getGreeting());
    setStatus(getGuardStatus());
  }, []);

  // Sinkron status kunci antar tab
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === GUARD_KEY || e.key === null) setStatus(getGuardStatus());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Hitung mundur saat terkunci
  useEffect(() => {
    if (!status.locked) return;
    const id = window.setInterval(() => {
      const s = getGuardStatus();
      setStatus(s);
      if (!s.locked) {
        setError('');
        window.clearInterval(id);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [status.locked]);

  // Ganti fitur di panel kiri
  useEffect(() => {
    const id = window.setInterval(() => setFeatureIndex((i) => (i + 1) % FEATURES.length), 4500);
    return () => window.clearInterval(id);
  }, []);

  /* ---------- aksi ---------- */
  const shake = useCallback(() => {
    if (reduceMotion) return;
    formControls.start({ x: [0, -10, 10, -8, 8, -4, 4, 0], transition: { duration: 0.45 } });
  }, [formControls, reduceMotion]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || success) return;

    // Cek ulang di sini: status di state bisa saja basi (misalnya tab lain sudah mengunci)
    const current = getGuardStatus();
    if (current.locked) {
      setStatus(current);
      return;
    }

    setError('');
    setLoading(true);

    // Server yang memverifikasi, membatasi percobaan, dan menerbitkan cookie sesi
    const res = await loginRequest(username, password, remember, honeypotRef.current?.value ?? '');

    if (res.ok) {
      registerSuccess();
      setSuccess(true);
      setStatus(INITIAL_STATUS);
      await sleep(1000);
      window.location.assign(getNextPath());
      return;
    }

    setPassword('');
    setLoading(false);
    shake();

    if (res.status === 429) {
      // Dikunci oleh server
      setStatus(applyServerLock(res.retryAfter ?? 60));
      setError('');
    } else if (res.status === 401) {
      const s = typeof res.remaining === 'number' ? applyServerFailure(res.remaining) : registerFailure();
      setStatus(s);
      setError(`Username atau password salah. Sisa percobaan: ${s.attemptsLeft}.`);
      passwordRef.current?.focus();
    } else {
      // Galat jaringan / server: tidak dihitung sebagai percobaan salah
      setError(res.error ?? 'Terjadi kesalahan. Coba lagi.');
    }
  };

  const handleCopy = async (value: string, type: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
      window.setTimeout(() => setCopied(''), 2000);
    } catch {
      setError('Tidak dapat menyalin. Silakan salin secara manual.');
    }
  };

  const fillDemo = () => {
    setUsername(DEFAULT_USER.username);
    setPassword(DEMO_PASSWORD);
    setError('');
  };

  const onKeyEvent = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState('CapsLock'));
  };

  const disabled = loading || success || status.locked;
  const usedAttempts = MAX_ATTEMPTS - status.attemptsLeft;
  const lockProgress = status.lockDurationMs ? Math.min(1, status.remainingMs / status.lockDurationMs) : 0;
  const Feature = FEATURES[featureIndex];

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--color-canvas)] p-4 sm:p-5">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-2">
        {/* ================= SISI KIRI ================= */}
        <div
          onMouseMove={onPanelMove}
          className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0d4f3c] to-[#082f24] p-10 text-white md:flex"
        >
          <motion.div
            style={{ x: blobAx, y: blobAy }}
            className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5"
          />
          <motion.div
            style={{ x: blobBx, y: blobBy }}
            className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-[#d9a93a]/10"
          />
          <motion.div
            style={{ x: chipX, y: chipY }}
            className="pointer-events-none absolute right-10 top-1/3 h-24 w-24 rounded-full border border-white/10"
          />

          {/* Brand */}
          <div className="relative z-10 flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: -8, scale: 1.05 }}
              className="rounded-xl bg-[#d9a93a] p-3 text-[#0d4f3c]"
            >
              <Leaf size={25} />
            </motion.div>
            <div>
              <h1 className="font-display text-2xl font-bold">Toserba ERP</h1>
              <p className="text-xs text-white/60">Nature Fresh Management</p>
            </div>
          </div>

          {/* Pesan utama + fitur bergantian */}
          <div className="relative z-10">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#e8c46c]">{greeting}</p>
            <h2 className="font-display text-4xl font-semibold leading-tight">
              Kelola Toko Lebih Mudah dalam Satu Sistem.
            </h2>

            <div className="mt-8 min-h-[116px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={featureIndex}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35 }}
                  className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                >
                  <div className="rounded-xl bg-[#d9a93a]/20 p-3 text-[#e8c46c]">
                    <Feature.icon size={22} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{Feature.title}</p>
                    <p className="mt-1 text-xs leading-5 text-white/65">{Feature.desc}</p>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="mt-4 flex gap-1.5">
                {FEATURES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Tampilkan fitur ${i + 1}`}
                    onClick={() => setFeatureIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === featureIndex ? 'w-6 bg-[#e8c46c]' : 'w-1.5 bg-white/25 hover:bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <p className="relative z-10 flex items-center gap-1.5 text-xs text-white/40">
            <ShieldCheck size={13} /> Sesi dilindungi pembatasan percobaan login
          </p>
        </div>

        {/* ================= SISI KANAN ================= */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative flex flex-col justify-center p-6 sm:p-12"
        >
          {/* Overlay sukses */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-white/95 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.4, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                  className="rounded-full bg-[#e3efe6] p-5 text-[#0d4f3c]"
                >
                  <CheckCircle2 size={48} />
                </motion.div>
                <div className="text-center">
                  <p className="font-display text-xl font-semibold text-[#0d4f3c]">Login berhasil</p>
                  <p className="mt-1 text-xs text-slate-500">Mengalihkan ke dashboard…</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Logo mobile */}
          <div className="mb-7 md:hidden">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#0d4f3c] p-3 text-white">
                <Leaf size={24} />
              </div>
              <h1 className="font-display text-2xl font-bold text-[#0d4f3c]">Toserba ERP</h1>
            </div>
          </div>

          {/* Judul */}
          <div className="mb-7">
            <h2 className="font-display text-3xl font-bold text-slate-800">Selamat Datang!</h2>
            <p className="mt-2 text-sm text-slate-500">Silakan login untuk mengakses sistem Toserba ERP.</p>
          </div>

          {/* Kartu terkunci */}
          <AnimatePresence>
            {status.locked && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 overflow-hidden"
                role="alert"
                aria-live="assertive"
              >
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700">
                      <ShieldAlert size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-amber-900">Terlalu banyak percobaan gagal</p>
                      <p className="mt-0.5 text-xs text-amber-800/80">
                        Form dikunci sementara demi keamanan. Coba lagi setelah hitung mundur selesai.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 font-mono text-sm font-bold text-amber-800 shadow-sm">
                      <Timer size={14} />
                      {formatCountdown(status.remainingMs)}
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-amber-200/70">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-[width] duration-300 ease-linear"
                      style={{ width: `${lockProgress * 100}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <motion.form animate={formControls} onSubmit={handleLogin} className="space-y-5" noValidate={false}>
            {/* Honeypot: tidak terlihat oleh manusia, sering diisi bot */}
            <input
              ref={honeypotRef}
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
            />

            {/* Username */}
            <div>
              <label htmlFor="username" className="mb-2 block text-xs font-bold text-slate-700">
                Username
              </label>
              <div className="group relative">
                <User className="absolute left-4 top-3.5 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-[#0d4f3c]" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Masukkan username"
                  required
                  maxLength={64}
                  autoFocus
                  disabled={disabled}
                  autoComplete="username"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-[#0d4f3c] focus:bg-white focus:ring-4 focus:ring-[#0d4f3c]/10 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="mb-2 block text-xs font-bold text-slate-700">
                Password
              </label>
              <div className="group relative">
                <Lock className="absolute left-4 top-3.5 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-[#0d4f3c]" />
                <input
                  id="password"
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  onKeyDown={onKeyEvent}
                  onKeyUp={onKeyEvent}
                  onBlur={() => setCapsLock(false)}
                  placeholder="Masukkan password"
                  required
                  maxLength={128}
                  disabled={disabled}
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-12 text-sm text-slate-800 outline-none transition focus:border-[#0d4f3c] focus:bg-white focus:ring-4 focus:ring-[#0d4f3c]/10 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={disabled}
                  className="absolute right-3 top-2.5 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              <AnimatePresence>
                {capsLock && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-600"
                  >
                    <AlertTriangle size={12} /> Caps Lock sedang aktif
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Ingat saya + indikator percobaan */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={disabled}
                  className="h-4 w-4 rounded border-slate-300 accent-[#0d4f3c]"
                />
                <span>
                  Ingat saya <span className="text-slate-400">({remember ? '7 hari' : '8 jam'})</span>
                </span>
              </label>

              <div
                className="flex items-center gap-2"
                title={`${status.attemptsLeft} dari ${MAX_ATTEMPTS} percobaan tersisa`}
              >
                <div className="flex gap-1">
                  {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                    <motion.span
                      key={i}
                      animate={{ scale: i < usedAttempts ? [1, 1.5, 1] : 1 }}
                      className={`h-1.5 w-4 rounded-full transition-colors ${
                        status.locked || i < usedAttempts ? 'bg-red-400' : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-medium text-slate-400">
                  {status.locked ? 'Terkunci' : `${status.attemptsLeft} percobaan`}
                </span>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  role="alert"
                  aria-live="assertive"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600"
                >
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tombol */}
            <motion.button
              type="submit"
              disabled={disabled}
              whileHover={disabled ? undefined : { scale: 1.01 }}
              whileTap={disabled ? undefined : { scale: 0.98 }}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white shadow-lg transition disabled:cursor-not-allowed ${
                status.locked
                  ? 'bg-slate-400'
                  : success
                  ? 'bg-emerald-600'
                  : 'bg-[#0d4f3c] hover:bg-[#17634c] disabled:opacity-70'
              }`}
            >
              {success ? (
                <>
                  <Check size={17} /> Berhasil
                </>
              ) : loading ? (
                <>
                  <Loader2 size={17} className="animate-spin" /> Memverifikasi...
                </>
              ) : status.locked ? (
                <>
                  <Timer size={17} /> Terkunci {formatCountdown(status.remainingMs)}
                </>
              ) : (
                <>
                  Login ke Sistem <ArrowRight size={17} />
                </>
              )}
            </motion.button>
          </motion.form>

          {/* Informasi akun: HANYA saat development */}
          {SHOW_DEMO_CREDENTIALS && (
            <div className="mt-7 rounded-2xl border border-[#dce9df] bg-[#f7faf7] p-4">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-[#e3efe6] p-2 text-[#0d4f3c]">
                    <KeyRound size={17} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#0d4f3c]">Informasi Login</p>
                    <p className="text-[10px] text-slate-500">Hanya tampil di mode development</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fillDemo}
                  disabled={disabled}
                  className="flex items-center gap-1.5 rounded-lg bg-[#0d4f3c] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#17634c] disabled:opacity-50"
                >
                  <Sparkles size={13} /> Isi otomatis
                </button>
              </div>

              <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <User size={17} className="shrink-0 text-[#0d4f3c]" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400">Username</p>
                    <p className="truncate text-sm font-bold text-slate-700">{DEFAULT_USER.username}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(DEFAULT_USER.username, 'username')}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#edf5ef] px-3 py-2 text-xs font-semibold text-[#0d4f3c] transition hover:bg-[#dcece0]"
                >
                  {copied === 'username' ? (
                    <>
                      <Check size={14} /> Tersalin
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Salin
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Lock size={17} className="shrink-0 text-[#0d4f3c]" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400">Password</p>
                    <p className="truncate text-sm font-bold text-slate-700">{DEMO_PASSWORD}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(DEMO_PASSWORD, 'password')}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#edf5ef] px-3 py-2 text-xs font-semibold text-[#0d4f3c] transition hover:bg-[#dcece0]"
                >
                  {copied === 'password' ? (
                    <>
                      <Check size={14} /> Tersalin
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Salin
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <p className="mt-7 text-center text-xs text-slate-400">
            Toserba ERP · Sistem Manajemen Toko · © {new Date().getFullYear()}
          </p>
        </motion.div>
      </div>
    </main>
  );
}