import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
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

// Kalau silent=true, tidak trigger download individual (dipakai saat digabung ke ZIP), tapi tetap
// mengembalikan blob+filename supaya bisa dimasukkan ke arsip ZIP gabungan.
function finish(blob, filename, silent) {
  if (!silent) download(blob, filename);
  return { blob, filename };
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
export async function export20Besar({ periode, rows, profile, silent = false }) {
  const wb = await loadTemplate('/tpl_20besar.xlsx');
  const ws = wb.worksheets[0];

  // Gabungkan obat dengan nama yang sama (mis. muncul 2x di master obat) -> jumlahkan pemakaiannya
  const byName = new Map();
  rows.filter(r => !r.isHeader).forEach(r => {
    const key = (r.nama || '').trim().toUpperCase();
    if (!key) return;
    if (byName.has(key)) {
      byName.get(key).pemakaian += (r.pemakaian || 0);
    } else {
      byName.set(key, { nama: r.nama, pemakaian: r.pemakaian || 0, satuan: r.satuan });
    }
  });
  const items = Array.from(byName.values()).sort((a, b) => b.pemakaian - a.pemakaian).slice(0, 20);

  items.forEach((it, i) => {
    const r = 9 + i;
    ws.getCell(`A${r}`).value = i + 1;
    ws.getCell(`B${r}`).value = it.nama;
    ws.getCell(`C${r}`).value = it.pemakaian || 0;
    ws.getCell(`D${r}`).value = it.satuan || '';
  });
  ws.getCell('C30').value = `LAMBUYA, ${tanggalPeriode(periode)}`;

  ws.getCell('B32').value = 'Mengetahui,';
  ws.getCell('B33').value = 'Kepala Puskesmas Lambuya';
  ws.getCell('B37').value = profile.namaKepalaPuskesmas || '';
  ws.getCell('B38').value = profile.nipKepalaPuskesmas ? `NIP. ${profile.nipKepalaPuskesmas}` : '';
  ws.getCell('D32').value = 'Petugas Pengelola Obat';
  ws.getCell('D37').value = profile.namaPetugas || '';
  ws.getCell('D38').value = profile.nipPetugas ? `NIP. ${profile.nipPetugas}` : '';

  return finish(await toBlob(wb), `20_Besar_Penggunaan_Obat_${periode.bulanPelaporan}_${periode.tahunPelaporan}.xlsx`, silent);
}

// ---------------- 3. HARTRA (statis, hanya tanggal) ----------------
export async function exportHartra({ periode, profile, silent = false }) {
  const wb = await loadTemplate('/tpl_hatra.xlsx');
  const tgl = `Lambuya,${tanggalPeriode(periode).toUpperCase()}`;
  const nipK = profile.nipKepalaPuskesmas ? `Nip.${profile.nipKepalaPuskesmas}` : '';
  const nipP = profile.nipPetugas ? `NIP. ${profile.nipPetugas}` : '';

  const dk = wb.getWorksheet('DATA KUNJ');
  dk.getCell('H31').value = tgl;
  dk.getCell('A38').value = profile.namaKepalaPuskesmas || '';
  dk.getCell('A39').value = nipK;
  dk.getCell('I38').value = profile.namaPetugas || '';
  dk.getCell('I39').value = nipP;

  const bjm = wb.getWorksheet('BATRA JENIS METODE');
  bjm.getCell('AB22').value = `Lambuya, ${tanggalPeriode(periode).toUpperCase()}`;
  bjm.getCell('A26').value = profile.namaKepalaPuskesmas || '';
  bjm.getCell('A27').value = nipK;
  bjm.getCell('AB26').value = profile.namaPetugas || '';
  bjm.getCell('AB27').value = nipP;

  const fk = wb.getWorksheet('FASILITAS KESTRAD');
  fk.getCell('A32').value = profile.namaKepalaPuskesmas || '';
  fk.getCell('A33').value = nipK;
  fk.getCell('G32').value = profile.namaPetugas || '';
  fk.getCell('G33').value = nipP;

  const rp = wb.getWorksheet('REKAP PKM');
  rp.getCell('O18').value = `Lambuya,${tanggalPeriode(periode).toUpperCase()}`;
  rp.getCell('C21').value = profile.namaKepalaPuskesmas || '';
  rp.getCell('C22').value = nipK;
  rp.getCell('O22').value = profile.namaPetugas || '';
  rp.getCell('O23').value = nipP;

  return finish(await toBlob(wb), `HARTRA_${periode.bulanPelaporan}_${periode.tahunPelaporan}.xlsx`, silent);
}

// ---------------- 4. NAPZA (statis, hanya bulan/tahun/tanggal) ----------------
export async function exportNapza({ periode, profile, silent = false }) {
  const wb = await loadTemplate('/tpl_napza.xlsx');
  const ws = wb.worksheets[0];
  ws.getCell('A7').value = `BULAN:  ${periode.bulanPelaporan}`;
  ws.getCell('G7').value = `:  ${periode.tahunPelaporan}`;
  ws.getCell('E29').value = `LAMBUYA, ${tanggalPeriode(periode)}`;
  ws.getCell('A36').value = profile.namaKepalaPuskesmas || '';
  ws.getCell('A37').value = profile.nipKepalaPuskesmas ? `NIP. ${profile.nipKepalaPuskesmas}` : '';
  ws.getCell('E36').value = profile.namaPetugas || '';
  ws.getCell('E37').value = profile.nipPetugas ? `NIP. ${profile.nipPetugas}` : '';
  return finish(await toBlob(wb), `NAPZA_${periode.bulanPelaporan}_${periode.tahunPelaporan}.xlsx`, silent);
}

// ---------------- 5. Prekursor Farmasi ----------------
export const PREKURSOR_ITEMS = [
  'Ergotamine', 'Ephedrine', 'Ergometrin', 'Dextral', 'Metilergometrin inj',
  'Dextrofen syr', 'Noza Kaplet', 'Lodecon', 'Ifarsyl Syr', 'Nufed', 'Alpara',
];

export async function exportPrekursor({ periode, items, profile, silent = false }) {
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
  ws.getCell('A36').value = profile.namaKepalaPuskesmas || '';
  ws.getCell('A37').value = profile.nipKepalaPuskesmas ? `NIP. ${profile.nipKepalaPuskesmas}` : '';
  ws.getCell('E36').value = profile.namaPetugas || '';
  ws.getCell('E37').value = profile.nipPetugas ? `NIP. ${profile.nipPetugas}` : '';
  return finish(await toBlob(wb), `Prekursor_Farmasi_${periode.bulanPelaporan}_${periode.tahunPelaporan}.xlsx`, silent);
}

// ---------------- 6. Penyalahgunaan NAPZA (statis / NIHIL) ----------------
export async function exportPenyalahgunaanNapza({ periode, profile, silent = false }) {
  const wb = await loadTemplate('/tpl_penyalahgunaan.xlsx');
  const ws = wb.worksheets[0];
  ws.getCell('C8').value = `: ${periode.bulanPelaporan}`;
  ws.getCell('K25').value = `Lambuya ${tanggalPeriode(periode).toUpperCase()}`;
  ws.getCell('B30').value = profile.namaKepalaPuskesmas || '';
  ws.getCell('B31').value = profile.nipKepalaPuskesmas ? `NIP. ${profile.nipKepalaPuskesmas}` : '';
  ws.getCell('K30').value = profile.namaPetugas || '';
  ws.getCell('K31').value = profile.nipPetugas ? `NIP. ${profile.nipPetugas}` : '';
  return finish(await toBlob(wb), `Penyalahgunaan_NAPZA_${periode.bulanPelaporan}_${periode.tahunPelaporan}.xlsx`, silent);
}

// ---------------- 7. PIO ----------------
export async function exportPio({ periode, rawatInap, konseling, informasiObat, profile, silent = false }) {
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
  ws.getCell('A31').value = profile.namaKepalaPuskesmas || '';
  ws.getCell('A32').value = profile.nipKepalaPuskesmas ? `Nip.${profile.nipKepalaPuskesmas}` : '';
  ws.getCell('F31').value = profile.namaPetugas || '';
  ws.getCell('F32').value = profile.nipPetugas ? `Nip.${profile.nipPetugas}` : '';
  return finish(await toBlob(wb), `PIO_${periode.bulanPelaporan}_${periode.tahunPelaporan}.xlsx`, silent);
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

export async function exportIndikatorPeresepan({ periode, generated, profile, silent = false }) {
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
  ws.getCell('A74').value = profile.namaKepalaPuskesmas || '';
  ws.getCell('A75').value = profile.nipKepalaPuskesmas ? `NIP. ${profile.nipKepalaPuskesmas}` : '';
  ws.getCell('E74').value = profile.namaPetugas || '';
  ws.getCell('E75').value = profile.nipPetugas ? `NIP. ${profile.nipPetugas}` : '';
  return finish(await toBlob(wb), `Indikator_Peresepan_${periode.bulanPelaporan}_${periode.tahunPelaporan}.xlsx`, silent);
}

// ---------------- 9. POR (Penggunaan Obat Rasional) ----------------
// Daftar resmi dari master obat Medisy (kolom Golongan = "Antibiotik") -- lebih akurat dari kata kunci.
// Dicocokkan berdasar kemiripan nama; kalau tidak cocok sama sekali, fallback ke daftar kata kunci di bawah.
const ANTIBIOTIK_MASTER_NAMES = [
  'Amoxicillin 250 mg syr 60ml', 'Amoxicillin 250 mg Tab', 'Amoxicillin drops 100 mg/ml - 10 ml (0-2thn)',
  'Amoxicillin kaplet 500 mg', 'Amoxicillin sirup kering 125 mg/ 5 ml - 60 ml',
  'Cefadroxil Drops 150mg/Ml', 'Cefadroxil Kapsul 500 mg', 'Cefadroxil sirup 125 MG / Widoxil',
  'Cefotaxim Injeksi', 'Ceftriaxon injeksi', 'CHLORAMPHENICOL SALEP MATA (RECO)', 'Ciprofloxacin 500mg Tab',
  'Cotrimoxazole DOEN I (dewasa) kombinasi : Sulfametoksazol 400 mg + Trimetoprim 80 mg',
  'Cotrimoxazole Suspensi kombinasi : Sulfametoksazol 200 mg + Trimetoprim 40 mg/ 5 ml - 60 ml',
  'Dohixat 100 mg (Doxycicline)',
].map(n => n.toLowerCase());

const ANTIBIOTIK_KEYWORDS = [
  'amoxicillin', 'amoxsilin', 'amoksisilin', 'amoksilin', 'amoxilin',
  'ciprofloxacin', 'siprofloksasin',
  'cefadroxil', 'cefadroksil', 'cefixim', 'cefiksim', 'ceftriaxone', 'seftriakson',
  'cotrimoxazole', 'cotrimoxazol', 'kotrimoksazol', 'sultrinmix', 'sulfametoksazol', 'trimetoprim',
  'metronidazole', 'metronidazol',
  'ampicillin', 'ampisilin',
  'eritromisin', 'erythromycin',
  'doksisiklin', 'doxycycline',
  'tetrasiklin', 'tetracycline',
  'co-amoxiclav', 'amoxiclav', 'coamoxiclav',
  'klindamisin', 'clindamycin',
  'azithromycin', 'azitromisin',
  'gentamicin', 'gentamisin',
  'kloramfenikol', 'chloramphenicol', 'tiamfenikol',
  'levofloxacin', 'levofloksasin',
];
function isAntibiotik(namaObat) {
  const n = (namaObat || '').toLowerCase().trim();
  if (!n) return false;
  const masterMatch = ANTIBIOTIK_MASTER_NAMES.some(m => n.includes(m) || m.includes(n));
  if (masterMatch) return true;
  return ANTIBIOTIK_KEYWORDS.some(k => n.includes(k));
}

function excelSerialToDateStr(v) {
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return v || '';
}

// Parser file ISPA dari Medisy (formatnya sudah hampir identik dengan template resmi)
export function parseIspaMedisy(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

  // Cari baris header ("Tanggal" di kolom A) secara dinamis, bukan asumsi nomor baris tetap --
  // posisi ini bisa berbeda-beda antar file export Medisy.
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cell = (rows[i] || [])[0];
    if (typeof cell === 'string' && cell.trim().toLowerCase() === 'tanggal') { headerIdx = i; break; }
  }
  if (headerIdx === -1) throw new Error('Format file ISPA tidak dikenali: kolom "Tanggal" tidak ditemukan di baris manapun.');
  const dataStart = headerIdx + 2; // lewati baris header + baris nomor legenda (1,2,3,...)

  const patients = [];
  let current = null;
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] || [];
    const [tanggal, no, nama, umur, jmlItem, antibiotik, jmlLembar, letter, namaObat, , , , , , generik] = row;
    if (tanggal !== null && tanggal !== undefined && tanggal !== '') {
      current = {
        tanggal: excelSerialToDateStr(tanggal), no, nama, umur, jmlItem: Number(jmlItem) || 0,
        antibiotik: (antibiotik || '').toString().toUpperCase().includes('YA') ? 'YA' : 'TIDAK',
        jmlLembar: Number(jmlLembar) || 0, obat: [],
      };
      patients.push(current);
    }
    if (current && namaObat) {
      const jmlGenerik = row[10]; // kolom K: Jumlah Generik
      current.obat.push({ letter: letter || String.fromCharCode(97 + current.obat.length), nama: namaObat, generik: jmlGenerik });
    }
  }
  // Status "Antibiotik Ya/Tidak" bawaan file Medisy kadang tidak akurat (mis. Amoxicillin tertandai "Tidak").
  // Hitung ulang dari daftar obat asli memakai klasifikasi antibiotik yang sama dengan laporan DIARE.
  patients.forEach(p => {
    p.antibiotik = p.obat.some(o => isAntibiotik(o.nama)) ? 'YA' : 'TIDAK';
  });
  return patients;
}

