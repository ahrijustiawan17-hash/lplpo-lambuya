export async function onRequestDelete({ params, env, data }) {
  if (!data.user || data.user.role !== 'admin') {
    return Response.json({ error: 'Khusus admin' }, { status: 403 });
  }
  const { id } = params;
  if (id === data.user.id) {
    return Response.json({ error: 'Tidak bisa menghapus akun sendiri' }, { status: 400 });
  }
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return Response.json({ ok: true });
}
