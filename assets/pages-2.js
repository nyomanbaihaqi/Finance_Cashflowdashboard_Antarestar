/* ============================================================================
   ANTARESTAR — CASHFLOW PROJECTION
   pages-2.js — RAB · Target Digicom · Pengeluaran Rutin · Aktual · Pengaturan
   ========================================================================== */
(function (global) {
  'use strict';

  var UI = global.UI, CFG = global.CFG, E = global.ENGINE, S = global.STORE, CHART = global.CHART, IK = global.IK;
  var el = UI.el;
  var HAL = global.HAL = global.HAL || {};

  function d() { return S.data(); }
  function cfg() { return d().config; }

  var STATUS_RAB = [
    { value: 'draft',    label: 'Draft',     badge: 'kuning' },
    { value: 'approved', label: 'Disetujui', badge: 'hijau' },
    { value: 'batal',    label: 'Batal',     badge: 'merah' }
  ];
  function labelStatus(v) {
    return (STATUS_RAB.filter(function (x) { return x.value === v; })[0] || STATUS_RAB[0]);
  }

  /* ======================================================================
     HALAMAN: RAB
     ====================================================================== */
  HAL.rab = {
    judul: 'RAB',
    sub: 'Rancangan Anggaran Biaya per divisi — langsung jadi uang keluar di forecast',
    aksiUtama: { label: 'Buat RAB', ikon: 'plus', onKlik: function (ulang) { editorRab(null, ulang); } },

    render: function (root, ulang) {
      var rab = d().rab.slice().sort(function (a, b) {
        return String(a.tanggalRencana) < String(b.tanggalRencana) ? -1 : 1;
      });
      var ff = global.APP.rabFilter;

      var bulanAda = {};
      rab.forEach(function (r) { bulanAda[String(r.bulan || r.tanggalRencana).slice(0, 7)] = true; });

      var filterBar = el('div', { class: 'baris' }, [
        UI.pilih([{ value: '', label: 'Semua bulan' }].concat(
          Object.keys(bulanAda).sort().map(function (b) { return { value: b, label: UI.namaBulan(b) }; })),
          ff.bulan, function (v) { ff.bulan = v; ulang(); }, { class: 'inp inp-ramping' }),
        UI.pilih([{ value: '', label: 'Semua divisi' }].concat(
          CFG.DIVISI.map(function (x) { return { value: x, label: x }; })),
          ff.divisi, function (v) { ff.divisi = v; ulang(); }, { class: 'inp inp-ramping' }),
        UI.pilih([{ value: '', label: 'Semua status' }].concat(
          STATUS_RAB.map(function (x) { return { value: x.value, label: x.label }; })),
          ff.status, function (v) { ff.status = v; ulang(); }, { class: 'inp inp-ramping' }),
        (ff.bulan || ff.divisi || ff.status)
          ? UI.btn('Reset filter', { kecil: true, ikon: 'x',
              onKlik: function () { ff.bulan = ff.divisi = ff.status = ''; ulang(); } })
          : null
      ]);

      var tampil = rab.filter(function (r) {
        if (ff.bulan && String(r.bulan || r.tanggalRencana).slice(0, 7) !== ff.bulan) return false;
        if (ff.divisi && r.divisi !== ff.divisi) return false;
        if (ff.status && (r.status || 'draft') !== ff.status) return false;
        return true;
      });

      var totApprove = 0, totDraft = 0;
      tampil.forEach(function (r) {
        if (r.status === 'approved') totApprove += Number(r.total) || 0;
        else if (r.status !== 'batal') totDraft += Number(r.total) || 0;
      });

      root.appendChild(el('div', { class: 'grid g3' }, [
        UI.kartuKpi({ label: 'RAB disetujui', ikon: 'check', warna: '#ecfdf5', warnaIkon: '#059669',
          nilai: UI.rpS(totApprove), sub: 'sudah di-approve' }),
        UI.kartuKpi({ label: 'RAB draft', ikon: 'fileText', warna: '#fffbeb', warnaIkon: '#b45309',
          nilai: UI.rpS(totDraft), sub: 'ikut dihitung di forecast' }),
        UI.kartuKpi({ label: 'Total masuk forecast', ikon: 'scale', warna: '#fff7ed', warnaIkon: '#ea580c',
          nilai: UI.rpS(totApprove + totDraft), sub: tampil.length + ' item sesuai filter' })
      ]));

      var kolom = [
        { judul: 'Tgl rencana', lebar: '120px', render: function (r) {
            return el('div', null, [
              el('div', { class: 'tebal nowrap', text: r.tanggalRencana ? UI.tglPendek(r.tanggalRencana) : '—' }),
              el('div', { class: 'muted2', text: r.tanggalRencana ? UI.relatif(r.tanggalRencana, global.APP.hariIni) : '' })
            ]); },
          cariTeks: function (r) { return r.tanggalRencana ? UI.tglPendek(r.tanggalRencana) : ''; } },
        { judul: 'Divisi', lebar: '150px', render: function (r) {
            return el('div', null, [
              el('div', { class: 'tebal', text: r.divisi || '—' }),
              el('div', { class: 'muted2', text: r.kegiatan || '' })
            ]); },
          cariTeks: function (r) { return (r.divisi || '') + ' ' + (r.kegiatan || ''); } },
        { judul: 'Deskripsi', render: function (r) {
            return el('div', null, [
              el('div', { text: r.deskripsi || '—' }),
              el('div', { class: 'muted2', text: CFG.namaCoa(r.coa) })
            ]); },
          cariTeks: function (r) { return (r.deskripsi || '') + ' ' + CFG.namaCoa(r.coa); } },
        { judul: 'Item × Satuan', kelas: 'kanan', lebar: '150px', cari: false, render: function (r) {
            return el('div', { class: 'muted2 mono' }, [
              el('div', { text: UI.desimal(Number(r.item) || 0, 3) + ' × ' + UI.grup(Number(r.satuan) || 0) }),
              r.ket ? el('div', { text: r.ket }) : null
            ]); } },
        { judul: 'Total', kelas: 'kanan', lebar: '140px', render: function (r) {
            return el('span', { class: 'tebal', text: UI.rp(r.total) }); } },
        { judul: 'Status', lebar: '130px', cari: false, render: function (r) {
            var st = labelStatus(r.status || 'draft');
            var sel = UI.pilih(STATUS_RAB.map(function (x) { return { value: x.value, label: x.label }; }),
              r.status || 'draft', function (v) {
                S.ubah('rab', r.id, { status: v }).then(function () {
                  UI.toast('Status → ' + labelStatus(v).label, 'sukses'); ulang();
                });
              }, { class: 'inp sel-status sel-' + st.badge });
            sel.addEventListener('click', function (e) { e.stopPropagation(); });
            return sel; },
          cariTeks: function (r) { return labelStatus(r.status || 'draft').label; } },
        { judul: '', kelas: 'kanan', lebar: '96px', cari: false, render: function (r) {
            return el('div', { class: 'aksi-sel' }, [
              UI.btn('', { ikon: 'edit', kecil: true, gaya: 'btn-ghost', title: 'Edit',
                onKlik: function (e) { e.stopPropagation(); editorRab(r, ulang); } }),
              UI.btn('', { ikon: 'trash', kecil: true, gaya: 'btn-ghost', title: 'Hapus',
                onKlik: function (e) {
                  e.stopPropagation();
                  var salinan = Object.assign({}, r);
                  S.hapus('rab', r.id).then(function () {
                    UI.toast('Item RAB dihapus', 'sukses', {
                      onUndo: function () { S.tambah('rab', salinan).then(ulang); }
                    });
                    ulang();
                  });
                } })
            ]); } }
      ];

      var totalSemua = tampil.reduce(function (a, r) { return a + (r.status === 'batal' ? 0 : Number(r.total) || 0); }, 0);

      root.appendChild(UI.seksi('Daftar item RAB',
        'Item non-batal otomatis jadi uang keluar di tanggal rencananya.',
        el('div', null, [
          UI.tabel(kolom, tampil, {
            cari: true, cariPlaceholder: 'Cari deskripsi, divisi, atau pos…', maks: 30,
            kelasBaris: function (r) { return r.status === 'batal' ? 'baris-batal' : ''; },
            kosong: {
              ikon: 'fileText', judul: 'Belum ada RAB',
              pesan: 'Tiap divisi mengajukan rencana pengeluaran di sini. Begitu tersimpan, langsung terhitung di proyeksi kas.',
              aksi: { label: 'Buat RAB pertama', ikon: 'plus', onKlik: function () { editorRab(null, ulang); } }
            }
          }),
          tampil.length ? el('div', { class: 'total-bar' }, [
            el('span', { class: 'lbl', text: 'Total masuk forecast (sesuai filter)' }),
            el('span', { class: 'val', text: UI.rp(totalSemua) })
          ]) : null
        ]),
        filterBar));
    }
  };

  /* --------------------------------------------------------- editor RAB */
  function editorRab(existing, ulang) {
    var isBaru = !existing;
    var head = {
      kegiatan: existing ? (existing.kegiatan || '') : '',
      divisi:   existing ? existing.divisi : CFG.DIVISI[0],
      bulan:    existing ? String(existing.bulan || existing.tanggalRencana).slice(0, 7) : global.APP.hariIni.slice(0, 7),
      benefit:  existing ? (existing.benefit || '') : ''
    };

    function barisKosong(bulan) {
      return { tanggalRencana: bulan + '-01', deskripsi: '', item: 0, satuan: 0,
               ket: '', total: 0, coa: 'out_import' };
    }
    var baris = existing ? [Object.assign({}, existing)] : [barisKosong(head.bulan)];

    var wrap = el('div');

    var inKegiatan = UI.input({ value: head.kegiatan, placeholder: 'mis. IMPORT PRODUCT ANTARESTAR' },
      function (v) { head.kegiatan = v; });
    var inDivisi = UI.pilih(CFG.DIVISI.map(function (x) { return { value: x, label: x }; }), head.divisi,
      function (v) { head.divisi = v; });
    var inBulan = UI.input({ type: 'month', value: head.bulan }, function (v) { head.bulan = v; });
    var inBenefit = UI.input({ value: head.benefit, placeholder: 'opsional' }, function (v) { head.benefit = v; });

    wrap.appendChild(el('div', { class: 'rab-head' }, [
      UI.field('Kegiatan', inKegiatan),
      UI.field('Departemen', inDivisi, null, { wajib: true }),
      UI.field('Waktu (bulan)', inBulan, null, { wajib: true }),
      UI.field('Benefit', inBenefit)
    ]));

    var tbody = el('tbody');
    var totalNode = el('span', { class: 'val', text: 'Rp 0' });

    function hitungTotal() {
      var t = 0;
      baris.forEach(function (b) { t += Number(b.total) || 0; });
      totalNode.textContent = UI.rp(t);
    }

    function gambarBaris() {
      UI.kosongkan(tbody);
      baris.forEach(function (b, idx) {
        var inTgl = UI.input({ type: 'date', value: b.tanggalRencana }, function (v) { b.tanggalRencana = v; });
        var inDesk = UI.input({ value: b.deskripsi, placeholder: 'deskripsi pengeluaran' }, function (v) { b.deskripsi = v; });
        var inItem = UI.input({ value: b.item ? UI.desimal(b.item, 3) : '', class: 'inp inp-uang', placeholder: '0', inputmode: 'decimal' });
        var inSat  = UI.input({ value: b.satuan ? UI.grup(b.satuan) : '', class: 'inp inp-uang', placeholder: '0', inputmode: 'decimal' });
        var inKet  = UI.input({ value: b.ket, placeholder: 'rate rmb / cbm' }, function (v) { b.ket = v; });
        var inCoa  = UI.pilih(CFG.COA_OUT.map(function (c) { return { value: c.id, label: c.nama }; }), b.coa,
          function (v) { b.coa = v; });
        var outTotal = el('span', { class: 'tebal num', text: UI.grup(b.total || 0) });

        function recalc() {
          b.item = parseFloat(String(inItem.value).replace(/\./g, '').replace(',', '.')) || UI.parseUang(inItem.value);
          if (!isFinite(b.item)) b.item = 0;
          b.satuan = UI.parseUang(inSat.value);
          b.total = Math.round(b.item * b.satuan);
          inItem.value = b.item ? UI.desimal(b.item, 3) : '';
          inSat.value = b.satuan ? UI.grup(b.satuan) : '';
          outTotal.textContent = UI.grup(b.total);
          hitungTotal();
        }
        ['blur', 'change'].forEach(function (ev) {
          inItem.addEventListener(ev, recalc);
          inSat.addEventListener(ev, recalc);
        });

        tbody.appendChild(el('tr', { class: 'rab-baris' }, [
          el('td', { class: 'muted2 tengah', text: String(idx + 1) }),
          el('td', null, inTgl),
          el('td', null, inDesk),
          el('td', null, inItem),
          el('td', null, inSat),
          el('td', null, inKet),
          el('td', null, inCoa),
          el('td', { class: 'kanan' }, outTotal),
          el('td', { class: 'kanan' }, el('div', { class: 'aksi-sel' }, [
            isBaru ? UI.btn('', { ikon: 'copy', kecil: true, gaya: 'btn-ghost', title: 'Duplikat baris',
              onKlik: function () { baris.splice(idx + 1, 0, Object.assign({}, b)); gambarBaris(); hitungTotal(); } }) : null,
            isBaru ? UI.btn('', { ikon: 'x', kecil: true, gaya: 'btn-ghost', title: 'Hapus baris',
              onKlik: function () {
                if (baris.length === 1) { UI.toast('Minimal 1 baris', 'warn'); return; }
                baris.splice(idx, 1); gambarBaris(); hitungTotal();
              } }) : null
          ]))
        ]));
      });
    }
    gambarBaris();
    hitungTotal();

    wrap.appendChild(el('div', { class: 'tabel-wrap' }, el('table', { class: 'tabel tabel-rab' }, [
      el('thead', null, el('tr', null,
        [{ t: 'NO', w: '40px' }, { t: 'TANGGAL', w: '140px' }, { t: 'DESCRIPTION' }, { t: 'ITEM', w: '96px' },
         { t: 'SATUAN', w: '120px' }, { t: 'KET', w: '104px' }, { t: 'POS CASHFLOW', w: '200px' },
         { t: 'TOTAL', w: '130px', k: 'kanan' }, { t: '', w: '76px' }].map(function (h) {
          return el('th', { class: h.k || '', style: h.w ? 'width:' + h.w : null, text: h.t });
        }))),
      tbody
    ])));

    if (isBaru) {
      wrap.appendChild(el('div', { class: 'baris', style: 'margin-top:10px' },
        UI.btn('Tambah baris', { kecil: true, ikon: 'plus', onKlik: function () {
          baris.push(barisKosong(head.bulan)); gambarBaris(); hitungTotal();
        } })));
    }

    wrap.appendChild(el('div', { class: 'total-bar total-bar-gelap' }, [
      el('span', { class: 'lbl', text: 'Grand total RAB' }), totalNode
    ]));

    wrap.appendChild(el('p', { class: 'muted', style: 'margin-top:10px' },
      'TOTAL = ITEM × SATUAN. Contoh: 2.220 RMB × rate 2.370 = Rp 5.261.400 · 4,55 CBM × Rp 5.500.000 = Rp 25.025.000.'));

    UI.modal(isBaru ? 'Buat RAB baru' : 'Edit item RAB', wrap, [
      { label: 'Batal', gaya: 'btn-ghost' },
      { label: isBaru ? 'Simpan RAB' : 'Simpan perubahan', gaya: 'btn-utama', aksi: function () {
          var valid = baris.filter(function (b) { return b.total > 0 && b.tanggalRencana; });
          if (!valid.length) { UI.toast('Isi minimal 1 baris dengan tanggal & nominal', 'warn'); return false; }

          var pending;
          if (isBaru) {
            pending = valid.map(function (b) {
              return S.tambah('rab', {
                bulan: head.bulan, divisi: head.divisi, kegiatan: head.kegiatan, benefit: head.benefit,
                tanggalRencana: b.tanggalRencana, deskripsi: b.deskripsi, item: b.item, satuan: b.satuan,
                ket: b.ket, total: b.total, coa: b.coa, status: 'draft'
              });
            });
          } else {
            var b0 = valid[0];
            pending = [S.ubah('rab', existing.id, {
              bulan: head.bulan, divisi: head.divisi, kegiatan: head.kegiatan, benefit: head.benefit,
              tanggalRencana: b0.tanggalRencana, deskripsi: b0.deskripsi, item: b0.item, satuan: b0.satuan,
              ket: b0.ket, total: b0.total, coa: b0.coa
            })];
          }
          Promise.all(pending).then(function () {
            UI.toast(isBaru ? valid.length + ' item RAB tersimpan' : 'Perubahan tersimpan', 'sukses');
            if (ulang) ulang();
          });
        } }
    ], { lebar: 'penuh', sub: isBaru ? 'Isi header lalu tambahkan baris sebanyak yang perlu' : null });
  }

  /* ======================================================================
     HALAMAN: TARGET DIGICOM
     ====================================================================== */
  HAL.target = {
    judul: 'Target Digicom',
    sub: 'Target GMV per channel per bulan — sumber utama proyeksi penerimaan',
    render: function (root, ulang) {
      var tahun = global.APP.targetTahun;
      var bulanList = [], i;
      for (i = 1; i <= 12; i++) bulanList.push(tahun + '-' + E.pad(i));

      root.appendChild(el('div', { class: 'alert alert-biru' }, [
        IK('info', 17),
        el('div', { html: 'Angka di sini <b>GMV</b> (omset), bukan kas. Kas diakui <b>H+' + cfg().lagDefault +
          '</b> setelah transaksi, dikali <b>netto %</b> tiap channel. Sel abu-abu = otomatis dari porsi default; ' +
          'ketik untuk menimpanya.' })
      ]));

      root.appendChild(el('div', { class: 'bar-alat' }, [
        UI.pilih([{ value: 2026, label: 'Tahun 2026' }, { value: 2027, label: 'Tahun 2027' }], tahun,
          function (v) { global.APP.targetTahun = +v; ulang(); }, { class: 'inp inp-ramping' }),
        el('div', { class: 'spacer' }),
        UI.btn('Isi dari target master', { kecil: true, ikon: 'grid',
          onKlik: function () { isiDariMaster(bulanList, ulang); } }),
        UI.btn('Override harian', { kecil: true, ikon: 'calendar',
          onKlik: function () { editorHarian(ulang); } })
      ]));

      /* Grid target untuk satu skenario. Optimis = basis yang diketik penuh;
         Moderate/Pesimis boleh dikosongkan → otomatis ikut basis × faktornya. */
      function gridSkenario(sk, bulanList) {
        var basis = sk.id === 'optimis';
        var thead = el('thead', null, el('tr', null,
          [el('th', { class: 'kolom-beku', text: 'CHANNEL' })].concat(bulanList.map(function (b) {
            return el('th', { class: 'kanan', text: UI.namaBulanPendek(b) });
          })).concat([el('th', { class: 'kanan', text: 'TOTAL' })])));

        var tbody = el('tbody');
        var totalKolom = {}; bulanList.forEach(function (b) { totalKolom[b] = 0; });

        CFG.CHANNELS.forEach(function (c) {
          var totalBaris = 0;
          var sel = bulanList.map(function (b) {
            var efektif = basis ? tNilaiEfektif(b, c.id)
                                : E.targetSkenario(d(), b, c.id, sk.id, sk.faktor);
            totalBaris += efektif; totalKolom[b] += efektif;

            var sendiri = basis ? null : rowTargetSk(b, c.id, sk.id);
            var sumber = basis ? tSumber(b, c.id) : (sendiri ? 'manual' : 'ikut');
            var jmlHari = (basis && sumber === 'harian') ? tHarianRows(b, c.id).length : 0;
            var saran = basis ? E.masterChannel(b, c.id)
                              : Math.round(tNilaiEfektif(b, c.id) * sk.faktor);

            var kelas = 'sel-inp';
            if (basis) kelas += efektif ? (sumber === 'harian' ? ' sel-harian' : ' sel-manual') : ' sel-kosong';
            else kelas += sendiri ? ' sel-manual' : ' sel-kosong';

            var inp = el('input', {
              class: kelas,
              value: basis ? (efektif ? UI.grup(efektif) : '') : (sendiri ? UI.grup(efektif) : ''),
              placeholder: saran ? UI.grup(saran) : '0',
              'aria-label': c.nama + ' ' + UI.namaBulan(b) + ' ' + sk.nama,
              title: basis
                ? (sumber === 'harian'
                    ? 'dari override harian (' + jmlHari + ' tanggal)'
                    : (efektif ? 'diisi manual' : 'kosong · saran master ' + UI.rpS(saran)))
                : (sendiri ? 'diisi manual khusus ' + sk.nama
                           : 'kosong · otomatis ' + (sk.faktor * 100).toFixed(0) + '% dari Optimis = ' + UI.rpS(saran))
            });
            inp.addEventListener('focus', function () { inp.select(); });
            inp.addEventListener('change', function () {
              var baru = UI.parseUang(inp.value);

              if (!basis) {                       /* grid Moderate / Pesimis */
                if (baru === efektif && sendiri) return;
                simpanTargetSk(b, c.id, sk.id, baru).then(ulang);
                return;
              }

              if (baru === efektif) return;
              if (sumber === 'harian') {
                if (!baru) {
                  UI.konfirmasi('Hapus override harian?',
                    c.nama + ' ' + UI.namaBulan(b) + ' punya ' + jmlHari + ' tanggal (total ' + UI.rpS(efektif) + '). Hapus semua?',
                    function () { tHapusHarian(b, c.id).then(function () { UI.toast('Override harian dihapus', 'sukses'); ulang(); }); },
                    { labelYa: 'Ya, hapus' });
                  ulang();
                } else {
                  UI.konfirmasi('Ganti jadi target bulanan?',
                    c.nama + ' ' + UI.namaBulan(b) + ' sekarang diisi per tanggal (' + jmlHari + ' hari). ' +
                    'Ubah jadi target bulanan ' + UI.rpS(baru) + '? Override harian yang detail akan diganti.',
                    function () {
                      tHapusHarian(b, c.id).then(function () { return simpanTarget(b, c.id, baru); })
                        .then(function () { UI.toast('Diganti jadi target bulanan', 'sukses'); ulang(); });
                    }, { labelYa: 'Ya, ganti' });
                  ulang();
                }
                return;
              }
              simpanTarget(b, c.id, baru).then(ulang);
            });
            return el('td', { class: 'kanan' }, inp);
          });

          tbody.appendChild(el('tr', null,
            [el('td', { class: 'kolom-beku' }, el('div', null, [
              el('div', { class: 'tebal', text: c.nama }),
              el('div', { class: 'muted2', text: CFG.namaCoa(c.coa) + ' · H+' + c.lag + ' · netto ' + c.netto + '%' })
            ]))].concat(sel).concat([el('td', { class: 'kanan tebal', text: UI.rpS(totalBaris) })])));
        });

        var grand = 0;
        bulanList.forEach(function (b) { grand += totalKolom[b]; });
        tbody.appendChild(el('tr', { class: 'total' },
          [el('td', { class: 'kolom-beku', text: 'TOTAL GMV' })].concat(bulanList.map(function (b) {
            return el('td', { class: 'kanan', text: UI.rpS(totalKolom[b]) });
          })).concat([el('td', { class: 'kanan', text: UI.rpS(grand) })])));

        return { tabel: el('div', { class: 'tabel-wrap tabel-beku' },
          el('table', { class: 'tabel tabel-grid' }, [thead, tbody])), totalKolom: totalKolom, grand: grand };
      }

      var adaTHarian = d().targetHarian.length > 0;
      var gOptimis = gridSkenario(CFG.SKENARIO[0], bulanList);
      var totalKolom = gOptimis.totalKolom;

      root.appendChild(UI.seksi('Target GMV ' + tahun + ' — OPTIMIS (basis)',
        'Isi bulanan (disebar ke harian otomatis) atau per tanggal lewat Override harian — dua-duanya nyambung. ' +
        (adaTHarian ? 'Sel biru = dari override harian. ' : '') +
        'Angka samar = saran master, belum dihitung.',
        gOptimis.tabel));

      /* --- grid Moderate & Pesimis, masing-masing bisa diisi sendiri --- */
      CFG.SKENARIO.slice(1).forEach(function (sk) {
        var g = gridSkenario(sk, bulanList);
        var jmlManual = d().targetBulanan.filter(function (t) {
          return t.skenario === sk.id && t.bulan.slice(0, 4) === String(tahun);
        }).length;

        var mandiri = !!(cfg().skenarioMandiri || {})[sk.id];

        var saklarMandiri = el('label', { class: 'sakelar' }, [
          el('input', { type: 'checkbox', checked: mandiri ? 'checked' : null,
            onchange: function () {
              var m = Object.assign({}, cfg().skenarioMandiri || {});
              m[sk.id] = this.checked;
              S.simpanConfig({ skenarioMandiri: m }).then(function () {
                UI.toast(sk.nama + (m[sk.id] ? ': hanya pakai angka yang diketik' : ': kosong ikut rumus lagi'), 'sukses');
                ulang();
              });
            } }),
          el('span', { class: 'sakelar-jalur' }),
          el('span', { class: 'sakelar-teks', text: mandiri ? 'Rencana terpisah' : 'Ikut rumus Optimis' })
        ]);

        var kartu = UI.seksi('Target GMV ' + tahun + ' — ' + sk.nama.toUpperCase(),
          mandiri
            ? 'Rencana terpisah: cuma angka yang kamu ketik yang dihitung. Sel kosong = 0, tidak diturunkan dari Optimis.'
            : 'Sel kosong otomatis ikut rumus ' + (sk.faktor * 100).toFixed(0) + '% dari Optimis. ' +
              'Nyalakan "Rencana terpisah" kalau skenario ini mau berdiri sendiri.',
          g.tabel,
          el('div', { class: 'baris' }, [
            saklarMandiri,
            UI.badge(jmlManual ? jmlManual + ' sel diisi' : (mandiri ? 'belum ada isian' : 'semua ikut rumus'),
              jmlManual ? 'oranye' : (mandiri ? 'merah' : 'abu')),
            jmlManual ? UI.btn('Kosongkan', { kecil: true, ikon: 'refresh',
              onKlik: function () { resetSkenario(sk, tahun, ulang); } }) : null
          ]));
        kartu.classList.add('kartu-skenario', 'ks-' + sk.id);
        root.appendChild(kartu);
      });

      var dataBar = bulanList.map(function (b) {
        return { label: UI.BULAN_PENDEK[+b.slice(5, 7) - 1], a: totalKolom[b], b: realisasiBulan(b) };
      });
      var adaRealisasi = dataBar.some(function (x) { return x.b > 0; });
      var barWrap = el('div');
      root.appendChild(UI.seksi('Target vs realisasi GMV',
        adaRealisasi
          ? 'Realisasi dihitung dari Aktual Harian (kas penjualan ÷ netto%). Bulan tanpa catatan aktual = kosong.'
          : 'Belum ada realisasi karena Aktual Harian masih kosong — yang tampil baru targetnya.',
        barWrap));
      CHART.batangBulanan(barWrap, dataBar, { labelA: 'Target', labelB: 'Realisasi', warna: '#2563eb', tinggi: 230 });
    }
  };

  /* Realisasi GMV sebulan, DIHITUNG dari Aktual Harian — bukan angka hardcode.
     Kas penjualan yang tercatat dibalik ke GMV dengan membagi netto% channel.
     Bulan tanpa catatan aktual = 0, jadi grafik tidak pernah menampilkan
     "realisasi" untuk periode yang datanya belum dimasukkan. */
  function realisasiBulan(bulan) {
    var nettoCoa = {};
    CFG.CHANNELS.forEach(function (ch) {
      if (nettoCoa[ch.coa] === undefined) nettoCoa[ch.coa] = ch.netto || 100;
    });
    var penjualan = {};
    CFG.COA_IN.forEach(function (c) { if (c.group === 'penjualan') penjualan[c.id] = true; });

    var total = 0;
    d().actual.forEach(function (a) {
      if (a.tipe !== 'in') return;
      if (String(a.tanggal).slice(0, 7) !== bulan) return;
      if (!penjualan[a.coa]) return;
      var netto = nettoCoa[a.coa] || 100;
      total += (Number(a.nominal) || 0) / (netto / 100);
    });
    return Math.round(total);
  }

  /* ---- jembatan bulanan <-> harian ---- */
  /* override harian basis (Optimis) — grid Optimis hanya melihat baris ini */
  function tHarianRows(bulan, channel) {
    return d().targetHarian.filter(function (x) {
      return String(x.tanggal).slice(0, 7) === bulan && x.channel === channel &&
             (x.skenario || 'optimis') === 'optimis';
    });
  }
  function tTotalHarian(bulan, channel) {
    return tHarianRows(bulan, channel).reduce(function (a, x) { return a + (Number(x.gmv) || 0); }, 0);
  }
  /* nilai efektif: target bulanan kalau ada, kalau tidak jumlah override harian */
  function tNilaiEfektif(bulan, channel) {
    var m = E.targetBulananChannel(d(), bulan, channel);
    if (m) return m;
    return tTotalHarian(bulan, channel);
  }
  function tSumber(bulan, channel) {
    if (E.targetBulananChannel(d(), bulan, channel)) return 'bulanan';
    if (tHarianRows(bulan, channel).length) return 'harian';
    return '';
  }
  function tHapusHarian(bulan, channel) {
    return tHarianRows(bulan, channel).reduce(function (p, r) {
      return p.then(function () { return S.hapus('targetHarian', r.id); });
    }, Promise.resolve());
  }

  /* baris target untuk skenario tertentu (basis 'optimis' = baris tanpa skenario) */
  function rowTargetSk(bulan, channel, skenario) {
    return d().targetBulanan.filter(function (t) {
      return t.bulan === bulan && t.channel === channel &&
             (t.skenario || 'optimis') === skenario;
    })[0];
  }

  function simpanTarget(bulan, channel, gmv) {
    return simpanTargetSk(bulan, channel, 'optimis', gmv);
  }

  function simpanTargetSk(bulan, channel, skenario, gmv) {
    var ada = rowTargetSk(bulan, channel, skenario);
    if (ada) {
      if (!gmv) return S.hapus('targetBulanan', ada.id);
      return S.ubah('targetBulanan', ada.id, { gmv: gmv });
    }
    if (!gmv) return Promise.resolve();
    return S.tambah('targetBulanan', { bulan: bulan, channel: channel, gmv: gmv, skenario: skenario });
  }

  /* Hapus semua isian manual satu skenario di tahun tertentu → balik ikut rumus */
  function resetSkenario(sk, tahun, ulang) {
    var rows = d().targetBulanan.filter(function (t) {
      return t.skenario === sk.id && String(t.bulan).slice(0, 4) === String(tahun);
    });
    if (!rows.length) return;
    UI.konfirmasi('Kembalikan ' + sk.nama + ' ke rumus?',
      rows.length + ' sel yang diisi manual akan dihapus. Setelah itu ' + sk.nama +
      ' otomatis ikut ' + (sk.faktor * 100).toFixed(0) + '% dari Optimis.',
      function () {
        rows.reduce(function (p, r) {
          return p.then(function () { return S.hapus('targetBulanan', r.id); });
        }, Promise.resolve()).then(function () {
          UI.toast(sk.nama + ' kembali ikut rumus', 'sukses'); ulang();
        });
      }, { labelYa: 'Ya, kembalikan' });
  }

  function isiDariMaster(bulanList, ulang) {
    UI.konfirmasi('Isi dari target master?',
      'Semua sel tahun ini diisi memakai porsi default (' + bulanList.length + ' bulan × ' +
      CFG.CHANNELS.length + ' channel). Isian manual yang sudah ada akan ditimpa.',
      function () {
        var rows = [];
        bulanList.forEach(function (b) {
          CFG.CHANNELS.forEach(function (c) {
            var v = E.masterChannel(b, c.id);
            if (v) rows.push({ id: S.uid('tb'), bulan: b, channel: c.id, gmv: v });
          });
        });
        var lain = d().targetBulanan.filter(function (t) { return bulanList.indexOf(t.bulan) < 0; });
        S.gantiSemua('targetBulanan', lain.concat(rows)).then(function () {
          UI.toast(rows.length + ' sel terisi', 'sukses'); ulang();
        });
      });
  }

  function editorHarian(ulang) {
    var bulan = global.APP.hariIni.slice(0, 7);
    var channel = CFG.CHANNELS[0].id;
    var wrap = el('div');
    var isi = el('div');

    var selBulan = UI.input({ type: 'month', value: bulan }, function (v) { bulan = v; gambar(); });
    var selChannel = UI.pilih(CFG.CHANNELS.map(function (c) { return { value: c.id, label: c.nama }; }), channel,
      function (v) { channel = v; gambar(); });

    wrap.appendChild(el('div', { class: 'form-grid', style: 'grid-template-columns:1fr 1fr;margin-bottom:14px' }, [
      UI.field('Bulan', selBulan), UI.field('Channel', selChannel)
    ]));
    wrap.appendChild(isi);

    function gambar() {
      UI.kosongkan(isi);
      var totalBulan = E.targetBulananChannel(d(), bulan, channel);
      var sebar = E.sebarBulan(bulan, totalBulan);
      var grid = el('div', { class: 'grid-hari' });

      E.tanggalBulan(bulan).forEach(function (t) {
        var ov = d().targetHarian.filter(function (x) { return x.tanggal === t && x.channel === channel; })[0];
        var nilai = ov ? ov.gmv : (sebar[t] || 0);
        var inp = el('input', { class: 'sel-inp sel-kotak' + (ov ? ' sel-manual' : ''), value: UI.grup(nilai) });
        inp.addEventListener('focus', function () { inp.select(); });
        inp.addEventListener('change', function () {
          var v = UI.parseUang(inp.value), p;
          if (ov) p = (v === (sebar[t] || 0)) ? S.hapus('targetHarian', ov.id) : S.ubah('targetHarian', ov.id, { gmv: v });
          else p = S.tambah('targetHarian', { tanggal: t, channel: channel, gmv: v });
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
        text: 'Target bulanan ' + UI.rpS(totalBulan) + ' · disebar pakai pola (weekend, tanggal kembar ×' +
              CFG.POLA.tanggalKembar + ', payday). Ubah sel untuk override.' }));
      isi.appendChild(grid);
    }
    gambar();

    UI.modal('Override target harian', wrap, [{ label: 'Selesai', gaya: 'btn-utama' }], { lebar: 'lebar' });
  }

  /* ======================================================================
     HALAMAN: PENGELUARAN RUTIN
     ====================================================================== */
  HAL.fixed = {
    judul: 'Pengeluaran Rutin',
    sub: 'Fixed cost bulanan, baseline operasional harian, dan biaya variabel',
    aksiUtama: { label: 'Tambah fixed cost', ikon: 'plus', onKlik: function (ulang) { editorRecurring(null, ulang); } },

    render: function (root, ulang) {
      var rec = d().recurring;
      var totalBulanan = rec.reduce(function (a, r) { return a + (r.aktif ? Number(r.nominal) || 0 : 0); }, 0);
      var baseline = E.hitungBaseline(d(), cfg());
      var baselineHarian = 0;
      for (var bk in baseline) if (baseline.hasOwnProperty(bk)) baselineHarian += baseline[bk];

      root.appendChild(el('div', { class: 'grid g3' }, [
        UI.kartuKpi({ label: 'Fixed cost / bulan', ikon: 'repeat', warna: '#fff7ed', warnaIkon: '#ea580c',
          nilai: UI.rpS(totalBulanan), sub: rec.filter(function (r) { return r.aktif; }).length + ' pos aktif' }),
        UI.kartuKpi({ label: 'Baseline operasional / hari', ikon: 'chart',
          warna: cfg().pakaiBaseline ? '#eff6ff' : '#f8fafc', warnaIkon: cfg().pakaiBaseline ? '#2563eb' : '#94a3b8',
          nilai: cfg().pakaiBaseline ? UI.rpS(baselineHarian) : 'NONAKTIF',
          sub: cfg().pakaiBaseline ? '≈ ' + UI.rpS(baselineHarian * 30) + ' / bulan' : 'proyeksi hanya dari RAB & fixed cost' }),
        UI.kartuKpi({ label: 'Biaya variabel', ikon: 'megaphone',
          warna: cfg().pakaiVariabel ? '#ecfdf5' : '#f8fafc', warnaIkon: cfg().pakaiVariabel ? '#059669' : '#94a3b8',
          nilai: cfg().pakaiVariabel ? 'AKTIF' : 'NONAKTIF',
          sub: d().variabel.filter(function (v) { return v.aktif; })
                 .reduce(function (a, v) { return a + v.persen; }, 0).toFixed(1) + '% dari omset' })
      ]));

      /* --- fixed cost --- */
      root.appendChild(UI.seksi('Fixed cost bulanan',
        'Dijadwalkan otomatis tiap bulan di tanggal jatuh temponya.',
        UI.tabel([
          { judul: 'Nama pos', render: function (r) {
              return el('div', null, [
                el('div', { class: 'tebal', text: r.nama }),
                el('div', { class: 'muted2', text: CFG.namaCoa(r.coa) })
              ]); },
            cariTeks: function (r) { return r.nama + ' ' + CFG.namaCoa(r.coa); } },
          { judul: 'Jatuh tempo', lebar: '140px', render: function (r) {
              return el('span', { class: 'nowrap', text: 'tgl ' + r.tanggal + ' tiap bulan' }); } },
          { judul: 'Berlaku', lebar: '160px', render: function (r) {
              return el('span', { class: 'muted2 nowrap', text:
                (r.mulai ? UI.namaBulanPendek(r.mulai) : 'awal') + ' – ' + (r.selesai ? UI.namaBulanPendek(r.selesai) : 'seterusnya') }); } },
          { judul: 'Nominal', kelas: 'kanan', lebar: '150px', render: function (r) {
              return el('span', { class: 'tebal', text: UI.rp(r.nominal) }); } },
          { judul: 'Status', lebar: '110px', cari: false, render: function (r) {
              return el('label', { class: 'sakelar', title: r.aktif ? 'Aktif' : 'Nonaktif' }, [
                el('input', { type: 'checkbox', checked: r.aktif ? 'checked' : null,
                  onchange: function () { S.ubah('recurring', r.id, { aktif: !r.aktif }).then(ulang); } }),
                el('span', { class: 'sakelar-jalur' }),
                el('span', { class: 'sakelar-teks', text: r.aktif ? 'Aktif' : 'Mati' })
              ]); } },
          { judul: '', kelas: 'kanan', lebar: '96px', cari: false, render: function (r) {
              return el('div', { class: 'aksi-sel' }, [
                UI.btn('', { ikon: 'edit', kecil: true, gaya: 'btn-ghost', title: 'Edit',
                  onKlik: function () { editorRecurring(r, ulang); } }),
                UI.btn('', { ikon: 'trash', kecil: true, gaya: 'btn-ghost', title: 'Hapus',
                  onKlik: function () {
                    var salinan = Object.assign({}, r);
                    S.hapus('recurring', r.id).then(function () {
                      UI.toast('Fixed cost dihapus', 'sukses',
                        { onUndo: function () { S.tambah('recurring', salinan).then(ulang); } });
                      ulang();
                    });
                  } })
              ]); } }
        ], rec, {
          cari: rec.length > 6,
          kosong: {
            ikon: 'repeat', judul: 'Belum ada fixed cost',
            pesan: 'Gaji, sewa ruko, cicilan — isi sekali di sini, otomatis terjadwal tiap bulan di forecast.',
            aksi: { label: 'Tambah fixed cost', ikon: 'plus', onKlik: function () { editorRecurring(null, ulang); } }
          }
        })));

      /* --- baseline --- */
      var barisBaseline = [];
      CFG.COA_OUT.forEach(function (c) {
        var terjadwal = rec.some(function (r) { return r.aktif && r.coa === c.id; });
        var off = (cfg().baselineOff || []).indexOf(c.id) >= 0;
        var nilai = baseline[c.id] || 0;
        var manual = cfg().baselineOverride && cfg().baselineOverride[c.id] !== undefined;
        if (!nilai && !manual && !terjadwal && !off) return;
        barisBaseline.push({ coa: c, nilai: nilai, manual: manual, terjadwal: terjadwal, off: off });
      });

      var inHari = UI.input({ type: 'number', min: 7, max: 180, value: cfg().baselineHari, class: 'inp inp-mini' });
      inHari.addEventListener('change', function () {
        S.simpanConfig({ baselineHari: Math.max(7, +inHari.value || 30) }).then(ulang);
      });

      root.appendChild(UI.seksi('Baseline operasional harian',
        'Belanja yang jalan hampir tiap hari (supplier, iklan, ops) tidak pernah masuk RAB satu per satu. ' +
        'Tanpa baseline, proyeksi saldo jadi terlalu optimis.',
        el('div', null, [
          el('div', { class: 'alert alert-kuning', style: 'margin-bottom:14px' }, [
            IK('alert', 16),
            el('div', { html: 'Kalau sebuah pos sudah direncanakan detail lewat <b>RAB</b> ' +
              '(mis. PEMBELIAN BARANG MATERIAL / IMPORT), <b>matikan</b> baseline-nya — kalau tidak, dihitung dua kali.' })
          ]),
          UI.tabel([
            { judul: 'Pos pengeluaran', render: function (r) {
                return el('div', null, [
                  el('div', { class: 'tebal', text: r.coa.nama }),
                  el('div', { class: 'muted2' }, [
                    el('span', { class: 'lg-dot', style: 'background:' + CFG.BUCKET[r.coa.bucket].warna }),
                    el('span', { text: ' ' + CFG.BUCKET[r.coa.bucket].label })
                  ])
                ]); },
              cariTeks: function (r) { return r.coa.nama; } },
            { judul: 'Per hari', kelas: 'kanan', lebar: '150px', cari: false, render: function (r) {
                if (r.terjadwal) return el('span', { class: 'muted2', text: 'lewat fixed cost' });
                var inp = el('input', {
                  class: 'sel-inp' + (r.manual ? ' sel-manual' : ' sel-auto'),
                  value: r.off ? '' : UI.grup(r.nilai), disabled: r.off ? 'disabled' : null,
                  title: r.manual ? 'diisi manual' : 'rata-rata ' + cfg().baselineHari + ' hari terakhir'
                });
                inp.addEventListener('focus', function () { inp.select(); });
                inp.addEventListener('change', function () {
                  var ovr = Object.assign({}, cfg().baselineOverride);
                  ovr[r.coa.id] = UI.parseUang(inp.value);
                  S.simpanConfig({ baselineOverride: ovr }).then(function () { UI.toast('Baseline diperbarui', 'sukses'); ulang(); });
                });
                return inp; } },
            { judul: '≈ per bulan', kelas: 'kanan', lebar: '120px', cari: false, render: function (r) {
                return el('span', { class: 'muted2', text: (r.terjadwal || r.off) ? '—' : UI.rpS(r.nilai * 30) }); } },
            { judul: 'Sumber', lebar: '150px', cari: false, render: function (r) {
                if (r.terjadwal) return UI.badge('Fixed cost', 'abu');
                if (r.off) return UI.badge('Dimatikan', 'merah');
                return UI.badge(r.manual ? 'Manual' : 'Rata-rata aktual', r.manual ? 'oranye' : 'biru'); } },
            { judul: '', kelas: 'kanan', lebar: '150px', cari: false, render: function (r) {
                if (r.terjadwal) return el('span');
                return el('div', { class: 'aksi-sel' }, [
                  UI.btn(r.off ? 'Hidupkan' : 'Matikan', { kecil: true, onKlik: function () {
                    var off = (cfg().baselineOff || []).slice();
                    var i = off.indexOf(r.coa.id);
                    if (i >= 0) off.splice(i, 1); else off.push(r.coa.id);
                    S.simpanConfig({ baselineOff: off }).then(ulang);
                  } }),
                  r.manual ? UI.btn('', { ikon: 'refresh', kecil: true, gaya: 'btn-ghost', title: 'Kembalikan ke rata-rata',
                    onKlik: function () {
                      var ovr = Object.assign({}, cfg().baselineOverride);
                      delete ovr[r.coa.id];
                      S.simpanConfig({ baselineOverride: ovr }).then(ulang);
                    } }) : null
                ]); } }
          ], barisBaseline, {
            kosong: { ikon: 'chart', judul: 'Belum ada realisasi',
              pesan: 'Baseline dihitung dari catatan kas keluar. Input aktual dulu supaya angkanya muncul.' }
          })
        ]),
        el('div', { class: 'baris' }, [
          el('span', { class: 'muted2', text: 'Rata-rata' }), inHari, el('span', { class: 'muted2', text: 'hari terakhir' }),
          el('label', { class: 'sakelar' }, [
            el('input', { type: 'checkbox', checked: cfg().pakaiBaseline ? 'checked' : null,
              onchange: function () { S.simpanConfig({ pakaiBaseline: !cfg().pakaiBaseline }).then(ulang); } }),
            el('span', { class: 'sakelar-jalur' }),
            el('span', { class: 'sakelar-teks', text: cfg().pakaiBaseline ? 'Baseline aktif' : 'Baseline mati' })
          ])
        ])));

      /* --- variabel --- */
      root.appendChild(UI.seksi('Biaya variabel (% dari omset)',
        'Kalau aktif, pos ini dihitung sebagai persentase proyeksi omset harian — ikut naik-turun mengikuti skenario.',
        UI.tabel([
          { judul: 'Nama', render: function (r) {
              return el('div', null, [
                el('div', { class: 'tebal', text: r.nama }),
                el('div', { class: 'muted2', text: CFG.namaCoa(r.coa) })
              ]); } },
          { judul: '% dari omset', kelas: 'kanan', lebar: '140px', render: function (r) {
              var inp = el('input', { class: 'sel-inp sel-manual', value: UI.desimal(r.persen, 2) });
              inp.addEventListener('focus', function () { inp.select(); });
              inp.addEventListener('change', function () {
                S.ubah('variabel', r.id, { persen: parseFloat(String(inp.value).replace(',', '.')) || 0 }).then(ulang);
              });
              return inp; } },
          { judul: 'Status', lebar: '120px', render: function (r) {
              return el('label', { class: 'sakelar' }, [
                el('input', { type: 'checkbox', checked: r.aktif ? 'checked' : null,
                  onchange: function () { S.ubah('variabel', r.id, { aktif: !r.aktif }).then(ulang); } }),
                el('span', { class: 'sakelar-jalur' }),
                el('span', { class: 'sakelar-teks', text: r.aktif ? 'Aktif' : 'Mati' })
              ]); } }
        ], d().variabel, { kosong: 'Belum ada biaya variabel.' }),
        el('label', { class: 'sakelar' }, [
          el('input', { type: 'checkbox', checked: cfg().pakaiVariabel ? 'checked' : null,
            onchange: function () { S.simpanConfig({ pakaiVariabel: !cfg().pakaiVariabel }).then(ulang); } }),
          el('span', { class: 'sakelar-jalur' }),
          el('span', { class: 'sakelar-teks', text: cfg().pakaiVariabel ? 'Dipakai di forecast' : 'Tidak dipakai' })
        ])));
    }
  };

  function editorRecurring(existing, ulang) {
    var r = existing || { nama: '', coa: 'out_ops_rena', nominal: 0, tanggal: 1, mulai: '2026-01', selesai: '', aktif: true };
    var inNama = UI.input({ value: r.nama, placeholder: 'mis. Gaji karyawan' });
    var inCoa = UI.pilih(CFG.COA_OUT.map(function (c) { return { value: c.id, label: c.nama }; }), r.coa);
    var inNominal = UI.inputUang(r.nominal);
    var inTgl = UI.input({ type: 'number', min: 1, max: 31, value: r.tanggal });
    var inMulai = UI.input({ type: 'month', value: r.mulai || '' });
    var inSelesai = UI.input({ type: 'month', value: r.selesai || '' });

    var fNama = UI.field('Nama pos', inNama, null, { wajib: true });
    var fNom = UI.field('Nominal per bulan', inNominal, 'Bisa singkat: 450jt · 1,2m', { wajib: true });

    var form = el('div', { class: 'form-grid', style: 'grid-template-columns:1fr 1fr' }, [
      fNama,
      UI.field('Pos cashflow', inCoa, null, { wajib: true }),
      fNom,
      UI.field('Tanggal jatuh tempo', inTgl, 'Bulan yang lebih pendek digeser ke tanggal terakhir'),
      UI.field('Mulai bulan', inMulai),
      UI.field('Sampai bulan', inSelesai, 'Kosongkan = seterusnya')
    ]);

    UI.modal(existing ? 'Edit fixed cost' : 'Tambah fixed cost', form, [
      { label: 'Batal', gaya: 'btn-ghost' },
      { label: 'Simpan', gaya: 'btn-utama', aksi: function () {
          UI.bersihkanSalah(form);
          var patch = {
            nama: inNama.value.trim(), coa: inCoa.value, nominal: UI.nilaiUang(inNominal),
            tanggal: Math.max(1, Math.min(31, +inTgl.value || 1)),
            mulai: inMulai.value, selesai: inSelesai.value, aktif: true
          };
          if (!patch.nama) { UI.salahField(fNama, 'Nama pos wajib diisi'); return false; }
          if (!patch.nominal) { UI.salahField(fNom, 'Nominal belum diisi'); return false; }
          (existing ? S.ubah('recurring', existing.id, patch) : S.tambah('recurring', patch))
            .then(function () { UI.toast('Tersimpan', 'sukses'); if (ulang) ulang(); });
        } }
    ]);
  }

  /* ======================================================================
     HALAMAN: AKTUAL HARIAN
     ====================================================================== */
  HAL.aktual = {
    judul: 'Aktual Harian',
    sub: 'Realisasi kas — jadi titik pijak proyeksi ke depan',
    aksiUtama: { label: 'Catat kas', ikon: 'plus', onKlik: function (ulang) { global.INPUT.kasCepat('in', ulang); } },

    render: function (root, ulang) {
      var bulan = global.APP.aktualBulan || global.APP.hariIni.slice(0, 7);
      var semua = d().actual;
      var rows = semua.filter(function (a) { return String(a.tanggal).slice(0, 7) === bulan; })
                      .sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; });

      var masuk = 0, keluar = 0;
      rows.forEach(function (a) { if (a.tipe === 'in') masuk += a.nominal; else keluar += a.nominal; });
      var cut = E.cutoffAktual(d());
      var saldoKini = cut ? E.saldoAktualPada(d(), cfg(), cut) : cfg().saldoAwal;

      root.appendChild(el('div', { class: 'grid g4' }, [
        UI.kartuKpi({ label: 'Saldo kas terkini', ikon: 'wallet', warna: '#fff7ed', warnaIkon: '#ea580c',
          nilai: UI.rpS(saldoKini), sub: cut ? 'per ' + UI.tglPanjang(cut) : 'dari saldo awal' }),
        UI.kartuKpi({ label: 'Masuk bulan ini', ikon: 'arrowDown', warna: '#ecfdf5', warnaIkon: '#059669',
          nilai: UI.rpS(masuk), sub: UI.namaBulan(bulan) }),
        UI.kartuKpi({ label: 'Keluar bulan ini', ikon: 'arrowUp', warna: '#fff1f2', warnaIkon: '#e11d48',
          nilai: UI.rpS(keluar), sub: UI.namaBulan(bulan) }),
        UI.kartuKpi({ label: 'Net cashflow', ikon: 'scale', warna: '#eff6ff', warnaIkon: '#2563eb',
          nilai: UI.rpS(masuk - keluar), sub: (masuk - keluar) >= 0 ? 'surplus' : 'defisit',
          subKelas: (masuk - keluar) >= 0 ? 'hijau tebal' : 'merah tebal' })
      ]));

      root.appendChild(UI.seksi('Input cepat',
        'Tekan Enter untuk simpan — form tetap terbuka buat entri berikutnya.',
        global.INPUT.formKas({ onSimpan: ulang }),
        UI.btn('Tempel dari sheet', { kecil: true, ikon: 'upload', onKlik: function () { importTempel(ulang); } })));

      var opsiBulan = {}; semua.forEach(function (a) { opsiBulan[String(a.tanggal).slice(0, 7)] = true; });
      opsiBulan[bulan] = true;
      var selBulan = UI.pilih(Object.keys(opsiBulan).sort().reverse().map(function (b) {
        return { value: b, label: UI.namaBulan(b) }; }), bulan,
        function (v) { global.APP.aktualBulan = v; ulang(); }, { class: 'inp inp-ramping' });

      root.appendChild(UI.seksi('Mutasi ' + UI.namaBulan(bulan), rows.length + ' transaksi tercatat',
        UI.tabel([
          { judul: 'Tanggal', lebar: '120px', render: function (r) {
              return el('span', { class: 'nowrap tebal', text: UI.tglPendek(r.tanggal) }); },
            cariTeks: function (r) { return UI.tglPendek(r.tanggal); } },
          { judul: 'Pos', render: function (r) {
              return el('div', null, [
                el('div', { text: CFG.namaCoa(r.coa) }),
                r.catatan ? el('div', { class: 'muted2', text: r.catatan }) : null
              ]); },
            cariTeks: function (r) { return CFG.namaCoa(r.coa) + ' ' + (r.catatan || ''); } },
          { judul: 'Arah', lebar: '100px', cari: false, render: function (r) {
              return UI.badge(r.tipe === 'in' ? 'Masuk' : 'Keluar', r.tipe === 'in' ? 'hijau' : 'merah'); } },
          { judul: 'Nominal', kelas: 'kanan', lebar: '160px', render: function (r) {
              return el('span', { class: (r.tipe === 'in' ? 'hijau' : 'merah') + ' tebal',
                text: (r.tipe === 'in' ? '+' : '−') + UI.rp(r.nominal) }); } },
          { judul: '', kelas: 'kanan', lebar: '52px', cari: false, render: function (r) {
              return UI.btn('', { ikon: 'trash', kecil: true, gaya: 'btn-ghost', title: 'Hapus',
                onKlik: function () {
                  var salinan = Object.assign({}, r);
                  S.hapus('actual', r.id).then(function () {
                    UI.toast('Transaksi dihapus', 'sukses',
                      { onUndo: function () { S.tambah('actual', salinan).then(ulang); } });
                    ulang();
                  });
                } }); } }
        ], rows, {
          cari: rows.length > 8, cariPlaceholder: 'Cari pos, catatan, atau tanggal…', maks: 40,
          kosong: {
            ikon: 'card', judul: 'Belum ada mutasi di bulan ini',
            pesan: 'Catat lewat form di atas, atau tempel sekaligus dari sheet lama.',
            aksi: { label: 'Tempel dari sheet', ikon: 'upload', onKlik: function () { importTempel(ulang); } }
          }
        }), selBulan));
    }
  };

  function importTempel(ulang) {
    var ta = el('textarea', { class: 'inp', rows: 9, placeholder:
      'Tempel langsung dari Google Sheet / Excel.\n\n' +
      'Kolom: TANGGAL · POS · ARAH · NOMINAL · CATATAN\n\n' +
      '01/07/2026\tPENERIMAAN SHOPEE\tin\t145.000.000\tsettlement\n' +
      '01/07/2026\tPEMBAYARAN HUTANG SUPPLIER\tout\t80.000.000' });
    var pratinjau = el('div', { class: 'pratinjau' });
    var hasil = [];

    function parse() {
      var baris = S.parseTabel(ta.value);
      hasil = [];
      var gagal = [];
      baris.forEach(function (kol, no) {
        if (kol.length < 4) { if (kol.join('').trim()) gagal.push(no + 1); return; }
        var tgl = S.keTanggal(kol[0], 2026);
        if (!tgl) { gagal.push(no + 1); return; }
        var namaPos = String(kol[1]).trim().toUpperCase(), coa = null, i;
        for (i = 0; i < CFG.COA_IN.length; i++) if (CFG.COA_IN[i].nama.toUpperCase() === namaPos || CFG.COA_IN[i].id === kol[1]) coa = CFG.COA_IN[i].id;
        for (i = 0; i < CFG.COA_OUT.length; i++) if (CFG.COA_OUT[i].nama.toUpperCase() === namaPos || CFG.COA_OUT[i].id === kol[1]) coa = CFG.COA_OUT[i].id;
        if (!coa) { gagal.push(no + 1); return; }
        var arah = String(kol[2]).trim().toLowerCase();
        arah = (arah === 'in' || arah === 'masuk' || arah === 'debit') ? 'in' : 'out';
        var nominal = S.keAngka(kol[3]);
        if (!nominal) { gagal.push(no + 1); return; }
        hasil.push({ tanggal: tgl, coa: coa, tipe: arah, nominal: nominal, catatan: kol[4] || '' });
      });

      UI.kosongkan(pratinjau);
      if (!ta.value.trim()) return;
      var tIn = hasil.filter(function (h) { return h.tipe === 'in'; }).reduce(function (a, h) { return a + h.nominal; }, 0);
      var tOut = hasil.filter(function (h) { return h.tipe === 'out'; }).reduce(function (a, h) { return a + h.nominal; }, 0);
      pratinjau.appendChild(el('div', { class: 'alert ' + (hasil.length ? 'alert-hijau' : 'alert-merah') }, [
        IK(hasil.length ? 'check' : 'alert', 16),
        el('div', { html: '<b>' + hasil.length + ' baris</b> siap diimpor' +
          (gagal.length ? ' · <b>' + gagal.length + ' baris dilewati</b> (baris ke-' + gagal.slice(0, 8).join(', ') +
            (gagal.length > 8 ? '…' : '') + ')' : '') +
          (hasil.length ? '<br>Masuk ' + UI.rpS(tIn) + ' · Keluar ' + UI.rpS(tOut) : '') })
      ]));
    }
    ta.addEventListener('input', parse);

    var isi = el('div', null, [
      ta, pratinjau,
      el('details', { class: 'lipat' }, [
        el('summary', { text: 'Daftar nama POS yang dikenali' }),
        el('div', { class: 'lipat-isi' }, [
          el('div', { class: 'muted2 tebal', text: 'PENERIMAAN' }),
          el('p', { class: 'muted2', text: CFG.COA_IN.map(function (c) { return c.nama; }).join(' · ') }),
          el('div', { class: 'muted2 tebal', style: 'margin-top:8px', text: 'PENGELUARAN' }),
          el('p', { class: 'muted2', text: CFG.COA_OUT.map(function (c) { return c.nama; }).join(' · ') })
        ])
      ])
    ]);

    UI.modal('Tempel data dari sheet', isi, [
      { label: 'Batal', gaya: 'btn-ghost' },
      { label: 'Impor', gaya: 'btn-utama', aksi: function () {
          if (!hasil.length) { UI.toast('Belum ada baris valid', 'warn'); return false; }
          Promise.all(hasil.map(function (h) { return S.tambah('actual', h); })).then(function () {
            UI.toast(hasil.length + ' transaksi terimpor', 'sukses');
            if (ulang) ulang();
          });
        } }
    ], { lebar: 'lebar', sub: 'Kolom dipisah TAB, koma, atau titik koma' });
  }

  /* ======================================================================
     HALAMAN: PENGATURAN
     ====================================================================== */
  HAL.setting = {
    judul: 'Pengaturan',
    sub: 'Saldo awal, ambang kas, pengakuan penerimaan, dan koneksi sheet',
    render: function (root, ulang) {
      var c = cfg();
      var mode = S.mode();

      var info = {
        sheet: ['alert-hijau', 'shield', 'Terhubung ke Google Sheet. Semua perubahan tersimpan otomatis.'],
        lokal: ['alert-kuning', 'alert', 'Mode lokal — data cuma di browser ini. Isi <b>APPS_SCRIPT_URL</b> di <code>assets/config.js</code> untuk sinkron ke sheet.'],
        demo:  ['alert-biru', 'info', 'Mode demo — data contoh Juli 2026, tidak tersimpan permanen. Ikuti <code>apps-script/README.md</code> untuk menyambungkan sheet.']
      }[mode];

      root.appendChild(el('div', { class: 'alert ' + info[0] }, [
        IK(info[1], 17),
        el('div', { html: info[2] + '<br>Spreadsheet tujuan: <a href="' + CFG.CONN.SHEET_URL +
          '" target="_blank" rel="noopener">Finance Dashboard</a>' +
          (S.state.error ? '<br><b>Error terakhir:</b> ' + S.state.error : '') })
      ]));

      /* --- parameter kas --- */
      var inSaldo = UI.inputUang(c.saldoAwal);
      var inSaldoTgl = UI.input({ type: 'date', value: c.saldoAwalTanggal });
      var inBahaya = UI.inputUang(c.ambangBahaya);
      var inWaspada = UI.inputUang(c.ambangWaspada);
      var inLag = UI.input({ type: 'number', min: 0, max: 60, value: c.lagDefault });
      var inRMB = UI.inputUang(c.kursRMB);
      var inUSD = UI.inputUang(c.kursUSD);

      root.appendChild(UI.seksi('Parameter kas', 'Dipakai oleh seluruh perhitungan proyeksi.',
        el('div', { class: 'form-grid', style: 'grid-template-columns:repeat(2,minmax(0,1fr))' }, [
          UI.field('Saldo kas awal', inSaldo, 'Saldo rekening pada tanggal di sebelah', { wajib: true }),
          UI.field('Tanggal saldo awal', inSaldoTgl, 'Semua mutasi aktual dihitung setelah tanggal ini'),
          UI.field('Ambang bahaya', inBahaya, 'Garis merah di grafik — di bawah ini memicu peringatan'),
          UI.field('Ambang waspada', inWaspada, 'Zona kuning di kalender kas'),
          UI.field('Lag pengakuan kas (hari)', inLag, 'Default H+5: GMV tanggal D diakui finance di D+5'),
          UI.field('Kurs RMB', inRMB, 'Acuan di form RAB'),
          UI.field('Kurs USD', inUSD)
        ]),
        UI.btn('Simpan', { gaya: 'btn-utama', ikon: 'check', onKlik: function () {
          S.simpanConfig({
            saldoAwal: UI.nilaiUang(inSaldo), saldoAwalTanggal: inSaldoTgl.value,
            ambangBahaya: UI.nilaiUang(inBahaya), ambangWaspada: UI.nilaiUang(inWaspada),
            lagDefault: +inLag.value || 0, kursRMB: UI.nilaiUang(inRMB), kursUSD: UI.nilaiUang(inUSD)
          }).then(function () { UI.toast('Pengaturan tersimpan', 'sukses'); ulang(); });
        } })));

      /* --- channel --- */
      function simpanChannel() {
        S.simpanConfig({ channelOverride: CFG.CHANNELS.map(function (ch) {
          return { id: ch.id, lag: ch.lag, netto: ch.netto }; }) })
          .then(function () { UI.toast('Setelan channel tersimpan', 'sukses'); });
      }

      root.appendChild(UI.seksi('Pengakuan kas per channel',
        'Lag = berapa hari setelah transaksi uang benar-benar masuk rekening. ' +
        'Netto % = porsi GMV yang jadi kas setelah fee marketplace, retur, dan cancel.',
        UI.tabel([
          { judul: 'Channel', render: function (ch) {
              return el('div', null, [
                el('div', { class: 'tebal', text: ch.nama }),
                el('div', { class: 'muted2', text: CFG.namaCoa(ch.coa) })
              ]); } },
          { judul: 'Lag (hari)', kelas: 'kanan', lebar: '130px', render: function (ch) {
              var inp = el('input', { class: 'sel-inp sel-manual', type: 'number', value: ch.lag, min: 0, max: 60 });
              inp.addEventListener('change', function () { ch.lag = +inp.value || 0; simpanChannel(); });
              return inp; } },
          { judul: 'Netto % dari GMV', kelas: 'kanan', lebar: '170px', render: function (ch) {
              var inp = el('input', { class: 'sel-inp sel-manual', type: 'number', value: ch.netto, min: 0, max: 200, step: 0.5 });
              inp.addEventListener('change', function () { ch.netto = parseFloat(inp.value) || 0; simpanChannel(); });
              return inp; } }
        ], CFG.CHANNELS)));

      /* --- pola --- */
      root.appendChild(UI.seksi('Pola sebaran target harian',
        'Bobot relatif tiap tanggal saat target bulanan dipecah ke harian. Total selalu dinormalisasi ke target bulanan.',
        UI.tabel([
          { judul: 'Jenis hari', kunci: 'label' },
          { judul: 'Bobot', kelas: 'kanan', lebar: '140px', render: function (r) {
              var inp = el('input', { class: 'sel-inp sel-manual', type: 'number', step: 0.05, value: CFG.POLA[r.k] });
              inp.addEventListener('change', function () {
                CFG.POLA[r.k] = parseFloat(inp.value) || 1;
                S.simpanConfig({ pola: CFG.POLA }).then(function () { UI.toast('Pola diperbarui', 'sukses'); ulang(); });
              });
              return inp; } }
        ], [
          { k: 'weekday', label: 'Hari kerja (Sen–Jum)' },
          { k: 'weekend', label: 'Akhir pekan (Sab–Min)' },
          { k: 'tanggalKembar', label: 'Tanggal kembar (8.8, 9.9, 12.12)' },
          { k: 'midMonth', label: 'Tanggal 15' },
          { k: 'payday', label: 'Tanggal 25–27 (gajian)' },
          { k: 'akhirBulan', label: 'Tanggal 28–akhir' }
        ])));

      /* --- data --- */
      root.appendChild(UI.seksi('Data', 'Hati-hati — tindakan di bawah tidak bisa dibatalkan.',
        el('div', { class: 'baris' }, [
          UI.btn('Unduh backup JSON', { ikon: 'download', onKlik: function () {
            var blob = new Blob([JSON.stringify(d(), null, 2)], { type: 'application/json' });
            var a = el('a', { href: URL.createObjectURL(blob), download: 'antarestar-cashflow-' + global.APP.hariIni + '.json' });
            document.body.appendChild(a); a.click(); a.remove();
            UI.toast('Backup terunduh', 'sukses');
          } }),
          UI.btn('Muat ulang dari sheet', { ikon: 'refresh', onKlik: function () {
            S.muat().then(function () { UI.toast('Data dimuat ulang', 'sukses'); ulang(); });
          } }),
          UI.btn('Pintasan keyboard', { ikon: 'command', onKlik: function () { global.UX.bantuan(); } }),
          el('div', { class: 'spacer' }),
          UI.btn('Reset data lokal', { gaya: 'btn-danger', ikon: 'trash', onKlik: function () {
            UI.konfirmasi('Reset data lokal?',
              'Data di browser ini dihapus dan diganti data demo. Data di Google Sheet tidak terpengaruh.',
              function () { S.resetLokal(); location.reload(); });
          } })
        ])));
    }
  };

  HAL._editorRab = editorRab;
  HAL._editorRecurring = editorRecurring;
  HAL._importTempel = importTempel;
})(window);
