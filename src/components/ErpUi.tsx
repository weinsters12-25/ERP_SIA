'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';

export const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

export const inputCls =
  'w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-canvas)] px-3 py-2 text-sm focus:border-[var(--color-gold)] focus:outline-none disabled:opacity-60';

export function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-ink)]/40 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.96 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.96 }}
        className={`relative max-h-[90vh] w-full space-y-4 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl ${
          wide ? 'max-w-2xl' : 'max-w-md'
        }`}
      >
        <button
          aria-label="Tutup"
          onClick={onClose}
          className="absolute right-4 top-4 p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
        >
          <X className="h-4 w-4" />
        </button>
        <div>
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{subtitle}</p>}
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[var(--color-ink-soft)]">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-[var(--color-ink-soft)]">{hint}</p>}
    </div>
  );
}

export function ErrorBox({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className="flex items-start gap-2 rounded-lg bg-[var(--color-rust-tint)] px-3 py-2 text-xs font-semibold text-[var(--color-rust)]">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {text}
    </p>
  );
}

export function FormActions({
  onClose,
  submitLabel,
  onSubmit,
}: {
  onClose: () => void;
  submitLabel: string;
  onSubmit: () => void;
}) {
  return (
    <div className="flex gap-2 pt-2">
      <button
        onClick={onClose}
        className="flex-1 rounded-xl border border-[var(--color-border)] py-2.5 text-sm font-semibold text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas-sunk)]"
      >
        Batal
      </button>
      <button
        onClick={onSubmit}
        className="flex-1 rounded-xl bg-[var(--color-pine)] py-2.5 text-sm font-bold text-white shadow-md hover:bg-[var(--color-pine-light)]"
      >
        {submitLabel}
      </button>
    </div>
  );
}