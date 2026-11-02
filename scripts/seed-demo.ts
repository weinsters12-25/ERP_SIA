/**
 * Generator data demo Toserba ERP.
 *
 * Pemakaian (dari root proyek):
 *   npx tsx scripts/seed-demo.ts            -> buat data demo
 *   npx tsx scripts/seed-demo.ts --clear    -> kosongkan data di browser (tulis dataset kosong)
 *   npx tsx scripts/seed-demo.ts --remove   -> hapus file demo (data di browser dibiarkan)
 *
 * Script menulis public/demo-data.json. Saat aplikasi dibuka, jika `seedId` di file
 * berbeda dari yang pernah dimuat, data otomatis dimasukkan ke store. Tanggal dibuat
 * relatif terhadap hari ini supaya status kadaluarsa & jatuh tempo selalu realistis.
 */
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/* ---------- tipe (cermin dari src/stores/useErpStore.ts) ---------- */

interface Batch { batchNo: string; qty: number; expiredDate: string }
interface Product {
  id: string; sku: string; name: string; category: string; unit: string;
  price: number; cost: number; minStock: number; batches: Batch[];
}
interface Journal {
  id: string; date: string; description: string; debitAccount: string;
  creditAccount: string; amount: number;
  type: 'SALES' | 'EXPENSE' | 'RECEIVABLE' | 'PAYABLE' | 'ADJUSTMENT' | 'PURCHASE' | 'COGS';
}
interface Receivable {
  id: string; invoiceNo: string; customerName: string; phone: string;
  invoiceDate: string; dueDate: string; totalAmount: number; paidAmount: number;
}
interface CashAccount { id: string; name: string; balance: number; type: 'CASH' | 'BANK' }
interface Supplier { id: string; code: string; name: string; phone: string }
interface PoItem { productId: string; name: string; unit: string; qty: number; unitCost: number }
interface PurchaseOrder {
  id: string; supplierId: string; supplierName: string; date: string;
  receivedDate: string | null; dueDate: string | null; paymentTerm: 'CASH' | 'CREDIT';
  termDays: number; status: 'PENDING' | 'RECEIVED' | 'CANCELLED'; items: PoItem[];
  totalAmount: number; paidAmount: number;
}
interface ErpData {
  products: Product[]; journals: Journal[]; receivables: Receivable[];
  accounts: CashAccount[]; suppliers: Supplier[]; purchaseOrders: PurchaseOrder[];
  invoiceSeq: number; journalSeq: number; arSeq: number; batchSeq: number;
  poSeq: number; supplierSeq: number;
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
const YEAR = new Date().getFullYear();

/* ---------- dataset ---------- */

const emptyAccounts = (): CashAccount[] => [
  { id: '101', name: 'Kas Kasir POS', balance: 0, type: 'CASH' },
  { id: '102', name: 'Kas Kecil Operasional', balance: 0, type: 'CASH' },
  { id: '103', name: 'Bank BCA Toko', balance: 0, type: 'BANK' },
];

function emptyData(): ErpData {
  return {
    products: [], journals: [], receivables: [], accounts: emptyAccounts(), suppliers: [],
    purchaseOrders: [], invoiceSeq: 1, journalSeq: 1, arSeq: 1, batchSeq: 1, poSeq: 1, supplierSeq: 1,
  };
}

function demoData(): ErpData {
  const b = (n: number) => `BATCH-${YEAR}-${pad(n)}`;

  const products: Product[] = [
    { id: '1', sku: 'BRS-001', name: 'Beras Setra Ramos 5kg', category: 'Beras & Biji', unit: 'Pouch', price: 72000, cost: 62000, minStock: 10,
      batches: [{ batchNo: b(1), qty: 15, expiredDate: ds(14) }, { batchNo: b(5), qty: 30, expiredDate: ds(200) }] },
    { id: '2', sku: 'MYK-001', name: 'Minyak Goreng Bimoli 2L', category: 'Minyak & Bumbu', unit: 'Pouch', price: 36000, cost: 30000, minStock: 15,
      batches: [{ batchNo: b(3), qty: 8, expiredDate: ds(26) }] },
    { id: '3', sku: 'GLA-001', name: 'Gula Pasir Gulaku 1kg', category: 'Sembako', unit: 'Kg', price: 17500, cost: 15000, minStock: 20,
      batches: [{ batchNo: b(2), qty: 120, expiredDate: ds(500) }] },
    { id: '4', sku: 'TLR-001', name: 'Telur Ayam Negeri (Peti)', category: 'Sembako Basah', unit: 'Kg', price: 28000, cost: 24000, minStock: 10,
      batches: [{ batchNo: b(9), qty: 25, expiredDate: ds(9) }] },
    { id: '5', sku: 'TRG-001', name: 'Tepung Terigu Segitiga Biru 1kg', category: 'Sembako', unit: 'Pcs', price: 13000, cost: 11000, minStock: 20,
      batches: [{ batchNo: b(6), qty: 60, expiredDate: ds(300) }] },
    { id: '6', sku: 'SMR-001', name: 'Indomie Goreng Spesial (Dus)', category: 'Mie & Kaleng', unit: 'Dus', price: 112000, cost: 90000, minStock: 10,
      batches: [{ batchNo: b(7), qty: 40, expiredDate: ds(170) }] },
  ];

  const suppliers: Supplier[] = [
    { id: '1', code: 'SUP-IND-01', name: 'PT Indofood Sukses Makmur', phone: '081234567890' },
    { id: '2', code: 'SUP-BRS-02', name: 'CV Beras Utama Jaya', phone: '081987654321' },
    { id: '3', code: 'SUP-BIM-03', name: 'Distributor Minyak Bimoli', phone: '085211223344' },
  ];

  const purchaseOrders: PurchaseOrder[] = [
    { id: `PO-${YEAR}-001`, supplierId: '2', supplierName: suppliers[1].name, date: ds(-12), receivedDate: ds(-11),
      dueDate: ds(19), paymentTerm: 'CREDIT', termDays: 30, status: 'RECEIVED', paidAmount: 0, totalAmount: 12400000,
      items: [{ productId: '1', name: products[0].name, unit: 'Pouch', qty: 200, unitCost: 62000 }] },
    { id: `PO-${YEAR}-002`, supplierId: '3', supplierName: suppliers[2].name, date: ds(-10), receivedDate: ds(-9),
      dueDate: ds(5), paymentTerm: 'CREDIT', termDays: 14, status: 'RECEIVED', paidAmount: 7200000, totalAmount: 7200000,
      items: [{ productId: '2', name: products[1].name, unit: 'Pouch', qty: 240, unitCost: 30000 }] },
    { id: `PO-${YEAR}-003`, supplierId: '1', supplierName: suppliers[0].name, date: ds(-7), receivedDate: null,
      dueDate: null, paymentTerm: 'CREDIT', termDays: 30, status: 'PENDING', paidAmount: 0, totalAmount: 4500000,
      items: [{ productId: '6', name: products[5].name, unit: 'Dus', qty: 50, unitCost: 90000 }] },
  ];

  const receivables: Receivable[] = [
    { id: `AR-${YEAR}-001`, invoiceNo: 'INV-1070', customerName: 'Toko Kelontong Bu Sri', phone: '081234567890',
      invoiceDate: ds(-20), dueDate: ds(-6), totalAmount: 1250000, paidAmount: 0 },
    { id: `AR-${YEAR}-002`, invoiceNo: 'INV-1081', customerName: 'Warung Makan Pak Joko', phone: '085711223344',
      invoiceDate: ds(-12), dueDate: ds(5), totalAmount: 850000, paidAmount: 200000 },
    { id: `AR-${YEAR}-003`, invoiceNo: 'INV-1055', customerName: 'Catering Berkah', phone: '081987654321',
      invoiceDate: ds(-30), dueDate: ds(-16), totalAmount: 2100000, paidAmount: 2100000 },
  ];

  // Jurnal dibuat kronologis (lama -> baru) lalu dibalik supaya terbaru di atas
  const chrono: Omit<Journal, 'id'>[] = [
    { date: dts(-11, 10, 5), description: `Pembelian kredit PO-${YEAR}-001 (${suppliers[1].name})`, debitAccount: '105 - Persediaan Barang', creditAccount: '201 - Utang Usaha (AP)', amount: 12400000, type: 'PURCHASE' },
    { date: dts(-9, 9, 40), description: `Pembelian kredit PO-${YEAR}-002 (${suppliers[2].name})`, debitAccount: '105 - Persediaan Barang', creditAccount: '201 - Utang Usaha (AP)', amount: 7200000, type: 'PURCHASE' },
    { date: dts(-2, 9, 15), description: `Pembayaran utang PO-${YEAR}-002 (${suppliers[2].name})`, debitAccount: '201 - Utang Usaha (AP)', creditAccount: '103 - Bank BCA Toko', amount: 7200000, type: 'PAYABLE' },
    { date: dts(-1, 16, 30), description: 'Pelunasan piutang (Catering Berkah) - INV-1055', debitAccount: '103 - Bank BCA Toko', creditAccount: '104 - Piutang Usaha (AR)', amount: 2100000, type: 'RECEIVABLE' },
    { date: dts(0, 11, 0), description: 'Pembayaran listrik & air toko', debitAccount: '501 - Beban Operasional', creditAccount: '102 - Kas Kecil Operasional', amount: 450000, type: 'EXPENSE' },
    { date: dts(0, 14, 20), description: 'Penjualan Kasir POS (Nota #INV-1092)', debitAccount: '101 - Kas Kasir POS', creditAccount: '401 - Pendapatan Penjualan', amount: 325000, type: 'SALES' },
    { date: dts(0, 14, 20), description: 'HPP penjualan (Nota #INV-1092)', debitAccount: '601 - Harga Pokok Penjualan', creditAccount: '105 - Persediaan Barang', amount: 270000, type: 'COGS' },
  ];
  const journals: Journal[] = chrono
    .map((j, i) => ({ ...j, id: `JRN-${YEAR}-${String(i + 1).padStart(3, '0')}` }))
    .reverse();

  const accounts = emptyAccounts();
  accounts[0].balance = 3250000;
  accounts[1].balance = 1500000;
  accounts[2].balance = 45800000;

  return {
    products, journals, receivables, accounts, suppliers, purchaseOrders,
    invoiceSeq: 1093, journalSeq: chrono.length + 1, arSeq: 4, batchSeq: 10, poSeq: 4, supplierSeq: 4,
  };
}

/* ---------- main ---------- */

const outDir = join(process.cwd(), 'public');
const outFile = join(outDir, 'demo-data.json');
const arg = process.argv[2];

if (arg === '--remove') {
  if (existsSync(outFile)) {
    unlinkSync(outFile);
    console.log('✔ public/demo-data.json dihapus. Data yang sudah ada di browser tidak diubah.');
  } else {
    console.log('Tidak ada file demo untuk dihapus.');
  }
  process.exit(0);
}

const clear = arg === '--clear';
const payload = {
  seedId: `${clear ? 'empty' : 'demo'}-${Date.now()}`,
  label: clear ? 'Dataset kosong' : 'Data demo Toserba',
  generatedAt: new Date().toISOString(),
  data: clear ? emptyData() : demoData(),
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf-8');

console.log(`✔ ${payload.label} ditulis ke public/demo-data.json (seedId: ${payload.seedId})`);
console.log('  Refresh browser agar data dimuat ke aplikasi.');