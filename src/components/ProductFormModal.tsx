'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Calendar, Camera, ImagePlus, PackagePlus, ScanLine, Trash2 } from 'lucide-react';
import {
  useErpStore,
  getTotalStock,
  getDaysLeft,
  getExpiryStatus,
  type Product,
  type ExpiryStatus,
} from '@/stores/useErpStore';
import { ErrorBox, Field, FormActions, ModalShell, inputCls } from '@/components/ErpUi';
import {
  compressToWebp,
  getProductImage,
  setProductImage,
  useProductImages,
  type CompressResult,
} from '@/stores/useProductImages';
import {
  findSkuByBarcode,
  getBarcodeOf,
  normalizeBarcode,
  setProductBarcode,
  useProductBarcodes,
} from '@/stores/useProductBarcodes';
import BarcodeScanner from '@/components/BarcodeScanner';

/* ---------- pembantu yang juga dipakai halaman ---------- */

export const batchStyle: Record<ExpiryStatus, string> = {
  expired: 'bg-[var(--color-rust)] text-white border-transparent',
  kritis: 'bg-[var(--color-rust-tint)] text-[var(--color-rust)] border-[var(--color-rust)]/30',
  peringatan: 'bg-[var(--color-gold-tint)] text-[var(--color-gold)] border-[var(--color-gold)]/30',
  aman: 'bg-[var(--color-pine-tint)] text-[var(--color-pine)] border-[var(--color-pine)]/20',
};

const EMOJI_RULES: [RegExp, string][] = [
  [/beras/, '🍚'], [/minyak/, '🫗'], [/gula/, '🍬'], [/telur|telor/, '🥚'], [/tepung|terigu/, '🌾'],
  [/mie|indomie|bihun/, '🍜'], [/kecap|saus|sambal/, '🌶️'], [/susu/, '🥛'], [/kopi/, '☕'], [/teh/, '🍵'],
  [/garam/, '🧂'], [/sabun|deterjen/, '🧼'], [/kaleng|sarden|kornet/, '🥫'], [/ayam|daging|ikan/, '🍗'],
];
export const emojiFor = (name: string) => EMOJI_RULES.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? '📦';
export const kb = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

const formatRupiahInput = (value: string | number) => {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};
const parseRupiahInput = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthsFromNow = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return toISO(d);
};

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

/* ---------- modal: tambah / edit barang (dengan scan barcode) ---------- */

type Notice = { tone: 'ok' | 'info' | 'error'; text: string };

const noticeStyle: Record<Notice['tone'], string> = {
  ok: 'bg-[var(--color-pine-tint)] text-[var(--color-pine)]',
  info: 'bg-[var(--color-gold-tint)] text-[var(--color-gold)]',
  error: 'bg-[var(--color-rust-tint)] text-[var(--color-rust)]',
};

