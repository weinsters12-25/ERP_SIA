import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { buildPayload } from '@/lib/demo-generator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const outDir = join(process.cwd(), 'public');
const outFile = join(outDir, 'demo-data.json');

/** Aktif jika file ada dan seedId diawali "demo-". */
function isDemoActive(): boolean {
  try {
    if (!existsSync(outFile)) return false;
    const json = JSON.parse(readFileSync(outFile, 'utf-8'));
    return typeof json.seedId === 'string' && json.seedId.startsWith('demo-');
  } catch {
    return false;
  }
}

/** Hanya jalan di development, kecuali ALLOW_DEMO_TOGGLE=true di environment. */
function allowed(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEMO_TOGGLE === 'true';
}

export async function GET() {
  if (!allowed()) return NextResponse.json({ error: 'Tidak tersedia.' }, { status: 404 });
  return NextResponse.json({ active: isDemoActive() });
}

export async function POST() {
  if (!allowed()) return NextResponse.json({ error: 'Tidak tersedia.' }, { status: 404 });

  try {
    const turnOn = !isDemoActive();
    const payload = buildPayload(!turnOn); // ON -> data demo, OFF -> dataset kosong
    mkdirSync(outDir, { recursive: true });
    writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf-8');
    return NextResponse.json({ active: turnOn, seedId: payload.seedId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal mengubah data demo.' },
      { status: 500 },
    );
  }
}