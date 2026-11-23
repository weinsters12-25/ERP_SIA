/**
 * Generator data demo Toserba ERP (murni, tanpa akses file).
 * Dipakai oleh scripts/seed-demo.ts (CLI) dan src/app/api/demo-toggle/route.ts.
 *
 * Cara kerja: MENSIMULASIKAN transaksi satu per satu secara kronologis dengan aturan
 * yang sama seperti src/stores/useErpStore.ts, sehingga saldo kas, stok batch, piutang,
 * utang PO, dan jurnal selalu saling cocok. Semua tanggal relatif terhadap hari ini.
 * Hasilnya selalu sama setiap dijalankan (acak dengan seed tetap).
 */

/* ---------- tipe (cermin dari src/stores/useErpStore.ts) ---------- */

export interface Batch { batchNo: string; qty: number; expiredDate: string }
export interface Product {
  id: string; sku: string; name: string; category: string; unit: string;
  price: number; cost: number; minStock: number; batches: Batch[];
}
export type JournalType =
  | 'SALES' | 'EXPENSE' | 'RECEIVABLE' | 'PAYABLE' | 'ADJUSTMENT'
  | 'PURCHASE' | 'COGS' | 'CAPITAL' | 'TRANSFER';
export interface Journal {
  id: string; date: string; description: string; debitAccount: string;
  creditAccount: string; amount: number; type: JournalType;
}
export interface Receivable {
  id: string; invoiceNo: string; customerName: string; phone: string;
  invoiceDate: string; dueDate: string; totalAmount: number; paidAmount: number;
}
export interface CashAccount { id: string; name: string; balance: number; type: 'CASH' | 'BANK' }
export interface Supplier { id: string; code: string; name: string; phone: string }
export interface PoItem { productId: string; name: string; unit: string; qty: number; unitCost: number }
export interface PurchaseOrder {
  id: string; supplierId: string; supplierName: string; date: string;
  receivedDate: string | null; dueDate: string | null; paymentTerm: 'CASH' | 'CREDIT';
  termDays: number; status: 'PENDING' | 'RECEIVED' | 'CANCELLED'; items: PoItem[];
  totalAmount: number; paidAmount: number;
}
export interface ErpData {
  products: Product[]; journals: Journal[]; receivables: Receivable[];
  accounts: CashAccount[]; suppliers: Supplier[]; purchaseOrders: PurchaseOrder[];
  invoiceSeq: number; journalSeq: number; arSeq: number; batchSeq: number;
  poSeq: number; supplierSeq: number;
}
export interface DemoPayload {
  seedId: string;
  label: string;
  generatedAt: string;
  data: ErpData;
}

/* ---------- helper tanggal ---------- */

