import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Upload, Plus, Trash2, Settings, FileSpreadsheet, Download, Loader2,
  ClipboardList, Building2, CheckCircle2, AlertCircle, ChevronRight, Save,
} from 'lucide-react';
import * as api from './lib/api';
import {
  BULAN, parseMasterFile, parseMedisyStokFile, parseStokAkhirFromLplpo, generateLplpoXlsx,
} from './lib/utils';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function App() {
  const [tab, setTab] = useState('periode');
  const [master, setMaster] = useState([]);
  const [profile, setProfile] = useState(null);
  const [profileDraft, setProfileDraft] = useState(null);
  const [periodeList, setPeriodeList] = useState([]);
  const [activePeriodeId, setActivePeriodeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    (async () => {
      try {
        const [m, p, pl] = await Promise.all([api.getMaster(), api.getProfile(), api.getPeriodeList()]);
        setMaster(m);
        setProfile(p);
        setProfileDraft(p);
        setPeriodeList(pl);
      } catch (e) {
        showToast('Gagal memuat data: ' + e.message, 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const needsSetup = !loading && master.length === 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-400">
        <Loader2 className="animate-spin mr-2" size={18} /> Memuat...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-emerald-900 text-emerald-50 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl tracking-tight">LPLPO {profile?.puskesmas ? `- Puskesmas ${profile.puskesmas}` : ''}</h1>
            <p className="text-emerald-200 text-sm mt-0.5">Laporan Pemakaian &amp; Lembar Permintaan Obat</p>
          </div>
          <button onClick={() => setTab('setup')} className="text-emerald-200 hover:text-white text-xs flex items-center gap-1 border border-emerald-700 rounded px-3 py-1.5">
            <Settings size={13} /> Setup &amp; Profil
          </button>
        </div>
        <nav className="max-w-6xl mx-auto flex gap-1 mt-5">
          {[
            { key: 'periode', label: 'Data Periode Bulanan', Icon: ClipboardList },
            { key: 'setup', label: 'Setup & Profil', Icon: Building2 },
          ].map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-t transition-colors ${tab === key ? 'bg-stone-50 text-emerald-900 font-medium' : 'text-emerald-200 hover:bg-emerald-800'}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {toast && (
          <div className={`mb-4 px-4 py-2.5 rounded text-sm flex items-center gap-2 ${toast.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            {toast.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />} {toast.msg}
          </div>
        )}

        {needsSetup && tab === 'periode' && (
          <div className="text-center py-16 text-stone-400 border-2 border-dashed border-stone-200 rounded-lg">
            <FileSpreadsheet className="mx-auto mb-3" size={32} />
            <p className="text-sm mb-3">Master daftar obat belum diimpor.</p>
            <button onClick={() => setTab('setup')} className="text-emerald-700 text-sm underline">Buka Setup &amp; Profil untuk mulai</button>
          </div>
        )}

        {tab === 'setup' && (
          <SetupTab
            master={master} setMaster={setMaster}
            profileDraft={profileDraft} setProfileDraft={setProfileDraft}
            onSaveProfile={async () => {
              setBusy(true);
              try {
                const saved = await api.saveProfile(profileDraft);
                setProfile(saved);
                showToast('Profil disimpan.');
              } catch (e) { showToast(e.message, 'error'); } finally { setBusy(false); }
            }}
            onImportMaster={async (rows, missingKode) => {
              setBusy(true);
              try {
                await api.importMaster(rows);
                const m = await api.getMaster();
                setMaster(m);
                setPeriodeList([]);
                if (missingKode && missingKode.length > 0) {
                  showToast(
                    `Master obat diimpor (${rows.length} baris). PERHATIAN: ${missingKode.length} obat tidak punya Kode Obat valid, jadi Pemakaian-nya tidak bisa dihitung otomatis dari Medisy — perlu dilengkapi manual di file master.`,
                    'error'
                  );
                } else {
                  showToast(`Master obat berhasil diimpor: ${rows.length} baris.`);
                }
              } catch (e) { showToast(e.message, 'error'); } finally { setBusy(false); }
            }}
            busy={busy}
          />
        )}

        {tab === 'periode' && !needsSetup && (
          activePeriodeId ? (
            <PeriodeDetail
              periodeId={activePeriodeId}
              onBack={() => setActivePeriodeId(null)}
              profile={profile}
              showToast={showToast}
            />
          ) : (
            <PeriodeList
              master={master}
              periodeList={periodeList}
              onOpen={setActivePeriodeId}
              onRefresh={async () => setPeriodeList(await api.getPeriodeList())}
              showToast={showToast}
            />
          )
        )}
      </main>
    </div>
  );
}

// ---------------- Setup Tab ----------------
function SetupTab({ master, profileDraft, setProfileDraft, onSaveProfile, onImportMaster, busy }) {
  const fileRef = useRef(null);

  const handleMasterFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    try {
      const rows = parseMasterFile(buf);
      if (rows.length === 0) throw new Error('Tidak ada baris data yang terbaca.');
      const missingKode = rows.filter(r => !r.isHeader && !r.kodeObat);
      await onImportMaster(rows, missingKode);
    } catch (err) {
      alert('Gagal membaca file: ' + err.message);
    }
    e.target.value = '';
  };

  if (!profileDraft) return null;

  const fields = [
    ['puskesmas', 'Nama Puskesmas'], ['kecamatan', 'Kecamatan'], ['kabupaten', 'Kabupaten'], ['provinsi', 'Provinsi'],
    ['namaKepalaDinkes', 'Nama Kepala Dinas Kesehatan'], ['nipKepalaDinkes', 'NIP Kepala Dinas Kesehatan'],
    ['namaKepalaInstalasi', 'Nama Kepala Instalasi Farmasi'], ['nipKepalaInstalasi', 'NIP Kepala Instalasi Farmasi'],
    ['namaKepalaPuskesmas', 'Nama Kepala Puskesmas'], ['nipKepalaPuskesmas', 'NIP Kepala Puskesmas'],
    ['namaPetugas', 'Nama Petugas Puskesmas (pembuat laporan)'], ['nipPetugas', 'NIP Petugas Puskesmas'],
  ];

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white border border-stone-200 rounded-lg p-5">
        <h2 className="font-serif text-lg text-stone-800 mb-1">Master Daftar Obat</h2>
        <p className="text-xs text-stone-500 mb-4">
          Upload sekali di awal (file MASTER_LPLPO.xlsx berisi urutan &amp; nama obat resmi Dinkes + Kode Obat Medisy).
          Mengulang upload akan MENGGANTI seluruh master dan menghapus riwayat periode.
        </p>
        <div className="text-sm text-stone-600 mb-3">
          Status: {master.length > 0 ? (
            <span className="text-emerald-700 font-medium">{master.length} baris terimpor ({master.filter(m => !m.isHeader).length} obat)</span>
          ) : (
            <span className="text-rose-600 font-medium">Belum diimpor</span>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleMasterFile} />
        <button disabled={busy} onClick={() => fileRef.current.click()}
          className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm px-4 py-2 rounded flex items-center gap-2">
          {busy ? <Loader2 className="animate-spin" size={15} /> : <Upload size={15} />} Upload / Ganti Master Obat
        </button>
      </div>

      <div className="bg-white border border-stone-200 rounded-lg p-5">
        <h2 className="font-serif text-lg text-stone-800 mb-1">Profil Puskesmas &amp; Penandatangan</h2>
        <p className="text-xs text-stone-500 mb-4">Muncul otomatis di kop dan tanda tangan file LPLPO yang diekspor.</p>
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {fields.map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs text-stone-500 mb-0.5">{label}</label>
              <input
                value={profileDraft[key] || ''}
                onChange={(e) => setProfileDraft(d => ({ ...d, [key]: e.target.value }))}
                className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-sm"
              />
            </div>
          ))}
        </div>
        <button disabled={busy} onClick={onSaveProfile} className="mt-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm px-4 py-2 rounded flex items-center gap-2">
          <Save size={14} /> Simpan Profil
        </button>
      </div>
    </div>
  );
}

// ---------------- Periode List ----------------
function PeriodeList({ master, periodeList, onOpen, onRefresh, showToast }) {
  const [showCreate, setShowCreate] = useState(false);
  const isFirst = periodeList.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-stone-500">{periodeList.length} periode tersimpan</p>
        <button onClick={() => setShowCreate(true)} className="bg-emerald-700 hover:bg-emerald-800 text-white text-sm px-4 py-2 rounded flex items-center gap-1.5">
          <Plus size={15} /> Buat Periode Baru
        </button>
      </div>

      {periodeList.length === 0 ? (
        <div className="text-center py-16 text-stone-400 border-2 border-dashed border-stone-200 rounded-lg">
          <ClipboardList className="mx-auto mb-3" size={32} />
          <p className="text-sm">Belum ada periode. Buat periode pertama untuk mulai.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {periodeList.map(p => (
            <button key={p.id} onClick={() => onOpen(p.id)}
              className="bg-white border border-stone-200 rounded-lg p-4 flex items-center justify-between hover:border-emerald-300 text-left">
              <div>
                <p className="font-medium text-stone-800">Pelaporan {p.bulanPelaporan} {p.tahunPelaporan}</p>
                <p className="text-xs text-stone-500">Permintaan {p.bulanPermintaan} {p.tahunPermintaan} · {p.status === 'selesai' ? 'Selesai' : 'Draft'}</p>
              </div>
              <ChevronRight size={16} className="text-stone-400" />
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <CreatePeriodeModal
          master={master}
          isFirst={isFirst}
          onCancel={() => setShowCreate(false)}
          onCreated={async (id) => { setShowCreate(false); await onRefresh(); onOpen(id); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function CreatePeriodeModal({ master, isFirst, onCancel, onCreated, showToast }) {
  const now = new Date();
  const [bulanPelaporan, setBulanPelaporan] = useState(BULAN[now.getMonth()]);
  const [tahunPelaporan, setTahunPelaporan] = useState(now.getFullYear());
  const [bulanPermintaan, setBulanPermintaan] = useState(BULAN[(now.getMonth() + 1) % 12]);
  const [tahunPermintaan, setTahunPermintaan] = useState(now.getFullYear());
  const [nomor, setNomor] = useState('');
  const [tanggal, setTanggal] = useState('');
  const [initialFile, setInitialFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    setBusy(true);
    try {
      let initialStokAwal = null;
      if (isFirst && initialFile) {
        const buf = await initialFile.arrayBuffer();
        const byRowNum = parseStokAkhirFromLplpo(buf);
        initialStokAwal = {};
        master.forEach(m => {
          if (byRowNum[m.rowNum] !== undefined) initialStokAwal[m.id] = byRowNum[m.rowNum];
        });
      }
      const { id } = await api.createPeriode({
        bulanPelaporan, tahunPelaporan: num(tahunPelaporan), bulanPermintaan, tahunPermintaan: num(tahunPermintaan),
        nomor, tanggal, initialStokAwal,
      });
      onCreated(id);
    } catch (e) {
      showToast('Gagal membuat periode: ' + e.message, 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-stone-200 bg-emerald-700 rounded-t-lg">
          <h3 className="font-serif text-lg text-white">Buat Periode Baru</h3>
        </div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Bulan Pelaporan</label>
              <select value={bulanPelaporan} onChange={e => setBulanPelaporan(e.target.value)} className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm">
                {BULAN.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Tahun</label>
              <input type="number" value={tahunPelaporan} onChange={e => setTahunPelaporan(e.target.value)} className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Bulan Permintaan</label>
              <select value={bulanPermintaan} onChange={e => setBulanPermintaan(e.target.value)} className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm">
                {BULAN.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Tahun</label>
              <input type="number" value={tahunPermintaan} onChange={e => setTahunPermintaan(e.target.value)} className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Nomor Surat</label>
            <input value={nomor} onChange={e => setNomor(e.target.value)} className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Tanggal</label>
            <input value={tanggal} onChange={e => setTanggal(e.target.value)} placeholder="mis. 1 Agustus 2026" className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-sm" />
          </div>

          {isFirst && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <p className="text-xs text-amber-800 mb-2">Ini periode pertama. Upload file LPLPO bulan sebelumnya (mis. LPLPO Juni) untuk mengisi Stok Awal otomatis dari kolom Stok Akhir-nya. Opsional — kalau dilewati, semua Stok Awal dimulai dari 0.</p>
              <input type="file" accept=".xlsx,.xls" onChange={e => setInitialFile(e.target.files[0])} className="text-xs" />
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-stone-100 flex justify-end gap-2">
          <button onClick={onCancel} className="text-sm text-stone-500 px-4 py-2">Batal</button>
          <button disabled={busy} onClick={handleCreate} className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm px-5 py-2 rounded flex items-center gap-2">
            {busy && <Loader2 className="animate-spin" size={14} />} Buat Periode
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Periode Detail ----------------
function PeriodeDetail({ periodeId, onBack, profile, showToast }) {
  const [detail, setDetail] = useState(null);
  const [edits, setEdits] = useState({}); // obatId -> { penerimaan?, pemakaianManual? } sedang diedit
  const [busy, setBusy] = useState(false);
  const medisyFileRef = useRef(null);

  const load = async () => setDetail(await api.getPeriodeDetail(periodeId));
  useEffect(() => { load(); }, [periodeId]);

  const dirtyCount = Object.keys(edits).length;

  const handleSavePenerimaan = async () => {
    setBusy(true);
    try {
      const updates = Object.entries(edits).map(([obatId, e]) => {
        const row = detail.rows.find(r => r.obatId === obatId);
        return {
          obatId,
          penerimaan: num(e.penerimaan !== undefined ? e.penerimaan : row?.penerimaan),
          pemakaianManual: e.pemakaianManual !== undefined ? num(e.pemakaianManual) : (row?.kodeObat ? undefined : row?.pemakaian),
        };
      });
      await api.saveItems(periodeId, updates);
      setEdits({});
      await load();
      showToast('Data tersimpan & dihitung ulang.');
    } catch (e) { showToast(e.message, 'error'); } finally { setBusy(false); }
  };

  const handleImportMedisy = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const rows = parseMedisyStokFile(buf);
      const res = await api.importMedisy(periodeId, rows);
      await load();
      showToast(`Stok Medisy diproses: ${res.matched} obat cocok${res.unmatchedCount ? `, ${res.unmatchedCount} kode tidak dikenali (diabaikan)` : ''}.`);
    } catch (err) {
      showToast('Gagal memproses file: ' + err.message, 'error');
    } finally { setBusy(false); e.target.value = ''; }
  };

  const handleExport = async () => {
    setBusy(true);
    try {
      const res = await fetch('/template_lplpo.xlsx');
      const templateArrayBuffer = await res.arrayBuffer();
      const blob = await generateLplpoXlsx({ templateArrayBuffer, periode: detail, rows: detail.rows, profile });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LPLPO_${detail.bulanPelaporan}_${detail.tahunPelaporan}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast('Gagal membuat file: ' + e.message, 'error');
    } finally { setBusy(false); }
  };

  const saveKunjungan = async (patch) => {
    await api.updatePeriode(periodeId, patch);
    await load();
  };

  if (!detail) return <div className="text-stone-400 text-sm">Memuat...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <button onClick={onBack} className="text-xs text-stone-500 hover:text-emerald-700 mb-1">&larr; Kembali ke daftar periode</button>
          <h2 className="font-serif text-xl text-stone-800">Pelaporan {detail.bulanPelaporan} {detail.tahunPelaporan}</h2>
          <p className="text-xs text-stone-500">Permintaan {detail.bulanPermintaan} {detail.tahunPermintaan}</p>
        </div>
        <div className="flex gap-2">
          <input ref={medisyFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportMedisy} />
          <button disabled={busy} onClick={() => medisyFileRef.current.click()}
            className="border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-sm px-4 py-2 rounded flex items-center gap-1.5">
            <Upload size={14} /> Upload Stok Medisy
          </button>
          <button disabled={busy} onClick={handleExport}
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-sm px-4 py-2 rounded flex items-center gap-1.5">
            {busy ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />} Export .xlsx
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        <input value={detail.nomor || ''} onChange={e => setDetail(d => ({ ...d, nomor: e.target.value }))}
          onBlur={() => api.updatePeriode(periodeId, { nomor: detail.nomor })}
          placeholder="Nomor Surat" className="border border-stone-300 rounded px-2.5 py-1.5 text-sm" />
        <input value={detail.tanggal || ''} onChange={e => setDetail(d => ({ ...d, tanggal: e.target.value }))}
          onBlur={() => api.updatePeriode(periodeId, { tanggal: detail.tanggal })}
          placeholder="Tanggal" className="border border-stone-300 rounded px-2.5 py-1.5 text-sm" />
      </div>

      <KunjunganResep detail={detail} onSave={saveKunjungan} />

      {dirtyCount > 0 && (
        <div className="sticky top-2 z-10 bg-amber-50 border border-amber-300 rounded-lg px-4 py-2.5 mb-3 flex items-center justify-between">
          <p className="text-xs text-amber-800">{dirtyCount} baris Penerimaan diubah, belum disimpan.</p>
          <button disabled={busy} onClick={handleSavePenerimaan} className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1.5">
            {busy && <Loader2 className="animate-spin" size={12} />} Simpan Penerimaan
          </button>
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-rose-50 border-b border-rose-100 text-[11px] text-rose-700">
          * = obat tanpa Kode Obat valid di master (tidak bisa dicocokkan dengan file Medisy) — kolom Pemakaian untuk obat ini harus diisi manual.
        </div>
        <table className="w-full text-xs">
          <thead className="bg-stone-100 text-stone-500">
            <tr>
              <th className="text-left px-2 py-2">Nama Obat</th>
              <th className="text-left px-2 py-2">Satuan</th>
              <th className="text-right px-2 py-2 bg-stone-50">Stok Awal</th>
              <th className="text-right px-2 py-2 bg-emerald-50">Penerimaan</th>
              <th className="text-right px-2 py-2 bg-amber-50">Persediaan</th>
              <th className="text-right px-2 py-2 bg-amber-50">Pemakaian</th>
              <th className="text-right px-2 py-2 bg-amber-50">Stok Akhir</th>
              <th className="text-right px-2 py-2 bg-amber-50">Permintaan</th>
              <th className="text-right px-2 py-2 bg-amber-50">Pemberian</th>
            </tr>
          </thead>
          <tbody>
            {detail.rows.map(r => r.isHeader ? (
              <tr key={r.obatId} className="bg-stone-200">
                <td colSpan={9} className="px-2 py-1.5 font-semibold text-stone-700">{r.nama}</td>
              </tr>
            ) : (
              <tr key={r.obatId} className={`border-t border-stone-100 hover:bg-stone-50 ${!r.kodeObat ? 'bg-rose-50/40' : ''}`}>
                <td className="px-2 py-1.5 text-stone-700">
                  {r.nama}
                  {!r.kodeObat && <span title="Kode obat tidak ditemukan di master — Pemakaian harus diisi manual" className="ml-1 text-rose-500 text-[10px] align-top">*</span>}
                </td>
                <td className="px-2 py-1.5 text-stone-500">{r.satuan}</td>
                <td className="px-2 py-1.5 text-right font-mono text-stone-500">{r.stokAwal}</td>
                <td className="px-2 py-1 text-right">
                  <input
                    value={edits[r.obatId]?.penerimaan !== undefined ? edits[r.obatId].penerimaan : r.penerimaan}
                    onChange={e => setEdits(d => ({ ...d, [r.obatId]: { ...d[r.obatId], penerimaan: e.target.value } }))}
                    className="w-20 border border-stone-200 rounded px-1.5 py-0.5 text-right font-mono"
                  />
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-stone-500">{r.persediaan}</td>
                <td className="px-2 py-1 text-right">
                  {r.kodeObat ? (
                    <span className="font-mono text-stone-500">{r.pemakaian}</span>
                  ) : (
                    <input
                      value={edits[r.obatId]?.pemakaianManual !== undefined ? edits[r.obatId].pemakaianManual : r.pemakaian}
                      onChange={e => setEdits(d => ({ ...d, [r.obatId]: { ...d[r.obatId], pemakaianManual: e.target.value } }))}
                      className="w-20 border border-rose-200 rounded px-1.5 py-0.5 text-right font-mono"
                    />
                  )}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-stone-500">{r.stokAkhir}</td>
                <td className="px-2 py-1.5 text-right font-mono text-stone-500">{r.permintaan}</td>
                <td className="px-2 py-1.5 text-right font-mono text-stone-500">{r.pemberian}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KunjunganResep({ detail, onSave }) {
  const [v, setV] = useState(detail.kunjungan);
  useEffect(() => setV(detail.kunjungan), [detail.id]);
  const fields = [['umum', 'Umum'], ['askes', 'Askes'], ['bpjs', 'BPJS'], ['gratis', 'Gratis'], ['jamkesmas', 'Jamkesmas']];
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-3 mb-4">
      <p className="text-xs font-medium text-stone-600 mb-2">Jumlah Kunjungan Resep</p>
      <div className="grid grid-cols-5 gap-2">
        {fields.map(([key, label]) => (
          <div key={key}>
            <label className="block text-[10px] text-stone-400 mb-0.5">{label}</label>
            <input
              value={v[key] ?? 0}
              onChange={e => setV(d => ({ ...d, [key]: e.target.value }))}
              onBlur={() => onSave({
                kunjunganUmum: num(v.umum), kunjunganAskes: num(v.askes), kunjunganBpjs: num(v.bpjs),
                kunjunganGratis: num(v.gratis), kunjunganJamkesmas: num(v.jamkesmas),
              })}
              className="w-full border border-stone-200 rounded px-2 py-1 text-xs text-right font-mono"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
