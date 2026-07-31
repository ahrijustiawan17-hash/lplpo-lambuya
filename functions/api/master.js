export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare('SELECT * FROM obat_master ORDER BY row_num').all();
  return Response.json(results.map(r => ({
    id: r.id,
    rowNum: r.row_num,
    kodeObat: r.kode_obat,
    nama: r.nama,
    satuan: r.satuan,
    isHeader: !!r.is_header,
  })));
}

// Import ulang seluruh master obat (dipakai sekali di awal setup, dari upload MASTER_LPLPO.xlsx)
export async function onRequestPost({ env, request }) {
  const rows = await request.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: 'Data kosong' }, { status: 400 });
  }

  await env.DB.prepare('DELETE FROM periode_item').run();
  await env.DB.prepare('DELETE FROM periode').run();
  await env.DB.prepare('DELETE FROM obat_master').run();

  const stmt = env.DB.prepare(
    'INSERT INTO obat_master (id, row_num, kode_obat, nama, satuan, is_header, urutan) VALUES (?,?,?,?,?,?,?)'
  );
  const batch = rows.map((r, i) => stmt.bind(
    crypto.randomUUID(), r.rowNum, r.kodeObat || null, r.nama, r.satuan || null, r.isHeader ? 1 : 0, i
  ));
  // D1 batch limit aman di ~100 per batch
  for (let i = 0; i < batch.length; i += 90) {
    await env.DB.batch(batch.slice(i, i + 90));
  }

  return Response.json({ ok: true, count: rows.length });
}
