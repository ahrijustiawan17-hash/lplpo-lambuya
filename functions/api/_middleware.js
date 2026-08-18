import { getSessionUser } from '../_lib/auth.js';

// Path yang boleh diakses TANPA login sama sekali.
const PUBLIC_PATHS = ['/api/auth/login', '/api/auth/bootstrap'];

export async function onRequest({ request, env, next, data }) {
  const url = new URL(request.url);

  if (PUBLIC_PATHS.includes(url.pathname)) {
    return next();
  }

  const user = await getSessionUser(request, env);
  if (!user) {
    return Response.json({ error: 'Belum login' }, { status: 401 });
  }

  // Akun 'staff' hanya boleh mengakses modul Permintaan Obat Gudang + endpoint auth (logout/me).
  const isGudangOrAuth = url.pathname.startsWith('/api/gudang') || url.pathname.startsWith('/api/auth');
  if (user.role === 'staff' && !isGudangOrAuth) {
    return Response.json({ error: 'Akun ini tidak punya akses ke fitur tersebut' }, { status: 403 });
  }

  data.user = user;
  return next();
}
