function mapRow(p, items) {
  return {
    id: p.id,
    userId: p.user_id,
    namaPemohon: p.nama_pemohon,
    unitPemohon: p.unit_pemohon,
    status: p.status,
    catatan: p.catatan,
    catatanAdmin: p.catatan_admin,
    createdAt: p.created_at,
    processedAt: p.processed_at,
    items: items.map(it => ({ id: it.id, kodeObat: it.kode_obat, nama: it.nama, satuan: it.satuan, jumlah: it.jumlah })),
  };
}

export async function onRequestGet({ env, data }) {
  let query = `SELECT p.*, u.nama as nama_pemohon, u.unit as unit_pemohon FROM permintaan_obat p
               JOIN users u ON u.id = p.user_id`;
  const binds = [];
  if (data.user.role !== 'admin') {
    query += ' WHERE p.user_id = ?';
    binds.push(data.user.id);
  }
  query += ' ORDER BY p.created_at DESC';

  const { results: rows } = await env.DB.prepare(query).bind(...binds).all();
  const { results: allItems } = await env.DB.prepare('SELECT * FROM permintaan_obat_item').all();
  const itemsByPermintaan = {};
  allItems.forEach(it => {
    (itemsByPermintaan[it.permintaan_id] ||= []).push(it);
  });

  return Response.json(rows.map(p => mapRow(p, itemsByPermintaan[p.id] || [])));
}

// Body: { catatan, items: [{ kodeObat, nama, satuan, jumlah }] }
export async function onRequestPost({ request, env, data }) {
  const { catatan, items } = await request.json();
  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ error: 'Minimal 1 obat harus diminta' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO permintaan_obat (id, user_id, status, catatan, created_at) VALUES (?,?,?,?,?)'
  ).bind(id, data.user.id, 'pending', catatan || '', new Date().toISOString()).run();

  const stmt = env.DB.prepare(
    'INSERT INTO permintaan_obat_item (id, permintaan_id, kode_obat, nama, satuan, jumlah) VALUES (?,?,?,?,?,?)'
  );
  const batch = items.map(it => stmt.bind(crypto.randomUUID(), id, it.kodeObat || null, it.nama, it.satuan || '', Number(it.jumlah) || 0));
  await env.DB.batch(batch);

  return Response.json({ id, ok: true });
}
