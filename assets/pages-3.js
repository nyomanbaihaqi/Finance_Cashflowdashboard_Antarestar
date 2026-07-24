/* ============================================================================
   ANTARESTAR — CASHFLOW PROJECTION
   pages-3.js — Input Center: satu pintu buat semua input + form cepat
   ========================================================================== */
(function (global) {
  'use strict';

  var UI = global.UI, CFG = global.CFG, E = global.ENGINE, S = global.STORE, IK = global.IK;
  var el = UI.el;
  var HAL = global.HAL = global.HAL || {};
  var INPUT = global.INPUT = {};

  function d() { return S.data(); }
  function cfg() { return d().config; }

  /* ======================================================================
     Form kas cepat — dipakai inline di Input Center maupun sebagai modal.
     Dirancang untuk entry beruntun: simpan → field nominal langsung fokus lagi.
     ====================================================================== */
  function formKas(opsi) {
    opsi = opsi || {};
    var arah = opsi.arah || 'in';
    var baruSaja = [];

    var wrap = el('div', { class: 'form-kas' });

    var segArah = UI.segmen([
      { value: 'in',  label: 'Uang masuk',  ikon: 'arrowDown', kelas: 'seg-hijau' },
      { value: 'out', label: 'Uang keluar', ikon: 'arrowUp',   kelas: 'seg-merah' }
    ], arah, function (v) { arah = v; isiPos(); });

    var inTgl = UI.input({ type: 'date', value: opsi.tanggal || global.APP.hariIni });
    var selPos = UI.pilih([], '', null);
    var inNominal = UI.inputUang(0);
    var inCatatan = UI.input({ placeholder: 'opsional — mis. settlement Shopee W3' });

    function isiPos() {
      var arr = arah === 'in' ? CFG.COA_IN : CFG.COA_OUT;
      var lama = selPos.value;
      UI.kosongkan(selPos);
      arr.forEach(function (c) { selPos.appendChild(el('option', { value: c.id, text: c.nama })); });
      if (arr.some(function (c) { return c.id === lama; })) selPos.value = lama;
    }
    isiPos();

    var fTgl = UI.field('Tanggal', inTgl, null, { wajib: true });
    var fPos = UI.field('Pos cashflow', selPos, null, { wajib: true });
    var fNom = UI.field('Nominal', inNominal, 'Bisa singkat: 500jt · 1,5m · 250rb', { wajib: true });
    var fCat = UI.field('Catatan', inCatatan);

    var daftarBaru = el('div', { class: 'baru-saja' });

    function gambarBaru() {
      UI.kosongkan(daftarBaru);
      if (!baruSaja.length) return;
      daftarBaru.appendChild(el('div', { class: 'baru-judul' }, [
        IK('check', 13), el('span', { text: baruSaja.length + ' transaksi tercatat sesi ini' })
      ]));
      baruSaja.slice().reverse().slice(0, 8).forEach(function (r) {
        daftarBaru.appendChild(el('div', { class: 'baru-item' }, [
          el('span', { class: 'baru-tgl', text: UI.tglPendek(r.tanggal) }),
          el('span', { class: 'baru-pos', text: CFG.namaCoa(r.coa) }),
          el('span', { class: 'baru-nom ' + (r.tipe === 'in' ? 'hijau' : 'merah'),
            text: (r.tipe === 'in' ? '+' : '−') + UI.rp(r.nominal) }),
          UI.btn('', { ikon: 'trash', gaya: 'btn-ghost', kecil: true, title: 'Hapus lagi',
            onKlik: function () {
              S.hapus('actual', r.id).then(function () {
                baruSaja = baruSaja.filter(function (x) { return x.id !== r.id; });
                gambarBaru();
                UI.toast('Dihapus', 'sukses');
                if (opsi.onSimpan) opsi.onSimpan();
              });
            } })
        ]));
      });
    }

    function simpan(lanjut) {
      UI.bersihkanSalah(wrap);
      var nominal = UI.nilaiUang(inNominal);

      if (!inTgl.value) { UI.salahField(fTgl, 'Tanggal wajib diisi'); return false; }
      if (!nominal)     { UI.salahField(fNom, 'Nominal belum diisi'); return false; }
      if (nominal < 0)  { UI.salahField(fNom, 'Nominal tidak boleh minus — pakai tombol arah'); return false; }

      var row = {
        tanggal: inTgl.value, coa: selPos.value, tipe: arah,
        nominal: nominal, catatan: inCatatan.value.trim()
      };

      S.tambah('actual', row).then(function (tersimpan) {
        baruSaja.push(tersimpan);
        gambarBaru();
        UI.toast(UI.rpS(nominal) + ' tercatat di ' + UI.tglPendek(row.tanggal), 'sukses', {
          onUndo: function () {
            S.hapus('actual', tersimpan.id).then(function () {
              baruSaja = baruSaja.filter(function (x) { return x.id !== tersimpan.id; });
              gambarBaru();
              if (opsi.onSimpan) opsi.onSimpan();
            });
          }
        });

        if (lanjut) {                       /* siap ketik entri berikutnya */
          UI.setUang(inNominal, 0);
          inCatatan.value = '';
          inNominal._input.focus();
        }
        if (opsi.onSimpan) opsi.onSimpan();
      });
      return true;
    }

    /* Enter di mana pun dalam form = simpan & lanjut */
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        simpan(true);
      }
    });

    wrap.appendChild(el('div', { class: 'form-kas-grid' }, [
      UI.field('Arah', segArah), fTgl, fPos, fNom, fCat
    ]));

    if (!opsi.tanpaTombol) {
      wrap.appendChild(el('div', { class: 'form-kas-kaki' }, [
        UI.btn('Simpan & lanjut', { gaya: 'btn-utama', ikon: 'plus', onKlik: function () { simpan(true); } }),
        el('kbd', { class: 'kbd-hint', text: 'Enter' }),
        el('div', { class: 'spacer' }),
        el('span', { class: 'muted2', text: 'Form tetap terbuka — cocok buat input banyak baris berturut-turut' })
      ]));
    }

    wrap.appendChild(daftarBaru);
    wrap._simpan = simpan;
    return wrap;
  }

  /* Modal kas cepat — dipanggil dari command palette / tombol mana pun */
  INPUT.kasCepat = function (arah, onSelesai) {
    var form = formKas({ arah: arah || 'in', tanpaTombol: true, onSimpan: onSelesai });
    UI.modal(arah === 'out' ? 'Catat uang keluar' : 'Catat uang masuk', form, [
      { label: 'Tutup', gaya: 'btn-ghost' },
      { label: 'Simpan & lanjut', gaya: 'btn-utama', aksi: function () { return form._simpan(true) === true ? false : false; } }
    ], { sub: 'Enter untuk simpan dan lanjut ke entri berikutnya · Esc untuk tutup' });
  };

  INPUT.rabBaru = function (onSelesai) {
    if (HAL._editorRab) HAL._editorRab(null, onSelesai || function () { global.APP.render(); });
  };

  INPUT.fixedBaru = function (onSelesai) {
    if (HAL._editorRecurring) HAL._editorRecurring(null, onSelesai || function () { global.APP.render(); });
  };

  INPUT.tempel = function (onSelesai) {
    if (HAL._importTempel) HAL._importTempel(onSelesai || function () { global.APP.render(); });
  };

  /* ======================================================================
     HALAMAN: INPUT CENTER
     ====================================================================== */
  HAL.input = {
    judul: 'Input',
    sub: 'Satu pintu buat catat kas, ajukan RAB, dan set target',
    ikon: 'inbox',
    render: function (root, ulang) {

      /* sisa kas belum diisi → tampilkan formulirnya paling atas */
      if (!(Number(cfg().saldoAwal) > 0) && HAL._kartuIsiSaldo) {
        root.appendChild(HAL._kartuIsiSaldo(global.APP.filter, ulang));
      }

      /* ---------- aksi cepat ---------- */
      var aksi = [
        { ikon: 'arrowDown', warna: '#059669', bg: '#ecfdf5', judul: 'Catat uang masuk',
          teks: 'Settlement marketplace, offline, B2B, pembayaran hutang',
          onKlik: function () { INPUT.kasCepat('in', ulang); } },
        { ikon: 'arrowUp', warna: '#e11d48', bg: '#fff1f2', judul: 'Catat uang keluar',
          teks: 'Bayar supplier, iklan, operasional, gaji',
          onKlik: function () { INPUT.kasCepat('out', ulang); } },
        { ikon: 'fileText', warna: '#ea580c', bg: '#fff7ed', judul: 'Ajukan RAB',
          teks: 'Rencana pengeluaran divisi — langsung masuk forecast',
          onKlik: function () { INPUT.rabBaru(ulang); } },
        { ikon: 'upload', warna: '#2563eb', bg: '#eff6ff', judul: 'Unggah sheet',
          teks: 'Impor file .xlsx / .csv — pos otomatis dicocokkan',
          onKlik: function () { global.IMPOR.buka(ulang); } }
      ];

      var gridAksi = el('div', { class: 'grid g4' });
      aksi.forEach(function (a) {
        gridAksi.appendChild(el('button', { class: 'aksi-kartu', type: 'button', onclick: a.onKlik }, [
          el('span', { class: 'aksi-ikon', style: 'background:' + a.bg + ';color:' + a.warna }, IK(a.ikon, 19)),
          el('span', { class: 'aksi-judul', text: a.judul }),
          el('span', { class: 'aksi-teks', text: a.teks }),
          el('span', { class: 'aksi-panah' }, IK('plus', 14))
        ]));
      });
      root.appendChild(gridAksi);

      /* ---------- form kas inline ---------- */
      root.appendChild(UI.seksi('Input cepat kas',
        'Buat input banyak baris berturut-turut. Tekan Enter untuk simpan — form tetap terbuka.',
        formKas({ onSimpan: function () { perbaruiRingkas(); } }),
        el('div', { class: 'baris' }, [
          UI.btn('Unggah file', { kecil: true, ikon: 'upload', onKlik: function () { global.IMPOR.buka(ulang); } }),
          UI.btn('Tempel dari sheet', { kecil: true, ikon: 'copy', onKlik: function () { INPUT.tempel(ulang); } })
        ])
      ));

      /* ---------- ringkasan cepat ---------- */
      var ringkasWrap = el('div', { class: 'grid g4' });
      function perbaruiRingkas() {
        UI.kosongkan(ringkasWrap);
        var cut = E.cutoffAktual(d());
        var saldo = cut ? E.saldoAktualPada(d(), cfg(), cut) : cfg().saldoAwal;
        var bulan = global.APP.hariIni.slice(0, 7);
        var masuk = 0, keluar = 0, jml = 0;
        d().actual.forEach(function (a) {
          if (String(a.tanggal).slice(0, 7) !== bulan) return;
          jml++;
          if (a.tipe === 'in') masuk += a.nominal; else keluar += a.nominal;
        });
        ringkasWrap.appendChild(UI.kartuKpi({ label: 'Saldo kas terkini', ikon: 'wallet', warna: '#fff7ed', warnaIkon: '#ea580c',
          nilai: UI.rpS(saldo), sub: cut ? 'per ' + UI.tglPanjang(cut) : 'dari saldo awal' }));
        ringkasWrap.appendChild(UI.kartuKpi({ label: 'Masuk bulan ini', ikon: 'arrowDown', warna: '#ecfdf5', warnaIkon: '#059669',
          nilai: UI.rpS(masuk), sub: UI.namaBulan(bulan) }));
        ringkasWrap.appendChild(UI.kartuKpi({ label: 'Keluar bulan ini', ikon: 'arrowUp', warna: '#fff1f2', warnaIkon: '#e11d48',
          nilai: UI.rpS(keluar), sub: UI.namaBulan(bulan) }));
        ringkasWrap.appendChild(UI.kartuKpi({ label: 'Transaksi tercatat', ikon: 'card', warna: '#eff6ff', warnaIkon: '#2563eb',
          nilai: String(jml), sub: 'baris di ' + UI.namaBulan(bulan) }));
      }
      perbaruiRingkas();
      root.appendChild(ringkasWrap);

      /* ---------- kelengkapan data ---------- */
      root.appendChild(kelengkapan(ulang));
    }
  };

  /* Checklist: apa yang masih kosong dan siapa yang perlu ditagih.
     Ini yang bikin finance nggak perlu nebak data mana yang belum masuk. */
  function kelengkapan(ulang) {
    var hariIni = global.APP.hariIni;
    var bulanIni = hariIni.slice(0, 7);
    var bulanDepan = E.bulanKey(E.tambahHari(bulanIni + '-01', 32));
    var item = [];

    /* 1. target GMV yang belum diisi manual */
    var bulanTanpaTarget = [];
    var b = bulanIni, i;
    for (i = 0; i < 6; i++) {
      var ada = d().targetBulanan.some(function (t) { return t.bulan === b; });
      if (!ada) bulanTanpaTarget.push(b);
      b = E.bulanKey(E.tambahHari(b + '-01', 32));
    }
    if (bulanTanpaTarget.length) {
      item.push({
        jenis: 'warn', ikon: 'target',
        judul: bulanTanpaTarget.length + ' bulan belum punya target per channel',
        teks: bulanTanpaTarget.map(UI.namaBulanPendek).join(' · ') +
              ' — sementara dipakai porsi default dari target master, jadi proyeksi penerimaan masih kasar.',
        aksi: { label: 'Isi target', onKlik: function () { global.APP.buka('target'); } }
      });
    }

    /* 2. divisi yang belum submit RAB bulan depan */
    var sudah = {};
    d().rab.forEach(function (r) {
      if (String(r.bulan || r.tanggalRencana).slice(0, 7) === bulanDepan && r.status !== 'batal') sudah[r.divisi] = true;
    });
    var belum = CFG.DIVISI.filter(function (x) { return !sudah[x]; });
    if (belum.length === CFG.DIVISI.length) {
      item.push({
        jenis: 'warn', ikon: 'fileText',
        judul: 'Belum ada RAB untuk ' + UI.namaBulan(bulanDepan),
        teks: 'Belum satu divisi pun mengajukan. Proyeksi pengeluaran bulan itu cuma dari fixed cost + baseline.',
        aksi: { label: 'Buat RAB', onKlik: function () { INPUT.rabBaru(ulang); } }
      });
    } else if (belum.length) {
      item.push({
        jenis: 'info', ikon: 'users',
        judul: belum.length + ' divisi belum submit RAB ' + UI.namaBulanPendek(bulanDepan),
        teks: belum.join(' · '),
        aksi: { label: 'Lihat RAB', onKlik: function () { global.APP.buka('rab'); } }
      });
    }

    /* 3. hari bulan berjalan yang belum ada catatan kas */
    var adaTgl = {};
    d().actual.forEach(function (a) { adaTgl[String(a.tanggal).slice(0, 10)] = true; });
    var bolong = [];
    var tgls = E.tanggalBulan(bulanIni);
    for (i = 0; i < tgls.length; i++) {
      if (tgls[i] > hariIni) break;
      if (!adaTgl[tgls[i]]) bolong.push(tgls[i]);
    }
    if (bolong.length) {
      item.push({
        jenis: 'warn', ikon: 'calendar',
        judul: bolong.length + ' hari bulan ini belum ada catatan kas',
        teks: bolong.slice(0, 10).map(UI.tglPendek).join(' · ') + (bolong.length > 10 ? ' … +' + (bolong.length - 10) : '') +
              ' — saldo terkini jadi tidak akurat kalau hari-hari ini benar ada mutasi.',
        aksi: { label: 'Tempel dari sheet', onKlik: function () { INPUT.tempel(ulang); } }
      });
    }

    /* 4. saldo awal belum diisi */
    if (!cfg().saldoAwal) {
      item.unshift({
        jenis: 'bahaya', ikon: 'wallet',
        judul: 'Saldo kas awal masih kosong',
        teks: 'Semua proyeksi saldo dihitung dari titik ini. Selama nol, angka saldo di dashboard tidak berarti.',
        aksi: { label: 'Isi sekarang', onKlik: function () { global.APP.buka('setting'); } }
      });
    }

    var isi = el('div', { class: 'cek-list' });
    if (!item.length) {
      isi.appendChild(UI.kosong({
        ikon: 'shield', judul: 'Data sudah lengkap',
        pesan: 'Target terisi, RAB bulan depan sudah masuk, dan catatan kas tidak bolong. Proyeksi bisa dipercaya.'
      }));
    } else {
      item.forEach(function (it) {
        isi.appendChild(el('div', { class: 'cek-item cek-' + it.jenis }, [
          el('span', { class: 'cek-ikon' }, IK(it.ikon, 16)),
          el('div', { class: 'cek-isi' }, [
            el('div', { class: 'cek-judul', text: it.judul }),
            el('p', { class: 'cek-teks', text: it.teks })
          ]),
          it.aksi ? UI.btn(it.aksi.label, { kecil: true, onKlik: it.aksi.onKlik }) : null
        ]));
      });
    }

    return UI.seksi('Kelengkapan data',
      'Apa yang masih kosong sebelum proyeksi bisa dipakai buat ambil keputusan.', isi);
  }

  INPUT.formKas = formKas;
})(window);
