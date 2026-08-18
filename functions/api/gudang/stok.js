export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare('SELECT * FROM gudang_stok ORDER BY nama').all();
  const meta = await env.DB.prepare('SELECT value FROM gudang_stok_meta WHERE key = ?').bind('updated_at').first();
  return Response.json({
    updatedAt: meta ? meta.value : null,
    items: results.map(r => ({ id: r.id, kodeObat: r.kode_obat, nama: r.nama, satuan: r.satuan, jumlah: r.jumlah })),
  });
}

// Body: [{ kodeObat, nama, jumlah, satuan }]  <- hasil parsing upload stok Medisy (admin saja)
export async function onRequestPost({ request, env, data }) {
  if (!data.user || data.user.role !== 'admin') {
    return Response.json({ error: 'Khusus admin yang bisa upload stok gudang' }, { status: 403 });
  }
  const rows = await request.json();
  if (!Array.isArray(rows)) return Response.json({ error: 'Format salah' }, { status: 400 });

  await env.DB.prepare('DELETE FROM gudang_stok').run();

  const stmt = env.DB.prepare('INSERT INTO gudang_stok (id, kode_obat, nama, satuan, jumlah) VALUES (?,?,?,?,?)');
  const batch = rows.map(r => stmt.bind(crypto.randomUUID(), r.kodeObat || null, r.nama, r.satuan || null, Number(r.jumlah) || 0));
  for (let i = 0; i < batch.length; i += 90) {
    await env.DB.batch(batch.slice(i, i + 90));
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO gudang_stok_meta (key, value) VALUES ('updated_at', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).bind(now).run();

  return Response.json({ ok: true, count: rows.length, updatedAt: now });
}
