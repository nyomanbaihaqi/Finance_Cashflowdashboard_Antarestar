/* ============================================================================
   ANTARESTAR — CASHFLOW PROJECTION
   pages-4.js — Rencana Pengeluaran (grid pengeluaran bulanan/harian per kategori)

   Sejajar dengan Target Digicom, tapi untuk sisi keluar. Nominal bulanan
   disebar RATA ke hari-hari bulan itu; bisa di-override per tanggal.
   ========================================================================== */
(function (global) {
  'use strict';

  var UI = global.UI, CFG = global.CFG, E = global.ENGINE, S = global.STORE, IK = global.IK;
  var el = UI.el;
  var HAL = global.HAL = global.HAL || {};

  function d() { return S.data(); }

  function rowBulan(bulan, coa) {
    return d().rencanaBulanan.filter(function (x) { return x.bulan === bulan && x.coa === coa; })[0];
  }
  function rowsHarian(bulan, coa) {
    return d().rencanaHarian.filter(function (x) {
      return String(x.tanggal).slice(0, 7) === bulan && x.coa === coa;
    });
  }
  function totalHarian(bulan, coa) {
    return rowsHarian(bulan, coa).reduce(function (a, x) { return a + (Number(x.nominal) || 0); }, 0);
  }

  /* Nilai efektif satu sel: rencana bulanan kalau ada, kalau tidak jumlah
     jadwal harian bulan itu. Ini yang bikin data impor harian ikut kelihatan
     & terhitung di grid, bukan cuma di forecast. */
  function nilaiEfektif(bulan, coa) {
    var rb = rowBulan(bulan, coa);
    if (rb) return Number(rb.nominal) || 0;
    return totalHarian(bulan, coa);
  }
  function sumberSel(bulan, coa) {
    if (rowBulan(bulan, coa)) return 'bulanan';
    if (rowsHarian(bulan, coa).length) return 'harian';
    return '';
  }

  function simpanBulan(bulan, coa, nominal) {
    var ada = rowBulan(bulan, coa);
    if (ada) {
      if (!nominal) return S.hapus('rencanaBulanan', ada.id);
      return S.ubah('rencanaBulanan', ada.id, { nominal: nominal });
    }
    if (!nominal) return Promise.resolve();
    return S.tambah('rencanaBulanan', { bulan: bulan, coa: coa, nominal: nominal });
  }

  /* Hapus semua jadwal harian satu bulan+kategori (dipakai saat sel harian
     diubah/dikosongkan dari grid bulanan). */
  function hapusHarian(bulan, coa) {
    var rows = rowsHarian(bulan, coa);
    return rows.reduce(function (p, r) { return p.then(function () { return S.hapus('rencanaHarian', r.id); }); },
      Promise.resolve());
  }

  HAL.rencana = {
    judul: 'Rencana Pengeluaran',
    sub: 'Plot pengeluaran per kategori — isi bulanan, atau override harian',
    aksiUtama: { label: 'Override harian', ikon: 'calendar', onKlik: function (ulang) { editorHarian(ulang); } },

    render: function (root, ulang) {
      var tahun = global.APP.rencanaTahun || 2026;
      global.APP.rencanaTahun = tahun;
      var bulanList = [], i;
      for (i = 1; i <= 12; i++) bulanList.push(tahun + '-' + E.pad(i));

      /* apakah ada data yang masuk lewat jadwal harian (mis. hasil impor CSV) */
      var adaHarian = d().rencanaHarian.length > 0;

      root.appendChild(el('div', { class: 'alert alert-biru' }, [
        IK('info', 17),
        el('div', { html: 'Nominal bulanan <b>disebar rata</b> ke hari-hari bulan itu. Untuk tanggal tertentu pakai <b>Override harian</b>. ' +
          (adaHarian
            ? 'Sel <span class="badge badge-biru" style="padding:0 6px">biru</span> berarti isinya dari <b>jadwal harian</b> (mis. hasil impor) — angkanya jumlah sebulan; ubah per tanggalnya lewat Override harian.'
            : 'Total cuma menjumlah sel yang benar-benar diisi.') })
      ]));

      /* peringatan potensi dobel dengan fixed cost — cek bulanan & harian */
      var bentrok = [];
      d().recurring.forEach(function (r) {
        if (r.aktif === false) return;
        var adaB = d().rencanaBulanan.some(function (x) { return x.coa === r.coa && x.nominal; });
        var adaH = d().rencanaHarian.some(function (x) { return x.coa === r.coa && x.nominal; });
        if (adaB || adaH) {
          var nm = CFG.namaCoa(r.coa);
          if (bentrok.indexOf(nm) < 0) bentrok.push(nm);
        }
      });
      if (bentrok.length) {
        root.appendChild(el('div', { class: 'alert alert-kuning' }, [
          IK('alert', 17),
          el('div', { html: 'Pos ini ada di <b>Fixed cost</b> sekaligus direncanakan di sini: <b>' +
            bentrok.join('</b>, <b>') + '</b>. Keduanya dihitung — hapus salah satu supaya tidak dobel.' })
        ]));
      }

      root.appendChild(el('div', { class: 'bar-alat' }, [
        UI.pilih([{ value: 2026, label: 'Tahun 2026' }, { value: 2027, label: 'Tahun 2027' }], tahun,
          function (v) { global.APP.rencanaTahun = +v; ulang(); }, { class: 'inp inp-ramping' }),
        el('div', { class: 'spacer' }),
        UI.btn('Override harian', { kecil: true, ikon: 'calendar', onKlik: function () { editorHarian(ulang); } })
      ]));

      var thead = el('thead', null, el('tr', null,
        [el('th', { class: 'kolom-beku', text: 'KATEGORI' })].concat(bulanList.map(function (b) {
          return el('th', { class: 'kanan', text: UI.namaBulanPendek(b) });
        })).concat([el('th', { class: 'kanan', text: 'TOTAL' })])));

      var tbody = el('tbody');
      var totalKolom = {}; bulanList.forEach(function (b) { totalKolom[b] = 0; });

      CFG.COA_OUT.forEach(function (c) {
        var totalBaris = 0;
        var sel = bulanList.map(function (b) {
          var nilai = nilaiEfektif(b, c.id);
          var sumber = sumberSel(b, c.id);
          totalBaris += nilai; totalKolom[b] += nilai;
          var jmlHari = sumber === 'harian' ? rowsHarian(b, c.id).length : 0;
          var inp = el('input', {
            class: 'sel-inp' + (nilai ? (sumber === 'harian' ? ' sel-harian' : ' sel-manual') : ' sel-kosong'),
            value: nilai ? UI.grup(nilai) : '', placeholder: '0',
            'aria-label': c.nama + ' ' + UI.namaBulan(b),
            title: sumber === 'harian'
              ? 'dari jadwal harian (' + jmlHari + ' tanggal) — klik "Override harian" untuk ubah per tanggal'
              : (nilai ? 'disebar ' + UI.rpS(Math.round(nilai / E.jumlahHari(b))) + '/hari' : 'kosong')
          });
          inp.addEventListener('focus', function () { inp.select(); });
          inp.addEventListener('change', function () {
            var baru = UI.parseUang(inp.value);
            if (baru === nilai) return;                       /* tak berubah */

            if (sumber === 'harian') {
              /* sel ini punya jadwal harian rinci — jangan diam-diam ditimpa */
              if (!baru) {
                UI.konfirmasi('Hapus jadwal ' + c.nama + ' ' + UI.namaBulan(b) + '?',
                  'Menghapus ' + jmlHari + ' tanggal (total ' + UI.rpS(nilai) + ') dari bulan ini. Tidak bisa diurungkan setelah tersimpan.',
                  function () { hapusHarian(b, c.id).then(function () { UI.toast('Jadwal harian dihapus', 'sukses'); ulang(); }); },
                  { labelYa: 'Ya, hapus' });
                ulang();  /* kembalikan tampilan angka lama dulu */
              } else {
                UI.konfirmasi('Ganti jadi rata sebulan?',
                  c.nama + ' ' + UI.namaBulan(b) + ' sekarang punya jadwal harian rinci (' + jmlHari +
                  ' tanggal). Ubah jadi rata ' + UI.rpS(baru) + ' sebulan? Jadwal harian yang detail akan diganti.',
                  function () {
                    hapusHarian(b, c.id).then(function () { return simpanBulan(b, c.id, baru); })
                      .then(function () { UI.toast('Diganti jadi rencana bulanan', 'sukses'); ulang(); });
                  }, { labelYa: 'Ya, ganti' });
                ulang();
              }
              return;
            }
            simpanBulan(b, c.id, baru).then(ulang);
          });
          return el('td', { class: 'kanan' }, inp);
        });
        tbody.appendChild(el('tr', null,
          [el('td', { class: 'kolom-beku' }, el('div', null, [
            el('div', { class: 'tebal', text: c.nama }),
            el('div', { class: 'muted2' }, [
              el('span', { class: 'lg-dot', style: 'background:' + CFG.BUCKET[c.bucket].warna }),
              el('span', { text: ' ' + CFG.BUCKET[c.bucket].label })
            ])
          ]))].concat(sel).concat([el('td', { class: 'kanan tebal', text: UI.rpS(totalBaris) })])));
      });

      var grand = 0;
      bulanList.forEach(function (b) { grand += totalKolom[b]; });
      tbody.appendChild(el('tr', { class: 'total' },
        [el('td', { class: 'kolom-beku', text: 'TOTAL PENGELUARAN' })].concat(bulanList.map(function (b) {
          return el('td', { class: 'kanan', text: UI.rpS(totalKolom[b]) });
        })).concat([el('td', { class: 'kanan', text: UI.rpS(grand) })])));

      root.appendChild(UI.seksi('Rencana pengeluaran ' + tahun + ' per kategori',
        'Klik sel untuk isi nominal sebulan. Geser ke samping untuk bulan berikutnya.',
        el('div', { class: 'tabel-wrap tabel-beku' }, el('table', { class: 'tabel tabel-grid' }, [thead, tbody]))));
    }
  };

  /* Override harian per kategori — mirror editorHarian target */
  function editorHarian(ulang) {
    var bulan = global.APP.hariIni.slice(0, 7);
    var coa = CFG.COA_OUT[0].id;
    var wrap = el('div');
    var isi = el('div');

    var selBulan = UI.input({ type: 'month', value: bulan }, function (v) { bulan = v; gambar(); });
    var selCoa = UI.pilih(CFG.COA_OUT.map(function (c) { return { value: c.id, label: c.nama }; }), coa,
      function (v) { coa = v; gambar(); });

    wrap.appendChild(el('div', { class: 'form-grid', style: 'grid-template-columns:1fr 1fr;margin-bottom:14px' }, [
      UI.field('Bulan', selBulan), UI.field('Kategori', selCoa)
    ]));
    wrap.appendChild(isi);

    function gambar() {
      UI.kosongkan(isi);
      var rb = rowBulan(bulan, coa);
      var totalBulan = rb ? (Number(rb.nominal) || 0) : 0;
      var per = totalBulan ? Math.round(totalBulan / E.jumlahHari(bulan)) : 0;
      var grid = el('div', { class: 'grid-hari' });

      E.tanggalBulan(bulan).forEach(function (t) {
        var ov = d().rencanaHarian.filter(function (x) { return x.tanggal === t && x.coa === coa; })[0];
        var nilai = ov ? ov.nominal : per;
        var inp = el('input', { class: 'sel-inp sel-kotak' + (ov ? ' sel-manual' : ''), value: nilai ? UI.grup(nilai) : '', placeholder: '0' });
        inp.addEventListener('focus', function () { inp.select(); });
        inp.addEventListener('change', function () {
          var v = UI.parseUang(inp.value), p;
          if (ov) p = (v === per) ? S.hapus('rencanaHarian', ov.id) : S.ubah('rencanaHarian', ov.id, { nominal: v });
          else p = S.tambah('rencanaHarian', { tanggal: t, coa: coa, nominal: v });
          p.then(function () { UI.toast('Override ' + UI.tglPendek(t) + ' tersimpan', 'sukses'); gambar(); if (ulang) ulang(); });
        });
        grid.appendChild(el('div', { class: 'hari-sel' }, [
          el('div', { class: 'hari-lbl' }, [
            el('span', { text: UI.tglPendek(t) }),
            ov ? el('span', { class: 'titik-manual', title: 'override manual' }) : null
          ]),
          inp
        ]));
      });

      isi.appendChild(el('p', { class: 'muted', style: 'margin-bottom:10px',
        text: totalBulan
          ? 'Rencana bulanan ' + UI.rpS(totalBulan) + ' · default tersebar rata ' + UI.rpS(per) + '/hari. Ubah sel untuk taruh di tanggal tertentu.'
          : 'Belum ada rencana bulanan untuk kategori ini. Isi di grid utama dulu, atau langsung ketik nominal per tanggal di sini.' }));
      isi.appendChild(grid);
    }
    gambar();

    UI.modal('Override harian — pengeluaran', wrap, [{ label: 'Selesai', gaya: 'btn-utama' }], { lebar: 'lebar' });
  }

  HAL._rencanaEditorHarian = editorHarian;
})(window);
