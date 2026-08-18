// Body: { status: 'diproses'|'selesai'|'ditolak', catatanAdmin }
export async function onRequestPatch({ params, request, env, data }) {
  if (!data.user || data.user.role !== 'admin') {
    return Response.json({ error: 'Khusus admin' }, { status: 403 });
  }
  const { id } = params;
  const { status, catatanAdmin } = await request.json();
  const validStatus = ['pending', 'diproses', 'selesai', 'ditolak'];
  if (!validStatus.includes(status)) {
    return Response.json({ error: 'Status tidak valid' }, { status: 400 });
  }

  await env.DB.prepare(
    'UPDATE permintaan_obat SET status = ?, catatan_admin = ?, processed_at = ? WHERE id = ?'
  ).bind(status, catatanAdmin || '', new Date().toISOString(), id).run();

  return Response.json({ ok: true });
}
