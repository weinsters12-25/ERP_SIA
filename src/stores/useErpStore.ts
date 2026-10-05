import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* =========================================================================
   TIPE DATA
   ========================================================================= */

export interface Batch {
  batchNo: string;
  qty: number;
  expiredDate: string; // YYYY-MM-DD
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  /** Harga beli / modal rata-rata per satuan */
  cost: number;
  minStock: number;
  batches: Batch[];
}

export type JournalType = 'SALES' | 'EXPENSE' | 'RECEIVABLE' | 'PAYABLE' | 'ADJUSTMENT' | 'PURCHASE' | 'COGS';

export interface Journal {
  id: string;
  date: string; // YYYY-MM-DD HH:mm
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  type: JournalType;
}

export interface Receivable {
  id: string;
  invoiceNo: string;
  customerName: string;
  phone: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
}

export interface CashAccount {
  id: string;
  name: string;
  balance: number;
  type: 'CASH' | 'BANK';
}

export type PaymentInput =
  | { method: 'CASH'; received: number }
  | { method: 'CREDIT'; customerName: string; phone: string; dueDays: number };

export interface SaleLine {
  id: string;
  name: string;
  qty: number;
}

export type SaleResult =
  | { ok: true; invoiceNo: string; total: number; change: number; method: 'CASH' | 'CREDIT' }
  | { ok: false; error: string };

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

export interface NewProductInput {
  sku: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  cost: number;
  minStock: number;
  initialQty: number; // 0 = tanpa stok awal
  expiredDate: string; // wajib bila initialQty > 0
}

export type ProductPatch = Partial<Pick<Product, 'name' | 'category' | 'unit' | 'price' | 'cost' | 'minStock'>>;

/* ---------- Purchasing ---------- */

export interface Supplier {
  id: string;
  code: string;
  name: string;
  phone: string;
}

export interface PoItem {
  productId: string;
  name: string;
  unit: string;
  qty: number;
  unitCost: number;
}

export type PoStatus = 'PENDING' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  date: string;
  receivedDate: string | null;
  dueDate: string | null; // diisi saat barang diterima
  paymentTerm: 'CASH' | 'CREDIT';
  termDays: number;
  status: PoStatus;
  items: PoItem[];
  totalAmount: number;
  paidAmount: number;
}

export interface PoLineInput {
  productId: string;
  qty: number;
  unitCost: number;
}

/* =========================================================================
   HELPER TANGGAL & STOK
   ========================================================================= */

const pad = (n: number) => String(n).padStart(2, '0');

