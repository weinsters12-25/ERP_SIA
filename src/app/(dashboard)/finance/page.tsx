'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Wallet,
  Building,
  CheckCircle2,
  X,
  Receipt,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  ChevronLeft,
  ChevronRight,
  Banknote,
  Boxes,
  Lightbulb,
  ArrowRight,
  PiggyBank,
  ArrowLeftRight,
  FileText,
  FileDown,
  Printer,
  ClipboardList,
} from 'lucide-react';
import {
  useErpStore,
  useHydrated,
  toDateStr,
  getTotalStock,
  getArRemaining,
  getPoRemaining,
  type Journal,
  type JournalType,
} from '@/stores/useErpStore';
import { ErrorBox } from '@/components/ErpUi';
import ReportModal from '@/components/ReportModal';

/* =========================================================================
   KONSTANTA
   ========================================================================= */

type Period = 'today' | '7d' | 'month' | 'all';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Hari ini' },
  { id: '7d', label: '7 hari' },
  { id: 'month', label: 'Bulan ini' },
  { id: 'all', label: 'Semua' },
];

const TYPE_META: Record<JournalType, { label: string; cls: string }> = {
  SALES: { label: 'Penjualan', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  COGS: { label: 'HPP', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  EXPENSE: { label: 'Biaya', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  PURCHASE: { label: 'Pembelian', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  PAYABLE: { label: 'Bayar Utang', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  RECEIVABLE: { label: 'Terima Piutang', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  ADJUSTMENT: { label: 'Opname', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  CAPITAL: { label: 'Modal / Saldo', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  TRANSFER: { label: 'Transfer', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
};

const EXPENSE_CATEGORIES = [
  'Listrik & Air',
  'Gaji Pegawai',
  'Transport & Bensin',
  'Plastik & Kemasan',
  'Sewa',
  'Perawatan',
  'Lainnya',
];

const PAGE_SIZE = 15;

/** Identitas toko yang tampil di invoice. Ubah sesuai data toko Anda. */
const STORE = {
  name: 'TOSERBA',
  tagline: 'Nature Fresh · Toko Sembako',
  address: 'Alamat toko Anda di sini',
  phone: 'Telp/WA: 08xx-xxxx-xxxx',
};

/* =========================================================================
   HELPER
   ========================================================================= */

const rp = (n: number) => `${n < 0 ? '-' : ''}Rp ${Math.abs(Math.round(n)).toLocaleString('id-ID')}`;

const parseDate = (s: string) => new Date(`${s}T00:00:00`);
const addDays = (s: string, n: number) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
};
const journalDay = (j: Journal) => j.date.slice(0, 10);

interface Range {
  start: string | null;
  end: string | null;
}

function getRanges(period: Period): { current: Range; previous: Range | null } {
  const today = toDateStr(new Date());
  if (period === 'today') {
    const y = addDays(today, -1);
    return { current: { start: today, end: today }, previous: { start: y, end: y } };
  }
  if (period === '7d') {
    return {
      current: { start: addDays(today, -6), end: today },
      previous: { start: addDays(today, -13), end: addDays(today, -7) },
    };
  }
  if (period === 'month') {
    const now = new Date();
    const first = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
    const prevFirst = toDateStr(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const prevLast = toDateStr(new Date(now.getFullYear(), now.getMonth(), 0));
    return { current: { start: first, end: today }, previous: { start: prevFirst, end: prevLast } };
  }
  return { current: { start: null, end: null }, previous: null };
}

const inRange = (j: Journal, r: Range) => {
  if (!r.start || !r.end) return true;
  const d = journalDay(j);
  return d >= r.start && d <= r.end;
};

interface Summary {
  sales: number;
  salesCash: number;
  salesCredit: number;
  salesCount: number;
  cogs: number;
  grossProfit: number;
  expense: number;
  stockLoss: number; // selisih stok bersih (positif = rugi)
  netProfit: number;
  margin: number; // % laba bersih terhadap penjualan
}

function summarize(journals: Journal[]): Summary {
  let sales = 0;
  let salesCredit = 0;
  let salesCount = 0;
  let cogs = 0;
  let expense = 0;
  let stockLoss = 0;

  for (const j of journals) {
    if (j.type === 'SALES') {
      sales += j.amount;
      salesCount += 1;
      if (j.debitAccount.startsWith('104')) salesCredit += j.amount;
    } else if (j.type === 'COGS') {
      cogs += j.amount;
    } else if (j.type === 'EXPENSE') {
      expense += j.amount;
    } else if (j.type === 'ADJUSTMENT') {
      // Debit 502 = rugi selisih stok, kredit 502 = untung selisih stok
      stockLoss += j.debitAccount.startsWith('502') ? j.amount : -j.amount;
    }
  }

  const grossProfit = sales - cogs;
  const netProfit = grossProfit - expense - stockLoss;
  return {
    sales,
    salesCash: sales - salesCredit,
    salesCredit,
    salesCount,
    cogs,
    grossProfit,
    expense,
    stockLoss,
    netProfit,
    margin: sales > 0 ? (netProfit / sales) * 100 : 0,
  };
}

const pctChange = (cur: number, prev: number): number | null =>
  prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100;

function downloadCsv(rows: Journal[]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const header = ['No Jurnal', 'Tanggal', 'Tipe', 'Keterangan', 'Akun Debit', 'Akun Kredit', 'Nominal'];
  const lines = rows.map((j) =>
    [j.id, j.date, TYPE_META[j.type]?.label ?? j.type, j.description, j.debitAccount, j.creditAccount, j.amount]
      .map(esc)
      .join(',')
  );
  const blob = new Blob([`\uFEFF${[header.map(esc).join(','), ...lines].join('\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jurnal-${toDateStr(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* =========================================================================
   INVOICE (bertema struk TOSERBA)
   Dibuat sebagai dokumen HTML mandiri, dipakai untuk pratinjau (iframe),
   cetak / simpan PDF, dan unduh file HTML. Satu sumber, hasil selalu sama.
   ========================================================================= */

const escHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

interface InvoiceMeta {
  number: string;
  isSales: boolean;
  title: string;
  typeLabel: string;
  method: string | null;
  status: 'LUNAS' | 'BELUM LUNAS' | 'TERCATAT';
}

function getInvoiceMeta(j: Journal): InvoiceMeta {
  const isSales = j.type === 'SALES';
  const match = j.description.match(/INV-\d+/i);
  const isCredit = isSales && j.debitAccount.startsWith('104');

  let method: string | null = null;
  if (isSales) {
    if (isCredit) method = 'Bon / Piutang';
    else if (j.debitAccount.startsWith('101')) method = 'Tunai';
    else method = 'Transfer Bank';
  }

  return {
    number: match ? match[0].toUpperCase() : j.id,
    isSales,
    title: isSales ? 'INVOICE PENJUALAN' : 'BUKTI TRANSAKSI',
    typeLabel: TYPE_META[j.type]?.label ?? j.type,
    method,
    status: isSales ? (isCredit ? 'BELUM LUNAS' : 'LUNAS') : 'TERCATAT',
  };
}

function buildInvoiceHtml(j: Journal): string {
  const m = getInvoiceMeta(j);
  const printedAt = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

  const row = (label: string, value: string, cls = '') =>
    `<div class="row"><span>${escHtml(label)}</span><span class="${cls}">${escHtml(value)}</span></div>`;

  const metaRows = [
    row(m.isSales ? 'No. Invoice' : 'No. Bukti', m.number, 'mono'),
    row('Tanggal', j.date, 'mono'),
    row('No. Jurnal', j.id, 'mono'),
    m.isSales ? row('Pembayaran', m.method ?? '-', 'mono') : row('Jenis', m.typeLabel, 'mono'),
  ].join('');

  const statusClass = m.status === 'LUNAS' ? 'ok' : m.status === 'BELUM LUNAS' ? 'warn' : 'neutral';

  const footer = m.isSales
    ? `<div class="thanks">Terima kasih, Kak! 💚</div>
       <div class="gold">Belanja hemat, hidup sehat ✨</div>
       <div class="gold">Sampai jumpa lagi ya! 👋</div>
       <div class="note">Barang yang sudah dibeli tidak dapat ditukar</div>`
    : `<div class="thanks">Dokumen pencatatan 📒</div>
       <div class="gold">Dibuat otomatis oleh Toserba ERP</div>
       <div class="note">Bukti ini bersifat internal dan bukan faktur pajak</div>`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(m.isSales ? 'Invoice' : 'Bukti')} ${escHtml(m.number)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#17352b;padding:16px;display:flex;justify-content:center}
  .card{width:100%;max-width:360px;border:2px dashed #0b4a37;border-radius:24px;padding:22px 20px 18px;background:#fff}
  .center{text-align:center}
  .deco{font-size:20px;letter-spacing:10px}
  .brand{font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:30px;font-weight:800;letter-spacing:.12em;color:#0b4a37;margin-top:2px}
  .tag{font-size:12px;font-weight:700;font-style:italic;color:#b8860b;margin-top:2px}
  .addr{font-size:11px;color:#4b5f57;margin-top:5px;line-height:1.55}
  .pill{display:inline-block;margin-top:12px;background:#0b4a37;color:#fff;font-size:11px;font-weight:800;letter-spacing:.1em;padding:6px 18px;border-radius:999px}
  .dots{border-top:2px dotted #c9a227;margin:16px 0}
  .thin{border-top:1px solid #d9e4de;margin:12px 0}
  .mono{font-family:'Courier New',Courier,monospace}
  .row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:12px;padding:2.5px 0;color:#2b4a3f}
  .row .mono{color:#17352b;text-align:right;word-break:break-word}
  .item{display:flex;align-items:center;gap:8px;margin-top:2px}
  .qty{flex-shrink:0;font-size:11px;font-weight:800;color:#0b4a37;background:#fdf3d4;border:1.5px solid #c9a227;border-radius:999px;padding:2px 9px}
  .iname{font-size:13px;font-weight:800;color:#0b4a37;line-height:1.35}
  .sub{margin-top:3px;font-size:11px;color:#5c7168}
  .total{margin-top:16px;background:#e3efe8;border:2px solid #0b4a37;border-radius:16px;padding:14px 14px 12px}
  .tline{display:flex;justify-content:space-between;align-items:baseline}
  .tline .l{font-size:18px;font-weight:800;color:#0b4a37;letter-spacing:.02em}
  .tline .r{font-size:22px;font-weight:800;color:#0b4a37}
  .total .row{margin-top:3px}
  .status{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.06em;padding:3px 12px;border-radius:999px}
  .status.ok{background:#0b4a37;color:#fff}
  .status.warn{background:#fef3c7;color:#92400e;border:1.5px solid #f59e0b}
  .status.neutral{background:#e2e8f0;color:#334155}
  .acc{margin-top:14px;border:1px dashed #b8c9c0;border-radius:12px;padding:9px 12px;background:#f8fbf9}
  .acc .h{font-size:10px;font-weight:800;color:#5c7168;letter-spacing:.08em;margin-bottom:4px}
  .acc .row{font-size:11px;padding:1.5px 0}
  .thanks{font-family:'Playfair Display',Georgia,serif;font-size:19px;font-weight:700;color:#0b4a37;margin-top:2px}
  .gold{font-size:11.5px;font-weight:800;color:#b8860b;margin-top:3px}
  .note{font-size:10.5px;color:#6b7f76;margin-top:12px}
  .printed{font-size:10px;color:#93a39b;margin-top:5px}
  @page{margin:10mm}
  @media print{body{padding:0}.card{max-width:100%}}
</style>
</head>
<body>
  <div class="card">
    <div class="center">
      <div class="deco">🌿 🛒 🌿</div>
      <div class="brand">${escHtml(STORE.name)}</div>
      <div class="tag">${escHtml(STORE.tagline)}</div>
      <div class="addr">${escHtml(STORE.address)}<br>${escHtml(STORE.phone)}</div>
      <div class="pill">✨ ${escHtml(m.title)} ✨</div>
    </div>

    <div class="dots"></div>

    ${metaRows}

    <div class="thin"></div>

    <div class="item">
      <span class="qty">${m.isSales ? '1×' : escHtml(m.typeLabel)}</span>
      <span class="iname">${escHtml(j.description)}</span>
    </div>
    <div class="row sub mono"><span>${m.isSales ? '@ ' + escHtml(rp(j.amount)) : 'Nominal'}</span><span>${escHtml(rp(j.amount))}</span></div>

    <div class="total">
      <div class="tline"><span class="l">TOTAL</span><span class="r mono">${escHtml(rp(j.amount))}</span></div>
      ${m.isSales ? row('Metode', m.method ?? '-', 'mono') : ''}
      <div class="row"><span>Status</span><span><span class="status ${statusClass}">${m.status}</span></span></div>
    </div>

    <div class="acc">
      <div class="h">PENCATATAN JURNAL</div>
      ${row('Debit', j.debitAccount, 'mono')}
      ${row('Kredit', j.creditAccount, 'mono')}
    </div>

    <div class="dots"></div>

    <div class="center">
      ${footer}
      <div class="printed">Dicetak ${escHtml(printedAt)}</div>
    </div>
  </div>
</body>
</html>`;
}

function downloadInvoiceHtml(j: Journal) {
  const m = getInvoiceMeta(j);
  const blob = new Blob([buildInvoiceHtml(j)], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${m.isSales ? 'invoice' : 'bukti'}-${m.number}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function InvoiceModal({ journal, onClose }: { journal: Journal; onClose: () => void }) {
  const meta = getInvoiceMeta(journal);
  const html = useMemo(() => buildInvoiceHtml(journal), [journal]);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameHeight, setFrameHeight] = useState(640);

  const fitFrame = () => {
    const doc = frameRef.current?.contentDocument;
    if (doc) setFrameHeight(doc.documentElement.scrollHeight);
  };

  const handlePrint = () => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${meta.title} ${meta.number}`}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full shadow-xl space-y-4 relative"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>

        <div>
          <h3 className="text-base font-bold text-slate-800">{meta.isSales ? 'Invoice' : 'Bukti Transaksi'}</h3>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">{meta.number}</p>
        </div>

        <div className="max-h-[62vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50">
          <iframe
            ref={frameRef}
            title={`Pratinjau ${meta.title}`}
            srcDoc={html}
            onLoad={fitFrame}
            style={{ height: frameHeight }}
            className="w-full border-0 bg-white"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => downloadInvoiceHtml(journal)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors"
          >
            <FileDown className="h-3.5 w-3.5" />
            Unduh HTML
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-700 text-white font-bold rounded-xl text-xs hover:bg-emerald-600 shadow-md transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Unduh PDF / Cetak
          </button>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Untuk menyimpan sebagai PDF, pilih <b>Simpan sebagai PDF</b> pada pilihan printer di jendela cetak.
        </p>
      </motion.div>
    </motion.div>
  );
}

/* =========================================================================
   KOMPONEN KECIL
   ========================================================================= */

function Delta({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  if (value === null) return <span className="text-[11px] text-slate-400">Belum ada pembanding</span>;
  const up = value >= 0;
  const good = inverse ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${good ? 'text-emerald-600' : 'text-rose-600'}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(value).toFixed(1)}%
      <span className="font-medium text-slate-400 ml-1">vs periode lalu</span>
    </span>
  );
}

function StatCard({
  title,
  value,
  sub,
  icon,
  tone,
  delta,
  inverse,
  onClick,
  active,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone: string;
  delta: number | null;
  inverse?: boolean;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className={`group text-left w-full glass-card-light rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
        active ? 'ring-2 ring-emerald-500' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">{title}</span>
        <div className={`p-2 rounded-lg border ${tone}`}>{icon}</div>
      </div>
      <p className="text-2xl font-black text-slate-900 mt-3 tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
      <div className="mt-2 flex items-center justify-between gap-2">
        <Delta value={delta} inverse={inverse} />
        <span className="flex items-center text-[11px] font-bold text-slate-400 group-hover:text-emerald-700 transition-colors shrink-0">
          Lihat rumus
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

/** Input nominal dengan format rupiah (titik ribuan) otomatis saat mengetik. */
function RupiahInput({
  value,
  onChange,
  accent = 'emerald',
  autoFocus,
}: {
  value: number;
  onChange: (n: number) => void;
  accent?: 'emerald' | 'rose';
  autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
        Rp
      </span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="0"
        value={value > 0 ? value.toLocaleString('id-ID') : ''}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 13);
          onChange(digits ? Number(digits) : 0);
        }}
        className={`w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none ${
          accent === 'rose' ? 'focus:border-rose-500' : 'focus:border-emerald-500'
        }`}
      />
    </div>
  );
}

function PlRow({ label, value, bold, negative }: { label: string; value: number; bold?: boolean; negative?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${bold ? 'border-t border-slate-200 mt-1 pt-3' : ''}`}>
      <span className={`text-xs ${bold ? 'font-extrabold text-slate-800' : 'text-slate-600'}`}>{label}</span>
      <span
        className={`text-xs ${bold ? 'font-black text-sm' : 'font-semibold'} ${
          bold ? (value >= 0 ? 'text-emerald-700' : 'text-rose-700') : negative ? 'text-rose-600' : 'text-slate-800'
        }`}
      >
        {negative && value > 0 ? '- ' : ''}
        {rp(negative ? Math.abs(value) : value)}
      </span>
    </div>
  );
}

/* =========================================================================
   PANEL DETAIL KPI (rumus, rincian, simulasi)
   ========================================================================= */

type DetailKind = 'sales' | 'gross' | 'expense' | 'net';

interface Step {
  op?: '+' | '−' | '=';
  label: string;
  value: number;
  total?: boolean;
}
interface Bar {
  label: string;
  value: number;
  color: string;
}
interface DetailConfig {
  title: string;
  value: number;
  prevValue: number | null;
  inverse?: boolean;
  formula: string;
  expr: string;
  steps: Step[];
  extra: { name: string; expr: string; result: string }[];
  barTitle: string;
  bars: Bar[];
  barBase: number;
  insight: string;
  types: JournalType[];
  simulate: 'none' | 'cost' | 'both';
}

const pct = (n: number) => `${n.toFixed(1).replace('.', ',')}%`;

function buildConfig(kind: DetailKind, s: Summary, prev: Summary | null, breakdown: { name: string; amount: number }[]): DetailConfig {
  const opex = s.expense + s.stockLoss;
  const prevOpex = prev ? prev.expense + prev.stockLoss : null;
  const share = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

  if (kind === 'sales') {
    const bonShare = share(s.salesCredit, s.sales);
    return {
      title: 'Total Penjualan',
      value: s.sales,
      prevValue: prev ? prev.sales : null,
      formula: 'Total Penjualan = Penjualan Tunai + Penjualan Bon',
      expr: `${rp(s.salesCash)} + ${rp(s.salesCredit)} = ${rp(s.sales)}`,
      steps: [
        { label: 'Penjualan tunai (debit 101 Kas Kasir POS)', value: s.salesCash },
        { op: '+', label: 'Penjualan bon/kredit (debit 104 Piutang)', value: s.salesCredit },
        { op: '=', label: 'Total penjualan', value: s.sales, total: true },
      ],
      extra: [
        {
          name: 'Rata-rata per transaksi',
          expr: `${rp(s.sales)} ÷ ${s.salesCount} transaksi`,
          result: rp(s.salesCount > 0 ? s.sales / s.salesCount : 0),
        },
      ],
      barTitle: 'Komposisi penjualan',
      bars: [
        { label: 'Tunai', value: s.salesCash, color: 'bg-emerald-500' },
        { label: 'Bon / kredit', value: s.salesCredit, color: 'bg-amber-500' },
      ],
      barBase: s.sales,
      insight:
        s.salesCount === 0
          ? 'Belum ada penjualan pada periode ini.'
          : s.salesCredit > 0
          ? `${pct(bonShare)} penjualan masih berupa bon. Uangnya belum masuk kas, jadi pantau di menu Piutang.`
          : 'Seluruh penjualan periode ini dibayar tunai, tidak ada bon yang perlu ditagih.',
      types: ['SALES'],
      simulate: 'none',
    };
  }

  if (kind === 'gross') {
    const gm = share(s.grossProfit, s.sales);
    return {
      title: 'Laba Kotor',
      value: s.grossProfit,
      prevValue: prev ? prev.grossProfit : null,
      formula: 'Laba Kotor = Total Penjualan − HPP',
      expr: `${rp(s.sales)} − ${rp(s.cogs)} = ${rp(s.grossProfit)}`,
      steps: [
        { label: 'Total penjualan', value: s.sales },
        { op: '−', label: 'HPP (harga modal barang yang terjual)', value: s.cogs },
        { op: '=', label: 'Laba kotor', value: s.grossProfit, total: true },
      ],
      extra: [
        {
          name: 'Margin kotor',
          expr: `${rp(s.grossProfit)} ÷ ${rp(s.sales)} × 100%`,
          result: pct(gm),
        },
      ],
      barTitle: 'Dari setiap Rp 100 penjualan',
      bars: [
        { label: 'HPP (modal barang)', value: s.cogs, color: 'bg-amber-500' },
        { label: 'Laba kotor', value: Math.max(0, s.grossProfit), color: 'bg-sky-500' },
      ],
      barBase: s.sales,
      insight:
        s.sales === 0
          ? 'Belum ada penjualan pada periode ini.'
          : s.cogs === 0
          ? 'HPP bernilai 0. Pastikan harga modal (cost) produk sudah diisi, kalau tidak laba kotor terlihat lebih besar dari kenyataan.'
          : `Dari tiap Rp 100 penjualan, sekitar Rp ${(100 - gm).toFixed(0)} dipakai untuk modal barang dan Rp ${gm.toFixed(0)} menjadi laba kotor.`,
      types: ['COGS'],
      simulate: 'none',
    };
  }

  if (kind === 'expense') {
    const bars: Bar[] = breakdown.map((b) => ({ label: b.name, value: b.amount, color: 'bg-rose-500' }));
    if (s.stockLoss !== 0) bars.push({ label: 'Selisih stok (opname)', value: Math.abs(s.stockLoss), color: 'bg-slate-500' });
    return {
      title: 'Biaya Operasional',
      value: opex,
      prevValue: prevOpex,
      inverse: true,
      formula: 'Biaya Operasional = Beban Operasional + Selisih Stok (opname)',
      expr: `${rp(s.expense)} + ${rp(s.stockLoss)} = ${rp(opex)}`,
      steps: [
        { label: 'Beban operasional (jurnal Biaya, debit 501)', value: s.expense },
        { op: '+', label: 'Selisih stok (debit 502, rugi opname)', value: s.stockLoss },
        { op: '=', label: 'Total biaya operasional', value: opex, total: true },
      ],
      extra: [
        {
          name: 'Rasio biaya terhadap penjualan',
          expr: `${rp(opex)} ÷ ${rp(s.sales)} × 100%`,
          result: s.sales > 0 ? pct(share(opex, s.sales)) : '-',
        },
      ],
      barTitle: 'Rincian biaya',
      bars,
      barBase: Math.max(1, bars.reduce((a, b) => a + b.value, 0)),
      insight:
        opex === 0
          ? 'Belum ada biaya yang dicatat pada periode ini.'
          : opex > s.grossProfit
          ? `Biaya (${rp(opex)}) lebih besar dari laba kotor (${rp(s.grossProfit)}). Inilah yang membuat keuntungan bersih negatif.`
          : `Biaya masih tertutup laba kotor. Sisa laba kotor setelah biaya: ${rp(s.grossProfit - opex)}.`,
      types: ['EXPENSE', 'ADJUSTMENT'],
      simulate: 'cost',
    };
  }

  // net
  const gm = s.sales > 0 ? s.grossProfit / s.sales : 0;
  let insight: string;
  if (s.sales === 0) insight = 'Belum ada penjualan pada periode ini, jadi laba belum bisa dihitung.';
  else if (s.netProfit >= 0)
    insight = `Bisnis untung ${rp(s.netProfit)}. Dari tiap Rp 100 penjualan, Rp ${s.margin.toFixed(1).replace('.', ',')} menjadi laba bersih.`;
  else {
    const need = gm > 0 ? -s.netProfit / gm : null;
    insight =
      `Rugi karena biaya (${rp(opex)}) lebih besar dari laba kotor (${rp(s.grossProfit)}). ` +
      (need
        ? `Untuk impas dibutuhkan tambahan penjualan sekitar ${rp(need)} (dengan margin kotor ${pct(gm * 100)}), atau biaya turun ${rp(-s.netProfit)}.`
        : 'Margin kotor 0, penjualan tambahan tidak menutup biaya. Periksa harga jual dan harga modal.');
  }
  return {
    title: 'Keuntungan Bersih',
    value: s.netProfit,
    prevValue: prev ? prev.netProfit : null,
    formula: 'Keuntungan Bersih = Penjualan − HPP − Biaya Operasional − Selisih Stok',
    expr: `${rp(s.sales)} − ${rp(s.cogs)} − ${rp(s.expense)} − ${rp(s.stockLoss)} = ${rp(s.netProfit)}`,
    steps: [
      { label: 'Total penjualan', value: s.sales },
      { op: '−', label: 'HPP', value: s.cogs },
      { op: '=', label: 'Laba kotor', value: s.grossProfit, total: true },
      { op: '−', label: 'Beban operasional', value: s.expense },
      { op: '−', label: 'Selisih stok (opname)', value: s.stockLoss },
      { op: '=', label: 'Keuntungan bersih', value: s.netProfit, total: true },
    ],
    extra: [
      {
        name: 'Margin bersih',
        expr: `${rp(s.netProfit)} ÷ ${rp(s.sales)} × 100%`,
        result: s.sales > 0 ? pct(s.margin) : '-',
      },
    ],
    barTitle: 'Ke mana uang penjualan pergi',
    bars: [
      { label: 'HPP', value: s.cogs, color: 'bg-amber-500' },
      { label: 'Beban operasional', value: s.expense, color: 'bg-rose-500' },
      { label: 'Selisih stok', value: Math.max(0, s.stockLoss), color: 'bg-slate-500' },
      { label: 'Laba bersih', value: Math.max(0, s.netProfit), color: 'bg-emerald-500' },
    ],
    barBase: s.sales,
    insight,
    types: ['SALES', 'COGS', 'EXPENSE', 'ADJUSTMENT'],
    simulate: 'both',
  };
}

function DetailDrawer({
  kind,
  summary,
  prev,
  periodLabel,
  journals,
  expenseBreakdown,
  onClose,
  onShowJournals,
}: {
  kind: DetailKind;
  summary: Summary;
  prev: Summary | null;
  periodLabel: string;
  journals: Journal[];
  expenseBreakdown: { name: string; amount: number }[];
  onClose: () => void;
  onShowJournals: (t: JournalType | 'ALL') => void;
}) {
  const [tab, setTab] = useState<'rumus' | 'transaksi' | 'simulasi'>('rumus');
  const [salesUp, setSalesUp] = useState(0);
  const [costDown, setCostDown] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cfg = buildConfig(kind, summary, prev, expenseBreakdown);
  const related = journals.filter((j) => cfg.types.includes(j.type));
  const shown = related.slice(0, 30);

  // Simulasi
  const opex = summary.expense + summary.stockLoss;
  const gm = summary.sales > 0 ? summary.grossProfit / summary.sales : 0;
  const simSales = summary.sales * (1 + salesUp / 100);
  const simGross = simSales * gm;
  const simOpex = opex * (1 - costDown / 100);
  const simNet = simGross - simOpex;

  const tabs: { id: typeof tab; label: string }[] = [
    { id: 'rumus', label: 'Rumus & hitungan' },
    { id: 'transaksi', label: `Transaksi (${related.length})` },
    ...(cfg.simulate !== 'none' ? [{ id: 'simulasi' as const, label: 'Simulasi' }] : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detail ${cfg.title}`}
    >
      <motion.aside
        initial={{ x: 48, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 48, opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-lg bg-white shadow-2xl overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                {cfg.title} · {periodLabel}
              </p>
              <p className={`text-3xl font-black tracking-tight mt-1 ${cfg.value < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                {rp(cfg.value)}
              </p>
              <div className="mt-1">
                <Delta value={cfg.prevValue === null ? null : pctChange(cfg.value, cfg.prevValue)} inverse={cfg.inverse} />
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors ${
                  tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* TAB RUMUS */}
          {tab === 'rumus' && (
            <>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Rumus</p>
                <p className="rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-emerald-300 leading-relaxed">
                  {cfg.formula}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Hitungan dengan angka Anda</p>
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {cfg.steps.map((st, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between gap-3 px-4 py-2.5 text-xs ${
                        st.total ? 'bg-slate-50 font-extrabold text-slate-900' : 'text-slate-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-4 text-center font-black text-slate-400">{st.op ?? ''}</span>
                        {st.label}
                      </span>
                      <span className="font-bold whitespace-nowrap">{rp(st.value)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-slate-500 break-words">{cfg.expr}</p>
              </div>

              {cfg.extra.map((ex) => (
                <div key={ex.name} className="rounded-xl border border-slate-200 p-4">
                  <p className="text-[11px] font-semibold text-slate-500">{ex.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{ex.expr}</p>
                  <p className="text-lg font-black text-slate-900 mt-1">{ex.result}</p>
                </div>
              ))}

              <div>
                <p className="text-[11px] font-semibold text-slate-500 mb-2">{cfg.barTitle}</p>
                {cfg.bars.every((b) => b.value === 0) ? (
                  <p className="text-xs text-slate-400">Belum ada data untuk ditampilkan.</p>
                ) : (
                  <div className="space-y-2.5">
                    {cfg.bars
                      .filter((b) => b.value > 0)
                      .map((b) => {
                        const p = cfg.barBase > 0 ? (b.value / cfg.barBase) * 100 : 0;
                        return (
                          <div key={b.label} title={`${b.label}: ${rp(b.value)}`}>
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-700">{b.label}</span>
                              <span className="font-bold text-slate-900">
                                {rp(b.value)} <span className="font-medium text-slate-400">({pct(p)})</span>
                              </span>
                            </div>
                            <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, p)}%` }}
                                transition={{ duration: 0.5 }}
                                className={`h-full rounded-full ${b.color}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <Lightbulb className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900 leading-relaxed">{cfg.insight}</p>
              </div>
            </>
          )}

          {/* TAB TRANSAKSI */}
          {tab === 'transaksi' && (
            <>
              <p className="text-[11px] text-slate-500">
                Jurnal yang membentuk angka ini pada periode {periodLabel}. Klik baris untuk melihat akun debit dan kredit.
              </p>
              {shown.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-400">Belum ada transaksi pada periode ini.</p>
              ) : (
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {shown.map((j) => {
                    const open = openId === j.id;
                    const meta = TYPE_META[j.type];
                    return (
                      <div key={j.id}>
                        <button
                          onClick={() => setOpenId(open ? null : j.id)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{j.description}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {j.id} · {j.date}
                              {meta && <span className={`ml-2 px-1.5 py-0.5 rounded-full border font-bold ${meta.cls}`}>{meta.label}</span>}
                            </p>
                          </div>
                          <span className="text-xs font-black text-slate-900 whitespace-nowrap">{rp(j.amount)}</span>
                        </button>
                        <AnimatePresence initial={false}>
                          {open && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-3 text-[11px] space-y-1">
                                <p>
                                  <span className="text-slate-400">Debit: </span>
                                  <span className="font-semibold text-emerald-700">{j.debitAccount}</span>
                                </p>
                                <p>
                                  <span className="text-slate-400">Kredit: </span>
                                  <span className="font-semibold text-rose-700">{j.creditAccount}</span>
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
              {related.length > shown.length && (
                <p className="text-[11px] text-slate-400">Menampilkan {shown.length} dari {related.length} jurnal terbaru.</p>
              )}
              <button
                onClick={() => onShowJournals(cfg.types.length === 1 ? cfg.types[0] : 'ALL')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
              >
                Lihat di tabel jurnal
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          {/* TAB SIMULASI */}
          {tab === 'simulasi' && (
            <>
              <p className="text-[11px] text-slate-500">
                Geser untuk melihat perkiraan hasilnya. Ini hanya simulasi dan tidak mengubah data.
                {cfg.simulate === 'both' && ' Margin kotor dianggap tetap.'}
              </p>

              {cfg.simulate === 'both' && (
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="sim-sales" className="font-semibold text-slate-700">Penjualan naik</label>
                    <span className="font-black text-emerald-700">{salesUp}%</span>
                  </div>
                  <input
                    id="sim-sales"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={salesUp}
                    onChange={(e) => setSalesUp(Number(e.target.value))}
                    className="mt-2 w-full accent-emerald-600"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="sim-cost" className="font-semibold text-slate-700">Biaya operasional turun</label>
                  <span className="font-black text-rose-700">{costDown}%</span>
                </div>
                <input
                  id="sim-cost"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={costDown}
                  onChange={(e) => setCostDown(Number(e.target.value))}
                  className="mt-2 w-full accent-rose-600"
                />
              </div>

              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
                {cfg.simulate === 'both' ? (
                  <>
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-slate-600">Penjualan</span>
                      <span className="font-bold">{rp(summary.sales)} → {rp(simSales)}</span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-slate-600">Laba kotor</span>
                      <span className="font-bold">{rp(summary.grossProfit)} → {rp(simGross)}</span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-slate-600">Biaya operasional</span>
                      <span className="font-bold">{rp(opex)} → {rp(simOpex)}</span>
                    </div>
                    <div className="flex justify-between px-4 py-3 bg-slate-50">
                      <span className="font-extrabold text-slate-900">Keuntungan bersih</span>
                      <span className={`font-black ${simNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {rp(summary.netProfit)} → {rp(simNet)}
                      </span>
                    </div>
                    <p className="px-4 py-2.5 text-[11px] text-slate-500">
                      {rp(simGross)} − {rp(simOpex)} = {rp(simNet)}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-slate-600">Biaya operasional</span>
                      <span className="font-bold">{rp(opex)} → {rp(simOpex)}</span>
                    </div>
                    <div className="flex justify-between px-4 py-3 bg-slate-50">
                      <span className="font-extrabold text-slate-900">Penghematan</span>
                      <span className="font-black text-emerald-700">{rp(opex - simOpex)}</span>
                    </div>
                    <p className="px-4 py-2.5 text-[11px] text-slate-500">
                      {rp(opex)} × {costDown}% = {rp(opex - simOpex)}
                    </p>
                  </>
                )}
              </div>

              <button
                onClick={() => {
                  setSalesUp(0);
                  setCostDown(0);
                }}
                className="w-full rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Atur ulang
              </button>
            </>
          )}
        </div>
      </motion.aside>
    </motion.div>
  );
}

/* =========================================================================
   HALAMAN
   ========================================================================= */

export default function FinancePage() {
  const hydrated = useHydrated();
  const accounts = useErpStore((s) => s.accounts);
  const journals = useErpStore((s) => s.journals);
  const products = useErpStore((s) => s.products);
  const receivables = useErpStore((s) => s.receivables);
  const purchaseOrders = useErpStore((s) => s.purchaseOrders);
  const addExpense = useErpStore((s) => s.addExpense);
  const adjustCapital = useErpStore((s) => s.adjustCapital);
  const transferFunds = useErpStore((s) => s.transferFunds);

  const [period, setPeriod] = useState<Period>('month');
  const [typeFilter, setTypeFilter] = useState<JournalType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detailKind, setDetailKind] = useState<DetailKind | null>(null);

  // Invoice / bukti transaksi yang sedang dibuka
  const [invoiceJournal, setInvoiceJournal] = useState<Journal | null>(null);

  // Laporan keuangan lengkap (harian / bulanan / tahunan)
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Kelola saldo (setoran / transfer / tarik)
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [fundMode, setFundMode] = useState<'DEPOSIT' | 'TRANSFER' | 'WITHDRAW'>('DEPOSIT');
  const [fundAccount, setFundAccount] = useState('103');
  const [fundTo, setFundTo] = useState('102');
  const [fundAmount, setFundAmount] = useState<number>(0);
  const [fundNote, setFundNote] = useState('');
  const [fundError, setFundError] = useState('');

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseCategory, setExpenseCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [selectedSourceAccount, setSelectedSourceAccount] = useState('102');
  const [error, setError] = useState('');
  const [isSuccessAlert, setIsSuccessAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // Esc menutup modal yang sedang terbuka
  useEffect(() => {
    if (!isFundModalOpen && !isExpenseModalOpen && !invoiceJournal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFundModalOpen(false);
        setIsExpenseModalOpen(false);
        setInvoiceJournal(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFundModalOpen, isExpenseModalOpen, invoiceJournal]);

  /* ---------- Data turunan ---------- */

  const { current, previous } = useMemo(() => getRanges(period), [period]);

  const periodJournals = useMemo(() => journals.filter((j) => inRange(j, current)), [journals, current]);
  const summary = useMemo(() => summarize(periodJournals), [periodJournals]);
  const prevSummary = useMemo(
    () => (previous ? summarize(journals.filter((j) => inRange(j, previous))) : null),
    [journals, previous]
  );

  // Tren 14 hari terakhir (tidak terpengaruh filter periode)
  const trend = useMemo(() => {
    const today = toDateStr(new Date());
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
    const byDay = new Map<string, Journal[]>();
    for (const j of journals) {
      const d = journalDay(j);
      if (d >= days[0]) byDay.set(d, [...(byDay.get(d) ?? []), j]);
    }
    return days.map((d) => {
      const s = summarize(byDay.get(d) ?? []);
      return { day: d, sales: s.sales, profit: s.netProfit };
    });
  }, [journals]);

  const trendMax = Math.max(1, ...trend.map((t) => Math.max(t.sales, Math.abs(t.profit))));

  // Rincian biaya per kategori (periode terpilih)
  const expenseBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const j of periodJournals) {
      if (j.type !== 'EXPENSE') continue;
      const idx = j.description.indexOf(': ');
      const prefix = idx > 0 ? j.description.slice(0, idx) : '';
      const cat = EXPENSE_CATEGORIES.includes(prefix) ? prefix : 'Lainnya';
      map.set(cat, (map.get(cat) ?? 0) + j.amount);
    }
    return [...map.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  }, [periodJournals]);

  // Posisi keuangan saat ini
  const position = useMemo(() => {
    const cash = accounts.filter((a) => a.type === 'CASH').reduce((s, a) => s + a.balance, 0);
    const bank = accounts.filter((a) => a.type === 'BANK').reduce((s, a) => s + a.balance, 0);
    const ar = receivables.reduce((s, r) => s + getArRemaining(r), 0);
    const ap = purchaseOrders.reduce((s, o) => s + getPoRemaining(o), 0);
    const inventory = products.reduce((s, p) => s + getTotalStock(p) * p.cost, 0);
    return { cash, bank, ar, ap, inventory, net: cash + bank + ar + inventory - ap };
  }, [accounts, receivables, purchaseOrders, products]);

  // Jurnal untuk tabel
  const filteredJournals = useMemo(() => {
    const q = search.toLowerCase();
    return periodJournals.filter(
      (j) =>
        (typeFilter === 'ALL' || j.type === typeFilter) &&
        (j.description.toLowerCase().includes(q) ||
          j.id.toLowerCase().includes(q) ||
          j.debitAccount.toLowerCase().includes(q) ||
          j.creditAccount.toLowerCase().includes(q))
    );
  }, [periodJournals, typeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredJournals.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedJournals = filteredJournals.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalDebit = filteredJournals.reduce((s, j) => s + j.amount, 0);
  const totalCredit = filteredJournals.reduce((s, j) => s + j.amount, 0);
  const isBalanced = totalDebit === totalCredit;

  const selectedAccount = accounts.find((a) => a.id === selectedSourceAccount);
  const lowCashWarning = selectedAccount && expenseAmount > 0 && expenseAmount > selectedAccount.balance;

  /* ---------- Aksi ---------- */

  const openModal = () => {
    setError('');
    setExpenseTitle('');
    setExpenseCategory(EXPENSE_CATEGORIES[0]);
    setExpenseAmount(0);
    setIsExpenseModalOpen(true);
  };

  const handleSaveExpense = () => {
    const title = expenseTitle.trim();
    const fullTitle = title && expenseCategory !== 'Lainnya' ? `${expenseCategory}: ${title}` : title;
    const res = addExpense(fullTitle, expenseAmount, selectedSourceAccount);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setIsExpenseModalOpen(false);
    setAlertMessage(res.message);
    setIsSuccessAlert(true);
    setTimeout(() => setIsSuccessAlert(false), 2500);
  };

  const openFundModal = (mode: 'DEPOSIT' | 'TRANSFER' | 'WITHDRAW', accountId?: string) => {
    const from = accountId ?? (mode === 'DEPOSIT' ? '103' : '101');
    setFundMode(mode);
    setFundAccount(from);
    setFundTo(accounts.find((a) => a.id !== from)?.id ?? '');
    setFundAmount(0);
    setFundNote('');
    setFundError('');
    setIsFundModalOpen(true);
  };

  const handleSaveFund = () => {
    const res =
      fundMode === 'TRANSFER'
        ? transferFunds(fundAccount, fundTo, fundAmount, fundNote)
        : adjustCapital(fundMode, fundAccount, fundAmount, fundNote);
    if (!res.ok) {
      setFundError(res.error);
      return;
    }
    setIsFundModalOpen(false);
    setAlertMessage(res.message);
    setIsSuccessAlert(true);
    setTimeout(() => setIsSuccessAlert(false), 2500);
  };

  if (!hydrated) return <p className="text-sm text-slate-500">Memuat data keuangan…</p>;

  const salesDelta = prevSummary ? pctChange(summary.sales, prevSummary.sales) : null;
  const grossDelta = prevSummary ? pctChange(summary.grossProfit, prevSummary.grossProfit) : null;
  const opexNow = summary.expense + summary.stockLoss;
  const opexDelta = prevSummary ? pctChange(opexNow, prevSummary.expense + prevSummary.stockLoss) : null;
  const netDelta = prevSummary ? pctChange(summary.netProfit, prevSummary.netProfit) : null;
  const periodLabel = PERIODS.find((p) => p.id === period)?.label.toLowerCase();

  return (
    <div className="space-y-6 relative z-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Manajemen Keuangan & Jurnal Otomatis</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ringkasan penjualan, laba bersih, saldo kas/bank, dan buku besar double-entry
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPeriod(p.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  period === p.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsReportOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-md transition-all"
          >
            <ClipboardList className="h-4 w-4" />
            <span>Laporan Lengkap</span>
          </button>
          <button
            onClick={() => openFundModal('DEPOSIT')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs shadow-sm transition-all"
          >
            <PiggyBank className="h-4 w-4" />
            <span>Kelola Saldo</span>
          </button>
          <button
            onClick={openModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-md transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Catat Biaya Operasional</span>
          </button>
        </div>
      </div>

      {/* KPI utama (klik untuk melihat rumus & rincian) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          title="Total Penjualan"
          value={rp(summary.sales)}
          sub={`${summary.salesCount} transaksi · Tunai ${rp(summary.salesCash)} · Bon ${rp(summary.salesCredit)}`}
          icon={<ShoppingCart className="h-4 w-4" />}
          tone="bg-emerald-50 text-emerald-600 border-emerald-100"
          delta={salesDelta}
          onClick={() => setDetailKind('sales')}
          active={detailKind === 'sales'}
        />
        <StatCard
          title="Laba Kotor"
          value={rp(summary.grossProfit)}
          sub={`Penjualan dikurangi HPP ${rp(summary.cogs)}`}
          icon={<Banknote className="h-4 w-4" />}
          tone="bg-sky-50 text-sky-600 border-sky-100"
          delta={grossDelta}
          onClick={() => setDetailKind('gross')}
          active={detailKind === 'gross'}
        />
        <StatCard
          title="Biaya Operasional"
          value={rp(opexNow)}
          sub={summary.stockLoss !== 0 ? `Termasuk selisih stok ${rp(summary.stockLoss)}` : 'Listrik, gaji, transport, dll.'}
          icon={<TrendingDown className="h-4 w-4" />}
          tone="bg-rose-50 text-rose-600 border-rose-100"
          delta={opexDelta}
          inverse
          onClick={() => setDetailKind('expense')}
          active={detailKind === 'expense'}
        />
        <StatCard
          title="Keuntungan Bersih"
          value={rp(summary.netProfit)}
          sub={`Margin bersih ${summary.margin.toFixed(1)}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          tone={
            summary.netProfit >= 0
              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
              : 'bg-rose-50 text-rose-600 border-rose-100'
          }
          delta={netDelta}
          onClick={() => setDetailKind('net')}
          active={detailKind === 'net'}
        />
      </div>

      {/* Tren + Laba Rugi */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="glass-card-light rounded-2xl p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Tren 14 Hari Terakhir</h2>
              <p className="text-[11px] text-slate-500">Penjualan dan keuntungan bersih per hari</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Penjualan
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" /> Laba bersih
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-end gap-1.5 h-44">
            {trend.map((t) => (
              <div
                key={t.day}
                className="flex-1 h-full flex flex-col justify-end group"
                title={`${t.day}\nPenjualan: ${rp(t.sales)}\nLaba bersih: ${rp(t.profit)}`}
              >
                <div className="flex items-end justify-center gap-0.5 h-full">
                  <div
                    className="w-1/2 max-w-3 rounded-t bg-emerald-500/90 group-hover:bg-emerald-500 transition-colors"
                    style={{ height: `${(t.sales / trendMax) * 100}%`, minHeight: t.sales > 0 ? 2 : 0 }}
                  />
                  <div
                    className={`w-1/2 max-w-3 rounded-t transition-colors ${
                      t.profit >= 0 ? 'bg-indigo-500/90 group-hover:bg-indigo-500' : 'bg-rose-500/90 group-hover:bg-rose-500'
                    }`}
                    style={{ height: `${(Math.abs(t.profit) / trendMax) * 100}%`, minHeight: t.profit !== 0 ? 2 : 0 }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            {trend.map((t) => (
              <span key={t.day} className="flex-1 text-center text-[9px] text-slate-400">
                {t.day.slice(8)}
              </span>
            ))}
          </div>
        </div>

        <div className="glass-card-light rounded-2xl p-5">
          <h2 className="text-sm font-bold text-slate-800">Laporan Laba Rugi</h2>
          <p className="text-[11px] text-slate-500 mb-3">Periode: {periodLabel}</p>
          <PlRow label="Penjualan" value={summary.sales} />
          <PlRow label="HPP" value={summary.cogs} negative />
          <PlRow label="Laba kotor" value={summary.grossProfit} />
          <PlRow label="Biaya operasional" value={summary.expense} negative />
          <PlRow label="Selisih stok (opname)" value={summary.stockLoss} negative />
          <PlRow label="Keuntungan bersih" value={summary.netProfit} bold />
        </div>
      </div>

      {accounts.every((a) => a.balance === 0) && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <PiggyBank className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <p className="font-bold">Saldo kas dan bank masih Rp 0.</p>
            <p>
              Isi saldo awal lewat tombol <b>Kelola Saldo</b> atau <b>+ Saldo</b> pada kartu akun, supaya biaya dan
              pembayaran bisa dicatat.
            </p>
          </div>
        </div>
      )}

      {/* Posisi keuangan + Rincian biaya */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {accounts.map((acc) => (
              <div key={acc.id} className="glass-card-light rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 font-mono">{acc.id}</span>
                  {acc.type === 'CASH' ? (
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                      <Wallet className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                      <Building className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-bold text-slate-700 mt-3">{acc.name}</p>
                <p className="text-xl font-black text-slate-900 mt-1">{rp(acc.balance)}</p>
                <div className="mt-3 flex gap-1.5">
                  <button
                    onClick={() => openFundModal('DEPOSIT', acc.id)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                  >
                    + Saldo
                  </button>
                  <button
                    onClick={() => openFundModal('TRANSFER', acc.id)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Transfer
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="glass-card-light rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-800">Posisi Keuangan Saat Ini</h2>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
              <div>
                <p className="text-slate-500">Kas + Bank</p>
                <p className="font-black text-slate-900 mt-0.5">{rp(position.cash + position.bank)}</p>
              </div>
              <div>
                <p className="text-slate-500">Piutang (belum ditagih)</p>
                <p className="font-black text-emerald-700 mt-0.5">{rp(position.ar)}</p>
              </div>
              <div>
                <p className="text-slate-500">Nilai persediaan</p>
                <p className="font-black text-slate-900 mt-0.5">{rp(position.inventory)}</p>
              </div>
              <div>
                <p className="text-slate-500">Utang ke supplier</p>
                <p className="font-black text-rose-700 mt-0.5">{rp(position.ap)}</p>
              </div>
              <div>
                <p className="text-slate-500">Kekayaan bersih</p>
                <p className={`font-black mt-0.5 ${position.net >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
                  {rp(position.net)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card-light rounded-2xl p-5">
          <h2 className="text-sm font-bold text-slate-800">Rincian Biaya per Kategori</h2>
          <p className="text-[11px] text-slate-500 mb-3">Periode: {periodLabel}</p>
          {expenseBreakdown.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Belum ada biaya pada periode ini.</p>
          ) : (
            <div className="space-y-3">
              {expenseBreakdown.map((e) => {
                const total = expenseBreakdown.reduce((s, x) => s + x.amount, 0);
                const pct = total > 0 ? (e.amount / total) * 100 : 0;
                return (
                  <div key={e.name}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{e.name}</span>
                      <span className="font-bold text-slate-900">
                        {rp(e.amount)} <span className="text-slate-400 font-medium">({pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-rose-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Filter jurnal */}
      <div id="tabel-jurnal" className="glass-card-light rounded-2xl overflow-hidden shadow-xs scroll-mt-4">
      <div className="p-4 space-y-3 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari No Jurnal, Keterangan, Akun..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                isBalanced
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-rose-700 bg-rose-50 border-rose-200'
              }`}
            >
              {isBalanced ? 'Debit = Kredit (Seimbang)' : 'Debit ≠ Kredit, periksa jurnal'}
            </span>
            <button
              onClick={() => downloadCsv(filteredJournals)}
              disabled={filteredJournals.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5" />
              Ekspor CSV
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(['ALL', ...Object.keys(TYPE_META)] as (JournalType | 'ALL')[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTypeFilter(t);
                setPage(1);
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                typeFilter === t
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {t === 'ALL' ? 'Semua' : TYPE_META[t].label}
            </button>
          ))}
        </div>
      </div>

        {/* Tabel jurnal */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">No Jurnal & Waktu</th>
                <th className="py-3.5 px-4">Keterangan Transaksi</th>
                <th className="py-3.5 px-4">Akun Debit</th>
                <th className="py-3.5 px-4">Akun Kredit</th>
                <th className="py-3.5 px-4 text-right">Nominal</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedJournals.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-400">
                    {journals.length === 0
                      ? 'Belum ada jurnal. Jurnal terbentuk otomatis dari transaksi POS, PO, dan biaya operasional.'
                      : 'Tidak ada jurnal yang cocok dengan filter.'}
                  </td>
                </tr>
              )}
              {pagedJournals.map((j) => {
                const meta = TYPE_META[j.type];
                return (
                  <tr key={j.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      <p className="font-bold text-slate-900 font-mono">{j.id}</p>
                      <span className="text-[10px] text-slate-400">{j.date}</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-slate-400 shrink-0" />
                        <span>{j.description}</span>
                        {meta && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.cls}`}>
                            {meta.label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-emerald-700">
                      <span className="bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                        {j.debitAccount}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-rose-700">
                      <span className="bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md">
                        {j.creditAccount}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900">{rp(j.amount)}</td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => setInvoiceJournal(j)}
                        title={j.type === 'SALES' ? 'Lihat & unduh invoice' : 'Lihat & unduh bukti transaksi'}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {j.type === 'SALES' ? 'Invoice' : 'Bukti'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredJournals.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/60 text-xs text-slate-500">
            <span>
              {filteredJournals.length} jurnal · total {rp(totalDebit)}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, safePage - 1))}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="font-semibold">
                {safePage} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                aria-label="Halaman berikutnya"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PANEL DETAIL KPI */}
      <AnimatePresence>
        {detailKind && (
          <DetailDrawer
            key={detailKind}
            kind={detailKind}
            summary={summary}
            prev={prevSummary}
            periodLabel={periodLabel ?? ''}
            journals={periodJournals}
            expenseBreakdown={expenseBreakdown}
            onClose={() => setDetailKind(null)}
            onShowJournals={(t) => {
              setTypeFilter(t);
              setPage(1);
              setDetailKind(null);
              setTimeout(() => document.getElementById('tabel-jurnal')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
            }}
          />
        )}
      </AnimatePresence>

      {/* MODAL LAPORAN LENGKAP */}
      <AnimatePresence>
        {isReportOpen && <ReportModal key="report-modal" onClose={() => setIsReportOpen(false)} />}
      </AnimatePresence>

      {/* MODAL INVOICE */}
      <AnimatePresence>
        {invoiceJournal && (
          <InvoiceModal key={invoiceJournal.id} journal={invoiceJournal} onClose={() => setInvoiceJournal(null)} />
        )}
      </AnimatePresence>

      {/* MODAL KELOLA SALDO */}
      <AnimatePresence>
        {isFundModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
                  e.preventDefault();
                  handleSaveFund();
                }
              }}
              className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4 relative"
            >
              <button
                onClick={() => setIsFundModalOpen(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>

              <div>
                <h3 className="text-base font-bold text-slate-800">Kelola Saldo Kas & Bank</h3>
                <p className="text-xs text-slate-500 mt-0.5">Setiap perubahan otomatis tercatat sebagai jurnal.</p>
              </div>

              <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                {(
                  [
                    ['DEPOSIT', 'Tambah Saldo'],
                    ['TRANSFER', 'Transfer'],
                    ['WITHDRAW', 'Tarik Pemilik'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => {
                      setFundMode(id);
                      setFundError('');
                    }}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors ${
                      fundMode === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                {fundMode === 'DEPOSIT' &&
                  'Untuk saldo awal atau tambahan modal dari pemilik. Dicatat: debit akun kas/bank, kredit 301 Modal Pemilik.'}
                {fundMode === 'TRANSFER' &&
                  'Memindahkan uang antar akun, misalnya dari Kas Kasir ke Bank BCA. Tidak memengaruhi laba.'}
                {fundMode === 'WITHDRAW' &&
                  'Uang kas yang diambil pemilik untuk keperluan pribadi. Dicatat sebagai 302 Prive, bukan biaya.'}
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {fundMode === 'DEPOSIT' ? 'Masuk ke akun' : 'Dari akun'}
                  </label>
                  <select
                    value={fundAccount}
                    onChange={(e) => setFundAccount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.id} - {a.name} (Saldo: {rp(a.balance)})
                      </option>
                    ))}
                  </select>
                </div>

                {fundMode === 'TRANSFER' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Ke akun</label>
                    <select
                      value={fundTo}
                      onChange={(e) => setFundTo(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                    >
                      {accounts
                        .filter((a) => a.id !== fundAccount)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.id} - {a.name} (Saldo: {rp(a.balance)})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nominal (Rp)</label>
                  <RupiahInput value={fundAmount} onChange={setFundAmount} autoFocus />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Catatan (opsional)</label>
                  <input
                    type="text"
                    placeholder={fundMode === 'DEPOSIT' ? 'Contoh: Saldo awal, Modal tambahan' : 'Contoh: Setor hasil kasir ke bank'}
                    value={fundNote}
                    onChange={(e) => setFundNote(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
                  />
                </div>

                {fundAmount > 0 && (() => {
                  const from = accounts.find((a) => a.id === fundAccount);
                  const to = accounts.find((a) => a.id === fundTo);
                  if (!from) return null;
                  return (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-600 space-y-1">
                      <p className="font-semibold text-slate-700">Saldo setelah disimpan</p>
                      <p>
                        {from.name}: {rp(from.balance)} → <b>{rp(from.balance + (fundMode === 'DEPOSIT' ? fundAmount : -fundAmount))}</b>
                      </p>
                      {fundMode === 'TRANSFER' && to && (
                        <p>
                          {to.name}: {rp(to.balance)} → <b>{rp(to.balance + fundAmount)}</b>
                        </p>
                      )}
                    </div>
                  );
                })()}

                <ErrorBox text={fundError} />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsFundModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveFund}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-500 shadow-md transition-colors"
                >
                  {fundMode === 'TRANSFER' && <ArrowLeftRight className="h-3.5 w-3.5" />}
                  Simpan & Buat Jurnal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL CATAT BIAYA */}
      <AnimatePresence>
        {isExpenseModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
                  e.preventDefault();
                  handleSaveExpense();
                }
              }}
              className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4 relative"
            >
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>

              <div>
                <h3 className="text-base font-bold text-slate-800">Catat Biaya Operasional</h3>
                <p className="text-xs text-slate-500 mt-0.5">Pengeluaran kas untuk operasional toko sembako</p>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-xs text-slate-800 focus:border-rose-500 focus:outline-none"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Keterangan Biaya</label>
                  <input
                    type="text"
                    placeholder="Contoh: Token listrik November, Bensin kurir"
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-xs text-slate-800 focus:border-rose-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nominal Biaya (Rp)</label>
                  <RupiahInput value={expenseAmount} onChange={setExpenseAmount} accent="rose" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Sumber Kas / Bank</label>
                  <select
                    value={selectedSourceAccount}
                    onChange={(e) => setSelectedSourceAccount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-xs text-slate-800 focus:border-rose-500 focus:outline-none"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.id} - {a.name} (Saldo: {rp(a.balance)})
                      </option>
                    ))}
                  </select>
                  {lowCashWarning && (
                    <p className="mt-1 text-[11px] font-semibold text-amber-600">
                      Nominal melebihi saldo akun ini. Pilih akun lain atau kecilkan nominal.
                    </p>
                  )}
                </div>

                <ErrorBox text={error} />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveExpense}
                  className="flex-1 py-2.5 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-500 shadow-md transition-colors"
                >
                  Simpan Biaya & Jurnal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NOTIFIKASI SUKSES */}
      <AnimatePresence>
        {isSuccessAlert && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl z-50 flex items-center gap-3 text-xs font-semibold"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span>{alertMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}