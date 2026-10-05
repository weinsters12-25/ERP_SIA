'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, 
  Search, 
  AlertTriangle, 
  Calendar, 
  Edit3, 
  Plus, 
  Clock, 
  CheckCircle2, 
  X 
} from 'lucide-react';

// Mock Data Inventaris Sembako dengan Batch FEFO
const MOCK_INVENTORY = [
  {
    id: '1',
    sku: 'BRS-001',
    name: 'Beras Setra Ramos 5kg',
    category: 'Beras & Biji',
    totalStock: 45,
    unit: 'Pouch',
    minStock: 10,
    batches: [
      { batchNo: 'BATCH-2026-01', qty: 15, expiredDate: '2026-10-15', status: 'kritis' },
      { batchNo: 'BATCH-2026-05', qty: 30, expiredDate: '2027-05-20', status: 'aman' },
    ],
  },
  {
    id: '2',
    sku: 'MYK-001',
    name: 'Minyak Goreng Bimoli 2L',
    category: 'Minyak & Bumbu',
    totalStock: 8,
    unit: 'Pouch',
    minStock: 15,
    batches: [
      { batchNo: 'BATCH-2026-03', qty: 8, expiredDate: '2026-11-01', status: 'peringatan' },
    ],
  },
  {
    id: '3',
    sku: 'TLR-001',
    name: 'Telur Ayam Negeri (Peti)',
    category: 'Sembako Basah',
    totalStock: 25,
    unit: 'Kg',
    minStock: 10,
    batches: [
      { batchNo: 'BATCH-2026-09', qty: 25, expiredDate: '2026-10-05', status: 'kritis' },
    ],
  },
  {
    id: '4',
    sku: 'GLA-001',
    name: 'Gula Pasir Gulaku 1kg',
    category: 'Sembako',
    totalStock: 120,
    unit: 'Kg',
    minStock: 20,
    batches: [
      { batchNo: 'BATCH-2026-02', qty: 120, expiredDate: '2028-01-10', status: 'aman' },
    ],
  },
];

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<typeof MOCK_INVENTORY[0] | null>(null);
  const [isOpnameOpen, setIsOpnameOpen] = useState(false);
  const [opnameQty, setOpnameQty] = useState<number>(0);
  const [opnameReason, setOpnameReason] = useState('Penyusutan Wajar');
  const [isSuccessAlert, setIsSuccessAlert] = useState(false);

  const filteredInventory = MOCK_INVENTORY.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.sku.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenOpname = (product: typeof MOCK_INVENTORY[0]) => {
    setSelectedProduct(product);
    setOpnameQty(product.totalStock);
    setIsOpnameOpen(true);
  };

  const handleSaveOpname = () => {
    setIsOpnameOpen(false);
    setIsSuccessAlert(true);
    setTimeout(() => setIsSuccessAlert(false), 2500);
  };

  return (
    <div className="space-y-6 relative z-10">
      {/* Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Manajemen Stok & Kontrol FEFO</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pengelolaan stok barang, tracking kadaluarsa batch, & stock opname
          </p>
        </div>
        <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition-all">
          <Plus className="h-4 w-4" />
          <span>+ Tambah Stok / Batch Baru</span>
        </button>
      </div>

      {/* Top Controls: Search & Filter */}
      <div className="glass-card-light rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari SKU, Nama Barang, Kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 w-full sm:w-auto justify-end">
          <span className="flex items-center gap-1 bg-rose-50 border border-rose-200 text-rose-600 px-2.5 py-1 rounded-md font-semibold">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            Batch Kritis
          </span>
          <span className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-600 px-2.5 py-1 rounded-md font-semibold">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Risiko 30 Hari
          </span>
        </div>
      </div>

      {/* Tabel Inventaris */}
      <div className="glass-card-light rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">SKU & Produk</th>
                <th className="py-3.5 px-4">Kategori</th>
                <th className="py-3.5 px-4">Total Stok</th>
                <th className="py-3.5 px-4">Batch FEFO & Expired</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInventory.map((item) => {
                const isLowStock = item.totalStock <= item.minStock;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* SKU & Nama */}
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100">
                          <Package className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{item.name}</p>
                          <span className="text-[10px] font-mono text-slate-400">{item.sku}</span>
                        </div>
                      </div>
                    </td>

                    {/* Kategori */}
                    <td className="py-3.5 px-4">
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-medium text-[11px]">
                        {item.category}
                      </span>
                    </td>

                    {/* Total Stok */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-black text-sm ${isLowStock ? 'text-rose-600' : 'text-slate-800'}`}>
                          {item.totalStock} {item.unit}
                        </span>
                        {isLowStock && (
                          <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">
                            Menipis
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Batch FEFO List */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1.5">
                        {item.batches.map((b, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-2 text-[11px] px-2.5 py-1 rounded-md border ${
                              b.status === 'kritis'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : b.status === 'peringatan'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            <Calendar className="h-3 w-3" />
                            <span className="font-mono font-bold">{b.batchNo}</span>
                            <span>({b.qty} {item.unit})</span>
                            <span className="ml-auto font-semibold">{b.expiredDate}</span>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Tombol Aksi */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenOpname(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg text-xs font-semibold transition-all"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Opname</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL STOCK OPNAME */}
      <AnimatePresence>
        {isOpnameOpen && selectedProduct && (
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
              className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4 relative"
            >
              <button
                onClick={() => setIsOpnameOpen(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>

              <div>
                <h3 className="text-base font-bold text-slate-800">Stock Opname / Penyesuaian</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedProduct.name} ({selectedProduct.sku})</p>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Stok Fisik Aktual ({selectedProduct.unit})
                  </label>
                  <input
                    type="number"
                    value={opnameQty}
                    onChange={(e) => setOpnameQty(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-sm font-bold text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Stok sistem saat ini: <span className="font-bold">{selectedProduct.totalStock} {selectedProduct.unit}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Alasan Selisih Stok
                  </label>
                  <select
                    value={opnameReason}
                    onChange={(e) => setOpnameReason(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
                  >
                    <option value="Penyusutan Wajar">Penyusutan Wajar (Susut Beras/Gula)</option>
                    <option value="Barang Rusak/Pecah">Barang Rusak / Pecah dalam Toko</option>
                    <option value="Barang Kadaluarsa">Barang Kadaluarsa / Basi</option>
                    <option value="Koreksi Input">Koreksi Salah Input</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setIsOpnameOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveOpname}
                  className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-500 shadow-md transition-colors"
                >
                  Simpan Penyesuaian
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NOTIFIKASI SUKSES OPNAME */}
      <AnimatePresence>
        {isSuccessAlert && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-emerald-800 text-white px-4 py-3 rounded-xl shadow-xl z-50 flex items-center gap-3 text-xs font-semibold"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            <span>Stock opname berhasil disimpan dan jurnal penyesuaian tercatat!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}