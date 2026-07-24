/* ============================================================================
   ANTARESTAR — CASHFLOW PROJECTION
   engine.js — mesin forecast
   Alur: target GMV bulanan (digicom) → sebar ke harian pakai pola →
         geser +lag hari (H+5 pengakuan kas finance) → × netto% × faktor skenario
         → dikurangi RAB + recurring + variabel → saldo harian berjalan.
   ========================================================================== */
(function (global) {
  'use strict';

  var CFG = global.CFG;

  /* ---------------------------------------------------------------- tanggal */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function toKey(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function fromKey(k) {
    var p = String(k).slice(0, 10).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function bulanKey(k) { return String(k).slice(0, 7); }

  function tambahHari(k, n) {
    var d = fromKey(k);
    d.setDate(d.getDate() + n);
    return toKey(d);
  }

  function jumlahHari(bln) {
    var p = bln.split('-');
    return new Date(+p[0], +p[1], 0).getDate();
  }

  function rentang(dari, sampai) {
    var out = [], k = dari, guard = 0;
    while (k <= sampai && guard++ < 2000) { out.push(k); k = tambahHari(k, 1); }
    return out;
  }

  function tanggalBulan(bln) {
    var n = jumlahHari(bln), out = [], i;
    for (i = 1; i <= n; i++) out.push(bln + '-' + pad(i));
    return out;
  }

  /* -------------------------------------------------- pola sebaran harian */
  /* Bobot relatif satu tanggal sebelum normalisasi ke total bulanan. */
  function bobotHari(key) {
    var d = fromKey(key), tgl = d.getDate(), bln = d.getMonth() + 1, dow = d.getDay();
    var w = (dow === 0 || dow === 6) ? CFG.POLA.weekend : CFG.POLA.weekday;

    if (tgl === bln && bln <= 12) w *= CFG.POLA.tanggalKembar;   // 8.8, 9.9, 12.12 ...
    else if (tgl === 15) w *= CFG.POLA.midMonth;
    else if (tgl >= 25 && tgl <= 27) w *= CFG.POLA.payday;
    else if (tgl >= 28) w *= CFG.POLA.akhirBulan;

    return w;
  }

  /* Sebar `total` ke seluruh tanggal di bulan `bln` → { 'YYYY-MM-DD': nominal } */
  function sebarBulan(bln, total) {
    var tgls = tanggalBulan(bln), bobot = [], sum = 0, out = {}, i;
    for (i = 0; i < tgls.length; i++) { bobot[i] = bobotHari(tgls[i]); sum += bobot[i]; }
    if (sum === 0) sum = 1;
    for (i = 0; i < tgls.length; i++) out[tgls[i]] = Math.round(total * bobot[i] / sum);
    return out;
  }

  /* ------------------------------------------------------------- target GMV */
  /* Bangun peta GMV harian per channel untuk semua bulan yang dibutuhkan.
     Prioritas: override harian (tab Target_Harian) > sebaran dari target bulanan. */
  /* Normalisasi nama skenario pada baris target. Baris lama tanpa kolom
     skenario dianggap milik OPTIMIS — itu basis yang selama ini dipakai. */
  function skRow(r) {
    var s = String(r.skenario || '').trim().toLowerCase();
    return s || 'optimis';
  }

  /* GMV harian per channel untuk SATU skenario.
     Aturan: kalau skenario itu punya angkanya sendiri → pakai apa adanya.
     Kalau tidak → pakai target Optimis dikali faktor skenario. Jadi finance
     bisa mengisi Moderate/Pesimis sendiri, atau membiarkannya ikut rumus. */
  function petaGmv(data, bulanList, skenarioId, faktor) {
    skenarioId = skenarioId || 'optimis';
    faktor = (faktor === undefined || faktor === null) ? 1 : faktor;

    var peta = {}, i, j, c;
    for (i = 0; i < CFG.CHANNELS.length; i++) peta[CFG.CHANNELS[i].id] = {};

    /* 1. target bulanan */
    for (i = 0; i < bulanList.length; i++) {
      var bln = bulanList[i];
      for (j = 0; j < CFG.CHANNELS.length; j++) {
        c = CFG.CHANNELS[j];
        var total = targetSkenario(data, bln, c.id, skenarioId, faktor);
        if (!total) continue;
        var sebar = sebarBulan(bln, total), k;
        for (k in sebar) if (sebar.hasOwnProperty(k)) peta[c.id][k] = sebar[k];
      }
    }

    /* 2. override harian menang — dipisah per skenario juga */
    var th = data.targetHarian || [];
    var spesifik = {}, basis = {};
    for (i = 0; i < th.length; i++) {
      var r = th[i];
      if (!peta[r.channel]) continue;
      var kunci = r.channel + '|' + String(r.tanggal).slice(0, 10);
      var sk = skRow(r);
      if (sk === skenarioId) spesifik[kunci] = Number(r.gmv) || 0;
      else if (sk === 'optimis') basis[kunci] = Number(r.gmv) || 0;
    }
    var kk;
    var pakaiBasis = !(skenarioId !== 'optimis' && mandiri(data, skenarioId));
    for (kk in basis) if (pakaiBasis && basis.hasOwnProperty(kk) && !(kk in spesifik)) {
      var p1 = kk.split('|');
      peta[p1[0]][p1[1]] = Math.round(basis[kk] * faktor);
    }
    for (kk in spesifik) if (spesifik.hasOwnProperty(kk)) {
      var p2 = kk.split('|');
      peta[p2[0]][p2[1]] = spesifik[kk];
    }

    return peta;
  }

  /* Target bulanan satu channel untuk skenario tertentu. */
  function targetSkenario(data, bln, channelId, skenarioId, faktor) {
    skenarioId = skenarioId || 'optimis';
    faktor = (faktor === undefined || faktor === null) ? 1 : faktor;
    var tb = data.targetBulanan || [], i, basis = 0, sendiri = null;
    for (i = 0; i < tb.length; i++) {
      var r = tb[i];
      if (bulanKey(r.bulan) !== bln || r.channel !== channelId) continue;
      var sk = skRow(r);
      if (sk === skenarioId && skenarioId !== 'optimis') sendiri = Number(r.gmv) || 0;
      else if (sk === 'optimis') basis = Number(r.gmv) || 0;
    }
    if (sendiri !== null) return sendiri;
    /* Mode mandiri: skenario ini hanya memakai angka yang benar-benar diketik.
       Kalau belum diisi → 0, bukan turunan dari Optimis. */
    if (skenarioId !== 'optimis' && mandiri(data, skenarioId)) return 0;
    return Math.round(basis * faktor);
  }

  function mandiri(data, skenarioId) {
    var m = (data && data.config && data.config.skenarioMandiri) || {};
    return !!m[skenarioId];
  }

  /* Target basis (Optimis) — dipakai grid target & perhitungan lama. */
  function targetBulananChannel(data, bln, channelId) {
    return targetSkenario(data, bln, channelId, 'optimis', 1);
  }

  /* Saran default per channel dari target master (TARGET_2026 × PORSI_MP).
     Bukan dipakai otomatis — cuma jadi placeholder di grid dan sumber tombol
     "Isi dari target master". */
  function masterChannel(bln, channelId) {
    var master = null, i;
    for (i = 0; i < CFG.TARGET_2026.length; i++) {
      if (CFG.TARGET_2026[i].bulan === bln) { master = CFG.TARGET_2026[i]; break; }
    }
    if (!master) return 0;
    var ch = CFG.channel(channelId);
    if (!ch) return 0;
    if (ch.tipe === 'offline') return master.offline;
    if (ch.tipe === 'b2b') return master.b2b;
    return Math.round(master.marketplace * (CFG.PORSI_MP[channelId] || 0));
  }

  /* --------------------------------------------------------- kas dari GMV */
  /* Uang masuk di tanggal T = GMV tanggal (T - lag) × netto% × faktor skenario.
     Hasil dipetakan ke COA penerimaan masing-masing channel. */
  /* Faktor skenario sudah diterapkan di petaGmv, jangan dikalikan lagi di sini. */
  function kasDariGmv(peta, tanggal, cfg) {
    var hasil = {}, total = 0, i;
    for (i = 0; i < CFG.CHANNELS.length; i++) {
      var c = CFG.CHANNELS[i];
      var lag = (c.lag === 0 || c.lag) ? c.lag : (cfg.lagDefault || 5);
      var asal = tambahHari(tanggal, -lag);
      var gmv = (peta[c.id] && peta[c.id][asal]) || 0;
      if (!gmv) continue;
      var kas = Math.round(gmv * ((c.netto || 100) / 100));
      hasil[c.coa] = (hasil[c.coa] || 0) + kas;
      total += kas;
    }
    return { detail: hasil, total: total };
  }

  /* ------------------------------------------------------------ pengeluaran */
  /* RAB → { tanggal: [ {coa, nominal, label} ] } */
  function petaRab(data, cutoff) {
    var peta = {}, rab = data.rab || [], i;
    for (i = 0; i < rab.length; i++) {
      var r = rab[i];
      if (r.status === 'batal') continue;
      var tgl = String(r.tanggalRencana || '').slice(0, 10);
      if (!tgl) continue;
      if (cutoff && tgl <= cutoff) continue;          // sudah tercakup aktual
      if (!peta[tgl]) peta[tgl] = [];
      peta[tgl].push({
        coa: r.coa || 'out_import',
        nominal: Number(r.total) || 0,
        label: (r.divisi ? r.divisi + ' · ' : '') + (r.deskripsi || 'RAB'),
        sumber: 'rab'
      });
    }
    return peta;
  }

  /* Rencana Pengeluaran (grid bulanan/harian per kategori) → { tanggal: [..] }.
     Nominal bulanan disebar RATA ke seluruh hari bulan itu (beda dari target
     penjualan yang pakai pola campaign — pengeluaran tidak ikut pola 8.8).
     Override harian menimpa nilai tanggal spesifik, persis seperti target. */
  function petaRencana(data, tanggalList, cutoff) {
    var peta = {};
    var rb = data.rencanaBulanan || [], rh = data.rencanaHarian || [], i;

    /* map[coa][tanggal] = nominal */
    var map = {};
    function set(coa, tgl, nominal, sumber, keterangan) {
      if (!map[coa]) map[coa] = {};
      map[coa][tgl] = { nominal: nominal, sumber: sumber, keterangan: keterangan || '' };
    }

    /* 1. sebar rata dari rencana bulanan */
    for (i = 0; i < rb.length; i++) {
      var r = rb[i];
      var nominal = Number(r.nominal) || 0;
      if (!nominal || !r.coa) continue;
      var bln = bulanKey(r.bulan);
      var tgls = tanggalBulan(bln), per = Math.round(nominal / tgls.length), j;
      for (j = 0; j < tgls.length; j++) set(r.coa, tgls[j], per, 'rencana', r.keterangan);
    }

    /* 2. override harian menang */
    for (i = 0; i < rh.length; i++) {
      var h = rh[i];
      var n = Number(h.nominal) || 0;
      if (!h.coa) continue;
      set(h.coa, String(h.tanggal).slice(0, 10), n, 'rencana', h.keterangan);
    }

    /* 3. rakit per tanggal yang diminta */
    for (i = 0; i < tanggalList.length; i++) {
      var tgl = tanggalList[i];
      if (cutoff && tgl <= cutoff) continue;              // dilewati, sudah aktual
      for (var coa in map) {
        if (!map.hasOwnProperty(coa)) continue;
        var sel = map[coa][tgl];
        if (!sel || !sel.nominal) continue;
        if (!peta[tgl]) peta[tgl] = [];
        /* Keterangan lebih spesifik daripada nama pos-nya, jadi kalau ada dia
           yang dipakai sebagai judul baris di agenda & detail harian. */
        peta[tgl].push({
          coa: coa, nominal: sel.nominal, sumber: 'rencana',
          label: sel.keterangan || 'Rencana pengeluaran',
          keterangan: sel.keterangan || ''
        });
      }
    }
    return peta;
  }

  /* Kategori yang punya rencana bulanan — dipakai untuk mengecualikan baseline
     supaya tidak dobel dengan grid rencana. */
  function coaBerencana(data) {
    var out = {}, rb = data.rencanaBulanan || [], i;
    for (i = 0; i < rb.length; i++) if ((Number(rb[i].nominal) || 0) && rb[i].coa) out[rb[i].coa] = true;
    return out;
  }

  /* Recurring → { tanggal: [ {...} ] } untuk rentang tanggal yang diminta */
  function petaRecurring(data, tanggalList, cutoff) {
    var peta = {}, rec = data.recurring || [], i, j;
    for (i = 0; i < tanggalList.length; i++) {
      var tgl = tanggalList[i];
      if (cutoff && tgl <= cutoff) continue;
      var bln = bulanKey(tgl), hari = fromKey(tgl).getDate(), maxHari = jumlahHari(bln);
      for (j = 0; j < rec.length; j++) {
        var r = rec[j];
        if (r.aktif === false || r.aktif === 'FALSE') continue;
        if (r.mulai && bln < bulanKey(r.mulai)) continue;
        if (r.selesai && bln > bulanKey(r.selesai)) continue;
        /* tanggal jatuh tempo > jumlah hari bulan → geser ke hari terakhir */
        var jt = Math.min(Number(r.tanggal) || 1, maxHari);
        if (hari !== jt) continue;
        if (!peta[tgl]) peta[tgl] = [];
        peta[tgl].push({
          coa: r.coa,
          nominal: Number(r.nominal) || 0,
          label: r.nama || 'Fixed cost',
          sumber: 'recurring'
        });
      }
    }
    return peta;
  }

  /* Biaya variabel (% dari omset) — opsional, aktif kalau cfg.pakaiVariabel = true.
     Disebar proporsional terhadap GMV harian bulan itu. */
  function petaVariabel(data, cfg, peta, tanggalList, faktor, cutoff) {
    var out = {};
    if (!cfg.pakaiVariabel) return out;
    var vars = (data.variabel || []).filter(function (v) { return v.aktif !== false; });
    if (!vars.length) return out;

    /* GMV harian total per tanggal */
    var gmvHarian = {}, i, j, c, k;
    for (i = 0; i < tanggalList.length; i++) gmvHarian[tanggalList[i]] = 0;
    for (j = 0; j < CFG.CHANNELS.length; j++) {
      c = CFG.CHANNELS[j];
      for (i = 0; i < tanggalList.length; i++) {
        k = tanggalList[i];
        gmvHarian[k] += (peta[c.id] && peta[c.id][k]) || 0;
      }
    }

    for (i = 0; i < tanggalList.length; i++) {
      k = tanggalList[i];
      if (cutoff && k <= cutoff) continue;
      var gmv = gmvHarian[k] * faktor;
      if (!gmv) continue;
      for (j = 0; j < vars.length; j++) {
        var v = vars[j];
        var nominal = Math.round(gmv * (Number(v.persen) || 0) / 100);
        if (!nominal) continue;
        if (!out[k]) out[k] = [];
        out[k].push({ coa: v.coa, nominal: nominal, label: v.nama, sumber: 'variabel' });
      }
    }
    return out;
  }

  /* ------------------------------------------------- baseline operasional */
  /* Pengeluaran yang jalan hampir tiap hari (belanja supplier, iklan, ops)
     tidak pernah masuk RAB satu per satu. Kalau tidak dimodelkan, proyeksi
     saldo jadi terlalu optimis. Baseline = rata-rata realisasi harian per pos
     selama `baselineHari` terakhir.

     Pos yang sudah dijadwalkan lewat Fixed Cost dikecualikan supaya tidak
     dihitung dua kali. Finance bisa override / matikan per pos di Pengaturan. */
  function hitungBaseline(data, cfg) {
    var out = {};
    if (!cfg.pakaiBaseline) return out;

    var cut = cutoffAktual(data);
    if (!cut) return out;

    var n = Math.max(1, Number(cfg.baselineHari) || 30);
    var mulai = tambahHari(cut, -(n - 1));

    /* kecualikan pos yang sudah dijadwalkan lewat fixed cost ATAU direncanakan
       lewat grid Rencana Pengeluaran — supaya tidak dobel dengan baseline */
    var terjadwal = {};
    (data.recurring || []).forEach(function (r) { if (r.aktif !== false) terjadwal[r.coa] = true; });
    var berencana = coaBerencana(data);
    for (var cb in berencana) if (berencana.hasOwnProperty(cb)) terjadwal[cb] = true;

    var total = {}, act = data.actual || [], i, awalData = '';
    for (i = 0; i < act.length; i++) {
      var a = act[i];
      var t = String(a.tanggal || '').slice(0, 10);
      if (t && (!awalData || t < awalData)) awalData = t;
      if (a.tipe !== 'out') continue;
      if (t < mulai || t > cut) continue;
      if (terjadwal[a.coa]) continue;
      total[a.coa] = (total[a.coa] || 0) + (Number(a.nominal) || 0);
    }

    /* Kalau riwayat lebih pendek dari jendela, bagi dengan hari yang benar-benar
       ada datanya — biar baseline tidak ikut terdilusi hari kosong. */
    var hariEfektif = n;
    if (awalData && awalData > mulai) hariEfektif = Math.max(1, rentang(awalData, cut).length);

    var off = cfg.baselineOff || [], ovr = cfg.baselineOverride || {}, c;
    for (c in total) if (total.hasOwnProperty(c)) {
      if (off.indexOf(c) >= 0) continue;
      out[c] = Math.round(total[c] / hariEfektif);
    }
    for (c in ovr) if (ovr.hasOwnProperty(c)) {
      if (off.indexOf(c) >= 0) { delete out[c]; continue; }
      out[c] = Math.round(Number(ovr[c]) || 0);
    }
    for (c in out) if (out.hasOwnProperty(c) && !out[c]) delete out[c];
    return out;
  }

  /* ------------------------------------------------------------- aktual */
  /* Aktual → { tanggal: { masuk:{coa:n}, keluar:{coa:n}, totalMasuk, totalKeluar } } */
  function petaAktual(data) {
    var peta = {}, act = data.actual || [], i;
    for (i = 0; i < act.length; i++) {
      var a = act[i];
      var tgl = String(a.tanggal || '').slice(0, 10);
      if (!tgl) continue;
      if (!peta[tgl]) peta[tgl] = { masuk: {}, keluar: {}, totalMasuk: 0, totalKeluar: 0, item: [] };
      var n = Number(a.nominal) || 0;
      if (a.tipe === 'in') {
        peta[tgl].masuk[a.coa] = (peta[tgl].masuk[a.coa] || 0) + n;
        peta[tgl].totalMasuk += n;
      } else {
        peta[tgl].keluar[a.coa] = (peta[tgl].keluar[a.coa] || 0) + n;
        peta[tgl].totalKeluar += n;
      }
      peta[tgl].item.push({ coa: a.coa, nominal: n, tipe: a.tipe, label: a.catatan || CFG.namaCoa(a.coa) });
    }
    return peta;
  }

  /* Tanggal aktual terakhir yang ada datanya */
  function cutoffAktual(data) {
    var act = data.actual || [], max = '', i;
    for (i = 0; i < act.length; i++) {
      var t = String(act[i].tanggal || '').slice(0, 10);
      if (t > max) max = t;
    }
    return max;
  }

  /* Saldo kas pada akhir tanggal `sampai`, dihitung dari saldo awal + semua aktual */
  function saldoAktualPada(data, cfg, sampai) {
    var saldo = Number(cfg.saldoAwal) || 0;
    var mulai = String(cfg.saldoAwalTanggal || '2026-01-01').slice(0, 10);
    var act = data.actual || [], i;
    for (i = 0; i < act.length; i++) {
      var t = String(act[i].tanggal || '').slice(0, 10);
      if (t < mulai || t > sampai) continue;
      var n = Number(act[i].nominal) || 0;
      saldo += (act[i].tipe === 'in' ? n : -n);
    }
    return saldo;
  }

  /* ==========================================================================
     HITUNG — fungsi utama
     opts = { dari, sampai, skenario, whatIf:[{tanggal,coa,nominal,tipe,label}] }
     ========================================================================== */
  function hitung(data, opts) {
    var cfg = data.config || CFG.DEFAULT_CONFIG;
    var dari = opts.dari, sampai = opts.sampai;
    var sk = null, i, j;
    for (i = 0; i < CFG.SKENARIO.length; i++) if (CFG.SKENARIO[i].id === opts.skenario) sk = CFG.SKENARIO[i];
    if (!sk) sk = CFG.SKENARIO[1];
    var faktor = sk.faktor;

    var cutoff = cutoffAktual(data);

    /* ------------------------------------------------------------------
       Saldo itu berkelanjutan: sisa bulan lalu jadi modal bulan ini.
       Karena itu perhitungan selalu DIMULAI dari tanggal saldo awal, bukan
       dari `dari` — lalu hasil sebelum `dari` dibuang dari output. Tanpa ini,
       melihat "Desember saja" akan mulai dari saldo awal (biasanya 0) dan
       mengabaikan surplus/defisit Agustus–November.
       Jendela dibatasi 400 hari ke belakang supaya tetap ringan.
       ------------------------------------------------------------------ */
    var awalSaldo = String(cfg.saldoAwalTanggal || '2026-01-01').slice(0, 10);
    var mulaiWalk = tambahHari(awalSaldo, 1);
    var batasMundur = tambahHari(dari, -400);
    if (mulaiWalk < batasMundur) mulaiWalk = batasMundur;
    if (mulaiWalk > dari) mulaiWalk = dari;

    /* Tanpa saldo awal, merangkai mundur cuma menghasilkan saldo semu: bulan-bulan
       sebelum periode ini biasanya belum punya rencana pengeluaran, jadi yang
       terhitung hanya pemasukan. Kalau saldo awal belum diisi, mulai dari `dari`
       saja — lebih jujur menampilkan 0 daripada angka karangan. */
    var punyaSaldoAwal = (Number(cfg.saldoAwal) || 0) > 0;
    if (!punyaSaldoAwal) mulaiWalk = dari;

    var tanggalList = rentang(mulaiWalk, sampai);   /* dihitung */
    var tampilDari = dari;                          /* ditampilkan */

    /* bulan yang perlu peta GMV: rentang hitung + lag mundur */
    var bulanSet = {}, awalLag = tambahHari(mulaiWalk, -35);
    var scan = rentang(awalLag, sampai);
    for (i = 0; i < scan.length; i++) bulanSet[bulanKey(scan[i])] = true;
    var bulanList = Object.keys(bulanSet).sort();

    var gmv = petaGmv(data, bulanList, sk.id, faktor);
    var aktual = petaAktual(data);
    var rab = petaRab(data, cutoff);
    var recur = petaRecurring(data, tanggalList, cutoff);
    var rencana = petaRencana(data, tanggalList, cutoff);
    var vari = petaVariabel(data, cfg, gmv, tanggalList, 1, cutoff);
    var baseline = hitungBaseline(data, cfg);
    var baselineItem = [];
    for (var bc in baseline) if (baseline.hasOwnProperty(bc)) {
      baselineItem.push({ coa: bc, nominal: baseline[bc], label: 'Operasional harian (baseline)', sumber: 'baseline' });
    }

    /* what-if disusun per tanggal */
    var wif = {};
    var wl = opts.whatIf || [];
    for (i = 0; i < wl.length; i++) {
      var w = wl[i], wt = String(w.tanggal || '').slice(0, 10);
      if (!wt) continue;
      if (!wif[wt]) wif[wt] = [];
      wif[wt].push({
        coa: w.coa, nominal: Number(w.nominal) || 0, tipe: w.tipe || 'out',
        label: w.label || 'Simulasi', sumber: 'whatif'
      });
    }

    /* saldo pembuka jendela hitung (biasanya = saldo awal config) */
    var saldo = saldoAktualPada(data, cfg, tambahHari(mulaiWalk, -1));
    var saldoAwalPeriode = saldo;   /* diperbarui saat mencapai `tampilDari` */

    var hari = [], totalMasuk = 0, totalKeluar = 0;
    var masukAktual = 0, keluarAktual = 0, masukProyeksi = 0, keluarProyeksi = 0;

    for (i = 0; i < tanggalList.length; i++) {
      var tgl = tanggalList[i];
      var isAktual = !!(cutoff && tgl <= cutoff);
      var detailMasuk = {}, detailKeluar = {}, item = [];
      var masuk = 0, keluar = 0;

      var tampil = tgl >= tampilDari;      /* hari sebelum ini cuma buat merangkai saldo */
      if (tampil && !hari.length) saldoAwalPeriode = saldo;

      if (isAktual) {
        var a = aktual[tgl];
        if (a) {
          detailMasuk = a.masuk; detailKeluar = a.keluar;
          masuk = a.totalMasuk; keluar = a.totalKeluar;
          item = a.item.slice();
        }
        if (tampil) { masukAktual += masuk; keluarAktual += keluar; }
      } else {
        /* penerimaan dari GMV yang sudah lewat lag */
        var kas = kasDariGmv(gmv, tgl, cfg);
        detailMasuk = kas.detail; masuk = kas.total;
        if (masuk) item.push({ coa: 'penjualan', nominal: masuk, tipe: 'in', label: 'Penerimaan penjualan (H+lag)', sumber: 'forecast' });

        /* pengeluaran: baseline harian + rencana grid + RAB + recurring + variabel */
        var srcs = [baselineItem, rencana[tgl] || [], rab[tgl] || [], recur[tgl] || [], vari[tgl] || []];
        for (j = 0; j < srcs.length; j++) {
          var arr = srcs[j], m;
          for (m = 0; m < arr.length; m++) {
            var it = arr[m];
            detailKeluar[it.coa] = (detailKeluar[it.coa] || 0) + it.nominal;
            keluar += it.nominal;
            item.push({ coa: it.coa, nominal: it.nominal, tipe: 'out', label: it.label, sumber: it.sumber });
          }
        }
        if (tampil) { masukProyeksi += masuk; keluarProyeksi += keluar; }
      }

      /* what-if berlaku di aktual maupun proyeksi */
      var wa = wif[tgl] || [];
      for (j = 0; j < wa.length; j++) {
        var wi = wa[j];
        if (wi.tipe === 'in') {
          detailMasuk[wi.coa] = (detailMasuk[wi.coa] || 0) + wi.nominal;
          masuk += wi.nominal;
        } else {
          detailKeluar[wi.coa] = (detailKeluar[wi.coa] || 0) + wi.nominal;
          keluar += wi.nominal;
        }
        item.push({ coa: wi.coa, nominal: wi.nominal, tipe: wi.tipe, label: wi.label, sumber: 'whatif' });
      }

      saldo = saldo + masuk - keluar;
      if (!tampil) continue;              /* hari pra-periode: cukup rangkai saldonya */
      totalMasuk += masuk; totalKeluar += keluar;

      /* agregasi per bucket buat stacked bar */
      var bucket = {};
      if (masuk) bucket.pemasukan = masuk;
      for (var cid in detailKeluar) {
        if (!detailKeluar.hasOwnProperty(cid)) continue;
        var b = CFG.bucketCoa(cid);
        bucket[b] = (bucket[b] || 0) + detailKeluar[cid];
      }

      hari.push({
        tgl: tgl,
        tipe: isAktual ? 'aktual' : 'proyeksi',
        masuk: masuk,
        keluar: keluar,
        net: masuk - keluar,
        saldo: saldo,
        detailMasuk: detailMasuk,
        detailKeluar: detailKeluar,
        bucket: bucket,
        item: item
      });
    }

    /* ------- ringkasan & insight -------
       Dipisah antara seluruh periode dan bagian proyeksi saja. Yang bisa
       ditindaklanjuti finance adalah bagian proyeksi — titik rawan yang sudah
       lewat cuma catatan sejarah. */
    var terendah = null, tertinggi = null, puncakMasuk = null, puncakKeluar = null, bahaya = [];
    var terendahP = null, puncakMasukP = null, puncakKeluarP = null, bahayaP = [], bahayaLalu = [];

    for (i = 0; i < hari.length; i++) {
      var h = hari[i];
      var proyeksi = h.tipe === 'proyeksi';

      if (!terendah || h.saldo < terendah.saldo) terendah = h;
      if (!tertinggi || h.saldo > tertinggi.saldo) tertinggi = h;
      if (!puncakMasuk || h.masuk > puncakMasuk.masuk) puncakMasuk = h;
      if (!puncakKeluar || h.keluar > puncakKeluar.keluar) puncakKeluar = h;

      if (proyeksi) {
        if (!terendahP || h.saldo < terendahP.saldo) terendahP = h;
        if (!puncakMasukP || h.masuk > puncakMasukP.masuk) puncakMasukP = h;
        if (!puncakKeluarP || h.keluar > puncakKeluarP.keluar) puncakKeluarP = h;
      }

      if (h.saldo < (cfg.ambangBahaya || 0)) {
        bahaya.push(h);
        (proyeksi ? bahayaP : bahayaLalu).push(h);
      }
    }

    return {
      skenario: sk,
      cutoff: cutoff,
      hari: hari,
      ringkas: {
        saldoAwal: saldoAwalPeriode,
        saldoAkhir: saldo,
        totalMasuk: totalMasuk,
        totalKeluar: totalKeluar,
        masukAktual: masukAktual,
        keluarAktual: keluarAktual,
        masukProyeksi: masukProyeksi,
        keluarProyeksi: keluarProyeksi,
        terendah: terendah,
        tertinggi: tertinggi,
        puncakMasuk: puncakMasuk,
        puncakKeluar: puncakKeluar,
        hariBahaya: bahaya,
        /* khusus bagian proyeksi — ini yang bisa ditindaklanjuti */
        terendahProyeksi: terendahP,
        puncakMasukProyeksi: puncakMasukP,
        puncakKeluarProyeksi: puncakKeluarP,
        hariBahayaProyeksi: bahayaP,
        hariBahayaLalu: bahayaLalu
      }
    };
  }

  /* ==========================================================================
     AGREGASI — kelompokkan hasil harian jadi mingguan / bulanan.
     Melihat 6 bulan dalam 180 titik harian itu tidak terbaca; komisaris butuh
     ~6–12 titik. Saldo diambil dari hari TERAKHIR periode (saldo itu posisi,
     bukan arus, jadi tidak boleh dijumlah). Arus (masuk/keluar) dijumlah.
     ========================================================================== */
  function agregasi(hari, grain) {
    if (!hari.length) return [];

    if (grain === 'harian' || !grain) {
      return hari.map(function (h) {
        return {
          key: h.tgl, tglAwal: h.tgl, tglAkhir: h.tgl,
          masuk: h.masuk, keluar: h.keluar, net: h.net,
          saldo: h.saldo, saldoAwal: h.saldo - h.masuk + h.keluar,
          tipe: h.tipe, bucket: h.bucket, hari: [h],
          detailKeluar: h.detailKeluar, detailMasuk: h.detailMasuk
        };
      });
    }

    var grup = [], kini = null, i;
    for (i = 0; i < hari.length; i++) {
      var h = hari[i];
      var kunci = (grain === 'bulanan') ? bulanKey(h.tgl) : 'w' + Math.floor(i / 7);
      if (!kini || kini.key !== kunci) {
        kini = {
          key: kunci, tglAwal: h.tgl, tglAkhir: h.tgl,
          masuk: 0, keluar: 0, net: 0, saldo: 0,
          saldoAwal: h.saldo - h.masuk + h.keluar,
          tipe: h.tipe, bucket: {}, hari: [], detailKeluar: {}, detailMasuk: {}
        };
        grup.push(kini);
      }
      kini.tglAkhir = h.tgl;
      kini.masuk += h.masuk;
      kini.keluar += h.keluar;
      kini.saldo = h.saldo;                       /* posisi akhir periode */
      kini.hari.push(h);
      if (h.tipe === 'proyeksi') kini.tipe = 'proyeksi';   /* campuran → proyeksi */

      var k;
      for (k in h.bucket) if (h.bucket.hasOwnProperty(k)) kini.bucket[k] = (kini.bucket[k] || 0) + h.bucket[k];
      for (k in h.detailKeluar) if (h.detailKeluar.hasOwnProperty(k)) kini.detailKeluar[k] = (kini.detailKeluar[k] || 0) + h.detailKeluar[k];
      for (k in h.detailMasuk) if (h.detailMasuk.hasOwnProperty(k)) kini.detailMasuk[k] = (kini.detailMasuk[k] || 0) + h.detailMasuk[k];
    }
    grup.forEach(function (g) { g.net = g.masuk - g.keluar; });
    return grup;
  }

  /* ==========================================================================
     ANALISA PENYEBAB — "kenapa saldo turun/rendah di tanggal ini?"
     Membandingkan hari target dengan perilaku normal di periode yang sama:
       · pengeluaran pos apa yang jauh di atas kebiasaannya
       · apakah pemasukan hari itu memang seret
       · seberapa dalam turunnya dari puncak terakhir
     ========================================================================== */
  function analisaHari(hasil, tgl) {
    var hari = hasil.hari || [];
    var idx = -1, i;
    for (i = 0; i < hari.length; i++) if (hari[i].tgl === tgl) { idx = i; break; }
    if (idx < 0) return null;
    var h = hari[idx];

    /* --- rata-rata normal per pos & pemasukan harian --- */
    var jml = hari.length || 1;
    var rataMasuk = hari.reduce(function (a, x) { return a + x.masuk; }, 0) / jml;
    var rataKeluar = hari.reduce(function (a, x) { return a + x.keluar; }, 0) / jml;

    var totalPos = {}, hariAdaPos = {};
    hari.forEach(function (x) {
      for (var c in x.detailKeluar) {
        if (!x.detailKeluar.hasOwnProperty(c)) continue;
        totalPos[c] = (totalPos[c] || 0) + x.detailKeluar[c];
        hariAdaPos[c] = (hariAdaPos[c] || 0) + 1;
      }
    });

    /* --- pos pemicu: dibanding rata-rata pos itu sendiri --- */
    var pemicu = [];
    for (var coa in h.detailKeluar) {
      if (!h.detailKeluar.hasOwnProperty(coa)) continue;
      var nilai = h.detailKeluar[coa];
      var rataPos = (totalPos[coa] || 0) / jml;                 /* rata-rata seluruh hari */
      var kali = rataPos > 0 ? nilai / rataPos : (nilai > 0 ? 99 : 0);
      var jarang = (hariAdaPos[coa] || 0) <= Math.max(2, Math.round(jml * 0.1));
      pemicu.push({
        coa: coa, nama: CFG.namaCoa(coa), nominal: nilai,
        rataPos: Math.round(rataPos), kali: kali, jarang: jarang,
        porsi: h.keluar ? nilai / h.keluar : 0
      });
    }
    pemicu.sort(function (a, b) { return b.nominal - a.nominal; });

    /* --- turun dari puncak terakhir sebelum tanggal ini --- */
    var puncak = null;
    for (i = idx; i >= 0; i--) {
      if (!puncak || hari[i].saldo > puncak.saldo) puncak = hari[i];
    }
    var turunDariPuncak = puncak ? puncak.saldo - h.saldo : 0;

    /* --- akumulasi: berapa hari beruntun defisit sampai titik ini --- */
    var beruntun = 0;
    for (i = idx; i >= 0; i--) { if (hari[i].net < 0) beruntun++; else break; }
    var totalDefisitBeruntun = 0;
    for (i = idx; i > idx - beruntun; i--) totalDefisitBeruntun += (hari[i].keluar - hari[i].masuk);

    return {
      hari: h,
      rataMasuk: Math.round(rataMasuk),
      rataKeluar: Math.round(rataKeluar),
      masukSeret: h.masuk < rataMasuk * 0.6,
      keluarBesar: h.keluar > rataKeluar * 1.3,
      pemicu: pemicu,
      puncak: puncak,
      turunDariPuncak: turunDariPuncak,
      hariBeruntunDefisit: beruntun,
      totalDefisitBeruntun: Math.round(totalDefisitBeruntun)
    };
  }

  /* Runway: berapa hari kas bertahan kalau penerimaan berhenti total.
     Metrik klasik buat board — "kalau jualan mandek, kita kuat berapa lama". */
  function runway(hari, saldoSekarang) {
    var proy = hari.filter(function (h) { return h.tipe === 'proyeksi'; });
    if (!proy.length) return null;
    var totalKeluar = proy.reduce(function (a, h) { return a + h.keluar; }, 0);
    var perHari = totalKeluar / proy.length;
    if (perHari <= 0) return null;
    return { hari: Math.floor(saldoSekarang / perHari), burnHarian: Math.round(perHari) };
  }

  /* Hitung ketiga skenario sekaligus (buat chart 3 garis) */
  function hitungSemua(data, opts) {
    var out = {}, i;
    for (i = 0; i < CFG.SKENARIO.length; i++) {
      var id = CFG.SKENARIO[i].id;
      out[id] = hitung(data, {
        dari: opts.dari, sampai: opts.sampai, skenario: id, whatIf: opts.whatIf
      });
    }
    return out;
  }

  /* Proyeksi GMV (omset) per bulan untuk satu skenario — buat halaman Target */
  function omsetBulanan(data, bulanList, skenarioId) {
    var sk = null, i, j;
    for (i = 0; i < CFG.SKENARIO.length; i++) if (CFG.SKENARIO[i].id === skenarioId) sk = CFG.SKENARIO[i];
    var faktor = sk ? sk.faktor : 1;
    var out = [];
    for (i = 0; i < bulanList.length; i++) {
      var bln = bulanList[i], total = 0, perChannel = {};
      for (j = 0; j < CFG.CHANNELS.length; j++) {
        var c = CFG.CHANNELS[j];
        var v = Math.round(targetSkenario(data, bln, c.id, skenarioId, faktor));
        perChannel[c.id] = v;
        total += v;
      }
      out.push({ bulan: bln, total: total, perChannel: perChannel });
    }
    return out;
  }

  global.ENGINE = {
    toKey: toKey, fromKey: fromKey, bulanKey: bulanKey, tambahHari: tambahHari,
    jumlahHari: jumlahHari, rentang: rentang, tanggalBulan: tanggalBulan, pad: pad,
    bobotHari: bobotHari, sebarBulan: sebarBulan,
    petaGmv: petaGmv, targetBulananChannel: targetBulananChannel, targetSkenario: targetSkenario, masterChannel: masterChannel,
    cutoffAktual: cutoffAktual, saldoAktualPada: saldoAktualPada, hitungBaseline: hitungBaseline,
    petaRencana: petaRencana, coaBerencana: coaBerencana,
    hitung: hitung, hitungSemua: hitungSemua, omsetBulanan: omsetBulanan,
    agregasi: agregasi, runway: runway, analisaHari: analisaHari
  };
})(window);
