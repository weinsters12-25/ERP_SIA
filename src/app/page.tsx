'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import Link from 'next/link';
import { motion } from 'framer-motion';
import DashboardLayout from './(dashboard)/layout';
import { TrendingUp, TrendingDown, PackageX, ShoppingBag } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  useErpStore,
  useHydrated,
  getArRemaining,
  getExpiryStatus,
  toDateStr,
} from '@/stores/useErpStore';
import { rp } from '@/components/ErpUi';

/* ---------- Konstanta warna ---------- */
const PINE = '#0d4f3c';
const GOLD = '#d9a93a';
const CORAL = '#d4684a';
const SAGE = '#7fb59a';

const STATUS_COLOR: Record<string, string> = {
  aman: SAGE,
  peringatan: GOLD,
  kritis: CORAL,
  expired: '#8a2f2f',
};
const STATUS_LABEL: Record<string, string> = {
  aman: 'Aman',
  peringatan: 'Peringatan',
  kritis: 'Kritis',
  expired: 'Kadaluarsa',
};

const RANGES = [7, 14, 30] as const;

const shortRp = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')} jt`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} rb`;
  return String(n);
};

/* ---------- Kartu statistik ---------- */
interface StatProps {
  title: string;
  value: number;
  prefix?: string;
  icon: React.ReactNode;
  delay?: number;
}

function StatCard({ title, value, prefix = 'Rp ', icon, delay = 0 }: StatProps) {
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
      transition={{ delay }}
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

/* ---------- Tooltip kustom ---------- */
function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold">{payload[0].payload.full ?? label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[var(--color-ink-soft)]">{p.name}</span>
          <span className="ml-auto pl-3 font-bold">{rp(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass-card-light rounded-2xl p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--color-ink-soft)]">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-[var(--color-border-strong)] text-sm text-[var(--color-ink-soft)]">
      {text}
    </div>
  );
}

