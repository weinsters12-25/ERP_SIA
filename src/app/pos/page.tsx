'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DashboardLayout from '../(dashboard)/layout';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  Minus,
  Package,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { usePosStore } from '@/stores/usePosStore';
import {
  useErpStore,
  useHydrated,
  getSellableStock,
  getNearestBatch,
  getDaysLeft,
  toDateStr,
  toDateTimeStr,
  type Product,
} from '@/stores/useErpStore';

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

/* Identitas toko di struk — silakan ubah sesuai toko Anda */
const STORE_NAME = 'TOSERBA';
const STORE_TAGLINE = 'Nature Fresh · Toko Sembako';
const STORE_ADDRESS = 'Alamat toko Anda di sini';
const STORE_PHONE = 'Telp/WA: 08xx-xxxx-xxxx';
const CASHIER_NAME = 'Admin Toko';

/* ---------- Pembantu tampilan ---------- */
const TILE_TINTS = ['#e6f0ea', '#fbf3de', '#fbe9e5', '#e8eef7', '#efe8f5', '#e9f3f1'];

const EMOJI_RULES: [RegExp, string][] = [
  [/beras|rice/, '🍚'],
  [/minyak/, '🫗'],
  [/gula/, '🍬'],
  [/telur|telor/, '🥚'],
  [/tepung|terigu/, '🌾'],
  [/mie|indomie|bihun|pasta/, '🍜'],
  [/kecap|saus|sambal/, '🌶️'],
  [/susu/, '🥛'],
  [/kopi/, '☕'],
  [/teh/, '🍵'],
  [/garam/, '🧂'],
  [/sabun|deterjen/, '🧼'],
  [/kaleng|sarden|kornet/, '🥫'],
  [/ayam|daging|ikan/, '🍗'],
];
const emojiFor = (name: string) => EMOJI_RULES.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? '📦';

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-canvas-sunk)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--color-ink-soft)]">
      {children}
    </kbd>
  );
}

interface ReceiptItem {
  name: string;
  qty: number;
  unit: string;
  price: number;
}

interface Receipt {
  invoiceNo: string;
  total: number;
  change: number;
  method: 'CASH' | 'CREDIT';
  received: number;
  date: string;
  items: ReceiptItem[];
  customerName?: string;
  dueDate?: string;
}

/**
 * Struk belanja versi lucu & berwarna. Disembunyikan di layar, dan HANYA elemen
 * ini yang tercetak saat window.print() dipanggil.
 * Ukuran menyesuaikan kertas: di printer thermal 80mm memenuhi lebar kertas,
 * di kertas A4 lebarnya maksimal 110mm supaya mudah dibaca.
 */
