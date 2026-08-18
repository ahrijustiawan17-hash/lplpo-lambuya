const BASE = '/api';

async function j(res) {
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ---- Master obat ----
export async function getMaster() {
  return j(await fetch(`${BASE}/master`));
}
export async function importMaster(rows) {
  return j(await fetch(`${BASE}/master`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows),
  }));
}

// ---- Profil ----
export async function getProfile() {
  return j(await fetch(`${BASE}/settings`));
}
export async function saveProfile(profile) {
  return j(await fetch(`${BASE}/settings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile),
  }));
}

// ---- Periode ----
export async function getPeriodeList() {
  return j(await fetch(`${BASE}/periode`));
}
export async function createPeriode(data) {
  return j(await fetch(`${BASE}/periode`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }));
}
export async function getPeriodeDetail(id) {
  return j(await fetch(`${BASE}/periode/${id}`));
}
export async function updatePeriode(id, data) {
  return j(await fetch(`${BASE}/periode/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }));
}
export async function deletePeriode(id) {
  return j(await fetch(`${BASE}/periode/${id}`, { method: 'DELETE' }));
}
export async function saveItems(periodeId, updates) {
  return j(await fetch(`${BASE}/periode/${periodeId}/items`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates),
  }));
}
export async function importMedisy(periodeId, rows) {
  return j(await fetch(`${BASE}/periode/${periodeId}/import-medisy`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows),
  }));
}
export async function getExtra(periodeId, key) {
  return j(await fetch(`${BASE}/periode/${periodeId}/extra?key=${encodeURIComponent(key)}`));
}
export async function saveExtra(periodeId, key, data) {
  return j(await fetch(`${BASE}/periode/${periodeId}/extra`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, data }),
  }));
}

// ---- Auth ----
export async function checkBootstrap() {
  return j(await fetch(`${BASE}/auth/bootstrap`));
}
export async function bootstrapAdmin(data) {
  return j(await fetch(`${BASE}/auth/bootstrap`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }));
}
export async function login(username, password) {
  return j(await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
  }));
}
export async function logout() {
  return j(await fetch(`${BASE}/auth/logout`, { method: 'POST' }));
}
export async function getMe() {
  const res = await fetch(`${BASE}/auth/me`);
  if (res.status === 401) return null;
  const data = await j(res);
  return data.user;
}
export async function getUsers() {
  return j(await fetch(`${BASE}/auth/users`));
}
export async function createUser(data) {
  return j(await fetch(`${BASE}/auth/users`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }));
}
export async function deleteUser(id) {
  return j(await fetch(`${BASE}/auth/users/${id}`, { method: 'DELETE' }));
}

// ---- Gudang: stok & permintaan obat ----
export async function getGudangStok() {
  return j(await fetch(`${BASE}/gudang/stok`));
}
export async function importGudangStok(rows) {
  return j(await fetch(`${BASE}/gudang/stok`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows),
  }));
}
export async function getPermintaan() {
  return j(await fetch(`${BASE}/gudang/permintaan`));
}
export async function createPermintaan(payload) {
  return j(await fetch(`${BASE}/gudang/permintaan`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }));
}
export async function updatePermintaanStatus(id, status, catatanAdmin) {
  return j(await fetch(`${BASE}/gudang/permintaan/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, catatanAdmin }),
  }));
}
