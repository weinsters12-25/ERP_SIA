'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CreditCard,
  Minus,
  Package,
  Plus,
  Search,
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
  type Product,
} from '@/stores/useErpStore';

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

interface Receipt {
  invoiceNo: string;
  total: number;
  change: number;
  method: 'CASH' | 'CREDIT';
}

export default function PosPage() {
  const hydrated = useHydrated();
  const searchRef = useRef<HTMLInputElement>(null);

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

  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);

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
    const result = sellItems(
      cart.map((i) => ({ id: i.id, name: i.name, qty: i.qty })),
      method === 'CASH' ? { method: 'CASH', received } : { method: 'CREDIT', customerName, phone, dueDays }
    );

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPayOpen(false);
    setReceipt({ invoiceNo: result.invoiceNo, total: result.total, change: result.change, method: result.method });
    clearCart();
    setCustomerName('');
    setPhone('');
    setReceived(0);
  };

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-canvas)] text-sm text-[var(--color-ink-soft)]">
        Memuat kasir…
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-canvas)] text-[var(--color-ink)]">
      {/* ============ KIRI: katalog ============ */}
      <section className="flex flex-1 flex-col overflow-hidden p-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] pb-5">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              aria-label="Kembali ke dashboard"
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-[var(--color-pine)] transition-colors hover:bg-[var(--color-canvas-sunk)]"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="font-display text-xl font-semibold">Kasir Toserba</h1>
              <p className="text-xs text-[var(--color-ink-soft)]">F2 cari barang · F9 bayar</p>
            </div>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[var(--color-ink-soft)]" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Cari nama barang atau SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-10 pr-4 text-sm placeholder-[var(--color-ink-soft)] focus:border-[var(--color-gold)] focus:outline-none"
            />
          </div>
        </header>

        {/* Filter kategori */}
        <div className="flex flex-wrap gap-2 pt-4">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                category === c
                  ? 'border-[var(--color-pine)] bg-[var(--color-pine)] text-white'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas-sunk)]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Grid produk */}
        <div className="mt-4 grid flex-1 grid-cols-2 content-start gap-4 overflow-y-auto pr-1 md:grid-cols-3 xl:grid-cols-4">
          {filtered.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-[var(--color-ink-soft)]">
              Tidak ada barang yang cocok. Coba kata kunci atau kategori lain.
            </p>
          )}

          {filtered.map((p) => {
            const stock = getSellableStock(p);
            const nearest = getNearestBatch(p);
            const days = nearest ? getDaysLeft(nearest.expiredDate) : null;
            const inCart = cart.find((i) => i.id === p.id)?.qty ?? 0;
            const soldOut = stock <= 0;

            return (
              <button
                key={p.id}
                disabled={soldOut || inCart >= stock}
                onClick={() => handleAdd(p)}
                className="glass-card-light flex flex-col justify-between rounded-2xl p-4 text-left disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div>
                  <div className="mb-2 flex items-center justify-between text-[11px]">
                    <span className="rounded bg-[var(--color-canvas-sunk)] px-2 py-0.5 font-mono text-[var(--color-ink-soft)]">
                      {p.sku}
                    </span>
                    {inCart > 0 && (
                      <span className="rounded-full bg-[var(--color-pine)] px-2 py-0.5 font-bold text-white">
                        {inCart} di keranjang
                      </span>
                    )}
                  </div>
                  <h3 className="line-clamp-2 text-sm font-semibold">{p.name}</h3>

                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                        soldOut || stock <= p.minStock
                          ? 'bg-[var(--color-rust-tint)] text-[var(--color-rust)]'
                          : 'bg-[var(--color-pine-tint)] text-[var(--color-pine)]'
                      }`}
                    >
                      <Package className="h-3 w-3" />
                      {soldOut ? 'Habis' : `Stok ${stock} ${p.unit}`}
                    </span>
                    {days !== null && days <= 30 && (
                      <span
                        className={`rounded px-1.5 py-0.5 ${
                          days <= 14
                            ? 'bg-[var(--color-rust-tint)] text-[var(--color-rust)]'
                            : 'bg-[var(--color-gold-tint)] text-[var(--color-gold)]'
                        }`}
                      >
                        Exp {days} hari
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between border-t border-[var(--color-border)] pt-3">
                  <span className="text-xs text-[var(--color-ink-soft)]">per {p.unit}</span>
                  <span className="font-display text-base font-semibold text-[var(--color-pine)]">{rp(p.price)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ============ KANAN: keranjang ============ */}
      <aside className="flex w-96 flex-col justify-between border-l border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="min-h-0 flex-1">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
            <h2 className="font-display text-lg font-semibold">Keranjang</h2>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="flex items-center gap-1 text-xs font-semibold text-[var(--color-rust)] hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" /> Kosongkan
              </button>
            )}
          </div>

          <div className="mt-4 max-h-[calc(100vh-22rem)] space-y-3 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--color-border-strong)] py-14 text-center text-xs text-[var(--color-ink-soft)]">
                Keranjang masih kosong.
                <br />
                Klik barang di kiri untuk menambahkan.
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] p-3"
                >
                  <div className="flex-1 pr-2">
                    <h4 className="line-clamp-1 text-xs font-semibold">{item.name}</h4>
                    <p className="mt-0.5 text-[11px] text-[var(--color-ink-soft)]">
                      {rp(item.price)} × {item.qty}
                    </p>
                    <p className="text-xs font-bold text-[var(--color-pine)]">{rp(item.price * item.qty)}</p>
                  </div>

                  <div className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
                    <button
                      aria-label="Kurangi"
                      onClick={() => updateQty(item.id, item.qty - 1)}
                      className="rounded p-1 hover:bg-[var(--color-canvas-sunk)]"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold">{item.qty}</span>
                    <button
                      aria-label="Tambah"
                      disabled={item.qty >= item.stock}
                      onClick={() => updateQty(item.id, item.qty + 1)}
                      className="rounded p-1 hover:bg-[var(--color-canvas-sunk)] disabled:opacity-30"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
          <div className="flex items-center justify-between text-sm text-[var(--color-ink-soft)]">
            <span>Jumlah item</span>
            <span>{cart.reduce((s, i) => s + i.qty, 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total bayar</span>
            <span className="font-display text-2xl font-semibold text-[var(--color-pine)]">{rp(total)}</span>
          </div>
          <button
            onClick={openPayment}
            disabled={cart.length === 0}
            className="w-full rounded-xl bg-[var(--color-pine)] py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-[var(--color-pine-light)] disabled:opacity-40"
          >
            Bayar (F9)
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
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
              className="relative w-full max-w-md space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl"
            >
              <button
                aria-label="Tutup"
                onClick={() => setPayOpen(false)}
                className="absolute right-4 top-4 p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
              >
                <X className="h-4 w-4" />
              </button>

              <div>
                <h3 className="font-display text-lg font-semibold">Pembayaran</h3>
                <p className="text-2xl font-semibold text-[var(--color-pine)]">{rp(total)}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--color-canvas-sunk)] p-1 text-sm font-semibold">
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
                    className={`flex items-center justify-center gap-2 rounded-lg py-2 transition-colors ${
                      method === key ? 'bg-[var(--color-surface)] text-[var(--color-pine)] shadow-sm' : 'text-[var(--color-ink-soft)]'
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
                      autoFocus
                      type="text"
                      inputMode="numeric"
                      placeholder="Ketik nominal uang"
                      value={received ? received.toLocaleString('id-ID') : ''}
                      onChange={(e) => setReceived(Number(e.target.value.replace(/\D/g, '')))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canConfirm) handleConfirm();
                      }}
                      className="w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-canvas)] px-3 py-2.5 text-lg font-bold focus:border-[var(--color-gold)] focus:outline-none"
                    />
                  </div>

                  <div
                    className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
                      received >= total
                        ? 'bg-[var(--color-pine-tint)] text-[var(--color-pine)]'
                        : 'bg-[var(--color-rust-tint)] text-[var(--color-rust)]'
                    }`}
                  >
                    <span>{received >= total ? 'Kembalian' : 'Uang kurang'}</span>
                    <span className="font-display text-lg font-semibold">{rp(Math.abs(received - total))}</span>
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

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setPayOpen(false)}
                  className="flex-1 rounded-xl border border-[var(--color-border)] py-2.5 text-sm font-semibold text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas-sunk)]"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  className="flex-1 rounded-xl bg-[var(--color-pine)] py-2.5 text-sm font-bold text-white shadow-md hover:bg-[var(--color-pine-light)] disabled:opacity-40"
                >
                  Selesaikan transaksi
                </button>
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
              className="w-full max-w-sm space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-xl"
            >
              <CheckCircle2 className="mx-auto h-14 w-14 text-[var(--color-pine)]" />
              <div>
                <h3 className="font-display text-xl font-semibold">Transaksi berhasil</h3>
                <p className="mt-1 font-mono text-xs text-[var(--color-ink-soft)]">{receipt.invoiceNo}</p>
              </div>
              <div className="space-y-1 text-sm">
                <p>
                  Total <strong>{rp(receipt.total)}</strong>
                </p>
                {receipt.method === 'CASH' ? (
                  <p>
                    Kembalian <strong>{rp(receipt.change)}</strong>
                  </p>
                ) : (
                  <p className="text-[var(--color-gold)]">Dicatat sebagai piutang pelanggan</p>
                )}
              </div>
              <p className="text-xs text-[var(--color-ink-soft)]">
                Stok terpotong otomatis (FEFO) dan jurnal penjualan sudah dibuat.
              </p>
              <button
                onClick={() => setReceipt(null)}
                className="w-full rounded-xl bg-[var(--color-pine)] py-2.5 text-sm font-bold text-white hover:bg-[var(--color-pine-light)]"
              >
                Transaksi baru
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}