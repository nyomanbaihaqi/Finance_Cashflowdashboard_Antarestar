/* ============================================================================
   ANTARESTAR — CASHFLOW PROJECTION
   app.js — bootstrap, sidebar, topbar, router
   ========================================================================== */
(function (global) {
  'use strict';

  var UI = global.UI, CFG = global.CFG, E = global.ENGINE, S = global.STORE, HAL = global.HAL, IK = global.IK;
  var el = UI.el;

  /* Dipakai juga oleh command palette */
  var MENU_HAL = global.MENU_HAL = [
    { id: 'proyeksi', ik: 'trending', label: 'Proyeksi Kas',      grup: 'Monitoring', kata: 'dashboard grafik saldo forecast' },
    { id: 'harian',   ik: 'grid',     label: 'Cashflow Harian',   grup: 'Monitoring', kata: 'tabel matrix hari per hari rekap day by day pos' },
    { id: 'kalender', ik: 'calendar', label: 'Kalender Kas',      grup: 'Monitoring', kata: 'bulanan tanggal harian' },
    { id: 'simulasi', ik: 'flask',    label: 'Simulasi What-if',  grup: 'Monitoring', kata: 'what if uji coba pajak skenario' },
    { id: 'input',    ik: 'inbox',    label: 'Input',             grup: 'Input',      kata: 'catat entry tambah baru' },
    { id: 'rab',      ik: 'fileText', label: 'RAB',               grup: 'Input',      kata: 'anggaran divisi pengajuan budget' },
    { id: 'target',   ik: 'target',   label: 'Target Digicom',    grup: 'Input',      kata: 'gmv omset channel marketplace penerimaan' },
    { id: 'rencana',  ik: 'grid',     label: 'Rencana Pengeluaran', grup: 'Input',    kata: 'pengeluaran plot budget anggaran keluar per kategori bulanan' },
    { id: 'fixed',    ik: 'repeat',   label: 'Pengeluaran Rutin', grup: 'Input',      kata: 'fixed cost baseline gaji sewa variabel' },
    { id: 'aktual',   ik: 'card',     label: 'Aktual Harian',     grup: 'Input',      kata: 'realisasi mutasi transaksi' },
    { id: 'setting',  ik: 'settings', label: 'Pengaturan',        grup: 'Sistem',     kata: 'setting saldo awal ambang kurs lag' }
  ];

  var APP = global.APP = {
    hal: 'proyeksi',
    hariIni: E.toKey(new Date()),
    filter: { dari: '', sampai: '', horizon: 1, skenario: 'moderate', whatIf: [] },
    rabFilter: { bulan: '', divisi: '', status: '' },
    targetTahun: 2026,
    aktualBulan: ''
  };

  /* Terapkan config tersimpan ke objek master di CFG */
  function terapkanConfig() {
    var c = S.data().config || {};
    if (Array.isArray(c.coaTambahan)) CFG.terapkanCoaTambahan(c.coaTambahan);
    if (c.skenarioAktif) APP.filter.skenario = c.skenarioAktif;
    if (c.pola) { for (var k in c.pola) if (CFG.POLA.hasOwnProperty(k)) CFG.POLA[k] = Number(c.pola[k]) || CFG.POLA[k]; }
    if (Array.isArray(c.channelOverride)) {
      c.channelOverride.forEach(function (o) {
        var ch = CFG.channel(o.id);
        if (!ch) return;
        if (o.lag !== undefined && o.lag !== null && o.lag !== '') ch.lag = Number(o.lag);
        if (o.netto !== undefined && o.netto !== null && o.netto !== '') ch.netto = Number(o.netto);
      });
    }
  }

  /* ------------------------------------------------------------ sidebar */
  function gambarSidebar() {
    var nav = el('nav', { class: 'sb-nav', 'aria-label': 'Navigasi utama' });
    var grupTerakhir = '';

    MENU_HAL.forEach(function (m) {
      if (m.grup !== grupTerakhir) {
        grupTerakhir = m.grup;
        nav.appendChild(el('div', { class: 'sb-grup', text: m.grup }));
      }
      var aktif = APP.hal === m.id;
      nav.appendChild(el('button', {
        class: 'sb-item' + (aktif ? ' aktif' : ''),
        'data-hal': m.id, type: 'button',
        'aria-current': aktif ? 'page' : null,
        onclick: function () { buka(m.id); }
      }, [
        el('span', { class: 'sb-ik' }, IK(m.ik, 17)),
        el('span', { class: 'sb-teks', text: m.label })
      ]));
    });

    var mode = S.mode();
    var labelMode = { sheet: 'Tersambung ke Sheet', lokal: 'Data lokal (browser)', demo: 'Mode demo' }[mode];

    return el('aside', { class: 'sidebar' }, [
      el('div', { class: 'sb-brand' }, [
        el('div', { class: 'sb-logo' }, IK('trending', 17)),
        el('div', null, [
          el('div', { class: 'nm', text: 'ANTARESTAR' }),
          el('div', { class: 'sub', text: 'Cashflow Projection' })
        ])
      ]),
      nav,
      el('div', { class: 'sb-kaki' }, [
        el('button', {
          class: 'sb-mode', type: 'button', title: 'Buka pengaturan koneksi',
          onclick: function () { buka('setting'); }
        }, [
          el('span', { class: 'dot dot-' + mode }),
          el('span', { text: labelMode })
        ]),
        el('div', { class: 'sb-tgl', text: UI.tglLengkap(APP.hariIni) })
      ])
    ]);
  }

  /* ------------------------------------------------------------- topbar */
  function gambarTopbar(hal, ulang) {
    var kanan = el('div', { class: 'topbar-aksi' });

    kanan.appendChild(el('button', {
      class: 'btn btn-cmd', type: 'button', title: 'Perintah cepat',
      onclick: function () { global.UX.bukaPalette(); }
    }, [
      IK('search', 14),
      el('span', { class: 'cmd-teks', text: 'Perintah' }),
      el('kbd', { class: 'kbd', text: global.UX.MOD + ' K' })
    ]));

    kanan.appendChild(el('span', { class: 'sync-dot', id: 'sync-badge' }));

    if (hal.aksiUtama) {
      var a = hal.aksiUtama;
      kanan.appendChild(UI.btn(a.label, { gaya: 'btn-utama', ikon: a.ikon, onKlik: function () { a.onKlik(ulang); } }));
    }

    kanan.appendChild(el('a', {
      class: 'btn btn-ikon', href: CFG.CONN.SHEET_URL, target: '_blank', rel: 'noopener',
      title: 'Buka Google Sheet', 'aria-label': 'Buka Google Sheet'
    }, IK('sheet', 15)));

    return el('header', { class: 'topbar' }, [
      el('div', { class: 'judul-hal' }, [
        el('h1', { text: hal.judul }),
        hal.sub ? el('div', { class: 'sub', text: hal.sub }) : null
      ]),
      kanan
    ]);
  }

  /* ------------------------------------------------------------- render */
  function buka(id) {
    if (!HAL[id]) return;
    APP.hal = id;
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* file:// */ }
    render();
    var isi = UI.q('.isi');
    if (isi) isi.scrollTop = 0;
    global.scrollTo(0, 0);
  }

  function render() {
    var hal = HAL[APP.hal] || HAL.proyeksi;
    var app = UI.q('#app');
    UI.kosongkan(app);

    app.appendChild(gambarSidebar());

    var isi = el('div', { class: 'isi' });
    var utama = el('main', { class: 'utama' }, [gambarTopbar(hal, render), isi]);
    app.appendChild(utama);

    try {
      hal.render(isi, render);
    } catch (err) {
      isi.appendChild(el('div', { class: 'alert alert-merah' }, [
        IK('alert', 17),
        el('div', { html: '<b>Gagal menampilkan halaman.</b><br>' + (err && err.message ? err.message : err) +
          '<br><span class="muted2">Detail lengkap ada di console browser.</span>' })
      ]));
      if (global.console) console.error(err);
    }
  }

  /* Indikator sinkron di topbar */
  global.addEventListener('store:sync', function (e) {
    var n = UI.q('#sync-badge');
    if (!n) return;
    UI.kosongkan(n);
    if (e.detail.syncing) {
      n.appendChild(el('span', { class: 'spin spin-kecil' }));
      n.appendChild(el('span', { text: 'menyimpan…' }));
    }
  });

  /* Gambar ulang grafik saat lebar window berubah */
  var timerResize, lebarTerakhir = global.innerWidth;
  global.addEventListener('resize', function () {
    if (global.innerWidth === lebarTerakhir) return;
    lebarTerakhir = global.innerWidth;
    clearTimeout(timerResize);
    timerResize = setTimeout(function () {
      if (APP.hal === 'proyeksi' || APP.hal === 'simulasi' || APP.hal === 'target') render();
    }, 240);
  });

  APP.render = render;
  APP.buka = buka;

  /* --------------------------------------------------------------- init */
  function init() {
    S.muat().then(function () {
      terapkanConfig();

      var bulanIni = APP.hariIni.slice(0, 7);
      var cut = E.cutoffAktual(S.data());
      if (cut && cut.slice(0, 7) > bulanIni) bulanIni = cut.slice(0, 7);
      HAL._setPeriode(bulanIni, 1);
      APP.aktualBulan = bulanIni;

      var hash = (location.hash || '').replace('#', '');
      if (HAL[hash]) APP.hal = hash;

      var boot = UI.q('#boot');
      if (boot) boot.remove();

      global.UX.pasang();
      render();

      if (S.state.error) UI.toast('Gagal sinkron ke sheet: ' + S.state.error, 'error', { durasi: 6000 });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
