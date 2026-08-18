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

-- ================= MODUL LOGIN & PERMINTAAN OBAT GUDANG =================

-- Akun pengguna. role: 'admin' (apoteker, akses penuh termasuk LPLPO) atau 'staff' (hanya modul Permintaan Obat)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  nama TEXT NOT NULL,
  unit TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

-- Snapshot stok gudang, ditimpa ulang tiap kali admin upload data Medisy (mis. tiap Senin)
CREATE TABLE IF NOT EXISTS gudang_stok (
  id TEXT PRIMARY KEY,
  kode_obat TEXT,
  nama TEXT NOT NULL,
  satuan TEXT,
  jumlah REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gudang_stok_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Permintaan obat dari staf ke gudang/apoteker
CREATE TABLE IF NOT EXISTS permintaan_obat (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | diproses | selesai | ditolak
  catatan TEXT,
  catatan_admin TEXT,
  created_at TEXT,
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS permintaan_obat_item (
  id TEXT PRIMARY KEY,
  permintaan_id TEXT NOT NULL REFERENCES permintaan_obat(id) ON DELETE CASCADE,
  kode_obat TEXT,
  nama TEXT NOT NULL,
  satuan TEXT,
  jumlah REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_permintaan_item_permintaan ON permintaan_obat_item(permintaan_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Data tambahan per periode untuk laporan bulanan lainnya (Prekursor, Indikator Peresepan, PIO, dst)
-- report_key contoh: 'prekursor', 'indikator_peresepan', 'pio'
CREATE TABLE IF NOT EXISTS periode_extra (
  periode_id TEXT NOT NULL,
  report_key TEXT NOT NULL,
  data TEXT,
  PRIMARY KEY (periode_id, report_key)
);
