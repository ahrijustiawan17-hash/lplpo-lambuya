import ExcelJS from 'exceljs';
import { BULAN } from './utils';

async function loadTemplate(path) {
  const res = await fetch(path);
  const buf = await res.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function toBlob(wb) {
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function tanggalPeriode(periode) {
  // "31 Juli 2026" style, dari bulan pelaporan periode
  const idx = BULAN.indexOf(periode.bulanPelaporan);
  const lastDay = idx >= 0 ? new Date(periode.tahunPelaporan, idx + 1, 0).getDate() : 28;
  const bulanCap = periode.bulanPelaporan.charAt(0) + periode.bulanPelaporan.slice(1).toLowerCase();
  return `${lastDay} ${bulanCap} ${periode.tahunPelaporan}`;
}

// ---------------- 1. 20 Besar Penggunaan Obat ----------------
export async function export20Besar({ periode, rows, profile }) {
  const wb = await loadTemplate('/tpl_20besar.xlsx');
  const ws = wb.worksheets[0];
  const items = rows.filter(r => !r.isHeader).sort((a, b) => (b.pemakaian || 0) - (a.pemakaian || 0)).slice(0, 20);
  items.forEach((it, i) => {
    const r = 9 + i;
    ws.getCell(`A${r}`).value = i + 1;
    ws.getCell(`B${r}`).value = it.nama;
    ws.getCell(`C${r}`).value = it.pemakaian || 0;
    ws.getCell(`D${r}`).value = it.satuan || '';
  });
  ws.getCell('C30').value = `LAMBUYA, ${tanggalPeriode(periode)}`;
  download(await toBlob(wb), `20_Besar_Penggunaan_Obat_${periode.bulanPelaporan}_${periode.tahunPelaporan}.xlsx`);
}

// ---------------- 3. HARTRA (statis, hanya tanggal) ----------------
export async function exportHartra({ periode }) {
  const wb = await loadTemplate('/tpl_hatra.xlsx');
  const tgl = `Lambuya,${tanggalPeriode(periode).toUpperCase()}`;
  wb.getWorksheet('DATA KUNJ').getCell('H31').value = tgl;
  wb.getWorksheet('BATRA JENIS METODE').getCell('AB22').value = `Lambuya, ${tanggalPeriode(periode).toUpperCase()}`;
  wb.getWorksheet('REKAP PKM').getCell('O18').value = `Lambuya,${tanggalPeriode(periode).toUpperCase()}`;
  download(await toBlob(wb), `HARTRA_${periode.bulanPelaporan}_${periode.tahunPelaporan}.xlsx`);
}

// ---------------- 4. NAPZA (statis, hanya bulan/tahun/tanggal) ----------------
export async function exportNapza({ periode }) {
  const wb = await loadTemplate('/tpl_napza.xlsx');
  const ws = wb.worksheets[0];
  ws.getCell('A7').value = `BULAN:  ${periode.bulanPelaporan}`;
  ws.getCell('G7').value = `:  ${periode.tahunPelaporan}`;
  ws.getCell('E29').value = `LAMBUYA, ${tanggalPeriode(periode)}`;
  download(await toBlob(wb), `NAPZA_${periode.bulanPelaporan}_${periode.tahunPelaporan}.xlsx`);
}

// ---------------- 5. Prekursor Farmasi ----------------
export const PREKURSOR_ITEMS = [
  'Ergotamine', 'Ephedrine', 'Ergometrin', 'Dextral', 'Metilergometrin inj',
  'Dextrofen syr', 'Noza Kaplet', 'Lodecon', 'Ifarsyl Syr', 'Nufed', 'Alpara',
];

export async function exportPrekursor({ periode, items }) {
  const wb = await loadTemplate('/tpl_prekursor.xlsx');
  const ws = wb.worksheets[0];
  ws.getCell('C10').value = periode.bulanPelaporan;
  ws.getCell('C11').value = periode.tahunPelaporan;
  items.forEach((it, i) => {
    const r = 15 + i;
    const stokAkhir = (it.stokAwal || 0) + (it.penerimaan || 0) - (it.pemakaian || 0);
    ws.getCell(`C${r}`).value = it.stokAwal || 0;
    ws.getCell(`D${r}`).value = it.penerimaan || 0;
    ws.getCell(`E${r}`).value = it.pemakaian || 0;
    ws.getCell(`F${r}`).value = stokAkhir;
  });
  ws.getCell('D31').value = `LAMBUYA, ${tanggalPeriode(periode).toUpperCase()}`;
  download(await toBlob(wb), `Prekursor_Farmasi_${periode.bulanPelaporan}_${periode.tahunPelaporan}.xlsx`);
}

// ---------------- 6. Penyalahgunaan NAPZA (statis / NIHIL) ----------------
export async function exportPenyalahgunaanNapza({ periode }) {
  const wb = await loadTemplate('/tpl_penyalahgunaan.xlsx');
  const ws = wb.worksheets[0];
  ws.getCell('C8').value = `: ${periode.bulanPelaporan}`;
  ws.getCell('K25').value = `Lambuya ${tanggalPeriode(periode).toUpperCase()}`;
  download(await toBlob(wb), `Penyalahgunaan_NAPZA_${periode.bulanPelaporan}_${periode.tahunPelaporan}.xlsx`);
}

// ---------------- 7. PIO ----------------
export async function exportPio({ periode, rawatInap, konseling, informasiObat }) {
  const wb = await loadTemplate('/tpl_pio.xlsx');
  const ws = wb.worksheets[0];
  const rawatJalan = (periode.kunjungan?.umum || 0) + (periode.kunjungan?.askes || 0) + (periode.kunjungan?.bpjs || 0)
    + (periode.kunjungan?.gratis || 0) + (periode.kunjungan?.jamkesmas || 0);
  ws.getCell('B11').value = `: ${periode.bulanPelaporan}/ ${periode.tahunPelaporan}`;
  ws.getCell('B12').value = ': 1     ';
  ws.getCell('C12').value = 'Non ASN : 0';
  ws.getCell('B13').value = ': 1';
  ws.getCell('C13').value = 'Non ASN : 0';
  ws.getCell('A17').value = 1;
  ws.getCell('B17').value = rawatJalan;
  ws.getCell('D17').value = rawatInap;
  ws.getCell('F17').value = konseling;
  ws.getCell('G17').value = informasiObat;
  ws.getCell('F23').value = `Lambuya,${tanggalPeriode(periode).toUpperCase()}`;
  download(await toBlob(wb), `PIO_${periode.bulanPelaporan}_${periode.tahunPelaporan}.xlsx`);
}

// ---------------- 2. Indikator Peresepan ----------------
const NON_GENERIK_POOL = ['BIONEURON', 'Vitalong C', 'Vitalysin Sirup', 'Vitacimin', 'CDR', 'Enervon-C'];

export function generateIndikatorPeresepan({ jumlahResep, targetMin, targetMax, seed }) {
  const rand = mulberry32(seed || Date.now());
  const target = targetMin + rand() * (targetMax - targetMin); // dalam persen, mis. 90-100
  const rows = [];
  let totalItem = 0, totalGenerik = 0;

  for (let i = 0; i < jumlahResep; i++) {
    const item = 2 + Math.floor(rand() * 4); // 2-5 item per resep
    // tentukan apakah resep ini "penuh generik" berdasarkan target
    const isFullGenerik = rand() * 100 < target;
    const generik = isFullGenerik ? item : Math.max(1, item - 1);
    rows.push({
      no: i + 1, totalItem: item, generik,
      persen: generik / item,
      namaNonGenerik: generik < item ? NON_GENERIK_POOL[Math.floor(rand() * NON_GENERIK_POOL.length)] : '',
    });
    totalItem += item;
    totalGenerik += generik;
  }
  return { rows, totalItem, totalGenerik, totalPersen: totalItem ? totalGenerik / totalItem : 0 };
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function exportIndikatorPeresepan({ periode, generated }) {
  const wb = await loadTemplate('/tpl_indikator.xlsx');
  const ws = wb.worksheets[0];
  const bulanCap = periode.bulanPelaporan.charAt(0) + periode.bulanPelaporan.slice(1).toLowerCase();
  ws.getCell('A8').value = `BULAN ${periode.bulanPelaporan} ${periode.tahunPelaporan}`;
  generated.rows.forEach((row, i) => {
    const r = 17 + i;
    if (r > 67) return; // kapasitas template maksimal 51 baris
    ws.getCell(`A${r}`).value = row.no;
    ws.getCell(`B${r}`).value = row.totalItem;
    ws.getCell(`C${r}`).value = row.generik;
    ws.getCell(`D${r}`).value = row.persen;
    ws.getCell(`E${r}`).value = row.namaNonGenerik || null;
  });
  ws.getCell('A68').value = 'TOTAL';
  ws.getCell('B68').value = generated.totalItem;
  ws.getCell('C68').value = generated.totalGenerik;
  ws.getCell('D68').value = generated.totalPersen;
  ws.getCell('E70').value = `Lambuya, ${tanggalPeriode(periode)}`;
  download(await toBlob(wb), `Indikator_Peresepan_${periode.bulanPelaporan}_${periode.tahunPelaporan}.xlsx`);
}

// ---------------- 8. PIRT (statis total, tidak pernah berubah) ----------------
export function downloadPirt() {
  const a = document.createElement('a');
  a.href = '/PIRT.docx';
  a.download = 'PIRT.docx';
  a.click();
}
