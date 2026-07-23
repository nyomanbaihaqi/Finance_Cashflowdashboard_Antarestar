/* ============================================================================
   ANTARESTAR — CASHFLOW PROJECTION
   pages-5.js — Cashflow Harian (rekap matrix hari-per-hari, gaya sheet)

   Baris = pos (SALDO AWAL, penerimaan, subtotal, pengeluaran, SALDO AKHIR),
   kolom = tanggal. Angka ditarik dari engine yang sama dengan Proyeksi Kas,
   jadi aktual + proyeksi konsisten. Ini versi tabel; Proyeksi Kas versi grafik.
   ========================================================================== */
(function (global) {
  'use strict';

  var UI = global.UI, CFG = global.CFG, E = global.ENGINE, S = global.STORE, IK = global.IK;
  var el = UI.el;
  var HAL = global.HAL = global.HAL || {};

  function d() { return S.data(); }
  function cfg() { return d().config; }

  HAL.harian = {
    judul: 'Cashflow Harian',
    sub: 'Rekap arus kas hari per hari — semua pos, semua tanggal',

    render: function (root, ulang) {
      var f = global.APP.filter;
      if (global.APP.harianPenuh === undefined) global.APP.harianPenuh = false;
      if (global.APP.harianSembunyiKosong === undefined) global.APP.harianSembunyiKosong = true;

      var hasil = E.hitungSemua(d(), { dari: f.dari, sampai: f.sampai, whatIf: f.whatIf });
      var aktif = hasil[f.skenario];
      var hari = aktif.hari;

      /* ---------- toolbar ---------- */
      root.appendChild(el('div', { class: 'bar-alat' }, [
        HAL._pemilihPeriode(ulang),
        el('div', { class: 'spacer' }),
        HAL._pilSkenario(hasil, ulang)
      ]));

      root.appendChild(el('div', { class: 'baris' }, [
        el('label', { class: 'sakelar' }, [
          el('input', { type: 'checkbox', checked: global.APP.harianSembunyiKosong ? 'checked' : null,
            onchange: function () { global.APP.harianSembunyiKosong = this.checked; ulang(); } }),
          el('span', { class: 'sakelar-jalur' }),
          el('span', { class: 'sakelar-teks', text: 'Sembunyikan pos kosong' })
        ]),
        el('label', { class: 'sakelar' }, [
          el('input', { type: 'checkbox', checked: global.APP.harianPenuh ? 'checked' : null,
            onchange: function () { global.APP.harianPenuh = this.checked; ulang(); } }),
          el('span', { class: 'sakelar-jalur' }),
          el('span', { class: 'sakelar-teks', text: 'Angka penuh' })
        ]),
        el('div', { class: 'spacer' }),
        el('span', { class: 'muted2', text: hari.length + ' hari · klik SALDO AKHIR buat rincian tanggal' })
      ]));

      if (!hari.length) {
        root.appendChild(UI.kosong({ ikon: 'calendar', judul: 'Belum ada rentang', pesan: 'Pilih periode di atas.' }));
        return;
      }

      /* ---------- siapkan nilai per hari ---------- */
      var fmt = global.APP.harianPenuh
        ? function (v) { return v ? UI.grup(v) : ''; }
        : function (v) { return v ? UI.rpS(v).replace('Rp ', '') : ''; };

      hari.forEach(function (h) { h._opening = h.saldo - h.masuk + h.keluar; });

      /* ---------- definisi baris ---------- */
      var penjualan = CFG.COA_IN.filter(function (c) { return c.group === 'penjualan'; });
      var lain = CFG.COA_IN.filter(function (c) { return c.group !== 'penjualan'; });

      var baris = [];
      baris.push({ jenis: 'saldo', label: 'SALDO AWAL', nilai: function (h) { return h._opening; } });
      baris.push({ jenis: 'seksi', label: 'PENERIMAAN' });
      penjualan.forEach(function (c) {
        baris.push({ jenis: 'in', coa: c.id, label: c.nama, nilai: function (h) { return h.detailMasuk[c.id] || 0; } });
      });
      baris.push({ jenis: 'subtotal', label: 'TOTAL PENERIMAAN PENJUALAN',
        nilai: function (h) { var t = 0; penjualan.forEach(function (c) { t += h.detailMasuk[c.id] || 0; }); return t; } });
      lain.forEach(function (c) {
        baris.push({ jenis: 'in', coa: c.id, label: c.nama, nilai: function (h) { return h.detailMasuk[c.id] || 0; } });
      });
      baris.push({ jenis: 'total', label: 'TOTAL PENERIMAAN UANG', nilai: function (h) { return h.masuk; } });
      baris.push({ jenis: 'seksi', label: 'PENGELUARAN' });
      CFG.COA_OUT.forEach(function (c) {
        baris.push({ jenis: 'out', coa: c.id, label: c.nama, nilai: function (h) { return h.detailKeluar[c.id] || 0; } });
      });
      baris.push({ jenis: 'total', label: 'TOTAL PENGELUARAN', nilai: function (h) { return h.keluar; } });
      baris.push({ jenis: 'saldo-akhir', label: 'SALDO AKHIR', nilai: function (h) { return h.saldo; } });

      /* total per baris (buat kolom TOTAL & deteksi baris kosong) */
      baris.forEach(function (b) {
        if (b.jenis === 'seksi') return;
        b._total = hari.reduce(function (a, h) { return a + b.nilai(h); }, 0);
        b._kosong = (b.jenis === 'in' || b.jenis === 'out') &&
                    hari.every(function (h) { return !b.nilai(h); });
      });

      var barisTampil = baris.filter(function (b) {
        return !(global.APP.harianSembunyiKosong && b._kosong);
      });
      var jmlDisembunyikan = baris.filter(function (b) { return b._kosong; }).length -
                             barisTampil.filter(function (b) { return b._kosong; }).length;

      /* ---------- bangun tabel ---------- */
      var idxCutoff = -1, i;
      for (i = 0; i < hari.length; i++) if (hari[i].tipe === 'aktual') idxCutoff = i;

      var thead = el('thead');
      var trHead = el('tr', null, [el('th', { class: 'kolom-beku th-pos', text: 'POS' })]);
      hari.forEach(function (h, i2) {
        trHead.appendChild(el('th', {
          class: 'kanan th-tgl' + (h.tipe === 'aktual' ? ' th-aktual' : '') + (i2 === idxCutoff ? ' th-cutoff' : ''),
          title: UI.tglLengkap(h.tgl) + (h.tipe === 'aktual' ? ' · aktual' : ' · proyeksi')
        }, [
          el('div', { class: 'th-tgl-hari', text: UI.HARI_PENDEK[new Date(h.tgl + 'T00:00:00').getDay()] }),
          el('div', { text: UI.pecah(h.tgl).tg + ' ' + UI.BULAN_PENDEK[UI.pecah(h.tgl).bl - 1] })
        ]));
      });
      trHead.appendChild(el('th', { class: 'kanan th-total', text: 'TOTAL' }));
      thead.appendChild(trHead);

      var tbody = el('tbody');
      barisTampil.forEach(function (b) {
        if (b.jenis === 'seksi') {
          var trS = el('tr', { class: 'cf-seksi' }, [
            el('td', { class: 'kolom-beku', text: b.label })
          ]);
          for (i = 0; i < hari.length + 1; i++) trS.appendChild(el('td'));
          tbody.appendChild(trS);
          return;
        }

        var kelasBaris = 'cf-' + b.jenis;
        var tr = el('tr', { class: kelasBaris });
        tr.appendChild(el('td', { class: 'kolom-beku cf-label' }, [
          (b.jenis === 'in' || b.jenis === 'out')
            ? el('span', { class: 'cf-dot', style: 'background:' + warnaPos(b) })
            : null,
          el('span', { text: b.label })
        ]));

        hari.forEach(function (h) {
          var v = b.nilai(h);
          var td = el('td', {
            class: 'kanan cf-sel' + (h.tipe === 'proyeksi' ? ' cf-proy' : '') +
              (b.jenis === 'saldo-akhir' && h.saldo < cfg().ambangBahaya ? ' cf-bahaya' : ''),
            'data-label': UI.tglPendek(h.tgl)
          });
          if (b.jenis === 'saldo-akhir') {
            td.classList.add('klik');
            td.addEventListener('click', function () { HAL._detailHari(h, aktif); });
          }
          td.textContent = (b.jenis === 'saldo' || b.jenis === 'saldo-akhir')
            ? (global.APP.harianPenuh ? UI.grup(v) : UI.rpS(v).replace('Rp ', ''))
            : (v ? fmt(v) : '·');
          tr.appendChild(td);
        });

        /* kolom TOTAL */
        var totVal = (b.jenis === 'saldo') ? hari[0]._opening
                   : (b.jenis === 'saldo-akhir') ? hari[hari.length - 1].saldo
                   : b._total;
        tr.appendChild(el('td', { class: 'kanan cf-total-sel',
          text: global.APP.harianPenuh ? UI.grup(totVal) : UI.rpS(totVal).replace('Rp ', '') }));

        tbody.appendChild(tr);
      });

      var judul = 'Cashflow harian · ' + UI.tglPanjang(f.dari) + ' – ' + UI.tglPanjang(f.sampai) +
        ' · skenario ' + aktif.skenario.nama;
      var ket = (idxCutoff >= 0 ? 'Kolom aktual s/d ' + UI.tglPendek(hari[idxCutoff].tgl) + ', sisanya proyeksi. ' : 'Semua kolom proyeksi. ') +
        (jmlDisembunyikan > 0 ? jmlDisembunyikan + ' pos kosong disembunyikan.' : '');

      root.appendChild(UI.seksi(judul, ket,
        el('div', { class: 'tabel-wrap tabel-beku cf-wrap' },
          el('table', { class: 'tabel cf-tabel' }, [thead, tbody]))));

      /* legenda kecil */
      root.appendChild(el('div', { class: 'baris', style: 'gap:16px' }, [
        el('span', { class: 'muted2' }, [el('span', { class: 'kotak', style: 'background:#fff;border-color:var(--garis)' }), ' Aktual']),
        el('span', { class: 'muted2' }, [el('span', { class: 'kotak', style: 'background:#fff7ed;border-color:#fed7aa' }), ' Proyeksi']),
        el('span', { class: 'muted2' }, [el('span', { class: 'kotak kotak-bahaya' }), ' Saldo akhir < ' + UI.rpS(cfg().ambangBahaya)])
      ]));
    }
  };

  function warnaPos(b) {
    if (b.jenis === 'in') return CFG.BUCKET.pemasukan.warna;
    return CFG.BUCKET[CFG.bucketCoa(b.coa)] ? CFG.BUCKET[CFG.bucketCoa(b.coa)].warna : '#94a3b8';
  }
})(window);
