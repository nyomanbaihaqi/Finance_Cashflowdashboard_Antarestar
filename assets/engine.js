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
  function petaGmv(data, bulanList) {
    var peta = {};   // peta[channelId][tanggal] = gmv
    var i, j, c;

    for (i = 0; i < CFG.CHANNELS.length; i++) peta[CFG.CHANNELS[i].id] = {};

    /* 1. dari target bulanan per channel */
    for (i = 0; i < bulanList.length; i++) {
      var bln = bulanList[i];
      for (j = 0; j < CFG.CHANNELS.length; j++) {
        c = CFG.CHANNELS[j];
        var total = targetBulananChannel(data, bln, c.id);
        if (!total) continue;
        var sebar = sebarBulan(bln, total), k;
        for (k in sebar) if (sebar.hasOwnProperty(k)) peta[c.id][k] = sebar[k];
      }
    }

    /* 2. override harian menang */
    var th = data.targetHarian || [];
    for (i = 0; i < th.length; i++) {
      var r = th[i];
      if (peta[r.channel]) peta[r.channel][String(r.tanggal).slice(0, 10)] = Number(r.gmv) || 0;
    }

    return peta;
  }

  /* Target GMV satu channel di satu bulan.
     Kalau finance sudah isi breakdown per channel → pakai itu.
     Kalau belum → pecah total bulanan pakai PORSI_MP / offline / b2b. */
  function targetBulananChannel(data, bln, channelId) {
    var tb = data.targetBulanan || [], i;
    for (i = 0; i < tb.length; i++) {
      if (bulanKey(tb[i].bulan) === bln && tb[i].channel === channelId) return Number(tb[i].gmv) || 0;
    }

    var master = null;
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
  function kasDariGmv(peta, tanggal, faktor, cfg) {
    var hasil = {}, total = 0, i;
    for (i = 0; i < CFG.CHANNELS.length; i++) {
      var c = CFG.CHANNELS[i];
      var lag = (c.lag === 0 || c.lag) ? c.lag : (cfg.lagDefault || 5);
      var asal = tambahHari(tanggal, -lag);
      var gmv = (peta[c.id] && peta[c.id][asal]) || 0;
      if (!gmv) continue;
      var kas = Math.round(gmv * ((c.netto || 100) / 100) * faktor);
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

    var terjadwal = {};
    (data.recurring || []).forEach(function (r) { if (r.aktif !== false) terjadwal[r.coa] = true; });

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

    var tanggalList = rentang(dari, sampai);
    var cutoff = cutoffAktual(data);

    /* bulan yang perlu peta GMV: rentang + lag mundur (butuh GMV sebelum `dari`) */
    var bulanSet = {}, awalLag = tambahHari(dari, -35);
    var scan = rentang(awalLag, sampai);
    for (i = 0; i < scan.length; i++) bulanSet[bulanKey(scan[i])] = true;
    var bulanList = Object.keys(bulanSet).sort();

    var gmv = petaGmv(data, bulanList);
    var aktual = petaAktual(data);
    var rab = petaRab(data, cutoff);
    var recur = petaRecurring(data, tanggalList, cutoff);
    var vari = petaVariabel(data, cfg, gmv, tanggalList, faktor, cutoff);
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

    /* saldo pembuka = saldo akhir hari sebelum `dari` */
    var saldo = saldoAktualPada(data, cfg, tambahHari(dari, -1));
    var saldoAwalPeriode = saldo;

    var hari = [], totalMasuk = 0, totalKeluar = 0;
    var masukAktual = 0, keluarAktual = 0, masukProyeksi = 0, keluarProyeksi = 0;

    for (i = 0; i < tanggalList.length; i++) {
      var tgl = tanggalList[i];
      var isAktual = !!(cutoff && tgl <= cutoff);
      var detailMasuk = {}, detailKeluar = {}, item = [];
      var masuk = 0, keluar = 0;

      if (isAktual) {
        var a = aktual[tgl];
        if (a) {
          detailMasuk = a.masuk; detailKeluar = a.keluar;
          masuk = a.totalMasuk; keluar = a.totalKeluar;
          item = a.item.slice();
        }
        masukAktual += masuk; keluarAktual += keluar;
      } else {
        /* penerimaan dari GMV yang sudah lewat lag */
        var kas = kasDariGmv(gmv, tgl, faktor, cfg);
        detailMasuk = kas.detail; masuk = kas.total;
        if (masuk) item.push({ coa: 'penjualan', nominal: masuk, tipe: 'in', label: 'Penerimaan penjualan (H+lag)', sumber: 'forecast' });

        /* pengeluaran: baseline harian + RAB + recurring + variabel */
        var srcs = [baselineItem, rab[tgl] || [], recur[tgl] || [], vari[tgl] || []];
        for (j = 0; j < srcs.length; j++) {
          var arr = srcs[j], m;
          for (m = 0; m < arr.length; m++) {
            var it = arr[m];
            detailKeluar[it.coa] = (detailKeluar[it.coa] || 0) + it.nominal;
            keluar += it.nominal;
            item.push({ coa: it.coa, nominal: it.nominal, tipe: 'out', label: it.label, sumber: it.sumber });
          }
        }
        masukProyeksi += masuk; keluarProyeksi += keluar;
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
        var v = Math.round(targetBulananChannel(data, bln, c.id) * faktor);
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
    petaGmv: petaGmv, targetBulananChannel: targetBulananChannel,
    cutoffAktual: cutoffAktual, saldoAktualPada: saldoAktualPada, hitungBaseline: hitungBaseline,
    hitung: hitung, hitungSemua: hitungSemua, omsetBulanan: omsetBulanan
  };
})(window);
