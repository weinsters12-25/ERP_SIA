'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  CheckCircle2,
  Edit3,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Search,
} from 'lucide-react';
import {
  useErpStore,
  useHydrated,
  getTotalStock,
  getDaysLeft,
  getExpiryStatus,
  type Product,
  type ExpiryStatus,
} from '@/stores/useErpStore';
import { ErrorBox, Field, FormActions, ModalShell, inputCls, rp } from '@/components/ErpUi';

const batchStyle: Record<ExpiryStatus, string> = {
  expired: 'bg-[var(--color-rust)] text-white border-transparent',
  kritis: 'bg-[var(--color-rust-tint)] text-[var(--color-rust)] border-[var(--color-rust)]/30',
  peringatan: 'bg-[var(--color-gold-tint)] text-[var(--color-gold)] border-[var(--color-gold)]/30',
  aman: 'bg-[var(--color-pine-tint)] text-[var(--color-pine)] border-[var(--color-pine)]/20',
};

type Modal =
  | null
  | { type: 'product'; product?: Product }
  | { type: 'batch'; product: Product }
  | { type: 'opname'; product: Product };

type Filter = 'all' | 'low' | 'risk';

/* ---------- modal: tambah / edit barang ---------- */

function ProductModal({ product, categories, onClose, onDone }: { product?: Product; categories: string[]; onClose: () => void; onDone: (m: string) => void }) {
  const addProduct = useErpStore((s) => s.addProduct);
  const updateProduct = useErpStore((s) => s.updateProduct);
  const isEdit = !!product;

  const [sku, setSku] = useState(product?.sku ?? '');
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [unit, setUnit] = useState(product?.unit ?? 'Pcs');
  const [price, setPrice] = useState(product?.price ?? 0);
  const [cost, setCost] = useState(product?.cost ?? 0);
  const [minStock, setMinStock] = useState(product?.minStock ?? 5);
  const [initialQty, setInitialQty] = useState(0);
  const [expiredDate, setExpiredDate] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const res = isEdit
      ? updateProduct(product!.id, { name, category: category.trim() || 'Lainnya', unit: unit.trim() || 'Pcs', price, cost, minStock })
      : addProduct({ sku, name, category, unit, price, cost, minStock, initialQty, expiredDate });
    if (!res.ok) return setError(res.error);
    onDone(res.message);
  };

  return (
    <ModalShell title={isEdit ? 'Edit barang' : 'Tambah barang baru'} subtitle={isEdit ? product!.sku : 'Daftarkan barang, stok awal boleh dikosongkan'} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <Field label="SKU">
              <input className={`${inputCls} font-mono uppercase`} value={sku} disabled={isEdit} onChange={(e) => setSku(e.target.value)} placeholder="BRS-002" />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Nama barang">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Beras Pandan Wangi 5kg" />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategori">
            <input className={inputCls} list="kategori-list" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Beras & Biji" />
            <datalist id="kategori-list">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Satuan">
            <input className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Pcs / Kg / Dus" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Harga beli / modal (Rp)">
            <input type="number" className={inputCls} value={cost || ''} onChange={(e) => setCost(Number(e.target.value))} />
          </Field>
          <Field label="Harga jual (Rp)">
            <input type="number" className={inputCls} value={price || ''} onChange={(e) => setPrice(Number(e.target.value))} />
          </Field>
          <Field label="Batas stok menipis">
            <input type="number" className={inputCls} value={minStock} onChange={(e) => setMinStock(Number(e.target.value))} />
          </Field>
        </div>

        {!isEdit && (
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-[var(--color-canvas-sunk)] p-3">
            <Field label="Stok awal">
              <input type="number" className={inputCls} value={initialQty || ''} onChange={(e) => setInitialQty(Number(e.target.value))} placeholder="0" />
            </Field>
            <Field label="Kadaluarsa batch">
              <input type="date" className={inputCls} value={expiredDate} onChange={(e) => setExpiredDate(e.target.value)} />
            </Field>
          </div>
        )}

        <ErrorBox text={error} />
      </div>
      <FormActions onClose={onClose} submitLabel={isEdit ? 'Simpan perubahan' : 'Simpan barang'} onSubmit={submit} />
    </ModalShell>
  );
}

/* ---------- modal: tambah batch ---------- */

function BatchModal({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: (m: string) => void }) {
  const addBatch = useErpStore((s) => s.addBatch);
  const [qty, setQty] = useState(0);
  const [expiredDate, setExpiredDate] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const res = addBatch(product.id, qty, expiredDate);
    if (!res.ok) return setError(res.error);
    onDone(res.message);
  };

  return (
    <ModalShell title="Tambah stok / batch" subtitle={`${product.name} (${product.sku})`} onClose={onClose}>
      <div className="space-y-3">
        <Field label={`Jumlah masuk (${product.unit})`} hint={`Stok sekarang: ${getTotalStock(product)} ${product.unit}`}>
          <input type="number" className={inputCls} value={qty || ''} onChange={(e) => setQty(Number(e.target.value))} />
        </Field>
        <Field label="Tanggal kadaluarsa batch">
          <input type="date" className={inputCls} value={expiredDate} onChange={(e) => setExpiredDate(e.target.value)} />
        </Field>
        <ErrorBox text={error} />
      </div>
      <FormActions onClose={onClose} submitLabel="Tambah batch" onSubmit={submit} />
    </ModalShell>
  );
}

