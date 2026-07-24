/* ============================================================================
   ANTARESTAR — CASHFLOW PROJECTION
   ui.js — formatter angka/tanggal + komponen (modal, tabel, form, toast)
   ========================================================================== */
(function (global) {
  'use strict';

  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
               'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  /* ------------------------------------------------------------- angka */
  function grup(n) {
    return String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function desimal(v, d) {
    var s = Number(v).toFixed(d);
    if (d > 0) s = s.replace(/\.?0+$/, '');
    return s.replace('.', ',');
  }

  function rp(n) {
    n = Number(n) || 0;
    return (n < 0 ? '-' : '') + 'Rp ' + grup(n);
  }

  /* Rp 2,46 M · Rp 371,1 Jt · Rp 850 Rb */
  function rpS(n) {
    n = Number(n) || 0;
    var neg = n < 0 ? '-' : '', a = Math.abs(n);
    if (a >= 1e12) return neg + 'Rp ' + desimal(a / 1e12, 2) + ' T';
    if (a >= 1e9)  return neg + 'Rp ' + desimal(a / 1e9, 2) + ' M';
    if (a >= 1e6)  return neg + 'Rp ' + desimal(a / 1e6, 1) + ' Jt';
    if (a >= 1e3)  return neg + 'Rp ' + desimal(a / 1e3, 0) + ' Rb';
    return neg + 'Rp ' + Math.round(a);
  }

  function angkaS(n) {
    n = Number(n) || 0;
    var neg = n < 0 ? '-' : '', a = Math.abs(n);
    if (a >= 1e12) return neg + desimal(a / 1e12, 2) + ' T';
    if (a >= 1e9)  return neg + desimal(a / 1e9, 2) + ' M';
    if (a >= 1e6)  return neg + desimal(a / 1e6, 1) + ' Jt';
    if (a >= 1e3)  return neg + desimal(a / 1e3, 0) + ' Rb';
    return neg + String(Math.round(a));
  }

  function persen(v, d) {
    if (!isFinite(v)) return '—';
    return desimal(Number(v) || 0, d === undefined ? 1 : d) + '%';
  }

  /* --------------------------------------------------------- input uang
     Menerima singkatan supaya nggak perlu ngetik nol banyak:
       500jt · 1,5m · 2.75jt · 250rb · 300k · 1,2t · atau angka biasa
     M = miliar (bukan million), sesuai kebiasaan finance Indonesia.        */
  var SUFIKS = { t: 1e12, m: 1e9, jt: 1e6, j: 1e6, rb: 1e3, r: 1e3, k: 1e3 };

  function parseUang(s) {
    if (typeof s === 'number') return Math.round(s);
    var t = String(s === null || s === undefined ? '' : s).trim().toLowerCase();
    if (!t) return 0;

    var neg = /^\(.*\)$/.test(t) || t.charAt(0) === '-';
    t = t.replace(/[()\s]/g, '').replace(/^-/, '').replace(/rp\.?/g, '');

    var m = t.match(/^([\d.,]+)(t|jt|j|m|rb|r|k)$/);
    if (m) {
      /* ada sufiks → pemisah apa pun dianggap desimal ("1,5m" = "1.5m") */
      var angka = parseFloat(m[1].replace(/,/g, '.')) || 0;
      var hasil = Math.round(angka * SUFIKS[m[2]]);
      return neg ? -hasil : hasil;
    }

    /* tanpa sufiks → pemisah dianggap ribuan, kecuali 1–2 digit terakhir */
    var koma = t.lastIndexOf(','), titik = t.lastIndexOf('.');
    var idx = Math.max(koma, titik), utuh = t, pecahan = '';
    if (idx > -1 && t.length - idx - 1 > 0 && t.length - idx - 1 <= 2) {
      utuh = t.slice(0, idx); pecahan = t.slice(idx + 1);
    }
    utuh = utuh.replace(/[^0-9]/g, '');
    var n = parseFloat(utuh + (pecahan ? '.' + pecahan : '')) || 0;
    return neg ? -Math.round(n) : Math.round(n);
  }

  /* ---------------------------------------------------------- tanggal */
  function pecah(k) {
    var p = String(k).slice(0, 10).split('-');
    return { th: +p[0], bl: +p[1], tg: +p[2] };
  }
  function tglPendek(k) { var p = pecah(k); return p.tg + ' ' + BULAN_PENDEK[p.bl - 1]; }
  function tglPanjang(k) { var p = pecah(k); return p.tg + ' ' + BULAN[p.bl - 1] + ' ' + p.th; }
  function tglLengkap(k) {
    var d = new Date(String(k).slice(0, 10) + 'T00:00:00');
    return HARI[d.getDay()] + ', ' + tglPanjang(k);
  }
  function namaBulan(b) { var p = String(b).split('-'); return BULAN[+p[1] - 1] + ' ' + p[0]; }
  function namaBulanPendek(b) { var p = String(b).split('-'); return BULAN_PENDEK[+p[1] - 1] + ' ' + String(p[0]).slice(2); }

  /* Jarak dari hari ini: "3 hari lagi" / "kemarin" */
  function relatif(k, hariIni) {
    var a = new Date(String(k).slice(0, 10) + 'T00:00:00');
    var b = new Date(String(hariIni).slice(0, 10) + 'T00:00:00');
    var d = Math.round((a - b) / 86400000);
    if (d === 0) return 'hari ini';
    if (d === 1) return 'besok';
    if (d === -1) return 'kemarin';
    return d > 0 ? d + ' hari lagi' : Math.abs(d) + ' hari lalu';
  }

  /* ------------------------------------------------------------- DOM */
  function el(tag, attrs, anak) {
    var n = document.createElement(tag), k;
    if (attrs) for (k in attrs) {
      if (!attrs.hasOwnProperty(k)) continue;
      if (attrs[k] === null || attrs[k] === undefined) continue;
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    if (anak) (Array.isArray(anak) ? anak : [anak]).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  function q(s, r) { return (r || document).querySelector(s); }
  function qa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function kosongkan(n) { while (n && n.firstChild) n.removeChild(n.firstChild); return n; }

  /* Tombol dengan ikon */
  function btn(label, opsi) {
    opsi = opsi || {};
    var isi = [];
    if (opsi.ikon) isi.push(global.IK(opsi.ikon, opsi.ikonUkuran || 15));
    if (label) isi.push(el('span', { text: label }));
    return el('button', {
      class: 'btn ' + (opsi.gaya || '') + (opsi.kecil ? ' btn-kecil' : '') + (label ? '' : ' btn-ikon'),
      type: 'button',
      title: opsi.title || (label ? null : opsi.ikon),
      'aria-label': opsi.ariaLabel || (label ? null : opsi.title),
      disabled: opsi.nonaktif ? 'disabled' : null,
      onclick: opsi.onKlik || null
    }, isi);
  }

  /* --------------------------------------------------------- feedback */
  function wadahToast() {
    var w = q('#toast-wrap');
    if (!w) { w = el('div', { id: 'toast-wrap', class: 'toast-wrap', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(w); }
    return w;
  }

  function toast(pesan, jenis, opsi) {
    opsi = opsi || {};
    var ikon = { sukses: 'check', error: 'alert', warn: 'alert', info: 'info' }[jenis || 'info'];
    var t = el('div', { class: 'toast toast-' + (jenis || 'info') }, [
      global.IK(ikon, 16),
      el('span', { class: 'toast-teks', text: pesan })
    ]);

    var durasi = opsi.durasi || 3000;
    if (opsi.onUndo) {
      durasi = opsi.durasi || 7000;
      t.appendChild(el('button', {
        class: 'toast-undo', type: 'button',
        onclick: function () { opsi.onUndo(); tutup(); }
      }, [global.IK('undo', 14), el('span', { text: 'Urungkan' })]));
    }

    wadahToast().appendChild(t);
    var timer = setTimeout(tutup, durasi);
    function tutup() {
      clearTimeout(timer);
      t.classList.add('keluar');
      setTimeout(function () { t.remove(); }, 240);
    }
    return { tutup: tutup };
  }

  /* Hapus dengan jendela undo — data baru benar-benar dibuang setelah toast habis. */
  function hapusDenganUndo(pesan, lakukan, urungkan) {
    lakukan();
    toast(pesan, 'sukses', { onUndo: urungkan });
  }

  /* ------------------------------------------------------------ modal */
  var tumpukanModal = [];

  function modal(judul, isi, aksi, opsi) {
    opsi = opsi || {};
    var body = el('div', { class: 'modal-body' });
    if (typeof isi === 'string') body.innerHTML = isi; else body.appendChild(isi);

    var footer = el('div', { class: 'modal-footer' });
    var tombolUtama = null;
    (aksi || []).forEach(function (a) {
      var b = el('button', {
        class: 'btn ' + (a.gaya || 'btn-ghost'), type: 'button', text: a.label,
        onclick: function () { if (!a.aksi || a.aksi() !== false) tutup(); }
      });
      if ((a.gaya || '').indexOf('btn-utama') >= 0 || (a.gaya || '').indexOf('btn-danger') >= 0) tombolUtama = b;
      footer.appendChild(b);
    });

    var box = el('div', {
      class: 'modal-box' + (opsi.lebar ? ' modal-' + opsi.lebar : ''),
      role: 'dialog', 'aria-modal': 'true', 'aria-label': judul
    }, [
      el('div', { class: 'modal-head' }, [
        el('div', null, [
          el('h3', { text: judul }),
          opsi.sub ? el('p', { class: 'muted', text: opsi.sub }) : null
        ]),
        btn('', { ikon: 'x', gaya: 'btn-ghost', title: 'Tutup (Esc)', onKlik: function () { tutup(); } })
      ]),
      body,
      (aksi && aksi.length) ? footer : null
    ]);

    var bg = el('div', { class: 'modal-bg', onclick: function (e) { if (e.target === bg) tutup(); } }, box);
    document.body.appendChild(bg);
    document.body.classList.add('modal-buka');
    requestAnimationFrame(function () { bg.classList.add('tampil'); });
    setTimeout(function () { bg.classList.add('tampil'); }, 30);   // jaga-jaga rAF di-throttle

    var fokusSebelum = document.activeElement;

    /* fokus otomatis ke isian pertama */
    setTimeout(function () {
      var f = box.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
      if (f) { f.focus(); if (f.select) try { f.select(); } catch (e) { /* type=date */ } }
      else if (tombolUtama) tombolUtama.focus();
    }, 60);

    function fokusable() {
      return qa('button, [href], input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])', box)
        .filter(function (n) { return !n.disabled && n.offsetParent !== null; });
    }

    function onKey(e) {
      if (tumpukanModal[tumpukanModal.length - 1] !== ref) return;

      if (e.key === 'Escape') { e.preventDefault(); tutup(); return; }

      if (e.key === 'Enter' && tombolUtama) {
        var t = e.target.tagName;
        if (t !== 'TEXTAREA' && t !== 'BUTTON' && !e.shiftKey) { e.preventDefault(); tombolUtama.click(); }
        return;
      }

      if (e.key === 'Tab') {           /* kurung fokus di dalam modal */
        var f = fokusable();
        if (!f.length) return;
        var pertama = f[0], terakhir = f[f.length - 1];
        if (e.shiftKey && document.activeElement === pertama) { e.preventDefault(); terakhir.focus(); }
        else if (!e.shiftKey && document.activeElement === terakhir) { e.preventDefault(); pertama.focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);

    function tutup() {
      document.removeEventListener('keydown', onKey, true);
      tumpukanModal = tumpukanModal.filter(function (x) { return x !== ref; });
      if (!tumpukanModal.length) document.body.classList.remove('modal-buka');
      bg.classList.remove('tampil');
      setTimeout(function () { bg.remove(); }, 200);
      if (fokusSebelum && fokusSebelum.focus) try { fokusSebelum.focus(); } catch (e) { /* noop */ }
    }

    var ref = { tutup: tutup, body: body, box: box };
    tumpukanModal.push(ref);
    return ref;
  }

  function konfirmasi(judul, pesan, onYa, opsi) {
    opsi = opsi || {};
    modal(judul, el('p', { class: 'modal-pesan', text: pesan }), [
      { label: 'Batal', gaya: 'btn-ghost' },
      { label: opsi.labelYa || 'Ya, lanjut', gaya: opsi.aman ? 'btn-utama' : 'btn-danger', aksi: onYa }
    ], { lebar: 'kecil' });
  }

  /* -------------------------------------------------------- komponen */
  /* o.spark : node SVG tren mini (opsional) ditaruh di kanan bawah kartu */
  function kartuKpi(o) {
    return el('div', { class: 'kpi' + (o.onKlik ? ' kpi-klik' : ''), onclick: o.onKlik || null }, [
      el('div', { class: 'kpi-head' }, [
        el('span', { class: 'kpi-label', text: o.label }),
        o.ikon ? el('span', { class: 'kpi-ikon', style: 'background:' + (o.warna || '#f1f5f9') + ';color:' + (o.warnaIkon || '#64748b') },
          global.IK(o.ikon, 15)) : null
      ]),
      el('div', { class: 'kpi-nilai', text: o.nilai }),
      el('div', { class: 'kpi-kaki' }, [
        o.sub ? el('div', { class: 'kpi-sub ' + (o.subKelas || ''), html: o.sub }) : el('span'),
        o.spark ? el('div', { class: 'kpi-spark' }, o.spark) : null
      ])
    ]);
  }

  function badge(teks, jenis) {
    return el('span', { class: 'badge badge-' + (jenis || 'abu'), text: teks });
  }

  /* Empty state — selalu dengan jalan keluar, bukan cuma "belum ada data" */
  function kosong(o) {
    return el('div', { class: 'empty' }, [
      el('div', { class: 'empty-ikon' }, global.IK(o.ikon || 'inbox', 26)),
      el('div', { class: 'empty-judul', text: o.judul || 'Belum ada data' }),
      o.pesan ? el('p', { class: 'empty-pesan', text: o.pesan }) : null,
      o.aksi ? btn(o.aksi.label, { gaya: 'btn-utama', ikon: o.aksi.ikon || 'plus', onKlik: o.aksi.onKlik }) : null
    ]);
  }

  /* Tabel. opsi:
       kosong      : string | {judul,pesan,ikon,aksi}
       cari        : true → tampilkan kotak pencarian
       cariPlaceholder
       onKlikBaris : fn(row, i)
       kelasBaris  : fn(row) → string
       maks        : batasi jumlah baris tampil + tombol "tampilkan semua"  */
  function tabel(kolom, baris, opsi) {
    opsi = opsi || {};
    var wrap = el('div', { class: 'tabel-blok' });
    var tbody = el('tbody');
    var batas = opsi.maks || 0;
    var kunci = '';

    var thead = el('thead', null, el('tr', null, kolom.map(function (k) {
      return el('th', { class: k.kelas || '', style: k.lebar ? 'width:' + k.lebar : null, text: k.judul });
    })));

    if (opsi.cari) {
      var cariInp = el('input', {
        class: 'inp inp-cari', type: 'search', placeholder: opsi.cariPlaceholder || 'Cari…', 'aria-label': 'Cari'
      });
      cariInp.addEventListener('input', function () { kunci = cariInp.value.toLowerCase().trim(); gambar(); });
      wrap.appendChild(el('div', { class: 'cari-wrap' }, [global.IK('search', 15, 'ik-cari'), cariInp]));
    }

    function teksBaris(r) {
      var s = [];
      kolom.forEach(function (k) {
        if (k.cari === false) return;
        var v = k.cariTeks ? k.cariTeks(r) : (k.kunci ? r[k.kunci] : null);
        if (v === null || v === undefined) {
          if (k.render) { try { var n = k.render(r, 0); s.push(typeof n === 'string' ? n : (n && n.textContent) || ''); } catch (e) { /* noop */ } }
        } else s.push(String(v));
      });
      return s.join(' ').toLowerCase();
    }

    function gambar() {
      kosongkan(tbody);
      var data = kunci ? baris.filter(function (r) { return teksBaris(r).indexOf(kunci) >= 0; }) : baris;

      if (!data.length) {
        var ko = opsi.kosong;
        var isi = (typeof ko === 'string' || !ko)
          ? el('div', { class: 'kosong-teks', text: kunci ? 'Tidak ada hasil untuk "' + kunci + '".' : (ko || 'Belum ada data.') })
          : kosong(kunci ? { ikon: 'search', judul: 'Tidak ketemu', pesan: 'Tidak ada baris yang cocok dengan "' + kunci + '".' } : ko);
        tbody.appendChild(el('tr', null, el('td', { class: 'sel-kosong', colspan: kolom.length }, isi)));
        return;
      }

      var tampil = batas ? data.slice(0, batas) : data;
      tampil.forEach(function (r, i) {
        var tr = el('tr', {
          class: (opsi.onKlikBaris ? 'klik ' : '') + (opsi.kelasBaris ? opsi.kelasBaris(r) : ''),
          tabindex: opsi.onKlikBaris ? '0' : null,
          onclick: opsi.onKlikBaris ? function () { opsi.onKlikBaris(r, i); } : null,
          onkeydown: opsi.onKlikBaris ? function (e) { if (e.key === 'Enter') opsi.onKlikBaris(r, i); } : null
        }, kolom.map(function (k) {
          var isi = k.render ? k.render(r, i) : (r[k.kunci] === undefined ? '' : String(r[k.kunci]));
          return el('td', { class: k.kelas || '', 'data-label': k.judul }, isi);
        }));
        tbody.appendChild(tr);
      });

      if (batas && data.length > batas) {
        tbody.appendChild(el('tr', null, el('td', { class: 'sel-lagi', colspan: kolom.length },
          btn('Tampilkan semua ' + data.length + ' baris', { kecil: true, ikon: 'chevron', onKlik: function () { batas = 0; gambar(); } })
        )));
      }
    }
    gambar();

    wrap.appendChild(el('div', { class: 'tabel-wrap' }, el('table', { class: 'tabel ' + (opsi.kelas || '') }, [thead, tbody])));
    return wrap;
  }

  function seksi(judul, deskripsi, isiNode, aksiNode) {
    return el('section', { class: 'kartu' }, [
      el('div', { class: 'kartu-head' }, [
        el('div', { class: 'kartu-judul' }, [
          el('h2', { text: judul }),
          deskripsi ? el('p', { class: 'muted', text: deskripsi }) : null
        ]),
        aksiNode ? el('div', { class: 'kartu-aksi' }, aksiNode) : null
      ]),
      isiNode
    ]);
  }

  /* ---------------------------------------------------------- form */
  function field(label, inputNode, hint, opsi) {
    opsi = opsi || {};
    var id = 'f_' + Math.random().toString(36).slice(2, 8);
    if (inputNode && inputNode.setAttribute && !inputNode.id) inputNode.id = id;
    var hintNode = hint ? el('span', { class: 'field-hint', text: hint }) : null;
    var wrap = el('div', { class: 'field' + (opsi.wajib ? ' field-wajib' : '') }, [
      el('label', { class: 'field-label', for: inputNode ? inputNode.id : null }, [
        el('span', { text: label }),
        opsi.wajib ? el('span', { class: 'wajib', text: '*', title: 'wajib diisi' }) : null
      ]),
      inputNode, hintNode
    ]);
    wrap._hint = hintNode;
    wrap._input = inputNode;
    return wrap;
  }

  /* Tandai field bermasalah + pesannya */
  function salahField(fieldWrap, pesan) {
    if (!fieldWrap) return;
    fieldWrap.classList.add('field-salah');
    if (fieldWrap._hint) {
      fieldWrap._hint.dataset.asli = fieldWrap._hint.dataset.asli || fieldWrap._hint.textContent;
      fieldWrap._hint.textContent = pesan;
    } else {
      fieldWrap.appendChild(el('span', { class: 'field-hint field-hint-salah', text: pesan }));
    }
    if (fieldWrap._input && fieldWrap._input.focus) fieldWrap._input.focus();
  }

  function bersihkanSalah(root) {
    qa('.field-salah', root).forEach(function (f) {
      f.classList.remove('field-salah');
      var h = f.querySelector('.field-hint');
      if (h && h.dataset.asli) h.textContent = h.dataset.asli;
      var hs = f.querySelector('.field-hint-salah');
      if (hs) hs.remove();
    });
  }

  function pilih(opsi, nilai, onUbah, attrs) {
    var s = el('select', Object.assign({ class: 'inp' }, attrs || {}));
    opsi.forEach(function (o) {
      s.appendChild(el('option', { value: o.value, text: o.label, selected: String(o.value) === String(nilai) ? 'selected' : null }));
    });
    if (onUbah) s.addEventListener('change', function () { onUbah(s.value); });
    return s;
  }

  function input(attrs, onUbah) {
    var n = el('input', Object.assign({ class: 'inp', type: 'text' }, attrs || {}));
    if (onUbah) n.addEventListener('change', function () { onUbah(n.value, n); });
    return n;
  }

  /* Input uang: format ribuan hidup, terima singkatan, tampilkan nilai terbaca */
  function inputUang(nilaiAwal, onUbah, attrs) {
    var n = el('input', Object.assign({
      class: 'inp inp-uang', type: 'text', inputmode: 'decimal',
      placeholder: '0', autocomplete: 'off', spellcheck: 'false'
    }, attrs || {}));

    var baca = el('span', { class: 'uang-baca' });
    n.dataset.nilai = String(Number(nilaiAwal) || 0);
    n.value = nilaiAwal ? grup(nilaiAwal) : '';

    function perbarui(v) {
      n.dataset.nilai = String(v);
      baca.textContent = v ? rpS(v) : '';
      baca.classList.toggle('tampil', !!v);
      if (onUbah) onUbah(v, n);
    }

    /* saat mengetik: kalau angka murni, sisipkan titik ribuan sambil jalan */
    n.addEventListener('input', function () {
      var mentah = n.value;
      if (/^[\d.]+$/.test(mentah)) {
        var akhirDiUjung = n.selectionStart === mentah.length;
        var angka = mentah.replace(/\./g, '');
        var rapi = angka ? grup(angka) : '';
        if (rapi !== mentah) {
          n.value = rapi;
          if (akhirDiUjung) n.setSelectionRange(rapi.length, rapi.length);
        }
      }
      perbarui(parseUang(n.value));
    });

    function normalkan() {
      var v = parseUang(n.value);
      n.value = v ? grup(v) : '';
      perbarui(v);
    }
    n.addEventListener('blur', normalkan);
    n.addEventListener('change', normalkan);

    perbarui(Number(nilaiAwal) || 0);

    var wrap = el('div', { class: 'uang-wrap' }, [n, baca]);
    wrap._input = n;
    n._wrap = wrap;
    return wrap;
  }

  /* inputUang mengembalikan pembungkus — helper ini menerima keduanya */
  function nilaiUang(node) {
    var n = node && node._input ? node._input : node;
    return Number(n && n.dataset ? n.dataset.nilai : 0) || 0;
  }
  function setUang(node, v) {
    var n = node && node._input ? node._input : node;
    n.value = v ? grup(v) : '';
    n.dataset.nilai = String(v || 0);
    n.dispatchEvent(new Event('input'));
  }

  /* Grup tombol pilihan (pengganti select untuk 2–4 opsi) */
  function segmen(opsi, nilai, onUbah, kelas) {
    var wrap = el('div', { class: 'segmen ' + (kelas || ''), role: 'radiogroup' });
    opsi.forEach(function (o) {
      wrap.appendChild(el('button', {
        class: 'segmen-btn' + (String(o.value) === String(nilai) ? ' aktif' : '') + (o.kelas ? ' ' + o.kelas : ''),
        type: 'button', role: 'radio', 'aria-checked': String(o.value) === String(nilai),
        'data-value': o.value,
        onclick: function () {
          qa('.segmen-btn', wrap).forEach(function (b) { b.classList.remove('aktif'); b.setAttribute('aria-checked', 'false'); });
          this.classList.add('aktif'); this.setAttribute('aria-checked', 'true');
          wrap.dataset.nilai = o.value;
          if (onUbah) onUbah(o.value);
        }
      }, [o.ikon ? global.IK(o.ikon, 14) : null, el('span', { text: o.label })]));
    });
    wrap.dataset.nilai = nilai;
    return wrap;
  }

  global.UI = {
    BULAN: BULAN, BULAN_PENDEK: BULAN_PENDEK, HARI: HARI, HARI_PENDEK: HARI_PENDEK,
    rp: rp, rpS: rpS, angkaS: angkaS, grup: grup, persen: persen, desimal: desimal, parseUang: parseUang,
    tglPendek: tglPendek, tglPanjang: tglPanjang, tglLengkap: tglLengkap, relatif: relatif,
    namaBulan: namaBulan, namaBulanPendek: namaBulanPendek, pecah: pecah,
    el: el, q: q, qa: qa, kosongkan: kosongkan, btn: btn,
    toast: toast, hapusDenganUndo: hapusDenganUndo, modal: modal, konfirmasi: konfirmasi,
    kartuKpi: kartuKpi, badge: badge, tabel: tabel, seksi: seksi, kosong: kosong,
    field: field, salahField: salahField, bersihkanSalah: bersihkanSalah,
    pilih: pilih, input: input, inputUang: inputUang, nilaiUang: nilaiUang, setUang: setUang,
    segmen: segmen
  };
})(window);