export function ProductModal({
  product,
  categories,
  autoScan,
  onClose,
  onDone,
}: {
  product?: Product;
  categories: string[];
  autoScan?: boolean;
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const products = useErpStore((s) => s.products);
  const addProduct = useErpStore((s) => s.addProduct);
  const updateProduct = useErpStore((s) => s.updateProduct);
  const addBatch = useErpStore((s) => s.addBatch);
  const images = useProductImages();
  const barcodes = useProductBarcodes();
  const isEdit = !!product;

  const [sku, setSku] = useState(product?.sku ?? '');
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [unit, setUnit] = useState(product?.unit ?? 'Pcs');
  const [priceInput, setPriceInput] = useState(formatRupiahInput(product?.price ?? ''));
  const [costInput, setCostInput] = useState(formatRupiahInput(product?.cost ?? ''));
  const [minStockInput, setMinStockInput] = useState(product ? String(product.minStock) : '');
  const [initialQtyInput, setInitialQtyInput] = useState('');
  const [expiredDate, setExpiredDate] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const fieldRefs = useRef<Array<HTMLInputElement | null>>([]);

  // --- barcode & mode restock ---
  const [code, setCode] = useState(product ? getBarcodeOf(barcodes, product.sku) : '');
  const [foundId, setFoundId] = useState<Product['id'] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showScanner, setShowScanner] = useState(!!autoScan && !isEdit);
  const [restockQty, setRestockQty] = useState('');
  const [restockExpiry, setRestockExpiry] = useState('');
  const [keepOpen, setKeepOpen] = useState(true);
  const [flash, setFlash] = useState('');
  const scanRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  // Ambil dari store agar stok ikut terbarui setelah batch ditambahkan.
  const found = foundId != null ? products.find((p) => p.id === foundId) ?? null : null;

  useEffect(() => {
    if (!isEdit && !autoScan) window.setTimeout(() => scanRef.current?.focus(), 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const price = parseRupiahInput(priceInput);
  const cost = parseRupiahInput(costInput);
  const minStock = minStockInput === '' ? 0 : Number(minStockInput);
  const initialQty = initialQtyInput === '' ? 0 : Number(initialQtyInput);

  const [image, setImage] = useState<string | null>(product ? getProductImage(images, product.sku) ?? null : null);
  const [imageInfo, setImageInfo] = useState<CompressResult | null>(null);
  const [imageChanged, setImageChanged] = useState(false);

  const clearFieldError = (key: string) => {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setError('');
  };

  const handleEnter = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const next = fieldRefs.current[index + 1];
    if (next) {
      next.focus();
      next.select?.();
    } else {
      submit();
    }
  };

  const inputClass = (key: string) =>
    `${inputCls} ${fieldErrors[key] ? '!border-[var(--color-rust)] !ring-1 !ring-[var(--color-rust)]/30 focus:!border-[var(--color-rust)]' : ''}`;

  const fieldMessage = (key: string) =>
    fieldErrors[key] ? (
      <p id={`${key}-error`} className="mt-1 text-[11px] font-semibold text-[var(--color-rust)]" role="alert">
        {fieldErrors[key]}
      </p>
    ) : null;

  /* ---------- logika scan ---------- */

  const resetScan = () => {
    setFoundId(null);
    setCode('');
    setNotice(null);
    setRestockQty('');
    setRestockExpiry('');
    window.setTimeout(() => scanRef.current?.focus(), 50);
  };

  const lookup = (raw: string) => {
    const c = normalizeBarcode(raw);
    if (!c) return;
    setShowScanner(false);
    setCode(c);
    setFlash('');
    clearFieldError('barcode');

    const mappedSku = findSkuByBarcode(barcodes, c);
    // Cocok lewat peta barcode, atau barcode yang sama dengan SKU.
    const hit = products.find((p) => (mappedSku && p.sku === mappedSku) || p.sku.toUpperCase() === c.toUpperCase());

    if (isEdit) {
      if (hit && hit.id !== product!.id) setNotice({ tone: 'error', text: `Barcode ini sudah dipakai "${hit.name}".` });
      else setNotice({ tone: 'ok', text: 'Barcode diterapkan. Klik Simpan perubahan untuk menyimpan.' });
      return;
    }

    if (hit) {
      setFoundId(hit.id);
      setRestockQty('');
      setRestockExpiry('');
      setNotice({ tone: 'ok', text: 'Barang sudah terdaftar. Isi jumlah masuk dan tanggal kadaluarsa batch baru.' });
      window.setTimeout(() => qtyRef.current?.focus(), 80);
      return;
    }

    setFoundId(null);
    if (!sku.trim()) setSku(c.toUpperCase()); // barcode jadi SKU awal, tetap bisa diubah
    setNotice({ tone: 'info', text: 'Barcode belum terdaftar. Lengkapi data barang baru di bawah.' });
    window.setTimeout(() => fieldRefs.current[1]?.focus(), 80);
  };

  const submitRestock = () => {
    if (!found) return;
    const qty = Number(restockQty);
    if (restockQty === '' || !Number.isInteger(qty) || qty <= 0) {
      return setNotice({ tone: 'error', text: 'Jumlah masuk harus bilangan bulat lebih dari 0.' });
    }
    const res = addBatch(found.id, qty, restockExpiry);
    if (!res.ok) return setNotice({ tone: 'error', text: res.error });

    const c = normalizeBarcode(code);
    if (c && findSkuByBarcode(barcodes, c) !== found.sku && c.toUpperCase() !== found.sku.toUpperCase()) {
      setProductBarcode(found.sku, c);
    }

    if (keepOpen) {
      setFlash(`${found.name}: ${res.message}`);
      resetScan();
    } else {
      onDone(res.message);
    }
  };

  /* ---------- simpan barang baru / edit ---------- */

  const submit = () => {
    setError('');
    const nextErrors: Record<string, string> = {};

    const c = normalizeBarcode(code);
    const owner = c ? findSkuByBarcode(barcodes, c) : undefined;
    if (owner && owner !== (product?.sku ?? '')) nextErrors.barcode = `Barcode sudah terdaftar pada SKU ${owner}. Tekan Enter di kolom barcode untuk memuat barangnya.`;

    if (!isEdit && !sku.trim()) nextErrors.sku = 'SKU wajib diisi.';
    if (!name.trim()) nextErrors.name = 'Nama barang wajib diisi.';
    if (!category.trim()) nextErrors.category = 'Kategori wajib diisi.';
    if (!unit.trim()) nextErrors.unit = 'Satuan wajib diisi.';
    if (!costInput.trim()) nextErrors.cost = 'Harga beli wajib diisi.';
    else if (!Number.isSafeInteger(cost) || cost <= 0) nextErrors.cost = 'Masukkan harga beli berupa angka lebih dari 0.';
    if (!priceInput.trim()) nextErrors.price = 'Harga jual wajib diisi.';
    else if (!Number.isSafeInteger(price) || price <= 0) nextErrors.price = 'Masukkan harga jual berupa angka lebih dari 0.';
    else if (Number.isSafeInteger(cost) && cost > 0 && price < cost) nextErrors.price = 'Harga jual tidak boleh lebih rendah dari harga beli.';
    if (minStockInput.trim() === '') nextErrors.minStock = 'Batas stok menipis wajib diisi.';
    else if (!Number.isInteger(minStock) || minStock < 0) nextErrors.minStock = 'Isi bilangan bulat minimal 0.';

    if (initialQtyInput !== '' && (!Number.isInteger(initialQty) || initialQty < 0)) {
      nextErrors.initialQty = 'Stok awal harus bilangan bulat minimal 0.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      if (nextErrors.barcode) {
        window.setTimeout(() => scanRef.current?.focus(), 0);
        return;
      }
      const order = isEdit
        ? ['name', 'category', 'unit', 'cost', 'price', 'minStock', 'initialQty']
        : ['sku', 'name', 'category', 'unit', 'cost', 'price', 'minStock', 'initialQty'];
      const firstInvalid = order.find((key) => nextErrors[key]);
      const indexByKey: Record<string, number> = {
        sku: 0, name: isEdit ? 0 : 1, category: isEdit ? 1 : 2, unit: isEdit ? 2 : 3,
        cost: isEdit ? 3 : 4, price: isEdit ? 4 : 5, minStock: isEdit ? 5 : 6,
        initialQty: isEdit ? -1 : 7,
      };
      const focusIndex = firstInvalid ? indexByKey[firstInvalid] : -1;
      if (focusIndex >= 0) window.setTimeout(() => fieldRefs.current[focusIndex]?.focus(), 0);
      return;
    }

    const cleanSku = sku.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanCategory = category.trim();
    const cleanUnit = unit.trim();

    const res = isEdit
      ? updateProduct(product!.id, { name: cleanName, category: cleanCategory, unit: cleanUnit, price, cost, minStock })
      : addProduct({ sku: cleanSku, name: cleanName, category: cleanCategory, unit: cleanUnit, price, cost, minStock, initialQty, expiredDate });

    if (!res.ok) {
      setError(res.error);
      if (!isEdit && /sku|kode barang/i.test(res.error)) window.setTimeout(() => fieldRefs.current[0]?.focus(), 0);
      return;
    }

    const finalSku = isEdit ? product!.sku : cleanSku;
    setProductBarcode(finalSku, c);

    let message = res.message;
    if (imageChanged) {
      const saved = setProductImage(finalSku, image);
      if (!saved) message += ' (Gambar gagal disimpan: penyimpanan browser penuh.)';
    }
    onDone(message);
  };

  /* ---------- tampilan ---------- */

  const restockMode = !isEdit && !!found;
  const foundBatches = found ? [...found.batches].sort((a, b) => a.expiredDate.localeCompare(b.expiredDate)) : [];
  const qtyAfter = found ? getTotalStock(found) + (Number(restockQty) || 0) : 0;

  return (
    <ModalShell
      title={isEdit ? 'Edit barang' : restockMode ? 'Tambah stok barang' : 'Tambah barang baru'}
      subtitle={isEdit ? product!.sku : restockMode ? 'Barang sudah terdaftar. Tambahkan batch baru.' : 'Scan barcode atau isi manual. Stok awal boleh dikosongkan'}
      onClose={onClose}
    >
      <div className="space-y-3">
        {/* Kolom barcode */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--color-ink-soft)]">{isEdit ? 'Barcode (opsional)' : 'Scan / ketik barcode'}</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-soft)]" />
              <input
                ref={scanRef}
                className={`${inputClass('barcode')} pl-9 font-mono`}
                value={code}
                maxLength={64}
                autoComplete="off"
                aria-invalid={!!fieldErrors.barcode}
                placeholder={isEdit ? 'Scan atau ketik barcode' : 'Arahkan scanner / ketik lalu Enter'}
                onChange={(e) => {
                  setCode(e.target.value);
                  clearFieldError('barcode');
                  if (!isEdit) {
                    setFoundId(null);
                    setNotice(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    lookup(code);
                  }
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--color-pine)] px-3.5 text-xs font-bold text-white hover:bg-[var(--color-pine-light)]"
            >
              <Camera className="h-4 w-4" /> <span className="hidden sm:inline">Kamera</span>
            </button>
          </div>
          {fieldMessage('barcode')}
          {!fieldErrors.barcode && (
            <p className="mt-1 text-[10px] text-[var(--color-ink-soft)]">
              Scanner USB/Bluetooth bisa langsung dipakai di kolom ini. Barang yang sudah pernah diinput akan otomatis muncul.
            </p>
          )}
        </div>

        {flash && (
          <div className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold ${noticeStyle.ok}`} role="status">
            ✓ {flash} — scan barang berikutnya.
          </div>
        )}
        {notice && <div className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold ${noticeStyle[notice.tone]}`}>{notice.text}</div>}

        {restockMode && found ? (
          /* ---------- MODE RESTOCK: barang sudah ada ---------- */
          <div className="space-y-3">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-canvas)] p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--color-pine-tint)] text-2xl">
                  {getProductImage(images, found.sku) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getProductImage(images, found.sku)} alt={found.name} className="h-full w-full object-cover" />
                  ) : (
                    emojiFor(found.name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug">{found.name}</p>
                  <p className="font-mono text-[10px] text-[var(--color-ink-soft)]">
                    {found.sku} · {found.category}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold text-[var(--color-ink-soft)]">Stok sekarang</p>
                  <p className="font-display text-lg font-semibold">
                    {getTotalStock(found)} <span className="text-[11px] font-medium text-[var(--color-ink-soft)]">{found.unit}</span>
                  </p>
                </div>
              </div>

              {foundBatches.length > 0 && (
                <div className="mt-3 space-y-1">
                  {foundBatches.map((b) => {
                    const st = getExpiryStatus(b.expiredDate);
                    const days = getDaysLeft(b.expiredDate);
                    return (
                      <div key={b.batchNo} className={`flex flex-wrap items-center gap-x-2 rounded-lg border px-2.5 py-1 text-[11px] ${batchStyle[st]}`}>
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span className="font-mono font-bold">{b.batchNo}</span>
                        <span>
                          {b.qty} {found.unit}
                        </span>
                        <span className="ml-auto whitespace-nowrap font-semibold">
                          {b.expiredDate} · {st === 'expired' ? 'Kadaluarsa' : `${days} hari`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={`Jumlah masuk (${found.unit}) *`} hint={Number(restockQty) > 0 ? `Stok menjadi ${qtyAfter} ${found.unit}` : 'Isi jumlah barang yang baru datang'}>
                <input
                  ref={qtyRef}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  className={inputCls}
                  value={restockQty}
                  placeholder="0"
                  onChange={(e) => setRestockQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitRestock();
                    }
                  }}
                />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[1, 6, 12, 24].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRestockQty(String((Number(restockQty) || 0) + n))}
                      className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas-sunk)]"
                    >
                      +{n}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Tanggal kadaluarsa batch" hint="Kosongkan bila tidak ada">
                <input type="date" className={inputCls} value={restockExpiry} onChange={(e) => setRestockExpiry(e.target.value)} />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[
                    ['+3 bln', 3],
                    ['+6 bln', 6],
                    ['+1 thn', 12],
                    ['+2 thn', 24],
                  ].map(([label, m]) => (
                    <button
                      key={label as string}
                      type="button"
                      onClick={() => setRestockExpiry(monthsFromNow(m as number))}
                      className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas-sunk)]"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-[var(--color-ink-soft)]">
                <input type="checkbox" checked={keepOpen} onChange={(e) => setKeepOpen(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--color-pine)]" />
                Tetap buka untuk scan barang berikutnya
              </label>
              <button type="button" onClick={resetScan} className="flex items-center gap-1 text-[11px] font-semibold text-[var(--color-rust)] hover:underline">
                <PackagePlus className="h-3 w-3" /> Bukan barang ini, scan ulang
              </button>
            </div>
          </div>
        ) : (
          /* ---------- FORM BARANG BARU / EDIT ---------- */
          <>
            <ImagePicker
              value={image}
              info={imageInfo}
              onPick={(r) => { setImage(r.dataUrl); setImageInfo(r); setImageChanged(true); }}
              onRemove={() => { setImage(null); setImageInfo(null); setImageChanged(true); }}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {!isEdit && (
                <div className="sm:col-span-1">
                  <Field label="SKU *">
                    <input ref={(el) => { fieldRefs.current[0] = el; }} className={inputClass('sku') + ' font-mono uppercase'} value={sku} maxLength={40} aria-invalid={!!fieldErrors.sku} aria-describedby={fieldErrors.sku ? 'sku-error' : undefined} onKeyDown={(e) => handleEnter(0, e)} onChange={(e) => { setSku(e.target.value.toUpperCase()); clearFieldError('sku'); }} placeholder="BRS-002" />
                    {fieldMessage('sku')}
                  </Field>
                </div>
              )}
              <div className={isEdit ? 'sm:col-span-3' : 'sm:col-span-2'}>
                <Field label="Nama barang *">
                  <input ref={(el) => { fieldRefs.current[isEdit ? 0 : 1] = el; }} className={inputClass('name')} value={name} maxLength={120} aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? 'name-error' : undefined} onKeyDown={(e) => handleEnter(isEdit ? 0 : 1, e)} onChange={(e) => { setName(e.target.value); clearFieldError('name'); }} placeholder="Beras Pandan Wangi 5kg" />
                  {fieldMessage('name')}
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Kategori *">
                <input ref={(el) => { fieldRefs.current[isEdit ? 1 : 2] = el; }} className={inputClass('category')} list="kategori-list" value={category} maxLength={60} aria-invalid={!!fieldErrors.category} aria-describedby={fieldErrors.category ? 'category-error' : undefined} onKeyDown={(e) => handleEnter(isEdit ? 1 : 2, e)} onChange={(e) => { setCategory(e.target.value); clearFieldError('category'); }} placeholder="Beras & Biji" />
                {fieldMessage('category')}
                <datalist id="kategori-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field label="Satuan *">
                <input ref={(el) => { fieldRefs.current[isEdit ? 2 : 3] = el; }} className={inputClass('unit')} value={unit} maxLength={20} aria-invalid={!!fieldErrors.unit} aria-describedby={fieldErrors.unit ? 'unit-error' : undefined} onKeyDown={(e) => handleEnter(isEdit ? 2 : 3, e)} onChange={(e) => { setUnit(e.target.value); clearFieldError('unit'); }} placeholder="Pcs / Kg / Dus" />
                {fieldMessage('unit')}
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Harga beli / modal (Rp) *" hint="Contoh: 15.000">
                <input ref={(el) => { fieldRefs.current[isEdit ? 3 : 4] = el; }} type="text" inputMode="numeric" autoComplete="off" className={inputClass('cost')} value={costInput} maxLength={18} aria-invalid={!!fieldErrors.cost} aria-describedby={fieldErrors.cost ? 'cost-error' : undefined} onKeyDown={(e) => handleEnter(isEdit ? 3 : 4, e)} onChange={(e) => { setCostInput(formatRupiahInput(e.target.value)); clearFieldError('cost'); }} placeholder="0" />
                {fieldMessage('cost')}
              </Field>
              <Field label="Harga jual (Rp) *" hint="Contoh: 18.000">
                <input ref={(el) => { fieldRefs.current[isEdit ? 4 : 5] = el; }} type="text" inputMode="numeric" autoComplete="off" className={inputClass('price')} value={priceInput} maxLength={18} aria-invalid={!!fieldErrors.price} aria-describedby={fieldErrors.price ? 'price-error' : undefined} onKeyDown={(e) => handleEnter(isEdit ? 4 : 5, e)} onChange={(e) => { setPriceInput(formatRupiahInput(e.target.value)); clearFieldError('price'); }} placeholder="0" />
                {fieldMessage('price')}
              </Field>
              <Field label="Batas stok menipis *" hint="Isi sendiri, misalnya 5 atau 10">
                <input ref={(el) => { fieldRefs.current[isEdit ? 5 : 6] = el; }} type="number" inputMode="numeric" min="0" step="1" className={inputClass('minStock')} value={minStockInput} aria-invalid={!!fieldErrors.minStock} aria-describedby={fieldErrors.minStock ? 'minStock-error' : undefined} onKeyDown={(e) => handleEnter(isEdit ? 5 : 6, e)} onChange={(e) => { setMinStockInput(e.target.value); clearFieldError('minStock'); }} placeholder="Masukkan batas stok" />
                {fieldMessage('minStock')}
              </Field>
            </div>

            {!isEdit && (
              <div className="grid grid-cols-1 gap-3 rounded-xl bg-[var(--color-canvas-sunk)] p-3 sm:grid-cols-2">
                <Field label="Stok awal" hint="Opsional; jika kosong dianggap 0">
                  <input ref={(el) => { fieldRefs.current[7] = el; }} type="number" inputMode="numeric" min="0" step="1" className={inputClass('initialQty')} value={initialQtyInput} aria-invalid={!!fieldErrors.initialQty} aria-describedby={fieldErrors.initialQty ? 'initialQty-error' : undefined} onKeyDown={(e) => handleEnter(7, e)} onChange={(e) => { setInitialQtyInput(e.target.value); clearFieldError('initialQty'); }} placeholder="Kosongkan jika belum ada stok" />
                  {fieldMessage('initialQty')}
                </Field>
                <Field label="Kadaluarsa batch" hint="Opsional">
                  <input ref={(el) => { fieldRefs.current[8] = el; }} type="date" className={inputCls} value={expiredDate} onKeyDown={(e) => handleEnter(8, e)} onChange={(e) => setExpiredDate(e.target.value)} />
                </Field>
              </div>
            )}

            <p className="text-[10px] text-[var(--color-ink-soft)]">* Wajib diisi. Barcode, foto produk, stok awal, dan tanggal kedaluwarsa bersifat opsional.</p>
          </>
        )}

        <ErrorBox text={error} />
      </div>

      <FormActions
        onClose={onClose}
        submitLabel={isEdit ? 'Simpan perubahan' : restockMode ? 'Tambah stok' : 'Simpan barang'}
        onSubmit={restockMode ? submitRestock : submit}
      />

      {showScanner && <BarcodeScanner onDetected={lookup} onClose={() => setShowScanner(false)} />}
    </ModalShell>
  );
}