// Parser file DIARE dari Medisy (data mentah per kunjungan, obat digabung dalam 1 sel)
export function parseDiareMedisy(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

  // Cari baris header (kolom C = "Nama") secara dinamis, sama seperti parser ISPA.
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cell = (rows[i] || [])[2];
    if (typeof cell === 'string' && cell.trim().toLowerCase() === 'nama') { headerIdx = i; break; }
  }
  const dataStart = headerIdx === -1 ? 1 : headerIdx + 1;

  const patients = [];
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] || [];
    const [no, tanggal, nama, nik, jk, tglLahir, umur, alamat, desa, namaObatRaw] = row;
    if (!nama) continue;
    // Format: (KDxxx\n-Nama Obat),(KDxxx\n-Nama Obat 2),...
    const parts = String(namaObatRaw || '').split(/\),\(/).map(s => s.replace(/^\(|\)$/g, ''));
    const obatList = parts.map(p => {
      const afterDash = p.split(/\n-|-/).slice(1).join('-').trim();
      return afterDash || p.trim();
    }).filter(Boolean);
    const jmlItem = obatList.length;
    const antibiotik = obatList.some(isAntibiotik) ? 'YA' : 'TIDAK';
    patients.push({
      tanggal: typeof tanggal === 'string' ? tanggal : excelSerialToDateStr(tanggal),
      no, nama, umur: typeof umur === 'string' ? umur : `${umur} th`,
      jmlItem, antibiotik, jmlLembar: jmlItem,
      obat: obatList.map((n, idx) => ({ letter: String.fromCharCode(97 + idx), nama: n })),
    });
  }
  return patients;
}

