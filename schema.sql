-- Skema database D1 untuk aplikasi LPLPO Puskesmas Lambuya

-- Daftar master obat resmi (urutan & nama TIDAK BOLEH diubah, sesuai format Dinkes).
-- row_num = nomor baris persis di file template Excel resmi (untuk pengisian otomatis).
CREATE TABLE IF NOT EXISTS obat_master (
  id TEXT PRIMARY KEY,
  row_num INTEGER NOT NULL,
  kode_obat TEXT,
  nama TEXT NOT NULL,
  satuan TEXT,
  is_header INTEGER NOT NULL DEFAULT 0,
  urutan INTEGER
);

CREATE INDEX IF NOT EXISTS idx_obat_master_row ON obat_master(row_num);
CREATE INDEX IF NOT EXISTS idx_obat_master_kode ON obat_master(kode_obat);

-- Satu periode = satu bulan laporan LPLPO
CREATE TABLE IF NOT EXISTS periode (
  id TEXT PRIMARY KEY,
  bulan_pelaporan TEXT NOT NULL,   -- contoh: "JULI"
  tahun_pelaporan INTEGER NOT NULL,
  bulan_permintaan TEXT NOT NULL,  -- contoh: "AGUSTUS"
  tahun_permintaan INTEGER NOT NULL,
  nomor TEXT,
  tanggal TEXT,
  kunjungan_umum REAL DEFAULT 0,
  kunjungan_askes REAL DEFAULT 0,
  kunjungan_bpjs REAL DEFAULT 0,
  kunjungan_gratis REAL DEFAULT 0,
  kunjungan_jamkesmas REAL DEFAULT 0,
  status TEXT DEFAULT 'draft',     -- draft | selesai
  created_at TEXT
);

-- Data per obat, per periode
CREATE TABLE IF NOT EXISTS periode_item (
  id TEXT PRIMARY KEY,
  periode_id TEXT NOT NULL REFERENCES periode(id) ON DELETE CASCADE,
  obat_id TEXT NOT NULL REFERENCES obat_master(id),
  stok_awal REAL DEFAULT 0,
  penerimaan REAL DEFAULT 0,
  stok_akhir_medisy REAL,          -- diisi dari upload Laporan Stok Obat Gudang (Medisy)
  persediaan REAL DEFAULT 0,
  pemakaian REAL DEFAULT 0,
  stok_akhir REAL DEFAULT 0,
  permintaan REAL DEFAULT 0,
  pemberian REAL DEFAULT 0,
  keterangan TEXT
);

CREATE INDEX IF NOT EXISTS idx_periode_item_periode ON periode_item(periode_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_periode_item_unique ON periode_item(periode_id, obat_id);

-- Profil Puskesmas + pejabat penandatangan (untuk kop & tanda tangan Surat)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