function ReceiptPrint({ receipt }: { receipt: Receipt }) {
  const n = (v: number) => v.toLocaleString('id-ID');
  const totalQty = receipt.items.reduce((s, i) => s + i.qty, 0);
  const isCash = receipt.method === 'CASH';

  return (
    <div id="struk-print">
      <style>{`
        #struk-print { display: none; }
        @page { margin: 5mm; }
        @media print {
          html, body { background: #fff !important; background-image: none !important; height: auto !important; }
          body > *:not(#struk-print) { display: none !important; }
          #struk-print {
            display: block !important;
            width: 100%;
            max-width: 110mm;
            margin: 0 auto;
            color: #1c1917;
            background: #fff;
            font-family: var(--font-geist-mono), 'Courier New', Courier, monospace;
            font-size: 14px;
            line-height: 1.45;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #struk-print .st-card { border: 2.5px dashed #0b4d3a; border-radius: 18px; padding: 16px 14px 18px; }
          #struk-print .st-head { text-align: center; }
          #struk-print .st-emoji { font-size: 22px; letter-spacing: 6px; }
          #struk-print .st-store {
            font-family: var(--font-fraunces), Georgia, serif;
            font-size: 30px; font-weight: 700; letter-spacing: 3px; line-height: 1.1; color: #0b4d3a;
          }
          #struk-print .st-tagline { font-size: 12px; font-style: italic; font-weight: 700; color: #b8912f; }
          #struk-print .st-addr { font-size: 11px; color: #57534e; }
          #struk-print .st-badge {
            display: inline-block; margin-top: 8px; padding: 3px 14px; border-radius: 999px;
            background: #0b4d3a; color: #fff; font-size: 12px; font-weight: 700; letter-spacing: 1px;
          }
          #struk-print .st-wave { margin: 12px 0; border-top: 2px dotted #b8912f; }
          #struk-print .st-row { display: flex; justify-content: space-between; gap: 10px; }
          #struk-print .st-meta { font-size: 12px; }
          #struk-print .st-meta .st-k { color: #57534e; }
          #struk-print .st-item { margin: 9px 0; break-inside: avoid; }
          #struk-print .st-item-top { display: flex; gap: 8px; align-items: flex-start; font-weight: 700; }
          #struk-print .st-qty {
            flex: none; min-width: 36px; text-align: center; padding: 0 6px; border-radius: 8px;
            background: #fbf3de; border: 1.5px solid #b8912f; font-size: 12px;
          }
          #struk-print .st-name { flex: 1; word-break: break-word; }
          #struk-print .st-item-sub { display: flex; justify-content: space-between; padding-left: 44px; font-size: 12px; color: #57534e; }
          #struk-print .st-count { text-align: right; font-size: 12px; color: #57534e; }
          #struk-print .st-total { margin-top: 10px; padding: 10px 12px; border-radius: 14px; background: #e6f0ea; border: 1.5px solid #0b4d3a; }
          #struk-print .st-total-main { display: flex; justify-content: space-between; align-items: baseline; font-size: 20px; font-weight: 800; color: #0b4d3a; }
          #struk-print .st-pay { margin-top: 4px; display: flex; justify-content: space-between; }
          #struk-print .st-change { font-weight: 800; color: #0b4d3a; }
          #struk-print .st-stamp {
            width: fit-content; margin: 12px auto 0; padding: 4px 14px; text-align: center;
            border: 3px double #a23b32; border-radius: 10px; color: #a23b32; font-weight: 800; transform: rotate(-3deg);
          }
          #struk-print .st-foot { margin-top: 14px; text-align: center; }
          #struk-print .st-thanks { font-family: var(--font-fraunces), Georgia, serif; font-size: 19px; font-weight: 700; color: #0b4d3a; }
          #struk-print .st-fun { font-size: 12px; color: #b8912f; font-weight: 700; }
          #struk-print .st-small { font-size: 10.5px; color: #57534e; }
          #struk-print .st-hearts { margin-top: 6px; font-size: 14px; letter-spacing: 8px; color: #b8912f; }
        }
      `}</style>

      <div className="st-card">
        <div className="st-head">
          <div className="st-emoji">🌿🛒🌿</div>
          <div className="st-store">{STORE_NAME}</div>
          <div className="st-tagline">{STORE_TAGLINE}</div>
          <div className="st-addr">{STORE_ADDRESS}</div>
          <div className="st-addr">{STORE_PHONE}</div>
          <div className="st-badge">✨ STRUK BELANJA ✨</div>
        </div>

        <div className="st-wave" />

        <div className="st-meta">
          <div className="st-row">
            <span className="st-k">No. Nota</span>
            <span>{receipt.invoiceNo}</span>
          </div>
          <div className="st-row">
            <span className="st-k">Tanggal</span>
            <span>{receipt.date}</span>
          </div>
          <div className="st-row">
            <span className="st-k">Kasir</span>
            <span>{CASHIER_NAME}</span>
          </div>
          {receipt.customerName && (
            <div className="st-row">
              <span className="st-k">Pelanggan</span>
              <span>{receipt.customerName}</span>
            </div>
          )}
        </div>

        <div className="st-wave" />

        {receipt.items.map((it, idx) => (
          <div key={idx} className="st-item">
            <div className="st-item-top">
              <span className="st-qty">{it.qty}×</span>
              <span className="st-name">{it.name}</span>
            </div>
            <div className="st-item-sub">
              <span>
                @ {n(it.price)} / {it.unit}
              </span>
              <span>Rp {n(it.qty * it.price)}</span>
            </div>
          </div>
        ))}

        <div className="st-count">🛍️ {totalQty} barang dibeli</div>

        <div className="st-total">
          <div className="st-total-main">
            <span>TOTAL</span>
            <span>Rp {n(receipt.total)}</span>
          </div>
          {isCash ? (
            <>
              <div className="st-pay">
                <span>Tunai</span>
                <span>Rp {n(receipt.received)}</span>
              </div>
              <div className="st-pay st-change">
                <span>Kembalian 💚</span>
                <span>Rp {n(receipt.change)}</span>
              </div>
            </>
          ) : (
            receipt.dueDate && (
              <div className="st-pay">
                <span>Jatuh tempo</span>
                <span>{receipt.dueDate}</span>
              </div>
            )
          )}
        </div>

        {!isCash && <div className="st-stamp">📒 BON · BELUM LUNAS</div>}

        <div className="st-wave" />

        <div className="st-foot">
          <div className="st-thanks">Terima kasih, Kak! 💚</div>
          <div className="st-fun">Belanja hemat, hidup sehat ✨</div>
          <div className="st-fun">Sampai jumpa lagi ya! 👋</div>
          <div className="st-hearts">♡ ♡ ♡</div>
          <div className="st-small">Barang yang sudah dibeli tidak dapat ditukar</div>
        </div>
      </div>
    </div>
  );
}

