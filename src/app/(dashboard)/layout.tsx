
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
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
  ChevronsLeft,
  Leaf,
  AlertTriangle,
  LogOut,
} from 'lucide-react';

import {
  useDemoSeed,
  useErpStore,
  useHydrated,
  getExpiryStatus,
} from '@/stores/useErpStore';

import AuthGuard from '@/components/AuthGuard';
import { getAuthUser, logout } from '@/lib/auth';

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
};

type AuthUser = {
  username: string;
  name: string;
  role: string;
};

/* Menu navigasi */
const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Utama',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Operasional',
    items: [
      { name: 'POS Kasir', href: '/pos', icon: ShoppingCart },
      { name: 'Stok & FEFO', href: '/inventory', icon: Package },
    ],
  },
  {
    label: 'Keuangan',
    items: [
      { name: 'Pengeluaran (PO & AP)', href: '/purchasing', icon: TrendingDown },
      { name: 'Pendapatan (AR & WA)', href: '/sales', icon: DollarSign },
      { name: 'Jurnal & Kas', href: '/finance', icon: BookOpen },
    ],
  },
];

const navItems = navGroups.flatMap((g) => g.items);

const EXPANDED = 264;
const COLLAPSED = 80;

/* =====================================================
   DASHBOARD UTAMA
===================================================== */

