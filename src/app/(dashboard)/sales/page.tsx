'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowUpDown,
  Banknote,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Search,
  Send,
  Wallet,
  X,
} from 'lucide-react';
import {
  useErpStore,
  useHydrated,
  getArRemaining,
  getArStatus,
  getDaysLeft,
  type Receivable,
} from '@/stores/useErpStore';
import { ErrorBox } from '@/components/ErpUi';

type Filter = 'all' | 'active' | 'overdue' | 'paid';
type Sort = 'due' | 'amount' | 'name';

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

/* Kelompok umur piutang (berdasarkan keterlambatan) */
const BUCKETS = [
  { key: 'ok', label: 'Belum jatuh tempo', color: '#0d4f3c', test: (d: number) => d >= 0 },
  { key: 'l1', label: 'Terlambat 1–7 hari', color: '#d9a93a', test: (d: number) => d < 0 && d >= -7 },
  { key: 'l2', label: 'Terlambat 8–30 hari', color: '#d4684a', test: (d: number) => d < -7 && d >= -30 },
  { key: 'l3', label: 'Terlambat > 30 hari', color: '#8a2f2f', test: (d: number) => d < -30 },
] as const;
type BucketKey = (typeof BUCKETS)[number]['key'];

const bucketOf = (r: Receivable): BucketKey => {
  const d = getDaysLeft(r.dueDate);
  return BUCKETS.find((b) => b.test(d))!.key;
};

const dueText = (r: Receivable) => {
  const d = getDaysLeft(r.dueDate);
  if (d < 0) return `Terlambat ${Math.abs(d)} hari`;
  if (d === 0) return 'Jatuh tempo hari ini';
  return `${d} hari lagi`;
};

const buildWaText = (ar: Receivable, remaining: number) =>
  `Halo Yth. ${ar.customerName},\n\nPengingat dari Toserba ERP. Tagihan bon Anda sebesar ${rp(remaining)} untuk nota ${ar.id} jatuh tempo pada ${ar.dueDate}.\n\nMohon untuk melakukan pelunasan melalui transfer / tunai di kasir toko. Terima kasih!`;

const waLink = (phone: string, text: string) => {
  let n = phone.replace(/\D/g, '');
  if (n.startsWith('0')) n = `62${n.slice(1)}`;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
};

/* ---------- potongan tampilan bersama ---------- */

const badge = 'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold whitespace-nowrap';

function StatusBadge({ ar }: { ar: Receivable }) {
  const status = getArStatus(ar);
  if (status === 'PAID')
    return <span className={`${badge} bg-[var(--color-pine-tint)] text-[var(--color-pine)]`}>Lunas</span>;
  if (status === 'OVERDUE')
    return <span className={`${badge} bg-[var(--color-rust-tint)] text-[var(--color-rust)]`}>Lewat Jatuh Tempo</span>;
  return <span className={`${badge} bg-[var(--color-gold-tint)] text-[var(--color-gold)]`}>Mendekati Tempo</span>;
}

function PaidBar({ ar }: { ar: Receivable }) {
  const pct = ar.totalAmount > 0 ? Math.min(100, Math.round((ar.paidAmount / ar.totalAmount) * 100)) : 0;
  const overdue = getArStatus(ar) === 'OVERDUE';
  return (
    <div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-canvas-sunk)]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${pct === 100 ? 'bg-[var(--color-pine)]' : overdue ? 'bg-[var(--color-rust)]' : 'bg-[var(--color-gold)]'}`}
        />
      </div>
      <p className="mt-1 text-[10px] text-[var(--color-ink-soft)]">Terbayar {pct}%</p>
    </div>
  );
}

const Avatar = ({ name, overdue }: { name: string; overdue?: boolean }) => (
  <span
    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-base font-bold ${
      overdue ? 'bg-[var(--color-rust-tint)] text-[var(--color-rust)]' : 'bg-[var(--color-pine-tint)] text-[var(--color-pine)]'
    }`}
  >
    {name.trim().charAt(0).toUpperCase() || '?'}
  </span>
);

