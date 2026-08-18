import { hashPassword, randomSalt } from '../../_lib/auth.js';

// Hanya bisa dipakai SEKALI, saat tabel users masih benar-benar kosong.
// Setelah admin pertama dibuat, endpoint ini otomatis terkunci selamanya.
export async function onRequestGet({ env }) {
  const row = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first();
  return Response.json({ needsBootstrap: row.c === 0 });
}

export async function onRequestPost({ request, env }) {
  const row = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first();
  if (row.c > 0) {
    return Response.json({ error: 'Setup awal sudah pernah dilakukan.' }, { status: 400 });
  }

  const { username, password, nama } = await request.json();
  if (!username || !password || !nama) {
    return Response.json({ error: 'Username, password, dan nama wajib diisi' }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: 'Password minimal 6 karakter' }, { status: 400 });
  }

  const salt = randomSalt();
  const hash = await hashPassword(password, salt);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO users (id, username, password_hash, salt, role, nama, unit, created_at) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(id, username.trim(), hash, salt, 'admin', nama.trim(), 'Apotek', new Date().toISOString()).run();

  return Response.json({ ok: true });
}
