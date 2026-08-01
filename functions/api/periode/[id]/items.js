// Menghitung ulang field turunan berdasarkan kombinasi input yang dikirim.
// Prioritas kalau stokAkhir DAN pemakaian dua-duanya diedit manual di baris yang sama:
// stokAkhir yang dipakai sebagai acuan (pemakaian dihitung ulang darinya).
// existingPemakaian = nilai Pemakaian yang SUDAH tersimpan sebelumnya -> dipakai sebagai fallback
// supaya Stok Awal/Penerimaan yang diedit sendirian tidak menghapus Pemakaian yang sudah diisi manual.
function compute({ stokAwal, penerimaan, stokAkhirMedisy, pemakaianManual, stokAkhirManual, existingPemakaian }) {
  const persediaan = (stokAwal || 0) + (penerimaan || 0);

  if (stokAkhirManual !== null && stokAkhirManual !== undefined) {
    const stokAkhir = stokAkhirManual;
    const pemakaian = persediaan - stokAkhir;
    const permintaan = (pemakaian * 1.2) - stokAkhir;
    return { persediaan, pemakaian, stokAkhir, permintaan, pemberian: permintaan };
  }
  if (pemakaianManual !== null && pemakaianManual !== undefined) {
    const pemakaian = pemakaianManual;
    const stokAkhir = persediaan - pemakaian;
    const permintaan = (pemakaian * 1.2) - stokAkhir;
    return { persediaan, pemakaian, stokAkhir, permintaan, pemberian: permintaan };
  }
  if (stokAkhirMedisy !== null && stokAkhirMedisy !== undefined) {
    const pemakaian = persediaan - stokAkhirMedisy;
    const stokAkhir = stokAkhirMedisy;
    const permintaan = (pemakaian * 1.2) - stokAkhir;
    return { persediaan, pemakaian, stokAkhir, permintaan, pemberian: permintaan };
  }
  // Tidak ada input baru untuk Pemakaian/Stok Akhir -> pertahankan Pemakaian yang sudah tersimpan,
  // hitung ulang Stok Akhir/Permintaan mengikuti Persediaan yang baru.
  const pemakaian = existingPemakaian || 0;
  const stokAkhir = persediaan - pemakaian;
  const permintaan = (pemakaian * 1.2) - stokAkhir;
  return { persediaan, pemakaian, stokAkhir, permintaan, pemberian: permintaan };
}

// Body: [{ obatId, stokAwal, penerimaan, pemakaianManual, stokAkhirManual, keterangan }]
// Field yang tidak dikirim (undefined) akan tetap memakai nilai tersimpan sebelumnya.
export async function onRequestPost({ env, params, request }) {
  const { id } = params;
  const updates = await request.json();
  if (!Array.isArray(updates)) return Response.json({ error: 'Format salah' }, { status: 400 });

  const batch = [];
  for (const u of updates) {
    const row = await env.DB.prepare(
      'SELECT stok_awal, penerimaan, stok_akhir_medisy, pemakaian, stok_akhir, keterangan FROM periode_item WHERE periode_id = ? AND obat_id = ?'
    ).bind(id, u.obatId).first();
    if (!row) continue;

    const stokAwal = u.stokAwal !== undefined ? u.stokAwal : row.stok_awal;
    const penerimaan = u.penerimaan !== undefined ? u.penerimaan : row.penerimaan;
    const keterangan = u.keterangan !== undefined ? u.keterangan : row.keterangan;

    const calc = compute({
      stokAwal, penerimaan,
      stokAkhirMedisy: row.stok_akhir_medisy,
      pemakaianManual: u.pemakaianManual,
      stokAkhirManual: u.stokAkhirManual,
      existingPemakaian: row.pemakaian,
    });

    batch.push(env.DB.prepare(
      `UPDATE periode_item SET stok_awal = ?, penerimaan = ?, persediaan = ?, pemakaian = ?, stok_akhir = ?, permintaan = ?, pemberian = ?, keterangan = ?
       WHERE periode_id = ? AND obat_id = ?`
    ).bind(stokAwal || 0, penerimaan || 0, calc.persediaan, calc.pemakaian, calc.stokAkhir, calc.permintaan, calc.pemberian, keterangan || '', id, u.obatId));
  }
  for (let i = 0; i < batch.length; i += 90) {
    await env.DB.batch(batch.slice(i, i + 90));
  }
  return Response.json({ ok: true, updated: batch.length });
}
