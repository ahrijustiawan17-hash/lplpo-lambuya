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