function ArActions({ onWa, onPay, labeled }: { onWa: () => void; onPay: () => void; labeled?: boolean }) {
  const grow = labeled ? 'flex-1 justify-center' : '';
  return (
    <div className={`flex gap-1.5 ${labeled ? 'w-full' : 'justify-end'}`}>
      <button
        onClick={onWa}
        className={`inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 ${grow}`}
      >
        <Send className="h-3.5 w-3.5" /> WA Alert
      </button>
      <button
        onClick={onPay}
        className={`inline-flex items-center gap-1 rounded-lg bg-[var(--color-pine)] px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[var(--color-pine-light)] ${grow}`}
      >
        <Banknote className="h-3.5 w-3.5" /> Bayar Bon
      </button>
    </div>
  );
}

/* Lembar modal: dari bawah di ponsel, di tengah di layar lebar */
function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--color-ink)]/40 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl sm:rounded-3xl"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export default function SalesPage() {
  const hydrated = useHydrated();
  const receivables = useErpStore((s) => s.receivables);
  const accounts = useErpStore((s) => s.accounts);
  const payReceivable = useErpStore((s) => s.payReceivable);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [bucket, setBucket] = useState<BucketKey | null>(null);
  const [sort, setSort] = useState<Sort>('due');
  const [selectedAr, setSelectedAr] = useState<Receivable | null>(null);
  const [isWaModalOpen, setIsWaModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payAccountId, setPayAccountId] = useState('101');
  const [payError, setPayError] = useState('');
  const [waText, setWaText] = useState('');
  const [isSuccessAlert, setIsSuccessAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // Kalkulasi Ringkasan Dinamis
  const summary = useMemo(() => {
    const active = receivables.filter((r) => getArStatus(r) !== 'PAID');
    const overdue = receivables.filter((r) => getArStatus(r) === 'OVERDUE');
    const totalBon = receivables.reduce((s, r) => s + r.totalAmount, 0);
    const totalPaid = receivables.reduce((s, r) => s + r.paidAmount, 0);
    return {
      activeCount: active.length,
      overdueCount: overdue.length,
      totalActive: active.reduce((s, r) => s + getArRemaining(r), 0),
      totalOverdue: overdue.reduce((s, r) => s + getArRemaining(r), 0),
      totalPaid,
      rate: totalBon > 0 ? Math.round((totalPaid / totalBon) * 100) : 0,
    };
  }, [receivables]);

  // Umur piutang (hanya yang masih ada sisa)
  const aging = useMemo(() => {
    const open = receivables.filter((r) => getArRemaining(r) > 0);
    const rows = BUCKETS.map((b) => {
      const list = open.filter((r) => bucketOf(r) === b.key);
      return { ...b, count: list.length, amount: list.reduce((s, r) => s + getArRemaining(r), 0) };
    });
    return { rows, total: rows.reduce((s, r) => s + r.amount, 0) };
  }, [receivables]);

  const counts = useMemo(
    () => ({
      all: receivables.length,
      active: receivables.filter((r) => getArStatus(r) !== 'PAID').length,
      overdue: summary.overdueCount,
      paid: receivables.filter((r) => getArStatus(r) === 'PAID').length,
    }),
    [receivables, summary.overdueCount]
  );

  const filteredAr = useMemo(() => {
    const q = search.toLowerCase();
    return receivables
      .filter(
        (item) =>
          (item.customerName.toLowerCase().includes(q) || item.id.toLowerCase().includes(q) || item.phone.includes(search)) &&
          (filter === 'all' ||
            (filter === 'active' && getArStatus(item) !== 'PAID') ||
            (filter === 'overdue' && getArStatus(item) === 'OVERDUE') ||
            (filter === 'paid' && getArStatus(item) === 'PAID')) &&
          (!bucket || (getArRemaining(item) > 0 && bucketOf(item) === bucket))
      )
      .sort((a, b) => {
        if (sort === 'amount') return getArRemaining(b) - getArRemaining(a);
        if (sort === 'name') return a.customerName.localeCompare(b.customerName);
        // jatuh tempo: yang belum lunas dulu, tanggal terdekat di atas
        const pa = getArRemaining(a) > 0 ? 0 : 1;
        const pb = getArRemaining(b) > 0 ? 0 : 1;
        return pa - pb || a.dueDate.localeCompare(b.dueDate);
      });
  }, [receivables, search, filter, bucket, sort]);

  const showToast = (message: string) => {
    setAlertMessage(message);
    setIsSuccessAlert(true);
    setTimeout(() => setIsSuccessAlert(false), 3000);
  };

  const handleOpenWaModal = (ar: Receivable) => {
    setSelectedAr(ar);
    setWaText(buildWaText(ar, getArRemaining(ar)));
    setIsWaModalOpen(true);
  };

  const handleSendWa = () => {
    setIsWaModalOpen(false);
    showToast(`Notifikasi WhatsApp Pengingat Bon berhasil dikirim ke ${selectedAr?.customerName}!`);
  };

  const handleOpenPayModal = (ar: Receivable) => {
    setSelectedAr(ar);
    setPayAmount(getArRemaining(ar));
    setPayAccountId('101');
    setPayError('');
    setIsPayModalOpen(true);
  };

  const handleSavePayment = () => {
    if (!selectedAr) return;
    const res = payReceivable(selectedAr.id, payAmount, payAccountId);
    if (!res.ok) {
      setPayError(res.error);
      return;
    }
    setIsPayModalOpen(false);
    showToast(res.message);
  };

  if (!hydrated) return <p className="text-sm text-[var(--color-ink-soft)]">Memuat data piutang…</p>;

  const selectedRemaining = selectedAr ? getArRemaining(selectedAr) : 0;

  const cards = [
    {
      label: 'Total Piutang Aktif (AR)',
      value: rp(summary.totalActive),
      note: `${summary.activeCount} Pelanggan memiliki sisa bon`,
      icon: Wallet,
      border: 'border-l-[var(--color-gold)]',
      tone: 'text-[var(--color-gold)]',
      bg: 'bg-[var(--color-gold-tint)]',
      go: 'active' as Filter,
    },
    {
      label: 'Piutang Jatuh Tempo (Overdue)',
      value: rp(summary.totalOverdue),
      note: `${summary.overdueCount} Nota melewati batas pembayaran`,
      icon: AlertTriangle,
      border: 'border-l-[var(--color-rust)]',
      tone: 'text-[var(--color-rust)]',
      bg: 'bg-[var(--color-rust-tint)]',
      go: 'overdue' as Filter,
    },
    {
      label: 'Total Piutang Terbayar',
      value: rp(summary.totalPaid),
      note: 'Tercatat di Jurnal Penerimaan Kas',
      icon: CheckCircle2,
      border: 'border-l-[var(--color-pine)]',
      tone: 'text-[var(--color-pine)]',
      bg: 'bg-[var(--color-pine-tint)]',
      go: 'paid' as Filter,
    },
  ];

  const actionsFor = (item: Receivable, labeled?: boolean) =>
    getArRemaining(item) > 0 ? (
      <ArActions labeled={labeled} onWa={() => handleOpenWaModal(item)} onPay={() => handleOpenPayModal(item)} />
    ) : (
      <span className="text-[11px] font-semibold text-[var(--color-pine)]">✓ Selesai</span>
    );

  const afterPay = Math.max(selectedRemaining - payAmount, 0);

  return (
    <div className="relative z-10 space-y-5 sm:space-y-6">
      {/* Header Page */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-xl font-semibold sm:text-2xl">Siklus Pendapatan & Piutang (AR)</h1>
          <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
            Manajemen Buku Bon Pelanggan, Pembayaran Piutang, & Otomasi Pengingat WhatsApp
          </p>
        </div>
      </div>

      {/* Ringkasan Kartu Piutang */}
      <div className="grid grid-cols-1 gap-3 sm:gap-5 md:grid-cols-3">
        {cards.map((c, i) => (
          <motion.button
            key={c.label}
            type="button"
            onClick={() => {
              setFilter(c.go);
              setBucket(null);
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            whileHover={{ y: -3 }}
            className={`glass-card-light flex items-center justify-between gap-3 rounded-2xl border-l-4 p-4 text-left transition-shadow hover:shadow-lg sm:p-5 ${c.border}`}
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--color-ink-soft)]">{c.label}</p>
              <p className={`font-display mt-1 truncate text-xl font-semibold sm:text-2xl ${c.tone}`}>{c.value}</p>
              <p className="mt-1 text-[11px] text-[var(--color-ink-soft)]">{c.note}</p>
            </div>
            <span className={`shrink-0 rounded-xl p-2.5 ${c.bg} ${c.tone}`}>
              <c.icon className="h-5 w-5" />
            </span>
          </motion.button>
        ))}
      </div>

      {/* Umur piutang (interaktif) */}
      <div className="glass-card-light rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold sm:text-lg">Umur Piutang</h3>
            <p className="text-xs text-[var(--color-ink-soft)]">Klik kelompok untuk menyaring daftar bon di bawah</p>
          </div>
          <div className="min-w-[150px] text-right">
            <p className="text-[11px] text-[var(--color-ink-soft)]">Bon yang sudah terkumpul</p>
            <p className="font-display text-lg font-semibold text-[var(--color-pine)]">{summary.rate}%</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-canvas-sunk)]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${summary.rate}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-[var(--color-pine)]"
              />
            </div>
          </div>
        </div>

        {aging.total === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border-strong)] py-6 text-center text-xs text-[var(--color-ink-soft)]">
            Tidak ada piutang berjalan. 🎉
          </p>
        ) : (
          <>
            <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-[var(--color-canvas-sunk)]">
              {aging.rows
                .filter((r) => r.amount > 0)
                .map((r) => (
                  <motion.button
                    key={r.key}
                    type="button"
                    title={`${r.label}: ${rp(r.amount)}`}
                    aria-label={`${r.label}: ${rp(r.amount)}`}
                    onClick={() => {
                      setBucket((b) => (b === r.key ? null : r.key));
                      setFilter('all');
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(r.amount / aging.total) * 100}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    style={{ background: r.color, opacity: bucket && bucket !== r.key ? 0.3 : 1 }}
                    className="h-full transition-opacity first:rounded-l-full last:rounded-r-full hover:brightness-110"
                  />
                ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {aging.rows.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  disabled={r.count === 0}
                  onClick={() => {
                    setBucket((b) => (b === r.key ? null : r.key));
                    setFilter('all');
                  }}
                  className={`rounded-xl border px-3 py-2 text-left transition-all disabled:opacity-40 ${
                    bucket === r.key ? 'border-[var(--color-pine)] bg-[var(--color-pine-tint)] shadow-sm' : 'border-[var(--color-border)] hover:bg-[var(--color-canvas)]'
                  }`}
                >
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-ink-soft)]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />
                    {r.label}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-bold">{rp(r.amount)}</p>
                  <p className="text-[10px] text-[var(--color-ink-soft)]">{r.count} nota</p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Search Bar, filter & urutan */}
      <div className="glass-card-light space-y-3 rounded-2xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-[var(--color-ink-soft)]" />
            <input
              type="text"
              placeholder="Cari Pelanggan, No AR, No HP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] py-2 pl-10 pr-4 text-xs focus:border-[var(--color-gold)] focus:outline-none"
            />
          </div>
          <div className="relative">
            <ArrowUpDown className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--color-ink-soft)]" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Urutkan"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] py-2 pl-8 pr-3 text-xs font-semibold focus:border-[var(--color-gold)] focus:outline-none sm:w-auto"
            >
              <option value="due">Jatuh tempo terdekat</option>
              <option value="amount">Sisa tagihan terbesar</option>
              <option value="name">Nama A–Z</option>
            </select>
          </div>
        </div>

        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5 text-xs font-semibold">
          {(
            [
              ['all', 'Semua'],
              ['active', 'Belum lunas'],
              ['overdue', 'Lewat tempo'],
              ['paid', 'Lunas'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 transition-colors ${
                filter === key
                  ? 'border-[var(--color-pine)] bg-[var(--color-pine)] text-white shadow-sm'
                  : 'border-[var(--color-border)] text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas-sunk)]'
              }`}
            >
              {label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${filter === key ? 'bg-white/20' : 'bg-[var(--color-canvas-sunk)]'}`}>
                {counts[key]}
              </span>
            </button>
          ))}
          {bucket && (
            <button
              onClick={() => setBucket(null)}
              className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-gold-tint)] px-3 py-1.5 text-[var(--color-gold)]"
            >
              {BUCKETS.find((b) => b.key === bucket)?.label} <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {filteredAr.length === 0 && (
        <div className="glass-card-light flex flex-col items-center gap-2 rounded-2xl px-6 py-16 text-center">
          <span className="text-4xl">📒</span>
          <p className="text-sm font-semibold">{receivables.length === 0 ? 'Belum ada piutang' : 'Tidak ada piutang yang cocok'}</p>
          <p className="text-xs text-[var(--color-ink-soft)]">
            {receivables.length === 0
              ? 'Bon tercatat otomatis saat transaksi POS memakai metode Bon / Kredit.'
              : 'Coba ubah kata kunci atau filter.'}
          </p>
        </div>
      )}

      {/* Tabel Piutang Pelanggan (layar lebar) */}
      {filteredAr.length > 0 && (
        <div className="glass-card-light hidden overflow-hidden rounded-2xl lg:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-canvas-sunk)] text-[var(--color-ink-soft)]">
                <tr>
                  <th className="px-4 py-3.5 font-semibold">No AR & Pelanggan</th>
                  <th className="px-4 py-3.5 font-semibold">Jatuh Tempo</th>
                  <th className="px-4 py-3.5 font-semibold">Total Bon</th>
                  <th className="px-4 py-3.5 font-semibold">Sisa Tagihan</th>
                  <th className="px-4 py-3.5 font-semibold">Status</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredAr.map((item) => {
                  const remaining = getArRemaining(item);
                  const overdue = getArStatus(item) === 'OVERDUE';
                  return (
                    <tr key={item.id} className="transition-colors hover:bg-[var(--color-canvas)]">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={item.customerName} overdue={overdue} />
                          <div>
                            <p className="font-bold">{item.customerName}</p>
                            <span className="font-mono text-[10px] text-[var(--color-ink-soft)]">
                              {item.id} • {item.phone}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium">{item.dueDate}</p>
                        {remaining > 0 && (
                          <p className={`text-[11px] font-semibold ${overdue ? 'text-[var(--color-rust)]' : 'text-[var(--color-ink-soft)]'}`}>{dueText(item)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-bold">{rp(item.totalAmount)}</td>
                      <td className="min-w-[150px] px-4 py-3.5">
                        <p className="font-black">{rp(remaining)}</p>
                        <PaidBar ar={item} />
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge ar={item} />
                      </td>
                      <td className="px-4 py-3.5 text-right">{actionsFor(item)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Kartu piutang (ponsel & tablet) */}
      {filteredAr.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
          {filteredAr.map((item) => {
            const remaining = getArRemaining(item);
            const overdue = getArStatus(item) === 'OVERDUE';
            return (
              <div key={item.id} className="glass-card-light flex flex-col gap-3 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={item.customerName} overdue={overdue} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{item.customerName}</p>
                    <p className="truncate font-mono text-[10px] text-[var(--color-ink-soft)]">
                      {item.id} • {item.phone}
                    </p>
                  </div>
                  <StatusBadge ar={item} />
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--color-canvas)] px-3 py-2.5 text-xs">
                  <div>
                    <p className="text-[var(--color-ink-soft)]">Sisa tagihan</p>
                    <p className="font-display text-base font-semibold">{rp(remaining)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[var(--color-ink-soft)]">Jatuh tempo</p>
                    <p className="font-semibold">{item.dueDate}</p>
                    {remaining > 0 && (
                      <p className={`text-[11px] font-semibold ${overdue ? 'text-[var(--color-rust)]' : 'text-[var(--color-ink-soft)]'}`}>{dueText(item)}</p>
                    )}
                  </div>
                </div>

                <div>
                  <PaidBar ar={item} />
                  <p className="text-[10px] text-[var(--color-ink-soft)]">Total bon {rp(item.totalAmount)}</p>
                </div>

                <div className="mt-auto pt-1">{actionsFor(item, true)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL PREVIEW WHATSAPP ALERT */}
      <AnimatePresence>
        {isWaModalOpen && selectedAr && (
          <Sheet onClose={() => setIsWaModalOpen(false)}>
            <div className="space-y-4 p-5 sm:p-6">
              <button
                aria-label="Tutup"
                onClick={() => setIsWaModalOpen(false)}
                className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas-sunk)]"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold">Kirim WhatsApp Alert</h3>
                  <p className="text-xs text-[var(--color-ink-soft)]">
                    {selectedAr.customerName} ({selectedAr.phone})
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3">
                <p className="mb-2 flex items-center justify-between text-[11px] font-bold text-emerald-800">
                  <span>[Pratinjau Pesan WA]</span>
                  <button
                    type="button"
                    onClick={() => setWaText(buildWaText(selectedAr, selectedRemaining))}
                    className="font-semibold underline-offset-2 hover:underline"
                  >
                    Kembalikan
                  </button>
                </p>
                <textarea
                  value={waText}
                  onChange={(e) => setWaText(e.target.value)}
                  rows={8}
                  className="w-full resize-none rounded-xl rounded-tl-sm border border-emerald-200 bg-white p-3 text-xs leading-relaxed focus:border-emerald-500 focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-emerald-800/70">Pesan bisa diedit sebelum dikirim.</p>
              </div>

              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <button
                  onClick={() => setIsWaModalOpen(false)}
                  className="rounded-xl border border-[var(--color-border)] py-2.5 text-xs font-bold text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-canvas-sunk)] sm:flex-1"
                >
                  Batal
                </button>
                <a
                  href={waLink(selectedAr.phone, waText)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white py-2.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 sm:flex-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Buka WhatsApp
                </a>
                <button
                  onClick={handleSendWa}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md transition-colors hover:bg-emerald-500 sm:flex-1"
                >
                  <Send className="h-3.5 w-3.5" /> Kirim Sekarang
                </button>
              </div>
            </div>
          </Sheet>
        )}
      </AnimatePresence>

      {/* MODAL BAYAR BON */}
      <AnimatePresence>
        {isPayModalOpen && selectedAr && (
          <Sheet onClose={() => setIsPayModalOpen(false)}>
            <div className="bg-[var(--color-pine)] px-5 pb-5 pt-5 text-white sm:px-6">
              <button
                aria-label="Tutup"
                onClick={() => setIsPayModalOpen(false)}
                className="absolute right-4 top-4 rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <h3 className="text-sm font-medium text-white/70">Pelunasan Piutang / Bon</h3>
              <p className="mt-0.5 text-sm font-semibold">
                {selectedAr.customerName} <span className="font-mono text-xs font-normal text-white/60">({selectedAr.id})</span>
              </p>
              <p className="font-display mt-2 text-3xl font-semibold">{rp(selectedRemaining)}</p>
              <p className="text-xs text-white/60">Sisa bon saat ini</p>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--color-ink-soft)]">Nominal Pembayaran (Rp)</label>
                <input
                  type="number"
                  value={payAmount || ''}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-canvas)] px-3 py-2.5 text-lg font-black focus:border-[var(--color-gold)] focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    [
                      ['Lunasi', selectedRemaining],
                      ['50%', Math.round(selectedRemaining / 2)],
                      ['25%', Math.round(selectedRemaining / 4)],
                    ] as const
                  ).map(([label, v]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setPayAmount(v)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                        payAmount === v
                          ? 'border-[var(--color-pine)] bg-[var(--color-pine-tint)] text-[var(--color-pine)]'
                          : 'border-[var(--color-border)] text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas-sunk)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div
                  className={`mt-3 flex items-center justify-between rounded-xl px-3 py-2 text-xs ${
                    payAmount > selectedRemaining
                      ? 'bg-[var(--color-rust-tint)] text-[var(--color-rust)]'
                      : afterPay === 0 && payAmount > 0
                      ? 'bg-[var(--color-pine-tint)] text-[var(--color-pine)]'
                      : 'bg-[var(--color-canvas-sunk)] text-[var(--color-ink-soft)]'
                  }`}
                >
                  <span>{payAmount > selectedRemaining ? 'Melebihi sisa bon' : afterPay === 0 && payAmount > 0 ? 'Bon akan lunas' : 'Sisa setelah bayar'}</span>
                  <strong>{rp(afterPay)}</strong>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--color-ink-soft)]">Diterima ke</label>
                <select
                  value={payAccountId}
                  onChange={(e) => setPayAccountId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-canvas)] px-3 py-2.5 text-xs focus:border-[var(--color-gold)] focus:outline-none"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <ErrorBox text={payError} />

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setIsPayModalOpen(false)}
                  className="flex-1 rounded-xl border border-[var(--color-border)] py-2.5 text-xs font-bold text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-canvas-sunk)]"
                >
                  Batal
                </button>
                <button
                  onClick={handleSavePayment}
                  className="flex-[1.4] rounded-xl bg-[var(--color-pine)] py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-[var(--color-pine-light)] active:scale-[0.98]"
                >
                  Proses Pembayaran
                </button>
              </div>
            </div>
          </Sheet>
        )}
      </AnimatePresence>

      {/* NOTIFIKASI BERHASIL */}
      <AnimatePresence>
        {isSuccessAlert && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-4 z-[60] flex max-w-sm items-start gap-3 rounded-xl bg-[var(--color-pine)] px-4 py-3 text-xs font-semibold text-white shadow-xl sm:right-6"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--color-gold-light)]" />
            <span>{alertMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}