export const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toDateTimeStr = (d: Date) => `${toDateStr(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Sisa hari sampai tanggal (negatif = sudah lewat). */
export function getDaysLeft(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export type ExpiryStatus = 'expired' | 'kritis' | 'peringatan' | 'aman';

export function getExpiryStatus(dateStr: string): ExpiryStatus {
  const d = getDaysLeft(dateStr);
  if (d < 0) return 'expired';
  if (d <= 14) return 'kritis';
  if (d <= 30) return 'peringatan';
  return 'aman';
}

/** Total semua batch (termasuk yang sudah kadaluarsa) — untuk stok fisik di gudang. */
export const getTotalStock = (p: Product) => p.batches.reduce((s, b) => s + b.qty, 0);

/** Stok yang masih layak jual (batch belum kadaluarsa). */
export const getSellableStock = (p: Product) =>
  p.batches.filter((b) => getDaysLeft(b.expiredDate) >= 0).reduce((s, b) => s + b.qty, 0);

/** Batch layak jual dengan tanggal kadaluarsa paling dekat (urutan FEFO). */
export const getNearestBatch = (p: Product): Batch | undefined =>
  p.batches
    .filter((b) => b.qty > 0 && getDaysLeft(b.expiredDate) >= 0)
    .sort((a, b) => a.expiredDate.localeCompare(b.expiredDate))[0];

/* =========================================================================
   DATA AWAL (DEMO) — nanti diganti query Supabase
   ========================================================================= */

const SEED_PRODUCTS: Product[] = [
  {
    id: '1', sku: 'BRS-001', name: 'Beras Setra Ramos 5kg', category: 'Beras & Biji', unit: 'Pouch', price: 72000, cost: 62000, minStock: 10,
    batches: [
      { batchNo: 'BATCH-2026-01', qty: 15, expiredDate: '2026-10-15' },
      { batchNo: 'BATCH-2026-05', qty: 30, expiredDate: '2027-05-20' },
    ],
  },
  {
    id: '2', sku: 'MYK-001', name: 'Minyak Goreng Bimoli 2L', category: 'Minyak & Bumbu', unit: 'Pouch', price: 36000, cost: 30000, minStock: 15,
    batches: [{ batchNo: 'BATCH-2026-03', qty: 8, expiredDate: '2026-11-01' }],
  },
  {
    id: '3', sku: 'GLA-001', name: 'Gula Pasir Gulaku 1kg', category: 'Sembako', unit: 'Kg', price: 17500, cost: 15000, minStock: 20,
    batches: [{ batchNo: 'BATCH-2026-02', qty: 120, expiredDate: '2028-01-10' }],
  },
  {
    id: '4', sku: 'TLR-001', name: 'Telur Ayam Negeri (Peti)', category: 'Sembako Basah', unit: 'Kg', price: 28000, cost: 24000, minStock: 10,
    batches: [{ batchNo: 'BATCH-2026-09', qty: 25, expiredDate: '2026-10-12' }],
  },
  {
    id: '5', sku: 'TRG-001', name: 'Tepung Terigu Segitiga Biru 1kg', category: 'Sembako', unit: 'Pcs', price: 13000, cost: 11000, minStock: 20,
    batches: [{ batchNo: 'BATCH-2026-06', qty: 60, expiredDate: '2027-08-20' }],
  },
  {
    id: '6', sku: 'SMR-001', name: 'Indomie Goreng Spesial (Dus)', category: 'Mie & Kaleng', unit: 'Dus', price: 112000, cost: 90000, minStock: 10,
    batches: [{ batchNo: 'BATCH-2026-07', qty: 40, expiredDate: '2027-04-01' }],
  },
];

const SEED_JOURNALS: Journal[] = [
  { id: 'JRN-2026-089', date: '2026-09-26 14:20', description: 'Penjualan Kasir POS (Nota #INV-1092)', debitAccount: '101 - Kas Kasir POS', creditAccount: '401 - Pendapatan Penjualan', amount: 325000, type: 'SALES' },
  { id: 'JRN-2026-088', date: '2026-09-26 11:00', description: 'Pembayaran Listrik & Air Toko September', debitAccount: '501 - Beban Operasional', creditAccount: '102 - Kas Kecil Operasional', amount: 450000, type: 'EXPENSE' },
  { id: 'JRN-2026-087', date: '2026-09-25 16:30', description: 'Pelunasan Piutang (Toko Kelontong Bu Sri)', debitAccount: '103 - Bank BCA Toko', creditAccount: '104 - Piutang Usaha (AR)', amount: 1250000, type: 'RECEIVABLE' },
  { id: 'JRN-2026-086', date: '2026-09-25 09:15', description: 'Pembayaran Utang Distributor (PO-2026-002)', debitAccount: '201 - Utang Usaha (AP)', creditAccount: '103 - Bank BCA Toko', amount: 7200000, type: 'PAYABLE' },
];

const SEED_RECEIVABLES: Receivable[] = [
  { id: 'AR-2026-001', invoiceNo: 'INV-1070', customerName: 'Toko Kelontong Bu Sri', phone: '081234567890', invoiceDate: '2026-09-10', dueDate: '2026-09-24', totalAmount: 1250000, paidAmount: 0 },
  { id: 'AR-2026-002', invoiceNo: 'INV-1081', customerName: 'Warung Makan Pak Joko', phone: '085711223344', invoiceDate: '2026-09-18', dueDate: '2026-10-08', totalAmount: 850000, paidAmount: 200000 },
  { id: 'AR-2026-003', invoiceNo: 'INV-1055', customerName: 'Catering Berkah', phone: '081987654321', invoiceDate: '2026-09-01', dueDate: '2026-09-15', totalAmount: 2100000, paidAmount: 2100000 },
];

const SEED_COSTS: Record<string, number> = { '1': 62000, '2': 30000, '3': 15000, '4': 24000, '5': 11000, '6': 90000 };

const SEED_SUPPLIERS: Supplier[] = [
  { id: '1', code: 'SUP-IND-01', name: 'PT Indofood Sukses Makmur', phone: '081234567890' },
  { id: '2', code: 'SUP-BRS-02', name: 'CV Beras Utama Jaya', phone: '081987654321' },
  { id: '3', code: 'SUP-BIM-03', name: 'Distributor Minyak Bimoli', phone: '085211223344' },
];

const SEED_POS: PurchaseOrder[] = [
  {
    id: 'PO-2026-001', supplierId: '2', supplierName: 'CV Beras Utama Jaya', date: '2026-09-20', receivedDate: '2026-09-21',
    dueDate: '2026-10-20', paymentTerm: 'CREDIT', termDays: 30, status: 'RECEIVED', paidAmount: 0, totalAmount: 12400000,
    items: [{ productId: '1', name: 'Beras Setra Ramos 5kg', unit: 'Pouch', qty: 200, unitCost: 62000 }],
  },
  {
    id: 'PO-2026-002', supplierId: '3', supplierName: 'Distributor Minyak Bimoli', date: '2026-09-22', receivedDate: '2026-09-23',
    dueDate: '2026-10-06', paymentTerm: 'CREDIT', termDays: 14, status: 'RECEIVED', paidAmount: 7200000, totalAmount: 7200000,
    items: [{ productId: '2', name: 'Minyak Goreng Bimoli 2L', unit: 'Pouch', qty: 240, unitCost: 30000 }],
  },
  {
    id: 'PO-2026-003', supplierId: '1', supplierName: 'PT Indofood Sukses Makmur', date: '2026-09-25', receivedDate: null,
    dueDate: null, paymentTerm: 'CREDIT', termDays: 30, status: 'PENDING', paidAmount: 0, totalAmount: 4500000,
    items: [{ productId: '6', name: 'Indomie Goreng Spesial (Dus)', unit: 'Dus', qty: 50, unitCost: 90000 }],
  },
];

const SEED_ACCOUNTS: CashAccount[] = [
  { id: '101', name: 'Kas Kasir POS', balance: 3250000, type: 'CASH' },
  { id: '102', name: 'Kas Kecil Operasional', balance: 1500000, type: 'CASH' },
  { id: '103', name: 'Bank BCA Toko', balance: 45800000, type: 'BANK' },
];

/* =========================================================================
   STORE
   ========================================================================= */

interface ErpState {
  products: Product[];
  journals: Journal[];
  receivables: Receivable[];
  accounts: CashAccount[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  invoiceSeq: number;
  journalSeq: number;
  arSeq: number;
  batchSeq: number;
  poSeq: number;
  supplierSeq: number;

  /** Proses penjualan POS: potong stok FEFO, buat jurnal, (opsional) buat piutang. */
  sellItems: (lines: SaleLine[], payment: PaymentInput) => SaleResult;

  /** Inventory */
  addProduct: (input: NewProductInput) => ActionResult;
  updateProduct: (id: string, patch: ProductPatch) => ActionResult;
  addBatch: (productId: string, qty: number, expiredDate: string) => ActionResult;
  /** Stock opname: samakan stok sistem dengan stok fisik, buat jurnal penyesuaian bila ada selisih. */
  adjustStock: (productId: string, actualQty: number, reason: string) => ActionResult;

  /** Purchasing */
  addSupplier: (input: { name: string; phone: string }) => ActionResult;
  createPO: (supplierId: string, lines: PoLineInput[], term: 'CASH' | 'CREDIT', termDays: number) => ActionResult;
  /** Terima barang: buat batch, perbarui harga modal, buat jurnal (utang atau kas keluar). */
  receivePO: (poId: string, expiries: Record<string, string>, payAccountId?: string) => ActionResult;
  payPO: (poId: string, amount: number, accountId: string) => ActionResult;
  cancelPO: (poId: string) => ActionResult;

  resetDemoData: () => void;
}

const initialData = () => ({
  products: SEED_PRODUCTS,
  journals: SEED_JOURNALS,
  receivables: SEED_RECEIVABLES,
  accounts: SEED_ACCOUNTS,
  invoiceSeq: 1093,
  journalSeq: 90,
  arSeq: 4,
  batchSeq: 10,
  suppliers: SEED_SUPPLIERS,
  purchaseOrders: SEED_POS,
  poSeq: 4,
  supplierSeq: 4,
});

const makeBatchNo = (seq: number) => `BATCH-${new Date().getFullYear()}-${String(seq).padStart(2, '0')}`;

const makeJournal = (seq: number, data: Omit<Journal, 'id' | 'date'>): Journal => {
  const now = new Date();
  return {
    id: `JRN-${now.getFullYear()}-${String(seq).padStart(3, '0')}`,
    date: toDateTimeStr(now),
    ...data,
  };
};

export const useErpStore = create<ErpState>()(
  persist(
    (set, get) => ({
      ...initialData(),

      sellItems: (lines, payment) => {
        if (lines.length === 0) return { ok: false, error: 'Keranjang kosong.' };

        const state = get();
        const today = toDateStr(new Date());

        // Salin dalam agar state asli tidak berubah kalau ada validasi gagal
        const products = state.products.map((p) => ({ ...p, batches: p.batches.map((b) => ({ ...b })) }));
        let total = 0;
        let cogs = 0;

        for (const line of lines) {
          const product = products.find((p) => p.id === line.id);
          if (!product) return { ok: false, error: `Produk "${line.name}" tidak ditemukan.` };

          let need = line.qty;
          const sellable = product.batches
            .filter((b) => b.qty > 0 && b.expiredDate >= today)
            .sort((a, b) => a.expiredDate.localeCompare(b.expiredDate)); // FEFO

          for (const batch of sellable) {
            const take = Math.min(batch.qty, need);
            batch.qty -= take;
            need -= take;
            if (need === 0) break;
          }

          if (need > 0) {
            return { ok: false, error: `Stok layak jual "${product.name}" kurang ${need} ${product.unit}.` };
          }

          product.batches = product.batches.filter((b) => b.qty > 0);
          total += product.price * line.qty;
          cogs += product.cost * line.qty;
        }

        // Validasi pembayaran
        if (payment.method === 'CASH' && payment.received < total) {
          return { ok: false, error: 'Uang diterima kurang dari total belanja.' };
        }
        if (payment.method === 'CREDIT' && !payment.customerName.trim()) {
          return { ok: false, error: 'Nama pelanggan wajib diisi untuk transaksi bon.' };
        }

        const now = new Date();
        const year = now.getFullYear();
        const invoiceNo = `INV-${state.invoiceSeq}`;
        const journalId = `JRN-${year}-${String(state.journalSeq).padStart(3, '0')}`;

        const journal: Journal = {
          id: journalId,
          date: toDateTimeStr(now),
          description:
            payment.method === 'CASH'
              ? `Penjualan Kasir POS (Nota #${invoiceNo})`
              : `Penjualan Bon/Kredit (Nota #${invoiceNo}) - ${payment.customerName.trim()}`,
          debitAccount: payment.method === 'CASH' ? '101 - Kas Kasir POS' : '104 - Piutang Usaha (AR)',
          creditAccount: '401 - Pendapatan Penjualan',
          amount: total,
          type: 'SALES',
        };

        let receivables = state.receivables;
        let arSeq = state.arSeq;
        let accounts = state.accounts;

        if (payment.method === 'CREDIT') {
          const due = new Date(now);
          due.setDate(due.getDate() + payment.dueDays);
          receivables = [
            {
              id: `AR-${year}-${String(arSeq).padStart(3, '0')}`,
              invoiceNo,
              customerName: payment.customerName.trim(),
              phone: payment.phone.trim(),
              invoiceDate: toDateStr(now),
              dueDate: toDateStr(due),
              totalAmount: total,
              paidAmount: 0,
            },
            ...receivables,
          ];
          arSeq += 1;
        } else {
          accounts = accounts.map((a) => (a.id === '101' ? { ...a, balance: a.balance + total } : a));
        }

        // Jurnal HPP: beban pokok penjualan vs persediaan
        const cogsJournal =
          cogs > 0
            ? makeJournal(state.journalSeq + 1, {
                description: `HPP penjualan (Nota #${invoiceNo})`,
                debitAccount: '601 - Harga Pokok Penjualan',
                creditAccount: '105 - Persediaan Barang',
                amount: cogs,
                type: 'COGS',
              })
            : null;

        set({
          products,
          journals: [...(cogsJournal ? [cogsJournal] : []), journal, ...state.journals],
          receivables,
          accounts,
          invoiceSeq: state.invoiceSeq + 1,
          journalSeq: state.journalSeq + (cogsJournal ? 2 : 1),
          arSeq,
        });

        return {
          ok: true,
          invoiceNo,
          total,
          change: payment.method === 'CASH' ? payment.received - total : 0,
          method: payment.method,
        };
      },

      addProduct: (input) => {
        const state = get();
        const sku = input.sku.trim().toUpperCase();

        if (!sku || !input.name.trim()) return { ok: false, error: 'SKU dan nama barang wajib diisi.' };
        if (state.products.some((p) => p.sku === sku)) return { ok: false, error: `SKU ${sku} sudah dipakai barang lain.` };
        if (!(input.price > 0)) return { ok: false, error: 'Harga jual harus lebih dari 0.' };
        if (input.initialQty > 0 && !input.expiredDate) {
          return { ok: false, error: 'Tanggal kadaluarsa wajib diisi untuk stok awal.' };
        }

        const hasStock = input.initialQty > 0;
        const product: Product = {
          id: String(Date.now()),
          sku,
          name: input.name.trim(),
          category: input.category.trim() || 'Lainnya',
          unit: input.unit.trim() || 'Pcs',
          price: input.price,
          cost: Math.max(0, input.cost || 0),
          minStock: Math.max(0, input.minStock || 0),
          batches: hasStock
            ? [{ batchNo: makeBatchNo(state.batchSeq), qty: input.initialQty, expiredDate: input.expiredDate }]
            : [],
        };

        set({
          products: [...state.products, product],
          batchSeq: hasStock ? state.batchSeq + 1 : state.batchSeq,
        });
        return { ok: true, message: `Barang "${product.name}" berhasil ditambahkan.` };
      },

      updateProduct: (id, patch) => {
        const state = get();
        const product = state.products.find((p) => p.id === id);
        if (!product) return { ok: false, error: 'Barang tidak ditemukan.' };
        if (patch.name !== undefined && !patch.name.trim()) return { ok: false, error: 'Nama barang tidak boleh kosong.' };
        if (patch.price !== undefined && !(patch.price > 0)) return { ok: false, error: 'Harga jual harus lebih dari 0.' };

        set({ products: state.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
        return { ok: true, message: `Data "${product.name}" diperbarui.` };
      },

      addBatch: (productId, qty, expiredDate) => {
        const state = get();
        const product = state.products.find((p) => p.id === productId);
        if (!product) return { ok: false, error: 'Barang tidak ditemukan.' };
        if (!(qty > 0)) return { ok: false, error: 'Jumlah harus lebih dari 0.' };
        if (!expiredDate) return { ok: false, error: 'Tanggal kadaluarsa wajib diisi.' };

        const batchNo = makeBatchNo(state.batchSeq);
        set({
          products: state.products.map((p) =>
            p.id === productId ? { ...p, batches: [...p.batches, { batchNo, qty, expiredDate }] } : p
          ),
          batchSeq: state.batchSeq + 1,
        });
        return { ok: true, message: `${batchNo} (${qty} ${product.unit}) ditambahkan ke ${product.name}.` };
      },

      adjustStock: (productId, actualQty, reason) => {
        const state = get();
        const product = state.products.find((p) => p.id === productId);
        if (!product) return { ok: false, error: 'Barang tidak ditemukan.' };
        if (!Number.isFinite(actualQty) || actualQty < 0) return { ok: false, error: 'Stok fisik tidak valid.' };

        const batches = product.batches.map((b) => ({ ...b }));
        const current = batches.reduce((s, b) => s + b.qty, 0);
        const diff = actualQty - current;

        if (diff === 0) return { ok: true, message: 'Stok fisik sama dengan sistem. Tidak ada penyesuaian.' };

        let batchSeq = state.batchSeq;

        if (diff < 0) {
          // Kurangi dari batch dengan expired paling awal (batch kadaluarsa terpotong lebih dulu)
          let need = -diff;
          for (const b of [...batches].sort((a, c) => a.expiredDate.localeCompare(c.expiredDate))) {
            const take = Math.min(b.qty, need);
            b.qty -= take;
            need -= take;
            if (need === 0) break;
          }
        } else if (batches.length > 0) {
          // Lebih banyak dari sistem: tambahkan ke batch dengan expired paling akhir
          const latest = [...batches].sort((a, c) => c.expiredDate.localeCompare(a.expiredDate))[0];
          latest.qty += diff;
        } else {
          const d = new Date();
          d.setDate(d.getDate() + 180);
          batches.push({ batchNo: makeBatchNo(batchSeq), qty: diff, expiredDate: toDateStr(d) });
          batchSeq += 1;
        }

        // Nilai selisih memakai harga modal (cost)
        const journal = makeJournal(state.journalSeq, {
          description: `Stock opname ${product.name}: ${diff > 0 ? '+' : ''}${diff} ${product.unit} (${reason})`,
          debitAccount: diff < 0 ? '502 - Beban Selisih Stok' : '105 - Persediaan Barang',
          creditAccount: diff < 0 ? '105 - Persediaan Barang' : '502 - Beban Selisih Stok',
          amount: Math.abs(diff) * product.cost,
          type: 'ADJUSTMENT',
        });

        set({
          products: state.products.map((p) =>
            p.id === productId ? { ...p, batches: batches.filter((b) => b.qty > 0) } : p
          ),
          journals: [journal, ...state.journals],
          journalSeq: state.journalSeq + 1,
          batchSeq,
        });

        return {
          ok: true,
          message: `Opname ${product.name} disimpan: selisih ${diff > 0 ? '+' : ''}${diff} ${product.unit}. Jurnal ${journal.id} dibuat.`,
        };
      },

      addSupplier: (input) => {
        const state = get();
        if (!input.name.trim()) return { ok: false, error: 'Nama supplier wajib diisi.' };
        const supplier: Supplier = {
          id: String(state.supplierSeq),
          code: `SUP-${String(state.supplierSeq).padStart(2, '0')}`,
          name: input.name.trim(),
          phone: input.phone.trim(),
        };
        set({ suppliers: [...state.suppliers, supplier], supplierSeq: state.supplierSeq + 1 });
        return { ok: true, message: `Supplier "${supplier.name}" ditambahkan (${supplier.code}).` };
      },

      createPO: (supplierId, lines, term, termDays) => {
        const state = get();
        const supplier = state.suppliers.find((s) => s.id === supplierId);
        if (!supplier) return { ok: false, error: 'Pilih supplier terlebih dahulu.' };
        if (lines.length === 0) return { ok: false, error: 'Tambahkan minimal satu barang.' };
        if (new Set(lines.map((l) => l.productId)).size !== lines.length) {
          return { ok: false, error: 'Ada barang yang sama di dua baris. Gabungkan jumlahnya.' };
        }

        const items: PoItem[] = [];
        for (const l of lines) {
          const product = state.products.find((p) => p.id === l.productId);
          if (!product) return { ok: false, error: 'Ada barang yang tidak ditemukan.' };
          if (!(l.qty > 0)) return { ok: false, error: `Jumlah "${product.name}" harus lebih dari 0.` };
          if (!(l.unitCost > 0)) return { ok: false, error: `Harga beli "${product.name}" harus lebih dari 0.` };
          items.push({ productId: product.id, name: product.name, unit: product.unit, qty: l.qty, unitCost: l.unitCost });
        }

        const now = new Date();
        const po: PurchaseOrder = {
          id: `PO-${now.getFullYear()}-${String(state.poSeq).padStart(3, '0')}`,
          supplierId,
          supplierName: supplier.name,
          date: toDateStr(now),
          receivedDate: null,
          dueDate: null,
          paymentTerm: term,
          termDays: term === 'CREDIT' ? termDays : 0,
          status: 'PENDING',
          items,
          totalAmount: items.reduce((s, i) => s + i.qty * i.unitCost, 0),
          paidAmount: 0,
        };

        set({ purchaseOrders: [po, ...state.purchaseOrders], poSeq: state.poSeq + 1 });
        return { ok: true, message: `${po.id} dikirim ke ${supplier.name}.` };
      },

      receivePO: (poId, expiries, payAccountId) => {
        const state = get();
        const po = state.purchaseOrders.find((o) => o.id === poId);
        if (!po) return { ok: false, error: 'PO tidak ditemukan.' };
        if (po.status !== 'PENDING') return { ok: false, error: 'PO ini sudah diproses.' };

        for (const item of po.items) {
          if (!expiries[item.productId]) return { ok: false, error: `Tanggal kadaluarsa "${item.name}" wajib diisi.` };
        }

        let account: CashAccount | undefined;
        if (po.paymentTerm === 'CASH') {
          account = state.accounts.find((a) => a.id === payAccountId);
          if (!account) return { ok: false, error: 'Pilih sumber kas untuk pembayaran tunai.' };
          if (account.balance < po.totalAmount) return { ok: false, error: `Saldo ${account.name} tidak cukup.` };
        }

        // Tambah batch + hitung harga modal rata-rata tertimbang
        let batchSeq = state.batchSeq;
        const products = state.products.map((p) => {
          const items = po.items.filter((i) => i.productId === p.id);
          if (items.length === 0) return p;
          const batches = [...p.batches];
          let qtyBefore = getTotalStock(p);
          let cost = p.cost;
          for (const it of items) {
            batches.push({ batchNo: makeBatchNo(batchSeq), qty: it.qty, expiredDate: expiries[it.productId] });
            batchSeq += 1;
            cost = Math.round((qtyBefore * cost + it.qty * it.unitCost) / (qtyBefore + it.qty));
            qtyBefore += it.qty;
          }
          return { ...p, batches, cost };
        });

        const now = new Date();
        const isCash = po.paymentTerm === 'CASH';
        const due = new Date(now);
        due.setDate(due.getDate() + po.termDays);

        const journal = makeJournal(state.journalSeq, {
          description: `${isCash ? 'Pembelian tunai' : 'Pembelian kredit'} ${po.id} (${po.supplierName})`,
          debitAccount: '105 - Persediaan Barang',
          creditAccount: isCash && account ? `${account.id} - ${account.name}` : '201 - Utang Usaha (AP)',
          amount: po.totalAmount,
          type: 'PURCHASE',
        });

        set({
          products,
          batchSeq,
          journals: [journal, ...state.journals],
          journalSeq: state.journalSeq + 1,
          accounts: account
            ? state.accounts.map((a) => (a.id === account!.id ? { ...a, balance: a.balance - po.totalAmount } : a))
            : state.accounts,
          purchaseOrders: state.purchaseOrders.map((o) =>
            o.id === poId
              ? {
                  ...o,
                  status: 'RECEIVED' as const,
                  receivedDate: toDateStr(now),
                  dueDate: isCash ? toDateStr(now) : toDateStr(due),
                  paidAmount: isCash ? o.totalAmount : 0,
                }
              : o
          ),
        });

        return {
          ok: true,
          message: `${po.id} diterima. Stok bertambah${isCash ? ' dan dibayar tunai' : ', utang usaha tercatat'}. Jurnal ${journal.id} dibuat.`,
        };
      },

      payPO: (poId, amount, accountId) => {
        const state = get();
        const po = state.purchaseOrders.find((o) => o.id === poId);
        if (!po || po.status !== 'RECEIVED') return { ok: false, error: 'PO belum diterima atau tidak ditemukan.' };

        const remaining = po.totalAmount - po.paidAmount;
        if (remaining <= 0) return { ok: false, error: 'Utang PO ini sudah lunas.' };
        if (!(amount > 0)) return { ok: false, error: 'Nominal pembayaran harus lebih dari 0.' };
        if (amount > remaining) return { ok: false, error: `Nominal melebihi sisa utang (Rp ${remaining.toLocaleString('id-ID')}).` };

        const account = state.accounts.find((a) => a.id === accountId);
        if (!account) return { ok: false, error: 'Pilih sumber kas / bank.' };
        if (account.balance < amount) return { ok: false, error: `Saldo ${account.name} tidak cukup.` };

        const journal = makeJournal(state.journalSeq, {
          description: `Pembayaran utang ${po.id} (${po.supplierName})`,
          debitAccount: '201 - Utang Usaha (AP)',
          creditAccount: `${account.id} - ${account.name}`,
          amount,
          type: 'PAYABLE',
        });

        set({
          journals: [journal, ...state.journals],
          journalSeq: state.journalSeq + 1,
          accounts: state.accounts.map((a) => (a.id === accountId ? { ...a, balance: a.balance - amount } : a)),
          purchaseOrders: state.purchaseOrders.map((o) => (o.id === poId ? { ...o, paidAmount: o.paidAmount + amount } : o)),
        });

        return { ok: true, message: `Pembayaran Rp ${amount.toLocaleString('id-ID')} untuk ${po.id} dicatat. Jurnal ${journal.id} dibuat.` };
      },

      cancelPO: (poId) => {
        const state = get();
        const po = state.purchaseOrders.find((o) => o.id === poId);
        if (!po) return { ok: false, error: 'PO tidak ditemukan.' };
        if (po.status !== 'PENDING') return { ok: false, error: 'Hanya PO yang belum diterima yang bisa dibatalkan.' };
        set({ purchaseOrders: state.purchaseOrders.map((o) => (o.id === poId ? { ...o, status: 'CANCELLED' as const } : o)) });
        return { ok: true, message: `${po.id} dibatalkan.` };
      },

      resetDemoData: () => set(initialData()),
    }),
    {
      name: 'toserba-erp-v1',
      version: 2,
      // v2: produk mendapat field `cost` (harga modal). Data lama di browser dimigrasi otomatis.
      migrate: (persisted, version) => {
        const state = persisted as ErpState;
        if (version < 2 && Array.isArray(state?.products)) {
          state.products = state.products.map((p) => ({
            ...p,
            cost: p.cost ?? SEED_COSTS[p.id] ?? Math.round((p.price * 0.8) / 100) * 100,
          }));
        }
        return state;
      },
    }
  )
);

/**
 * Hindari hydration mismatch: data persist (localStorage) baru dipakai
 * setelah komponen mounted di browser.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

/* =========================================================================
   HELPER PURCHASING
   ========================================================================= */

/** Sisa utang (AP) sebuah PO. Hanya PO yang sudah diterima yang menimbulkan utang. */
export const getPoRemaining = (po: PurchaseOrder) =>
  po.status === 'RECEIVED' ? Math.max(0, po.totalAmount - po.paidAmount) : 0;