function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const [notifOpen, setNotifOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  // Memuat data demo
  useDemoSeed();

  const hydrated = useHydrated();
  const products = useErpStore((s) => s.products);

  // Mengambil informasi pengguna setelah komponen dimuat
  useEffect(() => {
    const user = getAuthUser();
    setCurrentUser(user);
  }, []);

  // Mengingat kondisi sidebar
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('toserba-sidebar') === '1');
    } catch {}
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((v) => {
      try {
        localStorage.setItem('toserba-sidebar', v ? '0' : '1');
      } catch {}

      return !v;
    });

  // Menghitung batch yang mendekati expired
  const nearExpiry = useMemo(() => {
    if (!hydrated) return 0;

    return products.reduce(
      (s, p) =>
        s +
        p.batches.filter((b) => {
          if (b.qty <= 0) return false;

          const st = getExpiryStatus(b.expiredDate);

          return st === 'kritis' || st === 'peringatan';
        }).length,
      0
    );
  }, [hydrated, products]);

  const activeItem = navItems.find((i) => i.href === pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-canvas)] text-[var(--color-ink)] font-sans antialiased">

      {/* ============ SIDEBAR ============ */}

      <motion.aside
        initial={false}
        animate={{ width: collapsed ? COLLAPSED : EXPANDED }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        className="relative flex shrink-0 flex-col justify-between bg-gradient-to-b from-[var(--color-pine)] to-[#0a3d2e] p-4 text-white/90"
      >

        {/* Background dekoratif */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 15% 8%, white 0, transparent 42%), radial-gradient(circle at 95% 85%, var(--color-gold) 0, transparent 38%)',
            }}
          />

          <Leaf className="absolute -bottom-6 -right-6 h-44 w-44 rotate-[-20deg] text-white/[0.04]" />
        </div>

        <div className="relative z-10">

          {/* BRAND */}
          <div className="flex items-center gap-3 border-b border-white/10 px-1 pb-5">
            <motion.div
              whileHover={{ rotate: -6, scale: 1.05 }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-gold-light)] to-[var(--color-gold)] font-display text-lg font-bold text-[var(--color-pine)] shadow-md"
            >
              T
            </motion.div>

            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18 }}
                  className="min-w-0 whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <h1 className="font-display text-base font-semibold tracking-wide text-white">
                      Toserba
                    </h1>

                    <Leaf className="h-3.5 w-3.5 text-[var(--color-gold-light)]" />
                  </div>

                  <p className="text-[11px] font-medium text-white/50">
                    Nature Fresh ERP
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* NAVIGASI */}
          <nav className="mt-4 space-y-4" aria-label="Menu utama">
            {navGroups.map((group) => (
              <div key={group.label}>

                {collapsed ? (
                  <div className="mx-auto mb-1.5 h-px w-6 bg-white/10" />
                ) : (
                  <p className="mb-1.5 px-3.5 text-[11px] font-medium text-white/35">
                    {group.label}
                  </p>
                )}

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    const badge =
                      item.href === '/inventory' && nearExpiry > 0
                        ? nearExpiry
                        : 0;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        className="group/item relative block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-gold-light)]"
                      >
                        <motion.div
                          whileHover={{ x: collapsed ? 0 : 3 }}
                          whileTap={{ scale: 0.98 }}
                          className={`relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-200 ${
                            collapsed ? 'justify-center' : ''
                          } ${
                            isActive
                              ? 'text-white'
                              : 'text-white/60 hover:bg-white/[0.04] hover:text-white'
                          }`}
                        >

                          {isActive && (
                            <motion.span
                              layoutId="nav-active-pill"
                              className="absolute inset-0 rounded-xl bg-white/12 ring-1 ring-white/10"
                              transition={{
                                type: 'spring',
                                stiffness: 350,
                                damping: 30,
                              }}
                            />
                          )}

                          {isActive && (
                            <motion.span
                              layoutId="nav-active-bar"
                              className="absolute -left-4 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[var(--color-gold-light)] shadow-[0_0_12px_var(--color-gold)]"
                              transition={{
                                type: 'spring',
                                stiffness: 350,
                                damping: 30,
                              }}
                            />
                          )}

                          <span className="relative z-10 shrink-0">
                            <Icon
                              className={`h-[18px] w-[18px] transition-colors ${
                                isActive
                                  ? 'text-[var(--color-gold-light)]'
                                  : 'text-white/45 group-hover/item:text-white/80'
                              }`}
                            />

                            {collapsed && badge > 0 && (
                              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[var(--color-rust)] ring-2 ring-[var(--color-pine)]" />
                            )}
                          </span>

                          {!collapsed && (
                            <>
                              <span className="relative z-10 flex-1 truncate">
                                {item.name}
                              </span>

                              {badge > 0 && (
                                <span className="relative z-10 rounded-full bg-[var(--color-gold-light)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-[var(--color-pine)]">
                                  {badge}
                                </span>
                              )}
                            </>
                          )}
                        </motion.div>

                        {/* Tooltip */}
                        {collapsed && (
                          <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[var(--color-ink)] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/item:opacity-100 group-focus-visible/item:opacity-100">
                            {item.name}
                            {badge > 0 && ` · ${badge} batch`}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* BAGIAN BAWAH SIDEBAR */}
        <div className="relative z-10 space-y-2">

          {/* TOMBOL LOGOUT */}
          <button
            onClick={logout}
            aria-label="Logout"
            title={collapsed ? 'Logout' : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium text-white/60 transition-colors hover:bg-red-500/20 hover:text-white ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" />

            {!collapsed && <span>Logout</span>}
          </button>

          {/* TOMBOL CIUTKAN SIDEBAR */}
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Lebarkan sidebar' : 'Ciutkan sidebar'}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <motion.span
              animate={{ rotate: collapsed ? 180 : 0 }}
              className="flex"
            >
              <ChevronsLeft className="h-4 w-4" />
            </motion.span>

            {!collapsed && <span>Ciutkan menu</span>}
          </button>
        </div>
      </motion.aside>

      {/* ============ KONTEN UTAMA ============ */}

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* TOPBAR */}
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

            {/* PENCARIAN */}
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--color-ink-soft)]" />

              <input
                type="text"
                placeholder="Cari cepat..."
                className="w-52 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas-sunk)] py-2 pl-8 pr-3 text-xs text-[var(--color-ink)] placeholder-[var(--color-ink-soft)] transition-all focus:w-64 focus:border-[var(--color-gold)] focus:bg-white focus:outline-none"
              />
            </div>

            {/* NOTIFIKASI */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Notifikasi"
                aria-expanded={notifOpen}
                className="relative rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-[var(--color-ink-soft)] shadow-xs transition-colors hover:bg-[var(--color-canvas-sunk)]"
              >
                <Bell className="h-4 w-4" />

                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--color-rust)]" />
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-[var(--color-border)] bg-white p-3 shadow-xl"
                  >
                    <p className="px-2 pb-2 text-xs font-semibold text-[var(--color-ink-soft)]">
                      Notifikasi
                    </p>

                    {nearExpiry > 0 ? (
                      <Link
                        href="/inventory"
                        onClick={() => setNotifOpen(false)}
                        className="flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--color-pine-tint)]"
                      >
                        <span className="mt-0.5 rounded-lg bg-[var(--color-gold-tint)] p-1.5 text-[var(--color-pine)]">
                          <AlertTriangle className="h-4 w-4" />
                        </span>

                        <span className="text-xs">
                          <span className="block font-semibold">
                            {nearExpiry} batch mendekati expired
                          </span>

                          <span className="text-[var(--color-ink-soft)]">
                            Cek Stok & FEFO dan jual lebih dulu.
                          </span>
                        </span>
                      </Link>
                    ) : (
                      <p className="px-2 py-4 text-center text-xs text-[var(--color-ink-soft)]">
                        Tidak ada notifikasi baru.
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* INFORMASI PENGGUNA LOGIN */}
            <div className="flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] py-1 pl-1 pr-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-pine-tint)] text-xs font-bold text-[var(--color-pine)]">
                {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
              </div>

              <div className="text-left text-xs">
                <p className="font-semibold text-[var(--color-ink)]">
                  {currentUser?.name || 'Pengguna'}
                </p>

                <p className="text-[var(--color-ink-soft)]">
                  {currentUser?.role || 'Pengguna'}
                </p>
              </div>

              <ChevronDown className="h-3.5 w-3.5 text-[var(--color-ink-soft)]" />
            </div>
          </div>
        </header>

        {/* ISI HALAMAN */}
        <main className="relative flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/* =====================================================
   AUTH GUARD
   Memastikan pengguna login sebelum membuka dashboard
===================================================== */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <DashboardShell>{children}</DashboardShell>
    </AuthGuard>
  );
}
