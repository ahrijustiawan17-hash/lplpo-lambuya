import { useState, useEffect, useRef } from 'react';
import {
  LogIn, LogOut, Search, Plus, Trash2, Send, Upload, Loader2, CheckCircle2, AlertCircle,
  Package, ClipboardList, Users, UserPlus, Clock,
} from 'lucide-react';
import * as api from './lib/api';
import { parseMedisyStokFile } from './lib/utils';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ---------------- Halaman setup admin pertama (hanya muncul sekali, saat belum ada akun sama sekali) ----------------
export function BootstrapPage({ onDone }) {
  const [form, setForm] = useState({ username: '', password: '', nama: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.bootstrapAdmin(form);
      onDone();
    } catch (err) {
      setError(err.message || 'Gagal membuat akun');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white border border-stone-200 rounded-lg shadow-sm w-full max-w-sm p-6">
        <h1 className="font-serif text-xl text-stone-800 mb-1">Setup Awal Aplikasi</h1>
        <p className="text-xs text-stone-500 mb-5">Belum ada akun sama sekali. Buat akun Admin (Apoteker) pertama untuk mulai.</p>
        {error && <div className="mb-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded px-3 py-2">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Nama Lengkap (Apoteker)</label>
            <input required value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Username</label>
            <input required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Password (minimal 6 karakter)</label>
            <input required type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm" />
          </div>
          <button disabled={busy} className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm py-2 rounded flex items-center justify-center gap-2">
            {busy && <Loader2 className="animate-spin" size={14} />} Buat Akun Admin
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------- Halaman login ----------------
export function LoginPage({ onLoggedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.login(username, password);
      onLoggedIn(res.user);
    } catch (err) {
      setError('Username atau password salah');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white border border-stone-200 rounded-lg shadow-sm w-full max-w-sm p-6">
        <div className="flex justify-center mb-4">
          <img src="/logo.png" alt="Logo" className="h-16 w-16 object-contain" />
        </div>
        <h1 className="font-serif text-xl text-stone-800 mb-1 text-center">Masuk</h1>
        <p className="text-xs text-stone-500 mb-5 text-center">LPLPO &amp; Permintaan Obat Gudang</p>
        {error && <div className="mb-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded px-3 py-2 flex items-center gap-1.5"><AlertCircle size={13} /> {error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Username</label>
            <input required autoFocus value={username} onChange={e => setUsername(e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Password</label>
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm" />
          </div>
          <button disabled={busy} className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm py-2 rounded flex items-center justify-center gap-2">
            {busy ? <Loader2 className="animate-spin" size={14} /> : <LogIn size={14} />} Masuk
          </button>
        </form>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: ['Menunggu', 'bg-amber-50 text-amber-700 border-amber-200'],
    diproses: ['Diproses', 'bg-blue-50 text-blue-700 border-blue-200'],
    selesai: ['Selesai', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
    ditolak: ['Ditolak', 'bg-rose-50 text-rose-700 border-rose-200'],
  };
  const [label, cls] = map[status] || [status, 'bg-stone-50 text-stone-600 border-stone-200'];
  return <span className={`text-[11px] px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}

// ---------------- Portal Staf: cari stok, ajukan permintaan, riwayat ----------------
export function StaffPortal({ user, onLogout }) {
  const [tab, setTab] = useState('ajukan');
  const [stok, setStok] = useState({ updatedAt: null, items: [] });
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState({}); // kodeObat||nama -> { ...item, jumlah }
  const [catatan, setCatatan] = useState('');
  const [riwayat, setRiwayat] = useState([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const loadStok = async () => setStok(await api.getGudangStok());
  const loadRiwayat = async () => setRiwayat(await api.getPermintaan());

  useEffect(() => { loadStok(); loadRiwayat(); }, []);

  const q = search.trim().toLowerCase();
  const filtered = q ? stok.items.filter(it => it.nama.toLowerCase().includes(q)) : stok.items;

  const addToCart = (item) => {
    const key = item.id;
    setCart(c => ({ ...c, [key]: c[key] ? { ...c[key], jumlah: c[key].jumlah + 1 } : { ...item, jumlah: 1 } }));
  };
  const removeFromCart = (key) => setCart(c => { const n = { ...c }; delete n[key]; return n; });
  const setCartQty = (key, jumlah) => setCart(c => ({ ...c, [key]: { ...c[key], jumlah } }));

  const cartList = Object.entries(cart);

  const submitPermintaan = async () => {
    if (cartList.length === 0) { showToast('Belum ada obat yang dipilih.', 'error'); return; }
    setBusy(true);
    try {
      await api.createPermintaan({
        catatan,
        items: cartList.map(([, it]) => ({ kodeObat: it.kodeObat, nama: it.nama, satuan: it.satuan, jumlah: num(it.jumlah) })),
      });
      setCart({});
      setCatatan('');
      await loadRiwayat();
      showToast('Permintaan berhasil dikirim ke apoteker.');
      setTab('riwayat');
    } catch (e) {
      showToast('Gagal mengirim: ' + e.message, 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-emerald-900 text-emerald-50 px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="h-12 w-12 object-contain rounded-full bg-white/90 p-0.5 shrink-0" />
            <div>
              <h1 className="font-serif text-xl tracking-tight">Permintaan Obat Gudang</h1>
              <p className="text-emerald-200 text-xs mt-0.5">{user.nama}{user.unit ? ` · ${user.unit}` : ''}</p>
            </div>
          </div>
          <button onClick={onLogout} className="text-emerald-200 hover:text-white text-xs flex items-center gap-1 border border-emerald-700 rounded px-3 py-1.5">
            <LogOut size={13} /> Keluar
          </button>
        </div>
        <nav className="max-w-4xl mx-auto flex gap-1 mt-5">
          {[
            { key: 'ajukan', label: 'Ajukan Permintaan', Icon: Package },
            { key: 'riwayat', label: 'Riwayat Saya', Icon: Clock },
          ].map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-t transition-colors ${tab === key ? 'bg-stone-50 text-emerald-900 font-medium' : 'text-emerald-200 hover:bg-emerald-800'}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {toast && (
          <div className={`mb-4 px-4 py-2.5 rounded text-sm flex items-center gap-2 ${toast.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            {toast.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />} {toast.msg}
          </div>
        )}

        {tab === 'ajukan' && (
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <p className="text-xs text-stone-400 mb-2">
                Stok gudang {stok.updatedAt ? `diperbarui ${new Date(stok.updatedAt).toLocaleString('id-ID')}` : '(belum pernah diupload admin)'}
              </p>
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama obat..."
                  className="w-full border border-stone-300 rounded px-9 py-2 text-sm bg-white" />
              </div>
              <div className="bg-white border border-stone-200 rounded-lg overflow-hidden max-h-[28rem] overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-sm text-stone-400 text-center py-8">Tidak ada obat ditemukan.</p>
                ) : filtered.map(it => (
                  <div key={it.id} className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100 last:border-0 hover:bg-stone-50">
                    <div>
                      <p className="text-sm text-stone-800">{it.nama}</p>
                      <p className="text-xs text-stone-400">{it.satuan} · Stok: {it.jumlah}</p>
                    </div>
                    <button onClick={() => addToCart(it)} className="text-emerald-700 border border-emerald-200 hover:bg-emerald-50 text-xs px-2.5 py-1.5 rounded flex items-center gap-1">
                      <Plus size={12} /> Pilih
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="bg-white border border-stone-200 rounded-lg p-4 sticky top-4">
                <p className="font-medium text-stone-800 text-sm mb-3">Daftar Permintaan ({cartList.length})</p>
                {cartList.length === 0 ? (
                  <p className="text-xs text-stone-400">Belum ada obat dipilih. Klik "Pilih" di daftar stok sebelah kiri.</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {cartList.map(([key, it]) => (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <span className="flex-1 text-stone-700">{it.nama}</span>
                        <input type="number" min="0" value={it.jumlah} onChange={e => setCartQty(key, e.target.value)}
                          className="w-14 border border-stone-200 rounded px-1.5 py-1 text-right" />
                        <button onClick={() => removeFromCart(key)} className="text-rose-400 hover:text-rose-600"><Trash2 size={13} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan (opsional)"
                  rows={2} className="w-full border border-stone-200 rounded px-2.5 py-1.5 text-xs mb-3" />
                <button disabled={busy || cartList.length === 0} onClick={submitPermintaan}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-sm py-2 rounded flex items-center justify-center gap-2">
                  {busy ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />} Kirim Permintaan
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'riwayat' && (
          <div className="grid gap-2">
            {riwayat.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-10">Belum ada riwayat permintaan.</p>
            ) : riwayat.map(p => (
              <div key={p.id} className="bg-white border border-stone-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-stone-400">{new Date(p.createdAt).toLocaleString('id-ID')}</p>
                  <StatusBadge status={p.status} />
                </div>
                <ul className="text-sm text-stone-700 mb-1">
                  {p.items.map(it => <li key={it.id}>{it.nama} — {it.jumlah} {it.satuan}</li>)}
                </ul>
                {p.catatan && <p className="text-xs text-stone-400 italic">Catatan: {p.catatan}</p>}
                {p.catatanAdmin && <p className="text-xs text-emerald-700 mt-1">Balasan apoteker: {p.catatanAdmin}</p>}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------- Panel Admin: dipasang sebagai tab tambahan di App LPLPO ----------------
export function AdminGudangPanel({ showToast }) {
  const [sub, setSub] = useState('permintaan');
  const [permintaan, setPermintaan] = useState([]);
  const [stok, setStok] = useState({ updatedAt: null, items: [] });
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const loadAll = async () => {
    setPermintaan(await api.getPermintaan());
    setStok(await api.getGudangStok());
    setUsers(await api.getUsers());
  };
  useEffect(() => { loadAll(); }, []);

  const handleUploadStok = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const rows = parseMedisyStokFile(buf);
      const res = await api.importGudangStok(rows);
      await loadAll();
      showToast(`Stok gudang diperbarui: ${res.count} item.`);
    } catch (err) {
      showToast('Gagal upload: ' + err.message, 'error');
    } finally { setBusy(false); e.target.value = ''; }
  };

  const updateStatus = async (id, status) => {
    setBusy(true);
    try {
      await api.updatePermintaanStatus(id, status, '');
      await loadAll();
      showToast('Status diperbarui.');
    } catch (e) { showToast(e.message, 'error'); } finally { setBusy(false); }
  };

  const pendingCount = permintaan.filter(p => p.status === 'pending').length;

  return (
    <div>
      <div className="flex gap-1 mb-5">
        {[
          { key: 'permintaan', label: `Permintaan Masuk${pendingCount ? ` (${pendingCount})` : ''}`, Icon: ClipboardList },
          { key: 'stok', label: 'Upload Stok Mingguan', Icon: Upload },
          { key: 'staf', label: 'Kelola Akun Staf', Icon: Users },
        ].map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setSub(key)}
            className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded ${sub === key ? 'bg-emerald-700 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {sub === 'permintaan' && (
        <div className="grid gap-2">
          {permintaan.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-10">Belum ada permintaan masuk.</p>
          ) : permintaan.map(p => (
            <div key={p.id} className="bg-white border border-stone-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-stone-800">{p.namaPemohon} {p.unitPemohon ? `· ${p.unitPemohon}` : ''}</p>
                  <p className="text-xs text-stone-400">{new Date(p.createdAt).toLocaleString('id-ID')}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <ul className="text-sm text-stone-700 mb-2">
                {p.items.map(it => <li key={it.id}>{it.nama} — {it.jumlah} {it.satuan}</li>)}
              </ul>
              {p.catatan && <p className="text-xs text-stone-400 italic mb-2">Catatan: {p.catatan}</p>}
              {p.status === 'pending' && (
                <div className="flex gap-2">
                  <button disabled={busy} onClick={() => updateStatus(p.id, 'diproses')} className="text-xs border border-blue-200 text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded">Tandai Diproses</button>
                  <button disabled={busy} onClick={() => updateStatus(p.id, 'selesai')} className="text-xs border border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded">Tandai Selesai</button>
                  <button disabled={busy} onClick={() => updateStatus(p.id, 'ditolak')} className="text-xs border border-rose-200 text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded">Tolak</button>
                </div>
              )}
              {p.status === 'diproses' && (
                <div className="flex gap-2">
                  <button disabled={busy} onClick={() => updateStatus(p.id, 'selesai')} className="text-xs border border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded">Tandai Selesai</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {sub === 'stok' && (
        <div className="bg-white border border-stone-200 rounded-lg p-5 max-w-lg">
          <p className="text-sm text-stone-600 mb-1">
            Stok saat ini: <span className="font-medium">{stok.items.length} item</span>
          </p>
          <p className="text-xs text-stone-400 mb-4">
            {stok.updatedAt ? `Terakhir diperbarui: ${new Date(stok.updatedAt).toLocaleString('id-ID')}` : 'Belum pernah diupload.'}
          </p>
          <p className="text-xs text-stone-500 mb-3">
            Upload file "Laporan Stok Obat Gudang" dari Medisy (format sama seperti upload stok LPLPO) — lakukan ini rutin tiap Senin
            supaya staf melihat stok yang up to date saat mengajukan permintaan. Upload baru akan MENGGANTI seluruh data stok lama.
          </p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUploadStok} />
          <button disabled={busy} onClick={() => fileRef.current.click()}
            className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm px-4 py-2 rounded flex items-center gap-2">
            {busy ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />} Upload Stok Gudang
          </button>
        </div>
      )}

      {sub === 'staf' && <KelolaStaf users={users} onRefresh={loadAll} showToast={showToast} />}
    </div>
  );
}

function KelolaStaf({ users, onRefresh, showToast }) {
  const [form, setForm] = useState({ username: '', password: '', nama: '', unit: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createUser({ ...form, role: 'staff' });
      setForm({ username: '', password: '', nama: '', unit: '' });
      await onRefresh();
      showToast('Akun staf dibuat.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (!confirm('Hapus akun ini?')) return;
    try {
      await api.deleteUser(id);
      await onRefresh();
      showToast('Akun dihapus.');
    } catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-white border border-stone-200 rounded-lg p-5">
        <p className="font-medium text-stone-800 text-sm mb-3 flex items-center gap-1.5"><UserPlus size={15} /> Tambah Akun Staf</p>
        <form onSubmit={submit} className="space-y-2">
          <input required placeholder="Nama Lengkap" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
            className="w-full border border-stone-300 rounded px-3 py-1.5 text-sm" />
          <input placeholder="Unit / Poli (opsional)" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
            className="w-full border border-stone-300 rounded px-3 py-1.5 text-sm" />
          <input required placeholder="Username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            className="w-full border border-stone-300 rounded px-3 py-1.5 text-sm" />
          <input required type="password" placeholder="Password (min. 6 karakter)" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="w-full border border-stone-300 rounded px-3 py-1.5 text-sm" />
          <button disabled={busy} className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm py-2 rounded flex items-center justify-center gap-2">
            {busy && <Loader2 className="animate-spin" size={14} />} Buat Akun
          </button>
        </form>
      </div>

      <div className="bg-white border border-stone-200 rounded-lg p-5">
        <p className="font-medium text-stone-800 text-sm mb-3">Daftar Akun ({users.length})</p>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between border-b border-stone-100 pb-2">
              <div>
                <p className="text-sm text-stone-700">{u.nama} {u.role === 'admin' && <span className="text-[10px] bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded ml-1">admin</span>}</p>
                <p className="text-xs text-stone-400">@{u.username}{u.unit ? ` · ${u.unit}` : ''}</p>
              </div>
              {u.role !== 'admin' && (
                <button onClick={() => remove(u.id)} className="text-rose-400 hover:text-rose-600"><Trash2 size={14} /></button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
