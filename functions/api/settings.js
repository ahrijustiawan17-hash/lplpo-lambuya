const KEY = 'lplpo_profile';

const DEFAULT_PROFILE = {
  puskesmas: '',
  kecamatan: '',
  kabupaten: '',
  provinsi: '',
  namaKepalaDinkes: '',
  nipKepalaDinkes: '',
  namaKepalaInstalasi: '',
  nipKepalaInstalasi: '',
  namaKepalaPuskesmas: '',
  nipKepalaPuskesmas: '',
  namaPetugas: '',
  nipPetugas: '',
};

export async function onRequestGet({ env }) {
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(KEY).first();
  if (!row) return Response.json(DEFAULT_PROFILE);
  try {
    return Response.json({ ...DEFAULT_PROFILE, ...JSON.parse(row.value) });
  } catch {
    return Response.json(DEFAULT_PROFILE);
  }
}

export async function onRequestPost({ env, request }) {
  const body = await request.json();
  const profile = { ...DEFAULT_PROFILE, ...body };
  await env.DB.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).bind(KEY, JSON.stringify(profile)).run();
  return Response.json(profile);
}
