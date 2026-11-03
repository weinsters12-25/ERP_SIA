'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Banknote,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  Plus,
  Search,
  Trash2,
  Truck,
  Wallet,
  XCircle,
  AlertTriangle,
  ReceiptText,
} from 'lucide-react';
import {
  useErpStore,
  useHydrated,
  getDaysLeft,
  getPoRemaining,
  getTotalStock,
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

const matchFilter = (o: PurchaseOrder, f: Filter) =>
  f === 'all' ||
  (f === 'pending' && o.status === 'PENDING') ||
  (f === 'unpaid' && getPoRemaining(o) > 0) ||
  (f === 'paid' && o.status === 'RECEIVED' && getPoRemaining(o) === 0);

/* ---------- potongan tampilan bersama ---------- */

function StatusBadge({ po }: { po: PurchaseOrder }) {
  if (po.status === 'RECEIVED')
    return (
      <span className={`${badge} bg-[var(--color-pine-tint)] text-[var(--color-pine)]`}>
        <CheckCircle2 className="h-3 w-3" /> Diterima
      </span>
    );
  if (po.status === 'PENDING')
    return (
      <span className={`${badge} bg-[var(--color-gold-tint)] text-[var(--color-gold)]`}>
        <Clock className="h-3 w-3" /> Menunggu barang
      </span>
    );
  return (
    <span className={`${badge} bg-[var(--color-canvas-sunk)] text-[var(--color-ink-soft)]`}>
      <XCircle className="h-3 w-3" /> Dibatalkan
    </span>
  );
}

function PaidBar({ po }: { po: PurchaseOrder }) {
  if (po.status !== 'RECEIVED' || po.totalAmount <= 0) return null;
  const pct = Math.min(100, Math.round((po.paidAmount / po.totalAmount) * 100));
  const overdue = getPoRemaining(po) > 0 && po.dueDate ? getDaysLeft(po.dueDate) < 0 : false;
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

function PoActions({
  po,
  onReceive,
  onCancel,
  onPay,
  onDetail,
  labeled,
}: {
  po: PurchaseOrder;
  onReceive: () => void;
  onCancel: () => void;
  onPay: () => void;
  onDetail: () => void;
  labeled?: boolean;
}) {
  const remaining = getPoRemaining(po);
  const grow = labeled ? 'flex-1 justify-center' : '';
  return (
    <div className={`flex flex-wrap gap-1.5 ${labeled ? 'w-full' : 'justify-end'}`}>
      {po.status === 'PENDING' && (
        <>
          <button onClick={onReceive} className={`flex items-center gap-1 rounded-lg bg-[var(--color-pine)] px-3 py-2 text-xs font-bold text-white hover:bg-[var(--color-pine-light)] ${grow}`}>
            <Truck className="h-3.5 w-3.5" /> Terima
          </button>
          <button onClick={onCancel} className={`flex items-center rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-rust)] hover:bg-[var(--color-rust-tint)] ${grow}`}>
            Batal
          </button>
        </>
      )}
      {remaining > 0 && (
        <button onClick={onPay} className={`flex items-center gap-1 rounded-lg bg-[var(--color-gold)] px-3 py-2 text-xs font-bold text-white hover:opacity-90 ${grow}`}>
          <Wallet className="h-3.5 w-3.5" /> Bayar
        </button>
      )}
      <button onClick={onDetail} className={`flex items-center rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--color-canvas-sunk)] ${grow}`}>
        Detail
      </button>
    </div>
  );
}

const Avatar = ({ name }: { name: string }) => (
  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-pine-tint)] font-display text-base font-bold text-[var(--color-pine)]">
    {name.trim().charAt(0).toUpperCase() || '?'}
  </span>
);

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
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);

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

  const lbl = 'mb-1 block text-[11px] font-semibold text-[var(--color-ink-soft)] sm:hidden';

  return (
    <ModalShell wide title="Buat purchase order" subtitle="Pesan stok ke supplier. Stok baru bertambah saat barang diterima." onClose={onClose}>
      <div className="space-y-4">
        {/* Langkah 1: supplier & pembayaran */}
        <div className="rounded-2xl bg-[var(--color-canvas-sunk)] p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
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

            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-ink-soft)]">Pembayaran</label>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--color-surface)] p-1 text-xs font-semibold">
                {(
                  [
                    ['CREDIT', 'Kredit (utang)', CreditCard],
                    ['CASH', 'Tunai', Banknote],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTerm(key)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
                      term === key ? 'bg-[var(--color-pine)] text-white shadow-sm' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas-sunk)]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
              <div className={`mt-2 flex items-center gap-1.5 transition-opacity ${term === 'CASH' ? 'pointer-events-none opacity-40' : ''}`}>
                <CalendarClock className="h-3.5 w-3.5 shrink-0 text-[var(--color-ink-soft)]" />
                <span className="mr-1 text-[11px] font-semibold text-[var(--color-ink-soft)]">Tempo</span>
                {[7, 14, 30, 45].map((d) => (
                  <button
                    key={d}
                    type="button"
                    disabled={term === 'CASH'}
                    onClick={() => setTermDays(d)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      termDays === d
                        ? 'border-[var(--color-pine)] bg-[var(--color-pine-tint)] text-[var(--color-pine)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)]'
                    }`}
                  >
                    {d}h
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Langkah 2: barang */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--color-ink-soft)]">Barang yang dipesan</p>
            <button
              onClick={addLine}
              disabled={unused.length === 0}
              className="flex items-center gap-1 rounded-lg bg-[var(--color-pine-tint)] px-2.5 py-1.5 text-xs font-bold text-[var(--color-pine)] hover:bg-[var(--color-pine)] hover:text-white disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Tambah barang
            </button>
          </div>

          <div className="hidden grid-cols-12 gap-2 px-3 pb-1 text-[11px] font-semibold text-[var(--color-ink-soft)] sm:grid">
            <span className="col-span-5">Barang</span>
            <span className="col-span-2">Jumlah</span>
            <span className="col-span-3">Harga beli</span>
            <span className="col-span-2 text-right">Subtotal</span>
          </div>

          <div className="max-h-[38vh] space-y-2 overflow-y-auto pr-0.5">
            <AnimatePresence initial={false}>
              {lines.map((l, i) => {
                const options = products.filter((p) => p.id === l.productId || !lines.some((x) => x.productId === p.id));
                const prod = products.find((p) => p.id === l.productId);
                return (
                  <motion.div
                    key={l.productId}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-2 items-start gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] p-3 sm:grid-cols-12"
                  >
                    <div className="col-span-2 sm:col-span-5">
                      <label className={lbl}>Barang</label>
                      <select className={inputCls} value={l.productId} onChange={(e) => changeProduct(i, e.target.value)}>
                        {options.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      {prod && (
                        <span className="mt-1 inline-block text-[10px] text-[var(--color-ink-soft)]">
                          Stok saat ini: {getTotalStock(prod)} {prod.unit}
                        </span>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className={lbl}>Jumlah{prod ? ` (${prod.unit})` : ''}</label>
                      <input type="number" className={inputCls} value={l.qty || ''} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} />
                      {prod && <span className="mt-1 hidden text-[10px] text-[var(--color-ink-soft)] sm:inline-block">{prod.unit}</span>}
                    </div>
                    <div className="sm:col-span-3">
                      <label className={lbl}>Harga beli (Rp)</label>
                      <input type="number" className={inputCls} value={l.unitCost || ''} onChange={(e) => setLine(i, { unitCost: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-2 flex items-center justify-between gap-1.5 border-t border-dashed border-[var(--color-border)] pt-2 sm:col-span-2 sm:justify-end sm:border-0 sm:pt-2.5">
                      <span className="text-[11px] text-[var(--color-ink-soft)] sm:hidden">Subtotal</span>
                      <span className="text-xs font-bold">{rp(l.qty * l.unitCost)}</span>
                      <button
                        aria-label="Hapus baris"
                        onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                        className="rounded-md p-1 text-[var(--color-ink-soft)] hover:bg-[var(--color-rust-tint)] hover:text-[var(--color-rust)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {lines.length === 0 && (
              <p className="rounded-xl border border-dashed border-[var(--color-border-strong)] py-8 text-center text-xs text-[var(--color-ink-soft)]">
                Belum ada barang. Klik “Tambah barang”.
              </p>
            )}
          </div>
        </div>

        {/* Ringkasan */}
        <div className="flex items-center justify-between rounded-2xl bg-[var(--color-pine)] px-4 py-3 text-white">
          <div className="text-xs text-white/70">
            <p>
              {lines.length} jenis · {totalQty} unit
            </p>
            <p>{term === 'CASH' ? 'Dibayar tunai saat barang diterima' : `Tempo ${termDays} hari sejak barang diterima`}</p>
          </div>
          <motion.p key={total} initial={{ scale: 1.06 }} animate={{ scale: 1 }} className="font-display text-xl font-semibold sm:text-2xl">
            {rp(total)}
          </motion.p>
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
          <div key={it.productId} className="grid grid-cols-1 items-end gap-3 rounded-xl bg-[var(--color-canvas-sunk)] p-3 sm:grid-cols-5">
            <div className="sm:col-span-3">
              <p className="text-xs font-semibold">{it.name}</p>
              <p className="text-[11px] text-[var(--color-ink-soft)]">
                {it.qty} {it.unit} × {rp(it.unitCost)}
              </p>
            </div>
            <div className="sm:col-span-2">
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
        <div className="flex flex-wrap gap-2">
          {[
            ['Lunasi', remaining],
            ['50%', Math.round(remaining / 2)],
          ].map(([label, v]) => (
            <button
              key={label as string}
              type="button"
              onClick={() => setAmount(v as number)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                amount === v
                  ? 'border-[var(--color-pine)] bg-[var(--color-pine-tint)] text-[var(--color-pine)]'
                  : 'border-[var(--color-border)] text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas-sunk)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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
            <div key={it.productId} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="font-semibold">{it.name}</p>
                <p className="text-[11px] text-[var(--color-ink-soft)]">
                  {it.qty} {it.unit} × {rp(it.unitCost)}
                </p>
              </div>
              <span className="shrink-0 font-semibold">{rp(it.qty * it.unitCost)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between bg-[var(--color-canvas-sunk)] px-3 py-2">
            <span className="font-semibold">Total</span>
            <span className="font-display text-base font-semibold">{rp(po.totalAmount)}</span>
          </div>
        </div>

        <PaidBar po={po} />
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

  const counts = useMemo(
    () => ({
      all: orders.length,
      pending: orders.filter((o) => matchFilter(o, 'pending')).length,
      unpaid: orders.filter((o) => matchFilter(o, 'unpaid')).length,
      paid: orders.filter((o) => matchFilter(o, 'paid')).length,
    }),
    [orders]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      const match = o.id.toLowerCase().includes(q) || o.supplierName.toLowerCase().includes(q);
      return match && matchFilter(o, filter);
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

  const summary = [
    {
      label: 'Total utang usaha (AP)',
      value: rp(stats.ap),
      note: `${stats.apSuppliers} supplier belum lunas`,
      icon: ReceiptText,
      border: 'border-l-[var(--color-gold)]',
      tone: 'text-[var(--color-gold)]',
      bg: 'bg-[var(--color-gold-tint)]',
      go: 'unpaid' as Filter,
    },
    {
      label: 'Jatuh tempo ≤ 7 hari / terlambat',
      value: rp(stats.soonAmount),
      note: `${stats.soonCount} nota perlu dibayar segera`,
      icon: AlertTriangle,
      border: 'border-l-[var(--color-rust)]',
      tone: 'text-[var(--color-rust)]',
      bg: 'bg-[var(--color-rust-tint)]',
      go: 'unpaid' as Filter,
    },
    {
      label: 'Terbayar bulan ini',
      value: rp(stats.paid),
      note: 'Pelunasan utang dan pembelian tunai',
      icon: CheckCircle2,
      border: 'border-l-[var(--color-pine)]',
      tone: 'text-[var(--color-pine)]',
      bg: 'bg-[var(--color-pine-tint)]',
      go: 'paid' as Filter,
    },
  ];

  const actionsFor = (po: PurchaseOrder, labeled?: boolean) => (
    <PoActions
      po={po}
      labeled={labeled}
      onReceive={() => setModal({ type: 'receive', po })}
      onCancel={() => handleCancel(po)}
      onPay={() => setModal({ type: 'pay', po })}
      onDetail={() => setModal({ type: 'detail', po })}
    />
  );

  return (
    <div className="relative z-10 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-xl font-semibold sm:text-2xl">Pengeluaran & Pembelian (PO)</h1>
          <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">Purchase order, penerimaan barang, dan utang supplier (AP)</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            onClick={() => setModal({ type: 'supplier' })}
            className="flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-xs font-bold transition-colors hover:bg-[var(--color-canvas-sunk)]"
          >
            <Building2 className="h-4 w-4" /> Supplier baru
          </button>
          <button
            onClick={() => setModal({ type: 'create' })}
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-pine)] px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-[var(--color-pine-light)] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> Buat PO
          </button>
        </div>
      </div>

      {/* Ringkasan AP */}
      <div className="grid grid-cols-1 gap-3 sm:gap-5 md:grid-cols-3">
        {summary.map((c, i) => (
          <motion.button
            key={c.label}
            type="button"
            onClick={() => setFilter(c.go)}
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

      {/* Cari & filter */}
      <div className="glass-card-light space-y-3 rounded-2xl p-4">
        <div className="relative w-full lg:w-96">
          <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-[var(--color-ink-soft)]" />
          <input
            type="text"
            placeholder="Cari nomor PO atau supplier"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] py-2 pl-10 pr-4 text-xs focus:border-[var(--color-gold)] focus:outline-none"
          />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 text-xs font-semibold">
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
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="glass-card-light flex flex-col items-center gap-2 rounded-2xl py-16 text-center">
          <span className="text-4xl">🧾</span>
          <p className="text-sm font-semibold">Belum ada PO yang cocok</p>
          <p className="text-xs text-[var(--color-ink-soft)]">Klik “Buat PO” untuk memesan barang.</p>
        </div>
      )}

      {/* Tabel PO (layar lebar) */}
      {filtered.length > 0 && (
        <div className="glass-card-light hidden overflow-hidden rounded-2xl lg:block">
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
                {filtered.map((po) => {
                  const pay = paymentLabel(po);
                  const remaining = getPoRemaining(po);
                  return (
                    <tr key={po.id} className="transition-colors hover:bg-[var(--color-canvas)]">
                      <td className="px-4 py-3.5">
                        <p className="font-mono font-bold">{po.id}</p>
                        <span className="text-[11px] text-[var(--color-ink-soft)]">{po.date}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={po.supplierName} />
                          <span className="font-semibold">{po.supplierName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-bold">{rp(po.totalAmount)}</p>
                        <span className="text-[11px] text-[var(--color-ink-soft)]">{po.items.length} jenis barang</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge po={po} />
                      </td>
                      <td className="min-w-[170px] px-4 py-3.5">
                        <span className={`${badge} ${pay.cls}`}>{pay.text}</span>
                        {remaining > 0 && <p className="mt-1 text-[11px] text-[var(--color-ink-soft)]">Sisa {rp(remaining)}</p>}
                        <div className="mt-1.5">
                          <PaidBar po={po} />
                        </div>
                      </td>
                      <td className="px-4 py-3.5">{actionsFor(po)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Kartu PO (ponsel & tablet) */}
      {filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
          {filtered.map((po) => {
            const pay = paymentLabel(po);
            const remaining = getPoRemaining(po);
            return (
              <div key={po.id} className="glass-card-light flex flex-col gap-3 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={po.supplierName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{po.supplierName}</p>
                    <p className="font-mono text-[11px] text-[var(--color-ink-soft)]">
                      {po.id} · {po.date}
                    </p>
                  </div>
                  <StatusBadge po={po} />
                </div>

                <div className="flex items-end justify-between rounded-xl bg-[var(--color-canvas)] px-3 py-2.5">
                  <div>
                    <p className="text-[11px] text-[var(--color-ink-soft)]">{po.items.length} jenis barang</p>
                    <p className="font-display text-lg font-semibold">{rp(po.totalAmount)}</p>
                  </div>
                  {remaining > 0 && (
                    <div className="text-right">
                      <p className="text-[11px] text-[var(--color-ink-soft)]">Sisa utang</p>
                      <p className="text-sm font-bold text-[var(--color-gold)]">{rp(remaining)}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <span className={`${badge} ${pay.cls} whitespace-normal`}>{pay.text}</span>
                  <PaidBar po={po} />
                </div>

                <div className="mt-auto pt-1">{actionsFor(po, true)}</div>
              </div>
            );
          })}
        </div>
      )}

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