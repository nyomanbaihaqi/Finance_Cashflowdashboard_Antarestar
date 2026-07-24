/* ============================================================================
   ANTARESTAR — CASHFLOW PROJECTION
   store.js — state, sinkronisasi Google Sheet (Apps Script), fallback lokal
   ========================================================================== */
(function (global) {
  'use strict';

  var CFG = global.CFG;
  var LS_KEY = 'antarestar_cashflow_v1';

  var state = {
    siap: false,
    mode: 'demo',           // demo | lokal | sheet
    error: null,
    syncing: false,
    data: {
      config: {},
      actual: [],
      targetBulanan: [],
      targetHarian: [],
      rab: [],
      recurring: [],
      variabel: [],
      rencanaBulanan: [],
      rencanaHarian: []
    }
  };

  /* --------------------------------------------------------------- util */
  function uid(prefix) {
    return (prefix || 'x') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function terhubung() {
    return !!(CFG.CONN.APPS_SCRIPT_URL && CFG.CONN.APPS_SCRIPT_URL.indexOf('http') === 0);
  }

  /* ------------------------------------------------------- localStorage */
  function simpanLokal() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state.data)); } catch (e) { /* quota */ }
  }

  function bacaLokal() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------- Apps Script */
  /* Pakai text/plain supaya tidak kena CORS preflight ke Apps Script. */
  function panggil(action, payload) {
    var url = CFG.CONN.APPS_SCRIPT_URL;
    var body = JSON.stringify({ action: action, token: CFG.CONN.TOKEN, payload: payload || {} });
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body,
      redirect: 'follow'
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || j.ok !== true) throw new Error((j && j.error) || 'Respons tidak dikenal dari Apps Script');
      return j.data;
    });
  }

  /* --------------------------------------------------------- demo data */
  /* RNG deterministik supaya angka demo konsisten tiap refresh. */
  function rng(seed) {
    var s = seed;
    return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  function dataDemo() {
    var E = global.ENGINE;
    var rand = rng(20260722);
    var actual = [];

    var coaMasuk = ['in_shopee', 'in_tiktok', 'in_tokped', 'in_lazada', 'in_offline', 'in_b2b'];
    var porsiMasuk = [0.46, 0.36, 0.07, 0.04, 0.04, 0.03];
    var coaKeluar = [
      { coa: 'out_hutang_supplier', porsi: 0.34 },
      { coa: 'out_import',          porsi: 0.16 },
      { coa: 'out_iklan',           porsi: 0.20 },
      { coa: 'out_kol',             porsi: 0.07 },
      { coa: 'out_ops_rena',        porsi: 0.09 },
      { coa: 'out_packaging',       porsi: 0.06 },
      { coa: 'out_gaji',            porsi: 0.08 }
    ];

    var i, j;
    for (i = 1; i <= 22; i++) {
      var tgl = '2026-07-' + E.pad(i);
      var dow = E.fromKey(tgl).getDay();

      /* penerimaan: base 300 Jt, akhir pekan lebih tinggi, 7.7 spike */
      var base = 300000000 * (0.75 + rand() * 0.55);
      if (dow === 0 || dow === 6) base *= 1.15;
      if (i === 7) base *= 1.9;
      if (i === 15) base *= 1.3;
      var masuk = Math.round(base);
      for (j = 0; j < coaMasuk.length; j++) {
        var n = Math.round(masuk * porsiMasuk[j]);
        if (n > 0) actual.push({ id: uid('a'), tanggal: tgl, coa: coaMasuk[j], tipe: 'in', nominal: n, catatan: 'Settlement harian' });
      }

      /* pengeluaran: tidak tiap hari semua pos keluar */
      var keluar = Math.round(masuk * (0.72 + rand() * 0.42));
      if (i === 3)  keluar += 180000000;              // ops awal bulan
      if (i === 10) keluar += 120000000;              // cicilan
      if (i === 20) keluar += 260000000;              // DP supplier
      for (j = 0; j < coaKeluar.length; j++) {
        if (rand() < 0.35) continue;
        var k = Math.round(keluar * coaKeluar[j].porsi * (0.85 + rand() * 0.95));
        if (k > 0) actual.push({ id: uid('a'), tanggal: tgl, coa: coaKeluar[j].coa, tipe: 'out', nominal: k, catatan: '' });
      }
    }

    /* RAB contoh — TOTAL = ITEM × SATUAN, sama seperti form RAB yang dipakai sekarang */
    function r(bulan, divisi, kegiatan, tgl, desk, item, satuan, ket, coa, status) {
      return {
        id: uid('r'), bulan: bulan, divisi: divisi, kegiatan: kegiatan, benefit: '',
        tanggalRencana: tgl, deskripsi: desk, item: item, satuan: satuan, ket: ket,
        total: Math.round(item * satuan), coa: coa, status: status
      };
    }
    var rab = [
      r('2026-08', 'EXPORT-IMPORT', 'IMPORT PRODUCT ANTARESTAR', '2026-08-04', 'DP nomaro PO4',                  2220000, 2370,      'rate rmb', 'out_dp_supplier',     'approved'),
      r('2026-08', 'EXPORT-IMPORT', 'IMPORT PRODUCT ANTARESTAR', '2026-08-05', 'Ongkir by sea 35k pcs handwarmer',   4.55, 5500000,   'cbm',      'out_import',          'approved'),
      r('2026-08', 'EXPORT-IMPORT', 'IMPORT PRODUCT ANTARESTAR', '2026-08-14', 'Pelunasan nomaro PO4',            5180000, 2370,      'rate rmb', 'out_hutang_supplier', 'draft'),
      r('2026-08', 'MARKETING',     'CAMPAIGN 8.8',              '2026-08-06', 'Top up iklan campaign 8.8',             1, 850000000, 'idr',      'out_iklan',           'approved'),
      r('2026-08', 'FINANCE',       'PAJAK',                     '2026-08-20', 'Cicilan hutang pajak PPN',              1, 320000000, 'idr',      'out_cicilan_ppn',     'draft'),
      r('2026-09', 'EXPORT-IMPORT', 'IMPORT PRODUCT ANTARESTAR', '2026-09-03', 'DP PO5 survival kit',             3080000, 2370,      'rate rmb', 'out_dp_supplier',     'draft'),
      r('2026-09', 'MARKETING',     'CAMPAIGN 9.9',              '2026-09-07', 'Top up iklan campaign 9.9',             1, 980000000, 'idr',      'out_iklan',           'draft')
    ];

    return {
      config: Object.assign({}, CFG.DEFAULT_CONFIG, {
        saldoAwal: 700000000,
        saldoAwalTanggal: '2026-06-30'
      }),
      actual: actual,
      targetBulanan: [],
      targetHarian: [],
      rab: rab,
      recurring: clone(CFG.SEED_RECURRING),
      variabel: clone(CFG.SEED_VARIABEL)
    };
  }

  /* ------------------------------------------------------------ normalisasi */
  function normalisasi(d) {
    d = d || {};
    d.config = Object.assign({}, CFG.DEFAULT_CONFIG, d.config || {});
    ['actual', 'targetBulanan', 'targetHarian', 'rab', 'recurring', 'variabel',
     'rencanaBulanan', 'rencanaHarian'].forEach(function (k) {
      if (!Array.isArray(d[k])) d[k] = [];
    });

    /* pastikan angka benar-benar number */
    d.actual.forEach(function (r) { r.nominal = Number(r.nominal) || 0; });
    d.rab.forEach(function (r) { r.total = Number(r.total) || 0; });
    d.recurring.forEach(function (r) {
      r.nominal = Number(r.nominal) || 0;
      r.tanggal = Number(r.tanggal) || 1;
      r.aktif = !(r.aktif === false || r.aktif === 'FALSE' || r.aktif === 0);
    });
    d.variabel.forEach(function (r) {
      r.persen = Number(r.persen) || 0;
      r.aktif = !(r.aktif === false || r.aktif === 'FALSE' || r.aktif === 0);
    });
    /* skenario kosong = baris lama = basis Optimis */
    d.targetBulanan.forEach(function (r) {
      r.gmv = Number(r.gmv) || 0; r.bulan = String(r.bulan).slice(0, 7);
      r.skenario = String(r.skenario || 'optimis').trim().toLowerCase();
    });
    d.targetHarian.forEach(function (r) {
      r.gmv = Number(r.gmv) || 0; r.tanggal = String(r.tanggal).slice(0, 10);
      r.skenario = String(r.skenario || 'optimis').trim().toLowerCase();
    });
    d.rencanaBulanan.forEach(function (r) {
      r.nominal = Number(r.nominal) || 0; r.bulan = String(r.bulan).slice(0, 7);
      r.keterangan = String(r.keterangan || '').trim();
    });
    d.rencanaHarian.forEach(function (r) {
      r.nominal = Number(r.nominal) || 0; r.tanggal = String(r.tanggal).slice(0, 10);
      r.keterangan = String(r.keterangan || '').trim();
    });

    ['saldoAwal', 'ambangBahaya', 'ambangWaspada', 'lagDefault', 'kursRMB', 'kursUSD', 'horizonBulan', 'baselineHari']
      .forEach(function (k) { d.config[k] = Number(d.config[k]) || 0; });
    if (!d.config.baselineHari) d.config.baselineHari = 30;
    d.config.pakaiVariabel = (d.config.pakaiVariabel === true || d.config.pakaiVariabel === 'TRUE');
    d.config.pakaiBaseline = !(d.config.pakaiBaseline === false || d.config.pakaiBaseline === 'FALSE');
    if (!d.config.baselineOverride || typeof d.config.baselineOverride !== 'object') d.config.baselineOverride = {};
    if (!Array.isArray(d.config.baselineOff)) d.config.baselineOff = [];
    if (!Array.isArray(d.config.coaTambahan)) d.config.coaTambahan = [];
    if (!d.config.skenarioMandiri || typeof d.config.skenarioMandiri !== 'object') {
      d.config.skenarioMandiri = { moderate: false, pesimis: false };
    }
    ['moderate', 'pesimis'].forEach(function (k) {
      var v = d.config.skenarioMandiri[k];
      d.config.skenarioMandiri[k] = (v === true || v === 'TRUE' || v === 'true');
    });

    return d;
  }

  /* -------------------------------------------------------------- bootstrap */
  function muat() {
    if (terhubung()) {
      state.mode = 'sheet';
      return panggil('bootstrap').then(function (d) {
        state.data = normalisasi(d);
        state.siap = true;
        simpanLokal();
        return state.data;
      }).catch(function (e) {
        state.error = e.message;
        var lokal = bacaLokal();
        state.mode = lokal ? 'lokal' : 'demo';
        state.data = normalisasi(lokal || dataDemo());
        state.siap = true;
        return state.data;
      });
    }

    var lokal = bacaLokal();
    state.mode = lokal ? 'lokal' : 'demo';
    state.data = normalisasi(lokal || dataDemo());
    state.siap = true;
    return Promise.resolve(state.data);
  }

  /* -------------------------------------------------------------- mutasi */
  /* Semua mutasi: update state dulu (optimistic), lalu kirim ke sheet. */
  function kirim(tab, aksi, row) {
    simpanLokal();
    if (!terhubung()) return Promise.resolve();
    state.syncing = true;
    global.dispatchEvent(new CustomEvent('store:sync', { detail: { syncing: true } }));
    return panggil('mutate', { tab: tab, aksi: aksi, row: row })
      .catch(function (e) { state.error = e.message; })
      .then(function () {
        state.syncing = false;
        global.dispatchEvent(new CustomEvent('store:sync', { detail: { syncing: false } }));
      });
  }

  function tambah(tab, row) {
    if (!row.id) row.id = uid(tab.slice(0, 2));
    state.data[tab].push(row);
    return kirim(tab, 'tambah', row).then(function () { return row; });
  }

  function ubah(tab, id, patch) {
    var arr = state.data[tab], i;
    for (i = 0; i < arr.length; i++) {
      if (arr[i].id === id) { Object.assign(arr[i], patch); return kirim(tab, 'ubah', arr[i]).then(function(){ return arr[i]; }); }
    }
    return Promise.resolve(null);
  }

  function hapus(tab, id) {
    var arr = state.data[tab], i;
    for (i = 0; i < arr.length; i++) {
      if (arr[i].id === id) { arr.splice(i, 1); break; }
    }
    return kirim(tab, 'hapus', { id: id });
  }

  function gantiSemua(tab, rows) {
    state.data[tab] = rows;
    simpanLokal();
    if (!terhubung()) return Promise.resolve();
    return panggil('replace', { tab: tab, rows: rows }).catch(function (e) { state.error = e.message; });
  }

  function simpanConfig(patch) {
    Object.assign(state.data.config, patch);
    simpanLokal();
    if (!terhubung()) return Promise.resolve();
    return panggil('config', { config: state.data.config }).catch(function (e) { state.error = e.message; });
  }

  function resetLokal() {
    try { localStorage.removeItem(LS_KEY); } catch (e) { /* noop */ }
  }

  /* ------------------------------------------------------- import tempel */
  /* Parser tabel yang di-copy dari Google Sheet / Excel (dipisah TAB atau koma) */
  function parseTabel(teks) {
    var baris = String(teks || '').replace(/\r/g, '').split('\n').filter(function (b) { return b.trim() !== ''; });
    return baris.map(function (b) {
      var sep = b.indexOf('\t') >= 0 ? '\t' : (b.indexOf(';') >= 0 ? ';' : ',');
      return b.split(sep).map(function (s) { return s.trim(); });
    });
  }

  /* '1.234.567' | '1,234,567' | 'Rp 5.261.400' | '(250.000)' → number */
  function keAngka(s) {
    if (typeof s === 'number') return s;
    var t = String(s || '').trim();
    if (!t) return 0;
    var negatif = /^\(.*\)$/.test(t) || t.indexOf('-') === 0;
    t = t.replace(/[Rr][Pp]\.?/g, '').replace(/[()\s]/g, '').replace(/-/g, '');
    /* buang pemisah ribuan; sisakan desimal kalau ada tepat 1-2 digit di akhir setelah koma */
    var koma = t.lastIndexOf(','), titik = t.lastIndexOf('.');
    var desimalIdx = Math.max(koma, titik);
    var utuh = t, pecahan = '';
    if (desimalIdx > -1 && t.length - desimalIdx - 1 <= 2 && t.length - desimalIdx - 1 > 0) {
      utuh = t.slice(0, desimalIdx); pecahan = t.slice(desimalIdx + 1);
    }
    utuh = utuh.replace(/[^0-9]/g, '');
    var n = parseFloat(utuh + (pecahan ? '.' + pecahan : '')) || 0;
    return negatif ? -n : n;
  }

  /* '04/11/2025' | '2026-08-04' | '4 Aug 2026' → 'YYYY-MM-DD' */
  function keTanggal(s, tahunDefault) {
    var t = String(s || '').trim();
    if (!t) return '';
    var m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + global.ENGINE.pad(+m[2]) + '-' + global.ENGINE.pad(+m[3]);
    m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (m) {
      var th = +m[3]; if (th < 100) th += 2000;
      return th + '-' + global.ENGINE.pad(+m[2]) + '-' + global.ENGINE.pad(+m[1]);
    }
    m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})$/);
    if (m && tahunDefault) return tahunDefault + '-' + global.ENGINE.pad(+m[2]) + '-' + global.ENGINE.pad(+m[1]);
    var d = new Date(t);
    return isNaN(d.getTime()) ? '' : global.ENGINE.toKey(d);
  }

  global.STORE = {
    state: state,
    data: function () { return state.data; },
    mode: function () { return state.mode; },
    terhubung: terhubung,
    muat: muat,
    tambah: tambah,
    ubah: ubah,
    hapus: hapus,
    gantiSemua: gantiSemua,
    simpanConfig: simpanConfig,
    simpanLokal: simpanLokal,
    resetLokal: resetLokal,
    dataDemo: dataDemo,
    normalisasi: normalisasi,
    uid: uid,
    parseTabel: parseTabel,
    keAngka: keAngka,
    keTanggal: keTanggal,
    panggil: panggil
  };
})(window);
