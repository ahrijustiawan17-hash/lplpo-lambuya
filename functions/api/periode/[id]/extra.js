export async function onRequestGet({ env, params, request }) {
  const { id } = params;
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key) return Response.json({ error: 'key wajib diisi' }, { status: 400 });
  const row = await env.DB.prepare(
    'SELECT data FROM periode_extra WHERE periode_id = ? AND report_key = ?'
  ).bind(id, key).first();
  if (!row) return Response.json(null);
  try {
    return Response.json(JSON.parse(row.data));
  } catch {
    return Response.json(null);
  }
}

// Body: { key, data }
export async function onRequestPost({ env, params, request }) {
  const { id } = params;
  const { key, data } = await request.json();
  if (!key) return Response.json({ error: 'key wajib diisi' }, { status: 400 });
  await env.DB.prepare(
    `INSERT INTO periode_extra (periode_id, report_key, data) VALUES (?,?,?)
     ON CONFLICT(periode_id, report_key) DO UPDATE SET data = excluded.data`
  ).bind(id, key, JSON.stringify(data)).run();
  return Response.json({ ok: true });
}