function fillPasienSheet(ws, patients, startRow) {
  let r = startRow;
  patients.forEach((p, idx) => {
    const firstRow = r;
    ws.getCell(`A${firstRow}`).value = p.tanggal;
    ws.getCell(`B${firstRow}`).value = idx + 1;
    ws.getCell(`C${firstRow}`).value = p.nama;
    ws.getCell(`D${firstRow}`).value = p.umur;
    ws.getCell(`E${firstRow}`).value = p.jmlItem;
    ws.getCell(`F${firstRow}`).value = p.antibiotik;
    ws.getCell(`G${firstRow}`).value = p.jmlLembar;
    if (p.obat.length === 0) {
      r += 1;
    } else {
      p.obat.forEach(o => {
        ws.getCell(`H${r}`).value = o.letter;
        ws.getCell(`I${r}`).value = o.nama;
        r += 1;
      });
    }
  });
  return r;
}

export async function exportPor({ periode, ispaPatients, diarePatients, tenaga, profile, silent = false }) {
  const wb = await loadTemplate('/tpl_por.xlsx');
  const wsDiare = wb.getWorksheet('Diare');
  const wsIspa = wb.getWorksheet('Ispa');
  const wsLap = wb.getWorksheet('Lap. Indikator');

  const bulanCap = periode.bulanPelaporan.charAt(0) + periode.bulanPelaporan.slice(1).toLowerCase();

  wsDiare.getCell('J4').value = `: ${periode.bulanPelaporan}`;
  wsDiare.getCell('J5').value = `: ${periode.tahunPelaporan}`;
  wsIspa.getCell('J4').value = `: ${periode.bulanPelaporan}`;
  wsIspa.getCell('J5').value = `: ${periode.tahunPelaporan}`;

  fillPasienSheet(wsDiare, diarePatients, 10);
  fillPasienSheet(wsIspa, ispaPatients, 10);

  // Hitung indikator rekap
  const totalResepIspa = ispaPatients.length;
  const antibiotikIspa = ispaPatients.filter(p => p.antibiotik === 'YA').length;
  const totalItemIspa = ispaPatients.reduce((s, p) => s + p.jmlItem, 0);
  const totalLembarIspa = ispaPatients.reduce((s, p) => s + p.jmlLembar, 0);

  const totalResepDiare = diarePatients.length;
  const antibiotikDiare = diarePatients.filter(p => p.antibiotik === 'YA').length;
  const totalItemDiare = diarePatients.reduce((s, p) => s + p.jmlItem, 0);
  const totalLembarDiare = diarePatients.reduce((s, p) => s + p.jmlLembar, 0);

  const persenAbIspa = totalResepIspa ? (antibiotikIspa / totalResepIspa) * 100 : 0;
  const persenAbDiare = totalResepDiare ? (antibiotikDiare / totalResepDiare) * 100 : 0;
  const rerataIspa = totalLembarIspa ? totalItemIspa / totalLembarIspa : 0;
  const rerataDiare = totalLembarDiare ? totalItemDiare / totalLembarDiare : 0;
  const rataRata = (rerataIspa + rerataDiare) / 2;

  wsLap.getCell('C11').value = `: ${tenaga.apoteker} orang`;
  wsLap.getCell('C12').value = `: ${tenaga.ttk} orang`;
  wsLap.getCell('C13').value = `: ${tenaga.farmasi} orang`;
  wsLap.getCell('C14').value = `: ${tenaga.dokter} orang`;
  wsLap.getCell('A25').value = '1.';
  wsLap.getCell('B25').value = Number(persenAbIspa.toFixed(2));
  wsLap.getCell('C25').value = Number(persenAbDiare.toFixed(2));
  wsLap.getCell('D25').value = Number(rerataIspa.toFixed(2));
  wsLap.getCell('E25').value = Number(rerataDiare.toFixed(2));
  wsLap.getCell('F25').value = Number(rataRata.toFixed(2));
  wsLap.getCell('E27').value = `Lambuya, ${tanggalPeriode(periode).toUpperCase()}`;
  wsLap.getCell('B33').value = profile.namaKepalaPuskesmas || '';
  wsLap.getCell('B34').value = profile.nipKepalaPuskesmas ? `NIP. ${profile.nipKepalaPuskesmas}` : '';
  wsLap.getCell('E33').value = profile.namaPetugas || '';
  wsLap.getCell('E34').value = profile.nipPetugas ? `NIP. ${profile.nipPetugas}` : '';

  const result = finish(await toBlob(wb), `POR_${periode.bulanPelaporan}_${periode.tahunPelaporan}.xlsx`, silent);
  return { ...result, totalResepIspa, antibiotikIspa, persenAbIspa, totalResepDiare, antibiotikDiare, persenAbDiare, rerataIspa, rerataDiare };
}
export async function downloadPirt(silent = false) {
  const res = await fetch('/PIRT.docx');
  const blob = await res.blob();
  if (!silent) {
    const a = document.createElement('a');
    a.href = '/PIRT.docx';
    a.download = 'PIRT.docx';
    a.click();
  }
  return { blob, filename: 'PIRT.docx' };
}