export default function PosPage() {
  const hydrated = useHydrated();
  const searchRef = useRef<HTMLInputElement>(null);
  const payInputRef = useRef<HTMLInputElement>(null);

  const products = useErpStore((s) => s.products);
  const sellItems = useErpStore((s) => s.sellItems);
  const { cart, addToCart, updateQty, clearCart } = usePosStore();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Semua');

  // Modal pembayaran
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<'CASH' | 'CREDIT'>('CASH');
  const [received, setReceived] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [dueDays, setDueDays] = useState(14);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  // Struk selalu dicetak otomatis setelah transaksi selesai
  const printNextRef = useRef(false);
  const receiptTimeRef = useRef(0); // kapan struk muncul (untuk mencegah Enter ganda)

  const printReceipt = () => window.print();

  useEffect(() => {
    if (receipt && printNextRef.current) {
      printNextRef.current = false;
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [receipt]);

  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const totalQty = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  const categories = useMemo(() => ['Semua', ...Array.from(new Set(products.map((p) => p.category)))], [products]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        (category === 'Semua' || p.category === category) &&
        (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    );
  }, [products, search, category]);

  const openPayment = () => {
    if (cart.length === 0) return;
    setError('');
    setReceived(0); // kasir mengetik sendiri nominal uang dari pembeli
    setMethod('CASH');
    setPayOpen(true);
  };

  // Pintasan keyboard: F2 = cari, F9 = bayar, Esc = tutup modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'F9') {
        e.preventDefault();
        openPayment();
      } else if (e.key === 'F8' && receipt) {
        e.preventDefault();
        printReceipt();
      } else if (e.key === 'Enter' && receipt) {
        // Enter di modal sukses = Transaksi baru (abaikan tombol yang ditahan)
        e.preventDefault();
        if (!e.repeat && Date.now() - receiptTimeRef.current > 500) setReceipt(null);
      } else if (e.key === 'Escape') {
        setPayOpen(false);
        setReceipt(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const handleAdd = (p: Product) => {
    addToCart({
      id: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      price: p.price,
      stock: getSellableStock(p),
    });
  };

  const canConfirm = method === 'CASH' ? received >= total && total > 0 : customerName.trim().length > 0;

  const handleConfirm = () => {
    // Simpan salinan isi keranjang untuk struk (keranjang dikosongkan setelah bayar)
    const items = cart.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit, price: i.price }));

    const result = sellItems(
      cart.map((i) => ({ id: i.id, name: i.name, qty: i.qty })),
      method === 'CASH' ? { method: 'CASH', received } : { method: 'CREDIT', customerName, phone, dueDays }
    );

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPayOpen(false);
    const now = new Date();
    const due = new Date(now);
    due.setDate(due.getDate() + dueDays);

    printNextRef.current = true;
    receiptTimeRef.current = Date.now();
    setReceipt({
      invoiceNo: result.invoiceNo,
      total: result.total,
      change: result.change,
      method: result.method,
      received: method === 'CASH' ? received : 0,
      date: toDateTimeStr(now),
      items,
      customerName: method === 'CREDIT' ? customerName.trim() : undefined,
      dueDate: method === 'CREDIT' ? toDateStr(due) : undefined,
    });
    clearCart();
    setCustomerName('');
    setPhone('');
    setReceived(0);
  };

  // Pilihan nominal cepat untuk pembayaran tunai
  const quickCash = useMemo(() => {
    if (total <= 0) return [];
    const up = (step: number) => Math.ceil(total / step) * step;
    return Array.from(new Set([total, up(5000), up(10000), up(50000), up(100000)])).slice(0, 4);
  }, [total]);

  if (!hydrated) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center text-sm text-[var(--color-ink-soft)]">
          Memuat kasir…
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
    <div className="-m-8 flex h-[calc(100vh-4rem)] overflow-hidden bg-[var(--color-canvas)] text-[var(--color-ink)]">
      {/* ============ KIRI: katalog ============ */}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden p-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold">Kasir Toserba</h1>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)]">
              <Kbd>F2</Kbd> cari barang <span className="mx-1">·</span> <Kbd>F9</Kbd> bayar
            </p>
          </div>

          <div className="relative w-full sm:w-96">
            <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-[var(--color-ink-soft)]" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Cari nama barang atau SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3 pl-11 pr-14 text-sm shadow-sm placeholder-[var(--color-ink-soft)] transition-shadow focus:border-[var(--color-gold)] focus:shadow-md focus:outline-none"
            />
            {search ? (
              <button
                aria-label="Hapus pencarian"
                onClick={() => setSearch('')}
                className="absolute right-3 top-3 rounded-full p-1 text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas-sunk)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="pointer-events-none absolute right-3.5 top-3.5">
                <Kbd>F2</Kbd>
              </span>
            )}
          </div>
        </header>

        {/* Filter kategori */}
        <div className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1">
          {categories.map((c) => {
            const count = c === 'Semua' ? products.length : products.filter((p) => p.category === c).length;
            const active = category === c;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-all ${
                  active
                    ? 'border-[var(--color-pine)] bg-[var(--color-pine)] text-white shadow-md'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:border-[var(--color-pine)]/40 hover:text-[var(--color-pine)]'
                }`}
              >
                {c}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                    active ? 'bg-white/20 text-white' : 'bg-[var(--color-canvas-sunk)] text-[var(--color-ink-soft)]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Grid produk */}
        <div className="mt-4 grid flex-1 grid-cols-2 content-start gap-4 overflow-y-auto p-1 pr-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-2 py-20 text-center">
              <span className="text-4xl">🔍</span>
              <p className="text-sm font-semibold">Barang tidak ditemukan</p>
              <p className="text-xs text-[var(--color-ink-soft)]">Coba kata kunci atau kategori lain.</p>
            </div>
          )}

          {filtered.map((p) => {
            const stock = getSellableStock(p);
            const nearest = getNearestBatch(p);
            const days = nearest ? getDaysLeft(nearest.expiredDate) : null;
            const inCart = cart.find((i) => i.id === p.id)?.qty ?? 0;
            const soldOut = stock <= 0;
            const lowStock = soldOut || stock <= p.minStock;
            const tint = TILE_TINTS[Math.max(categories.indexOf(p.category) - 1, 0) % TILE_TINTS.length];

            return (
              <button
                key={p.id}
                disabled={soldOut || inCart >= stock}
                onClick={(e) => {
                  handleAdd(p);
                  e.currentTarget.blur(); // supaya Enter tidak menekan tombol ini lagi
                }}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-[var(--color-surface)] text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm ${
                  inCart > 0 ? 'border-[var(--color-pine)] ring-1 ring-[var(--color-pine)]/30' : 'border-[var(--color-border)]'
                }`}
              >
                {/* Ubin ikon produk */}
                <div className="relative flex h-24 items-center justify-center" style={{ background: tint }}>
                  <span className="text-5xl drop-shadow-sm transition-transform duration-200 group-hover:scale-110">
                    {emojiFor(p.name)}
                  </span>
                  <span className="absolute left-3 top-3 rounded-md bg-white/80 px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-ink-soft)] backdrop-blur">
                    {p.sku}
                  </span>
                  {inCart > 0 && (
                    <motion.span
                      key={inCart}
                      initial={{ scale: 0.6 }}
                      animate={{ scale: 1 }}
                      className="absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--color-pine)] px-1.5 text-[11px] font-bold text-white shadow"
                    >
                      {inCart}
                    </motion.span>
                  )}
                  {days !== null && days <= 30 && (
                    <span
                      className={`absolute bottom-2 left-3 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        days <= 14
                          ? 'bg-[var(--color-rust)] text-white'
                          : 'bg-[var(--color-gold-light)] text-[var(--color-pine)]'
                      }`}
                    >
                      Exp {days} hari
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug">{p.name}</h3>
                    <span
                      className={`mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        lowStock
                          ? 'bg-[var(--color-rust-tint)] text-[var(--color-rust)]'
                          : 'bg-[var(--color-pine-tint)] text-[var(--color-pine)]'
                      }`}
                    >
                      <Package className="h-3 w-3" />
                      {soldOut ? 'Habis' : `Stok ${stock} ${p.unit}`}
                    </span>
                  </div>

                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-[11px] text-[var(--color-ink-soft)]">per {p.unit}</p>
                      <p className="font-display text-lg font-semibold leading-tight text-[var(--color-pine)]">
                        {rp(p.price)}
                      </p>
                    </div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-pine-tint)] text-[var(--color-pine)] transition-colors group-hover:bg-[var(--color-pine)] group-hover:text-white">
                      <Plus className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ============ KANAN: keranjang ============ */}
      <aside className="flex w-[22rem] shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-pine-tint)] text-[var(--color-pine)]">
              <ShoppingCart className="h-[18px] w-[18px]" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold leading-tight">Keranjang</h2>
              <p className="text-[11px] text-[var(--color-ink-soft)]">{totalQty} item</p>
            </div>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--color-rust)] transition-colors hover:bg-[var(--color-rust-tint)]"
            >
              <Trash2 className="h-3.5 w-3.5" /> Kosongkan
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-border-strong)] px-6 text-center">
              <span className="text-4xl">🛒</span>
              <p className="text-sm font-semibold">Keranjang masih kosong</p>
              <p className="text-xs text-[var(--color-ink-soft)]">Klik barang di sebelah kiri untuk menambahkan.</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {cart.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-canvas)] p-3"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
                    {emojiFor(item.name)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <h4 className="line-clamp-1 text-xs font-semibold">{item.name}</h4>
                    <p className="text-[11px] text-[var(--color-ink-soft)]">{rp(item.price)}</p>
                    <p className="text-sm font-bold text-[var(--color-pine)]">{rp(item.price * item.qty)}</p>
                  </div>

                  <div className="flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
                    <button
                      aria-label="Kurangi"
                      onClick={(e) => {
                        updateQty(item.id, item.qty - 1);
                        e.currentTarget.blur();
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-rust-tint)] hover:text-[var(--color-rust)]"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-xs font-bold">{item.qty}</span>
                    <button
                      aria-label="Tambah"
                      disabled={item.qty >= item.stock}
                      onClick={(e) => {
                        updateQty(item.id, item.qty + 1);
                        e.currentTarget.blur();
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-pine-tint)] hover:text-[var(--color-pine)] disabled:opacity-30"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Ringkasan & tombol bayar */}
        <div className="mt-4 space-y-3 rounded-2xl bg-[var(--color-pine)] p-4 text-white shadow-lg">
          <div className="flex items-center justify-between text-xs text-white/70">
            <span>Jumlah item</span>
            <span className="font-semibold text-white">{totalQty}</span>
          </div>
          <div className="flex items-end justify-between">
            <span className="text-sm font-medium text-white/80">Total bayar</span>
            <motion.span
              key={total}
              initial={{ scale: 1.08 }}
              animate={{ scale: 1 }}
              className="font-display text-2xl font-semibold"
            >
              {rp(total)}
            </motion.span>
          </div>
          <button
            onClick={openPayment}
            disabled={cart.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-gold-light)] py-3 text-sm font-bold text-[var(--color-pine)] shadow-md transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-40"
          >
            Bayar <span className="rounded-md bg-[var(--color-pine)]/15 px-1.5 py-0.5 font-mono text-[10px]">F9</span>
          </button>
        </div>
      </aside>

      {/* ============ MODAL PEMBAYARAN ============ */}
      <AnimatePresence>
        {payOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-ink)]/40 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
            >
              {/* Kepala: total tagihan */}
              <div className="relative bg-[var(--color-pine)] px-6 pb-5 pt-6 text-white">
                <button
                  aria-label="Tutup"
                  onClick={() => setPayOpen(false)}
                  className="absolute right-4 top-4 rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
                <h3 className="text-sm font-medium text-white/70">Pembayaran</h3>
                <p className="font-display text-4xl font-semibold">{rp(total)}</p>
                <p className="mt-1 text-xs text-white/60">{totalQty} item dalam keranjang</p>
              </div>

              <div className="space-y-4 p-6">
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--color-canvas-sunk)] p-1 text-sm font-semibold">
                  {(
                    [
                      ['CASH', 'Tunai', Banknote],
                      ['CREDIT', 'Bon / Kredit', CreditCard],
                    ] as const
                  ).map(([key, label, Icon]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setMethod(key);
                        setError('');
                      }}
                      className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition-all ${
                        method === key
                          ? 'bg-[var(--color-surface)] text-[var(--color-pine)] shadow-sm'
                          : 'text-[var(--color-ink-soft)]'
                      }`}
                    >
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  ))}
                </div>

                {method === 'CASH' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-ink-soft)]">
                        Uang diterima dari pembeli (Rp)
                      </label>
                      <input
                        ref={payInputRef}
                        autoFocus
                        type="text"
                        inputMode="numeric"
                        placeholder="Ketik nominal uang"
                        value={received ? received.toLocaleString('id-ID') : ''}
                        onChange={(e) => setReceived(Number(e.target.value.replace(/\D/g, '')))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && canConfirm) {
                            e.preventDefault();
                            e.stopPropagation();
                            handleConfirm();
                          }
                        }}
                        className="w-full rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-canvas)] px-4 py-3 text-xl font-bold focus:border-[var(--color-gold)] focus:outline-none"
                      />
                    </div>

                    {/* Nominal cepat */}
                    <div className="flex flex-wrap gap-2">
                      {quickCash.map((v, i) => (
                        <button
                          key={v}
                          onClick={() => {
                            setReceived(v);
                            payInputRef.current?.focus();
                          }}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            received === v
                              ? 'border-[var(--color-pine)] bg-[var(--color-pine)] text-white'
                              : 'border-[var(--color-border)] text-[var(--color-ink-soft)] hover:border-[var(--color-pine)] hover:text-[var(--color-pine)]'
                          }`}
                        >
                          {i === 0 ? 'Uang pas' : rp(v)}
                        </button>
                      ))}
                    </div>

                    <div
                      className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm ${
                        received >= total
                          ? 'bg-[var(--color-pine-tint)] text-[var(--color-pine)]'
                          : 'bg-[var(--color-rust-tint)] text-[var(--color-rust)]'
                      }`}
                    >
                      <span>{received >= total ? 'Kembalian' : 'Uang kurang'}</span>
                      <span className="font-display text-xl font-semibold">{rp(Math.abs(received - total))}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-ink-soft)]">Nama pelanggan</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Contoh: Warung Bu Ani"
                        className="w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-canvas)] px-3 py-2.5 text-sm focus:border-[var(--color-gold)] focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-[var(--color-ink-soft)]">No. WhatsApp</label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="08xxxxxxxxxx"
                          className="w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-canvas)] px-3 py-2.5 text-sm focus:border-[var(--color-gold)] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-[var(--color-ink-soft)]">Tempo</label>
                        <select
                          value={dueDays}
                          onChange={(e) => setDueDays(Number(e.target.value))}
                          className="w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-canvas)] px-3 py-2.5 text-sm focus:border-[var(--color-gold)] focus:outline-none"
                        >
                          <option value={7}>7 hari</option>
                          <option value={14}>14 hari</option>
                          <option value={30}>30 hari</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-[11px] text-[var(--color-ink-soft)]">
                      Transaksi ini masuk ke Piutang (AR) dan bisa ditagih lewat menu Pendapatan.
                    </p>
                  </div>
                )}

                {error && (
                  <p className="flex items-start gap-2 rounded-lg bg-[var(--color-rust-tint)] px-3 py-2 text-xs font-semibold text-[var(--color-rust)]">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setPayOpen(false)}
                    className="flex-1 rounded-xl border border-[var(--color-border)] py-3 text-sm font-semibold text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas-sunk)]"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={!canConfirm}
                    className="flex-[1.4] rounded-xl bg-[var(--color-pine)] py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-[var(--color-pine-light)] active:scale-[0.98] disabled:opacity-40"
                  >
                    Selesaikan transaksi
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ MODAL SUKSES ============ */}
      <AnimatePresence>
        {receipt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-ink)]/40 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="w-full max-w-sm overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] text-center shadow-xl"
            >
              <div className="bg-[var(--color-pine-tint)] px-8 pb-6 pt-8">
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-pine)] text-white shadow-lg ring-8 ring-[var(--color-pine)]/10"
                >
                  <CheckCircle2 className="h-9 w-9" />
                </motion.div>
                <h3 className="font-display mt-4 text-xl font-semibold">Transaksi berhasil</h3>
                <p className="mt-1 font-mono text-xs text-[var(--color-ink-soft)]">{receipt.invoiceNo}</p>
              </div>

              <div className="space-y-4 border-t-2 border-dashed border-[var(--color-border-strong)] p-6">
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-ink-soft)]">Total</span>
                    <strong className="font-display text-lg">{rp(receipt.total)}</strong>
                  </div>
                  {receipt.method === 'CASH' ? (
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--color-ink-soft)]">Kembalian</span>
                      <strong className="font-display text-lg text-[var(--color-pine)]">{rp(receipt.change)}</strong>
                    </div>
                  ) : (
                    <p className="rounded-lg bg-[var(--color-gold-tint)] py-1.5 text-xs font-semibold text-[var(--color-gold)]">
                      Dicatat sebagai piutang pelanggan
                    </p>
                  )}
                </div>
                <p className="text-xs text-[var(--color-ink-soft)]">
                  Stok terpotong otomatis (FEFO) dan jurnal penjualan sudah dibuat.
                </p>
                <div className="space-y-2">
                  <button
                    onClick={printReceipt}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-pine)] py-2.5 text-sm font-bold text-[var(--color-pine)] hover:bg-[var(--color-pine-tint)]"
                  >
                    <Printer className="h-4 w-4" /> Cetak struk (F8)
                  </button>
                  <button
                    onClick={() => setReceipt(null)}
                    className="w-full rounded-xl bg-[var(--color-pine)] py-2.5 text-sm font-bold text-white hover:bg-[var(--color-pine-light)]"
                  >
                    Transaksi baru (Enter)
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ STRUK CETAK (tersembunyi di layar, tampil saat print) ============ */}
      {receipt && createPortal(<ReceiptPrint receipt={receipt} />, document.body)}
    </div>
    </DashboardLayout>
  );
}