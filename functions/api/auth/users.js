import { hashPassword, randomSalt } from '../../_lib/auth.js';

function requireAdmin(user) {
  return user && user.role === 'admin';
}

export async function onRequestGet({ env, data }) {
  if (!requireAdmin(data.user)) return Response.json({ error: 'Khusus admin' }, { status: 403 });
  const { results } = await env.DB.prepare(
    'SELECT id, username, role, nama, unit, created_at FROM users ORDER BY created_at DESC'
  ).all();
  return Response.json(results);
}

export async function onRequestPost({ request, env, data }) {
  if (!requireAdmin(data.user)) return Response.json({ error: 'Khusus admin' }, { status: 403 });

  const { username, password, nama, unit, role } = await request.json();
  if (!username || !password || !nama) {
    return Response.json({ error: 'Username, password, dan nama wajib diisi' }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: 'Password minimal 6 karakter' }, { status: 400 });
  }

  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username.trim()).first();
  if (existing) {
    return Response.json({ error: 'Username sudah dipakai' }, { status: 400 });
  }

  const salt = randomSalt();
  const hash = await hashPassword(password, salt);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO users (id, username, password_hash, salt, role, nama, unit, created_at) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(id, username.trim(), hash, salt, role === 'admin' ? 'admin' : 'staff', nama.trim(), unit || '', new Date().toISOString()).run();

  return Response.json({ id, username: username.trim(), nama: nama.trim(), role: role === 'admin' ? 'admin' : 'staff', unit: unit || '' });
}
