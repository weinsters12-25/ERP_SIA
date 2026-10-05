'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DollarSign, 
  Search, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  X, 
  User, 
  PhoneCall 
} from 'lucide-react';

// Mock Data Piutang Pelanggan
const MOCK_RECEIVABLES = [
  {
    id: 'AR-2026-001',
    customerName: 'Toko Kelontong Bu Sri',
    phone: '081234567890',
    invoiceDate: '2026-09-10',
    dueDate: '2026-09-24',
    totalAmount: 1250000,
    paidAmount: 0,
    remainingAmount: 1250000,
    status: 'OVERDUE', // OVERDUE, DUE_SOON, PAID
  },
  {
    id: 'AR-2026-002',
    customerName: 'Warung Makan Pak Joko',
    phone: '085711223344',
    invoiceDate: '2026-09-18',
    dueDate: '2026-09-28',
    totalAmount: 850000,
    paidAmount: 200000,
    remainingAmount: 650000,
    status: 'DUE_SOON',
  },
  {
    id: 'AR-2026-003',
    customerName: 'Catering Berkah',
    phone: '081987654321',
    invoiceDate: '2026-09-01',
    dueDate: '2026-09-15',
    totalAmount: 2100000,
    paidAmount: 2100000,
    remainingAmount: 0,
    status: 'PAID',
  },
];

