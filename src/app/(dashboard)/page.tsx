'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  PackageX,
  ShoppingBag,
  ArrowUpRight,
  Clock,
  AlertCircle,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  Sector,
} from 'recharts';

/* =========================================================================
   MOCK DATA — akan diganti dengan query Supabase
   ========================================================================= */

// Tren Pendapatan vs Pengeluaran — mingguan & bulanan (untuk toggle periode)
const cashFlowWeekly = [
  { label: 'Senin', Penjualan: 3200000, Pengeluaran: 1500000 },
  { label: 'Selasa', Penjualan: 2800000, Pengeluaran: 1200000 },
  { label: 'Rabu', Penjualan: 4100000, Pengeluaran: 2800000 },
  { label: 'Kamis', Penjualan: 3900000, Pengeluaran: 1100000 },
  { label: 'Jumat', Penjualan: 5200000, Pengeluaran: 3400000 },
  { label: 'Sabtu', Penjualan: 6800000, Pengeluaran: 2100000 },
  { label: 'Minggu', Penjualan: 5900000, Pengeluaran: 1850000 },
];

const cashFlowMonthly = [
  { label: 'Mgg 1', Penjualan: 24500000, Pengeluaran: 11200000 },
  { label: 'Mgg 2', Penjualan: 27800000, Pengeluaran: 14300000 },
  { label: 'Mgg 3', Penjualan: 22100000, Pengeluaran: 9800000 },
  { label: 'Mgg 4', Penjualan: 31200000, Pengeluaran: 16500000 },
];

// Komposisi Penjualan per Kategori — untuk grafik lingkaran (donut)
const categoryShareData = [
  { name: 'Beras & Biji', value: 8450000, color: '#0B4D3A' },
  { name: 'Minyak & Bumbu', value: 6120000, color: '#14704F' },
  { name: 'Mie & Kaleng', value: 5380000, color: '#B8912F' },
  { name: 'Sembako Basah', value: 3260000, color: '#B4552E' },
  { name: 'Susu & Olahan', value: 2140000, color: '#D9B45C' },
];

// Top 5 Produk Terlaris (Kuantitas Terjual)
const topProductsData = [
  { name: 'Indomie Goreng (Dus)', qty: 185 },
  { name: 'Minyak Bimoli 2L', qty: 142 },
  { name: 'Beras Ramos 5kg', qty: 98 },
  { name: 'Gula Gulaku 1kg', qty: 86 },
  { name: 'Telur Ayam (Peti)', qty: 64 },
];

// Umur Kadaluarsa Barang (FEFO Tracking) — grafik batang bertumpuk
const expiredRiskData = [
  { category: 'Beras & Biji', Aman: 120, Risiko30Hari: 15, Kritis14Hari: 2 },
  { category: 'Minyak & Bumbu', Aman: 210, Risiko30Hari: 28, Kritis14Hari: 5 },
  { category: 'Mie & Kaleng', Aman: 340, Risiko30Hari: 42, Kritis14Hari: 12 },
  { category: 'Susu & Olahan', Aman: 85, Risiko30Hari: 18, Kritis14Hari: 8 },
];

// Sparkline mini untuk tiap kartu statistik (7 titik data terakhir)
const sparklines = {
  sales: [12, 18, 14, 22, 19, 27, 24].map((v, i) => ({ i, v })),
  expense: [8, 9, 14, 11, 16, 12, 13].map((v, i) => ({ i, v })),
  receivable: [4, 6, 5, 9, 7, 6, 7].map((v, i) => ({ i, v })),
  expiring: [3, 4, 4, 6, 5, 7, 8].map((v, i) => ({ i, v })),
};

const currency = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

/* =========================================================================
   KARTU STATISTIK — angka besar bergaya serif + sparkline + delta
   ========================================================================= */

interface StatProps {
  title: string;
  value: number;
  prefix?: string;
  delta: number; // persen, boleh negatif
  deltaGoodDirection?: 'up' | 'down'; // arah yang dianggap "baik" untuk metrik ini
  icon: React.ReactNode;
  accent: string; // warna teks & sparkline
  tint: string; // warna latar badge ikon
  sparkline: { i: number; v: number }[];
}

