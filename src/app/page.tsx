'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { motion } from 'framer-motion';
import DashboardLayout from './(dashboard)/layout';
import { TrendingUp, TrendingDown, PackageX, ShoppingBag } from 'lucide-react';

interface StatProps {
  title: string;
  value: number;
  prefix?: string;
  icon: React.ReactNode;
}

function StatCard({ title, value, prefix = 'Rp ', icon }: StatProps) {
  const numberRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (numberRef.current) {
      const obj = { count: 0 };
      gsap.to(obj, {
        count: value,
        duration: 1.2,
        ease: 'power2.out',
        onUpdate: () => {
          if (numberRef.current) {
            numberRef.current.innerText = `${prefix}${Math.floor(obj.count).toLocaleString('id-ID')}`;
          }
        },
      });
    }
  }, [value, prefix]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className="relative overflow-hidden rounded-2xl border border-brand-primary/30 bg-brand-surface/80 p-6 shadow-xl backdrop-blur-md"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
          <span ref={numberRef} className="mt-2 block text-2xl font-black text-brand-accent">
            {prefix}0
          </span>
        </div>
        <div className="rounded-xl bg-brand-primary/20 p-3 text-brand-accent border border-brand-accent/20">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

export default function HomePage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Welcome Banner */}
        <div className="rounded-2xl border border-brand-primary/30 bg-nature-gradient p-6 text-brand-dark shadow-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black">Selamat Datang di Toserba ERP</h1>
            <p className="text-sm font-medium mt-1 opacity-90">
              Sistem Manajemen Stok FEFO, Kasir POS, dan Keuangan Toko Sembako.
            </p>
          </div>
          <button className="px-4 py-2 bg-brand-dark text-brand-accent font-bold rounded-xl text-sm hover:bg-black transition-colors">
            + Transaksi Baru
          </button>
        </div>

        {/* Ringkasan Statistik */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Penjualan Hari Ini"
            value={3250000}
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <StatCard
            title="Pengeluaran (PO)"
            value={1850000}
            icon={<TrendingDown className="h-6 w-6" />}
          />
          <StatCard
            title="Piutang Belum Lunas"
            value={620000}
            icon={<ShoppingBag className="h-6 w-6" />}
          />
          <StatCard
            title="Item Mendekati Expired"
            value={8}
            prefix=""
            icon={<PackageX className="h-6 w-6" />}
          />
        </div>

        {/* Placeholder Widget Tabel */}
        <div className="rounded-2xl border border-brand-primary/20 bg-brand-surface/60 p-6 backdrop-blur-md">
          <h3 className="text-lg font-bold text-white mb-4">Aktivitas Transaksi Terakhir</h3>
          <div className="text-sm text-gray-400 text-center py-12 border border-dashed border-brand-primary/20 rounded-xl">
            Sistem terintegrasi Supabase siap menerima entri data dari modul POS & Purchasing.
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}