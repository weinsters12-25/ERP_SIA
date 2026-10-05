'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Trash2,
  Truck,
  Wallet,
  XCircle,
} from 'lucide-react';
import {
  useErpStore,
  useHydrated,
  getDaysLeft,
  getPoRemaining,
  toDateStr,
  type PoLineInput,
  type PurchaseOrder,
} from '@/stores/useErpStore';
import { ErrorBox, Field, FormActions, ModalShell, inputCls, rp } from '@/components/ErpUi';

type Modal =
  | null
  | { type: 'create' }
  | { type: 'supplier' }
  | { type: 'receive'; po: PurchaseOrder }
  | { type: 'pay'; po: PurchaseOrder }
  | { type: 'detail'; po: PurchaseOrder };

type Filter = 'all' | 'pending' | 'unpaid' | 'paid';

const badge = 'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold';

function paymentLabel(po: PurchaseOrder): { text: string; cls: string } {
  if (po.status === 'CANCELLED') return { text: 'Dibatalkan', cls: 'bg-[var(--color-canvas-sunk)] text-[var(--color-ink-soft)]' };
  if (po.status === 'PENDING') return { text: 'Belum ada tagihan', cls: 'bg-[var(--color-canvas-sunk)] text-[var(--color-ink-soft)]' };
  const remaining = getPoRemaining(po);
  if (remaining === 0) return { text: 'Lunas', cls: 'bg-[var(--color-pine-tint)] text-[var(--color-pine)]' };
  const overdue = po.dueDate ? getDaysLeft(po.dueDate) < 0 : false;
  const prefix = po.paidAmount > 0 ? 'Dicicil · ' : '';
  return overdue
    ? { text: `${prefix}Terlambat (tempo ${po.dueDate})`, cls: 'bg-[var(--color-rust-tint)] text-[var(--color-rust)]' }
    : { text: `${prefix}Belum lunas (tempo ${po.dueDate})`, cls: 'bg-[var(--color-gold-tint)] text-[var(--color-gold)]' };
}

/* ---------- modal: supplier baru ---------- */

function SupplierModal({ onClose, onDone }: { onClose: () => void; onDone: (m: string) => void }) {
  const addSupplier = useErpStore((s) => s.addSupplier);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const res = addSupplier({ name, phone });
    if (!res.ok) return setError(res.error);
    onDone(res.message);
  };

  return (
    <ModalShell title="Tambah supplier" subtitle="Distributor atau pemasok barang dagangan" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Nama supplier">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="CV Sumber Pangan" />
        </Field>
        <Field label="No. telepon / WhatsApp">
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" />
        </Field>
        <ErrorBox text={error} />
      </div>
      <FormActions onClose={onClose} submitLabel="Simpan supplier" onSubmit={submit} />
    </ModalShell>
  );
}

/* ---------- modal: buat PO ---------- */