/* ---------- modal: stock opname ---------- */

const REASONS = [
  'Penyusutan wajar',
  'Barang rusak / pecah',
  'Barang kadaluarsa / basi',
  'Koreksi salah input',
  'Barang ditemukan',
];

function OpnameModal({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: (m: string) => void }) {
  const adjustStock = useErpStore((s) => s.adjustStock);
  const system = getTotalStock(product);
  const [actual, setActual] = useState(system);
  const [reason, setReason] = useState(REASONS[0]);
  const [error, setError] = useState('');

  const diff = actual - system;

  const submit = () => {
    const res = adjustStock(product.id, actual, reason);
    if (!res.ok) return setError(res.error);
    onDone(res.message);
  };

  return (
    <ModalShell title="Stock opname" subtitle={`${product.name} (${product.sku})`} onClose={onClose}>
      <div className="space-y-3">
        <Field label={`Stok fisik hasil hitung (${product.unit})`} hint={`Stok di sistem: ${system} ${product.unit}`}>
          <input type="number" className={`${inputCls} text-base font-bold`} value={actual} onChange={(e) => setActual(Number(e.target.value))} />
        </Field>
        <Field label="Alasan selisih">
          <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>

        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            diff === 0
              ? 'bg-[var(--color-canvas-sunk)] text-[var(--color-ink-soft)]'
              : diff < 0
              ? 'bg-[var(--color-rust-tint)] text-[var(--color-rust)]'
              : 'bg-[var(--color-pine-tint)] text-[var(--color-pine)]'
          }`}
        >
          {diff === 0 ? (
            'Tidak ada selisih.'
          ) : (
            <>
              Selisih{' '}
              <strong>
                {diff > 0 ? '+' : ''}
                {diff} {product.unit}
              </strong>{' '}
              · nilai jurnal <strong>{rp(Math.abs(diff) * product.price)}</strong>
              <p className="mt-1 text-[11px] opacity-80">
                {diff < 0 ? 'Stok dikurangi dari batch dengan tanggal kadaluarsa paling awal.' : 'Tambahan dimasukkan ke batch dengan kadaluarsa paling akhir.'}
              </p>
            </>
          )}
        </div>
        <ErrorBox text={error} />
      </div>
      <FormActions onClose={onClose} submitLabel="Simpan penyesuaian" onSubmit={submit} />
    </ModalShell>
  );
}

/* =========================================================================
   HALAMAN
   ========================================================================= */

export default function InventoryPage() {
  const hydrated = useHydrated();
  const products = useErpStore((s) => s.products);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState('');

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))), [products]);

  const isLow = (p: Product) => getTotalStock(p) <= p.minStock;
  const isRisk = (p: Product) =>
    p.batches.some((b) => {
      const s = getExpiryStatus(b.expiredDate);
      return s === 'expired' || s === 'kritis';
    });

  const stats = useMemo(
    () => ({
      sku: products.length,
      value: products.reduce((s, p) => s + getTotalStock(p) * p.cost, 0),
      low: products.filter(isLow).length,
      risk: products.filter(isRisk).length,
    }),
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => {
      const match = p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      const pass = filter === 'all' || (filter === 'low' && isLow(p)) || (filter === 'risk' && isRisk(p));
      return match && pass;
    });
  }, [products, search, filter]);

  const done = (message: string) => {
    setModal(null);
    setToast(message);
    setTimeout(() => setToast(''), 3500);
  };

  if (!hydrated) return <p className="text-sm text-[var(--color-ink-soft)]">Memuat data stok…</p>;

  return (
    <div className="relative z-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-xl font-semibold">Stok & Kontrol FEFO</h1>
          <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">Kelola barang, batch kadaluarsa, dan stock opname</p>
        </div>
        <button
          onClick={() => setModal({ type: 'product' })}
          className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-pine)] px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[var(--color-pine-light)]"
        >
          <Plus className="h-4 w-4" /> Tambah barang
        </button>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Jenis barang', value: String(stats.sku), tone: 'text-[var(--color-pine)]' },
          { label: 'Nilai stok (modal)', value: rp(stats.value), tone: 'text-[var(--color-pine)]' },
          { label: 'Stok menipis', value: String(stats.low), tone: stats.low ? 'text-[var(--color-gold)]' : 'text-[var(--color-ink)]' },
          { label: 'Barang berisiko kadaluarsa', value: String(stats.risk), tone: stats.risk ? 'text-[var(--color-rust)]' : 'text-[var(--color-ink)]' },
        ].map((c) => (
          <div key={c.label} className="glass-card-light rounded-2xl p-4">
            <p className="text-[11px] font-semibold text-[var(--color-ink-soft)]">{c.label}</p>
            <p className={`font-display mt-1 text-xl font-semibold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Pencarian & filter */}
      <div className="glass-card-light flex flex-col items-center justify-between gap-3 rounded-2xl p-4 sm:flex-row">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-[var(--color-ink-soft)]" />
          <input
            type="text"
            placeholder="Cari SKU, nama barang, kategori"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] py-2 pl-10 pr-4 text-xs focus:border-[var(--color-gold)] focus:outline-none"
          />
        </div>
        <div className="flex gap-2 text-xs font-semibold">
          {(
            [
              ['all', 'Semua'],
              ['low', `Menipis (${stats.low})`],
              ['risk', `Berisiko (${stats.risk})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full border px-3 py-1.5 transition-colors ${
                filter === key
                  ? 'border-[var(--color-pine)] bg-[var(--color-pine)] text-white'
                  : 'border-[var(--color-border)] text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas-sunk)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabel */}
      <div className="glass-card-light overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-canvas-sunk)] text-[var(--color-ink-soft)]">
              <tr>
                <th className="px-4 py-3.5 font-semibold">Barang</th>
                <th className="px-4 py-3.5 font-semibold">Kategori</th>
                <th className="px-4 py-3.5 font-semibold">Stok</th>
                <th className="px-4 py-3.5 font-semibold">Batch (urut FEFO)</th>
                <th className="px-4 py-3.5 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-[var(--color-ink-soft)]">
                    Tidak ada barang yang cocok dengan pencarian atau filter ini.
                  </td>
                </tr>
              )}
              {filtered.map((p) => {
                const total = getTotalStock(p);
                const low = total <= p.minStock;
                const batches = [...p.batches].sort((a, b) => a.expiredDate.localeCompare(b.expiredDate));
                return (
                  <tr key={p.id} className="align-top transition-colors hover:bg-[var(--color-canvas)]">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-[var(--color-pine-tint)] p-2 text-[var(--color-pine)]">
                          <Package className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold">{p.name}</p>
                          <p className="font-mono text-[10px] text-[var(--color-ink-soft)]">
                            {p.sku} · {rp(p.price)}/{p.unit}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-md bg-[var(--color-canvas-sunk)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-ink-soft)]">{p.category}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className={`text-sm font-bold ${low ? 'text-[var(--color-rust)]' : ''}`}>
                        {total} {p.unit}
                      </p>
                      {low && <span className="mt-1 inline-block rounded bg-[var(--color-rust-tint)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-rust)]">Menipis (min {p.minStock})</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-1.5">
                        {batches.length === 0 && <span className="text-[var(--color-ink-soft)]">Belum ada batch</span>}
                        {batches.map((b) => {
                          const status = getExpiryStatus(b.expiredDate);
                          const days = getDaysLeft(b.expiredDate);
                          return (
                            <div key={b.batchNo} className={`flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] ${batchStyle[status]}`}>
                              <Calendar className="h-3 w-3 shrink-0" />
                              <span className="font-mono font-bold">{b.batchNo}</span>
                              <span>
                                {b.qty} {p.unit}
                              </span>
                              <span className="ml-auto whitespace-nowrap font-semibold">
                                {b.expiredDate} · {status === 'expired' ? 'Kadaluarsa' : `${days} hari`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        <button
                          title="Tambah batch"
                          onClick={() => setModal({ type: 'batch', product: p })}
                          className="rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-ink-soft)] transition-colors hover:border-[var(--color-pine)] hover:bg-[var(--color-pine-tint)] hover:text-[var(--color-pine)]"
                        >
                          <PackagePlus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Stock opname"
                          onClick={() => setModal({ type: 'opname', product: p })}
                          className="rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-ink-soft)] transition-colors hover:border-[var(--color-gold)] hover:bg-[var(--color-gold-tint)] hover:text-[var(--color-gold)]"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Edit barang"
                          onClick={() => setModal({ type: 'product', product: p })}
                          className="rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-canvas-sunk)]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modal?.type === 'product' && (
          <ProductModal key={modal.product?.id ?? 'new'} product={modal.product} categories={categories} onClose={() => setModal(null)} onDone={done} />
        )}
        {modal?.type === 'batch' && <BatchModal key={modal.product.id} product={modal.product} onClose={() => setModal(null)} onDone={done} />}
        {modal?.type === 'opname' && <OpnameModal key={modal.product.id} product={modal.product} onClose={() => setModal(null)} onDone={done} />}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-xl bg-[var(--color-pine)] px-4 py-3 text-xs font-semibold text-white shadow-xl"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--color-gold-light)]" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}