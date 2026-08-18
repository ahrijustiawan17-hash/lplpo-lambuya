import { hashPassword, randomToken, sessionCookieHeader } from '../../_lib/auth.js';

const SESSION_DAYS = 30;

export async function onRequestPost({ request, env }) {
  const { username, password } = await request.json();
  if (!username || !password) {
    return Response.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
  }

  const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username.trim()).first();
  if (!user) {
    return Response.json({ error: 'Username atau password salah' }, { status: 401 });
  }

  const hash = await hashPassword(password, user.salt);
  if (hash !== user.password_hash) {
    return Response.json({ error: 'Username atau password salah' }, { status: 401 });
  }

  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)')
    .bind(token, user.id, expiresAt).run();

  return new Response(JSON.stringify({
    ok: true,
    user: { id: user.id, username: user.username, role: user.role, nama: user.nama, unit: user.unit },
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookieHeader(token, SESSION_DAYS * 24 * 60 * 60),
    },
  });
}
