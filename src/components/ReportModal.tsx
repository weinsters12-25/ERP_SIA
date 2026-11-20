'use client';

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, FileDown, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  useErpStore,
  toDateStr,
  getTotalStock,
  getArRemaining,
  getPoRemaining,
  getExpiryStatus,
  type Journal,
  type JournalType,
} from '@/stores/useErpStore';

/* =========================================================================
   KONSTANTA
   ========================================================================= */

/** Identitas toko yang tampil di laporan. Ubah sesuai data toko Anda. */
const STORE = {
  name: 'TOSERBA',
  tagline: 'Nature Fresh · Toko Sembako',
  address: 'Alamat toko Anda di sini',
  phone: 'Telp/WA: 08xx-xxxx-xxxx',
};

type Mode = 'day' | 'month' | 'year';

const MODES: { id: Mode; label: string }[] = [
  { id: 'day', label: 'Harian' },
  { id: 'month', label: 'Bulanan' },
  { id: 'year', label: 'Tahunan' },
];

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const TYPE_LABEL: Record<JournalType, string> = {
  SALES: 'Penjualan',
  COGS: 'HPP',
  EXPENSE: 'Biaya',
  PURCHASE: 'Pembelian',
  PAYABLE: 'Bayar Utang',
  RECEIVABLE: 'Terima Piutang',
  ADJUSTMENT: 'Opname',
  CAPITAL: 'Modal / Saldo',
  TRANSFER: 'Transfer',
};

const TYPE_ORDER = Object.keys(TYPE_LABEL) as JournalType[];

const EXPENSE_CATEGORIES = [
  'Listrik & Air',
  'Gaji Pegawai',
  'Transport & Bensin',
  'Plastik & Kemasan',
  'Sewa',
  'Perawatan',
  'Lainnya',
];

interface Sections {
  cash: boolean;
  timeline: boolean;
  activity: boolean;
  position: boolean;
  journals: boolean;
}

const SECTION_OPTIONS: { id: keyof Sections; label: string }[] = [
  { id: 'cash', label: 'Arus kas' },
  { id: 'timeline', label: 'Rincian per hari/bulan' },
  { id: 'activity', label: 'Aktivitas jurnal' },
  { id: 'position', label: 'Posisi keuangan & stok' },
  { id: 'journals', label: 'Daftar jurnal lengkap' },
];

interface Acc {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface Snapshot {
  cash: number;
  bank: number;
  ar: number;
  ap: number;
  inventory: number;
  net: number;
  products: number;
  units: number;
  nearExpiry: number;
}

/* =========================================================================
   HELPER
   ========================================================================= */

const rp = (n: number) => `${n < 0 ? '-' : ''}Rp ${Math.abs(Math.round(n)).toLocaleString('id-ID')}`;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const pad = (n: number) => String(n).padStart(2, '0');
const parseDate = (s: string) => new Date(`${s}T00:00:00`);
const addDays = (s: string, n: number) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
};
const journalDay = (j: Journal) => j.date.slice(0, 10);

interface Range {
  start: string;
  end: string;
}

function getRange(mode: Mode, v: string): Range {
  if (mode === 'day') return { start: v, end: v };
  if (mode === 'month') {
    const y = Number(v.slice(0, 4));
    const m = Number(v.slice(5, 7));
    return { start: `${v}-01`, end: toDateStr(new Date(y, m, 0)) };
  }
  return { start: `${v}-01-01`, end: `${v}-12-31` };
}

