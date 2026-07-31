import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

export const BULAN = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER',
];

function sheetToRows(file, sheetName) {
  const wb = XLSX.read(file, { type: 'array' });
  const ws = wb.Sheets[sheetName || wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
}

// Parse file MASTER_LPLPO (kolom: A=?, B=kode obat, C=Nama Obat, D=Satuan, ...)
// Baris data mulai baris ke-10 (index 9), berhenti saat ketemu blok tanda tangan/footer.
export function parseMasterFile(arrayBuffer) {
  const rows = sheetToRows(arrayBuffer);
  const result = [];
  for (let i = 9; i < rows.length; i++) {
    const row = rows[i] || [];
    const rowNum = i + 1;
    const kode = row[1];
    const nama = row[2];
    const satuan = row[3];
    if (nama === null || nama === undefined || String(nama).trim() === '') continue;
    const namaLower = String(nama).toLowerCase();
    if (namaLower.includes('mengetahui') || namaLower.includes('menyetujui') || namaLower.includes('jumlah kunjungan')) break;
    const isHeader = satuan === null || satuan === undefined || String(satuan).trim() === '';
    const kodeTrim = kode ? String(kode).trim() : null;
    // Beberapa baris di file master masih berisi nomor urut lama (angka polos) di kolom kode obat,
    // bukan kode Medisy asli (format "KDxxx"). Angka polos dianggap TIDAK VALID supaya tidak salah cocok.
    const kodeValid = kodeTrim && !/^[0-9]+$/.test(kodeTrim) ? kodeTrim : null;
    result.push({
      rowNum,
      kodeObat: kodeValid,
      nama: String(nama).trim(),
      satuan: satuan ? String(satuan).trim() : null,
      isHeader,
    });
  }
  return result;
}

// Parse "Laporan Stok Obat Gudang" dari Medisy (header di baris 4: No, Kode Obat, Nama Obat, ..., Jumlah, Satuan)
export function parseMedisyStokFile(arrayBuffer) {
  const rows = sheetToRows(arrayBuffer);
  // Cari baris header (mengandung 'Kode Obat' di salah satu kolom)
  let headerIdx = -1;
  let colKode = -1, colJumlah = -1, colNama = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i] || [];
    const idx = row.findIndex(c => typeof c === 'string' && c.trim().toLowerCase() === 'kode obat');
    if (idx !== -1) {
      headerIdx = i;
      colKode = idx;
      colNama = row.findIndex(c => typeof c === 'string' && c.trim().toLowerCase() === 'nama obat');
      colJumlah = row.findIndex(c => typeof c === 'string' && c.trim().toLowerCase() === 'jumlah');
      break;
    }
  }
  if (headerIdx === -1) throw new Error('Format file tidak dikenali: kolom "Kode Obat" tidak ditemukan.');

  const result = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const kode = row[colKode];
    if (!kode || String(kode).trim() === '') continue;
    result.push({
      kodeObat: String(kode).trim(),
      nama: colNama !== -1 ? row[colNama] : null,
      jumlah: Number(row[colJumlah]) || 0,
    });
  }
  return result;
}

// Parse file LPLPO bulanan yang SUDAH JADI (mis. LPLPO_JUNI...xlsx) untuk ambil kolom "STOK AKHIR" (kolom I)
// per baris -> dipakai sekali sebagai Stok Awal periode pertama.
export function parseStokAkhirFromLplpo(arrayBuffer) {
  const rows = sheetToRows(arrayBuffer);
  const result = {}; // rowNum -> stokAkhir
  for (let i = 9; i < rows.length; i++) {
    const row = rows[i] || [];
    const rowNum = i + 1;
    const nama = row[2];
    if (nama === null || nama === undefined || String(nama).trim() === '') continue;
    const namaLower = String(nama).toLowerCase();
    if (namaLower.includes('mengetahui') || namaLower.includes('menyetujui') || namaLower.includes('jumlah kunjungan')) break;
    const stokAkhir = row[8]; // kolom I (index 8): NO(1) NAMA(2) SATUAN(3) STOKAWAL(4) PENERIMAAN(5) PERSEDIAAN(6) PEMAKAIAN(7) STOKAKHIR(8)... offset by leading null col A -> index sesuai array 0-based row
    result[rowNum] = Number(stokAkhir) || 0;
  }
  return result;
}

// ---- Generate file LPLPO resmi (.xlsx) dari template, diisi data periode berjalan ----
export async function generateLplpoXlsx({ templateArrayBuffer, periode, rows, profile }) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateArrayBuffer);
  const ws = wb.worksheets[0];

  ws.getCell('A3').value = `PUSKESMAS : ${profile.puskesmas || ''}`;
  ws.getCell('A4').value = `KECAMATAN : ${profile.kecamatan || ''}`;
  ws.getCell('A5').value = `PROVINSI ${profile.provinsi || ''}`;
  ws.getCell('A6').value = `KABUPATEN ${profile.kabupaten || ''}`;
  ws.getCell('K4').value = periode.nomor || '';
  ws.getCell('L4').value = periode.tanggal || '';
  ws.getCell('F5').value = `PELAPORAN BULAN : ${periode.bulanPelaporan} ${periode.tahunPelaporan}`;
  ws.getCell('F6').value = `PERMINTAAN BULAN: ${periode.bulanPermintaan} ${periode.tahunPermintaan}`;

  for (const r of rows) {
    if (r.isHeader) continue;
    const row = r.rowNum;
    ws.getCell(`E${row}`).value = r.stokAwal || 0;
    ws.getCell(`F${row}`).value = r.penerimaan || 0;
    ws.getCell(`G${row}`).value = r.persediaan || 0;
    ws.getCell(`H${row}`).value = r.pemakaian || 0;
    ws.getCell(`I${row}`).value = r.stokAkhir || 0;
    ws.getCell(`J${row}`).value = r.permintaan || 0;
    ws.getCell(`K${row}`).value = r.pemberian || 0;
    if (r.keterangan) ws.getCell(`L${row}`).value = r.keterangan;
  }

  ws.getCell('D312').value = periode.kunjungan?.umum || 0;
  ws.getCell('E312').value = periode.kunjungan?.askes || 0;
  ws.getCell('F312').value = periode.kunjungan?.bpjs || 0;
  ws.getCell('G312').value = periode.kunjungan?.gratis || 0;
  ws.getCell('H312').value = periode.kunjungan?.jamkesmas || 0;
  ws.getCell('I312').value = (periode.kunjungan?.umum || 0) + (periode.kunjungan?.askes || 0) +
    (periode.kunjungan?.bpjs || 0) + (periode.kunjungan?.gratis || 0) + (periode.kunjungan?.jamkesmas || 0);

  ws.getCell('B320').value = profile.namaKepalaDinkes || '';
  ws.getCell('B321').value = profile.nipKepalaDinkes ? `Nip. ${profile.nipKepalaDinkes}` : '';
  ws.getCell('D320').value = profile.namaKepalaInstalasi || '';
  ws.getCell('D321').value = profile.nipKepalaInstalasi ? `NIP. ${profile.nipKepalaInstalasi}` : '';
  ws.getCell('H320').value = profile.namaKepalaPuskesmas || '';
  ws.getCell('H321').value = profile.nipKepalaPuskesmas ? `NIP. ${profile.nipKepalaPuskesmas}` : '';
  ws.getCell('K320').value = profile.namaPetugas || '';
  ws.getCell('K321').value = profile.nipPetugas ? `NIP. ${profile.nipPetugas}` : '';

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