export default function SalesPage() {
  const [search, setSearch] = useState('');
  const [selectedAr, setSelectedAr] = useState<typeof MOCK_RECEIVABLES[0] | null>(null);
  const [isWaModalOpen, setIsWaModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [isSuccessAlert, setIsSuccessAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const filteredAr = MOCK_RECEIVABLES.filter(
    (item) =>
      item.customerName.toLowerCase().includes(search.toLowerCase()) ||
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.phone.includes(search)
  );

  const handleOpenWaModal = (ar: typeof MOCK_RECEIVABLES[0]) => {
    setSelectedAr(ar);
    setIsWaModalOpen(true);
  };

  const handleSendWa = () => {
    setIsWaModalOpen(false);
    setAlertMessage(`Notifikasi WhatsApp Pengingat Bon berhasil dikirim ke ${selectedAr?.customerName}!`);
    setIsSuccessAlert(true);
    setTimeout(() => setIsSuccessAlert(false), 3000);
  };

  const handleOpenPayModal = (ar: typeof MOCK_RECEIVABLES[0]) => {
    setSelectedAr(ar);
    setPayAmount(ar.remainingAmount);
    setIsPayModalOpen(true);
  };

  const handleSavePayment = () => {
    setIsPayModalOpen(false);
    setAlertMessage(`Pembayaran piutang ${selectedAr?.customerName} berhasil diproses!`);
    setIsSuccessAlert(true);
    setTimeout(() => setIsSuccessAlert(false), 3000);
  };

  return (
    <div className="space-y-6 relative z-10">
      {/* Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Siklus Pendapatan & Piutang (AR)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manajemen Buku Bon Pelanggan, Pembayaran Piutang, & Otomasi Pengingat WhatsApp
          </p>
        </div>
      </div>

      {/* Ringkasan Kartu Piutang */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="glass-card-light rounded-2xl p-5 border-l-4 border-l-indigo-500">
          <p className="text-xs font-semibold text-slate-500">Total Piutang Aktif (AR)</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">Rp 1.900.000</p>
          <p className="text-[11px] text-slate-400 mt-1">2 Pelanggan memiliki sisa bon</p>
        </div>
        <div className="glass-card-light rounded-2xl p-5 border-l-4 border-l-rose-500">
          <p className="text-xs font-semibold text-slate-500">Piutang Jatuh Tempo (Overdue)</p>
          <p className="text-2xl font-black text-rose-600 mt-1">Rp 1.250.000</p>
          <p className="text-[11px] text-slate-400 mt-1">1 Nota melewati batas pembayaran</p>
        </div>
        <div className="glass-card-light rounded-2xl p-5 border-l-4 border-l-emerald-500">
          <p className="text-xs font-semibold text-slate-500">Piutang Terbayar Bulan Ini</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">Rp 2.100.000</p>
          <p className="text-[11px] text-slate-400 mt-1">Tercatat di Jurnal Penerimaan Kas</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-card-light rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari Pelanggan, No AR, No HP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Tabel Piutang Pelanggan */}
      <div className="glass-card-light rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">No AR & Pelanggan</th>
                <th className="py-3.5 px-4">Jatuh Tempo</th>
                <th className="py-3.5 px-4">Total Bon</th>
                <th className="py-3.5 px-4">Sisa Tagihan</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAr.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 border border-indigo-100">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{item.customerName}</p>
                        <span className="text-[10px] font-mono text-slate-400">{item.id} • {item.phone}</span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-medium text-slate-600">
                    {item.dueDate}
                  </td>

                  <td className="py-3.5 px-4 font-bold text-slate-700">
                    Rp {item.totalAmount.toLocaleString('id-ID')}
                  </td>

                  <td className="py-3.5 px-4 font-black text-slate-900">
                    Rp {item.remainingAmount.toLocaleString('id-ID')}
                  </td>

                  <td className="py-3.5 px-4">
                    {item.status === 'PAID' ? (
                      <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md font-bold text-[11px]">
                        Lunas
                      </span>
                    ) : item.status === 'OVERDUE' ? (
                      <span className="bg-rose-100 text-rose-800 px-2.5 py-1 rounded-md font-bold text-[11px]">
                        Lewat Jatuh Tempo
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-md font-bold text-[11px]">
                        Mendekati Tempo
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-right space-x-2">
                    {item.remainingAmount > 0 && (
                      <>
                        <button
                          onClick={() => handleOpenWaModal(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-lg font-bold text-xs transition-colors"
                        >
                          <Send className="h-3.5 w-3.5" /> WA Alert
                        </button>
                        <button
                          onClick={() => handleOpenPayModal(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg font-bold text-xs shadow-xs transition-colors"
                        >
                          Bayar Bon
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL PREVIEW WHATSAPP ALERT */}
      <AnimatePresence>
        {isWaModalOpen && selectedAr && (
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
                onClick={() => setIsWaModalOpen(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Kirim WhatsApp Alert</h3>
                  <p className="text-xs text-slate-500">{selectedAr.customerName} ({selectedAr.phone})</p>
                </div>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 text-xs text-slate-700 space-y-2 font-sans">
                <p className="font-bold text-emerald-800">[Pratinjau Pesan WA]</p>
                <p>Halo Yth. <strong>{selectedAr.customerName}</strong>,</p>
                <p>
                  Pengingat dari <strong>Toserba ERP</strong>. Tagihan bon Anda sebesar{' '}
                  <strong className="text-rose-600">Rp {selectedAr.remainingAmount.toLocaleString('id-ID')}</strong> untuk nota{' '}
                  <strong>{selectedAr.id}</strong> jatuh tempo pada <strong>{selectedAr.dueDate}</strong>.
                </p>
                <p>Mohon untuk melakukan pelunasan melalui transfer / tunai di kasir toko. Terima kasih!</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsWaModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSendWa}
                  className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-500 shadow-md flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Send className="h-3.5 w-3.5" /> Kirim Sekarang
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL BAYAR BON */}
      <AnimatePresence>
        {isPayModalOpen && selectedAr && (
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
                onClick={() => setIsPayModalOpen(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>

              <div>
                <h3 className="text-base font-bold text-slate-800">Pelunasan Piutang / Bon</h3>
                <p className="text-xs text-slate-500">{selectedAr.customerName} ({selectedAr.id})</p>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nominal Pembayaran (Rp)</label>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-sm font-black text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Sisa bon saat ini: <strong>Rp {selectedAr.remainingAmount.toLocaleString('id-ID')}</strong>
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsPayModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSavePayment}
                  className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-500 shadow-md transition-colors"
                >
                  Proses Pembayaran
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NOTIFIKASI BERHASIL */}
      <AnimatePresence>
        {isSuccessAlert && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl z-50 flex items-center gap-3 text-xs font-semibold"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span>{alertMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}