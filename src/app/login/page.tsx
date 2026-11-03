
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Leaf,
  ArrowRight,
  Copy,
  Check,
  KeyRound,
} from 'lucide-react';
import { AUTH_KEY, DEFAULT_USER } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (
      username.trim() === DEFAULT_USER.username &&
      password === DEFAULT_USER.password
    ) {
      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({
          username: DEFAULT_USER.username,
          name: DEFAULT_USER.name,
          role: DEFAULT_USER.role,
        })
      );

      router.replace('/');
      return;
    }

    setError('Username atau password yang kamu masukkan salah.');
    setLoading(false);
  };

  const handleCopy = async (value: string, type: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);

      window.setTimeout(() => {
        setCopied('');
      }, 2000);
    } catch {
      setError('Tidak dapat menyalin. Silakan salin secara manual.');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-canvas)] p-5">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-2">

        {/* SISI KIRI */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0d4f3c] to-[#082f24] p-10 text-white md:flex">

          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
          <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-[#d9a93a]/10" />

          <div className="relative z-10 flex items-center gap-3">
            <div className="rounded-xl bg-[#d9a93a] p-3 text-[#0d4f3c]">
              <Leaf size={25} />
            </div>

            <div>
              <h1 className="font-display text-2xl font-bold">
                Toserba ERP
              </h1>
              <p className="text-xs text-white/60">
                Nature Fresh Management
              </p>
            </div>
          </div>

          <div className="relative z-10">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#e8c46c]">
              Welcome Back
            </p>

            <h2 className="font-display text-4xl font-semibold leading-tight">
              Kelola Toko Lebih Mudah dalam Satu Sistem.
            </h2>

            <p className="mt-5 max-w-sm text-sm leading-7 text-white/65">
              Sistem pengelolaan toko terintegrasi untuk transaksi,
              persediaan barang, pembelian, dan keuangan.
            </p>
          </div>

          <p className="relative z-10 text-xs text-white/40">
            © 2026 Toserba ERP. All rights reserved.
          </p>
        </div>

        {/* SISI KANAN */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col justify-center p-7 sm:p-12"
        >

          {/* LOGO MOBILE */}
          <div className="mb-8 md:hidden">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#0d4f3c] p-3 text-white">
                <Leaf size={24} />
              </div>

              <h1 className="font-display text-2xl font-bold text-[#0d4f3c]">
                Toserba ERP
              </h1>
            </div>
          </div>

          {/* JUDUL */}
          <div className="mb-8">
            <h2 className="font-display text-3xl font-bold text-slate-800">
              Selamat Datang!
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Silakan login untuk mengakses sistem Toserba ERP.
            </p>
          </div>

          {/* FORM LOGIN */}
          <form onSubmit={handleLogin} className="space-y-5">

            {/* USERNAME */}
            <div>
              <label className="mb-2 block text-xs font-bold text-slate-700">
                Username
              </label>

              <div className="relative">
                <User className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />

                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username"
                  required
                  autoComplete="username"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-[#0d4f3c] focus:bg-white"
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label className="mb-2 block text-xs font-bold text-slate-700">
                Password
              </label>

              <div className="relative">
                <Lock className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-12 text-sm text-slate-800 outline-none transition focus:border-[#0d4f3c] focus:bg-white"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-slate-400"
                  aria-label="Tampilkan password"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* ERROR */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600">
                {error}
              </div>
            )}

            {/* TOMBOL LOGIN */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0d4f3c] py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-[#17634c] disabled:opacity-60"
            >
              {loading ? 'Memproses...' : 'Login ke Sistem'}
              <ArrowRight size={17} />
            </button>
          </form>

          {/* INFORMASI AKUN LOGIN */}
          <div className="mt-7 rounded-2xl border border-[#dce9df] bg-[#f7faf7] p-4">

            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-lg bg-[#e3efe6] p-2 text-[#0d4f3c]">
                <KeyRound size={17} />
              </div>

              <div>
                <p className="text-sm font-bold text-[#0d4f3c]">
                  Informasi Login
                </p>
                <p className="text-[10px] text-slate-500">
                  Gunakan akun berikut untuk masuk
                </p>
              </div>
            </div>

            {/* USERNAME */}
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <User size={17} className="shrink-0 text-[#0d4f3c]" />

                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400">Username</p>
                  <p className="truncate text-sm font-bold text-slate-700">
                    {DEFAULT_USER.username}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(DEFAULT_USER.username, 'username')}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#edf5ef] px-3 py-2 text-xs font-semibold text-[#0d4f3c] transition hover:bg-[#dcece0]"
              >
                {copied === 'username' ? (
                  <>
                    <Check size={14} />
                    Tersalin
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Salin
                  </>
                )}
              </button>
            </div>

            {/* PASSWORD */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Lock size={17} className="shrink-0 text-[#0d4f3c]" />

                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400">Password</p>
                  <p className="truncate text-sm font-bold text-slate-700">
                    {DEFAULT_USER.password}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(DEFAULT_USER.password, 'password')}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#edf5ef] px-3 py-2 text-xs font-semibold text-[#0d4f3c] transition hover:bg-[#dcece0]"
              >
                {copied === 'password' ? (
                  <>
                    <Check size={14} />
                    Tersalin
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Salin
                  </>
                )}
              </button>
            </div>

          </div>

          {/* FOOTER */}
          <p className="mt-7 text-center text-xs text-slate-400">
            Toserba ERP · Sistem Manajemen Toko
          </p>

        </motion.div>
      </div>
    </main>
  );
}
