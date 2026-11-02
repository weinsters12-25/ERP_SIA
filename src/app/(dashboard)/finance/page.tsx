'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Wallet, Building, CheckCircle2, X, Receipt } from 'lucide-react';
import { useErpStore, useHydrated } from '@/stores/useErpStore';
import { ErrorBox } from '@/components/ErpUi';

export default function FinancePage() {
  const hydrated = useHydrated();
  const accounts = useErpStore((s) => s.accounts);
  const journals = useErpStore((s) => s.journals);
  const addExpense = useErpStore((s) => s.addExpense);

  const [search, setSearch] = useState('');
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [selectedSourceAccount, setSelectedSourceAccount] = useState('102');
  const [error, setError] = useState('');
  const [isSuccessAlert, setIsSuccessAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const filteredJournals = useMemo(() => {
    const q = search.toLowerCase();
    return journals.filter(
      (j) =>
        j.description.toLowerCase().includes(q) ||
        j.id.toLowerCase().includes(q) ||
        j.debitAccount.toLowerCase().includes(q) ||
        j.creditAccount.toLowerCase().includes(q)
    );
  }, [journals, search]);

  const openModal = () => {
    setError('');
    setExpenseTitle('');
    setExpenseAmount(0);
    setIsExpenseModalOpen(true);
  };

  const handleSaveExpense = () => {
    const res = addExpense(expenseTitle, expenseAmount, selectedSourceAccount);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setIsExpenseModalOpen(false);
    setAlertMessage(res.message);
    setIsSuccessAlert(true);
    setTimeout(() => setIsSuccessAlert(false), 2500);
  };

  if (!hydrated) return <p className="text-sm text-slate-500">Memuat data keuangan…</p>;

  return (
    <div className="space-y-6 relative z-10">
      {/* Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Manajemen Keuangan & Jurnal Otomatis</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Buku Besar Double-Entry, Saldo Kas/Bank, & Pencatatan Biaya Operasional
          </p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-md transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>Catat Biaya Operasional</span>
        </button>
      </div>

      {/* Kartu Saldo Kas & Bank */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {accounts.map((acc) => (
          <div key={acc.id} className="glass-card-light rounded-2xl p-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 font-mono">{acc.id}</span>
              {acc.type === 'CASH' ? (
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                  <Wallet className="h-4 w-4" />
                </div>
              ) : (
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                  <Building className="h-4 w-4" />
                </div>
              )}
            </div>
            <p className="text-xs font-bold text-slate-700 mt-3">{acc.name}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              Rp {acc.balance.toLocaleString('id-ID')}
            </p>
          </div>
        ))}
      </div>

      {/* Search & Header Tabel */}
      <div className="glass-card-light rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari No Jurnal, Keterangan, Akun..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all"
          />
        </div>
        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
          Double-Entry Balanced
        </span>
      </div>

      {/* Tabel Jurnal Umum Otomatis */}
      <div className="glass-card-light rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">No Jurnal & Waktu</th>
                <th className="py-3.5 px-4">Keterangan Transaksi</th>
                <th className="py-3.5 px-4">Akun Debit</th>
                <th className="py-3.5 px-4">Akun Kredit</th>
                <th className="py-3.5 px-4 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredJournals.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-slate-400">
                    {journals.length === 0
                      ? 'Belum ada jurnal. Jurnal terbentuk otomatis dari transaksi POS, PO, dan biaya operasional.'
                      : 'Tidak ada jurnal yang cocok dengan pencarian.'}
                  </td>
                </tr>
              )}
              {filteredJournals.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-800">
                    <div>
                      <p className="font-bold text-slate-900 font-mono">{j.id}</p>
                      <span className="text-[10px] text-slate-400">{j.date}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-bold text-slate-800">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-slate-400" />
                      <span>{j.description}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-medium text-emerald-700">
                    <span className="bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                      {j.debitAccount}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 font-medium text-rose-700">
                    <span className="bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md">
                      {j.creditAccount}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right font-black text-slate-900">
                    Rp {j.amount.toLocaleString('id-ID')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CATAT BIAYA OPERASIONAL */}
      <AnimatePresence>
        {isExpenseModalOpen && (
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
                onClick={() => setIsExpenseModalOpen(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>

              <div>
                <h3 className="text-base font-bold text-slate-800">Catat Biaya Operasional</h3>
                <p className="text-xs text-slate-500 mt-0.5">Pengeluaran kas untuk operasional toko sembako</p>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Keterangan Biaya</label>
                  <input
                    type="text"
                    placeholder="Contoh: Pembelian Plastik, Bensin Kurir, Gaji Pegawai"
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-xs text-slate-800 focus:border-rose-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nominal Biaya (Rp)</label>
                  <input
                    type="number"
                    value={expenseAmount || ''}
                    onChange={(e) => setExpenseAmount(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-xs font-bold text-slate-800 focus:border-rose-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Sumber Kas / Bank</label>
                  <select
                    value={selectedSourceAccount}
                    onChange={(e) => setSelectedSourceAccount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-xs text-slate-800 focus:border-rose-500 focus:outline-none"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.id} - {a.name} (Saldo: Rp {a.balance.toLocaleString('id-ID')})
                      </option>
                    ))}
                  </select>
                </div>

                <ErrorBox text={error} />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveExpense}
                  className="flex-1 py-2.5 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-500 shadow-md transition-colors"
                >
                  Simpan Biaya & Jurnal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NOTIFIKASI SUKSES */}
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