function StatCard({ title, value, prefix = 'Rp ', delta, deltaGoodDirection = 'up', icon, accent, tint, sparkline }: StatProps) {
  const numberRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (numberRef.current) {
      const obj = { count: 0 };
      gsap.to(obj, {
        count: value,
        duration: 1.1,
        ease: 'power2.out',
        onUpdate: () => {
          if (numberRef.current) {
            numberRef.current.innerText = `${prefix}${Math.floor(obj.count).toLocaleString('id-ID')}`;
          }
        },
      });
    }
  }, [value, prefix]);

  const isGood = deltaGoodDirection === 'up' ? delta >= 0 : delta <= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      className="glass-card-light relative overflow-hidden rounded-2xl p-5"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
            {title}
          </p>
          <span
            ref={numberRef}
            className="font-display mt-1.5 block text-[26px] font-semibold leading-none"
            style={{ color: accent }}
          >
            {prefix}0
          </span>
          <div
            className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isGood ? 'bg-[var(--color-pine-tint)] text-[var(--color-pine)]' : 'bg-[var(--color-rust-tint)] text-[var(--color-rust)]'
            }`}
          >
            {delta >= 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
            {Math.abs(delta)}% vs minggu lalu
          </div>
        </div>
        <div className="rounded-xl border p-2.5" style={{ backgroundColor: tint, borderColor: 'transparent' }}>
          <div style={{ color: accent }}>{icon}</div>
        </div>
      </div>

      {/* Sparkline */}
      <div className="mt-3 h-10 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkline} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`spark-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={accent} strokeWidth={2} fill={`url(#spark-${title})`} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

