'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Fitur rahasia: Alt+Shift+M mengaktifkan / mematikan data demo.
 * Tidak ada tampilan apa pun kecuali toast singkat saat hotkey ditekan.
 */
export default function DemoHotkey() {
  const [toast, setToast] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    const onKeyDown = async (e: KeyboardEvent) => {
      // e.code dipakai (bukan e.key) karena Alt+Shift+M di Mac menghasilkan karakter lain
      if (!(e.altKey && e.shiftKey && e.code === 'KeyM')) return;
      if (e.repeat || busy.current) return;
      e.preventDefault();
      busy.current = true;

      try {
        const cur = await fetch('/api/demo-toggle', { cache: 'no-store' });
        if (!cur.ok) throw new Error('Fitur tidak tersedia di environment ini.');
        const { active } = (await cur.json()) as { active: boolean };

        // Mematikan demo = menimpa data di browser dengan dataset kosong.
        if (active && !window.confirm('Matikan mode demo?\n\nSeluruh data di aplikasi akan DIKOSONGKAN.')) {
          return;
        }

        const res = await fetch('/api/demo-toggle', { method: 'POST' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Gagal mengubah mode demo.');

        setToast(json.active ? 'Mode demo AKTIF — memuat ulang…' : 'Mode demo MATI — memuat ulang…');
        // Loader seedId yang sudah ada akan memasukkan data baru ke store saat halaman dimuat.
        setTimeout(() => window.location.reload(), 700);
      } catch (err) {
        setToast(err instanceof Error ? err.message : 'Terjadi kesalahan.');
        setTimeout(() => setToast(null), 3000);
      } finally {
        busy.current = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!toast) return null;
  return (
    <div
      role="status"
      className="fixed bottom-5 right-5 z-[9999] rounded-xl bg-[var(--color-pine)] px-4 py-2 text-sm font-semibold text-white shadow-lg"
    >
      {toast}
    </div>
  );
}