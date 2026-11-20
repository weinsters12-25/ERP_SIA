'use client';

import { useSyncExternalStore } from 'react';

/**
 * Pemetaan barcode -> SKU, disimpan di localStorage.
 * Dipisah dari useErpStore supaya tidak perlu mengubah struktur Product.
 * Satu barang boleh punya beberapa barcode (mis. barcode pcs & barcode dus).
 */

const KEY = 'erp-product-barcodes';

export type BarcodeMap = Record<string, string>; // { [barcode]: sku }

const EMPTY: BarcodeMap = {};
let cache: BarcodeMap | null = null;
const listeners = new Set<() => void>();

export const normalizeBarcode = (v: string) => v.replace(/\s+/g, '').trim();

function load(): BarcodeMap {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as BarcodeMap) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function persist(next: BarcodeMap) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* penyimpanan penuh / diblokir: tetap simpan di memori */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function useProductBarcodes(): BarcodeMap {
  return useSyncExternalStore(subscribe, load, () => EMPTY);
}

/** SKU pemilik barcode (atau undefined bila belum terdaftar). */
export const findSkuByBarcode = (map: BarcodeMap, code: string) => map[normalizeBarcode(code)];

/** Barcode pertama milik sebuah SKU ('' bila belum ada). */
export const getBarcodeOf = (map: BarcodeMap, sku: string) => Object.keys(map).find((k) => map[k] === sku) ?? '';

/**
 * Menetapkan barcode untuk sebuah SKU (menggantikan barcode lama SKU tsb).
 * Kirim code kosong untuk menghapus. Mengembalikan false bila barcode sudah dipakai SKU lain.
 */
export function setProductBarcode(sku: string, code: string): boolean {
  const c = normalizeBarcode(code);
  const current = { ...load() };
  if (c && current[c] && current[c] !== sku) return false;
  for (const k of Object.keys(current)) if (current[k] === sku) delete current[k];
  if (c) current[c] = sku;
  persist(current);
  return true;
}