function CreatePoModal({ onClose, onDone, onAddSupplier }: { onClose: () => void; onDone: (m: string) => void; onAddSupplier: () => void }) {
  const suppliers = useErpStore((s) => s.suppliers);
  const products = useErpStore((s) => s.products);
  const createPO = useErpStore((s) => s.createPO);

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [term, setTerm] = useState<'CASH' | 'CREDIT'>('CREDIT');
  const [termDays, setTermDays] = useState(30);
  const [lines, setLines] = useState<PoLineInput[]>(
    products[0] ? [{ productId: products[0].id, qty: 10, unitCost: products[0].cost }] : []
  );
  const [error, setError] = useState('');

  const unused = products.filter((p) => !lines.some((l) => l.productId === p.id));
  const total = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);

  const setLine = (i: number, patch: Partial<PoLineInput>) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const changeProduct = (i: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (p) setLine(i, { productId, unitCost: p.cost });
  };

  const addLine = () => {
    const p = unused[0];
    if (p) setLines([...lines, { productId: p.id, qty: 10, unitCost: p.cost }]);
  };

  const submit = () => {
    const res = createPO(supplierId, lines, term, termDays);
    if (!res.ok) return setError(res.error);
    onDone(res.message);
  };

  return (
    <ModalShell wide title="Buat purchase order" subtitle="Pesan stok ke supplier. Stok baru bertambah saat barang diterima." onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <Field label="Supplier">
              <select className={inputCls} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <button onClick={onAddSupplier} className="mt-1 text-[11px] font-semibold text-[var(--color-pine)] hover:underline">
              + Supplier baru
            </button>
          </div>
          <Field label="Pembayaran">
            <select className={inputCls} value={term} onChange={(e) => setTerm(e.target.value as 'CASH' | 'CREDIT')}>
              <option value="CREDIT">Kredit (jadi utang)</option>
              <option value="CASH">Tunai (bayar saat terima)</option>
            </select>
          </Field>
          <Field label="Tempo">
            <select className={inputCls} value={termDays} disabled={term === 'CASH'} onChange={(e) => setTermDays(Number(e.target.value))}>
              <option value={7}>7 hari</option>
              <option value={14}>14 hari</option>
              <option value={30}>30 hari</option>
              <option value={45}>45 hari</option>
            </select>
          </Field>
        </div>

        <div className="rounded-xl border border-[var(--color-border)]">
          <div className="grid grid-cols-12 gap-2 border-b border-[var(--color-border)] bg-[var(--color-canvas-sunk)] px-3 py-2 text-[11px] font-semibold text-[var(--color-ink-soft)]">
            <span className="col-span-5">Barang</span>
            <span className="col-span-2">Jumlah</span>
            <span className="col-span-3">Harga beli</span>
            <span className="col-span-2 text-right">Subtotal</span>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {lines.map((l, i) => {
              const options = products.filter((p) => p.id === l.productId || !lines.some((x) => x.productId === p.id));
              const unit = products.find((p) => p.id === l.productId)?.unit;
              return (
                <div key={l.productId} className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                  <select className={`${inputCls} col-span-5`} value={l.productId} onChange={(e) => changeProduct(i, e.target.value)}>
                    {options.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <div className="col-span-2">
                    <input type="number" className={inputCls} value={l.qty || ''} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} />
                    <span className="text-[10px] text-[var(--color-ink-soft)]">{unit}</span>
                  </div>
                  <input type="number" className={`${inputCls} col-span-3`} value={l.unitCost || ''} onChange={(e) => setLine(i, { unitCost: Number(e.target.value) })} />
                  <div className="col-span-2 flex items-center justify-end gap-1.5">
                    <span className="text-xs font-semibold">{rp(l.qty * l.unitCost)}</span>
                    <button aria-label="Hapus baris" onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-rust)]">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-[var(--color-border)] px-3 py-2">
            <button
              onClick={addLine}
              disabled={unused.length === 0}
              className="flex items-center gap-1 text-xs font-semibold text-[var(--color-pine)] hover:underline disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Tambah barang
            </button>
            <p className="text-sm">
              Total <strong className="font-display text-base">{rp(total)}</strong>
            </p>
          </div>
        </div>

        <ErrorBox text={error} />
      </div>
      <FormActions onClose={onClose} submitLabel="Kirim PO" onSubmit={submit} />
    </ModalShell>
  );
}

/* ---------- modal: terima barang ---------- */

function ReceiveModal({ po, onClose, onDone }: { po: PurchaseOrder; onClose: () => void; onDone: (m: string) => void }) {
  const receivePO = useErpStore((s) => s.receivePO);
  const accounts = useErpStore((s) => s.accounts);
  const [expiries, setExpiries] = useState<Record<string, string>>({});
  const [accountId, setAccountId] = useState(accounts.find((a) => a.balance >= po.totalAmount)?.id ?? accounts[0]?.id ?? '');
  const [error, setError] = useState('');

  const submit = () => {
    const res = receivePO(po.id, expiries, po.paymentTerm === 'CASH' ? accountId : undefined);
    if (!res.ok) return setError(res.error);
    onDone(res.message);
  };

  return (
    <ModalShell title="Terima barang" subtitle={`${po.id} · ${po.supplierName}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-[var(--color-ink-soft)]">Isi tanggal kadaluarsa tiap barang. Setiap barang akan menjadi batch baru di stok.</p>
        {po.items.map((it) => (
          <div key={it.productId} className="grid grid-cols-5 items-end gap-3 rounded-xl bg-[var(--color-canvas-sunk)] p-3">
            <div className="col-span-3">
              <p className="text-xs font-semibold">{it.name}</p>
              <p className="text-[11px] text-[var(--color-ink-soft)]">
                {it.qty} {it.unit} × {rp(it.unitCost)}
              </p>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-[11px] font-semibold text-[var(--color-ink-soft)]">Kadaluarsa</label>
              <input
                type="date"
                className={inputCls}
                value={expiries[it.productId] ?? ''}
                onChange={(e) => setExpiries({ ...expiries, [it.productId]: e.target.value })}
              />
            </div>
          </div>
        ))}

        {po.paymentTerm === 'CASH' ? (
          <Field label="Bayar dari" hint={`Total ${rp(po.totalAmount)} akan langsung mengurangi saldo.`}>
            <select className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id} · {a.name} ({rp(a.balance)})
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <p className="rounded-xl bg-[var(--color-gold-tint)] px-3 py-2 text-xs text-[var(--color-gold)]">
            Pembelian kredit: utang <strong>{rp(po.totalAmount)}</strong> tercatat dengan tempo {po.termDays} hari sejak barang diterima.
          </p>
        )}
        <ErrorBox text={error} />
      </div>
      <FormActions onClose={onClose} submitLabel="Terima & tambah stok" onSubmit={submit} />
    </ModalShell>
  );
}

/* ---------- modal: bayar utang ---------- */

function PayModal({ po, onClose, onDone }: { po: PurchaseOrder; onClose: () => void; onDone: (m: string) => void }) {
  const payPO = useErpStore((s) => s.payPO);
  const accounts = useErpStore((s) => s.accounts);
  const remaining = getPoRemaining(po);
  const [amount, setAmount] = useState(remaining);
  const [accountId, setAccountId] = useState(accounts.find((a) => a.id === '103')?.id ?? accounts[0]?.id ?? '');
  const [error, setError] = useState('');

  const submit = () => {
    const res = payPO(po.id, amount, accountId);
    if (!res.ok) return setError(res.error);
    onDone(res.message);
  };

  return (
    <ModalShell title="Bayar utang supplier" subtitle={`${po.id} · ${po.supplierName}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Nominal pembayaran (Rp)" hint={`Sisa utang: ${rp(remaining)}. Boleh dicicil.`}>
          <input type="number" className={`${inputCls} text-base font-bold`} value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} />
        </Field>
        <Field label="Sumber dana">
          <select className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id} · {a.name} ({rp(a.balance)})
              </option>
            ))}
          </select>
        </Field>
        <ErrorBox text={error} />
      </div>
      <FormActions onClose={onClose} submitLabel="Catat pembayaran" onSubmit={submit} />
    </ModalShell>
  );
}

