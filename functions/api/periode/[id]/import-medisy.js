function compute(stokAwal, penerimaan, stokAkhirMedisy) {
  const persediaan = (stokAwal || 0) + (penerimaan || 0);
  const pemakaian = persediaan - stokAkhirMedisy;
  const stokAkhir = stokAkhirMedisy;
  const permintaan = (pemakaian * 1.2) - stokAkhir;
  const pemberian = permintaan;
  return { persediaan, pemakaian, stokAkhir, permintaan, pemberian };
}

// Body: [{ kodeObat, jumlah }]  <- hasil parsing "Laporan Stok Obat Gudang" dari Medisy
export async function onRequestPost({ env, params, request }) {
  const { id } = params;
  const rows = await request.json();
  if (!Array.isArray(rows)) return Response.json({ error: 'Format salah' }, { status: 400 });

  const { results: master } = await env.DB.prepare(
    'SELECT id, kode_obat FROM obat_master WHERE kode_obat IS NOT NULL AND kode_obat != ""'
  ).all();
  const obatByKode = {};
  master.forEach(m => { obatByKode[m.kode_obat.trim().toUpperCase()] = m.id; });

  const { results: items } = await env.DB.prepare(
    'SELECT obat_id, stok_awal, penerimaan FROM periode_item WHERE periode_id = ?'
  ).bind(id).all();
  const itemByObat = {};
  items.forEach(it => { itemByObat[it.obat_id] = it; });

  const batch = [];
  const unmatched = [];
  let matched = 0;

  for (const r of rows) {
    const kode = (r.kodeObat || '').trim().toUpperCase();
    const obatId = obatByKode[kode];
    if (!obatId || !itemByObat[obatId]) {
      unmatched.push(r);
      continue;
    }
    const it = itemByObat[obatId];
    const jumlah = Number(r.jumlah) || 0;
    const calc = compute(it.stok_awal, it.penerimaan, jumlah);
    batch.push(env.DB.prepare(
      `UPDATE periode_item SET stok_akhir_medisy = ?, persediaan = ?, pemakaian = ?, stok_akhir = ?, permintaan = ?, pemberian = ?
       WHERE periode_id = ? AND obat_id = ?`
    ).bind(jumlah, calc.persediaan, calc.pemakaian, calc.stokAkhir, calc.permintaan, calc.pemberian, id, obatId));
    matched++;
  }

  for (let i = 0; i < batch.length; i += 90) {
    await env.DB.batch(batch.slice(i, i + 90));
  }

  return Response.json({ ok: true, matched, unmatchedCount: unmatched.length, unmatched: unmatched.slice(0, 30) });
}
