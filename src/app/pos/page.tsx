'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePosStore, CartItem } from '@/stores/usePosStore';
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  ArrowLeft, 
  CreditCard, 
  Banknote, 
  Package, 
  CheckCircle2 
} from 'lucide-react';
import Link from 'next/link';

// Mock Data Produk Sembako (Nanti disambungkan ke Supabase)
const MOCK_PRODUCTS = [
  { id: '1', sku: 'BRS-001', name: 'Beras Setra Ramos 5kg', unit: 'Pouch', price: 72000, expiredDate: '2027-05-10' },
  { id: '2', sku: 'MYK-001', name: 'Minyak Goreng Bimoli 2L', unit: 'Pouch', price: 36000, expiredDate: '2027-02-15' },
  { id: '3', sku: 'GLA-001', name: 'Gula Pasir Gulaku 1kg', unit: 'Kg', price: 17500, expiredDate: '2028-01-01' },
  { id: '4', sku: 'TLR-001', name: 'Telur Ayam Negeri (Peti)', unit: 'Kg', price: 28000, expiredDate: '2026-10-15' },
  { id: '5', sku: 'TRG-001', name: 'Tepung Terigu Segitiga Biru 1kg', unit: 'Pcs', price: 13000, expiredDate: '2027-08-20' },
  { id: '6', sku: 'SMR-001', name: 'Indomie Goreng Spesial (Dus)', unit: 'Dus', price: 112000, expiredDate: '2027-04-01' },
];

export default function PosPage() {
  const [search, setSearch] = useState('');
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { cart, addToCart, removeFromCart, updateQty, clearCart, getTotalPrice } = usePosStore();

  const filteredProducts = MOCK_PRODUCTS.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  // Shortcut Keyboard Handler (F2 = Search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setIsPaymentSuccess(true);
    setTimeout(() => {
      setIsPaymentSuccess(false);
      clearCart();
    }, 2000);
  };

  return (
    <div className="flex h-screen bg-brand-dark text-white font-sans overflow-hidden">
      {/* BAGIAN KIRI: Katalog & Pencarian Produk */}
      <div className="flex-1 flex flex-col border-r border-brand-primary/20 p-6 overflow-hidden">
        {/* Header Top Bar POS */}
        <div className="flex items-center justify-between pb-6 border-b border-brand-primary/20">
          <div className="flex items-center gap-4">
            <Link href="/">
              <button className="p-2.5 rounded-xl border border-brand-primary/30 bg-brand-surface hover:bg-brand-primary/20 text-brand-accent transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </button>
            </Link>
            <div>
              <h1 className="text-xl font-black text-white tracking-wide">POS Kasir Toserba</h1>
              <p className="text-xs text-brand-accent">Siklus Pendapatan - Kasir Cepat (F2 Search)</p>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-80">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Cari nama barang / ketik SKU (F2)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-brand-primary/30 bg-brand-surface py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-400 focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent transition-all"
            />
          </div>
        </div>

        {/* Grid Katalog Produk */}
        <div className="flex-1 overflow-y-auto mt-6 pr-2 grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <motion.div
              key={product.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => addToCart(product)}
              className="cursor-pointer rounded-2xl border border-brand-primary/20 bg-brand-surface/80 p-4 flex flex-col justify-between hover:border-brand-accent/50 hover:shadow-lg hover:shadow-brand-primary/10 transition-all"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                  <span className="font-mono bg-brand-primary/10 px-2 py-0.5 rounded text-brand-accent border border-brand-primary/20">
                    {product.sku}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-gray-400">
                    <Package className="h-3 w-3" /> FEFO
                  </span>
                </div>
                <h3 className="font-bold text-sm text-gray-100 line-clamp-2">{product.name}</h3>
              </div>

              <div className="mt-4 flex items-end justify-between border-t border-brand-primary/10 pt-3">
                <span className="text-xs text-gray-400">/ {product.unit}</span>
                <span className="text-base font-black text-brand-accent">
                  Rp {product.price.toLocaleString('id-ID')}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* BAGIAN KANAN: Keranjang & Pembayaran (Cart Side) */}
      <div className="w-96 bg-brand-surface/90 border-l border-brand-primary/20 flex flex-col justify-between p-6 backdrop-blur-md">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-brand-primary/20">
            <h2 className="text-lg font-extrabold text-white">Keranjang Belanja</h2>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold"
              >
                <Trash2 className="h-3.5 w-3.5" /> Bersihkan
              </button>
            )}
          </div>

          {/* List Cart Items */}
          <div className="mt-4 space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            <AnimatePresence>
              {cart.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-16 text-center text-xs text-gray-400 border border-dashed border-brand-primary/20 rounded-xl"
                >
                  Keranjang masih kosong.<br />Klik produk untuk menambahkan.
                </motion.div>
              ) : (
                cart.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="rounded-xl border border-brand-primary/20 bg-brand-dark/60 p-3 flex items-center justify-between"
                  >
                    <div className="flex-1 pr-2">
                      <h4 className="text-xs font-bold text-gray-200 line-clamp-1">{item.name}</h4>
                      <p className="text-[11px] text-brand-accent font-semibold mt-0.5">
                        Rp {(item.price * item.qty).toLocaleString('id-ID')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 bg-brand-surface rounded-lg p-1 border border-brand-primary/30">
                      <button
                        onClick={() => updateQty(item.id, item.qty - 1)}
                        className="p-1 rounded hover:bg-brand-primary/20 text-gray-300"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-bold w-5 text-center">{item.qty}</span>
                      <button
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        className="p-1 rounded hover:bg-brand-primary/20 text-gray-300"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Ringkasan Total & Tombol Bayar */}
        <div className="border-t border-brand-primary/20 pt-4 space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-300">
            <span>Subtotal</span>
            <span>Rp {getTotalPrice().toLocaleString('id-ID')}</span>
          </div>
          <div className="flex items-center justify-between text-lg font-black text-white">
            <span>Total Bayar</span>
            <span className="text-brand-accent">Rp {getTotalPrice().toLocaleString('id-ID')}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="flex items-center justify-center gap-2 rounded-xl bg-nature-gradient py-3 text-sm font-black text-brand-dark shadow-lg disabled:opacity-50 hover:brightness-110 transition-all"
            >
              <Banknote className="h-4 w-4" /> Tunai / Cash
            </button>
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="flex items-center justify-center gap-2 rounded-xl border border-brand-accent bg-transparent py-3 text-sm font-black text-brand-accent hover:bg-brand-accent/10 disabled:opacity-50 transition-all"
            >
              <CreditCard className="h-4 w-4" /> Bon / Kredit
            </button>
          </div>
        </div>
      </div>

      {/* Modal Sukses Transaksi Animasi */}
      <AnimatePresence>
        {isPaymentSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="bg-brand-surface border border-brand-accent/50 p-8 rounded-2xl text-center space-y-4 max-w-sm shadow-2xl"
            >
              <CheckCircle2 className="h-16 w-16 text-brand-accent mx-auto animate-bounce" />
              <h3 className="text-xl font-black text-white">Transaksi Berhasil!</h3>
              <p className="text-xs text-gray-300">
                Stok terpotong otomatis dengan skema FEFO. Jurnal umum tercatat di database.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}