'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  Truck, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Building2, 
  CreditCard 
} from 'lucide-react';

// Mock Data Supplier
const MOCK_SUPPLIERS = [
  { id: '1', name: 'PT Indofood Sukses Makmur', code: 'SUP-IND-01', phone: '081234567890' },
  { id: '2', name: 'CV Beras Utama Jaya', code: 'SUP-BRS-02', phone: '081987654321' },
  { id: '3', name: 'Distributor Minyak Bimoli', code: 'SUP-[#56AB2F]', phone: '085211223344' },
];

// Mock Data Purchase Orders
const MOCK_ORDERS = [
  {
    id: 'PO-2026-001',
    supplier: 'CV Beras Utama Jaya',
    date: '2026-09-20',
    dueDate: '2026-10-20',
    totalAmount: 14400000,
    status: 'RECEIVED', // RECEIVED, PENDING, CANCELLED
    paymentStatus: 'UNPAID', // PAID, UNPAID, PARTIAL
    itemsCount: 200,
  },
  {
    id: 'PO-2026-002',
    supplier: 'Distributor Minyak Bimoli',
    date: '2026-09-22',
    dueDate: '2026-10-06',
    totalAmount: 7200000,
    status: 'RECEIVED',
    paymentStatus: 'PAID',
    itemsCount: 100,
  },
  {
    id: 'PO-2026-003',
    supplier: 'PT Indofood Sukses Makmur',
    date: '2026-09-25',
    dueDate: '2026-10-25',
    totalAmount: 4500000,
    status: 'PENDING',
    paymentStatus: 'UNPAID',
    itemsCount: 50,
  },
];

export default function PurchasingPage() {
  const [search, setSearch] = useState('');
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(MOCK_SUPPLIERS[0].id);
  const [poQty, setPoQty] = useState(10);
  const [isSuccess, setIsSuccess] = useState(false);

  const filteredOrders = MOCK_ORDERS.filter(
    (order) =>
      order.id.toLowerCase().includes(search.toLowerCase()) ||
      order.supplier.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreatePo = () => {
    setIsPoModalOpen(false);
    setIsSuccess(true);
    setTimeout(() => setIsSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 relative z-10">
      {/* Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Siklus Pengeluaran & Pembelian (PO)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manajemen Purchase Order, Utang Distributor (AP), & Penerimaan Barang
          </p>
        </div>
        <button
          onClick={() => setIsPoModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow-md transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>+ Buat Purchase Order (PO)</span>
        </button>
      </div>

      {/* Ringkasan Kartu AP / Utang */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="glass-card-light rounded-2xl p-5 border-l-4 border-l-amber-500">
          <p className="text-xs font-semibold text-slate-500">Total Utang Usaha (AP)</p>
          <p className="text-2xl font-black text-amber-600 mt-1">Rp 18.900.000</p>
          <p className="text-[11px] text-slate-400 mt-1">2 Supplier belum lunas</p>
        </div>
        <div className="glass-card-light rounded-2xl p-5 border-l-4 border-l-rose-500">
          <p className="text-xs font-semibold text-slate-500">Jatuh Tempo Mgg Ini</p>
          <p className="text-2xl font-black text-rose-600 mt-1">Rp 7.200.000</p>
          <p className="text-[11px] text-slate-400 mt-1">1 Nota jatuh tempo &lt; 7 Hari</p>
        </div>
        <div className="glass-card-light rounded-2xl p-5 border-l-4 border-l-emerald-500">
          <p className="text-xs font-semibold text-slate-500">Total Terbayar Bulan Ini</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">Rp 12.500.000</p>
          <p className="text-[11px] text-slate-400 mt-1">Sesuai jurnal pengeluaran kas</p>
        </div>
      </div>

      {/* Search Bar & Table Header */}
      <div className="glass-card-light rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari No PO / Nama Supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:bg-white focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Tabel Purchase Order */}
      <div className="glass-card-light rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">No PO & Tanggal</th>
                <th className="py-3.5 px-4">Supplier</th>
                <th className="py-3.5 px-4">Nominal</th>
                <th className="py-3.5 px-4">Status Barang</th>
                <th className="py-3.5 px-4">Status Utang</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-800">
                    <div>
                      <p className="font-bold text-slate-900 font-mono">{po.id}</p>
                      <span className="text-[11px] text-slate-400">{po.date}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <span className="font-bold text-slate-800">{po.supplier}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-black text-slate-800">
                    Rp {po.totalAmount.toLocaleString('id-ID')}
                  </td>

                  <td className="py-3.5 px-4">
                    {po.status === 'RECEIVED' ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md font-bold text-[11px]">
                        <CheckCircle2 className="h-3 w-3" /> Diterima
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-md font-bold text-[11px]">
                        <Clock className="h-3 w-3" /> Menunggu Barang
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    {po.paymentStatus === 'PAID' ? (
                      <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md font-bold text-[11px]">
                        Lunas
                      </span>
                    ) : (
                      <span className="bg-rose-100 text-rose-800 px-2.5 py-1 rounded-md font-bold text-[11px]">
                        Belum Lunas (Jatuh Tempo: {po.dueDate})
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors">
                      Detail PO
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL BUAT PO BARU */}
      <AnimatePresence>
        {isPoModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full shadow-xl space-y-4 relative"
            >
              <button
                onClick={() => setIsPoModalOpen(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>

              <div>
                <h3 className="text-base font-bold text-slate-800">Buat Purchase Order (PO) Baru</h3>
                <p className="text-xs text-slate-500 mt-0.5">Pemesanan stok barang ke distributor / supplier</p>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Pilih Supplier</label>
                  <select
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-xs text-slate-800 focus:border-amber-500 focus:bg-white focus:outline-none"
                  >
                    {MOCK_SUPPLIERS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Pilih Produk</label>
                  <select className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-xs text-slate-800 focus:border-amber-500 focus:bg-white focus:outline-none">
                    <option>Beras Setra Ramos 5kg (Karung)</option>
                    <option>Minyak Goreng Bimoli 2L (Dus)</option>
                    <option>Indomie Goreng Spesial (Dus)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Jumlah Pemesanan</label>
                    <input
                      type="number"
                      value={poQty}
                      onChange={(e) => setPoQty(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-xs font-bold text-slate-800 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Sistem Pembayaran</label>
                    <select className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-xs text-slate-800 focus:border-amber-500 focus:outline-none">
                      <option value="CREDIT">Kredit (Tempo 30 Hari)</option>
                      <option value="CASH">Tunai (Langsung Lunas)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setIsPoModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleCreatePo}
                  className="flex-1 py-2.5 bg-amber-600 text-white font-bold rounded-xl text-xs hover:bg-amber-500 shadow-md transition-colors"
                >
                  Kirim Purchase Order
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NOTIFIKASI BERHASIL */}
      <AnimatePresence>
        {isSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl z-50 flex items-center gap-3 text-xs font-semibold"
          >
            <CheckCircle2 className="h-5 w-5 text-amber-400" />
            <span>Purchase Order berhasil diterbitkan & tercatat di Utang Usaha (AP)!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}