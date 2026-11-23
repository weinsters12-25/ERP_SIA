/**
 * Pemakaian (dari root proyek):
 *   npx tsx scripts/seed-demo.ts            -> buat data demo
 *   npx tsx scripts/seed-demo.ts --clear    -> kosongkan data di browser (tulis dataset kosong)
 *   npx tsx scripts/seed-demo.ts --remove   -> hapus file demo (data di browser dibiarkan)
 *
 * Logika generator ada di src/lib/demo-generator.ts (dipakai juga oleh hotkey Alt+Shift+M).
 */
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildPayload, rp, type JournalType } from '../src/lib/demo-generator';

const outDir = join(process.cwd(), 'public');
const outFile = join(outDir, 'demo-data.json');
const arg = process.argv[2];

if (arg === '--remove') {
  if (existsSync(outFile)) {
    unlinkSync(outFile);
    console.log('✔ public/demo-data.json dihapus. Data yang sudah ada di browser tidak diubah.');
  } else {
    console.log('Tidak ada file demo untuk dihapus.');
  }
  process.exit(0);
}

const clear = arg === '--clear';
const payload = buildPayload(clear);

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf-8');

console.log(`✔ ${payload.label} ditulis ke public/demo-data.json (seedId: ${payload.seedId})`);
if (!clear) {
  const d = payload.data;
  const sum = (t: JournalType) => d.journals.filter((j) => j.type === t).reduce((s, j) => s + j.amount, 0);
  console.log(`  Jurnal: ${d.journals.length} | Penjualan ${rp(sum('SALES'))} | HPP ${rp(sum('COGS'))} | Biaya ${rp(sum('EXPENSE'))}`);
  console.log(`  Saldo: ${d.accounts.map((a) => `${a.id}=${rp(a.balance)}`).join(' | ')}`);
}
console.log('  Refresh browser agar data dimuat ke aplikasi.');