'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CameraOff, Keyboard, X } from 'lucide-react';

/**
 * Scanner barcode lewat kamera.
 * - Memakai BarcodeDetector bawaan browser (Chrome/Edge Android, Safari baru) bila ada.
 * - Jika tidak ada, otomatis memakai @zxing/browser (npm i @zxing/browser @zxing/library).
 * - Kamera hanya jalan di HTTPS atau localhost.
 * Dirender lewat portal agar tidak terpengaruh transform animasi modal.
 */

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'];

export default function BarcodeScanner({
  onDetected,
  onClose,
  continuous = false,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
  /** true = kamera tetap terbuka setelah scan (cocok untuk kasir). Barcode yang sama diabaikan 1,8 detik. */
  continuous?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(false);
  const lastRef = useRef({ code: '', at: 0 });
  // Selalu memakai callback terbaru agar tidak membaca state lama (mis. isi keranjang).
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [manual, setManual] = useState('');

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let controls: { stop: () => void } | undefined;

    const finish = (code: string) => {
      if (!code) return;
      if (continuous) {
        const now = Date.now();
        if (code === lastRef.current.code && now - lastRef.current.at < 1800) return;
        lastRef.current = { code, at: now };
      } else {
        if (doneRef.current) return;
        doneRef.current = true;
      }
      navigator.vibrate?.(60);
      onDetectedRef.current(code);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Kamera tidak tersedia. Gunakan HTTPS atau localhost, atau ketik barcode manual.');
        return;
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const BD = (window as any).BarcodeDetector;
        if (BD) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
          if (stopped) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          const video = videoRef.current!;
          video.srcObject = stream;
          await video.play();
          setReady(true);
          let detector;
          try {
            detector = new BD({ formats: FORMATS });
          } catch {
            detector = new BD();
          }
          timer = window.setInterval(async () => {
            try {
              const found = await detector.detect(video);
              if (found[0]?.rawValue) finish(found[0].rawValue);
            } catch {
              /* frame belum siap */
            }
          }, 180);
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, videoRef.current!, (result) => {
            if (result) finish(result.getText());
          });
          if (stopped) controls.stop();
          else setReady(true);
        }
      } catch (e) {
        const name = e instanceof Error ? e.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'Izin kamera ditolak. Aktifkan izin kamera di browser, atau ketik barcode manual.'
            : 'Kamera tidak dapat dibuka. Ketik barcode manual atau pakai scanner USB.'
        );
      }
    })();

    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);

    return () => {
      stopped = true;
      window.removeEventListener('keydown', onKey);
      if (timer) window.clearInterval(timer);
      controls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm overflow-hidden rounded-3xl bg-[var(--color-surface)] shadow-2xl">
        <div className="relative aspect-[4/3] w-full bg-black">
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
          {ready && !error && (
            <>
              <div className="pointer-events-none absolute inset-x-[10%] inset-y-[28%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
              <div className="pointer-events-none absolute inset-x-[12%] top-1/2 h-0.5 animate-pulse bg-[var(--color-rust)]" />
            </>
          )}
          {!ready && !error && <p className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white/80">Membuka kamera…</p>}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white">
              <CameraOff className="h-8 w-8 opacity-80" />
              <p className="text-xs font-semibold leading-snug">{error}</p>
            </div>
          )}
          <button aria-label="Tutup" onClick={onClose} className="absolute right-3 top-3 rounded-full bg-black/50 p-1.5 text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 p-4">
          <p className="text-xs text-[var(--color-ink-soft)]">
            {continuous
              ? 'Mode beruntun: setiap barcode yang terbaca langsung diproses. Tekan X atau Esc bila selesai.'
              : 'Arahkan barcode ke dalam kotak. Akan terbaca otomatis.'}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.trim()) {
                onDetectedRef.current(manual.trim());
                if (continuous) setManual('');
              }
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Keyboard className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--color-ink-soft)]" />
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Atau ketik barcode"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] py-2 pl-9 pr-3 font-mono text-xs focus:border-[var(--color-gold)] focus:outline-none"
              />
            </div>
            <button type="submit" className="rounded-xl bg-[var(--color-pine)] px-4 text-xs font-bold text-white hover:bg-[var(--color-pine-light)]">
              Cari
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}