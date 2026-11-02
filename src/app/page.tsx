'use client';

import { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import Link from 'next/link';
import { motion } from 'framer-motion';
import DashboardLayout from './(dashboard)/layout';
import { TrendingUp, TrendingDown, PackageX, ShoppingBag } from 'lucide-react';
import {
  useErpStore,
  useHydrated,
  getArRemaining,
  getExpiryStatus,
  toDateStr,
} from '@/stores/useErpStore';
import { rp } from '@/components/ErpUi';

interface StatProps {
  title: string;
  value: number;
  prefix?: string;
  icon: React.ReactNode;
}

function StatCard({ title, value, prefix = 'Rp ', icon }: StatProps) {
  const numberRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (numberRef.current) {
      const obj = { count: 0 };
      gsap.to(obj, {
        count: value,
        duration: 1.2,
        ease: 'power2.out',
        onUpdate: () => {
          if (numberRef.current) {
            numberRef.current.innerText = `${prefix}${Math.floor(obj.count).toLocaleString('id-ID')}`;
          }
        },
      });
    }
  }, [value, prefix]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className="glass-card-light relative overflow-hidden rounded-2xl p-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-soft)]">{title}</p>
          <span ref={numberRef} className="font-display mt-2 block text-2xl font-semibold text-[var(--color-pine)]">
            {prefix}0
          </span>
        </div>
        <div className="rounded-xl border border-[var(--color-pine)]/15 bg-[var(--color-pine-tint)] p-3 text-[var(--color-pine)]">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

export default function HomePage() {
  const hydrated = useHydrated();
  const journals = useErpStore((s) => s.journals);
  const purchaseOrders = useErpStore((s) => s.purchaseOrders);
  const receivables = useErpStore((s) => s.receivables);
  const products = useErpStore((s) => s.products);

  const stats = useMemo(() => {
    const today = toDateStr(new Date());

    const salesToday = journals
      .filter((j) => j.type === 'SALES' && j.date.startsWith(today))
      .reduce((s, j) => s + j.amount, 0);

    const poToday = purchaseOrders
      .filter((o) => o.status !== 'CANCELLED' && o.date === today)
      .reduce((s, o) => s + o.totalAmount, 0);

    const arOpen = receivables.reduce((s, r) => s + getArRemaining(r), 0);

    const nearExpiry = products.reduce(
      (s, p) =>
        s +
        p.batches.filter((b) => {
          if (b.qty <= 0) return false;
          const st = getExpiryStatus(b.expiredDate);
          return st === 'kritis' || st === 'peringatan';
        }).length,
      0
    );

    return { salesToday, poToday, arOpen, nearExpiry };
  }, [journals, purchaseOrders, receivables, products]);

  const latest = journals.slice(0, 5);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Welcome Banner */}
        <div className="flex items-center justify-between rounded-2xl bg-[var(--color-pine)] p-6 text-white shadow-lg">
          <div>
            <h1 className="font-display text-2xl font-semibold">Selamat Datang di Toserba ERP</h1>
            <p className="mt-1 text-sm font-medium opacity-80">
              Sistem Manajemen Stok FEFO, Kasir POS, dan Keuangan Toko Sembako.
            </p>
          </div>
          <Link
            href="/pos"
            className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[var(--color-pine)] transition-colors hover:bg-[var(--color-gold-tint)]"
          >
            + Transaksi Baru
          </Link>
        </div>

        {/* Ringkasan Statistik */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Penjualan Hari Ini"
            value={hydrated ? stats.salesToday : 0}
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <StatCard
            title="Pengeluaran (PO)"
            value={hydrated ? stats.poToday : 0}
            icon={<TrendingDown className="h-6 w-6" />}
          />
          <StatCard
            title="Piutang Belum Lunas"
            value={hydrated ? stats.arOpen : 0}
            icon={<ShoppingBag className="h-6 w-6" />}
          />
          <StatCard
            title="Batch Mendekati Expired"
            value={hydrated ? stats.nearExpiry : 0}
            prefix=""
            icon={<PackageX className="h-6 w-6" />}
          />
        </div>

        {/* Aktivitas Transaksi Terakhir */}
        <div className="glass-card-light rounded-2xl p-6">
          <h3 className="font-display mb-4 text-lg font-semibold">Aktivitas Transaksi Terakhir</h3>
          {!hydrated || latest.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border-strong)] py-12 text-center text-sm text-[var(--color-ink-soft)]">
              Belum ada transaksi. Mulai dari menu POS Kasir, Stok, atau Pengeluaran.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {latest.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{j.description}</p>
                    <p className="font-mono text-[11px] text-[var(--color-ink-soft)]">
                      {j.id} · {j.date}
                    </p>
                  </div>
                  <span className="shrink-0 font-bold">{rp(j.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}