export async function onRequestGet({ env, params }) {
  const { id } = params;
  const periode = await env.DB.prepare('SELECT * FROM periode WHERE id = ?').bind(id).first();
  if (!periode) return Response.json({ error: 'Periode tidak ditemukan' }, { status: 404 });

  const { results: master } = await env.DB.prepare('SELECT * FROM obat_master ORDER BY row_num').all();
  const { results: items } = await env.DB.prepare('SELECT * FROM periode_item WHERE periode_id = ?').bind(id).all();
  const itemByObat = {};
  items.forEach(it => { itemByObat[it.obat_id] = it; });

  const rows = master.map(m => {
    if (m.is_header) {
      return { obatId: m.id, rowNum: m.row_num, nama: m.nama, isHeader: true };
    }
    const it = itemByObat[m.id] || {};
    return {
      obatId: m.id,
      rowNum: m.row_num,
      kodeObat: m.kode_obat,
      nama: m.nama,
      satuan: m.satuan,
      isHeader: false,
      stokAwal: it.stok_awal || 0,
      penerimaan: it.penerimaan || 0,
      stokAkhirMedisy: it.stok_akhir_medisy,
      persediaan: it.persediaan || 0,
      pemakaian: it.pemakaian || 0,
      stokAkhir: it.stok_akhir || 0,
      permintaan: it.permintaan || 0,
      pemberian: it.pemberian || 0,
      keterangan: it.keterangan || '',
    };
  });

  return Response.json({
    id: periode.id,
    bulanPelaporan: periode.bulan_pelaporan,
    tahunPelaporan: periode.tahun_pelaporan,
    bulanPermintaan: periode.bulan_permintaan,
    tahunPermintaan: periode.tahun_permintaan,
    nomor: periode.nomor,
    tanggal: periode.tanggal,
    kunjungan: {
      umum: periode.kunjungan_umum, askes: periode.kunjungan_askes, bpjs: periode.kunjungan_bpjs,
      gratis: periode.kunjungan_gratis, jamkesmas: periode.kunjungan_jamkesmas,
    },
    status: periode.status,
    rows,
  });
}

export async function onRequestPatch({ env, params, request }) {
  const { id } = params;
  const body = await request.json();
  const fields = [];
  const values = [];
  const map = {
    nomor: 'nomor', tanggal: 'tanggal', status: 'status',
    kunjunganUmum: 'kunjungan_umum', kunjunganAskes: 'kunjungan_askes', kunjunganBpjs: 'kunjungan_bpjs',
    kunjunganGratis: 'kunjungan_gratis', kunjunganJamkesmas: 'kunjungan_jamkesmas',
  };
  for (const [k, col] of Object.entries(map)) {
    if (body[k] !== undefined) { fields.push(`${col} = ?`); values.push(body[k]); }
  }
  if (fields.length === 0) return Response.json({ ok: true });
  values.push(id);
  await env.DB.prepare(`UPDATE periode SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  return Response.json({ ok: true });
}

export async function onRequestDelete({ env, params }) {
  const { id } = params;
  await env.DB.prepare('DELETE FROM periode_item WHERE periode_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM periode WHERE id = ?').bind(id).run();
  return Response.json({ ok: true });
}
