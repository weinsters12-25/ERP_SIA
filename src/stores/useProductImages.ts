'use client';

/**
 * Penyimpanan gambar produk (di browser) + kompresi ke WebP.
 * Dipisah dari useErpStore supaya store yang sudah berjalan tidak perlu diubah.
 * Kunci gambar = SKU (huruf besar), jadi cukup panggil getProductImage(images, p.sku).
 */
import { useSyncExternalStore } from 'react';

const KEY = 'toserba-product-images';
type ImageMap = Record<string, string>;

const EMPTY: ImageMap = {};
let cache: ImageMap | null = null;
const listeners = new Set<() => void>();

export const imageKey = (sku: string) => sku.trim().toUpperCase();

function read(): ImageMap {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? '{}') as ImageMap;
  } catch {
    cache = {};
  }
  return cache;
}

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null; // data berubah dari tab lain
      cb();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

/** Peta { SKU: dataURL WebP }. Kosong di server / sebelum hydrate. */
export function useProductImages(): ImageMap {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export const getProductImage = (images: ImageMap, sku: string): string | undefined => images[imageKey(sku)];

/** Simpan / hapus gambar. Mengembalikan false bila penyimpanan browser penuh. */
export function setProductImage(sku: string, dataUrl: string | null): boolean {
  const next = { ...read() };
  if (dataUrl) next[imageKey(sku)] = dataUrl;
  else delete next[imageKey(sku)];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  cache = next;
  notify();
  return true;
}

export interface CompressResult {
  dataUrl: string;
  bytes: number;
  originalBytes: number;
  isWebp: boolean;
}

/**
 * Potong tengah jadi persegi, kecilkan (maks `size` px), lalu kompres ke WebP.
 * Foto 3–5 MB biasanya menjadi 20–60 KB.
 */
export async function compressToWebp(file: File, size = 512, quality = 0.8): Promise<CompressResult> {
  if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar (JPG, PNG, WebP).');
  if (file.size > 15 * 1024 * 1024) throw new Error('Ukuran gambar terlalu besar (maks 15 MB).');

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Gambar tidak dapat dibaca. Coba format JPG atau PNG.'));
      i.src = url;
    });

    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const out = Math.min(size, side);

    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Browser tidak mendukung kompresi gambar.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);

    const dataUrl = canvas.toDataURL('image/webp', quality);
    const bytes = Math.round(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);
    return { dataUrl, bytes, originalBytes: file.size, isWebp: dataUrl.startsWith('data:image/webp') };
  } finally {
    URL.revokeObjectURL(url);
  }
}