/* ---------- modal: detail PO ---------- */

function DetailModal({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const pay = paymentLabel(po);
  return (
    <ModalShell title={po.id} subtitle={po.supplierName} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[var(--color-ink-soft)]">Tanggal PO</p>
            <p className="font-semibold">{po.date}</p>
          </div>
          <div>
            <p className="text-[var(--color-ink-soft)]">Diterima</p>
            <p className="font-semibold">{po.receivedDate ?? '-'}</p>
          </div>
          <div>
            <p className="text-[var(--color-ink-soft)]">Pembayaran</p>
            <p className="font-semibold">{po.paymentTerm === 'CASH' ? 'Tunai' : `Kredit ${po.termDays} hari`}</p>
          </div>
          <div>
            <p className="text-[var(--color-ink-soft)]">Status utang</p>
            <span className={`${badge} ${pay.cls}`}>{pay.text}</span>
          </div>
        </div>

        <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
          {po.items.map((it) => (
            <div key={it.productId} className="flex items-center justify-between px-3 py-2">
              <div>
                <p className="font-semibold">{it.name}</p>
                <p className="text-[11px] text-[var(--color-ink-soft)]">
                  {it.qty} {it.unit} × {rp(it.unitCost)}
                </p>
              </div>
              <span className="font-semibold">{rp(it.qty * it.unitCost)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between bg-[var(--color-canvas-sunk)] px-3 py-2">
            <span className="font-semibold">Total</span>
            <span className="font-display text-base font-semibold">{rp(po.totalAmount)}</span>
          </div>
        </div>

        <div className="flex justify-between text-[var(--color-ink-soft)]">
          <span>Sudah dibayar: {rp(po.paidAmount)}</span>
          <span>Sisa: {rp(getPoRemaining(po))}</span>
        </div>
      </div>
      <button onClick={onClose} className="w-full rounded-xl border border-[var(--color-border)] py-2.5 text-sm font-semibold hover:bg-[var(--color-canvas-sunk)]">
        Tutup
      </button>
    </ModalShell>
  );
}

/* =========================================================================
   HALAMAN
   ========================================================================= */

export default function PurchasingPage() {
  const hydrated = useHydrated();
  const orders = useErpStore((s) => s.purchaseOrders);
  const journals = useErpStore((s) => s.journals);
  const cancelPO = useErpStore((s) => s.cancelPO);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState('');

  const stats = useMemo(() => {
    const open = orders.filter((o) => getPoRemaining(o) > 0);
    const soon = open.filter((o) => o.dueDate && getDaysLeft(o.dueDate) <= 7);
    const month = toDateStr(new Date()).slice(0, 7);
    const paid = journals
      .filter(
        (j) =>
          j.date.startsWith(month) &&
          (j.type === 'PAYABLE' || (j.type === 'PURCHASE' && !j.creditAccount.startsWith('201')))
      )
      .reduce((s, j) => s + j.amount, 0);
    return {
      ap: open.reduce((s, o) => s + getPoRemaining(o), 0),
      apSuppliers: new Set(open.map((o) => o.supplierId)).size,
      soonAmount: soon.reduce((s, o) => s + getPoRemaining(o), 0),
      soonCount: soon.length,
      paid,
    };
  }, [orders, journals]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      const match = o.id.toLowerCase().includes(q) || o.supplierName.toLowerCase().includes(q);
      const pass =
        filter === 'all' ||
        (filter === 'pending' && o.status === 'PENDING') ||
        (filter === 'unpaid' && getPoRemaining(o) > 0) ||
        (filter === 'paid' && o.status === 'RECEIVED' && getPoRemaining(o) === 0);
      return match && pass;
    });
  }, [orders, search, filter]);

  const done = (message: string) => {
    setModal(null);
    setToast(message);
    setTimeout(() => setToast(''), 4000);
  };

  const handleCancel = (po: PurchaseOrder) => {
    if (!window.confirm(`Batalkan ${po.id}? PO yang dibatalkan tidak bisa diaktifkan lagi.`)) return;
    const res = cancelPO(po.id);
    done(res.ok ? res.message : res.error);
  };

  if (!hydrated) return <p className="text-sm text-[var(--color-ink-soft)]">Memuat data pembelian…</p>;

  return (
    <div className="relative z-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-xl font-semibold">Pengeluaran & Pembelian (PO)</h1>
          <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">Purchase order, penerimaan barang, dan utang supplier (AP)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModal({ type: 'supplier' })}
            className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-xs font-bold hover:bg-[var(--color-canvas-sunk)]"
          >
            <Building2 className="h-4 w-4" /> Supplier baru
          </button>
          <button
            onClick={() => setModal({ type: 'create' })}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-pine)] px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[var(--color-pine-light)]"
          >
            <Plus className="h-4 w-4" /> Buat PO
          </button>
        </div>
      </div>

      {/* Ringkasan AP */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="glass-card-light rounded-2xl border-l-4 border-l-[var(--color-gold)] p-5">
          <p className="text-xs font-semibold text-[var(--color-ink-soft)]">Total utang usaha (AP)</p>
          <p className="font-display mt-1 text-2xl font-semibold text-[var(--color-gold)]">{rp(stats.ap)}</p>
          <p className="mt-1 text-[11px] text-[var(--color-ink-soft)]">{stats.apSuppliers} supplier belum lunas</p>
        </div>
        <div className="glass-card-light rounded-2xl border-l-4 border-l-[var(--color-rust)] p-5">
          <p className="text-xs font-semibold text-[var(--color-ink-soft)]">Jatuh tempo ≤ 7 hari / terlambat</p>
          <p className="font-display mt-1 text-2xl font-semibold text-[var(--color-rust)]">{rp(stats.soonAmount)}</p>
          <p className="mt-1 text-[11px] text-[var(--color-ink-soft)]">{stats.soonCount} nota perlu dibayar segera</p>
        </div>
        <div className="glass-card-light rounded-2xl border-l-4 border-l-[var(--color-pine)] p-5">
          <p className="text-xs font-semibold text-[var(--color-ink-soft)]">Terbayar bulan ini</p>
          <p className="font-display mt-1 text-2xl font-semibold text-[var(--color-pine)]">{rp(stats.paid)}</p>
          <p className="mt-1 text-[11px] text-[var(--color-ink-soft)]">Pelunasan utang dan pembelian tunai</p>
        </div>
      </div>

      {/* Cari & filter */}
      <div className="glass-card-light flex flex-col items-center justify-between gap-3 rounded-2xl p-4 sm:flex-row">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-[var(--color-ink-soft)]" />
          <input
            type="text"
            placeholder="Cari nomor PO atau supplier"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] py-2 pl-10 pr-4 text-xs focus:border-[var(--color-gold)] focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          {(
            [
              ['all', 'Semua'],
              ['pending', 'Menunggu barang'],
              ['unpaid', 'Belum lunas'],
              ['paid', 'Lunas'],
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

      {/* Tabel PO */}
      <div className="glass-card-light overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-canvas-sunk)] text-[var(--color-ink-soft)]">
              <tr>
                <th className="px-4 py-3.5 font-semibold">PO</th>
                <th className="px-4 py-3.5 font-semibold">Supplier</th>
                <th className="px-4 py-3.5 font-semibold">Nominal</th>
                <th className="px-4 py-3.5 font-semibold">Barang</th>
                <th className="px-4 py-3.5 font-semibold">Utang</th>
                <th className="px-4 py-3.5 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-[var(--color-ink-soft)]">
                    Belum ada PO yang cocok. Klik “Buat PO” untuk memesan barang.
                  </td>
                </tr>
              )}
              {filtered.map((po) => {
                const pay = paymentLabel(po);
                const remaining = getPoRemaining(po);
                return (
                  <tr key={po.id} className="transition-colors hover:bg-[var(--color-canvas)]">
                    <td className="px-4 py-3.5">
                      <p className="font-mono font-bold">{po.id}</p>
                      <span className="text-[11px] text-[var(--color-ink-soft)]">{po.date}</span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold">{po.supplierName}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-bold">{rp(po.totalAmount)}</p>
                      <span className="text-[11px] text-[var(--color-ink-soft)]">{po.items.length} jenis barang</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {po.status === 'RECEIVED' && (
                        <span className={`${badge} bg-[var(--color-pine-tint)] text-[var(--color-pine)]`}>
                          <CheckCircle2 className="h-3 w-3" /> Diterima
                        </span>
                      )}
                      {po.status === 'PENDING' && (
                        <span className={`${badge} bg-[var(--color-gold-tint)] text-[var(--color-gold)]`}>
                          <Clock className="h-3 w-3" /> Menunggu barang
                        </span>
                      )}
                      {po.status === 'CANCELLED' && (
                        <span className={`${badge} bg-[var(--color-canvas-sunk)] text-[var(--color-ink-soft)]`}>
                          <XCircle className="h-3 w-3" /> Dibatalkan
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`${badge} ${pay.cls}`}>{pay.text}</span>
                      {remaining > 0 && <p className="mt-1 text-[11px] text-[var(--color-ink-soft)]">Sisa {rp(remaining)}</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {po.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => setModal({ type: 'receive', po })}
                              className="flex items-center gap-1 rounded-lg bg-[var(--color-pine)] px-2.5 py-1.5 font-bold text-white hover:bg-[var(--color-pine-light)]"
                            >
                              <Truck className="h-3.5 w-3.5" /> Terima
                            </button>
                            <button
                              onClick={() => handleCancel(po)}
                              className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 font-semibold text-[var(--color-rust)] hover:bg-[var(--color-rust-tint)]"
                            >
                              Batal
                            </button>
                          </>
                        )}
                        {remaining > 0 && (
                          <button
                            onClick={() => setModal({ type: 'pay', po })}
                            className="flex items-center gap-1 rounded-lg bg-[var(--color-gold)] px-2.5 py-1.5 font-bold text-white hover:opacity-90"
                          >
                            <Wallet className="h-3.5 w-3.5" /> Bayar
                          </button>
                        )}
                        <button
                          onClick={() => setModal({ type: 'detail', po })}
                          className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 font-semibold hover:bg-[var(--color-canvas-sunk)]"
                        >
                          Detail
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
        {modal?.type === 'create' && <CreatePoModal onClose={() => setModal(null)} onDone={done} onAddSupplier={() => setModal({ type: 'supplier' })} />}
        {modal?.type === 'supplier' && <SupplierModal onClose={() => setModal(null)} onDone={done} />}
        {modal?.type === 'receive' && <ReceiveModal key={modal.po.id} po={modal.po} onClose={() => setModal(null)} onDone={done} />}
        {modal?.type === 'pay' && <PayModal key={modal.po.id} po={modal.po} onClose={() => setModal(null)} onDone={done} />}
        {modal?.type === 'detail' && <DetailModal key={modal.po.id} po={modal.po} onClose={() => setModal(null)} />}
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