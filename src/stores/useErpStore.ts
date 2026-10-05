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
  minStock: number;
  batches: Batch[];
}

export type JournalType = 'SALES' | 'EXPENSE' | 'RECEIVABLE' | 'PAYABLE' | 'ADJUSTMENT';

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
  minStock: number;
  initialQty: number; // 0 = tanpa stok awal
  expiredDate: string; // wajib bila initialQty > 0
}

export type ProductPatch = Partial<Pick<Product, 'name' | 'category' | 'unit' | 'price' | 'minStock'>>;

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
    id: '1', sku: 'BRS-001', name: 'Beras Setra Ramos 5kg', category: 'Beras & Biji', unit: 'Pouch', price: 72000, minStock: 10,
    batches: [
      { batchNo: 'BATCH-2026-01', qty: 15, expiredDate: '2026-10-15' },
      { batchNo: 'BATCH-2026-05', qty: 30, expiredDate: '2027-05-20' },
    ],
  },
  {
    id: '2', sku: 'MYK-001', name: 'Minyak Goreng Bimoli 2L', category: 'Minyak & Bumbu', unit: 'Pouch', price: 36000, minStock: 15,
    batches: [{ batchNo: 'BATCH-2026-03', qty: 8, expiredDate: '2026-11-01' }],
  },
  {
    id: '3', sku: 'GLA-001', name: 'Gula Pasir Gulaku 1kg', category: 'Sembako', unit: 'Kg', price: 17500, minStock: 20,
    batches: [{ batchNo: 'BATCH-2026-02', qty: 120, expiredDate: '2028-01-10' }],
  },
  {
    id: '4', sku: 'TLR-001', name: 'Telur Ayam Negeri (Peti)', category: 'Sembako Basah', unit: 'Kg', price: 28000, minStock: 10,
    batches: [{ batchNo: 'BATCH-2026-09', qty: 25, expiredDate: '2026-10-12' }],
  },
  {
    id: '5', sku: 'TRG-001', name: 'Tepung Terigu Segitiga Biru 1kg', category: 'Sembako', unit: 'Pcs', price: 13000, minStock: 20,
    batches: [{ batchNo: 'BATCH-2026-06', qty: 60, expiredDate: '2027-08-20' }],
  },
  {
    id: '6', sku: 'SMR-001', name: 'Indomie Goreng Spesial (Dus)', category: 'Mie & Kaleng', unit: 'Dus', price: 112000, minStock: 10,
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
  invoiceSeq: number;
  journalSeq: number;
  arSeq: number;
  batchSeq: number;

  /** Proses penjualan POS: potong stok FEFO, buat jurnal, (opsional) buat piutang. */
  sellItems: (lines: SaleLine[], payment: PaymentInput) => SaleResult;

  /** Inventory */
  addProduct: (input: NewProductInput) => ActionResult;
  updateProduct: (id: string, patch: ProductPatch) => ActionResult;
  addBatch: (productId: string, qty: number, expiredDate: string) => ActionResult;
  /** Stock opname: samakan stok sistem dengan stok fisik, buat jurnal penyesuaian bila ada selisih. */
  adjustStock: (productId: string, actualQty: number, reason: string) => ActionResult;

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

        set({
          products,
          journals: [journal, ...state.journals],
          receivables,
          accounts,
          invoiceSeq: state.invoiceSeq + 1,
          journalSeq: state.journalSeq + 1,
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

        // Nilai sementara memakai harga jual (harga beli ditambahkan di Tahap 3)
        const journal = makeJournal(state.journalSeq, {
          description: `Stock opname ${product.name}: ${diff > 0 ? '+' : ''}${diff} ${product.unit} (${reason})`,
          debitAccount: diff < 0 ? '502 - Beban Selisih Stok' : '105 - Persediaan Barang',
          creditAccount: diff < 0 ? '105 - Persediaan Barang' : '502 - Beban Selisih Stok',
          amount: Math.abs(diff) * product.price,
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

      resetDemoData: () => set(initialData()),
    }),
    { name: 'toserba-erp-v1', version: 1 }
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