const pad = (n: number) => String(n).padStart(2, '0');
const offset = (days: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
};
const ds = (days: number) => {
  const d = offset(days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const dts = (days: number, h: number, m: number) => `${ds(days)} ${pad(h)}:${pad(m)}`;
export const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

/* ---------- dataset kosong ---------- */

const emptyAccounts = (): CashAccount[] => [
  { id: '101', name: 'Kas Kasir POS', balance: 0, type: 'CASH' },
  { id: '102', name: 'Kas Kecil Operasional', balance: 0, type: 'CASH' },
  { id: '103', name: 'Bank BCA Toko', balance: 0, type: 'BANK' },
];

export function emptyData(): ErpData {
  return {
    products: [], journals: [], receivables: [], accounts: emptyAccounts(), suppliers: [],
    purchaseOrders: [], invoiceSeq: 1, journalSeq: 1, arSeq: 1, batchSeq: 1, poSeq: 1, supplierSeq: 1,
  };
}

/* ---------- dataset demo (simulasi kronologis) ---------- */

export function demoData(): ErpData {
  const YEAR = new Date().getFullYear();

  /* acak deterministik */
  let seed = 20260;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

  /* master data */
  const products: Product[] = [
    { id: '1', sku: 'BRS-001', name: 'Beras Setra Ramos 5kg', category: 'Beras & Biji', unit: 'Pouch', price: 72000, cost: 62000, minStock: 20, batches: [] },
    { id: '2', sku: 'MYK-001', name: 'Minyak Goreng Bimoli 2L', category: 'Minyak & Bumbu', unit: 'Pouch', price: 36000, cost: 30000, minStock: 25, batches: [] },
    { id: '3', sku: 'GLA-001', name: 'Gula Pasir Gulaku 1kg', category: 'Sembako', unit: 'Kg', price: 17500, cost: 15000, minStock: 30, batches: [] },
    { id: '4', sku: 'TLR-001', name: 'Telur Ayam Negeri (Peti)', category: 'Sembako Basah', unit: 'Kg', price: 28000, cost: 24000, minStock: 15, batches: [] },
    { id: '5', sku: 'TRG-001', name: 'Tepung Terigu Segitiga Biru 1kg', category: 'Sembako', unit: 'Pcs', price: 13000, cost: 11000, minStock: 20, batches: [] },
    { id: '6', sku: 'SMR-001', name: 'Indomie Goreng Spesial (Dus)', category: 'Mie & Kaleng', unit: 'Dus', price: 112000, cost: 90000, minStock: 10, batches: [] },
  ];
  const suppliers: Supplier[] = [
    { id: '1', code: 'SUP-01', name: 'PT Indofood Sukses Makmur', phone: '081234567890' },
    { id: '2', code: 'SUP-02', name: 'CV Beras Utama Jaya', phone: '081987654321' },
    { id: '3', code: 'SUP-03', name: 'Distributor Minyak Bimoli', phone: '085211223344' },
  ];
  const accounts = emptyAccounts();

  /* state yang berubah selama simulasi */
  const journals: Journal[] = [];
  const receivables: Receivable[] = [];
  const purchaseOrders: PurchaseOrder[] = [];
  let invoiceSeq = 1001;
  let journalSeq = 1;
  let arSeq = 1;
  let batchSeq = 1;
  let poSeq = 1;

  const poByKey: Record<string, PurchaseOrder> = {};
  const arByKey: Record<string, Receivable> = {};

  /* ---------- primitif ---------- */

  const acc = (id: string) => accounts.find((a) => a.id === id)!;
  const accLabel = (id: string) => `${id} - ${acc(id).name}`;
  const prod = (id: string) => products.find((p) => p.id === id)!;
  const totalStock = (p: Product) => p.batches.reduce((s, b) => s + b.qty, 0);

  const move = (id: string, delta: number, ctx: string) => {
    const a = acc(id);
    if (a.balance + delta < 0) {
      throw new Error(`Saldo ${a.name} tidak cukup saat "${ctx}" (saldo ${rp(a.balance)}, butuh ${rp(-delta)})`);
    }
    a.balance += delta;
  };

  const post = (day: number, h: number, m: number, description: string, debit: string, credit: string, amount: number, type: JournalType) => {
    journals.push({
      id: `JRN-${YEAR}-${String(journalSeq++).padStart(3, '0')}`,
      date: dts(day, h, m),
      description,
      debitAccount: debit,
      creditAccount: credit,
      amount,
      type,
    });
  };

  /* ---------- operasi (meniru aksi di store) ---------- */

  const capital = (day: number, h: number, m: number, kind: 'DEPOSIT' | 'WITHDRAW', id: string, amount: number, note: string) => {
    const dep = kind === 'DEPOSIT';
    move(id, dep ? amount : -amount, note);
    post(day, h, m,
      dep ? `Setoran modal / saldo awal - ${note}` : `Penarikan pemilik (prive) - ${note}`,
      dep ? accLabel(id) : '302 - Prive Pemilik',
      dep ? '301 - Modal Pemilik' : accLabel(id),
      amount, 'CAPITAL');
  };

  const transfer = (day: number, h: number, m: number, from: string, to: string, amount: number, note: string) => {
    move(from, -amount, note);
    move(to, amount, note);
    post(day, h, m, `Transfer ${acc(from).name} ke ${acc(to).name} - ${note}`, accLabel(to), accLabel(from), amount, 'TRANSFER');
  };

  const expense = (day: number, h: number, m: number, from: string, title: string, amount: number) => {
    move(from, -amount, title);
    post(day, h, m, title, '501 - Beban Operasional', accLabel(from), amount, 'EXPENSE');
  };

  const createPO = (
    day: number, key: string, supplierId: string,
    lines: { pid: string; qty: number; unitCost: number }[],
    term: 'CASH' | 'CREDIT', termDays: number,
  ) => {
    const sup = suppliers.find((s) => s.id === supplierId)!;
    const items: PoItem[] = lines.map((l) => ({
      productId: l.pid, name: prod(l.pid).name, unit: prod(l.pid).unit, qty: l.qty, unitCost: l.unitCost,
    }));
    const po: PurchaseOrder = {
      id: `PO-${YEAR}-${String(poSeq++).padStart(3, '0')}`,
      supplierId, supplierName: sup.name, date: ds(day), receivedDate: null, dueDate: null,
      paymentTerm: term, termDays: term === 'CREDIT' ? termDays : 0, status: 'PENDING', items,
      totalAmount: items.reduce((s, i) => s + i.qty * i.unitCost, 0), paidAmount: 0,
    };
    purchaseOrders.unshift(po);
    poByKey[key] = po;
  };

  /** expiries = selisih hari dari HARI INI untuk tanggal kadaluarsa tiap barang */
  const receivePO = (day: number, h: number, m: number, key: string, expiries: Record<string, number>, payAcc?: string) => {
    const po = poByKey[key];
    const isCash = po.paymentTerm === 'CASH';

    for (const it of po.items) {
      const p = prod(it.productId);
      const qtyBefore = totalStock(p);
      p.batches.push({
        batchNo: `BATCH-${YEAR}-${String(batchSeq++).padStart(2, '0')}`,
        qty: it.qty,
        expiredDate: ds(expiries[it.productId]),
      });
      p.cost = Math.round((qtyBefore * p.cost + it.qty * it.unitCost) / (qtyBefore + it.qty));
    }

    if (isCash) move(payAcc!, -po.totalAmount, `terima ${po.id}`);

    post(day, h, m,
      `${isCash ? 'Pembelian tunai' : 'Pembelian kredit'} ${po.id} (${po.supplierName})`,
      '105 - Persediaan Barang',
      isCash ? accLabel(payAcc!) : '201 - Utang Usaha (AP)',
      po.totalAmount, 'PURCHASE');

    po.status = 'RECEIVED';
    po.receivedDate = ds(day);
    po.dueDate = ds(day + po.termDays);
    po.paidAmount = isCash ? po.totalAmount : 0;
  };

  const payPO = (day: number, h: number, m: number, key: string, amount: number, from: string) => {
    const po = poByKey[key];
    move(from, -amount, `bayar ${po.id}`);
    post(day, h, m, `Pembayaran utang ${po.id} (${po.supplierName})`, '201 - Utang Usaha (AP)', accLabel(from), amount, 'PAYABLE');
    po.paidAmount += amount;
  };

  type Payment =
    | { method: 'CASH' }
    | { method: 'CREDIT'; key: string; customerName: string; phone: string; dueDays: number };

  const sell = (day: number, h: number, m: number, wanted: { pid: string; qty: number }[], payment: Payment) => {
    const today = ds(day);
    let total = 0;
    let cogs = 0;

    for (const w of wanted) {
      const p = prod(w.pid);
      const sellable = p.batches
        .filter((b) => b.qty > 0 && b.expiredDate >= today)
        .sort((a, b) => a.expiredDate.localeCompare(b.expiredDate)); // FEFO
      let need = Math.min(w.qty, sellable.reduce((s, b) => s + b.qty, 0)); // tidak melebihi stok
      const sold = need;
      for (const b of sellable) {
        const take = Math.min(b.qty, need);
        b.qty -= take;
        need -= take;
        if (need === 0) break;
      }
      p.batches = p.batches.filter((b) => b.qty > 0);
      total += p.price * sold;
      cogs += p.cost * sold;
    }
    if (total === 0) return;

    const invoiceNo = `INV-${invoiceSeq++}`;

    if (payment.method === 'CASH') {
      move('101', total, invoiceNo);
      post(day, h, m, `Penjualan Kasir POS (Nota #${invoiceNo})`, '101 - Kas Kasir POS', '401 - Pendapatan Penjualan', total, 'SALES');
    } else {
      const due = offset(day);
      due.setDate(due.getDate() + payment.dueDays);
      const ar: Receivable = {
        id: `AR-${YEAR}-${String(arSeq++).padStart(3, '0')}`,
        invoiceNo, customerName: payment.customerName, phone: payment.phone,
        invoiceDate: ds(day),
        dueDate: `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`,
        totalAmount: total, paidAmount: 0,
      };
      receivables.unshift(ar);
      arByKey[payment.key] = ar;
      post(day, h, m, `Penjualan Bon/Kredit (Nota #${invoiceNo}) - ${payment.customerName}`, '104 - Piutang Usaha (AR)', '401 - Pendapatan Penjualan', total, 'SALES');
    }

    if (cogs > 0) post(day, h, m, `HPP penjualan (Nota #${invoiceNo})`, '601 - Harga Pokok Penjualan', '105 - Persediaan Barang', cogs, 'COGS');
  };

  /** amount = null -> lunasi seluruh sisa */
  const payAR = (day: number, h: number, m: number, key: string, amount: number | null, to: string) => {
    const ar = arByKey[key];
    const pay = amount ?? ar.totalAmount - ar.paidAmount;
    move(to, pay, `pelunasan ${ar.invoiceNo}`);
    post(day, h, m, `Pelunasan piutang (${ar.customerName}) - ${ar.invoiceNo}`, accLabel(to), '104 - Piutang Usaha (AR)', pay, 'RECEIVABLE');
    ar.paidAmount += pay;
  };

  const opname = (day: number, h: number, m: number, pid: string, diff: number, reason: string) => {
    const p = prod(pid);
    let need = -diff;
    for (const b of [...p.batches].sort((a, c) => a.expiredDate.localeCompare(c.expiredDate))) {
      const take = Math.min(b.qty, need);
      b.qty -= take;
      need -= take;
      if (need === 0) break;
    }
    p.batches = p.batches.filter((b) => b.qty > 0);
    post(day, h, m, `Stock opname ${p.name}: ${diff} ${p.unit} (${reason})`, '502 - Beban Selisih Stok', '105 - Persediaan Barang', Math.abs(diff) * p.cost, 'ADJUSTMENT');
  };

  /* ---------- jadwal kejadian ---------- */

  interface Ev { day: number; h: number; m: number; run: () => void }
  const events: Ev[] = [];
  const at = (day: number, h: number, m: number, run: () => void) => events.push({ day, h, m, run });

  // Saldo awal
  at(-29, 8, 0, () => capital(-29, 8, 0, 'DEPOSIT', '103', 30000000, 'Saldo awal bank'));
  at(-29, 8, 5, () => capital(-29, 8, 5, 'DEPOSIT', '102', 2000000, 'Saldo awal kas kecil'));
  at(-29, 8, 10, () => capital(-29, 8, 10, 'DEPOSIT', '101', 1000000, 'Modal awal kasir'));

  // Pembelian
  at(-28, 9, 0, () => createPO(-28, 'A', '2', [{ pid: '1', qty: 50, unitCost: 62000 }], 'CASH', 0));
  at(-28, 14, 0, () => receivePO(-28, 14, 0, 'A', { '1': 14 }, '103')); // batch kritis

  at(-27, 9, 0, () => createPO(-27, 'B', '3', [{ pid: '2', qty: 250, unitCost: 30000 }], 'CREDIT', 14));
  at(-27, 13, 30, () => receivePO(-27, 13, 30, 'B', { '2': 60 }));

  at(-25, 9, 0, () => createPO(-25, 'C', '1', [{ pid: '6', qty: 90, unitCost: 90000 }, { pid: '5', qty: 180, unitCost: 11000 }], 'CASH', 0));
  at(-25, 14, 15, () => receivePO(-25, 14, 15, 'C', { '6': 170, '5': 300 }, '103'));

  at(-20, 9, 0, () => createPO(-20, 'D', '2', [{ pid: '1', qty: 150, unitCost: 62000 }, { pid: '3', qty: 300, unitCost: 15000 }], 'CREDIT', 30));
  at(-20, 13, 45, () => receivePO(-20, 13, 45, 'D', { '1': 200, '3': 500 }));

  at(-6, 9, 0, () => createPO(-6, 'E', '2', [{ pid: '4', qty: 40, unitCost: 24000 }], 'CASH', 0));
  at(-6, 11, 20, () => receivePO(-6, 11, 20, 'E', { '4': 9 }, '102')); // batch kritis

  at(-2, 10, 0, () => createPO(-2, 'F', '1', [{ pid: '6', qty: 50, unitCost: 90000 }], 'CREDIT', 30)); // masih PENDING

  // Pembayaran utang
  at(-14, 10, 30, () => payPO(-14, 10, 30, 'B', 7500000, '103'));
  at(-6, 15, 0, () => payPO(-6, 15, 0, 'D', 5000000, '103')); // cicilan, sisa masih utang

  // Penjualan bon + pelunasan
  at(-18, 10, 30, () => sell(-18, 10, 30, [{ pid: '1', qty: 12 }, { pid: '3', qty: 25 }],
    { method: 'CREDIT', key: 'sri', customerName: 'Toko Kelontong Bu Sri', phone: '081234567890', dueDays: 14 })); // jatuh tempo terlewat
  at(-16, 11, 0, () => sell(-16, 11, 0, [{ pid: '2', qty: 20 }, { pid: '5', qty: 15 }],
    { method: 'CREDIT', key: 'berkah', customerName: 'Catering Berkah', phone: '081987654321', dueDays: 7 }));
  at(-12, 15, 10, () => sell(-12, 15, 10, [{ pid: '2', qty: 15 }, { pid: '5', qty: 10 }, { pid: '6', qty: 2 }],
    { method: 'CREDIT', key: 'joko', customerName: 'Warung Makan Pak Joko', phone: '085711223344', dueDays: 14 }));
  at(-10, 16, 30, () => payAR(-10, 16, 30, 'berkah', null, '103')); // lunas
  at(-5, 13, 0, () => payAR(-5, 13, 0, 'joko', 200000, '101')); // cicilan

  // Biaya operasional
  at(-24, 10, 0, () => expense(-24, 10, 0, '103', 'Sewa: Sewa kios bulan ini', 800000));
  at(-22, 9, 30, () => transfer(-22, 9, 30, '103', '102', 1000000, 'Isi kas kecil'));
  at(-20, 16, 0, () => expense(-20, 16, 0, '102', 'Transport & Bensin: Bensin kurir', 150000));
  at(-17, 11, 0, () => expense(-17, 11, 0, '102', 'Plastik & Kemasan: Kantong plastik', 120000));
  at(-11, 10, 15, () => expense(-11, 10, 15, '102', 'Perawatan: Servis timbangan', 85000));
  at(-5, 16, 0, () => expense(-5, 16, 0, '102', 'Transport & Bensin: Bensin kurir', 150000));
  at(-3, 10, 0, () => expense(-3, 10, 0, '103', 'Gaji Pegawai: Gaji kasir & kurir', 1200000));
  at(0, 11, 0, () => expense(0, 11, 0, '102', 'Listrik & Air: Pembayaran listrik & air toko', 450000));

  // Setor hasil kasir ke bank (jumlah dihitung dari saldo kasir saat itu) + prive
  for (const d of [-14, -7, -1]) {
    at(d, 18, 30, () => {
      const amt = Math.floor((acc('101').balance - 1000000) / 100000) * 100000;
      if (amt > 0) transfer(d, 18, 30, '101', '103', amt, 'Setor hasil kasir ke bank');
    });
  }
  at(-9, 19, 0, () => capital(-9, 19, 0, 'WITHDRAW', '101', 300000, 'Uang makan pemilik'));

  // Stock opname
  at(-3, 17, 0, () => opname(-3, 17, 0, '4', -1, 'telur retak'));

  // Penjualan tunai harian (acak, deterministik)
  const wantRange: Record<string, [number, number]> = {
    '1': [3, 10], '2': [3, 10], '3': [5, 15], '4': [2, 6], '5': [4, 12], '6': [2, 5],
  };
  const nowHour = new Date().getHours();
  for (let day = -24; day <= 0; day++) {
    const nSales = rnd() < 0.2 ? 1 : rnd() < 0.7 ? 2 : 3;
    for (let s = 0; s < nSales; s++) {
      const h = day === 0 ? int(8, Math.max(8, nowHour)) : int(8, 19);
      const m = int(0, 59);
      const nLines = int(1, 3);
      const picked = new Set<string>();
      while (picked.size < nLines) picked.add(String(int(1, 6)));
      const lines = [...picked].map((pid) => ({ pid, qty: int(wantRange[pid][0], wantRange[pid][1]) }));
      at(day, h, m, () => sell(day, h, m, lines, { method: 'CASH' }));
    }
  }

  /* ---------- jalankan kronologis ---------- */

  events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.day - b.e.day || a.e.h - b.e.h || a.e.m - b.e.m || a.i - b.i)
    .forEach(({ e }) => e.run());

  return {
    products,
    journals: journals.reverse(), // terbaru di atas, seperti store
    receivables,
    accounts,
    suppliers,
    purchaseOrders,
    invoiceSeq,
    journalSeq,
    arSeq,
    batchSeq,
    poSeq,
    supplierSeq: suppliers.length + 1,
  };
}

/* ---------- payload untuk public/demo-data.json ---------- */

export function buildPayload(clear: boolean): DemoPayload {
  return {
    seedId: `${clear ? 'empty' : 'demo'}-${Date.now()}`,
    label: clear ? 'Dataset kosong' : 'Data demo Toserba',
    generatedAt: new Date().toISOString(),
    data: clear ? emptyData() : demoData(),
  };
}