/* ---------- Halaman ---------- */
export default function HomePage() {
  const hydrated = useHydrated();
  const journals = useErpStore((s) => s.journals);
  const purchaseOrders = useErpStore((s) => s.purchaseOrders);
  const receivables = useErpStore((s) => s.receivables);
  const products = useErpStore((s) => s.products);

  const [range, setRange] = useState<(typeof RANGES)[number]>(7);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);

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

  /* Tren penjualan vs pengeluaran per hari */
  const trend = useMemo(() => {
    const days: { key: string; label: string; full: string; penjualan: number; pengeluaran: number }[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        key: toDateStr(d),
        label: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        full: d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }),
        penjualan: 0,
        pengeluaran: 0,
      });
    }
    const map = new Map(days.map((d) => [d.key, d]));
    journals.forEach((j) => {
      if (j.type !== 'SALES') return;
      const row = map.get(j.date.slice(0, 10));
      if (row) row.penjualan += j.amount;
    });
    purchaseOrders.forEach((o) => {
      if (o.status === 'CANCELLED') return;
      const row = map.get(o.date);
      if (row) row.pengeluaran += o.totalAmount;
    });
    return days;
  }, [journals, purchaseOrders, range]);

  const trendTotals = useMemo(
    () => ({
      sales: trend.reduce((s, d) => s + d.penjualan, 0),
      spend: trend.reduce((s, d) => s + d.pengeluaran, 0),
    }),
    [trend]
  );

  /* Komposisi batch berdasarkan status kedaluwarsa */
  const expiryData = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) =>
      p.batches.forEach((b) => {
        if (b.qty <= 0) return;
        const st = String(getExpiryStatus(b.expiredDate));
        counts[st] = (counts[st] ?? 0) + 1;
      })
    );
    return Object.entries(counts).map(([status, value]) => ({
      status,
      name: STATUS_LABEL[status] ?? status,
      value,
      color: STATUS_COLOR[status] ?? '#b8b8b8',
    }));
  }, [products]);
  const totalBatch = expiryData.reduce((s, d) => s + d.value, 0);
  const activeSlice = expiryData.find((d) => d.status === activeStatus);

  /* 5 produk dengan stok terbanyak */
  const topStock = useMemo(
    () =>
      products
        .map((p: any) => ({
          name: String(p.name ?? p.id).length > 16 ? `${String(p.name ?? p.id).slice(0, 15)}…` : String(p.name ?? p.id),
          full: String(p.name ?? p.id),
          stok: p.batches.reduce((s: number, b: any) => s + Math.max(b.qty, 0), 0),
        }))
        .filter((p) => p.stok > 0)
        .sort((a, b) => b.stok - a.stok)
        .slice(0, 5),
    [products]
  );

  const latest = journals.slice(0, 5);
  const trendHasData = trend.some((d) => d.penjualan > 0 || d.pengeluaran > 0);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Welcome Banner */}
        <div className="relative flex items-center justify-between overflow-hidden rounded-2xl bg-[var(--color-pine)] p-6 text-white shadow-lg">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/5"
          />
          <div className="relative">
            <h1 className="font-display text-2xl font-semibold">Selamat Datang di Toserba ERP</h1>
            <p className="mt-1 text-sm font-medium opacity-80">
              Sistem Manajemen Stok FEFO, Kasir POS, dan Keuangan Toko Sembako.
            </p>
          </div>
          <Link
            href="/pos"
            className="relative rounded-xl bg-white px-4 py-2 text-sm font-bold text-[var(--color-pine)] transition-colors hover:bg-[var(--color-gold-tint)]"
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
            delay={0.05}
          />
          <StatCard
            title="Piutang Belum Lunas"
            value={hydrated ? stats.arOpen : 0}
            icon={<ShoppingBag className="h-6 w-6" />}
            delay={0.1}
          />
          <StatCard
            title="Batch Mendekati Expired"
            value={hydrated ? stats.nearExpiry : 0}
            prefix=""
            icon={<PackageX className="h-6 w-6" />}
            delay={0.15}
          />
        </div>

        {/* Grafik utama */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <ChartCard
            className="xl:col-span-2"
            title="Tren Penjualan & Pengeluaran"
            subtitle={`Total ${range} hari: penjualan ${rp(trendTotals.sales)} · pengeluaran ${rp(trendTotals.spend)}`}
            action={
              <div className="flex rounded-xl bg-[var(--color-pine-tint)] p-1" role="tablist" aria-label="Rentang waktu">
                {RANGES.map((r) => (
                  <button
                    key={r}
                    role="tab"
                    aria-selected={range === r}
                    onClick={() => setRange(r)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                      range === r
                        ? 'bg-[var(--color-pine)] text-white shadow'
                        : 'text-[var(--color-pine)] hover:bg-white/60'
                    }`}
                  >
                    {r} hari
                  </button>
                ))}
              </div>
            }
          >
            {!hydrated || !trendHasData ? (
              <EmptyChart text="Belum ada data penjualan atau pengeluaran pada rentang ini." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PINE} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={PINE} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={GOLD} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.07)" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      interval={range > 14 ? 3 : 0}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      tickFormatter={shortRp}
                      width={52}
                    />
                    <Tooltip content={<MoneyTooltip />} cursor={{ stroke: PINE, strokeDasharray: '4 4' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="penjualan"
                      name="Penjualan"
                      stroke={PINE}
                      strokeWidth={2.5}
                      fill="url(#gSales)"
                      activeDot={{ r: 6 }}
                      animationDuration={900}
                    />
                    <Area
                      type="monotone"
                      dataKey="pengeluaran"
                      name="Pengeluaran (PO)"
                      stroke={GOLD}
                      strokeWidth={2.5}
                      fill="url(#gSpend)"
                      activeDot={{ r: 6 }}
                      animationDuration={900}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <ChartCard title="Kondisi Batch Stok" subtitle="Arahkan kursor atau klik irisan untuk detail">
            {!hydrated || totalBatch === 0 ? (
              <EmptyChart text="Belum ada batch stok aktif." />
            ) : (
              <>
                <div className="relative h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expiryData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={62}
                        outerRadius={90}
                        paddingAngle={3}
                        cornerRadius={6}
                        stroke="none"
                        animationDuration={900}
                        onMouseEnter={(_, i) => setActiveStatus(expiryData[i].status)}
                        onMouseLeave={() => setActiveStatus(null)}
                        onClick={(_, i) =>
                          setActiveStatus((cur) => (cur === expiryData[i].status ? null : expiryData[i].status))
                        }
                      >
                        {expiryData.map((d) => (
                          <Cell
                            key={d.status}
                            fill={d.color}
                            opacity={activeStatus && activeStatus !== d.status ? 0.35 : 1}
                            style={{ cursor: 'pointer', outline: 'none', transition: 'opacity .2s' }}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-3xl font-semibold text-[var(--color-pine)]">
                      {activeSlice ? activeSlice.value : totalBatch}
                    </span>
                    <span className="text-xs text-[var(--color-ink-soft)]">
                      {activeSlice ? `batch ${activeSlice.name.toLowerCase()}` : 'total batch'}
                    </span>
                  </div>
                </div>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {expiryData.map((d) => (
                    <li
                      key={d.status}
                      onMouseEnter={() => setActiveStatus(d.status)}
                      onMouseLeave={() => setActiveStatus(null)}
                      className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-[var(--color-pine-tint)]"
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                      <span>{d.name}</span>
                      <span className="ml-auto font-bold">{d.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <ChartCard title="Stok Terbanyak" subtitle="5 produk dengan total stok tertinggi" className="xl:col-span-1">
            {!hydrated || topStock.length === 0 ? (
              <EmptyChart text="Belum ada stok produk." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topStock} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.07)" />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: '#374151' }}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(13,79,60,0.06)' }}
                      formatter={(v: number) => [v.toLocaleString('id-ID'), 'Stok']}
                      labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ''}
                    />
                    <Bar dataKey="stok" radius={[0, 8, 8, 0]} barSize={18} animationDuration={900}>
                      {topStock.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? GOLD : PINE} fillOpacity={i === 0 ? 1 : 0.85 - i * 0.1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          {/* Aktivitas Transaksi Terakhir */}
          <div className="glass-card-light rounded-2xl p-6 xl:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Aktivitas Transaksi Terakhir</h3>
              <Link href="/jurnal" className="text-xs font-semibold text-[var(--color-pine)] hover:underline">
                Lihat semua
              </Link>
            </div>
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
      </div>
    </DashboardLayout>
  );
}