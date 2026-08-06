import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Upload, Plus, Trash2, Settings, FileSpreadsheet, Download, Loader2,
  ClipboardList, Building2, CheckCircle2, AlertCircle, ChevronRight, Save, Search,
} from 'lucide-react';
import * as api from './lib/api';
import {
  BULAN, parseMasterFile, parseMedisyStokFile, parseStokAkhirFromLplpo, generateLplpoXlsx, computeRow,
} from './lib/utils';
import {
  export20Besar, exportHartra, exportNapza, exportPrekursor, exportPenyalahgunaanNapza, exportPio,
  generateIndikatorPeresepan, exportIndikatorPeresepan, downloadPirt, PREKURSOR_ITEMS,
} from './lib/otherReports';

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
            <div key={p.id}
              className="bg-white border border-stone-200 rounded-lg p-4 flex items-center justify-between hover:border-emerald-300">
              <button onClick={() => onOpen(p.id)} className="text-left flex-1">
                <p className="font-medium text-stone-800">Pelaporan {p.bulanPelaporan} {p.tahunPelaporan}</p>
                <p className="text-xs text-stone-500">Permintaan {p.bulanPermintaan} {p.tahunPermintaan} · {p.status === 'selesai' ? 'Selesai' : 'Draft'}</p>
              </button>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Hapus periode "${p.bulanPelaporan} ${p.tahunPelaporan}"? Semua data di dalamnya (Penerimaan, Pemakaian, hasil upload Medisy) akan ikut terhapus dan tidak bisa dikembalikan.`)) return;
                    await api.deletePeriode(p.id);
                    await onRefresh();
                    showToast('Periode dihapus.');
                  }}
                  className="text-rose-500 hover:text-rose-700 p-1.5"
                  title="Hapus periode"
                >
                  <Trash2 size={15} />
                </button>
                <button onClick={() => onOpen(p.id)}>
                  <ChevronRight size={16} className="text-stone-400" />
                </button>
              </div>
            </div>
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
  const [edits, setEdits] = useState({}); // obatId -> { stokAwal?, penerimaan?, pemakaianManual?, stokAkhirManual? }
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const medisyFileRef = useRef(null);

  const load = async () => setDetail(await api.getPeriodeDetail(periodeId));
  useEffect(() => { load(); }, [periodeId]);

  const dirtyCount = Object.keys(edits).length;

  const setEdit = (obatId, patch) => setEdits(d => ({ ...d, [obatId]: { ...d[obatId], ...patch } }));

  const handleSaveAll = async () => {
    setBusy(true);
    try {
      const asNumOrUndef = (v) => (v === undefined || v === '') ? undefined : num(v);
      const updates = Object.entries(edits).map(([obatId, e]) => ({
        obatId,
        stokAwal: asNumOrUndef(e.stokAwal),
        penerimaan: asNumOrUndef(e.penerimaan),
        pemakaianManual: asNumOrUndef(e.pemakaianManual),
        stokAkhirManual: asNumOrUndef(e.stokAkhirManual),
      }));
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

  const q = search.trim().toLowerCase();
  const visibleRows = q
    ? detail.rows.filter(r => !r.isHeader && r.nama.toLowerCase().includes(q))
    : detail.rows;

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

      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama obat..."
          className="w-full border border-stone-300 rounded px-9 py-2 text-sm"
        />
        {q && <p className="text-[11px] text-stone-400 mt-1">{visibleRows.length} obat ditemukan untuk "{search}"</p>}
      </div>

      {dirtyCount > 0 && (
        <div className="sticky top-2 z-10 bg-amber-50 border border-amber-300 rounded-lg px-4 py-2.5 mb-3 flex items-center justify-between">
          <p className="text-xs text-amber-800">{dirtyCount} baris diubah, belum disimpan.</p>
          <button disabled={busy} onClick={handleSaveAll} className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1.5">
            {busy && <Loader2 className="animate-spin" size={12} />} Simpan Perubahan
          </button>
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-rose-50 border-b border-rose-100 text-[11px] text-rose-700">
          * = obat tanpa Kode Obat valid di master (tidak bisa dicocokkan dengan file Medisy). Kolom Stok Awal, Pemakaian, dan Stok Akhir semuanya bisa diedit manual kapan saja — mengubah salah satu akan menghitung ulang kolom lain secara otomatis.
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
            {visibleRows.map(r => r.isHeader ? (
              <tr key={r.obatId} className="bg-stone-200">
                <td colSpan={9} className="px-2 py-1.5 font-semibold text-stone-700">{r.nama}</td>
              </tr>
            ) : (() => {
              const e = edits[r.obatId] || {};
              const live = computeRow({
                stokAwal: e.stokAwal !== undefined ? e.stokAwal : r.stokAwal,
                penerimaan: e.penerimaan !== undefined ? e.penerimaan : r.penerimaan,
                stokAkhirMedisy: r.stokAkhirMedisy,
                pemakaianManual: e.pemakaianManual,
                stokAkhirManual: e.stokAkhirManual,
                existingPemakaian: r.pemakaian,
              });
              return (
              <tr key={r.obatId} className={`border-t border-stone-100 hover:bg-stone-50 ${!r.kodeObat ? 'bg-rose-50/40' : ''}`}>
                <td className="px-2 py-1.5 text-stone-700">
                  {r.nama}
                  {!r.kodeObat && <span title="Kode obat tidak ditemukan di master" className="ml-1 text-rose-500 text-[10px] align-top">*</span>}
                </td>
                <td className="px-2 py-1.5 text-stone-500">{r.satuan}</td>
                <td className="px-2 py-1 text-right">
                  <input
                    value={e.stokAwal !== undefined ? e.stokAwal : r.stokAwal}
                    onChange={ev => setEdit(r.obatId, { stokAwal: ev.target.value })}
                    className="w-20 border border-stone-200 rounded px-1.5 py-0.5 text-right font-mono"
                  />
                </td>
                <td className="px-2 py-1 text-right">
                  <input
                    value={e.penerimaan !== undefined ? e.penerimaan : r.penerimaan}
                    onChange={ev => setEdit(r.obatId, { penerimaan: ev.target.value })}
                    className="w-20 border border-stone-200 rounded px-1.5 py-0.5 text-right font-mono"
                  />
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-stone-500">{live.persediaan}</td>
                <td className="px-2 py-1 text-right">
                  <input
                    value={e.pemakaianManual !== undefined ? e.pemakaianManual : live.pemakaian}
                    onChange={ev => setEdits(d => ({ ...d, [r.obatId]: { ...d[r.obatId], pemakaianManual: ev.target.value, stokAkhirManual: undefined } }))}
                    className={`w-20 border rounded px-1.5 py-0.5 text-right font-mono ${!r.kodeObat ? 'border-rose-200' : 'border-stone-200'}`}
                  />
                </td>
                <td className="px-2 py-1 text-right">
                  <input
                    value={e.stokAkhirManual !== undefined ? e.stokAkhirManual : live.stokAkhir}
                    onChange={ev => setEdits(d => ({ ...d, [r.obatId]: { ...d[r.obatId], stokAkhirManual: ev.target.value, pemakaianManual: undefined } }))}
                    className="w-20 border border-stone-200 rounded px-1.5 py-0.5 text-right font-mono"
                  />
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-stone-500">{live.permintaan}</td>
                <td className="px-2 py-1.5 text-right font-mono text-stone-500">{live.pemberian}</td>
              </tr>
              );
            })())}
          </tbody>
        </table>
      </div>

      <LaporanLainnya detail={detail} showToast={showToast} />
    </div>
  );
}

function LaporanLainnya({ detail, showToast }) {
  const [prekursor, setPrekursor] = useState(null);
  const [pio, setPio] = useState({ rawatInap: '', konseling: '', informasiObat: '' });
  const [indikator, setIndikator] = useState({ jumlahResep: 51, targetMin: 90, targetMax: 100, generated: null, seed: null });
  const [busy, setBusy] = useState('');

  useEffect(() => {
    (async () => {
      const p = await api.getExtra(detail.id, 'prekursor');
      setPrekursor(p || PREKURSOR_ITEMS.map(nama => ({ nama, stokAwal: 0, penerimaan: 0, pemakaian: 0 })));
      const pioData = await api.getExtra(detail.id, 'pio');
      if (pioData) setPio(pioData);
      else setPio({ rawatInap: 20 + Math.floor(Math.random() * 31), konseling: '', informasiObat: '' });
      const ind = await api.getExtra(detail.id, 'indikator');
      if (ind) setIndikator(ind);
    })();
  }, [detail.id]);

  const savePrekursor = async (items) => {
    setPrekursor(items);
    await api.saveExtra(detail.id, 'prekursor', items);
  };
  const savePio = async (data) => {
    setPio(data);
    await api.saveExtra(detail.id, 'pio', data);
  };
  const generateAndSaveIndikator = async () => {
    const seed = Math.floor(Math.random() * 1e9);
    const generated = generateIndikatorPeresepan({
      jumlahResep: num(indikator.jumlahResep) || 51, targetMin: num(indikator.targetMin), targetMax: num(indikator.targetMax), seed,
    });
    const data = { ...indikator, seed, generated };
    setIndikator(data);
    await api.saveExtra(detail.id, 'indikator', data);
    return data;
  };

  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); } catch (e) { showToast('Gagal export: ' + e.message, 'error'); } finally { setBusy(''); }
  };

  if (!prekursor) return null;

  return (
    <div className="mt-8">
      <h3 className="font-serif text-lg text-stone-800 mb-3">Laporan Bulanan Lainnya</h3>
      <div className="grid md:grid-cols-2 gap-4">

        <ReportCard title="20 Besar Penggunaan Obat" desc="Otomatis dari kolom Pemakaian bulan ini, diambil 20 tertinggi.">
          <button disabled={busy} onClick={() => run('20besar', () => export20Besar({ periode: detail, rows: detail.rows }))}
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1.5">
            {busy === '20besar' ? <Loader2 className="animate-spin" size={12} /> : <Download size={12} />} Export
          </button>
        </ReportCard>

        <ReportCard title="Indikator Peresepan" desc="Data diacak otomatis, hasil akhir % obat generik ada di rentang target.">
          <div className="flex flex-wrap gap-2 items-center mb-2 text-xs">
            <label>Jumlah resep</label>
            <input value={indikator.jumlahResep} onChange={e => setIndikator(d => ({ ...d, jumlahResep: e.target.value }))} className="w-14 border border-stone-200 rounded px-1.5 py-0.5" />
            <label>Target %</label>
            <input value={indikator.targetMin} onChange={e => setIndikator(d => ({ ...d, targetMin: e.target.value }))} className="w-12 border border-stone-200 rounded px-1.5 py-0.5" />
            <span>-</span>
            <input value={indikator.targetMax} onChange={e => setIndikator(d => ({ ...d, targetMax: e.target.value }))} className="w-12 border border-stone-200 rounded px-1.5 py-0.5" />
          </div>
          {indikator.generated && <p className="text-[11px] text-stone-400 mb-2">Hasil terakhir: {(indikator.generated.totalPersen * 100).toFixed(2)}% obat generik ({indikator.generated.rows.length} resep)</p>}
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => run('indikator-gen', generateAndSaveIndikator)}
              className="border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs px-3 py-1.5 rounded">
              Acak Ulang
            </button>
            <button disabled={busy || !indikator.generated} onClick={() => run('indikator-export', async () => {
              const data = indikator.generated ? indikator : await generateAndSaveIndikator();
              await exportIndikatorPeresepan({ periode: detail, generated: data.generated });
            })} className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1.5">
              {busy === 'indikator-export' ? <Loader2 className="animate-spin" size={12} /> : <Download size={12} />} Export
            </button>
          </div>
        </ReportCard>

        <ReportCard title="HARTRA" desc="Data tetap sama tiap bulan, hanya tanggal tanda tangan yang berubah otomatis.">
          <button disabled={busy} onClick={() => run('hartra', () => exportHartra({ periode: detail }))}
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1.5">
            {busy === 'hartra' ? <Loader2 className="animate-spin" size={12} /> : <Download size={12} />} Export
          </button>
        </ReportCard>

        <ReportCard title="NAPZA" desc="Data tetap sama tiap bulan, hanya bulan/tahun & tanggal tanda tangan yang berubah.">
          <button disabled={busy} onClick={() => run('napza', () => exportNapza({ periode: detail }))}
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1.5">
            {busy === 'napza' ? <Loader2 className="animate-spin" size={12} /> : <Download size={12} />} Export
          </button>
        </ReportCard>

        <ReportCard title="Penggunaan Prekursor Farmasi" desc="Isi Stok Awal/Penerimaan/Pemakaian 11 item prekursor bulan ini.">
          <div className="max-h-40 overflow-y-auto mb-2 border border-stone-100 rounded">
            <table className="w-full text-[11px]">
              <thead className="bg-stone-50 text-stone-400">
                <tr><th className="text-left px-1.5 py-1">Nama</th><th className="px-1 py-1">Awal</th><th className="px-1 py-1">Terima</th><th className="px-1 py-1">Pakai</th></tr>
              </thead>
              <tbody>
                {prekursor.map((it, i) => (
                  <tr key={it.nama} className="border-t border-stone-100">
                    <td className="px-1.5 py-0.5">{it.nama}</td>
                    {['stokAwal', 'penerimaan', 'pemakaian'].map(f => (
                      <td key={f} className="px-1 py-0.5">
                        <input value={it[f]} onChange={e => {
                          const next = prekursor.map((p, j) => j === i ? { ...p, [f]: e.target.value } : p);
                          setPrekursor(next);
                        }} className="w-12 border border-stone-200 rounded px-1 text-right" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => run('prekursor-save', () => savePrekursor(prekursor))}
              className="border border-stone-300 text-stone-600 hover:bg-stone-50 text-xs px-3 py-1.5 rounded">Simpan</button>
            <button disabled={busy} onClick={() => run('prekursor-export', async () => {
              await savePrekursor(prekursor);
              const normalized = prekursor.map(it => ({ ...it, stokAwal: num(it.stokAwal), penerimaan: num(it.penerimaan), pemakaian: num(it.pemakaian) }));
              await exportPrekursor({ periode: detail, items: normalized });
            })} className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1.5">
              {busy === 'prekursor-export' ? <Loader2 className="animate-spin" size={12} /> : <Download size={12} />} Export
            </button>
          </div>
        </ReportCard>

        <ReportCard title="Penyalahgunaan NAPZA" desc="Data NIHIL setiap bulan (belum pernah ada kasus), hanya bulan & tanggal yang berubah.">
          <button disabled={busy} onClick={() => run('penyalahgunaan', () => exportPenyalahgunaanNapza({ periode: detail }))}
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1.5">
            {busy === 'penyalahgunaan' ? <Loader2 className="animate-spin" size={12} /> : <Download size={12} />} Export
          </button>
        </ReportCard>

        <ReportCard title="PIO" desc="Rawat Jalan otomatis dari total Kunjungan Resep di atas. Rawat Inap, Konseling, Informasi Obat diisi manual.">
          <div className="flex flex-wrap gap-2 items-center mb-2 text-xs">
            <label>Rawat Inap</label>
            <input value={pio.rawatInap} onChange={e => setPio(d => ({ ...d, rawatInap: e.target.value }))} className="w-14 border border-stone-200 rounded px-1.5 py-0.5" />
            <label>Konseling</label>
            <input value={pio.konseling} onChange={e => setPio(d => ({ ...d, konseling: e.target.value }))} className="w-14 border border-stone-200 rounded px-1.5 py-0.5" />
            <label>Info Obat</label>
            <input value={pio.informasiObat} onChange={e => setPio(d => ({ ...d, informasiObat: e.target.value }))} className="w-14 border border-stone-200 rounded px-1.5 py-0.5" />
          </div>
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => run('pio-save', () => savePio(pio))}
              className="border border-stone-300 text-stone-600 hover:bg-stone-50 text-xs px-3 py-1.5 rounded">Simpan</button>
            <button disabled={busy} onClick={() => run('pio-export', async () => {
              await savePio(pio);
              await exportPio({ periode: detail, rawatInap: num(pio.rawatInap), konseling: num(pio.konseling), informasiObat: num(pio.informasiObat) });
            })} className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1.5">
              {busy === 'pio-export' ? <Loader2 className="animate-spin" size={12} /> : <Download size={12} />} Export
            </button>
          </div>
        </ReportCard>

        <ReportCard title="PIRT" desc="File tetap, tidak pernah berubah setiap bulan.">
          <button onClick={downloadPirt} className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1.5">
            <Download size={12} /> Download PIRT
          </button>
        </ReportCard>

        <ReportCard title="POR (Penggunaan Obat Rasional)" desc="Menunggu file data resep dari Medisy — belum tersedia.">
          <p className="text-xs text-stone-400 italic">Kirim file export resep Diare/ISPA dari Medisy untuk mengaktifkan laporan ini.</p>
        </ReportCard>

      </div>
    </div>
  );
}

function ReportCard({ title, desc, children }) {
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4">
      <p className="font-medium text-stone-800 text-sm mb-1">{title}</p>
      <p className="text-xs text-stone-500 mb-3">{desc}</p>
      {children}
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
