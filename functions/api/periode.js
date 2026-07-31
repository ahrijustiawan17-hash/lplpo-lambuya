export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM periode ORDER BY tahun_pelaporan DESC, created_at DESC'
  ).all();
  return Response.json(results.map(mapPeriode));
}

function mapPeriode(p) {
  return {
    id: p.id,
    bulanPelaporan: p.bulan_pelaporan,
    tahunPelaporan: p.tahun_pelaporan,
    bulanPermintaan: p.bulan_permintaan,
    tahunPermintaan: p.tahun_permintaan,
    nomor: p.nomor,
    tanggal: p.tanggal,
    kunjungan: {
      umum: p.kunjungan_umum, askes: p.kunjungan_askes, bpjs: p.kunjungan_bpjs,
      gratis: p.kunjungan_gratis, jamkesmas: p.kunjungan_jamkesmas,
    },
    status: p.status,
    createdAt: p.created_at,
  };
}

// Body: { bulanPelaporan, tahunPelaporan, bulanPermintaan, tahunPermintaan, nomor, tanggal,
//         initialStokAwal?: { [kodeObatOrObatId]: number }  <- hanya dipakai kalau ini periode PERTAMA }
export async function onRequestPost({ env, request }) {
  const body = await request.json();
  const { bulanPelaporan, tahunPelaporan, bulanPermintaan, tahunPermintaan, nomor, tanggal, initialStokAwal } = body;

  if (!bulanPelaporan || !tahunPelaporan) {
    return Response.json({ error: 'Bulan pelaporan wajib diisi' }, { status: 400 });
  }

  const { results: master } = await env.DB.prepare(
    'SELECT id, kode_obat, is_header FROM obat_master ORDER BY row_num'
  ).all();
  if (master.length === 0) {
    return Response.json({ error: 'Master obat belum diimpor. Import Master Obat dahulu.' }, { status: 400 });
  }

  // Cari periode terakhir (untuk carry-forward stok akhir -> stok awal periode baru)
  const lastPeriode = await env.DB.prepare(
    'SELECT id FROM periode ORDER BY created_at DESC LIMIT 1'
  ).first();

  let prevStokAkhirByObat = {};
  if (lastPeriode) {
    const { results: prevItems } = await env.DB.prepare(
      'SELECT obat_id, stok_akhir FROM periode_item WHERE periode_id = ?'
    ).bind(lastPeriode.id).all();
    prevItems.forEach(it => { prevStokAkhirByObat[it.obat_id] = it.stok_akhir || 0; });
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO periode (id, bulan_pelaporan, tahun_pelaporan, bulan_permintaan, tahun_permintaan, nomor, tanggal, status, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(id, bulanPelaporan, tahunPelaporan, bulanPermintaan, tahunPermintaan, nomor || '', tanggal || '', 'draft', new Date().toISOString()).run();

  const stmt = env.DB.prepare(
    `INSERT INTO periode_item (id, periode_id, obat_id, stok_awal, penerimaan, persediaan, pemakaian, stok_akhir, permintaan, pemberian)
     VALUES (?,?,?,?,0,?,0,?,0,0)`
  );
  const batch = [];
  for (const m of master) {
    if (m.is_header) continue;
    let stokAwal = 0;
    if (lastPeriode) {
      stokAwal = prevStokAkhirByObat[m.id] || 0;
    } else if (initialStokAwal) {
      stokAwal = initialStokAwal[m.id] ?? initialStokAwal[m.kode_obat] ?? 0;
    }
    batch.push(stmt.bind(crypto.randomUUID(), id, m.id, stokAwal, stokAwal, stokAwal));
  }
  for (let i = 0; i < batch.length; i += 90) {
    await env.DB.batch(batch.slice(i, i + 90));
  }

  return Response.json({ id });
}
