'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  TrendingDown,
  DollarSign,
  BookOpen,
  Bell,
  Search,
  ChevronDown,
  Leaf,
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'POS Kasir', href: '/pos', icon: ShoppingCart },
  { name: 'Stok & FEFO', href: '/inventory', icon: Package },
  { name: 'Pengeluaran (PO & AP)', href: '/purchasing', icon: TrendingDown },
  { name: 'Pendapatan (AR & WA)', href: '/sales', icon: DollarSign },
  { name: 'Jurnal & Kas', href: '/finance', icon: BookOpen },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);

  const activeItem = navItems.find((i) => i.href === pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-canvas)] text-[var(--color-ink)] font-sans antialiased">
      {/* ============ SIDEBAR — hijau pinus tua, aksen gold ============ */}
      <aside className="relative w-64 flex flex-col justify-between overflow-hidden bg-[var(--color-pine)] p-5 text-white/90">
        {/* Tekstur halus di latar sidebar */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 10%, white 0, transparent 45%), radial-gradient(circle at 90% 80%, var(--color-gold) 0, transparent 40%)',
          }}
        />

        <div className="relative z-10">
          {/* Brand */}
          <div className="flex items-center gap-3 border-b border-white/10 px-1 pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-gold-light)] to-[var(--color-gold)] font-display text-lg font-bold text-[var(--color-pine)] shadow-md">
              T
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-display text-base font-semibold tracking-wide text-white">
                  Toserba
                </h1>
                <Leaf className="h-3.5 w-3.5 text-[var(--color-gold-light)]" />
              </div>
              <p className="text-[11px] font-medium text-white/50">Nature Fresh ERP</p>
            </div>
          </div>

          {/* Navigasi */}
          <nav className="mt-6 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.98 }}
                    className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-200 ${
                      isActive ? 'text-white' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="nav-active-pill"
                        className="absolute inset-0 rounded-xl bg-white/10"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[var(--color-gold-light)]" />
                    )}
                    <Icon
                      className={`relative z-10 h-4.5 w-4.5 shrink-0 ${
                        isActive ? 'text-[var(--color-gold-light)]' : 'text-white/40 group-hover:text-white/70'
                      }`}
                    />
                    <span className="relative z-10">{item.name}</span>
                  </motion.div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Status Koneksi Database */}
        <div className="relative z-10 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-gold-light)] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-gold-light)]" />
            </span>
            <span className="font-medium text-white/80">Supabase Connected</span>
          </div>
        </div>
      </aside>

      {/* ============ KONTEN UTAMA ============ */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="z-10 flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 px-8 backdrop-blur-md">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
              Overview
            </p>
            <h2 className="-mt-0.5 font-display text-[15px] font-semibold text-[var(--color-ink)]">
              {activeItem ? activeItem.name : 'Toko Sembako'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--color-ink-soft)]" />
              <input
                type="text"
                placeholder="Cari cepat..."
                className="w-52 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas-sunk)] py-2 pl-8 pr-3 text-xs text-[var(--color-ink)] placeholder-[var(--color-ink-soft)] transition-all focus:w-64 focus:border-[var(--color-gold)] focus:bg-white focus:outline-none"
              />
            </div>

            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-[var(--color-ink-soft)] shadow-xs transition-colors hover:bg-[var(--color-canvas-sunk)]"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--color-rust)]" />
            </button>

            <button className="flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] py-1 pl-1 pr-2.5 transition-colors hover:bg-[var(--color-canvas-sunk)]">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-pine-tint)] text-xs font-bold text-[var(--color-pine)]">
                A
              </div>
              <div className="text-left text-xs">
                <p className="font-semibold text-[var(--color-ink)]">Admin Toko</p>
                <p className="text-[var(--color-ink-soft)]">Kasir / Pemilik</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-[var(--color-ink-soft)]" />
            </button>
          </div>
        </header>

        {/* Isi Halaman */}
        <main className="relative flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}