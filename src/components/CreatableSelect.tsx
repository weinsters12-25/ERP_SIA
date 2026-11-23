'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';

/* ---------- penyimpanan opsi buatan sendiri (tersimpan di perangkat) ---------- */

export function useCustomOptions(storageKey: string) {
  const [custom, setCustom] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCustom(parsed.filter((x) => typeof x === 'string'));
      }
    } catch {}
  }, [storageKey]);

  const persist = (next: string[]) => {
    setCustom(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  };

  const add = (v: string) => {
    const clean = v.trim();
    if (!clean) return;
    if (custom.some((c) => c.toLowerCase() === clean.toLowerCase())) return;
    persist([...custom, clean]);
  };
  const remove = (v: string) => persist(custom.filter((c) => c !== v));

  return { custom, add, remove };
}

/* ---------- komponen dropdown + tambah baru ---------- */

type Props = {
  value: string;
  onChange: (v: string) => void;
  /** opsi bawaan / dari data barang (tidak bisa dihapus) */
  options: string[];
  /** opsi buatan pengguna (bisa dihapus) */
  customOptions?: string[];
  onCreate?: (v: string) => void;
  onRemoveCustom?: (v: string) => void;
  placeholder?: string;
  /** contoh: "kategori" / "satuan" */
  createLabel?: string;
  maxLength?: number;
  invalid?: boolean;
  describedBy?: string;
  /** ref ke tombol pemicu (untuk fokus dari validasi / tombol Enter) */
  buttonRef?: (el: HTMLButtonElement | null) => void;
  /** dipanggil setelah pengguna memilih / membuat opsi (mis. pindah ke kolom berikutnya) */
  onPicked?: () => void;
  className?: string;
};

type Item = { label: string; custom: boolean };

export default function CreatableSelect({
  value,
  onChange,
  options,
  customOptions = [],
  onCreate,
  onRemoveCustom,
  placeholder = 'Pilih…',
  createLabel = 'baru',
  maxLength = 60,
  invalid = false,
  describedBy,
  buttonRef,
  onPicked,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // gabungkan, hilangkan duplikat (tidak peka huruf besar/kecil), urutkan A-Z
  const all = useMemo<Item[]>(() => {
    const seen = new Set<string>();
    const out: Item[] = [];
    [...options.map((o) => ({ label: o, custom: false })), ...customOptions.map((o) => ({ label: o, custom: true }))].forEach((o) => {
      const label = o.label.trim();
      const k = label.toLowerCase();
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push({ label, custom: o.custom });
    });
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [options, customOptions]);

  const q = query.trim();
  const filtered = all.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const exact = all.find((o) => o.label.toLowerCase() === q.toLowerCase());
  const canCreate = q.length > 0 && !exact;
  const total = filtered.length + (canCreate ? 1 : 0);

  // tutup saat klik di luar
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // saat dibuka: reset pencarian, sorot pilihan saat ini, fokus ke kotak cari
  useEffect(() => {
    if (!open) return;
    setQuery('');
    const idx = all.findIndex((o) => o.label === value);
    setActive(idx >= 0 ? idx : 0);
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // jaga item yang disorot tetap terlihat saat navigasi keyboard
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    onPicked?.();
  };

  const create = () => {
    if (!canCreate) return;
    const clean = q.slice(0, maxLength);
    onCreate?.(clean);
    choose(clean);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(total - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (total === 0) return;
      if (active < filtered.length) choose(filtered[active].label);
      else create();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // jangan ikut menutup modal
      setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-[var(--color-canvas)] px-4 py-3 text-left text-sm transition-colors focus:border-[var(--color-gold)] focus:outline-none ${
          invalid
            ? 'border-[var(--color-rust)] ring-1 ring-[var(--color-rust)]/30'
            : open
            ? 'border-[var(--color-gold)]'
            : 'border-[var(--color-border)]'
        }`}
      >
        <span className={`truncate ${value ? '' : 'text-[var(--color-ink-soft)]/70'}`}>{value || placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--color-ink-soft)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
          {/* cari / ketik baru */}
          <div className="relative border-b border-[var(--color-border)] p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-ink-soft)]" />
            <input
              ref={searchRef}
              value={query}
              maxLength={maxLength}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={`Cari atau ketik ${createLabel} baru…`}
              className="w-full rounded-lg bg-[var(--color-canvas)] py-2 pl-8 pr-3 text-xs focus:outline-none"
            />
          </div>

          <ul ref={listRef} role="listbox" className="max-h-48 overflow-y-auto py-1">
            {filtered.map((o, i) => (
              <li
                key={o.label}
                data-idx={i}
                role="option"
                aria-selected={o.label === value}
                onMouseEnter={() => setActive(i)}
                className={`flex items-center gap-1 pr-2 ${active === i ? 'bg-[var(--color-pine-tint)]' : ''}`}
              >
                <button type="button" onClick={() => choose(o.label)} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm">
                  <Check className={`h-3.5 w-3.5 shrink-0 text-[var(--color-pine)] ${o.label === value ? 'opacity-100' : 'opacity-0'}`} />
                  <span className="truncate">{o.label}</span>
                  {o.custom && (
                    <span className="shrink-0 rounded bg-[var(--color-gold-tint)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--color-gold)]">Baru</span>
                  )}
                </button>
                {o.custom && onRemoveCustom && (
                  <button
                    type="button"
                    title="Hapus dari daftar"
                    aria-label={`Hapus ${o.label} dari daftar`}
                    onClick={() => {
                      onRemoveCustom(o.label);
                      if (o.label === value) onChange('');
                    }}
                    className="shrink-0 rounded p-1 text-[var(--color-ink-soft)] opacity-60 hover:bg-[var(--color-rust-tint)] hover:text-[var(--color-rust)] hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </li>
            ))}

            {filtered.length === 0 && !canCreate && (
              <li className="px-3 py-3 text-center text-xs text-[var(--color-ink-soft)]">Belum ada pilihan. Ketik untuk menambah.</li>
            )}
          </ul>

          {canCreate && (
            <button
              type="button"
              data-idx={filtered.length}
              onClick={create}
              onMouseEnter={() => setActive(filtered.length)}
              className={`flex w-full items-center gap-2 border-t border-[var(--color-border)] px-3 py-2.5 text-left text-xs font-bold text-[var(--color-pine)] ${
                active === filtered.length ? 'bg-[var(--color-pine-tint)]' : ''
              }`}
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="truncate">
                Tambah {createLabel} “{q}”
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}