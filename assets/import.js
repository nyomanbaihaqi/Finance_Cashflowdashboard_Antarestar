/* ============================================================================
   ANTARESTAR — CASHFLOW PROJECTION
   import.js — wizard unggah sheet: deteksi layout → cocokkan pos → konfirmasi

   Alur: pilih file → pilih sheet → tinjau hasil pencocokan pos → impor.
   Tidak ada yang tersimpan sebelum tombol "Impor" ditekan.
   ========================================================================== */
(function (global) {
  'use strict';

  var UI = global.UI, CFG = global.CFG, E = global.ENGINE, S = global.STORE, IK = global.IK;
  var el = UI.el;

  var BULAN_KATA = {
    jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4,
    mei: 5, may: 5, jun: 6, juni: 6, jul: 7, juli: 7, agu: 8, agt: 8, agus: 8,
    agust: 8, agustus: 8, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
    okt: 10, oct: 10, oktober: 10, october: 10, nov: 11, november: 11,
    des: 12, dec: 12, desember: 12, december: 12
  };

  /* ------------------------------------------------------- normalisasi */
  function normal(s) {
    return String(s === null || s === undefined ? '' : s)
      .toUpperCase()
      .replace(/[^\wÀ-ÿ ]+/g, ' ')     /* buang tanda baca: ( ) & / , . - */
      .replace(/\s+/g, ' ')
      .trim();
  }

  function token(s) {
    return normal(s).split(' ').filter(function (t) { return t.length > 2; });
  }

  /* Skor kemiripan 0–1 antara nama sumber dan nama COA. */
  function skor(a, b) {
    var na = normal(a), nb = normal(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    if (nb.indexOf(na) === 0 || na.indexOf(nb) === 0) return 0.92;
    if (nb.indexOf(na) >= 0 || na.indexOf(nb) >= 0) return 0.85;

    var ta = token(a), tb = token(b);
    if (!ta.length || !tb.length) return 0;
    var sama = 0;
    ta.forEach(function (t) { if (tb.indexOf(t) >= 0) sama++; });
    var jaccard = sama / (ta.length + tb.length - sama);
    return jaccard * 0.8;
  }

  function arahCoa(id) { return String(id).indexOf('out_') === 0 ? 'out' : 'in'; }

  /* Cari COA paling cocok.
       arah  : dugaan arah — dipakai sebagai bonus kecil, bukan penyaring keras,
               karena banyak sheet tidak punya baris penanda "PENGELUARAN".
       paksa : true → hanya cari di arah tersebut (dipakai saat pengguna
               mengubah arah secara manual di tabel pemetaan). */
  function cocokkan(nama, arah, paksa) {
    var alias = CFG.ALIAS_IMPOR[normal(nama)];
    if (alias && (!paksa || arahCoa(alias) === arah)) {
      return { coa: alias, nilai: 1, alias: true };
    }

    var kandidat = paksa
      ? (arah === 'in' ? CFG.COA_IN : CFG.COA_OUT)
      : CFG.COA_IN.concat(CFG.COA_OUT);

    var terbaik = null;
    kandidat.forEach(function (c) {
      var n = skor(nama, c.nama);
      if (!paksa && arah && arahCoa(c.id) === arah) n += 0.08;   /* condong ke seksi */
      if (!terbaik || n > terbaik.nilai) terbaik = { coa: c.id, nilai: Math.min(n, 0.99) };
    });
    return terbaik && terbaik.nilai >= 0.34 ? terbaik : { coa: null, nilai: terbaik ? terbaik.nilai : 0 };
  }

  function diabaikan(nama) {
    var n = normal(nama);
    if (!n) return true;
    if (CFG.BARIS_ABAIKAN.indexOf(n) >= 0) return true;
    return /^(I|II|III|IV|V|NO)$/.test(n);
  }

  /* ---------------------------------------------------- deteksi layout */
  /* Cari baris header (berisi >=3 tanggal atau nama bulan) + kolom deskripsi. */
  function deteksi(grid) {
    var barisHeader = -1, periode = [], jenis = '';

    for (var r = 0; r < Math.min(grid.length, 20); r++) {
      var baris = grid[r] || [];
      var tgl = [], bln = [];
      for (var c = 0; c < baris.length; c++) {
        var v = baris[c];
        if (v === undefined || v === null || v === '') continue;
        if (global.XLSX.mungkinTanggal(v)) { tgl.push({ kol: c, kunci: global.XLSX.serialKeTanggal(v) }); continue; }
        var m = String(v).trim().toLowerCase().replace(/[^a-z0-9\- ]/g, '');
        if (BULAN_KATA[m]) { bln.push({ kol: c, bulanNo: BULAN_KATA[m], label: String(v).trim() }); continue; }
        var my = /^(\d{4})-(\d{1,2})$/.exec(m);
        if (my) { bln.push({ kol: c, bulanNo: +my[2], tahun: +my[1], label: m }); continue; }
      }
      if (tgl.length >= 3) { barisHeader = r; periode = tgl; jenis = 'harian'; break; }
      if (bln.length >= 3) { barisHeader = r; periode = bln; jenis = 'bulanan'; break; }
    }

    if (barisHeader < 0) return null;

    /* kolom deskripsi = kolom dengan teks terbanyak di bawah header,
       dibatasi 6 kolom pertama (kolom periode biasanya di kanan) */
    var batas = periode[0].kol;
    var skorKol = [];
    for (var k = 0; k < Math.min(batas, 8); k++) {
      var n = 0;
      for (var rr = barisHeader + 1; rr < grid.length; rr++) {
        var v2 = (grid[rr] || [])[k];
        if (typeof v2 === 'string' && v2.trim().length > 3) n++;
      }
      skorKol.push({ kol: k, n: n });
    }
    skorKol.sort(function (a, b) { return b.n - a.n; });
    var kolDesk = skorKol.length && skorKol[0].n > 0 ? skorKol[0].kol : 1;

    return { barisHeader: barisHeader, periode: periode, jenis: jenis, kolDesk: kolDesk };
  }

  /* Bangun daftar baris pos + arah (in/out) berdasar penanda seksi. */
  function bacaBaris(grid, tata) {
    var out = [], arah = null;

    for (var r = tata.barisHeader + 1; r < grid.length; r++) {
      var baris = grid[r] || [];
      var desk = baris[tata.kolDesk];
      if (typeof desk !== 'string') continue;
      var n = normal(desk);
      if (!n) continue;

      /* penanda seksi mengubah arah untuk baris-baris di bawahnya */
      if (/^PENERIMAAN$/.test(n) || /^II PENERIMAAN$/.test(n)) { arah = 'in'; continue; }
      if (/^PENGELUARAN$/.test(n) || /^III PENGELUARAN$/.test(n)) { arah = 'out'; continue; }
      if (diabaikan(desk)) continue;

      var nilai = {}, ada = false, total = 0;
      tata.periode.forEach(function (p) {
        var v = baris[p.kol];
        if (typeof v !== 'number' || !isFinite(v) || v === 0) return;
        nilai[p.kol] = v;
        total += Math.abs(v);
        ada = true;
      });
      if (!ada) continue;

      /* Penanda seksi cuma jadi dugaan awal. Arah final diambil dari pos hasil
         pencocokan — banyak sheet punya "II PENERIMAAN" tapi lupa menulis
         "III PENGELUARAN", sehingga seluruh biaya ikut terbaca sebagai masuk. */
      var cocok = cocokkan(desk, arah, false);
      var arahBaris = cocok.coa ? arahCoa(cocok.coa) : (arah || 'out');
      out.push({
        baris: r, sumber: desk.trim(), arah: arahBaris,
        coa: cocok.coa, keyakinan: cocok.nilai, alias: !!cocok.alias,
        nilai: nilai, total: total, pakai: !!cocok.coa
      });
    }
    return out;
  }

  /* ==========================================================================
     UI
     ========================================================================== */
  function buka(onSelesai) {
    var st = {
      namaFile: '', wb: null, sheetIdx: 0, tata: null, rows: [],
      mode: '', hariRab: 15, divisiRab: 'FINANCE', ikutTarget: true, tahun: 2026
    };

    var isi = el('div', { class: 'impor' });
    /* satu tombol awal supaya elemen .modal-footer ada dan bisa diisi ulang
       tiap kali pindah langkah */
    var m = UI.modal('Unggah sheet cashflow', isi, [{ label: 'Tutup', gaya: 'btn-ghost' }], {
      lebar: 'penuh',
      sub: 'Tidak ada yang tersimpan sebelum kamu menekan Impor.'
    });

    function setKaki(tombol) {
      var f = m.box.querySelector('.modal-footer');
      if (!f) return;
      UI.kosongkan(f);
      tombol.forEach(function (t) {
        f.appendChild(el('button', {
          class: 'btn ' + (t.gaya || 'btn-ghost'), type: 'button', text: t.label,
          disabled: t.nonaktif ? 'disabled' : null,
          onclick: function () { if (!t.aksi || t.aksi() !== false) m.tutup(); }
        }));
      });
    }

    /* ------------------------------------------------ langkah 1: file */
    function langkahFile(pesanError) {
      UI.kosongkan(isi);

      var input = el('input', {
        type: 'file', accept: '.xlsx,.csv,.tsv,text/csv', class: 'file-sembunyi', id: 'inp-file'
      });

      var zona = el('label', { class: 'dropzone', for: 'inp-file' }, [
        el('div', { class: 'dz-ikon' }, IK('upload', 26)),
        el('div', { class: 'dz-judul', text: 'Taruh file di sini atau klik untuk memilih' }),
        el('div', { class: 'dz-teks', text: 'Format .xlsx dari Excel / Google Sheets, atau .csv' }),
        input
      ]);

      ['dragover', 'dragenter'].forEach(function (ev) {
        zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.add('aktif'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.remove('aktif'); });
      });
      zona.addEventListener('drop', function (e) {
        if (e.dataTransfer.files && e.dataTransfer.files[0]) muatFile(e.dataTransfer.files[0]);
      });
      input.addEventListener('change', function () { if (input.files[0]) muatFile(input.files[0]); });

      isi.appendChild(zona);

      if (pesanError) {
        isi.appendChild(el('div', { class: 'alert alert-merah', style: 'margin-top:14px' }, [
          IK('alert', 16), el('div', { text: pesanError })
        ]));
      }

      if (!global.XLSX.didukung()) {
        isi.appendChild(el('div', { class: 'alert alert-kuning', style: 'margin-top:14px' }, [
          IK('alert', 16),
          el('div', { html: 'Browser ini belum bisa membuka <b>.xlsx</b> langsung. ' +
            'Buka sheet-nya lalu <b>File → Download → CSV</b>, unggah file CSV-nya di sini.' })
        ]));
      }

      isi.appendChild(el('div', { class: 'impor-info' }, [
        el('div', { class: 'impor-info-judul' }, [IK('info', 15), el('span', { text: 'Layout yang dikenali' })]),
        el('ul', { class: 'impor-list' }, [
          el('li', { html: '<b>Mutasi harian</b> — kolom deskripsi berisi nama pos, baris header berisi tanggal. Masuk ke <b>Aktual Harian</b>.' }),
          el('li', { html: '<b>Rencana bulanan</b> — baris header berisi nama bulan (Agust, Sep, …). Pengeluaran jadi <b>RAB</b>, penerimaan jadi <b>target bulanan</b>.' }),
          el('li', { html: 'Baris <i>SALDO AWAL</i>, <i>TOTAL</i>, dan penanda seksi otomatis dilewati.' })
        ])
      ]));

      setKaki([{ label: 'Tutup', gaya: 'btn-ghost' }]);
    }

    function muatFile(file) {
      st.namaFile = file.name;
      UI.kosongkan(isi);
      isi.appendChild(el('div', { class: 'impor-muat' }, [
        el('div', { class: 'spin' }),
        el('div', { text: 'Membaca ' + file.name + '…' })
      ]));
      setKaki([{ label: 'Batal', gaya: 'btn-ghost' }]);

      var csv = /\.(csv|tsv|txt)$/i.test(file.name);
      var baca = csv
        ? file.text().then(function (t) { return global.XLSX.bacaCsv(t); })
        : file.arrayBuffer().then(function (ab) { return global.XLSX.baca(ab, { batasBaris: 400, batasKolom: 60 }); });

      baca.then(function (wb) {
        st.wb = wb;
        var isiSheet = wb.sheets.filter(function (s) { return s.grid.length; });
        if (!isiSheet.length) throw new Error('Tidak ada sheet berisi data di file ini.');
        st.sheetIdx = wb.sheets.indexOf(isiSheet[0]);
        /* pilih sheet pertama yang layoutnya terbaca */
        for (var i = 0; i < wb.sheets.length; i++) {
          if (wb.sheets[i].tersembunyi) continue;
          if (deteksi(wb.sheets[i].grid)) { st.sheetIdx = i; break; }
        }
        langkahSheet();
      }).catch(function (e) {
        langkahFile(e && e.message ? e.message : String(e));
      });
    }

    /* ----------------------------------------------- langkah 2: sheet */
    function langkahSheet() {
      UI.kosongkan(isi);

      isi.appendChild(el('div', { class: 'impor-file' }, [
        IK('sheet', 16),
        el('span', { class: 'tebal', text: st.namaFile }),
        el('span', { class: 'muted2', text: st.wb.sheets.length + ' sheet' }),
        el('div', { class: 'spacer' }),
        UI.btn('Ganti file', { kecil: true, ikon: 'refresh', onKlik: function () { langkahFile(); } })
      ]));

      var daftar = el('div', { class: 'sheet-grid' });
      st.wb.sheets.forEach(function (s, i) {
        var tata = deteksi(s.grid);
        var jml = tata ? bacaBaris(s.grid, tata).length : 0;
        var bisa = !!tata && jml > 0;

        daftar.appendChild(el('button', {
          class: 'sheet-kartu' + (i === st.sheetIdx ? ' aktif' : '') + (bisa ? '' : ' mati'),
          type: 'button', disabled: bisa ? null : 'disabled',
          onclick: function () { st.sheetIdx = i; langkahSheet(); }
        }, [
          el('div', { class: 'sheet-nama', text: s.nama }),
          el('div', { class: 'sheet-meta' }, bisa ? [
            UI.badge(tata.jenis === 'harian' ? 'Harian' : 'Bulanan', tata.jenis === 'harian' ? 'biru' : 'oranye'),
            el('span', { class: 'muted2', text: jml + ' pos · ' + tata.periode.length + ' periode' })
          ] : [
            el('span', { class: 'muted2', text: s.grid.length ? 'layout tidak dikenali' : 'kosong' })
          ])
        ]));
      });
      isi.appendChild(daftar);

      var s = st.wb.sheets[st.sheetIdx];
      st.tata = deteksi(s.grid);
      if (!st.tata) {
        isi.appendChild(el('div', { class: 'alert alert-merah', style: 'margin-top:14px' }, [
          IK('alert', 16),
          el('div', { html: 'Layout sheet <b>' + s.nama + '</b> tidak dikenali. Sheet harus punya satu baris ' +
            'berisi tanggal atau nama bulan, dan satu kolom berisi nama pos.' })
        ]));
        setKaki([{ label: 'Tutup', gaya: 'btn-ghost' }]);
        return;
      }

      st.rows = bacaBaris(s.grid, st.tata);
      st.mode = st.tata.jenis;

      /* tahun untuk header bulanan yang tidak menyebut tahun */
      var adaTahun = st.tata.periode.some(function (p) { return p.tahun; });
      if (!adaTahun) st.tahun = 2026;

      isi.appendChild(el('div', { class: 'alert alert-hijau', style: 'margin-top:14px' }, [
        IK('check', 16),
        el('div', { html: 'Terbaca sebagai <b>' + (st.mode === 'harian' ? 'mutasi harian' : 'rencana bulanan') +
          '</b> — ' + st.rows.length + ' pos, ' + st.tata.periode.length + ' periode ' +
          '(' + labelPeriode(st.tata.periode[0]) + ' – ' + labelPeriode(st.tata.periode[st.tata.periode.length - 1]) + ').' })
      ]));

      setKaki([
        { label: 'Batal', gaya: 'btn-ghost' },
        { label: 'Lanjut — tinjau pos', gaya: 'btn-utama', aksi: function () { langkahPeta(); return false; } }
      ]);
    }

    function labelPeriode(p) {
      if (!p) return '—';
      if (p.kunci) return UI.tglPendek(p.kunci);
      return (p.label || UI.BULAN_PENDEK[p.bulanNo - 1]);
    }

    function bulanKunci(p) {
      return (p.tahun || st.tahun) + '-' + E.pad(p.bulanNo);
    }

    /* ------------------------------------------ langkah 3: peta & konfirmasi */
    function langkahPeta() {
      UI.kosongkan(isi);

      var opsiIn = CFG.COA_IN.map(function (c) { return { value: c.id, label: c.nama }; });
      var opsiOut = CFG.COA_OUT.map(function (c) { return { value: c.id, label: c.nama }; });

      /* ---- pengaturan tujuan ---- */
      var setelan = el('div', { class: 'impor-setelan' });
      if (st.mode === 'bulanan') {
        var inHari = UI.input({ type: 'number', min: 1, max: 28, value: st.hariRab, class: 'inp inp-mini' });
        inHari.addEventListener('change', function () { st.hariRab = Math.max(1, Math.min(28, +inHari.value || 15)); });

        var selDivisi = UI.pilih(CFG.DIVISI.map(function (x) { return { value: x, label: x }; }), st.divisiRab,
          function (v) { st.divisiRab = v; });

        var inTahun = UI.input({ type: 'number', min: 2024, max: 2030, value: st.tahun, class: 'inp inp-mini' });
        inTahun.addEventListener('change', function () { st.tahun = +inTahun.value || 2026; gambarTabel(); });

        var swTarget = el('label', { class: 'sakelar' }, [
          el('input', { type: 'checkbox', checked: st.ikutTarget ? 'checked' : null,
            onchange: function () { st.ikutTarget = this.checked; gambarTabel(); } }),
          el('span', { class: 'sakelar-jalur' }),
          el('span', { class: 'sakelar-teks', text: 'Ikut impor penerimaan jadi target' })
        ]);

        setelan.appendChild(el('div', { class: 'form-grid', style: 'grid-template-columns:repeat(4,minmax(0,1fr))' }, [
          UI.field('Tahun', inTahun, 'Header sheet tidak menyebut tahun'),
          UI.field('Divisi untuk RAB', selDivisi),
          UI.field('Tanggal rencana', inHari, 'Pengeluaran bulanan ditaruh di tanggal ini'),
          UI.field('Penerimaan', swTarget, 'Dibalik jadi target GMV: nominal ÷ netto%')
        ]));

        if (st.ikutTarget) {
          /* Satu pos penerimaan bisa dipakai beberapa channel (mis. PENERIMAAN
             SHOPEE dipakai Shopee Mall + Shopee Antarestar). Sheet tidak memisah
             keduanya, jadi seluruh nilai ditaruh ke channel pertama. */
          var ganda = {};
          CFG.CHANNELS.forEach(function (c) { (ganda[c.coa] = ganda[c.coa] || []).push(c.nama); });
          var pesan = [];
          st.rows.forEach(function (r) {
            if (r.arah !== 'in' || !r.coa) return;
            var d = ganda[r.coa];
            if (d && d.length > 1 && pesan.indexOf(d[0]) < 0) pesan.push(d[0] + ' (bukan ' + d.slice(1).join(', ') + ')');
          });
          if (pesan.length) {
            setelan.appendChild(el('div', { class: 'alert alert-kuning', style: 'margin-top:12px' }, [
              IK('info', 16),
              el('div', { html: 'Sheet tidak memisah target per toko, jadi seluruh nilai ditaruh ke channel pertama: <b>' +
                pesan.join('</b>, <b>') + '</b>. Pecah manual di halaman <b>Target Digicom</b> kalau perlu.' })
            ]));
          }
        }
      } else {
        setelan.appendChild(el('div', { class: 'alert alert-biru' }, [
          IK('info', 16),
          el('div', { html: 'Setiap sel bernilai jadi satu baris di <b>Aktual Harian</b>. ' +
            'Baris yang sudah ada di tanggal & pos yang sama <b>tidak</b> ditimpa — cek dulu supaya tidak dobel.' })
        ]));
      }
      isi.appendChild(setelan);

      /* ---- ringkasan ---- */
      var ringkas = el('div', { class: 'grid g4', style: 'margin:14px 0' });
      isi.appendChild(ringkas);

      /* ---- tabel pemetaan ---- */
      var wadahTabel = el('div');
      isi.appendChild(wadahTabel);

      function gambarRingkas() {
        UI.kosongkan(ringkas);
        var dipakai = st.rows.filter(function (r) { return r.pakai && r.coa; });
        var masuk = 0, keluar = 0, sel = 0;
        dipakai.forEach(function (r) {
          var t = 0;
          for (var k in r.nilai) if (r.nilai.hasOwnProperty(k)) { t += r.nilai[k]; sel++; }
          if (r.arah === 'in') masuk += t; else keluar += t;
        });
        var ragu = st.rows.filter(function (r) { return r.pakai && r.coa && r.keyakinan < 0.7 && !r.alias; }).length;

        ringkas.appendChild(UI.kartuKpi({ label: 'Pos dipakai', ikon: 'check', warna: '#ecfdf5', warnaIkon: '#059669',
          nilai: dipakai.length + ' / ' + st.rows.length, sub: sel + ' nilai akan diimpor' }));
        ringkas.appendChild(UI.kartuKpi({ label: 'Total penerimaan', ikon: 'arrowDown', warna: '#ecfdf5', warnaIkon: '#059669',
          nilai: UI.rpS(masuk), sub: st.mode === 'bulanan' ? (st.ikutTarget ? 'jadi target bulanan' : 'diabaikan') : 'jadi mutasi masuk' }));
        ringkas.appendChild(UI.kartuKpi({ label: 'Total pengeluaran', ikon: 'arrowUp', warna: '#fff1f2', warnaIkon: '#e11d48',
          nilai: UI.rpS(keluar), sub: st.mode === 'bulanan' ? 'jadi RAB draft' : 'jadi mutasi keluar' }));
        ringkas.appendChild(UI.kartuKpi({ label: 'Perlu dicek', ikon: 'alert',
          warna: ragu ? '#fffbeb' : '#f8fafc', warnaIkon: ragu ? '#b45309' : '#94a3b8',
          nilai: String(ragu), sub: ragu ? 'kecocokan nama kurang yakin' : 'semua cocok meyakinkan' }));
      }

      function gambarTabel() {
        UI.kosongkan(wadahTabel);
        gambarRingkas();

        wadahTabel.appendChild(UI.tabel([
          { judul: '', kelas: 'tengah', lebar: '44px', cari: false, render: function (r) {
              var cb = el('input', { type: 'checkbox', class: 'cek-kotak',
                checked: r.pakai ? 'checked' : null, disabled: r.coa ? null : 'disabled',
                'aria-label': 'Ikut impor' });
              cb.addEventListener('change', function () { r.pakai = cb.checked; gambarRingkas(); });
              return cb; } },
          { judul: 'Nama di sheet', render: function (r) {
              return el('div', null, [
                el('div', { class: 'tebal', text: r.sumber }),
                el('div', { class: 'muted2', text: 'baris ' + (r.baris + 1) + ' · ' +
                  Object.keys(r.nilai).length + ' nilai' })
              ]); },
            cariTeks: function (r) { return r.sumber; } },
          { judul: 'Arah', lebar: '104px', cari: false, render: function (r) {
              var sel = UI.pilih([{ value: 'in', label: 'Masuk' }, { value: 'out', label: 'Keluar' }], r.arah,
                function (v) {
                  r.arah = v;
                  var c = cocokkan(r.sumber, v, true);   /* dikunci ke arah pilihan pengguna */
                  r.coa = c.coa; r.keyakinan = c.nilai; r.alias = !!c.alias; r.pakai = !!c.coa;
                  gambarTabel();
                }, { class: 'inp sel-status ' + (r.arah === 'in' ? 'sel-hijau' : 'sel-merah') });
              return sel; } },
          { judul: 'Dipetakan ke pos', render: function (r) {
              var sel = UI.pilih(
                [{ value: '', label: '— jangan impor —' }].concat(r.arah === 'in' ? opsiIn : opsiOut),
                r.coa || '', function (v) {
                  r.coa = v || null;
                  r.keyakinan = v ? 1 : 0;
                  r.alias = false;
                  r.pakai = !!v;
                  gambarTabel();
                }, { class: 'inp' });
              return sel; },
            cariTeks: function (r) { return r.coa ? CFG.namaCoa(r.coa) : ''; } },
          { judul: 'Kecocokan', lebar: '128px', cari: false, render: function (r) {
              if (!r.coa) return UI.badge('Tidak ketemu', 'merah');
              if (r.alias) return UI.badge('Alias', 'biru');
              if (r.keyakinan >= 0.99) return UI.badge('Persis', 'hijau');
              if (r.keyakinan >= 0.7) return UI.badge('Mirip', 'hijau');
              return UI.badge('Kurang yakin', 'kuning'); } },
          { judul: 'Total', kelas: 'kanan', lebar: '140px', cari: false, render: function (r) {
              var t = 0;
              for (var k in r.nilai) if (r.nilai.hasOwnProperty(k)) t += r.nilai[k];
              return el('span', { class: (r.arah === 'in' ? 'hijau' : 'merah') + ' tebal', text: UI.rpS(t) }); } }
        ], st.rows, {
          cari: st.rows.length > 8,
          cariPlaceholder: 'Cari nama pos…',
          kelasBaris: function (r) { return (!r.coa || !r.pakai) ? 'baris-redup' : ''; },
          kosong: { ikon: 'inbox', judul: 'Tidak ada pos terbaca', pesan: 'Sheet ini tidak punya baris dengan nama pos dan nilai angka.' }
        }));

        var takCocok = st.rows.filter(function (r) { return !r.coa; });
        if (takCocok.length) {
          wadahTabel.appendChild(el('div', { class: 'alert alert-kuning', style: 'margin-top:12px' }, [
            IK('alert', 16),
            el('div', { html: '<b>' + takCocok.length + ' pos</b> tidak ketemu padanannya: ' +
              takCocok.slice(0, 6).map(function (r) { return r.sumber; }).join(' · ') +
              (takCocok.length > 6 ? ' …' : '') +
              '<br>Pilih pos tujuannya manual di kolom <i>Dipetakan ke pos</i>, atau biarkan — baris itu akan dilewati.' })
          ]));
        }
      }
      gambarTabel();

      setKaki([
        { label: 'Kembali', gaya: 'btn-ghost', aksi: function () { langkahSheet(); return false; } },
        { label: 'Impor sekarang', gaya: 'btn-utama', aksi: function () { jalankanImpor(); return false; } }
      ]);
    }

    /* --------------------------------------------------- eksekusi impor */
    function jalankanImpor() {
      var dipakai = st.rows.filter(function (r) { return r.pakai && r.coa; });
      if (!dipakai.length) { UI.toast('Belum ada pos yang dipilih', 'warn'); return; }

      var aksi = [], ringkasan = { aktual: 0, rab: 0, target: 0 };

      if (st.mode === 'harian') {
        dipakai.forEach(function (r) {
          st.tata.periode.forEach(function (p) {
            var v = r.nilai[p.kol];
            if (!v) return;
            aksi.push({ tab: 'actual', row: {
              tanggal: p.kunci, coa: r.coa, tipe: r.arah,
              nominal: Math.round(Math.abs(v)), catatan: 'Impor · ' + r.sumber
            } });
            ringkasan.aktual++;
          });
        });
      } else {
        dipakai.forEach(function (r) {
          st.tata.periode.forEach(function (p) {
            var v = r.nilai[p.kol];
            if (!v) return;
            var bln = bulanKunci(p);

            if (r.arah === 'out') {
              var maxHari = E.jumlahHari(bln);
              var hari = Math.min(st.hariRab, maxHari);
              aksi.push({ tab: 'rab', row: {
                bulan: bln, divisi: st.divisiRab, kegiatan: 'Impor ' + st.namaFile,
                benefit: '', tanggalRencana: bln + '-' + E.pad(hari),
                deskripsi: r.sumber, item: 1, satuan: Math.round(Math.abs(v)), ket: 'impor',
                total: Math.round(Math.abs(v)), coa: r.coa, status: 'draft'
              } });
              ringkasan.rab++;
            } else if (st.ikutTarget) {
              /* penerimaan = kas; target digicom = GMV → dibalik pakai netto% */
              var ch = CFG.CHANNELS.filter(function (c) { return c.coa === r.coa; })[0];
              if (!ch) return;
              var gmv = Math.round(Math.abs(v) / ((ch.netto || 100) / 100));
              aksi.push({ tab: 'targetBulanan', row: { bulan: bln, channel: ch.id, gmv: gmv } });
              ringkasan.target++;
            }
          });
        });
      }

      if (!aksi.length) { UI.toast('Tidak ada nilai yang bisa diimpor', 'warn'); return; }

      var pesan = [];
      if (ringkasan.aktual) pesan.push(ringkasan.aktual + ' mutasi harian');
      if (ringkasan.rab) pesan.push(ringkasan.rab + ' item RAB (draft)');
      if (ringkasan.target) pesan.push(ringkasan.target + ' target bulanan');

      UI.konfirmasi('Impor ' + pesan.join(' + ') + '?',
        'Data ditambahkan, bukan menimpa. Kalau ternyata dobel, hapus lewat halaman terkait. ' +
        'Backup dulu lewat Pengaturan → Unduh backup JSON kalau mau aman.',
        function () {
          UI.kosongkan(isi);
          isi.appendChild(el('div', { class: 'impor-muat' }, [
            el('div', { class: 'spin' }), el('div', { text: 'Menyimpan ' + aksi.length + ' baris…' })
          ]));
          setKaki([]);

          /* Berurutan supaya Apps Script tidak dibanjiri request paralel. */
          aksi.reduce(function (rantai, a) {
            return rantai.then(function () { return S.tambah(a.tab, a.row); });
          }, Promise.resolve()).then(function () {
            UI.toast('Impor selesai: ' + pesan.join(' + '), 'sukses', { durasi: 5000 });
            m.tutup();
            if (onSelesai) onSelesai();
          }).catch(function (e) {
            langkahFile('Gagal menyimpan: ' + (e && e.message ? e.message : e));
          });
        }, { aman: true, labelYa: 'Ya, impor' });
    }

    langkahFile();
  }

  global.IMPOR = { buka: buka, cocokkan: cocokkan, deteksi: deteksi, bacaBaris: bacaBaris, normal: normal };
})(window);