/* =========================================================================
   TOOLTIP KUSTOM — konsisten dengan palet hangat
   ========================================================================= */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 shadow-lg">
      {label && <p className="mb-1 text-[11px] font-semibold text-[var(--color-ink-soft)]">{label}</p>}
      <div className="space-y-1">
        {payload.map((p: any, idx: number) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
            <span className="text-[var(--color-ink-soft)]">{p.name}:</span>
            <span className="font-bold text-[var(--color-ink)]">{currency(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Bentuk sektor aktif pada donut chart (sedikit membesar saat hover)
function renderActiveSector(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
}

/* =========================================================================
   HALAMAN DASHBOARD
   ========================================================================= */

export default function HomePage() {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [activeSlice, setActiveSlice] = useState<number | undefined>(undefined);

  const cashFlowData = period === 'week' ? cashFlowWeekly : cashFlowMonthly;

  const totalCategorySales = useMemo(
    () => categoryShareData.reduce((sum, c) => sum + c.value, 0),
    []
  );

  const activeCategory = activeSlice !== undefined ? categoryShareData[activeSlice] : undefined;

  return (
    <div className="relative z-10 space-y-8">
      {/* ============ Banner Utama ============ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-pine)] p-8 text-white shadow-md"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(circle at 85% 20%, var(--color-gold-light) 0, transparent 38%), radial-gradient(circle at 10% 90%, #ffffff 0, transparent 30%)',
          }}
        />
        <div className="relative z-10 max-w-xl">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-[var(--color-gold-light)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-gold-light)]" />
            Sistem Live
          </span>
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">
            Selamat datang kembali, Admin.
          </h1>
          <p className="mt-2 text-sm text-white/70">
            Stok FEFO, kasir cepat, pengingat piutang via WhatsApp, dan jurnal keuangan — semua tercatat otomatis hari ini.
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="relative z-10 flex shrink-0 items-center gap-2 rounded-xl bg-[var(--color-gold-light)] px-5 py-2.5 text-xs font-bold text-[var(--color-pine)] shadow-lg transition-colors hover:bg-white"
        >
          <span>Transaksi Baru</span>
          <ArrowUpRight className="h-4 w-4" />
        </motion.button>
      </motion.div>

      {/* ============ Kartu Ringkasan Statistik ============ */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Penjualan Hari Ini"
          value={3250000}
          delta={8.2}
          accent="var(--color-pine)"
          tint="var(--color-pine-tint)"
          icon={<TrendingUp className="h-5 w-5" />}
          sparkline={sparklines.sales}
        />
        <StatCard
          title="Pengeluaran (PO)"
          value={1850000}
          delta={-3.1}
          deltaGoodDirection="down"
          accent="var(--color-clay)"
          tint="var(--color-clay-tint)"
          icon={<TrendingDown className="h-5 w-5" />}
          sparkline={sparklines.expense}
        />
        <StatCard
          title="Piutang Belum Lunas"
          value={620000}
          delta={4.6}
          deltaGoodDirection="down"
          accent="var(--color-gold)"
          tint="var(--color-gold-tint)"
          icon={<ShoppingBag className="h-5 w-5" />}
          sparkline={sparklines.receivable}
        />
        <StatCard
          title="Item Mendekati Expired"
          value={8}
          prefix=""
          delta={12.5}
          deltaGoodDirection="down"
          accent="var(--color-rust)"
          tint="var(--color-rust-tint)"
          icon={<PackageX className="h-5 w-5" />}
          sparkline={sparklines.expiring}
        />
      </div>

      {/* ============ Baris 1: Arus Kas (garis) + Komposisi Kategori (lingkaran) ============ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Grafik Garis — Arus Kas, dengan toggle periode interaktif */}
        <div className="glass-card-light rounded-2xl p-6 lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-display text-[16px] font-semibold text-[var(--color-ink)]">
                Tren Pendapatan vs Pengeluaran
              </h3>
              <p className="text-xs text-[var(--color-ink-soft)]">Perbandingan siklus transaksi toko</p>
            </div>
            {/* Toggle Periode — interaktif, mengganti dataset chart */}
            <div className="flex rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas-sunk)] p-0.5 text-xs font-semibold">
              {(['week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-md px-3 py-1.5 transition-colors ${
                    period === p
                      ? 'bg-[var(--color-pine)] text-white shadow-sm'
                      : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  {p === 'week' ? 'Mingguan' : 'Bulanan'}
                </button>
              ))}
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlowData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0B4D3A" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#0B4D3A" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#B8912F" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#B8912F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E1D3" />
                <XAxis dataKey="label" stroke="#57534E" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#57534E"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v / 1000000}jt`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Penjualan"
                  stroke="#0B4D3A"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorSales)"
                  activeDot={{ r: 5 }}
                />
                <Area
                  type="monotone"
                  dataKey="Pengeluaran"
                  stroke="#B8912F"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorExpense)"
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Grafik Lingkaran (Donut) — Komposisi Penjualan per Kategori, interaktif */}
        <div className="glass-card-light rounded-2xl p-6">
          <div className="mb-4">
            <h3 className="font-display text-[16px] font-semibold text-[var(--color-ink)]">
              Komposisi Penjualan
            </h3>
            <p className="text-xs text-[var(--color-ink-soft)]">Kontribusi tiap kategori bulan ini</p>
          </div>

          <div className="relative h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryShareData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={80}
                  paddingAngle={3}
                  cornerRadius={4}
                  activeIndex={activeSlice}
                  activeShape={renderActiveSector}
                  onMouseEnter={(_, idx) => setActiveSlice(idx)}
                  onMouseLeave={() => setActiveSlice(undefined)}
                >
                  {categoryShareData.map((entry, idx) => (
                    <Cell key={entry.name} fill={entry.color} stroke="#FFFFFE" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Label tengah — berubah sesuai segmen yang di-hover */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
                {activeCategory ? activeCategory.name : 'Total'}
              </span>
              <span className="font-display text-[15px] font-semibold text-[var(--color-ink)]">
                {activeCategory
                  ? `${Math.round((activeCategory.value / totalCategorySales) * 100)}%`
                  : currency(totalCategorySales)}
              </span>
            </div>
          </div>

          {/* Legenda kustom — klik untuk menyorot segmen */}
          <div className="mt-4 space-y-1.5">
            {categoryShareData.map((c, idx) => (
              <button
                key={c.name}
                onMouseEnter={() => setActiveSlice(idx)}
                onMouseLeave={() => setActiveSlice(undefined)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left transition-colors hover:bg-[var(--color-canvas-sunk)]"
              >
                <span className="flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </span>
                <span className="text-xs font-bold text-[var(--color-ink)]">
                  {Math.round((c.value / totalCategorySales) * 100)}%
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ============ Baris 2: Produk Terlaris (batang) + Risiko FEFO (batang bertumpuk) ============ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Grafik Batang — Top 5 Produk */}
        <div className="glass-card-light rounded-2xl p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-display text-[16px] font-semibold text-[var(--color-ink)]">Produk Terlaris</h3>
              <p className="text-xs text-[var(--color-ink-soft)]">Kuantitas terjual (unit)</p>
            </div>
            <TrendingUp className="h-4 w-4 text-[var(--color-pine)]" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductsData} layout="vertical" margin={{ top: 0, right: 16, left: 12, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="#57534E"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                />
                <Tooltip cursor={{ fill: 'rgba(11,77,58,0.05)' }} content={<ChartTooltip />} />
                <Bar dataKey="qty" name="Terjual" radius={[0, 6, 6, 0]} barSize={16}>
                  {topProductsData.map((_, idx) => (
                    <Cell key={idx} fill={idx === 0 ? '#0B4D3A' : '#7C9A82'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Grafik Batang Bertumpuk — Risiko FEFO */}
        <div className="glass-card-light rounded-2xl p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg border border-[var(--color-rust-tint)] bg-[var(--color-rust-tint)] p-2 text-[var(--color-rust)]">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-display text-[16px] font-semibold text-[var(--color-ink)]">Risiko Kadaluarsa</h3>
                <p className="text-xs text-[var(--color-ink-soft)]">Umur simpan per kategori</p>
              </div>
            </div>
            <span className="flex items-center gap-1 rounded-md border border-[var(--color-rust-tint)] bg-[var(--color-rust-tint)] px-2.5 py-1 text-xs font-semibold text-[var(--color-rust)]">
              <AlertCircle className="h-3.5 w-3.5" /> 8 Kritis
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expiredRiskData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E1D3" />
                <XAxis dataKey="category" stroke="#57534E" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#57534E" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(11,77,58,0.05)' }} content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="Aman" stackId="a" fill="#7C9A82" barSize={26} />
                <Bar dataKey="Risiko30Hari" stackId="a" fill="#B8912F" barSize={26} />
                <Bar dataKey="Kritis14Hari" stackId="a" fill="#A23B32" radius={[4, 4, 0, 0]} barSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}