function compute(stokAwal, penerimaan, stokAkhirMedisy, manualPemakaian) {
  const persediaan = (stokAwal || 0) + (penerimaan || 0);
  if (stokAkhirMedisy !== null && stokAkhirMedisy !== undefined) {
    const pemakaian = persediaan - stokAkhirMedisy;
    const stokAkhir = stokAkhirMedisy;
    const permintaan = (pemakaian * 1.2) - stokAkhir;
    return { persediaan, pemakaian, stokAkhir, permintaan, pemberian: permintaan };
  }
  if (manualPemakaian !== null && manualPemakaian !== undefined) {
    const pemakaian = manualPemakaian;
    const stokAkhir = persediaan - pemakaian;
    const permintaan = (pemakaian * 1.2) - stokAkhir;
    return { persediaan, pemakaian, stokAkhir, permintaan, pemberian: permintaan };
  }
  return { persediaan, pemakaian: 0, stokAkhir: 0, permintaan: 0, pemberian: 0 };
}

// Body: [{ obatId, penerimaan, pemakaianManual, keterangan }]
export async function onRequestPost({ env, params, request }) {
  const { id } = params;
  const updates = await request.json();
  if (!Array.isArray(updates)) return Response.json({ error: 'Format salah' }, { status: 400 });

  const batch = [];
  for (const u of updates) {
    const row = await env.DB.prepare(
      'SELECT stok_awal, stok_akhir_medisy FROM periode_item WHERE periode_id = ? AND obat_id = ?'
    ).bind(id, u.obatId).first();
    if (!row) continue;
    const calc = compute(row.stok_awal, u.penerimaan, row.stok_akhir_medisy, u.pemakaianManual);
    batch.push(env.DB.prepare(
      `UPDATE periode_item SET penerimaan = ?, persediaan = ?, pemakaian = ?, stok_akhir = ?, permintaan = ?, pemberian = ?, keterangan = ?
       WHERE periode_id = ? AND obat_id = ?`
    ).bind(u.penerimaan || 0, calc.persediaan, calc.pemakaian, calc.stokAkhir, calc.permintaan, calc.pemberian, u.keterangan || '', id, u.obatId));
  }
  for (let i = 0; i < batch.length; i += 90) {
    await env.DB.batch(batch.slice(i, i + 90));
  }
  return Response.json({ ok: true, updated: batch.length });
}
