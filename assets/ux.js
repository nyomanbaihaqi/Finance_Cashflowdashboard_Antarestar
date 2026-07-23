/* ============================================================================
   ANTARESTAR — CASHFLOW PROJECTION
   ux.js — command palette (Ctrl/Cmd+K) + pintasan keyboard global
   ========================================================================== */
(function (global) {
  'use strict';

  var UI = global.UI, CFG = global.CFG, IK = global.IK;
  var el = UI.el;
  var terbuka = null;

  var macOS = /Mac|iPod|iPhone|iPad/.test(navigator.platform || '');
  var MOD = macOS ? '⌘' : 'Ctrl';

  /* Daftar perintah dibangun ulang tiap kali dibuka supaya label & state segar. */
  function daftarPerintah() {
    var APP = global.APP, HAL = global.HAL, INPUT = global.INPUT, S = global.STORE;
    var out = [];

    /* --- input (paling sering dipakai → ditaruh paling atas) --- */
    out.push({ grup: 'Input', ikon: 'arrowDown', label: 'Catat uang masuk',
      kata: 'kas masuk penerimaan settlement terima',
      jalan: function () { INPUT.kasCepat('in', function () { APP.render(); }); } });
    out.push({ grup: 'Input', ikon: 'arrowUp', label: 'Catat uang keluar',
      kata: 'kas keluar bayar pengeluaran',
      jalan: function () { INPUT.kasCepat('out', function () { APP.render(); }); } });
    out.push({ grup: 'Input', ikon: 'fileText', label: 'Buat RAB baru',
      kata: 'rab anggaran pengajuan divisi budget',
      jalan: function () { INPUT.rabBaru(function () { APP.render(); }); } });
    out.push({ grup: 'Input', ikon: 'repeat', label: 'Tambah fixed cost',
      kata: 'recurring rutin gaji sewa cicilan',
      jalan: function () { INPUT.fixedBaru(function () { APP.render(); }); } });
    out.push({ grup: 'Input', ikon: 'upload', label: 'Unggah file Excel / CSV',
      kata: 'impor import unggah upload xlsx excel csv sheet file massal',
      jalan: function () { global.IMPOR.buka(function () { APP.render(); }); } });
    out.push({ grup: 'Input', ikon: 'copy', label: 'Tempel data dari sheet',
      kata: 'paste tempel salin massal',
      jalan: function () { INPUT.tempel(function () { APP.render(); }); } });

    /* --- pindah halaman --- */
    (global.MENU_HAL || []).forEach(function (m) {
      out.push({ grup: 'Buka halaman', ikon: m.ik, label: m.label, kata: m.kata || '',
        aktif: APP.hal === m.id,
        jalan: function () { APP.buka(m.id); } });
    });

    /* --- skenario --- */
    CFG.SKENARIO.forEach(function (sk) {
      out.push({ grup: 'Skenario', ikon: 'trending', label: 'Skenario: ' + sk.nama,
        kata: 'skenario ganti ' + sk.nama, aktif: APP.filter.skenario === sk.id,
        jalan: function () {
          APP.filter.skenario = sk.id;
          S.simpanConfig({ skenarioAktif: sk.id });
          APP.render();
          UI.toast('Skenario ' + sk.nama, 'info');
        } });
    });

    /* --- lain-lain --- */
    out.push({ grup: 'Lainnya', ikon: 'sheet', label: 'Buka Google Sheet', kata: 'spreadsheet sheet data',
      jalan: function () { global.open(CFG.CONN.SHEET_URL, '_blank', 'noopener'); } });
    out.push({ grup: 'Lainnya', ikon: 'download', label: 'Unduh backup JSON', kata: 'backup ekspor export simpan',
      jalan: function () {
        var blob = new Blob([JSON.stringify(S.data(), null, 2)], { type: 'application/json' });
        var a = el('a', { href: URL.createObjectURL(blob), download: 'antarestar-cashflow-' + APP.hariIni + '.json' });
        document.body.appendChild(a); a.click(); a.remove();
        UI.toast('Backup terunduh', 'sukses');
      } });
    out.push({ grup: 'Lainnya', ikon: 'refresh', label: 'Muat ulang data', kata: 'refresh reload sinkron sync',
      jalan: function () { S.muat().then(function () { APP.render(); UI.toast('Data dimuat ulang', 'sukses'); }); } });

    return out;
  }

  /* Pencocokan berurutan: "ktm" cocok dengan "Catat uang masuk".
     Nilai lebih tinggi = lebih relevan (huruf berdekatan & di awal kata). */
  function skor(teks, kunci) {
    if (!kunci) return 1;
    teks = teks.toLowerCase();
    if (teks.indexOf(kunci) >= 0) return 1000 - teks.indexOf(kunci);

    var ti = 0, ki = 0, nilai = 0, terakhir = -2;
    while (ti < teks.length && ki < kunci.length) {
      if (teks.charAt(ti) === kunci.charAt(ki)) {
        nilai += (ti === terakhir + 1) ? 5 : 1;
        if (ti === 0 || teks.charAt(ti - 1) === ' ') nilai += 3;
        terakhir = ti; ki++;
      }
      ti++;
    }
    return ki === kunci.length ? nilai : 0;
  }

  /* ---------------------------------------------------------- palette */
  function bukaPalette() {
    if (terbuka) return;

    var semua = daftarPerintah();
    var hasil = semua.slice();
    var sorot = 0;

    var inp = el('input', {
      class: 'cp-inp', type: 'text', placeholder: 'Ketik perintah atau nama halaman…',
      autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Cari perintah'
    });
    var daftar = el('div', { class: 'cp-daftar', role: 'listbox' });

    function gambar() {
      UI.kosongkan(daftar);
      if (!hasil.length) {
        daftar.appendChild(el('div', { class: 'cp-kosong' }, [
          IK('search', 22), el('span', { text: 'Tidak ada perintah yang cocok' })
        ]));
        return;
      }
      var grupTerakhir = '';
      hasil.forEach(function (c, i) {
        if (c.grup !== grupTerakhir) {
          grupTerakhir = c.grup;
          daftar.appendChild(el('div', { class: 'cp-grup', text: c.grup }));
        }
        var baris = el('button', {
          class: 'cp-item' + (i === sorot ? ' sorot' : ''), type: 'button', role: 'option',
          'aria-selected': i === sorot, 'data-i': i,
          onclick: function () { jalankan(i); },
          onmousemove: function () { if (sorot !== i) { sorot = i; tandai(); } }
        }, [
          el('span', { class: 'cp-ikon' }, IK(c.ikon, 15)),
          el('span', { class: 'cp-label', text: c.label }),
          c.aktif ? el('span', { class: 'cp-aktif', text: 'aktif' }) : null,
          el('span', { class: 'cp-enter' }, IK('check', 13))
        ]);
        daftar.appendChild(baris);
      });
    }

    function tandai() {
      UI.qa('.cp-item', daftar).forEach(function (n) {
        var i = +n.dataset.i;
        n.classList.toggle('sorot', i === sorot);
        n.setAttribute('aria-selected', i === sorot);
        if (i === sorot) {
          var r = n.getBoundingClientRect(), p = daftar.getBoundingClientRect();
          if (r.bottom > p.bottom) daftar.scrollTop += r.bottom - p.bottom + 4;
          if (r.top < p.top) daftar.scrollTop -= p.top - r.top + 4;
        }
      });
    }

    function saring() {
      var k = inp.value.toLowerCase().trim();
      hasil = semua
        .map(function (c) { return { c: c, s: Math.max(skor(c.label, k), skor(c.kata || '', k) * 0.8) }; })
        .filter(function (x) { return x.s > 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .map(function (x) { return x.c; });
      sorot = 0;
      gambar();
    }

    function jalankan(i) {
      var c = hasil[i];
      if (!c) return;
      tutup();
      setTimeout(function () { c.jalan(); }, 30);
    }

    inp.addEventListener('input', saring);

    var box = el('div', { class: 'cp-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Perintah cepat' }, [
      el('div', { class: 'cp-head' }, [IK('search', 17, 'ik-cp'), inp, el('kbd', { class: 'kbd', text: 'Esc' })]),
      daftar,
      el('div', { class: 'cp-kaki' }, [
        el('span', null, [el('kbd', { class: 'kbd', text: '↑↓' }), el('span', { text: 'pilih' })]),
        el('span', null, [el('kbd', { class: 'kbd', text: '↵' }), el('span', { text: 'jalankan' })]),
        el('span', null, [el('kbd', { class: 'kbd', text: MOD + ' K' }), el('span', { text: 'buka lagi' })])
      ])
    ]);

    var bg = el('div', { class: 'cp-bg', onclick: function (e) { if (e.target === bg) tutup(); } }, box);
    document.body.appendChild(bg);
    document.body.classList.add('modal-buka');
    requestAnimationFrame(function () { bg.classList.add('tampil'); });
    setTimeout(function () { bg.classList.add('tampil'); inp.focus(); }, 30);

    gambar();

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); tutup(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); sorot = Math.min(sorot + 1, hasil.length - 1); tandai(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sorot = Math.max(sorot - 1, 0); tandai(); }
      else if (e.key === 'Enter') { e.preventDefault(); jalankan(sorot); }
    }
    bg.addEventListener('keydown', onKey);

    function tutup() {
      bg.classList.remove('tampil');
      document.body.classList.remove('modal-buka');
      setTimeout(function () { bg.remove(); }, 160);
      terbuka = null;
    }

    terbuka = { tutup: tutup };
  }

  /* ------------------------------------------------- pintasan global */
  function pasang() {
    document.addEventListener('keydown', function (e) {
      var mod = macOS ? e.metaKey : e.ctrlKey;

      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        terbuka ? terbuka.tutup() : bukaPalette();
        return;
      }

      /* pintasan huruf tunggal hanya saat tidak sedang mengetik */
      var t = e.target.tagName;
      var ngetik = t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || e.target.isContentEditable;
      if (ngetik || e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === '?') { e.preventDefault(); bantuanPintasan(); }
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); global.INPUT.kasCepat('in', function () { global.APP.render(); }); }
    });
  }

  function bantuanPintasan() {
    var baris = [
      [MOD + ' K', 'Buka perintah cepat — semua aksi ada di sini'],
      ['N', 'Catat uang masuk'],
      ['?', 'Tampilkan bantuan ini'],
      ['Esc', 'Tutup dialog / perintah cepat'],
      ['Enter', 'Simpan form yang sedang dibuka'],
      ['Tab', 'Pindah antar isian (fokus terkunci di dalam dialog)']
    ];
    var isi = el('div', { class: 'kbd-list' });
    baris.forEach(function (b) {
      isi.appendChild(el('div', { class: 'kbd-baris' }, [
        el('kbd', { class: 'kbd', text: b[0] }),
        el('span', { text: b[1] })
      ]));
    });
    UI.modal('Pintasan keyboard', isi, [{ label: 'Tutup', gaya: 'btn-utama' }], { lebar: 'kecil' });
  }

  global.UX = { bukaPalette: bukaPalette, pasang: pasang, bantuan: bantuanPintasan, MOD: MOD };
})(window);
