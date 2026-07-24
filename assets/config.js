/* ============================================================================
   ANTARESTAR — CASHFLOW PROJECTION
   config.js — master data: COA, channel, target, default setting
   Semua angka dalam Rupiah penuh (integer).
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------
     KONEKSI KE GOOGLE SHEET
     Isi APPS_SCRIPT_URL setelah deploy apps-script/Code.gs sebagai Web App.
     Kalau masih kosong → app jalan pakai data demo + localStorage.
     --------------------------------------------------------------------- */
  var CONN = {
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw5SBSplxcGY6g4voTpk9-6tZHnB5xZIi-avE0SgY4V85cxIfB_oZOjL0MAS3VxGIZ6/exec',                                        // <-- isi setelah deploy Web App
    TOKEN: '',                                                  // opsional; samakan dgn TOKEN di Code.gs
    SHEET_ID: '1trHZ_CLBoA0Wl3vr9hIPgtKp2GRIF1asc-fWsxViPY8',   // Finance Dashboard
    SHEET_URL: 'https://docs.google.com/spreadsheets/d/1trHZ_CLBoA0Wl3vr9hIPgtKp2GRIF1asc-fWsxViPY8/edit'
  };

  /* ---------------------------------------------------------------------
     CHART OF ACCOUNTS — PENERIMAAN
     Urutan & penamaan mengikuti sheet CASHFLOW HARIAN yang dipakai finance.
     group: 'penjualan' ikut TOTAL PENERIMAAN PENJUALAN,
            'lain'      cuma ikut TOTAL PENERIMAAN UANG.
     --------------------------------------------------------------------- */
  var COA_IN = [
    { no: 1,  id: 'in_offline',      nama: 'PENERIMAAN OFFLINE',            group: 'penjualan' },
    { no: '', id: 'in_b2b',          nama: 'PENERIMAAN B2B',                group: 'penjualan' },
    { no: 2,  id: 'in_shopee',       nama: 'PENERIMAAN SHOPEE',             group: 'penjualan' },
    { no: 3,  id: 'in_tokped',       nama: 'PENERIMAAN TOKPED',             group: 'penjualan' },
    { no: 4,  id: 'in_lazada',       nama: 'PENERIMAAN LAZADA',             group: 'penjualan' },
    { no: 5,  id: 'in_lazglobal',    nama: 'PENERIMAAN LAZ GLOBAL',         group: 'penjualan' },
    { no: 6,  id: 'in_tiktok',       nama: 'PENERIMAAN TIKTOK',             group: 'penjualan' },
    { no: 7,  id: 'in_blibli',       nama: 'PENERIMAAN BLIBLI',             group: 'penjualan' },
    { no: 8,  id: 'in_akulaku',      nama: 'PENERIMAAN AKULAKU',            group: 'penjualan' },
    { no: '', id: 'in_youtube',      nama: 'PENERIMAAN YOUTUBE',            group: 'penjualan' },
    { no: 9,  id: 'in_bayar_hutang', nama: 'PENERIMAAN PEMBAYARAN HUTANG',  group: 'lain' },
    { no: 10, id: 'in_antar_bank',   nama: 'PENERIMAAN ANTAR BANK',         group: 'lain' },
    { no: 11, id: 'in_realisasi',    nama: 'PENGEMBALIAN REALISASI',        group: 'lain' },
    { no: 12, id: 'in_bunga',        nama: 'PENDAPATAN BUNGA BANK',         group: 'lain' },
    { no: 13, id: 'in_koreksi',      nama: 'KOREKSI SALDO AWAL',            group: 'lain' },
    { no: 14, id: 'in_event',        nama: 'PENERIMAAN EVENT',              group: 'lain' }
  ];

  /* ---------------------------------------------------------------------
     CHART OF ACCOUNTS — PENGELUARAN
     bucket: dipakai buat pewarnaan chart harian & ringkasan kategori.
       supplier · import · iklan · operasional · gaji · lain
     --------------------------------------------------------------------- */
  var COA_OUT = [
    { no: 1,  id: 'out_hutang_supplier', nama: 'PEMBAYARAN HUTANG SUPPLIER',                     bucket: 'supplier' },
    { no: 2,  id: 'out_hutang_deni',     nama: 'PEMBAYARAN HUTANG PAK DENI',                     bucket: 'supplier' },
    { no: 3,  id: 'out_beli_barang',     nama: 'PEMBELIAN BARANG (BAHAN) SUPPLIER',              bucket: 'supplier' },
    { no: 4,  id: 'out_beli_bahan',      nama: 'PEMBELIAN BAHAN',                                bucket: 'supplier' },
    { no: 5,  id: 'out_dp_supplier',     nama: 'PEMBAYARAN DP SUPPLIER',                         bucket: 'supplier' },
    { no: 6,  id: 'out_pinjam_wuling',   nama: 'PEMBAYARAN S PINJAM & CICILAN WULING',           bucket: 'lain' },
    { no: 7,  id: 'out_cicilan_ppn',     nama: 'PEMBAYARAN CICILAN HUTANG PAJAK PPN',            bucket: 'lain' },
    { no: 8,  id: 'out_sewa_ruko',       nama: 'PEMBAYARAN SEWA RUKO & PAJAK',                   bucket: 'operasional' },
    { no: 9,  id: 'out_gaji',            nama: 'PEMBAYARAN GAJI',                                bucket: 'gaji' },
    { no: 10, id: 'out_thr',             nama: 'PEMBAYARAN THR',                                 bucket: 'gaji' },
    { no: 11, id: 'out_ops_rena',        nama: 'BIAYA OPERASIONAL (KAS RENA)',                   bucket: 'operasional' },
    { no: 12, id: 'out_achievement',     nama: 'DANA ACHIEVEMENT',                               bucket: 'gaji' },
    { no: 13, id: 'out_kasbon',          nama: 'KASBON KARYAWAN',                                bucket: 'gaji' },
    { no: 14, id: 'out_ops_tf',          nama: 'BIAYA OPERASIONAL TF',                           bucket: 'operasional' },
    { no: 15, id: 'out_packaging',       nama: 'PEMBELIAN PACKAGING',                            bucket: 'import' },
    { no: 16, id: 'out_import',          nama: 'PEMBELIAN BARANG MATERIAL / IMPORT',             bucket: 'import' },
    { no: 17, id: 'out_peralatan',       nama: 'PEMBELIAN PERALATAN',                            bucket: 'operasional' },
    { no: 18, id: 'out_iklan',           nama: 'MARKETING (TOP UP IKLAN & KOIN, CAMPAIGN)',      bucket: 'iklan' },
    { no: 19, id: 'out_kol',             nama: 'MARKETING (KOL, AFFILIATE, INFLUENCER & BA)',    bucket: 'iklan' },
    { no: 20, id: 'out_nelafa',          nama: 'NELAFA',                                         bucket: 'lain' },
    { no: 21, id: 'out_kavela',          nama: 'SKINCARE - KAVELA',                              bucket: 'lain' },
    { no: 22, id: 'out_new_office',      nama: 'PROJECT - NEW OFFICE',                           bucket: 'lain' },
    { no: 23, id: 'out_deviden',         nama: 'PENGAMBILAN DEVIDEN',                            bucket: 'lain' },
    { no: 24, id: 'out_event',           nama: 'EVENT ANTARESTAR',                               bucket: 'lain' },
    { no: 25, id: 'out_pindah_bank',     nama: 'PINDAH DANA ANTAR BANK',                         bucket: 'lain' },
    { no: 26, id: 'out_offline_store',   nama: 'OFFLINE STORE',                                  bucket: 'operasional' },
    { no: 27, id: 'out_investor',        nama: 'PENGEMBALIAN DANA INVESTOR',                     bucket: 'lain' }
  ];

  /* Warna bucket — dipakai di stacked bar harian & legend */
  var BUCKET = {
    pemasukan:   { label: 'Pemasukan',                warna: '#10b981' },
    supplier:    { label: 'Pembayaran supplier/hutang', warna: '#1f2937' },
    import:      { label: 'Import / material',        warna: '#3b82f6' },
    iklan:       { label: 'Spend iklan',              warna: '#a855f7' },
    operasional: { label: 'Operasional',              warna: '#f59e0b' },
    gaji:        { label: 'Gaji & tim',               warna: '#ef4444' },
    lain:        { label: 'Lain-lain',                warna: '#94a3b8' }
  };

  /* ---------------------------------------------------------------------
     CHANNEL PENJUALAN (input target dari divisi DIGICOM)
     coa      : penerimaan mana yang dituju saat uang cair
     lag      : H+berapa uang diakui finance (default 5)
     netto    : % GMV yang benar-benar jadi kas (setelah fee MP, retur, cancel)
     tipe     : marketplace | offline | b2b
     --------------------------------------------------------------------- */
  /* netto 94,8% = faktor yang dipakai finance di sheet CASHFLOW PROJECTION
     (baris "0.948"): porsi GMV yang benar-benar cair jadi kas setelah fee
     marketplace, retur, dan cancel. Bisa diubah per channel di Pengaturan. */
  var NETTO_MP = 94.8;

  var CHANNELS = [
    { id: 'shopee_mall',  nama: 'Shopee Mall',       coa: 'in_shopee',    tipe: 'marketplace', lag: 5, netto: NETTO_MP },
    { id: 'shopee_ants',  nama: 'Shopee Antarestar', coa: 'in_shopee',    tipe: 'marketplace', lag: 5, netto: NETTO_MP },
    { id: 'tiktok',       nama: 'Tiktok Antarestar', coa: 'in_tiktok',    tipe: 'marketplace', lag: 5, netto: NETTO_MP },
    { id: 'tokopedia',    nama: 'Tokopedia',         coa: 'in_tokped',    tipe: 'marketplace', lag: 5, netto: NETTO_MP },
    { id: 'lazada',       nama: 'Lazada',            coa: 'in_lazada',    tipe: 'marketplace', lag: 5, netto: NETTO_MP },
    { id: 'laz_global',   nama: 'Lazada Global',     coa: 'in_lazglobal', tipe: 'marketplace', lag: 5, netto: NETTO_MP },
    { id: 'blibli',       nama: 'Blibli',            coa: 'in_blibli',    tipe: 'marketplace', lag: 5, netto: NETTO_MP },
    { id: 'akulaku',      nama: 'Akulaku',           coa: 'in_akulaku',   tipe: 'marketplace', lag: 5, netto: NETTO_MP },
    { id: 'youtube',      nama: 'Youtube',           coa: 'in_youtube',   tipe: 'marketplace', lag: 5, netto: NETTO_MP },
    { id: 'offline',      nama: 'Offline Store',     coa: 'in_offline',   tipe: 'offline',     lag: 0, netto: 100 },
    { id: 'b2b',          nama: 'B2B / Reseller',    coa: 'in_b2b',       tipe: 'b2b',         lag: 0, netto: 100 }
  ];

  /* Divisi pengisi RAB */
  var DIVISI = [
    'EXPORT-IMPORT', 'DIGICOM', 'MARKETING', 'OPERASIONAL',
    'FINANCE', 'HRD', 'WAREHOUSE', 'OFFLINE STORE', 'PRODUCT', 'IT'
  ];

  /* Satuan RAB + apakah butuh kurs */
  var SATUAN_RAB = [
    { id: 'idr',  label: 'IDR (langsung)',      kurs: false },
    { id: 'rmb',  label: 'RMB (rate)',          kurs: true  },
    { id: 'usd',  label: 'USD (rate)',          kurs: true  },
    { id: 'cbm',  label: 'CBM (ongkir laut)',   kurs: true  },
    { id: 'kg',   label: 'KG (ongkir udara)',   kurs: true  },
    { id: 'pcs',  label: 'PCS (harga satuan)',  kurs: true  }
  ];

  /* ---------------------------------------------------------------------
     TARGET GMV 2026 dari divisi DIGICOM (sumber: TARGET ANTARESTAR PER BULAN)
     Dipakai sebagai seed awal; setelah tersimpan di sheet, sheet yang menang.
     --------------------------------------------------------------------- */
  var TARGET_2026 = [
    { bulan: '2026-01', marketplace: 10024000000, offline: 148000000, b2b: 493907952 },
    { bulan: '2026-02', marketplace: 12114000000, offline: 373000000, b2b: 153167294 },
    { bulan: '2026-03', marketplace: 13801000000, offline: 458000000, b2b: 488521545 },
    { bulan: '2026-04', marketplace: 12169000000, offline: 552400000, b2b: 114851567 },
    { bulan: '2026-05', marketplace: 13233000000, offline: 652400000, b2b:  67691296 },
    { bulan: '2026-06', marketplace: 15200000000, offline: 752400000, b2b: 364963549 },
    { bulan: '2026-07', marketplace: 15375000000, offline: 300000000, b2b: 250000000 },
    { bulan: '2026-08', marketplace: 17850000000, offline: 500000000, b2b: 250000000 },
    { bulan: '2026-09', marketplace: 18470000000, offline: 500000000, b2b: 250000000 },
    { bulan: '2026-10', marketplace: 18953000000, offline: 500000000, b2b: 250000000 },
    { bulan: '2026-11', marketplace: 20057000000, offline: 500000000, b2b: 250000000 },
    { bulan: '2026-12', marketplace: 21087000000, offline: 500000000, b2b: 300000000 }
  ];

  /* Porsi default tiap channel marketplace dari total target marketplace bulanan.
     Dipakai kalau finance belum breakdown target per channel. Total = 1.00 */
  var PORSI_MP = {
    shopee_mall: 0.470,
    tiktok:      0.400,
    shopee_ants: 0.030,
    tokopedia:   0.045,
    lazada:      0.025,
    laz_global:  0.010,
    blibli:      0.010,
    akulaku:     0.005,
    youtube:     0.005
  };

  /* Realisasi TIDAK dihardcode. Angka realisasi selalu dihitung dari data
     Aktual Harian yang benar-benar diinput, supaya tidak pernah ada grafik
     "realisasi" untuk bulan yang datanya belum dimasukkan. */

  /* ---------------------------------------------------------------------
     ALIAS IMPOR — nama pos di sheet lama yang tidak sama persis dengan COA.
     Dipakai saat mengunggah file: kunci dicocokkan setelah dinormalisasi
     (huruf besar, tanpa tanda baca). Nilai = id COA tujuan.
     --------------------------------------------------------------------- */
  var ALIAS_IMPOR = {
    /* penerimaan */
    'PENERIMAAN ANTAR BANK':                'in_antar_bank',
    'PENERIMAAN REALISASI':                 'in_realisasi',
    'PENGEMBALIAN REALISASI':               'in_realisasi',
    'KOREKSI SALDO AWAL REK MANDIRI':       'in_koreksi',
    'KOREKSI SALDO AWAL REK':               'in_koreksi',
    'PENERIMAAN DARI PAK DENI':             'in_bayar_hutang',
    'PENERIMAAN PEMBAYARAN HUTANG':         'in_bayar_hutang',
    'PENERIMAAN TOKOPEDIA':                 'in_tokped',
    'PENERIMAAN SHOPEE MALL':               'in_shopee',
    'PENERIMAAN TIKTOK SHOP':               'in_tiktok',
    'PENDAPATAN BUNGA':                     'in_bunga',

    /* pengeluaran */
    'PEMBAYARAN HUTANG INVESTOR':           'out_investor',
    'PENGEMBALIAN DANA INVESTOR':           'out_investor',
    'PEMBAYARAN HUTANG BAHAN':              'out_beli_bahan',
    'PEMBELIAN BAHAN':                      'out_beli_bahan',
    'PEMBELIAN BARANG BAHAN SUPPLIER':      'out_beli_barang',
    'PEMBAYARAN SEWA RUKO PAJAK SEWA':      'out_sewa_ruko',
    'PEMBAYARAN SEWA RUKO PAJAK':           'out_sewa_ruko',
    'PEMBAYARAN S PINJAM CICILAN WULING':   'out_pinjam_wuling',
    'PEMBAYARAN CICILAN HUTANG PAJAK PPN':  'out_cicilan_ppn',
    'PEMBELIAN BARANG MATERIAL IMPORT':     'out_import',
    'MARKETING TOP UP IKLAN KOIN CAMPAIGN': 'out_iklan',
    'MARKETING KOL AFFILIATE INFLUENCER BA':'out_kol',
    'SKINCARE KAVELA':                      'out_kavela',
    'PROJECT NEW OFFICE':                   'out_new_office',
    'INVESTASI PROJECT':                    'out_new_office',
    'BIAYA OPERASIONAL KAS RENA':           'out_ops_rena',
    'PEMBELIAN ZIPLOK':                     'out_packaging',
    'PEMBELIAN BARANG SUPPLIER':            'out_beli_barang',
    'PEMBAYARAN HUTANG PAK DENI':           'out_hutang_deni',
    'PEMBAYARAN GAJI':                      'out_gaji',
    'EVENT ANTARESTAR':                     'out_event',
    'PINDAH DANA ANTAR BANK':               'out_pindah_bank',
    'OFFLINE STORE':                        'out_offline_store',
    'PENGAMBILAN DEVIDEN':                  'out_deviden',
    'PENGAMBILAN DIVIDEN':                  'out_deviden'
  };

  /* Baris yang bukan pos — dilewati saat impor */
  var BARIS_ABAIKAN = [
    'PENERIMAAN', 'PENGELUARAN', 'SALDO AWAL', 'SALDO AKHIR', 'SALDO AWAL CV',
    'TOTAL', 'TOTAL PENERIMAAN', 'TOTAL PENGELUARAN', 'TOTAL PENERIMAAN UANG',
    'TOTAL PENERIMAAN PENJUALAN', 'CASHFLOW REPORT', 'DESCRIPTION',
    'CASH INFLOW CASH OUTFLOW', 'GRAND TOTAL', 'JUMLAH'
  ];

  /* ---------------------------------------------------------------------
     POLA SEBARAN HARIAN
     Bobot relatif per hari sebelum dinormalisasi ke target bulanan.
     --------------------------------------------------------------------- */
  var POLA = {
    weekday:      1.00,   // Sen–Jum
    weekend:      1.05,   // Sab–Min
    tanggalKembar: 3.00,  // 1.1, 2.2, ... 12.12 (campaign besar)
    midMonth:     1.35,   // tanggal 15 (payday campaign)
    payday:       1.15,   // tanggal 25–27 (gajian nasional)
    akhirBulan:   0.90    // tanggal 28–akhir, momentum turun
  };

  /* ---------------------------------------------------------------------
     SKENARIO — faktor dikalikan ke PENERIMAAN saja.
     Moderate = -10% dari Optimis. Pesimis = -10% dari Moderate.
     Pengeluaran identik di 3 skenario (komitmen tetap harus dibayar).
     --------------------------------------------------------------------- */
  var SKENARIO = [
    { id: 'optimis',  nama: 'Optimis',  faktor: 1.00, warna: '#059669' },
    { id: 'moderate', nama: 'Moderate', faktor: 0.90, warna: '#ea580c' },
    { id: 'pesimis',  nama: 'Pesimis',  faktor: 0.81, warna: '#e11d48' }
  ];

  /* ---------------------------------------------------------------------
     DEFAULT SETTING (bisa diubah di halaman Pengaturan → simpan ke tab Config)
     --------------------------------------------------------------------- */
  var DEFAULT_CONFIG = {
    namaPerusahaan:   'ANTARESTAR',
    saldoAwal:        0,              // saldo kas di tanggal saldoAwalTanggal
    saldoAwalTanggal: '2026-01-01',
    ambangBahaya:     1000000000,     // Rp 1,0 M — garis merah di chart
    ambangWaspada:    2000000000,     // Rp 2,0 M — zona kuning
    lagDefault:       5,              // H+5 pengakuan kas dari sheet digicom
    kursRMB:          2370,
    kursUSD:          16500,
    skenarioAktif:    'moderate',
    horizonBulan:     6,              // proyeksi berapa bulan ke depan
    pakaiVariabel:    false,          // ON = iklan/KOL/packaging dihitung % dari omset
    pakaiBaseline:    true,           // ON = operasional harian diproyeksi dari rata-rata aktual
    baselineHari:     30,             // jendela rata-rata (hari terakhir)
    baselineOverride: {},             // { coaId: nominal harian } — isian manual finance
    baselineOff:      [],             // coaId yang dimatikan dari baseline
    coaTambahan:      [],             // kategori pengeluaran custom: [{id,nama,bucket}]
    /* true = skenario itu HANYA memakai target yang diketik sendiri;
       false = kosongnya ikut rumus (faktor × Optimis) */
    skenarioMandiri:  { moderate: false, pesimis: false }
  };

  /* Recurring / fixed cost contoh — diganti lewat halaman Fixed Cost */
  var SEED_RECURRING = [
    { id: 'r1', nama: 'Gaji karyawan',            coa: 'out_gaji',          nominal: 450000000, tanggal: 28, mulai: '2026-01', selesai: '', aktif: true },
    { id: 'r2', nama: 'Sewa ruko & pajak',        coa: 'out_sewa_ruko',     nominal:  85000000, tanggal: 5,  mulai: '2026-01', selesai: '', aktif: true },
    { id: 'r3', nama: 'Cicilan Wuling & S.Pinjam',coa: 'out_pinjam_wuling', nominal:  42000000, tanggal: 10, mulai: '2026-01', selesai: '', aktif: true },
    { id: 'r4', nama: 'Cicilan hutang pajak PPN', coa: 'out_cicilan_ppn',   nominal: 120000000, tanggal: 15, mulai: '2026-01', selesai: '', aktif: true },
    { id: 'r5', nama: 'Biaya operasional (Rena)', coa: 'out_ops_rena',      nominal:  65000000, tanggal: 3,  mulai: '2026-01', selesai: '', aktif: true },
    { id: 'r6', nama: 'Biaya operasional TF',     coa: 'out_ops_tf',        nominal:  38000000, tanggal: 3,  mulai: '2026-01', selesai: '', aktif: true }
  ];

  /* Biaya variabel = % dari proyeksi omset bulan berjalan.
     Ikut naik-turun mengikuti skenario. */
  var SEED_VARIABEL = [
    { id: 'v1', nama: 'Top up iklan & koin',   coa: 'out_iklan',     persen: 12.0, aktif: true },
    { id: 'v2', nama: 'KOL / affiliate / BA',  coa: 'out_kol',       persen:  4.5, aktif: true },
    { id: 'v3', nama: 'Packaging',             coa: 'out_packaging', persen:  1.8, aktif: true }
  ];

  global.CFG = {
    CONN: CONN,
    COA_IN: COA_IN,
    COA_OUT: COA_OUT,
    BUCKET: BUCKET,
    CHANNELS: CHANNELS,
    DIVISI: DIVISI,
    SATUAN_RAB: SATUAN_RAB,
    TARGET_2026: TARGET_2026,
    PORSI_MP: PORSI_MP,
    ALIAS_IMPOR: ALIAS_IMPOR,
    BARIS_ABAIKAN: BARIS_ABAIKAN,
    POLA: POLA,
    SKENARIO: SKENARIO,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    SEED_RECURRING: SEED_RECURRING,
    SEED_VARIABEL: SEED_VARIABEL,

    /* helper lookup */
    coa: function (id) {
      var i;
      for (i = 0; i < COA_IN.length; i++) if (COA_IN[i].id === id) return COA_IN[i];
      for (i = 0; i < COA_OUT.length; i++) if (COA_OUT[i].id === id) return COA_OUT[i];
      return null;
    },
    namaCoa: function (id) { var c = this.coa(id); return c ? c.nama : id; },
    bucketCoa: function (id) {
      var c = this.coa(id);
      if (!c) return 'lain';
      return c.bucket || 'pemasukan';
    },
    channel: function (id) {
      for (var i = 0; i < CHANNELS.length; i++) if (CHANNELS[i].id === id) return CHANNELS[i];
      return null;
    },

    /* ------ kategori pengeluaran custom (disimpan di Config, bukan tab baru) ------ */
    /* Gabungkan daftar custom ke COA_OUT. Idempotent — aman dipanggil ulang. */
    terapkanCoaTambahan: function (list) {
      (list || []).forEach(function (o) {
        if (!o || !o.id || !o.nama) return;
        if (COA_OUT.some(function (c) { return c.id === o.id; })) return;
        COA_OUT.push({ no: '', id: o.id, nama: o.nama, bucket: o.bucket || 'lain', custom: true });
      });
    },
    hapusCoaTambahan: function (id) {
      for (var i = COA_OUT.length - 1; i >= 0; i--) {
        if (COA_OUT[i].id === id && COA_OUT[i].custom) COA_OUT.splice(i, 1);
      }
    },
    isCoaCustom: function (id) {
      var c = this.coa(id);
      return !!(c && c.custom);
    }
  };
})(window);