function shiftValue(mode: Mode, v: string, dir: number): string {
  if (mode === 'day') return addDays(v, dir);
  if (mode === 'month') {
    const y = Number(v.slice(0, 4));
    const m = Number(v.slice(5, 7));
    const d = new Date(y, m - 1 + dir, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }
  return String(Number(v) + dir);
}

/** Mengubah nilai periode saat pengguna berpindah antara harian, bulanan, dan tahunan. */
function convertValue(from: Mode, to: Mode, v: string): string {
  if (from === to) return v;
  const today = toDateStr(new Date());
  const y = v.slice(0, 4);
  const m = from === 'year' ? today.slice(5, 7) : v.slice(5, 7);
  if (to === 'year') return y;
  if (to === 'month') return `${y}-${m}`;
  const ym = from === 'month' ? v : `${y}-${m}`;
  return ym === today.slice(0, 7) ? today : `${ym}-01`;
}

const fmtDate = (s: string) => `${s.slice(8, 10)} ${MONTHS[Number(s.slice(5, 7)) - 1].slice(0, 3)} ${s.slice(0, 4)}`;

function longLabel(mode: Mode, v: string): string {
  if (mode === 'day')
    return parseDate(v).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (mode === 'month') return `${MONTHS[Number(v.slice(5, 7)) - 1]} ${v.slice(0, 4)}`;
  return `Tahun ${v}`;
}

function shortLabel(mode: Mode, v: string): string {
  if (mode === 'day') return fmtDate(v);
  if (mode === 'month') return `${MONTHS[Number(v.slice(5, 7)) - 1]} ${v.slice(0, 4)}`;
  return v;
}

interface Summary {
  sales: number;
  salesCash: number;
  salesCredit: number;
  salesCount: number;
  cogs: number;
  grossProfit: number;
  expense: number;
  stockLoss: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
}

function summarize(journals: Journal[]): Summary {
  let sales = 0;
  let salesCredit = 0;
  let salesCount = 0;
  let cogs = 0;
  let expense = 0;
  let stockLoss = 0;

  for (const j of journals) {
    if (j.type === 'SALES') {
      sales += j.amount;
      salesCount += 1;
      if (j.debitAccount.startsWith('104')) salesCredit += j.amount;
    } else if (j.type === 'COGS') {
      cogs += j.amount;
    } else if (j.type === 'EXPENSE') {
      expense += j.amount;
    } else if (j.type === 'ADJUSTMENT') {
      stockLoss += j.debitAccount.startsWith('502') ? j.amount : -j.amount;
    }
  }

  const grossProfit = sales - cogs;
  const netProfit = grossProfit - expense - stockLoss;
  return {
    sales,
    salesCash: sales - salesCredit,
    salesCredit,
    salesCount,
    cogs,
    grossProfit,
    expense,
    stockLoss,
    netProfit,
    grossMargin: sales > 0 ? (grossProfit / sales) * 100 : 0,
    netMargin: sales > 0 ? (netProfit / sales) * 100 : 0,
  };
}

/* =========================================================================
   PEMBUAT LAPORAN (dokumen HTML mandiri bertema struk TOSERBA)
   ========================================================================= */

function buildReportHtml(args: {
  mode: Mode;
  value: string;
  journals: Journal[];
  accounts: Acc[];
  snapshot: Snapshot;
  sections: Sections;
}): string {
  const { mode, value, journals, accounts, snapshot, sections } = args;

  const range = getRange(mode, value);
  const prevValue = shiftValue(mode, value, -1);
  const prevRange = getRange(mode, prevValue);
  const prevLabel = shortLabel(mode, prevValue);
  const within = (j: Journal, r: Range) => {
    const d = journalDay(j);
    return d >= r.start && d <= r.end;
  };

  const cur = journals.filter((j) => within(j, range));
  const prevJ = journals.filter((j) => within(j, prevRange));
  const s = summarize(cur);
  const p = summarize(prevJ);
  const hasPrev = prevJ.length > 0;
  const opex = s.expense + s.stockLoss;
  const prevOpex = p.expense + p.stockLoss;

  const printedAt = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  const label = longLabel(mode, value);
  const modeTitle = mode === 'day' ? 'LAPORAN HARIAN' : mode === 'month' ? 'LAPORAN BULANAN' : 'LAPORAN TAHUNAN';
  const rangeText = mode === 'day' ? '' : `${fmtDate(range.start)} – ${fmtDate(range.end)}`;

  /* ---------- Rincian biaya ---------- */
  const expMap = new Map<string, number>();
  for (const j of cur) {
    if (j.type !== 'EXPENSE') continue;
    const idx = j.description.indexOf(': ');
    const prefix = idx > 0 ? j.description.slice(0, idx) : '';
    const cat = EXPENSE_CATEGORIES.includes(prefix) ? prefix : 'Lainnya';
    expMap.set(cat, (expMap.get(cat) ?? 0) + j.amount);
  }
  const expenseBreakdown = [...expMap.entries()].sort((a, b) => b[1] - a[1]);

  /* ---------- Arus kas ---------- */
  const cashIds = accounts.map((a) => a.id);
  const isCash = (acc: string) => cashIds.some((id) => acc.startsWith(id));
  const after = journals.filter((j) => journalDay(j) > range.end);

  const cashRows = accounts.map((a) => {
    const inflow = cur.reduce((t, j) => t + (j.debitAccount.startsWith(a.id) ? j.amount : 0), 0);
    const outflow = cur.reduce((t, j) => t + (j.creditAccount.startsWith(a.id) ? j.amount : 0), 0);
    const afterNet = after.reduce(
      (t, j) => t + (j.debitAccount.startsWith(a.id) ? j.amount : 0) - (j.creditAccount.startsWith(a.id) ? j.amount : 0),
      0
    );
    const closing = a.balance - afterNet;
    return { id: a.id, name: a.name, inflow, outflow, closing, opening: closing - (inflow - outflow) };
  });

  const inBy = new Map<string, number>();
  const outBy = new Map<string, number>();
  for (const j of cur) {
    if (j.type === 'TRANSFER') continue;
    const d = isCash(j.debitAccount);
    const c = isCash(j.creditAccount);
    const lbl = TYPE_LABEL[j.type] ?? j.type;
    if (d && !c) inBy.set(lbl, (inBy.get(lbl) ?? 0) + j.amount);
    else if (c && !d) outBy.set(lbl, (outBy.get(lbl) ?? 0) + j.amount);
  }
  const inList = [...inBy.entries()].sort((a, b) => b[1] - a[1]);
  const outList = [...outBy.entries()].sort((a, b) => b[1] - a[1]);
  const totalIn = inList.reduce((t, [, v]) => t + v, 0);
  const totalOut = outList.reduce((t, [, v]) => t + v, 0);
  const netCash = totalIn - totalOut;

  /* ---------- Rincian per hari / bulan ---------- */
  interface TRow {
    label: string;
    count: number;
    sales: number;
    cogs: number;
    opex: number;
    net: number;
  }
  const timeline: TRow[] = [];
  if (mode === 'month') {
    const map = new Map<string, Journal[]>();
    for (const j of cur) {
      const d = journalDay(j);
      map.set(d, [...(map.get(d) ?? []), j]);
    }
    [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([d, list]) => {
        const x = summarize(list);
        timeline.push({
          label: parseDate(d).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' }),
          count: x.salesCount,
          sales: x.sales,
          cogs: x.cogs,
          opex: x.expense + x.stockLoss,
          net: x.netProfit,
        });
      });
  } else if (mode === 'year') {
    for (let m = 1; m <= 12; m++) {
      const key = `${value}-${pad(m)}`;
      const x = summarize(cur.filter((j) => journalDay(j).startsWith(key)));
      timeline.push({
        label: MONTHS[m - 1],
        count: x.salesCount,
        sales: x.sales,
        cogs: x.cogs,
        opex: x.expense + x.stockLoss,
        net: x.netProfit,
      });
    }
  }
  const bestRow = timeline.reduce<TRow | null>((b, r) => (r.sales > 0 && (!b || r.sales > b.sales) ? r : b), null);

  /* ---------- Aktivitas per tipe ---------- */
  const activity = TYPE_ORDER.map((t) => {
    const list = cur.filter((j) => j.type === t);
    return { type: t, count: list.length, total: list.reduce((a, j) => a + j.amount, 0) };
  }).filter((r) => r.count > 0);

  /* ---------- Potongan HTML ---------- */
  const neg = (v: number) => (v > 0 ? `- ${rp(v)}` : rp(v));
  const stk = (v: number) => (v >= 0 ? neg(v) : rp(-v));
  const pvs = (v: string) => (hasPrev ? v : '-');

  const delta = (c: number, pr: number, inverse = false) => {
    if (pr === 0) return '<span class="muted">Belum ada pembanding</span>';
    const ch = ((c - pr) / Math.abs(pr)) * 100;
    const up = ch >= 0;
    const good = inverse ? !up : up;
    return `<span class="${good ? 'up' : 'down'}">${up ? '▲' : '▼'} ${esc(
      Math.abs(ch).toFixed(1).replace('.', ',')
    )}%</span> <span class="muted">vs ${esc(prevLabel)}</span>`;
  };

  const kpi = (lbl: string, val: number, sub: string, dl: string, main = false) =>
    `<div class="kpi${main ? ' main' : ''}"><div class="l">${esc(lbl)}</div><div class="v${
      val < 0 ? ' neg' : ''
    }">${esc(rp(val))}</div><div class="s">${esc(sub)}</div><div class="s">${dl}</div></div>`;

  const section = (title: string, body: string, note = '') =>
    `<div class="section"><h2 class="sec">${esc(title)}</h2>${note ? `<p class="sec-note">${esc(note)}</p>` : ''}${body}</div>`;

  const plRow = (cls: string, lbl: string, c: string, pr: string) =>
    `<tr class="${cls}"><td>${esc(lbl)}</td><td class="num">${esc(c)}</td><td class="num">${esc(pr)}</td></tr>`;

  /* 1. Ringkasan */
  const summaryHtml = section(
    'Ringkasan Kinerja',
    `<div class="kpis">
      ${kpi('Total Penjualan', s.sales, `${s.salesCount} transaksi`, delta(s.sales, p.sales))}
      ${kpi('Laba Kotor', s.grossProfit, `Margin ${s.grossMargin.toFixed(1).replace('.', ',')}%`, delta(s.grossProfit, p.grossProfit))}
      ${kpi('Biaya Operasional', opex, 'Beban + selisih stok', delta(opex, prevOpex, true))}
      ${kpi('Keuntungan Bersih', s.netProfit, `Margin ${s.netMargin.toFixed(1).replace('.', ',')}%`, delta(s.netProfit, p.netProfit), true)}
    </div>
    ${
      cur.length === 0
        ? '<p class="empty">Belum ada transaksi pada periode ini.</p>'
        : `<p class="sec-note" style="margin-top:10px">Rata-rata per transaksi ${esc(
            rp(s.salesCount > 0 ? s.sales / s.salesCount : 0)
          )} · Penjualan tunai ${esc(rp(s.salesCash))} · Penjualan bon ${esc(rp(s.salesCredit))}</p>`
    }`
  );

  /* 2. Laba rugi */
  const plRows = [
    plRow('grp', 'Penjualan', rp(s.sales), pvs(rp(p.sales))),
    plRow('sub', 'Penjualan tunai', rp(s.salesCash), pvs(rp(p.salesCash))),
    plRow('sub', 'Penjualan bon / kredit', rp(s.salesCredit), pvs(rp(p.salesCredit))),
    plRow('grp', 'Harga pokok penjualan (HPP)', neg(s.cogs), pvs(neg(p.cogs))),
    plRow('total', 'Laba kotor', rp(s.grossProfit), pvs(rp(p.grossProfit))),
    plRow('grp', 'Beban operasional', neg(s.expense), pvs(neg(p.expense))),
    ...expenseBreakdown.map(([n, v]) => plRow('sub', n, rp(v), '')),
    plRow('grp', 'Selisih stok (opname)', stk(s.stockLoss), pvs(stk(p.stockLoss))),
    plRow('total', 'Keuntungan bersih', rp(s.netProfit), pvs(rp(p.netProfit))),
  ].join('');

  const plHtml = section(
    'Laporan Laba Rugi',
    `<table><thead><tr><th>Keterangan</th><th class="num">Periode ini</th><th class="num">${esc(prevLabel)}</th></tr></thead><tbody>${plRows}</tbody></table>`
  );

  /* 3. Arus kas */
  const flowList = (rows: [string, number][], total: number) =>
    rows.length === 0
      ? '<p class="muted" style="padding:4px 0">Tidak ada.</p>'
      : `<table><tbody>${rows
          .map(([n, v]) => `<tr><td>${esc(n)}</td><td class="num">${esc(rp(v))}</td></tr>`)
          .join('')}<tr class="total"><td>Total</td><td class="num">${esc(rp(total))}</td></tr></tbody></table>`;

  const openingTotal = cashRows.reduce((t, r) => t + r.opening, 0);
  const closingTotal = cashRows.reduce((t, r) => t + r.closing, 0);

  const cashHtml = sections.cash
    ? section(
        'Arus Kas',
        `<table>
          <thead><tr><th>Akun</th><th class="num">Saldo awal</th><th class="num">Masuk</th><th class="num">Keluar</th><th class="num">Saldo akhir</th></tr></thead>
          <tbody>
            ${cashRows
              .map(
                (r) =>
                  `<tr><td>${esc(r.id)} · ${esc(r.name)}</td><td class="num">${esc(rp(r.opening))}</td><td class="num">${esc(
                    rp(r.inflow)
                  )}</td><td class="num">${esc(rp(r.outflow))}</td><td class="num">${esc(rp(r.closing))}</td></tr>`
              )
              .join('')}
            <tr class="total"><td>Total kas + bank</td><td class="num">${esc(rp(openingTotal))}</td><td class="num">${esc(
              rp(cashRows.reduce((t, r) => t + r.inflow, 0))
            )}</td><td class="num">${esc(rp(cashRows.reduce((t, r) => t + r.outflow, 0)))}</td><td class="num">${esc(
              rp(closingTotal)
            )}</td></tr>
          </tbody>
        </table>
        <div class="two" style="margin-top:12px">
          <div class="box"><h3>KAS MASUK</h3>${flowList(inList, totalIn)}</div>
          <div class="box"><h3>KAS KELUAR</h3>${flowList(outList, totalOut)}</div>
        </div>
        <div class="netcash ${netCash >= 0 ? 'pos' : 'neg'}"><span>Arus kas bersih periode ini</span><b>${esc(rp(netCash))}</b></div>`,
        'Saldo awal dan akhir dihitung dari jurnal. Transfer antar akun tidak masuk total kas masuk/keluar.'
      )
    : '';

  /* 4. Rincian per hari / bulan */
  const timelineHtml =
    sections.timeline && mode !== 'day'
      ? section(
          mode === 'month' ? 'Rincian per Hari' : 'Rincian per Bulan',
          `<table>
            <thead><tr><th>${mode === 'month' ? 'Tanggal' : 'Bulan'}</th><th class="num">Transaksi</th><th class="num">Penjualan</th><th class="num">HPP</th><th class="num">Biaya</th><th class="num">Laba bersih</th></tr></thead>
            <tbody>
              ${
                timeline.length === 0
                  ? '<tr><td colspan="6" class="muted" style="text-align:center;padding:14px">Belum ada transaksi.</td></tr>'
                  : timeline
                      .map(
                        (r) =>
                          `<tr><td>${esc(r.label)}</td><td class="num">${r.count}</td><td class="num">${esc(rp(r.sales))}</td><td class="num">${esc(
                            rp(r.cogs)
                          )}</td><td class="num">${esc(rp(r.opex))}</td><td class="num ${r.net < 0 ? 'down' : ''}">${esc(rp(r.net))}</td></tr>`
                      )
                      .join('')
              }
              <tr class="total"><td>Total</td><td class="num">${s.salesCount}</td><td class="num">${esc(rp(s.sales))}</td><td class="num">${esc(
                rp(s.cogs)
              )}</td><td class="num">${esc(rp(opex))}</td><td class="num">${esc(rp(s.netProfit))}</td></tr>
            </tbody>
          </table>`,
          bestRow ? `Penjualan tertinggi: ${bestRow.label} (${rp(bestRow.sales)}).` : ''
        )
      : '';

  /* 5. Aktivitas jurnal */
  const activityHtml = sections.activity
    ? section(
        'Aktivitas Jurnal per Jenis',
        `<table>
          <thead><tr><th>Jenis</th><th class="num">Jumlah jurnal</th><th class="num">Total nominal</th></tr></thead>
          <tbody>
            ${
              activity.length === 0
                ? '<tr><td colspan="3" class="muted" style="text-align:center;padding:14px">Belum ada jurnal.</td></tr>'
                : activity
                    .map(
                      (r) =>
                        `<tr><td>${esc(TYPE_LABEL[r.type])}</td><td class="num">${r.count}</td><td class="num">${esc(rp(r.total))}</td></tr>`
                    )
                    .join('')
            }
            <tr class="total"><td>Total</td><td class="num">${cur.length}</td><td class="num">${esc(
              rp(activity.reduce((t, r) => t + r.total, 0))
            )}</td></tr>
          </tbody>
        </table>`
      )
    : '';

  /* 6. Posisi keuangan & stok */
  const snap = (lbl: string, val: string, cls = '') =>
    `<div class="kpi"><div class="l">${esc(lbl)}</div><div class="v small ${cls}">${esc(val)}</div></div>`;
  const positionHtml = sections.position
    ? section(
        'Posisi Keuangan & Stok',
        `<div class="snap">
          ${snap('Kas + Bank', rp(snapshot.cash + snapshot.bank))}
          ${snap('Piutang belum ditagih', rp(snapshot.ar))}
          ${snap('Nilai persediaan', rp(snapshot.inventory))}
          ${snap('Utang ke supplier', rp(snapshot.ap), 'neg')}
          ${snap('Kekayaan bersih', rp(snapshot.net), snapshot.net < 0 ? 'neg' : '')}
          ${snap('Jumlah produk', String(snapshot.products))}
          ${snap('Total unit stok', snapshot.units.toLocaleString('id-ID'))}
          ${snap('Batch mendekati kedaluwarsa', String(snapshot.nearExpiry), snapshot.nearExpiry > 0 ? 'neg' : '')}
        </div>`,
        `Kondisi pada saat laporan dicetak (${printedAt}), bukan akhir periode.`
      )
    : '';

  /* 7. Daftar jurnal */
  const sortedJournals = [...cur].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const journalsHtml = sections.journals
    ? section(
        'Daftar Jurnal',
        `<table class="small-table">
          <thead><tr><th>No Jurnal</th><th>Waktu</th><th>Jenis</th><th>Keterangan</th><th>Debit</th><th>Kredit</th><th class="num">Nominal</th></tr></thead>
          <tbody>
            ${
              sortedJournals.length === 0
                ? '<tr><td colspan="7" class="muted" style="text-align:center;padding:14px">Belum ada jurnal pada periode ini.</td></tr>'
                : sortedJournals
                    .map(
                      (j) =>
                        `<tr><td class="mono">${esc(j.id)}</td><td class="mono">${esc(j.date)}</td><td>${esc(
                          TYPE_LABEL[j.type] ?? j.type
                        )}</td><td>${esc(j.description)}</td><td>${esc(j.debitAccount)}</td><td>${esc(
                          j.creditAccount
                        )}</td><td class="num">${esc(rp(j.amount))}</td></tr>`
                    )
                    .join('')
            }
            <tr class="total"><td colspan="6">Total ${sortedJournals.length} jurnal</td><td class="num">${esc(
              rp(sortedJournals.reduce((t, j) => t + j.amount, 0))
            )}</td></tr>
          </tbody>
        </table>`
      )
    : '';

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Laporan Keuangan - ${esc(shortLabel(mode, value))}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#17352b;padding:20px;display:flex;justify-content:center;font-size:12px}
  .sheet{width:100%;max-width:780px;border:2px dashed #0b4a37;border-radius:24px;padding:28px 28px 22px;background:#fff}
  .center{text-align:center}
  .deco{font-size:22px;letter-spacing:12px}
  .brand{font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:34px;font-weight:800;letter-spacing:.12em;color:#0b4a37}
  .tag{font-size:12px;font-weight:700;font-style:italic;color:#b8860b;margin-top:2px}
  .addr{font-size:11px;color:#4b5f57;margin-top:5px;line-height:1.55}
  .pill{display:inline-block;margin-top:12px;background:#0b4a37;color:#fff;font-size:11px;font-weight:800;letter-spacing:.1em;padding:6px 18px;border-radius:999px}
  .period{margin:16px auto 0;max-width:440px;background:#e3efe8;border:2px solid #0b4a37;border-radius:16px;padding:10px 14px}
  .period .k{font-size:10px;font-weight:800;letter-spacing:.12em;color:#5c7168}
  .period .v{font-family:'Playfair Display',Georgia,serif;font-size:20px;font-weight:700;color:#0b4a37;margin-top:2px}
  .period .r{font-size:11px;color:#5c7168;margin-top:2px}
  .dots{border-top:2px dotted #c9a227;margin:20px 0 18px}
  .section{margin-bottom:22px}
  h2.sec{font-family:'Playfair Display',Georgia,serif;font-size:16px;color:#0b4a37;margin-bottom:8px;display:flex;align-items:center;gap:8px;page-break-after:avoid}
  h2.sec:before{content:'';width:8px;height:8px;border-radius:50%;background:#c9a227}
  .sec-note{font-size:10.5px;color:#6b7f76;margin:-2px 0 8px;line-height:1.5}
  .muted{color:#6b7f76;font-size:10.5px}
  .empty{margin-top:10px;font-size:11.5px;color:#92400e;background:#fef3c7;border:1.5px solid #f59e0b;border-radius:10px;padding:8px 12px}
  .kpis,.snap{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  .kpi{background:#f4f9f6;border:1.5px solid #cfe0d6;border-radius:14px;padding:10px 12px;page-break-inside:avoid}
  .kpi.main{background:#e3efe8;border:2px solid #0b4a37}
  .kpi .l{font-size:10.5px;font-weight:700;color:#5c7168}
  .kpi .v{font-size:15px;font-weight:800;color:#0b4a37;margin-top:3px;font-family:'Courier New',Courier,monospace;word-break:break-word}
  .kpi .v.small{font-size:13px}
  .kpi .v.neg{color:#b42318}
  .kpi .s{font-size:10px;color:#6b7f76;margin-top:3px}
  .up{color:#0b7a4b;font-weight:800;font-size:10.5px}
  .down{color:#b42318;font-weight:800}
  table{width:100%;border-collapse:collapse;font-size:11.5px}
  th{text-align:left;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:#5c7168;border-bottom:2px solid #0b4a37;padding:6px}
  td{padding:6px;border-bottom:1px solid #e3ebe6;vertical-align:top}
  th.num,td.num{text-align:right;white-space:nowrap}
  td.num{font-family:'Courier New',Courier,monospace}
  .mono{font-family:'Courier New',Courier,monospace;white-space:nowrap}
  thead{display:table-header-group}
  tr{page-break-inside:avoid}
  tr.total td{font-weight:800;background:#e3efe8;border-bottom:2px solid #0b4a37}
  tr.grp td{font-weight:800;color:#0b4a37}
  tr.sub td{color:#5c7168;font-size:11px}
  tr.sub td:first-child{padding-left:22px}
  .small-table{font-size:10px}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .box{border:1px dashed #b8c9c0;border-radius:12px;padding:10px 12px;background:#f8fbf9;page-break-inside:avoid}
  .box h3{font-size:10px;letter-spacing:.1em;color:#5c7168;margin-bottom:4px}
  .netcash{display:flex;justify-content:space-between;align-items:baseline;margin-top:12px;padding:10px 14px;border-radius:14px;border:2px solid #0b4a37;background:#e3efe8;font-size:12.5px;font-weight:800;color:#0b4a37;page-break-inside:avoid}
  .netcash b{font-family:'Courier New',Courier,monospace;font-size:16px}
  .netcash.neg{border-color:#b42318;background:#fef2f2;color:#b42318}
  .foot{text-align:center;margin-top:6px}
  .thanks{font-family:'Playfair Display',Georgia,serif;font-size:18px;font-weight:700;color:#0b4a37}
  .gold{font-size:11.5px;font-weight:800;color:#b8860b;margin-top:3px}
  .printed{font-size:10px;color:#93a39b;margin-top:6px}
  .sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:22px;text-align:center;font-size:11px;color:#5c7168;page-break-inside:avoid}
  .sign .line{border-top:1px solid #17352b;margin-top:54px;padding-top:4px;color:#17352b;font-weight:700}
  @page{size:A4;margin:10mm}
  @media print{body{padding:0}.sheet{max-width:100%}}
  @media (max-width:640px){.kpis,.snap{grid-template-columns:repeat(2,1fr)}.two{grid-template-columns:1fr}.sheet{padding:20px 14px}}
</style>
</head>
<body>
  <div class="sheet">
    <div class="center">
      <div class="deco">🌿 🛒 🌿</div>
      <div class="brand">${esc(STORE.name)}</div>
      <div class="tag">${esc(STORE.tagline)}</div>
      <div class="addr">${esc(STORE.address)}<br>${esc(STORE.phone)}</div>
      <div class="pill">✨ LAPORAN KEUANGAN LENGKAP ✨</div>
      <div class="period">
        <div class="k">${modeTitle}</div>
        <div class="v">${esc(label)}</div>
        ${rangeText ? `<div class="r">${esc(rangeText)}</div>` : ''}
      </div>
    </div>

    <div class="dots"></div>

    ${summaryHtml}
    ${plHtml}
    ${cashHtml}
    ${timelineHtml}
    ${activityHtml}
    ${positionHtml}
    ${journalsHtml}

    <div class="dots"></div>

    <div class="foot">
      <div class="thanks">Terima kasih 💚</div>
      <div class="gold">Laporan dibuat otomatis oleh Toserba ERP</div>
      <div class="printed">Dicetak ${esc(printedAt)}</div>
    </div>

    <div class="sign">
      <div><div class="line">Dibuat oleh</div></div>
      <div><div class="line">Diperiksa pemilik</div></div>
    </div>
  </div>
</body>
</html>`;
}

/* =========================================================================
   KOMPONEN MODAL
   ========================================================================= */

function ReportModalContent({ onClose }: { onClose: () => void }) {
  const accounts = useErpStore((s) => s.accounts);
  const journals = useErpStore((s) => s.journals);
  const products = useErpStore((s) => s.products);
  const receivables = useErpStore((s) => s.receivables);
  const purchaseOrders = useErpStore((s) => s.purchaseOrders);

  const today = toDateStr(new Date());
  const [mode, setMode] = useState<Mode>('month');
  const [value, setValue] = useState<string>(today.slice(0, 7));
  const [sections, setSections] = useState<Sections>({
    cash: true,
    timeline: true,
    activity: true,
    position: true,
    journals: false,
  });

  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameHeight, setFrameHeight] = useState(700);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const snapshot = useMemo<Snapshot>(() => {
    const cash = accounts.filter((a) => a.type === 'CASH').reduce((t, a) => t + a.balance, 0);
    const bank = accounts.filter((a) => a.type === 'BANK').reduce((t, a) => t + a.balance, 0);
    const ar = receivables.reduce((t, r) => t + getArRemaining(r), 0);
    const ap = purchaseOrders.reduce((t, o) => t + getPoRemaining(o), 0);
    let inventory = 0;
    let units = 0;
    let nearExpiry = 0;
    for (const p of products) {
      const stock = getTotalStock(p);
      units += stock;
      inventory += stock * p.cost;
      for (const b of p.batches) {
        if (b.qty <= 0) continue;
        const st = getExpiryStatus(b.expiredDate);
        if (st === 'kritis' || st === 'peringatan') nearExpiry += 1;
      }
    }
    return {
      cash,
      bank,
      ar,
      ap,
      inventory,
      net: cash + bank + ar + inventory - ap,
      products: products.length,
      units,
      nearExpiry,
    };
  }, [accounts, receivables, purchaseOrders, products]);

  const years = useMemo(() => {
    const cy = new Date().getFullYear();
    let min = cy;
    for (const j of journals) {
      const y = Number(j.date.slice(0, 4));
      if (y > 1900 && y < min) min = y;
    }
    const list: string[] = [];
    for (let y = cy; y >= min; y--) list.push(String(y));
    if (mode === 'year' && !list.includes(value)) list.unshift(value);
    return list;
  }, [journals, mode, value]);

  const html = useMemo(
    () => buildReportHtml({ mode, value, journals, accounts, snapshot, sections }),
    [mode, value, journals, accounts, snapshot, sections]
  );

  const changeMode = (m: Mode) => {
    if (m === mode) return;
    setValue(convertValue(mode, m, value));
    setMode(m);
    setSections((s) => ({ ...s, journals: m === 'day' }));
  };

  const nextDisabled = getRange(mode, shiftValue(mode, value, 1)).start > today;

  const fitFrame = () => {
    const doc = frameRef.current?.contentDocument;
    if (doc) setFrameHeight(doc.documentElement.scrollHeight);
  };

  const handlePrint = () => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  const handleDownload = () => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-${mode === 'day' ? 'harian' : mode === 'month' ? 'bulanan' : 'tahunan'}-${value}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputCls =
    'rounded-xl border border-slate-300 bg-slate-50 py-1.5 px-3 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-none';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Laporan keuangan lengkap"
    >
      <motion.div
        initial={{ scale: 0.97 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.97 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-4xl max-h-[94vh] flex flex-col"
      >
        {/* Header + pengaturan */}
        <div className="p-5 pb-4 border-b border-slate-100 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800">Laporan Keuangan Lengkap</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Penjualan, laba rugi, arus kas, dan posisi keuangan dalam satu dokumen.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => changeMode(m.id)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                    mode === m.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setValue(shiftValue(mode, value, -1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                aria-label="Periode sebelumnya"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              {mode === 'day' && (
                <input
                  type="date"
                  value={value}
                  max={today}
                  onChange={(e) => e.target.value && setValue(e.target.value)}
                  className={inputCls}
                  aria-label="Pilih tanggal"
                />
              )}
              {mode === 'month' && (
                <input
                  type="month"
                  value={value}
                  max={today.slice(0, 7)}
                  onChange={(e) => e.target.value && setValue(e.target.value)}
                  className={inputCls}
                  aria-label="Pilih bulan"
                />
              )}
              {mode === 'year' && (
                <select value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} aria-label="Pilih tahun">
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={() => setValue(shiftValue(mode, value, 1))}
                disabled={nextDisabled}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Periode berikutnya"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <span className="text-xs font-semibold text-slate-500">{longLabel(mode, value)}</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 self-center mr-1">Isi laporan:</span>
            {SECTION_OPTIONS.filter((o) => !(o.id === 'timeline' && mode === 'day')).map((o) => (
              <button
                key={o.id}
                onClick={() => setSections((s) => ({ ...s, [o.id]: !s[o.id] }))}
                aria-pressed={sections[o.id]}
                className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                  sections[o.id]
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pratinjau */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 p-3">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <iframe
              ref={frameRef}
              title="Pratinjau laporan keuangan"
              srcDoc={html}
              onLoad={fitFrame}
              style={{ height: frameHeight }}
              className="w-full border-0 bg-white"
            />
          </div>
        </div>

        {/* Aksi */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Untuk PDF, pilih <b>Simpan sebagai PDF</b> pada pilihan printer di jendela cetak.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors"
            >
              <FileDown className="h-3.5 w-3.5" />
              Unduh HTML
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-700 text-white font-bold rounded-xl text-xs hover:bg-emerald-600 shadow-md transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Unduh PDF / Cetak
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* =========================================================================
   PEMBUNGKUS: dirender ke <body> agar tidak terpengaruh layout induk,
   dan menampilkan pesan jika terjadi error saat laporan dibuat.
   ========================================================================= */

class ReportBoundary extends Component<{ onClose: () => void; children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
        onClick={this.props.onClose}
      >
        <div
          className="w-full max-w-md rounded-2xl bg-white p-5 text-xs shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm font-bold text-rose-700">Laporan gagal dibuat</p>
          <p className="mt-2 break-words text-slate-600">{this.state.error.message}</p>
          <button
            onClick={this.props.onClose}
            className="mt-4 w-full rounded-xl border border-slate-200 py-2 font-bold text-slate-600 hover:bg-slate-50"
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }
}

export default function ReportModal({ onClose }: { onClose: () => void }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <ReportBoundary onClose={onClose}>
      <ReportModalContent onClose={onClose} />
    </ReportBoundary>,
    document.body
  );
}