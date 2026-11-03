'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  CalendarX,
  CheckCircle2,
  ChevronRight,
  Edit3,
  ImagePlus,
  LayoutGrid,
  List,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
  X,
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
import {
  compressToWebp,
  getProductImage,
  setProductImage,
  useProductImages,
  type CompressResult,
} from '@/stores/useProductImages';

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
type Sort = 'name' | 'stock' | 'expiry';
type View = 'table' | 'cards';

/* ---------- pembantu tampilan ---------- */

const EMOJI_RULES: [RegExp, string][] = [
  [/beras/, '🍚'], [/minyak/, '🫗'], [/gula/, '🍬'], [/telur|telor/, '🥚'], [/tepung|terigu/, '🌾'],
  [/mie|indomie|bihun/, '🍜'], [/kecap|saus|sambal/, '🌶️'], [/susu/, '🥛'], [/kopi/, '☕'], [/teh/, '🍵'],
  [/garam/, '🧂'], [/sabun|deterjen/, '🧼'], [/kaleng|sarden|kornet/, '🥫'], [/ayam|daging|ikan/, '🍗'],
];
const emojiFor = (name: string) => EMOJI_RULES.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? '📦';
const kb = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function Thumb({ p, src, size = 44, onZoom }: { p: Product; src?: string; size?: number; onZoom?: (src: string, name: string) => void }) {
  const style = { width: size, height: size };
  if (src) {
    return (
      <button
        type="button"
        onClick={() => onZoom?.(src, p.name)}
        style={style}
        className="group/img relative shrink-0 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm"
        aria-label={`Lihat gambar ${p.name}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={p.name} className="h-full w-full object-cover transition-transform duration-200 group-hover/img:scale-110" />
      </button>
    );
  }
  return (
    <div style={style} className="flex shrink-0 items-center justify-center rounded-xl bg-[var(--color-pine-tint)] text-xl">
      {emojiFor(p.name)}
    </div>
  );
}

function StockBar({ total, min, unit }: { total: number; min: number; unit: string }) {
  const low = total <= min;
  const pct = Math.min(100, Math.round((total / Math.max(min * 3, 1)) * 100));
  return (
    <div className="min-w-[110px]">
      <p className={`text-sm font-bold ${low ? 'text-[var(--color-rust)]' : ''}`}>
        {total} <span className="text-[11px] font-medium text-[var(--color-ink-soft)]">{unit}</span>
      </p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-canvas-sunk)]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${low ? 'bg-[var(--color-rust)]' : 'bg-[var(--color-pine)]'}`}
        />
      </div>
      {low && (
        <span className="mt-1 inline-block rounded bg-[var(--color-rust-tint)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-rust)]">
          Menipis (min {min})
        </span>
      )}
    </div>
  );
}

function BatchList({ p }: { p: Product }) {
  const batches = [...p.batches].sort((a, b) => a.expiredDate.localeCompare(b.expiredDate));
  return (
    <div className="space-y-1.5">
      {batches.length === 0 && <span className="text-xs text-[var(--color-ink-soft)]">Belum ada batch</span>}
      {batches.map((b) => {
        const status = getExpiryStatus(b.expiredDate);
        const days = getDaysLeft(b.expiredDate);
        return (
          <div key={b.batchNo} className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border px-2.5 py-1 text-[11px] ${batchStyle[status]}`}>
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
  );
}

function ActionButtons({ onBatch, onOpname, onEdit, labeled }: { onBatch: () => void; onOpname: () => void; onEdit: () => void; labeled?: boolean }) {
  const base = 'flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-soft)] transition-colors';
  const pad = labeled ? 'flex-1 px-2 py-2 text-xs font-semibold' : 'p-2';
  return (
    <div className={`flex gap-1.5 ${labeled ? 'w-full' : 'justify-end'}`}>
      <button title="Tambah batch" onClick={onBatch} className={`${base} ${pad} hover:border-[var(--color-pine)] hover:bg-[var(--color-pine-tint)] hover:text-[var(--color-pine)]`}>
        <PackagePlus className="h-3.5 w-3.5" /> {labeled && 'Batch'}
      </button>
      <button title="Stock opname" onClick={onOpname} className={`${base} ${pad} hover:border-[var(--color-gold)] hover:bg-[var(--color-gold-tint)] hover:text-[var(--color-gold)]`}>
        <Edit3 className="h-3.5 w-3.5" /> {labeled && 'Opname'}
      </button>
      <button title="Edit barang" onClick={onEdit} className={`${base} ${pad} hover:bg-[var(--color-canvas-sunk)]`}>
        <Pencil className="h-3.5 w-3.5" /> {labeled && 'Edit'}
      </button>
    </div>
  );
}

/* ---------- pemilih gambar (kompres ke WebP) ---------- */

function ImagePicker({
  value,
  info,
  onPick,
  onRemove,
}: {
  value: string | null;
  info: CompressResult | null;
  onPick: (r: CompressResult) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);

  const handle = async (file?: File | null) => {
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      onPick(await compressToWebp(file));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memproses gambar.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const saving = info && info.originalBytes > 0 ? Math.max(0, Math.round((1 - info.bytes / info.originalBytes) * 100)) : 0;

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[var(--color-ink-soft)]">Foto produk (opsional)</label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle(e.dataTransfer.files?.[0]);
        }}
        className={`flex items-center gap-4 rounded-2xl border-2 border-dashed p-3 transition-colors ${
          drag ? 'border-[var(--color-pine)] bg-[var(--color-pine-tint)]' : 'border-[var(--color-border-strong)] bg-[var(--color-canvas)]'
        }`}
      >
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Pratinjau" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-8 w-8 text-[var(--color-ink-soft)]/50" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="rounded-lg bg-[var(--color-pine)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--color-pine-light)] disabled:opacity-50"
            >
              {busy ? 'Memproses…' : value ? 'Ganti gambar' : 'Pilih / ambil foto'}
            </button>
            {value && (
              <button
                type="button"
                onClick={onRemove}
                className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-rust)] hover:bg-[var(--color-rust-tint)]"
              >
                <Trash2 className="h-3 w-3" /> Hapus
              </button>
            )}
          </div>
          <p className="text-[11px] leading-snug text-[var(--color-ink-soft)]">
            {info ? (
              <>
                {info.isWebp ? 'WebP' : 'Gambar'} · {kb(info.originalBytes)} → <strong className="text-[var(--color-pine)]">{kb(info.bytes)}</strong>
                {saving > 0 && ` (hemat ${saving}%)`}
              </>
            ) : (
              'Seret gambar ke sini atau pilih file. Otomatis dipotong persegi & dikompres ke WebP.'
            )}
          </p>
          {err && <p className="text-[11px] font-semibold text-[var(--color-rust)]">{err}</p>}
        </div>
      </div>
    </div>
  );
}

/* ---------- modal: tambah / edit barang ---------- */

function ProductModal({ product, categories, onClose, onDone }: { product?: Product; categories: string[]; onClose: () => void; onDone: (m: string) => void }) {
  const addProduct = useErpStore((s) => s.addProduct);
  const updateProduct = useErpStore((s) => s.updateProduct);
  const images = useProductImages();
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

  // Gambar: awalnya gambar yang sudah tersimpan (mode edit)
  const [image, setImage] = useState<string | null>(product ? getProductImage(images, product.sku) ?? null : null);
  const [imageInfo, setImageInfo] = useState<CompressResult | null>(null);
  const [imageChanged, setImageChanged] = useState(false);

  const submit = () => {
    const res = isEdit
      ? updateProduct(product!.id, { name, category: category.trim() || 'Lainnya', unit: unit.trim() || 'Pcs', price, cost, minStock })
      : addProduct({ sku, name, category, unit, price, cost, minStock, initialQty, expiredDate });
    if (!res.ok) return setError(res.error);

    let message = res.message;
    if (imageChanged) {
      const saved = setProductImage(isEdit ? product!.sku : sku, image);
      if (!saved) message += ' (Gambar gagal disimpan: penyimpanan browser penuh.)';
    }
    onDone(message);
  };

  return (
    <ModalShell title={isEdit ? 'Edit barang' : 'Tambah barang baru'} subtitle={isEdit ? product!.sku : 'Daftarkan barang, stok awal boleh dikosongkan'} onClose={onClose}>
      <div className="space-y-3">
        <ImagePicker
          value={image}
          info={imageInfo}
          onPick={(r) => {
            setImage(r.dataUrl);
            setImageInfo(r);
            setImageChanged(true);
          }}
          onRemove={() => {
            setImage(null);
            setImageInfo(null);
            setImageChanged(true);
          }}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <Field label="SKU">
              <input className={`${inputCls} font-mono uppercase`} value={sku} disabled={isEdit} onChange={(e) => setSku(e.target.value)} placeholder="BRS-002" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Nama barang">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Beras Pandan Wangi 5kg" />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <div className="grid grid-cols-1 gap-3 rounded-xl bg-[var(--color-canvas-sunk)] p-3 sm:grid-cols-2">
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

/* ---------- panel detail: stok menipis & berisiko kadaluarsa ---------- */

function DetailPanel({
  kind,
  items,
  images,
  onClose,
  onShowInTable,
  onBatch,
  onOpname,
  onZoom,
}: {
  kind: 'low' | 'risk';
  items: Product[];
  images: Record<string, string>;
  onClose: () => void;
  onShowInTable: () => void;
  onBatch: (p: Product) => void;
  onOpname: (p: Product) => void;
  onZoom: (src: string, name: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isLowKind = kind === 'low';
  const riskBatches = (p: Product) =>
    p.batches
      .filter((b) => {
        const st = getExpiryStatus(b.expiredDate);
        return st === 'expired' || st === 'kritis';
      })
      .sort((a, b) => a.expiredDate.localeCompare(b.expiredDate));

  // Ringkasan
  const lowNeed = (p: Product) => Math.max(p.minStock * 3 - getTotalStock(p), 0);
  const restockCost = items.reduce((s, p) => s + lowNeed(p) * p.cost, 0);
  const outCount = items.filter((p) => getTotalStock(p) <= 0).length;

  const allRisk = items.flatMap((p) => riskBatches(p).map((b) => ({ p, b })));
  const expiredCount = allRisk.filter(({ b }) => getExpiryStatus(b.expiredDate) === 'expired').length;
  const riskValue = allRisk.reduce((s, { p, b }) => s + b.qty * p.cost, 0);

  const sorted = [...items].sort((a, b) =>
    isLowKind
      ? getTotalStock(a) / Math.max(a.minStock, 1) - getTotalStock(b) / Math.max(b.minStock, 1)
      : (riskBatches(a)[0]?.expiredDate ?? '').localeCompare(riskBatches(b)[0]?.expiredDate ?? '')
  );

  const summary = isLowKind
    ? [
        { label: 'Barang menipis', value: String(items.length) },
        { label: 'Stok habis', value: String(outCount) },
        { label: 'Estimasi modal restock', value: rp(restockCost) },
      ]
    : [
        { label: 'Barang berisiko', value: String(items.length) },
        { label: 'Batch kadaluarsa', value: String(expiredCount) },
        { label: 'Modal tertahan', value: rp(riskValue) },
      ];

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
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl sm:rounded-3xl"
      >
        {/* Kepala */}
        <div className={`relative px-5 pb-4 pt-5 sm:px-6 ${isLowKind ? 'bg-[var(--color-gold-tint)]' : 'bg-[var(--color-rust-tint)]'}`}>
          <button
            aria-label="Tutup"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--color-ink-soft)] transition-colors hover:bg-white/60"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <span className={`rounded-xl bg-white/70 p-2.5 ${isLowKind ? 'text-[var(--color-gold)]' : 'text-[var(--color-rust)]'}`}>
              {isLowKind ? <AlertTriangle className="h-5 w-5" /> : <CalendarX className="h-5 w-5" />}
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold">{isLowKind ? 'Stok menipis' : 'Berisiko kadaluarsa'}</h3>
              <p className="text-xs text-[var(--color-ink-soft)]">
                {isLowKind ? 'Barang dengan stok di bawah atau sama dengan batas minimum' : 'Barang dengan batch kadaluarsa atau kurang dari 14 hari lagi'}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {summary.map((x) => (
              <div key={x.label} className="rounded-xl bg-white/70 px-3 py-2">
                <p className="truncate text-[10px] font-semibold text-[var(--color-ink-soft)]">{x.label}</p>
                <p className="font-display truncate text-sm font-semibold sm:text-base">{x.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Daftar */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-[var(--color-pine)]" />
              <p className="text-sm font-semibold">{isLowKind ? 'Semua stok aman' : 'Tidak ada batch berisiko'}</p>
              <p className="text-xs text-[var(--color-ink-soft)]">Tidak ada barang yang perlu ditindaklanjuti saat ini.</p>
            </div>
          ) : (
            sorted.map((p) => {
              const total = getTotalStock(p);
              const need = lowNeed(p);
              const rb = riskBatches(p);
              return (
                <div key={p.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-canvas)] p-3.5">
                  <div className="flex items-start gap-3">
                    <Thumb p={p} src={getProductImage(images, p.sku)} size={48} onZoom={onZoom} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug">{p.name}</p>
                      <p className="font-mono text-[10px] text-[var(--color-ink-soft)]">
                        {p.sku} · {p.category}
                      </p>
                    </div>
                    {isLowKind && (
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          total <= 0 ? 'bg-[var(--color-rust)] text-white' : 'bg-[var(--color-gold-tint)] text-[var(--color-gold)]'
                        }`}
                      >
                        {total <= 0 ? 'Habis' : 'Menipis'}
                      </span>
                    )}
                  </div>

                  {isLowKind ? (
                    <div className="mt-3 space-y-2">
                      <StockBar total={total} min={p.minStock} unit={p.unit} />
                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div className="rounded-lg bg-white px-2.5 py-1.5">
                          <p className="text-[var(--color-ink-soft)]">Stok / minimum</p>
                          <p className="font-bold">
                            {total} / {p.minStock} {p.unit}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white px-2.5 py-1.5">
                          <p className="text-[var(--color-ink-soft)]">Saran tambah</p>
                          <p className="font-bold text-[var(--color-pine)]">
                            {need} {p.unit}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white px-2.5 py-1.5">
                          <p className="text-[var(--color-ink-soft)]">Estimasi modal</p>
                          <p className="font-bold">{rp(need * p.cost)}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-[var(--color-ink-soft)]">Saran tambah = sampai stok mencapai 3× batas minimum.</p>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-1.5">
                      {rb.map((b) => {
                        const st = getExpiryStatus(b.expiredDate);
                        const days = getDaysLeft(b.expiredDate);
                        return (
                          <div key={b.batchNo} className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${batchStyle[st]}`}>
                            <div className="flex flex-wrap items-center gap-x-2">
                              <Calendar className="h-3 w-3 shrink-0" />
                              <span className="font-mono font-bold">{b.batchNo}</span>
                              <span>
                                {b.qty} {p.unit}
                              </span>
                              <span className="ml-auto whitespace-nowrap font-semibold">
                                {b.expiredDate} · {st === 'expired' ? `Lewat ${Math.abs(days)} hari` : `${days} hari lagi`}
                              </span>
                            </div>
                            <p className="mt-0.5 pl-5 opacity-80">Nilai modal {rp(b.qty * p.cost)}</p>
                          </div>
                        );
                      })}
                      <p className="text-[10px] text-[var(--color-ink-soft)]">
                        Batch yang belum lewat akan dijual lebih dulu oleh sistem (FEFO). Batch yang sudah lewat sebaiknya dikeluarkan lewat stock opname.
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    {isLowKind ? (
                      <button
                        onClick={() => onBatch(p)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-pine)] px-3 py-2 text-xs font-bold text-white hover:bg-[var(--color-pine-light)]"
                      >
                        <PackagePlus className="h-3.5 w-3.5" /> Tambah stok
                      </button>
                    ) : (
                      <button
                        onClick={() => onOpname(p)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-pine)] px-3 py-2 text-xs font-bold text-white hover:bg-[var(--color-pine-light)]"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Stock opname
                      </button>
                    )}
                    <button
                      onClick={() => (isLowKind ? onOpname(p) : onBatch(p))}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas-sunk)]"
                    >
                      {isLowKind ? (
                        <>
                          <Edit3 className="h-3.5 w-3.5" /> Opname
                        </>
                      ) : (
                        <>
                          <PackagePlus className="h-3.5 w-3.5" /> Tambah batch
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Kaki */}
        <div className="flex gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:px-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--color-border)] py-2.5 text-xs font-semibold text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas-sunk)]"
          >
            Tutup
          </button>
          {sorted.length > 0 && (
            <button
              onClick={onShowInTable}
              className="flex flex-[1.4] items-center justify-center gap-1.5 rounded-xl bg-[var(--color-pine)] py-2.5 text-xs font-bold text-white hover:bg-[var(--color-pine-light)]"
            >
              Tampilkan di daftar barang <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* =========================================================================
   HALAMAN
   ========================================================================= */

export default function InventoryPage() {
  const hydrated = useHydrated();
  const products = useErpStore((s) => s.products);
  const images = useProductImages();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState('Semua');
  const [sort, setSort] = useState<Sort>('name');
  const [view, setView] = useState<View>('table');
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState('');
  const [zoom, setZoom] = useState<{ src: string; name: string } | null>(null);
  const [detail, setDetail] = useState<'low' | 'risk' | null>(null);

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

  const lowList = useMemo(() => products.filter(isLow), [products]);
  const riskList = useMemo(() => products.filter(isRisk), [products]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const nearest = (p: Product) => p.batches.reduce((m, b) => (b.expiredDate < m ? b.expiredDate : m), '9999-12-31');
    return products
      .filter((p) => {
        const match = p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
        const pass = filter === 'all' || (filter === 'low' && isLow(p)) || (filter === 'risk' && isRisk(p));
        const cat = category === 'Semua' || p.category === category;
        return match && pass && cat;
      })
      .sort((a, b) =>
        sort === 'stock'
          ? getTotalStock(a) - getTotalStock(b)
          : sort === 'expiry'
          ? nearest(a).localeCompare(nearest(b))
          : a.name.localeCompare(b.name)
      );
  }, [products, search, filter, category, sort]);

  const done = (message: string) => {
    setModal(null);
    setToast(message);
    setTimeout(() => setToast(''), 3500);
  };

  const zoomIn = (src: string, name: string) => setZoom({ src, name });

  if (!hydrated) return <p className="text-sm text-[var(--color-ink-soft)]">Memuat data stok…</p>;

  const statCards = [
    { label: 'Jenis barang', value: String(stats.sku), icon: Package, tone: 'text-[var(--color-pine)]', bg: 'bg-[var(--color-pine-tint)]', detail: null as 'low' | 'risk' | null },
    { label: 'Nilai stok (modal)', value: rp(stats.value), icon: Wallet, tone: 'text-[var(--color-pine)]', bg: 'bg-[var(--color-pine-tint)]', detail: null as 'low' | 'risk' | null },
    { label: 'Stok menipis', value: String(stats.low), icon: AlertTriangle, tone: stats.low ? 'text-[var(--color-gold)]' : 'text-[var(--color-ink)]', bg: 'bg-[var(--color-gold-tint)]', detail: 'low' as 'low' | 'risk' | null },
    { label: 'Berisiko kadaluarsa', value: String(stats.risk), icon: CalendarX, tone: stats.risk ? 'text-[var(--color-rust)]' : 'text-[var(--color-ink)]', bg: 'bg-[var(--color-rust-tint)]', detail: 'risk' as 'low' | 'risk' | null },
  ];

  return (
    <div className="relative z-10 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-xl font-semibold sm:text-2xl">Stok & Kontrol FEFO</h1>
          <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">Kelola barang, batch kadaluarsa, dan stock opname</p>
        </div>
        <button
          onClick={() => setModal({ type: 'product' })}
          className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-pine)] px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-[var(--color-pine-light)] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" /> Tambah barang
        </button>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {statCards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            {...(c.detail
              ? {
                  role: 'button',
                  tabIndex: 0,
                  whileHover: { y: -3 },
                  whileTap: { scale: 0.98 },
                  onClick: () => setDetail(c.detail),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetail(c.detail);
                    }
                  },
                }
              : {})}
            className={`glass-card-light flex items-center justify-between gap-2 rounded-2xl p-4 ${
              c.detail ? 'cursor-pointer transition-shadow hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-gold)]' : ''
            }`}
          >
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-[var(--color-ink-soft)]">{c.label}</p>
              <p className={`font-display mt-1 truncate text-lg font-semibold sm:text-xl ${c.tone}`}>{c.value}</p>
              {c.detail && (
                <p className="mt-1 flex items-center gap-0.5 text-[10px] font-semibold text-[var(--color-ink-soft)]">
                  Lihat detail <ChevronRight className="h-3 w-3" />
                </p>
              )}
            </div>
            <span className={`hidden shrink-0 rounded-xl p-2.5 sm:block ${c.bg} ${c.tone}`}>
              <c.icon className="h-5 w-5" />
            </span>
          </motion.div>
        ))}
      </div>

      {/* Pencarian, filter, urutan & tampilan */}
      <div className="glass-card-light space-y-3 rounded-2xl p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-[var(--color-ink-soft)]" />
            <input
              type="text"
              placeholder="Cari SKU, nama barang, kategori"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] py-2 pl-10 pr-4 text-xs focus:border-[var(--color-gold)] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter kategori"
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2 text-xs font-semibold focus:border-[var(--color-gold)] focus:outline-none"
            >
              <option value="Semua">Semua kategori</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div className="relative">
              <ArrowUpDown className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--color-ink-soft)]" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                aria-label="Urutkan"
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] py-2 pl-8 pr-3 text-xs font-semibold focus:border-[var(--color-gold)] focus:outline-none"
              >
                <option value="name">Nama A–Z</option>
                <option value="stock">Stok tersedikit</option>
                <option value="expiry">Kadaluarsa terdekat</option>
              </select>
            </div>

            <div className="hidden rounded-xl bg-[var(--color-canvas-sunk)] p-1 md:flex">
              {(
                [
                  ['table', List, 'Tabel'],
                  ['cards', LayoutGrid, 'Kartu'],
                ] as const
              ).map(([key, Icon, label]) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  aria-label={`Tampilan ${label}`}
                  className={`rounded-lg p-1.5 transition-colors ${view === key ? 'bg-[var(--color-surface)] text-[var(--color-pine)] shadow-sm' : 'text-[var(--color-ink-soft)]'}`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 text-xs font-semibold">
          {(
            [
              ['all', `Semua (${stats.sku})`],
              ['low', `Menipis (${stats.low})`],
              ['risk', `Berisiko (${stats.risk})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 transition-colors ${
                filter === key
                  ? 'border-[var(--color-pine)] bg-[var(--color-pine)] text-white shadow-sm'
                  : 'border-[var(--color-border)] text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas-sunk)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="glass-card-light flex flex-col items-center gap-2 rounded-2xl py-16 text-center">
          <span className="text-4xl">📦</span>
          <p className="text-sm font-semibold">Barang tidak ditemukan</p>
          <p className="text-xs text-[var(--color-ink-soft)]">Coba ubah pencarian, kategori, atau filter.</p>
        </div>
      )}

      {/* Tabel (desktop) */}
      {filtered.length > 0 && (
        <div className={`glass-card-light overflow-hidden rounded-2xl ${view === 'table' ? 'hidden md:block' : 'hidden'}`}>
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
                {filtered.map((p) => (
                  <tr key={p.id} className="align-top transition-colors hover:bg-[var(--color-canvas)]">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <Thumb p={p} src={getProductImage(images, p.sku)} onZoom={zoomIn} />
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
                      <StockBar total={getTotalStock(p)} min={p.minStock} unit={p.unit} />
                    </td>
                    <td className="px-4 py-3.5">
                      <BatchList p={p} />
                    </td>
                    <td className="px-4 py-3.5">
                      <ActionButtons
                        onBatch={() => setModal({ type: 'batch', product: p })}
                        onOpname={() => setModal({ type: 'opname', product: p })}
                        onEdit={() => setModal({ type: 'product', product: p })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Kartu (ponsel / tablet, atau pilihan tampilan Kartu) */}
      {filtered.length > 0 && (
        <div className={`gap-4 ${view === 'cards' ? 'grid sm:grid-cols-2 xl:grid-cols-3' : 'grid sm:grid-cols-2 md:hidden'}`}>
          {filtered.map((p) => (
            <div key={p.id} className="glass-card-light flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Thumb p={p} src={getProductImage(images, p.sku)} size={64} onZoom={zoomIn} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</p>
                  <p className="font-mono text-[10px] text-[var(--color-ink-soft)]">{p.sku}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[var(--color-canvas-sunk)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink-soft)]">{p.category}</span>
                    <span className="font-display text-sm font-semibold text-[var(--color-pine)]">
                      {rp(p.price)}
                      <span className="text-[10px] font-normal text-[var(--color-ink-soft)]">/{p.unit}</span>
                    </span>
                  </div>
                </div>
              </div>
              <StockBar total={getTotalStock(p)} min={p.minStock} unit={p.unit} />
              <BatchList p={p} />
              <div className="mt-auto pt-1">
                <ActionButtons
                  labeled
                  onBatch={() => setModal({ type: 'batch', product: p })}
                  onOpname={() => setModal({ type: 'opname', product: p })}
                  onEdit={() => setModal({ type: 'product', product: p })}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modal?.type === 'product' && (
          <ProductModal key={modal.product?.id ?? 'new'} product={modal.product} categories={categories} onClose={() => setModal(null)} onDone={done} />
        )}
        {modal?.type === 'batch' && <BatchModal key={modal.product.id} product={modal.product} onClose={() => setModal(null)} onDone={done} />}
        {modal?.type === 'opname' && <OpnameModal key={modal.product.id} product={modal.product} onClose={() => setModal(null)} onDone={done} />}
      </AnimatePresence>

      {/* Detail stok menipis / berisiko */}
      <AnimatePresence>
        {detail && (
          <DetailPanel
            key={detail}
            kind={detail}
            items={detail === 'low' ? lowList : riskList}
            images={images}
            onClose={() => setDetail(null)}
            onShowInTable={() => {
              setFilter(detail);
              setSearch('');
              setCategory('Semua');
              setDetail(null);
            }}
            onBatch={(p) => {
              setDetail(null);
              setModal({ type: 'batch', product: p });
            }}
            onOpname={(p) => {
              setDetail(null);
              setModal({ type: 'opname', product: p });
            }}
            onZoom={zoomIn}
          />
        )}
      </AnimatePresence>

      {/* Pratinjau gambar */}
      <AnimatePresence>
        {zoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoom(null)}
            className="fixed inset-0 z-[60] flex cursor-zoom-out items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }} className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={zoom.src} alt={zoom.name} className="aspect-square w-full object-cover" />
              <p className="px-5 py-3 text-sm font-semibold">{zoom.name}</p>
              <button aria-label="Tutup" className="absolute right-3 top-3 rounded-full bg-black/50 p-1.5 text-white">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-4 z-50 flex max-w-sm items-start gap-3 rounded-xl bg-[var(--color-pine)] px-4 py-3 text-xs font-semibold text-white shadow-xl sm:right-6"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--color-gold-light)]" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}