/* ============================================================================
   ANTARESTAR — CASHFLOW PROJECTION
   pages-1.js — Proyeksi Kas · Kalender Kas · Simulasi What-if
   ========================================================================== */
(function (global) {
  'use strict';

  var UI = global.UI, CFG = global.CFG, E = global.ENGINE, S = global.STORE, CHART = global.CHART, IK = global.IK;
  var el = UI.el;
  var HAL = global.HAL = global.HAL || {};

  function d() { return S.data(); }
  function cfg() { return d().config; }
  function hitungSemua() {
    return E.hitungSemua(d(), {
      dari: global.APP.filter.dari,
      sampai: global.APP.filter.sampai,
      whatIf: global.APP.filter.whatIf
    });
  }

  /* ======================================================================
     Pemilih periode
     ====================================================================== */
  function setPeriode(bulanAwal, horizon) {
    var f = global.APP.filter;
    f.horizon = horizon;
    f.dari = bulanAwal + '-01';
    var p = bulanAwal.split('-');
    var th = +p[0], bl = +p[1] + horizon - 1;
    th += Math.floor((bl - 1) / 12);
    bl = ((bl - 1) % 12) + 1;
    var kb = th + '-' + E.pad(bl);
    f.sampai = kb + '-' + E.pad(E.jumlahHari(kb));
  }

  function geserBulan(delta) {
    var f = global.APP.filter;
    var b = f.dari.slice(0, 7).split('-');
    var th = +b[0], bl = +b[1] + delta;
    th += Math.floor((bl - 1) / 12);
    bl = ((bl - 1) % 12 + 12) % 12 + 1;
    setPeriode(th + '-' + E.pad(bl), f.horizon);
  }

  function pemilihPeriode(onUbah) {
    var f = global.APP.filter;
    var opsiBulan = [], i;
    for (i = 0; i < 24; i++) {
      var thn = 2026 + Math.floor(i / 12), bln = (i % 12) + 1;
      var k = thn + '-' + E.pad(bln);
      opsiBulan.push({ value: k, label: UI.namaBulan(k) });
    }

    var selBulan = UI.pilih(opsiBulan, f.dari.slice(0, 7),
      function (v) { setPeriode(v, f.horizon); onUbah(); }, { class: 'inp inp-ramping' });

    var selHorizon = UI.pilih([
      { value: 1, label: '1 bulan' }, { value: 2, label: '2 bulan' }, { value: 3, label: '3 bulan' },
      { value: 6, label: '6 bulan' }, { value: 12, label: '12 bulan' }
    ], f.horizon, function (v) { setPeriode(f.dari.slice(0, 7), +v); onUbah(); }, { class: 'inp inp-ramping' });

    var iniBulanIni = f.dari.slice(0, 7) === global.APP.hariIni.slice(0, 7) && f.horizon === 1;

    return el('div', { class: 'periode' }, [
      el('div', { class: 'periode-nav' }, [
        UI.btn('', { ikon: 'chevron', kecil: true, title: 'Bulan sebelumnya',
          onKlik: function () { geserBulan(-1); onUbah(); } }),
        selBulan,
        UI.btn('', { ikon: 'chevron', kecil: true, title: 'Bulan berikutnya',
          onKlik: function () { geserBulan(1); onUbah(); } })
      ]),
      selHorizon,
      UI.btn('Bulan ini', { kecil: true, nonaktif: iniBulanIni,
        onKlik: function () { setPeriode(global.APP.hariIni.slice(0, 7), 1); onUbah(); } })
    ]);
  }

  function pilSkenario(hasil, onUbah) {
    var f = global.APP.filter;
    var wrap = el('div', { class: 'pil-grup', role: 'radiogroup', 'aria-label': 'Skenario' });
    CFG.SKENARIO.forEach(function (sk) {
      var aktif = f.skenario === sk.id;
      wrap.appendChild(el('button', {
        class: 'pil pil-' + sk.id + (aktif ? ' aktif' : ''),
        type: 'button', role: 'radio', 'aria-checked': aktif,
        title: sk.nama + ' — penerimaan ×' + sk.faktor.toFixed(2),
        onclick: function () { f.skenario = sk.id; S.simpanConfig({ skenarioAktif: sk.id }); onUbah(); }
      }, [
        el('span', { class: 'pil-titik', style: 'background:' + sk.warna }),
        el('span', { text: sk.nama }),
        el('span', { class: 'nilai', text: UI.rpS(hasil[sk.id].ringkas.saldoAkhir) })
      ]));
    });
    return wrap;
  }

  /* ======================================================================
     HALAMAN: PROYEKSI KAS
     ====================================================================== */
  HAL.proyeksi = {
    judul: 'Proyeksi Kas',
    sub: 'Estimasi saldo harian & titik rawan kas',
    aksiUtama: { label: 'Catat kas', ikon: 'plus', onKlik: function (ulang) { global.INPUT.kasCepat('in', ulang); } },

    render: function (root, ulang) {
      var f = global.APP.filter;
      var hasil = hitungSemua();
      var aktif = hasil[f.skenario];
      var hari = aktif.hari;
      var cut = aktif.cutoff;
      var r = aktif.ringkas;

      root.appendChild(el('div', { class: 'bar-alat' }, [
        pemilihPeriode(ulang),
        el('div', { class: 'spacer' }),
        pilSkenario(hasil, ulang)
      ]));

      /* Belum ada saldo awal → jangan tebak-tebakan, minta angkanya langsung. */
      if (!(Number(cfg().saldoAwal) > 0)) root.appendChild(kartuIsiSaldo(f, ulang));

      /* ---------- vonis: kesimpulan dulu, grafik belakangan ---------- */
      var v = vonis(aktif, cfg());
      if (v) root.appendChild(kartuVonis(v, ulang));

      /* ---------- KPI ---------- */
      var hAkhirAktual = null, i;
      for (i = 0; i < hari.length; i++) if (hari[i].tipe === 'aktual') hAkhirAktual = hari[i];
      var saldoTerakhir = hAkhirAktual ? hAkhirAktual.saldo : r.saldoAwal;

      /* Fokus ke bagian yang masih bisa ditindaklanjuti. Kalau periode yang
         dilihat seluruhnya sudah lewat, jatuh balik ke angka seluruh periode. */
      var adaProyeksi = !!r.terendahProyeksi;
      var terendah = r.terendahProyeksi || r.terendah;
      var puncak = r.puncakMasukProyeksi || r.puncakMasuk;
      var bahaya = adaProyeksi ? r.hariBahayaProyeksi : r.hariBahaya;
      var lalu = adaProyeksi ? r.hariBahayaLalu : [];
      var imbuh = adaProyeksi ? ' (proyeksi)' : '';

      /* seri buat sparkline KPI */
      var sSaldo = hari.map(function (h) { return h.saldo; });
      var sMasuk = hari.map(function (h) { return h.masuk; });
      var CB = global.CHARTB;

      root.appendChild(el('div', { class: 'grid g4' }, [
        UI.kartuKpi({
          label: 'Saldo aktual', ikon: 'wallet', warna: '#fff7ed', warnaIkon: '#ea580c',
          nilai: UI.rpS(saldoTerakhir),
          sub: hAkhirAktual ? 'per ' + UI.tglPanjang(hAkhirAktual.tgl) : 'belum ada data aktual'
        }),
        UI.kartuKpi({
          label: 'Proyeksi akhir periode', ikon: 'target', warna: '#ecfdf5', warnaIkon: '#059669',
          nilai: UI.rpS(r.saldoAkhir),
          sub: 'skenario <b>' + aktif.skenario.nama + '</b> · ' + UI.tglPendek(f.sampai),
          spark: CB.sparkline(sSaldo, { tipe: 'garis', warna: aktif.skenario.warna })
        }),
        UI.kartuKpi({
          label: 'Kas terendah' + imbuh, ikon: 'alert',
          warna: bahaya.length ? '#fff1f2' : '#f8fafc', warnaIkon: bahaya.length ? '#e11d48' : '#64748b',
          nilai: terendah ? UI.rpS(terendah.saldo) : '—',
          sub: terendah ? UI.tglLengkap(terendah.tgl) + ' · ' + UI.relatif(terendah.tgl, global.APP.hariIni) : '—',
          subKelas: terendah && terendah.saldo < cfg().ambangBahaya ? 'merah tebal' : '',
          onKlik: terendah ? function () { detailHari(terendah, aktif); } : null,
          spark: CB.sparkline(sSaldo, { tipe: 'garis', warna: bahaya.length ? '#e11d48' : '#94a3b8' })
        }),
        UI.kartuKpi({
          label: 'Puncak masuk' + imbuh, ikon: 'trending', warna: '#eff6ff', warnaIkon: '#2563eb',
          nilai: puncak ? UI.rpS(puncak.masuk) : '—',
          sub: puncak ? UI.tglLengkap(puncak.tgl) + ' · ' + UI.relatif(puncak.tgl, global.APP.hariIni) : '—',
          onKlik: puncak ? function () { detailHari(puncak, aktif); } : null,
          spark: CB.sparkline(sMasuk, { tipe: 'batang', warna: '#2563eb' })
        })
      ]));

      /* ---------- daftar tanggal rawan (pelengkap vonis) ---------- */
      if (bahaya.length) {
        root.appendChild(el('div', { class: 'alert alert-merah' }, [
          IK('alert', 17),
          el('div', null, [
            el('div', { html: '<b>' + bahaya.length + ' hari' + (adaProyeksi ? ' ke depan' : '') +
              '</b> di bawah batas aman. Klik tanggal untuk lihat penyebabnya:' }),
            el('div', { class: 'chip-baris' }, bahaya.slice(0, 10).map(function (h) {
              return el('button', { class: 'chip chip-merah', type: 'button',
                onclick: function () { detailHari(h, aktif); } }, [
                el('span', { text: UI.tglPendek(h.tgl) }),
                el('b', { text: UI.rpS(h.saldo) })
              ]);
            }).concat(bahaya.length > 10 ? [el('span', { class: 'muted2', text: '+' + (bahaya.length - 10) + ' lagi' })] : [])),
            lalu.length ? el('div', { class: 'muted2', style: 'margin-top:7px',
              text: 'Catatan: ' + lalu.length + ' hari yang sudah lewat juga di bawah ambang — itu sudah terjadi, tidak perlu ditindaklanjuti.' }) : null
          ])
        ]));
      } else if (lalu.length) {
        root.appendChild(el('div', { class: 'alert alert-biru' }, [
          IK('info', 17),
          el('div', { text: lalu.length + ' hari yang sudah lewat sempat di bawah batas aman. ' +
            'Ke depan tidak ada lagi di skenario ' + aktif.skenario.nama + '.' })
        ]));
      }

      /* ---------- kalibrasi ---------- */
      var kal = kalibrasi(aktif);
      if (kal) {
        root.appendChild(el('div', { class: 'alert alert-kuning' }, [
          IK('info', 17),
          el('div', null, [
            el('div', { html:
              'Proyeksi penerimaan dihitung dari <b>target digicom</b>, tapi realisasi ' + kal.jml +
              ' hari terakhir rata-rata <b>' + UI.rpS(kal.aktual) + '/hari</b> — proyeksi memasang <b>' +
              UI.rpS(kal.proyeksi) + '/hari</b> (' + UI.persen(kal.rasio * 100, 0) + ' dari proyeksi).' }),
            el('div', { class: 'baris', style: 'margin-top:8px' }, [
              UI.btn('Kalibrasi netto ke realisasi', { kecil: true, ikon: 'scale', onKlik: function () {
                UI.konfirmasi('Kalibrasi netto channel?',
                  'Netto % semua channel dikali ' + UI.persen(kal.rasio * 100, 0) +
                  ' supaya proyeksi penerimaan menyamai realisasi terakhir. Target GMV tidak diubah — ' +
                  'yang disesuaikan cuma asumsi berapa persen GMV yang benar-benar jadi kas.',
                  function () {
                    CFG.CHANNELS.forEach(function (ch) { ch.netto = Math.round(ch.netto * kal.rasio * 10) / 10; });
                    S.simpanConfig({ channelOverride: CFG.CHANNELS.map(function (ch) {
                      return { id: ch.id, lag: ch.lag, netto: ch.netto }; }) })
                      .then(function () { UI.toast('Netto channel dikalibrasi', 'sukses'); ulang(); });
                  }, { aman: true, labelYa: 'Kalibrasi' });
              } }),
              el('span', { class: 'muted2', text: 'atau biarkan kalau target memang lagi dikejar' })
            ])
          ])
        ]));
      }

      /* ---------- chart dengan pilihan tampilan ---------- */
      panelGrafik(root, hasil, aktif, ulang);

      /* ---------- 3 kartu skenario ---------- */
      var g3 = el('div', { class: 'grid g3' });
      CFG.SKENARIO.forEach(function (sk) {
        var x = hasil[sk.id].ringkas;
        var isAktif = f.skenario === sk.id;
        g3.appendChild(el('button', {
          class: 'sk-kartu' + (isAktif ? ' aktif' : ''), type: 'button',
          onclick: function () { f.skenario = sk.id; S.simpanConfig({ skenarioAktif: sk.id }); ulang(); }
        }, [
          el('div', { class: 'sk-head' }, [
            el('span', { class: 'sk-nama' }, [
              el('span', { class: 'pil-titik', style: 'background:' + sk.warna }),
              el('span', { text: sk.nama })
            ]),
            isAktif ? UI.badge('AKTIF', 'oranye')
              : el('span', { class: 'muted2',
                  title: (cfg().skenarioMandiri || {})[sk.id] ? 'target diisi terpisah' : 'diturunkan dari Optimis',
                  text: (cfg().skenarioMandiri || {})[sk.id] ? 'mandiri' : '×' + sk.faktor.toFixed(2) })
          ]),
          el('div', { class: 'sk-row' }, [el('span', { text: 'Penerimaan proyeksi' }), el('b', { class: 'hijau', text: UI.rpS(x.masukProyeksi) })]),
          el('div', { class: 'sk-row' }, [el('span', { text: 'Pengeluaran proyeksi' }), el('b', { class: 'merah', text: UI.rpS(x.keluarProyeksi) })]),
          el('div', { class: 'sk-row' }, [
            el('span', { text: 'Kas terendah' + (x.terendahProyeksi ? ' (proyeksi)' : '') }),
            (function () {
              var t = x.terendahProyeksi || x.terendah;
              return el('b', {
                class: (t && t.saldo < cfg().ambangBahaya) ? 'merah' : '',
                text: UI.rpS(t ? t.saldo : 0)
              });
            })()
          ]),
          el('div', { class: 'sk-row sk-akhir' }, [
            el('span', { class: 'tebal', text: 'Saldo akhir' }),
            el('b', { style: 'color:' + sk.warna, text: UI.rpS(x.saldoAkhir) })
          ])
        ]));
      });
      root.appendChild(g3);

      root.appendChild(agendaKas(aktif, ulang));
    }
  };

  /* ======================================================================
     KARTU ISI SISA KAS — pengganti upload file.
     Titik pijak seluruh proyeksi: sisa kas di akhir bulan terakhir yang sudah
     ditutup. Tanpa ini semua angka saldo tidak berarti, jadi formulirnya
     ditaruh langsung di halaman, bukan disembunyikan di Pengaturan.
     ====================================================================== */
  function kartuIsiSaldo(f, ulang) {
    /* default: hari terakhir bulan sebelum periode yang sedang dilihat */
    var tglDefault = E.tambahHari(f.dari, -1);

    var inTgl = UI.input({ type: 'date', value: tglDefault });
    var inNominal = UI.inputUang(0);
    var fNominal = UI.field('Sisa kas di tanggal itu', inNominal,
      'Total semua rekening + kas di tangan. Bisa singkat: 4,5m · 850jt', { wajib: true });

    function simpan() {
      UI.bersihkanSalah(kartu);
      var nom = UI.nilaiUang(inNominal);
      if (!inTgl.value) { UI.toast('Tanggal belum diisi', 'warn'); return; }
      if (!nom) { UI.salahField(fNominal, 'Nominal belum diisi'); return; }
      S.simpanConfig({ saldoAwal: nom, saldoAwalTanggal: inTgl.value }).then(function () {
        UI.toast('Sisa kas ' + UI.rpS(nom) + ' per ' + UI.tglPendek(inTgl.value) + ' tersimpan', 'sukses');
        ulang();
      });
    }

    var form = el('div', { class: 'form-grid isi-saldo-form' }, [
      UI.field('Posisi kas per tanggal', inTgl, 'Biasanya hari terakhir bulan lalu'),
      fNominal,
      el('div', { class: 'field field-tombol' },
        UI.btn('Simpan', { gaya: 'btn-utama', ikon: 'check', onKlik: simpan }))
    ]);
    form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); simpan(); }
    });

    var kartu = el('section', { class: 'isi-saldo' }, [
      el('div', { class: 'isi-saldo-ikon' }, IK('wallet', 20)),
      el('div', { class: 'isi-saldo-isi' }, [
        el('div', { class: 'isi-saldo-judul', text: 'Isi sisa kas dulu supaya angkanya berarti' }),
        el('p', { class: 'isi-saldo-pesan',
          text: 'Semua proyeksi berangkat dari satu angka: sisa kas di akhir bulan terakhir yang sudah ditutup. ' +
                'Selama ini kosong, saldo dihitung mulai dari nol — pola naik-turunnya tetap benar, tapi posisinya belum.' }),
        form
      ])
    ]);
    return kartu;
  }

  /* ======================================================================
     VONIS — kesimpulan satu kalimat untuk pembaca non-teknis (komisaris).
     Ini yang dibaca duluan; grafik cuma buktinya.
     ====================================================================== */
  function vonis(hasil, c) {
    var r = hasil.ringkas;
    var t = r.terendahProyeksi || r.terendah;
    if (!t) return null;

    var ambang = Number(c.ambangBahaya) || 0;
    var rw = E.runway(hasil.hari, r.saldoAkhir);
    var netPeriode = r.masukProyeksi - r.keluarProyeksi;

    var level, judul, pesan;
    if (t.saldo < 0) {
      level = 'kritis';
      judul = 'Kas akan minus ' + UI.rpS(Math.abs(t.saldo)) + ' di ' + UI.tglPanjang(t.tgl);
      pesan = 'Butuh dana talangan minimal ' + UI.rpS(Math.abs(t.saldo)) +
              ' sebelum tanggal itu, atau geser pembayaran besar yang jatuh di sekitarnya.';
    } else if (ambang && t.saldo < ambang) {
      level = 'bahaya';
      judul = 'Kas menipis ke ' + UI.rpS(t.saldo) + ' di ' + UI.tglPanjang(t.tgl);
      pesan = 'Di bawah batas aman ' + UI.rpS(ambang) + ' (kurang ' + UI.rpS(ambang - t.saldo) + '). ' +
              'Aman kalau penerimaan tepat waktu, tapi tidak ada bantalan kalau meleset.';
    } else {
      level = 'aman';
      judul = 'Kas aman sepanjang periode';
      pesan = 'Titik terendah ' + UI.rpS(t.saldo) + ' di ' + UI.tglPanjang(t.tgl) +
              (ambang ? ', masih ' + UI.rpS(t.saldo - ambang) + ' di atas batas aman.' : '.');
    }

    /* kesehatan kas = % hari (yang belum lewat) yang saldonya di atas batas aman */
    var proy = hasil.hari.filter(function (h) { return h.tipe === 'proyeksi'; });
    var basis = proy.length ? proy : hasil.hari;
    var aman = basis.filter(function (h) { return h.saldo >= (ambang || 0); }).length;
    var sehat = basis.length ? Math.round(aman / basis.length * 100) : 100;

    return {
      level: level, judul: judul, pesan: pesan,
      net: netPeriode, runway: rw, skenario: hasil.skenario.nama, sehat: sehat,
      titik: t, hasil: hasil
    };
  }

  function kartuVonis(v, ulang) {
    var ikon = { kritis: 'alert', bahaya: 'alert', aman: 'shield' }[v.level];
    var warnaGauge = { kritis: '#e11d48', bahaya: '#d97706', aman: '#059669' }[v.level];
    var baris = [];

    baris.push(el('div', { class: 'vonis-judul', text: v.judul }));
    baris.push(el('p', { class: 'vonis-pesan', text: v.pesan }));

    /* penyebab titik terendah — langsung ditampilkan, tidak perlu diklik */
    if (v.titik && v.hasil) {
      var an = E.analisaHari(v.hasil, v.titik.tgl);
      var n = narasiPenyebab(an);
      if (n) {
        var utama = n.poin.filter(function (p) { return p.berat; })[0] || n.poin[0];
        baris.push(el('div', { class: 'vonis-sebab' }, [
          el('span', { class: 'vs-lbl', text: 'Penyebab' }),
          el('span', { class: 'vs-teks' }, [
            el('span', { text: n.ringkas }),
            utama ? el('span', { text: ' Terbesar: ' }) : null,
            utama ? el('b', { text: utama.nama + ' ' + UI.rpS(utama.nominal) }) : null,
            utama ? el('span', { text: ' (' + utama.ket + ').' }) : null
          ]),
          UI.btn('Lihat rincian', { kecil: true, ikon: 'search',
            onKlik: function () { detailHari(v.titik, v.hasil); } })
        ]));
      }
    }

    var fakta = el('div', { class: 'vonis-fakta' });
    fakta.appendChild(el('div', { class: 'vf' }, [
      el('span', { class: 'vf-lbl', text: 'Arus kas periode ini' }),
      el('span', { class: 'vf-val ' + (v.net >= 0 ? 'hijau' : 'merah'),
        text: (v.net >= 0 ? 'Surplus ' : 'Defisit ') + UI.rpS(Math.abs(v.net)) })
    ]));
    if (v.runway) {
      fakta.appendChild(el('div', { class: 'vf' }, [
        el('span', { class: 'vf-lbl', text: 'Kas bertahan tanpa pemasukan' }),
        el('span', { class: 'vf-val', text: v.runway.hari >= 999 ? '> 2 tahun' : v.runway.hari + ' hari' })
      ]));
      fakta.appendChild(el('div', { class: 'vf' }, [
        el('span', { class: 'vf-lbl', text: 'Rata-rata keluar / hari' }),
        el('span', { class: 'vf-val', text: UI.rpS(v.runway.burnHarian) })
      ]));
    }
    fakta.appendChild(el('div', { class: 'vf' }, [
      el('span', { class: 'vf-lbl', text: 'Dasar perhitungan' }),
      el('span', { class: 'vf-val', text: 'Skenario ' + v.skenario })
    ]));
    baris.push(fakta);

    var gaugeNode = el('div', { class: 'vonis-gauge' }, [
      global.CHARTB.gauge(v.sehat, { warna: warnaGauge, label: 'hari aman' }),
      el('div', { class: 'vonis-gauge-cap', text: 'Kesehatan kas' })
    ]);

    return el('section', { class: 'vonis vonis-' + v.level }, [
      el('div', { class: 'vonis-ikon' }, IK(ikon, 20)),
      el('div', { class: 'vonis-isi' }, baris),
      gaugeNode
    ]);
  }

  /* ======================================================================
     PANEL GRAFIK — satu grafik menjawab satu pertanyaan.
     ====================================================================== */
  var TAMPILAN = [
    { id: 'saldo',    label: 'Saldo kas',      ikon: 'trending',  tanya: 'Kas kita aman nggak, dan kapan paling tipis?' },
    { id: 'arus',     label: 'Masuk vs keluar', ikon: 'chart',    tanya: 'Berapa masuk, berapa keluar, surplus atau defisit?' },
    { id: 'komposisi',label: 'Komposisi keluar', ikon: 'grid',    tanya: 'Uangnya lari ke mana?' },
    { id: 'jembatan', label: 'Jembatan saldo',  ikon: 'scale',    tanya: 'Kenapa saldo akhir jadi segitu?' }
  ];
  var GRAIN = [
    { id: 'harian',   label: 'Harian' },
    { id: 'mingguan', label: 'Mingguan' },
    { id: 'bulanan',  label: 'Bulanan' }
  ];

  function panelGrafik(root, hasil, aktif, ulang) {
    var APP = global.APP;
    if (!APP.tampilanGrafik) APP.tampilanGrafik = 'saldo';
    /* default grain ikut panjang periode: 1 bulan → harian, >3 bulan → bulanan */
    if (!APP.grain) APP.grain = aktif.hari.length > 92 ? 'bulanan' : (aktif.hari.length > 45 ? 'mingguan' : 'harian');

    var tampilan = TAMPILAN.filter(function (t) { return t.id === APP.tampilanGrafik; })[0] || TAMPILAN[0];
    var plotWrap = el('div', { class: 'plot-slot' });

    /* pemilih tampilan */
    var pilihTampilan = el('div', { class: 'grafik-tab', role: 'tablist' });
    TAMPILAN.forEach(function (t) {
      pilihTampilan.appendChild(el('button', {
        class: 'gt-btn' + (t.id === APP.tampilanGrafik ? ' aktif' : ''), type: 'button',
        role: 'tab', 'aria-selected': t.id === APP.tampilanGrafik, title: t.tanya,
        onclick: function () { APP.tampilanGrafik = t.id; ulang(); }
      }, [IK(t.ikon, 14), el('span', { text: t.label })]));
    });

    /* pemilih rentang waktu — tidak relevan untuk donat */
    var pilihGrain = el('div', { class: 'segmen segmen-mini' });
    GRAIN.forEach(function (g) {
      pilihGrain.appendChild(el('button', {
        class: 'segmen-btn' + (g.id === APP.grain ? ' aktif' : ''), type: 'button',
        onclick: function () { APP.grain = g.id; ulang(); }
      }, el('span', { text: g.label })));
    });

    var kepala = el('div', { class: 'kartu-head' }, [
      el('div', { class: 'kartu-judul' }, [
        el('h2', { text: tampilan.label }),
        el('p', { class: 'muted', text: tampilan.tanya })
      ]),
      el('div', { class: 'kartu-aksi' }, [
        (tampilan.id === 'komposisi' || tampilan.id === 'jembatan') ? null : pilihGrain
      ])
    ]);

    var kartu = el('section', { class: 'kartu' }, [pilihTampilan, kepala, plotWrap]);

    /* Kartu HARUS masuk DOM dulu sebelum grafik digambar. Kalau tidak,
       lebar wadah terbaca 0 → chart memakai lebar cadangan → SVG di-letterbox
       (kosong di kiri-kanan) dan pemetaan posisi kursor ke tanggal jadi meleset. */
    root.appendChild(kartu);

    /* ---- gambar sesuai tampilan ---- */
    var grain = APP.grain;
    var seri = {};
    CFG.SKENARIO.forEach(function (sk) { seri[sk.id] = E.agregasi(hasil[sk.id].hari, grain); });
    var dataAktif = seri[APP.filter.skenario];

    if (tampilan.id === 'saldo') {
      if (!APP.garisTampil) APP.garisTampil = { saldo: true, masuk: false, keluar: false };
      var gt = APP.garisTampil;

      /* Saldo (belasan M) dan arus harian (ratusan Jt) beda skala jauh. Kalau
         dipaksa satu grafik, entah arusnya gepeng atau sumbunya ganda — dan
         sumbu ganda bikin persilangan garis tidak punya arti. Solusinya dua
         panel bertumpuk: skala masing-masing benar, sumbu tanggal tetap sama. */
      var adaArus = gt.masuk || gt.keluar;
      if (gt.saldo && adaArus) {
        var panelSaldo = el('div');
        var panelArus = el('div');
        plotWrap.appendChild(panelSaldo);
        plotWrap.appendChild(panelArus);

        global.CHARTB.garisSaldo(panelSaldo, {
          seri: seri, aktif: APP.filter.skenario, grain: grain, cfg: cfg(), tinggi: 250,
          semuaSkenario: false, tampil: { saldo: true, masuk: false, keluar: false },
          judulPanel: 'SALDO KAS', tanpaLabelX: true,
          onKlik: function (p) { if (p.hari && p.hari.length === 1) detailHari(p.hari[0], aktif); }
        });
        global.CHARTB.garisSaldo(panelArus, {
          seri: seri, aktif: APP.filter.skenario, grain: grain, cfg: cfg(), tinggi: 190,
          semuaSkenario: false, tampil: { saldo: false, masuk: gt.masuk, keluar: gt.keluar },
          judulPanel: 'ARUS KAS HARIAN',
          onKlik: function (p) { if (p.hari && p.hari.length === 1) detailHari(p.hari[0], aktif); }
        });
      } else {
        global.CHARTB.garisSaldo(plotWrap, {
          seri: seri, aktif: APP.filter.skenario, grain: grain, cfg: cfg(), tinggi: 380,
          semuaSkenario: gt.saldo, tampil: gt,
          onKlik: function (p) { if (p.hari && p.hari.length === 1) detailHari(p.hari[0], aktif); }
        });
      }

      /* saklar garis — matikan/nyalakan sesuai kebutuhan; skala Y ikut yang aktif */
      var G = global.CHARTB.GARIS;
      var GARIS = [
        { id: 'saldo',  label: 'Saldo',       warna: G.saldo.warna,  gaya: 'tebal' },
        { id: 'masuk',  label: 'Uang masuk',  warna: G.masuk.warna,  gaya: 'solid' },
        { id: 'keluar', label: 'Uang keluar', warna: G.keluar.warna, gaya: 'putus' }
      ];
      var saklar = el('div', { class: 'garis-saklar' });
      GARIS.forEach(function (g) {
        var on = !!gt[g.id];
        saklar.appendChild(el('button', {
          class: 'gs-btn' + (on ? ' aktif' : ''), type: 'button',
          'aria-pressed': on, title: (on ? 'Sembunyikan ' : 'Tampilkan ') + g.label,
          onclick: function () {
            var nyala = Object.keys(gt).filter(function (k) { return gt[k]; });
            if (on && nyala.length === 1) { UI.toast('Minimal satu garis harus nyala', 'warn'); return; }
            gt[g.id] = !on;
            ulang();
          }
        }, [
          /* contoh garis, bukan bulatan — supaya bedanya (tebal/solid/putus)
             kelihatan langsung di saklarnya, bukan cuma warna */
          el('span', { class: 'gs-garis gs-' + g.gaya,
            style: 'border-color:' + g.warna + ';opacity:' + (on ? 1 : 0.32) }),
          el('span', { text: g.label })
        ]));
      });

      plotWrap.appendChild(el('div', { class: 'legend' }, [
        el('div', { class: 'legend-grup' }, [
          el('span', { class: 'legend-judul', text: 'GARIS:' }), saklar
        ]),
        (function () {
          var adaArus = gt.masuk || gt.keluar;
          if (gt.masuk && gt.keluar) {
            return el('div', { class: 'legend-grup' }, [
              el('span', { class: 'lg-dot', style: 'background:' + G.masuk.warna + ';opacity:.28' }),
              el('span', { text: 'Area hijau = surplus hari itu' }),
              el('span', { class: 'lg-dot', style: 'background:' + G.keluar.warna + ';opacity:.28' }),
              el('span', { text: 'Area merah = tekor hari itu' }),
              gt.saldo ? el('span', { class: 'muted2', text: '· dua panel, sumbu tanggal sama' }) : null
            ]);
          }
          if (gt.saldo && adaArus) {
            return el('div', { class: 'legend-grup' }, el('span', { class: 'muted2',
              text: 'Panel atas saldo, panel bawah arus harian — skalanya masing-masing, tanggalnya sejajar.' }));
          }
          if (gt.saldo) {
            return el('div', { class: 'legend-grup' }, [
              el('span', { class: 'lg-line lg-solid' }), el('span', { text: 'Aktual' }),
              el('span', { class: 'lg-line lg-dash' }), el('span', { text: 'Proyeksi (skenario aktif)' }),
              el('span', { class: 'lg-line lg-dot-pink' }), el('span', { text: 'Batas aman' })
            ]);
          }
          return el('div', { class: 'legend-grup' }, el('span', { class: 'muted2',
            text: 'Saldo disembunyikan — sumbu menyesuaikan arus kas harian.' }));
        })()
      ]));

    } else if (tampilan.id === 'arus') {
      global.CHARTB.batangArus(plotWrap, { data: dataAktif, grain: grain, tinggi: 340 });

    } else if (tampilan.id === 'komposisi') {
      var perBucket = {};
      aktif.hari.forEach(function (h) {
        for (var b in h.bucket) {
          if (!h.bucket.hasOwnProperty(b) || b === 'pemasukan') continue;
          perBucket[b] = (perBucket[b] || 0) + h.bucket[b];
        }
      });
      var dataDonat = Object.keys(perBucket).map(function (b) {
        return { label: CFG.BUCKET[b] ? CFG.BUCKET[b].label : b, nilai: perBucket[b],
                 warna: CFG.BUCKET[b] ? CFG.BUCKET[b].warna : '#94a3b8' };
      });
      global.CHARTB.donatKeluar(plotWrap, { data: dataDonat });

    } else {
      /* jembatan: saldo awal → +penerimaan → −tiap bucket → saldo akhir */
      var r = aktif.ringkas;
      var bucketOut = {};
      aktif.hari.forEach(function (h) {
        for (var b in h.bucket) {
          if (!h.bucket.hasOwnProperty(b) || b === 'pemasukan') continue;
          bucketOut[b] = (bucketOut[b] || 0) + h.bucket[b];
        }
      });
      var langkah = [{ label: 'Saldo awal', nilai: r.saldoAwal, jenis: 'total' }];
      langkah.push({ label: 'Penerimaan', nilai: r.totalMasuk });
      Object.keys(bucketOut).sort(function (a, b) { return bucketOut[b] - bucketOut[a]; })
        .forEach(function (b) {
          langkah.push({ label: CFG.BUCKET[b] ? CFG.BUCKET[b].label : b, nilai: -bucketOut[b] });
        });
      langkah.push({ label: 'Saldo akhir', nilai: r.saldoAkhir, jenis: 'total' });
      global.CHARTB.jembatan(plotWrap, { data: langkah, tinggi: 380 });
    }

    return kartu;   /* sudah ditambahkan ke root di atas */
  }

  /* Bandingkan rata-rata penerimaan harian aktual vs proyeksi. */
  function kalibrasi(hasil) {
    var aktualH = hasil.hari.filter(function (h) { return h.tipe === 'aktual'; });
    var proyH = hasil.hari.filter(function (h) { return h.tipe === 'proyeksi'; });
    if (aktualH.length < 5 || !proyH.length) return null;

    var ambil = aktualH.slice(-14);
    var avgA = ambil.reduce(function (a, h) { return a + h.masuk; }, 0) / ambil.length;
    var avgP = hasil.ringkas.masukProyeksi / proyH.length;
    if (!avgP) return null;

    var rasio = avgA / avgP;
    if (rasio > 0.85 && rasio < 1.15) return null;
    return { aktual: avgA, proyeksi: avgP, rasio: rasio, jml: ambil.length };
  }

  /* Momen kas besar ke depan */
  function agendaKas(hasil, ulang) {
    var AMBANG = 50000000;
    var baris = [];

    hasil.hari.filter(function (h) { return h.tipe === 'proyeksi'; }).forEach(function (h) {
      /* PENGELUARAN: komitmen terjadwal, di luar belanja operasional harian */
      h.item.forEach(function (it) {
        if (it.tipe !== 'out') return;
        if (it.sumber === 'baseline') return;
        if (it.nominal < AMBANG) return;
        baris.push({ tgl: h.tgl, label: it.label, coa: it.coa, nominal: it.nominal,
                     tipe: 'out', saldo: h.saldo, sumber: it.sumber });
      });

      /* PEMASUKAN: hari panen — penerimaan penjualan yang jauh di atas biasa,
         plus pemasukan non-penjualan yang memang dijadwalkan. */
      h.item.forEach(function (it) {
        if (it.tipe !== 'in') return;
        if (it.nominal < AMBANG) return;
        if (it.sumber === 'forecast') return;          /* ditangani terpisah di bawah */
        baris.push({ tgl: h.tgl, label: it.label, coa: it.coa, nominal: it.nominal,
                     tipe: 'in', saldo: h.saldo, sumber: it.sumber });
      });
    });

    /* Puncak penerimaan penjualan: ambil hari yang masuknya >=1,5x rata-rata,
       supaya daftar tidak dipenuhi penerimaan rutin yang nilainya mirip. */
    var proy = hasil.hari.filter(function (h) { return h.tipe === 'proyeksi' && h.masuk > 0; });
    if (proy.length) {
      var rata = proy.reduce(function (a, h) { return a + h.masuk; }, 0) / proy.length;
      proy.forEach(function (h) {
        if (h.masuk < Math.max(AMBANG, rata * 1.5)) return;
        baris.push({ tgl: h.tgl, label: 'Puncak penerimaan penjualan', coa: 'penjualan',
                     nominal: h.masuk, tipe: 'in', saldo: h.saldo, sumber: 'forecast',
                     ket: Math.round(h.masuk / rata * 10) / 10 + '× rata-rata harian' });
      });
    }

    baris.sort(function (a, b) { return a.tgl < b.tgl ? -1 : a.tgl > b.tgl ? 1 : b.nominal - a.nominal; });

    var SUMBER = { rab: ['RAB', 'biru'], recurring: ['Fixed cost', 'abu'], rencana: ['Rencana', 'oranye'],
                   variabel: ['Variabel', 'kuning'], whatif: ['Simulasi', 'oranye'],
                   forecast: ['Target jualan', 'hijau'] };

    var APP = global.APP;
    if (!APP.agendaArah) APP.agendaArah = 'semua';
    var tampil = baris.filter(function (r) {
      return APP.agendaArah === 'semua' || r.tipe === APP.agendaArah;
    });

    var totalIn = baris.filter(function (r) { return r.tipe === 'in'; })
      .reduce(function (a, r) { return a + r.nominal; }, 0);
    var totalOut = baris.filter(function (r) { return r.tipe === 'out'; })
      .reduce(function (a, r) { return a + r.nominal; }, 0);

    var kolom = [
      { judul: 'Tanggal', lebar: '124px', render: function (r) {
          return el('div', null, [
            el('div', { class: 'tebal nowrap', text: UI.tglPendek(r.tgl) }),
            el('div', { class: 'muted2', text: UI.relatif(r.tgl, global.APP.hariIni) })
          ]); },
        cariTeks: function (r) { return UI.tglPendek(r.tgl); } },
      { judul: 'Arah', lebar: '104px', cari: false, render: function (r) {
          return el('span', { class: 'agenda-arah agenda-' + r.tipe }, [
            IK(r.tipe === 'in' ? 'arrowDown' : 'arrowUp', 13),
            el('span', { text: r.tipe === 'in' ? 'Masuk' : 'Keluar' })
          ]); } },
      { judul: 'Keterangan', render: function (r) {
          return el('div', null, [
            el('div', { text: r.label }),
            el('div', { class: 'muted2', text: (r.coa === 'penjualan' ? 'Gabungan channel penjualan' : CFG.namaCoa(r.coa)) +
              (r.ket ? ' · ' + r.ket : '') })
          ]); },
        cariTeks: function (r) { return r.label + ' ' + (r.coa === 'penjualan' ? 'penjualan' : CFG.namaCoa(r.coa)); } },
      { judul: 'Sumber', lebar: '118px', render: function (r) {
          var v = SUMBER[r.sumber] || ['—', 'abu'];
          return UI.badge(v[0], v[1]); },
        cariTeks: function (r) { return (SUMBER[r.sumber] || [''])[0]; } },
      { judul: 'Nominal', kelas: 'kanan', lebar: '150px', render: function (r) {
          return el('span', { class: (r.tipe === 'in' ? 'hijau' : 'merah') + ' tebal',
            text: (r.tipe === 'in' ? '+' : '−') + UI.rp(r.nominal) }); } },
      { judul: 'Saldo setelahnya', kelas: 'kanan', lebar: '140px', render: function (r) {
          return el('span', { class: r.saldo < cfg().ambangBahaya ? 'merah tebal' : '', text: UI.rpS(r.saldo) }); } }
    ];

    var filter = UI.segmen([
      { value: 'semua',  label: 'Semua (' + baris.length + ')' },
      { value: 'in',     label: 'Pemasukan (' + baris.filter(function (r) { return r.tipe === 'in'; }).length + ')', ikon: 'arrowDown', kelas: 'seg-hijau' },
      { value: 'out',    label: 'Pengeluaran (' + baris.filter(function (r) { return r.tipe === 'out'; }).length + ')', ikon: 'arrowUp', kelas: 'seg-merah' }
    ], APP.agendaArah, function (v) { APP.agendaArah = v; ulang(); }, 'segmen-mini');

    var ringkas = el('div', { class: 'agenda-ringkas' }, [
      el('span', null, [IK('arrowDown', 13), el('b', { class: 'hijau', text: UI.rpS(totalIn) }), el('span', { class: 'muted2', text: 'akan masuk' })]),
      el('span', null, [IK('arrowUp', 13), el('b', { class: 'merah', text: UI.rpS(totalOut) }), el('span', { class: 'muted2', text: 'akan keluar' })]),
      el('span', null, [IK('scale', 13),
        el('b', { class: (totalIn - totalOut) >= 0 ? 'hijau' : 'merah',
          text: ((totalIn - totalOut) >= 0 ? '+' : '') + UI.rpS(totalIn - totalOut) }),
        el('span', { class: 'muted2', text: 'selisih agenda' })])
    ]);

    return UI.seksi('Agenda kas besar ke depan',
      'Momen kas ≥ Rp 50 Jt: komitmen terjadwal dan hari panen penerimaan — di luar arus rutin harian.',
      el('div', null, [
        ringkas,
        UI.tabel(kolom, tampil, {
          cari: tampil.length > 8, cariPlaceholder: 'Cari keterangan atau pos…', maks: 25,
          kelasBaris: function (r) { return 'agenda-baris-' + r.tipe; },
          kosong: {
            ikon: 'fileText', judul: 'Belum ada momen kas besar',
            pesan: 'Belum ada komitmen atau penerimaan ≥ Rp 50 Jt di periode ini.',
            aksi: { label: 'Buat RAB', ikon: 'plus', onKlik: function () { global.INPUT.rabBaru(ulang); } }
          }
        })
      ]),
      filter);
  }

  /* Susun kalimat penyebab dari hasil E.analisaHari — dipakai di modal & vonis */
  function narasiPenyebab(an) {
    if (!an) return null;
    var h = an.hari, poin = [];

    var besar = an.pemicu.filter(function (p) { return p.nominal > 0; }).slice(0, 3);
    besar.forEach(function (p) {
      var ket = '';
      if (p.jarang) ket = 'jarang keluar — cuma di tanggal tertentu';
      else if (p.kali >= 1.6) ket = Math.round(p.kali * 10) / 10 + '× lebih besar dari hari biasa (' + UI.rpS(p.rataPos) + ')';
      else ket = 'setara hari biasa';
      poin.push({ nama: p.nama, nominal: p.nominal, porsi: p.porsi, ket: ket, berat: p.jarang || p.kali >= 1.6 });
    });

    var ringkas;
    if (an.keluarBesar && an.masukSeret) {
      ringkas = 'Kena dua-duanya: pengeluaran ' + UI.rpS(h.keluar) + ' (di atas rata-rata ' + UI.rpS(an.rataKeluar) +
        ') sementara pemasukan cuma ' + UI.rpS(h.masuk) + ' (rata-rata ' + UI.rpS(an.rataMasuk) + ').';
    } else if (an.keluarBesar) {
      ringkas = 'Pengeluaran hari ini ' + UI.rpS(h.keluar) + ', di atas rata-rata harian ' + UI.rpS(an.rataKeluar) + '.';
    } else if (an.masukSeret) {
      ringkas = 'Pemasukan hari ini cuma ' + UI.rpS(h.masuk) + ', jauh di bawah rata-rata ' + UI.rpS(an.rataMasuk) +
        ' — pengeluaran tetap jalan ' + UI.rpS(h.keluar) + '.';
    } else if (an.hariBeruntunDefisit > 1) {
      ringkas = 'Bukan karena satu hari — sudah ' + an.hariBeruntunDefisit + ' hari beruntun pengeluaran > pemasukan, ' +
        'total tekor ' + UI.rpS(an.totalDefisitBeruntun) + '.';
    } else {
      ringkas = 'Pemasukan ' + UI.rpS(h.masuk) + ' vs pengeluaran ' + UI.rpS(h.keluar) + ' — masih dalam pola normal.';
    }

    return { ringkas: ringkas, poin: poin, an: an };
  }

  function blokPenyebab(an) {
    var n = narasiPenyebab(an);
    if (!n) return null;
    var h = an.hari;
    var turun = h.net < 0;

    var isi = el('div', { class: 'sebab-isi' }, [
      el('p', { class: 'sebab-ringkas', text: n.ringkas })
    ]);

    if (n.poin.length) {
      var daftar = el('div', { class: 'sebab-list' });
      n.poin.forEach(function (p) {
        daftar.appendChild(el('div', { class: 'sebab-item' + (p.berat ? ' berat' : '') }, [
          el('span', { class: 'sebab-bar', style: 'width:' + Math.max(4, Math.round(p.porsi * 100)) + '%' }),
          el('span', { class: 'sebab-nama', text: p.nama }),
          el('span', { class: 'sebab-nom', text: UI.rp(p.nominal) }),
          el('span', { class: 'sebab-ket', text: p.ket })
        ]));
      });
      isi.appendChild(daftar);
    }

    if (an.turunDariPuncak > 0 && an.puncak && an.puncak.tgl !== h.tgl) {
      isi.appendChild(el('p', { class: 'sebab-kaki',
        text: 'Dari puncak ' + UI.rpS(an.puncak.saldo) + ' di ' + UI.tglPendek(an.puncak.tgl) +
              ', saldo sudah turun ' + UI.rpS(an.turunDariPuncak) + '.' }));
    }

    return el('div', { class: 'sebab ' + (turun ? 'sebab-turun' : 'sebab-naik') }, [
      el('div', { class: 'sebab-head' }, [
        IK(turun ? 'arrowDown' : 'arrowUp', 15),
        el('span', { text: turun ? 'Kenapa saldo turun di tanggal ini' : 'Kenapa saldo di titik ini' })
      ]),
      isi
    ]);
  }

  /* ---------------------------------------------------- modal per hari */
  function detailHari(h, hasil) {
    var isi = el('div');

    isi.appendChild(el('div', { class: 'grid g3 grid-rapat' }, [
      UI.kartuKpi({ label: 'Saldo akhir hari', nilai: UI.rpS(h.saldo), sub: UI.rp(h.saldo) }),
      UI.kartuKpi({ label: 'Uang masuk', nilai: UI.rpS(h.masuk), sub: UI.rp(h.masuk) }),
      UI.kartuKpi({ label: 'Uang keluar', nilai: UI.rpS(h.keluar), sub: UI.rp(h.keluar) })
    ]));

    /* insight: kenapa saldo segini di tanggal ini */
    var an = E.analisaHari(hasil, h.tgl);
    var blok = blokPenyebab(an);
    if (blok) isi.appendChild(blok);

    var SUMBER = { rab: 'RAB', recurring: 'Fixed cost', baseline: 'Baseline harian',
                   rencana: 'Rencana', variabel: 'Biaya variabel', whatif: 'Simulasi', forecast: 'Dari target GMV' };

    isi.appendChild(UI.tabel([
      { judul: 'Pos', render: function (r) {
          return el('div', null, [
            el('div', { text: r.label }),
            el('div', { class: 'muted2', text: r.coa === 'penjualan' ? 'Gabungan channel penjualan' : CFG.namaCoa(r.coa) })
          ]); } },
      { judul: 'Sumber', lebar: '130px', render: function (r) {
          return el('span', { class: 'muted2', text: SUMBER[r.sumber] || 'Aktual' }); } },
      { judul: 'Nominal', kelas: 'kanan', lebar: '150px', render: function (r) {
          return el('span', { class: (r.tipe === 'in' ? 'hijau' : 'merah') + ' tebal',
            text: (r.tipe === 'in' ? '+' : '−') + UI.rp(r.nominal) }); } }
    ], h.item, { kosong: { ikon: 'inbox', judul: 'Tidak ada transaksi', pesan: 'Tanggal ini tidak punya arus kas masuk maupun keluar.' } }));

    if (h.tipe === 'proyeksi') {
      var rows = [];
      for (var c in h.detailMasuk) if (h.detailMasuk.hasOwnProperty(c)) rows.push({ coa: c, nominal: h.detailMasuk[c] });
      if (rows.length) {
        isi.appendChild(el('h4', { class: 'sub-judul', text: 'Rincian penerimaan (dari GMV H−lag)' }));
        isi.appendChild(UI.tabel([
          { judul: 'Pos penerimaan', render: function (r) { return CFG.namaCoa(r.coa); } },
          { judul: 'Nominal', kelas: 'kanan', render: function (r) {
              return el('span', { class: 'hijau tebal', text: UI.rp(r.nominal) }); } }
        ], rows));
      }
    }

    UI.modal(UI.tglLengkap(h.tgl), isi, [
      { label: 'Tutup', gaya: 'btn-ghost' },
      { label: 'Catat kas di tanggal ini', gaya: 'btn-utama', aksi: function () {
          setTimeout(function () { global.INPUT.kasCepat('in', function () { global.APP.render(); }); }, 220);
        } }
    ], {
      sub: h.tipe === 'aktual' ? 'Data aktual' : 'Proyeksi · skenario ' + hasil.skenario.nama,
      lebar: 'lebar'
    });
  }

  /* ======================================================================
     HALAMAN: KALENDER KAS
     ====================================================================== */
  HAL.kalender = {
    judul: 'Kalender Kas',
    sub: 'Lihat per tanggal — kapan uang banyak, kapan uang tipis',
    render: function (root, ulang) {
      var f = global.APP.filter;
      var hasil = hitungSemua();
      var aktif = hasil[f.skenario];

      root.appendChild(el('div', { class: 'bar-alat' }, [
        pemilihPeriode(ulang),
        el('div', { class: 'spacer' }),
        pilSkenario(hasil, ulang)
      ]));

      root.appendChild(el('div', { class: 'kal-legend' }, [
        el('span', { class: 'kal-lg' }, [el('span', { class: 'kotak kotak-bahaya' }), el('span', { text: 'Bahaya · < ' + UI.rpS(cfg().ambangBahaya) })]),
        el('span', { class: 'kal-lg' }, [el('span', { class: 'kotak kotak-waspada' }), el('span', { text: 'Waspada · < ' + UI.rpS(cfg().ambangWaspada) })]),
        el('span', { class: 'kal-lg' }, [el('span', { class: 'kotak kotak-aman' }), el('span', { text: 'Aman' })]),
        el('span', { class: 'kal-lg' }, [el('span', { class: 'kotak kotak-aktual' }), el('span', { text: 'Sudah aktual' })]),
        el('span', { class: 'muted2', text: '· klik tanggal untuk rincian' })
      ]));

      var perBulan = {}, urut = [];
      aktif.hari.forEach(function (h) {
        var b = h.tgl.slice(0, 7);
        if (!perBulan[b]) { perBulan[b] = []; urut.push(b); }
        perBulan[b].push(h);
      });

      urut.forEach(function (bln) {
        var hariBulan = perBulan[bln];
        var masuk = 0, keluar = 0, minH = null;
        hariBulan.forEach(function (h) {
          masuk += h.masuk; keluar += h.keluar;
          if (!minH || h.saldo < minH.saldo) minH = h;
        });

        var grid = el('div', { class: 'kal' });
        UI.HARI_PENDEK.forEach(function (n) { grid.appendChild(el('div', { class: 'kal-h', text: n })); });

        var pertama = new Date(hariBulan[0].tgl + 'T00:00:00').getDay(), i;
        for (i = 0; i < pertama; i++) grid.appendChild(el('div', { class: 'kal-sel luar' }));

        hariBulan.forEach(function (h) {
          var kelas = 'kal-sel';
          if (h.tipe === 'aktual') kelas += ' aktual';
          if (h.saldo < cfg().ambangBahaya) kelas += ' bahaya';
          else if (h.saldo < cfg().ambangWaspada) kelas += ' waspada';
          if (h.tgl === global.APP.hariIni) kelas += ' kini';

          var ev = h.item.filter(function (it) {
            return it.tipe === 'out' && it.nominal >= 50000000 &&
                   it.sumber !== 'forecast' && it.sumber !== 'baseline';
          });

          var sel = el('button', {
            class: kelas, type: 'button',
            title: UI.tglLengkap(h.tgl) + ' — saldo ' + UI.rp(h.saldo),
            onclick: function () { detailHari(h, aktif); }
          }, [
            el('div', { class: 'kal-tgl' }, [
              el('span', { class: 'kal-angka', text: String(UI.pecah(h.tgl).tg) }),
              h.tipe === 'aktual' ? el('span', { class: 'kal-dot' }) : null
            ]),
            el('div', { class: 'kal-saldo', text: UI.angkaS(h.saldo) }),
            el('div', { class: 'kal-flow' }, [
              el('span', { class: 'hijau', text: '+' + UI.angkaS(h.masuk) }),
              el('span', { class: 'merah', text: '−' + UI.angkaS(h.keluar) })
            ]),
            ev.length ? el('div', { class: 'kal-ev', text: ev[0].label +
              (ev.length > 1 ? ' +' + (ev.length - 1) : '') }) : null
          ]);
          grid.appendChild(sel);
        });

        root.appendChild(UI.seksi(
          UI.namaBulan(bln),
          'Masuk ' + UI.rpS(masuk) + ' · Keluar ' + UI.rpS(keluar) +
          ' · Terendah ' + UI.rpS(minH.saldo) + ' (' + UI.tglPendek(minH.tgl) + ')',
          grid
        ));
      });
    }
  };

  /* ======================================================================
     HALAMAN: SIMULASI WHAT-IF
     ====================================================================== */
  HAL.simulasi = {
    judul: 'Simulasi What-if',
    sub: 'Uji rencana di luar plan — bayar pajak, budget event, DP mendadak',
    render: function (root, ulang) {
      var f = global.APP.filter;
      var tanpa = E.hitungSemua(d(), { dari: f.dari, sampai: f.sampai, whatIf: [] });
      var dengan = hitungSemua();

      root.appendChild(el('div', { class: 'bar-alat' }, [
        pemilihPeriode(ulang),
        el('div', { class: 'spacer' }),
        pilSkenario(dengan, ulang)
      ]));

      root.appendChild(el('div', { class: 'alert alert-biru' }, [
        IK('info', 17),
        el('div', { html: 'Simulasi <b>tidak tersimpan ke sheet</b> — dipakai buat ngetes dampak sebelum diputuskan. ' +
          'Kalau sudah fix, klik <b>Jadikan RAB</b> supaya ikut terkunci di forecast.' })
      ]));

      /* --- form --- */
      var inTgl = UI.input({ type: 'date', value: f.dari });
      var segTipe = UI.segmen([
        { value: 'out', label: 'Uang keluar', ikon: 'arrowUp', kelas: 'seg-merah' },
        { value: 'in',  label: 'Uang masuk',  ikon: 'arrowDown', kelas: 'seg-hijau' }
      ], 'out', function () { isiCoa(); });
      var inCoa = UI.pilih([], '');
      var inNominal = UI.inputUang(0);
      var inLabel = UI.input({ placeholder: 'mis. Bayar PPh badan tahunan' });

      function isiCoa() {
        var arr = segTipe.dataset.nilai === 'in' ? CFG.COA_IN : CFG.COA_OUT;
        UI.kosongkan(inCoa);
        arr.forEach(function (c) { inCoa.appendChild(el('option', { value: c.id, text: c.nama })); });
      }
      isiCoa();

      var fTgl = UI.field('Tanggal', inTgl, null, { wajib: true });
      var fNom = UI.field('Nominal', inNominal, 'Bisa singkat: 500jt · 1,5m', { wajib: true });

      function tambah() {
        UI.bersihkanSalah(root);
        var nom = UI.nilaiUang(inNominal);
        if (!inTgl.value) { UI.salahField(fTgl, 'Tanggal wajib diisi'); return; }
        if (!nom) { UI.salahField(fNom, 'Nominal belum diisi'); return; }
        f.whatIf.push({
          id: S.uid('w'), tanggal: inTgl.value, coa: inCoa.value,
          tipe: segTipe.dataset.nilai, nominal: nom, label: inLabel.value.trim() || 'Simulasi'
        });
        UI.toast('Simulasi ditambahkan', 'sukses');
        ulang();
      }

      var form = el('div', { class: 'form-grid form-simulasi' }, [
        UI.field('Arah', segTipe), fTgl, UI.field('Pos', inCoa),
        UI.field('Keterangan', inLabel), fNom,
        el('div', { class: 'field field-tombol' }, UI.btn('Tambah', { gaya: 'btn-utama', ikon: 'plus', onKlik: tambah }))
      ]);
      form.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); tambah(); }
      });

      root.appendChild(UI.seksi('Tambah rencana', 'Masukkan pengeluaran/pemasukan di luar plan operasional.', form));

      /* --- daftar --- */
      if (f.whatIf.length) {
        var total = f.whatIf.reduce(function (a, w) { return a + (w.tipe === 'in' ? w.nominal : -w.nominal); }, 0);
        root.appendChild(UI.seksi('Simulasi aktif (' + f.whatIf.length + ')',
          'Dampak bersih ' + (total >= 0 ? '+' : '') + UI.rp(total),
          UI.tabel([
            { judul: 'Tanggal', lebar: '110px', render: function (r) { return UI.tglPendek(r.tanggal); } },
            { judul: 'Keterangan', render: function (r) {
                return el('div', null, [el('div', { text: r.label }), el('div', { class: 'muted2', text: CFG.namaCoa(r.coa) })]); } },
            { judul: 'Nominal', kelas: 'kanan', lebar: '150px', render: function (r) {
                return el('span', { class: (r.tipe === 'in' ? 'hijau' : 'merah') + ' tebal',
                  text: (r.tipe === 'in' ? '+' : '−') + UI.rp(r.nominal) }); } },
            { judul: '', kelas: 'kanan', lebar: '52px', cari: false, render: function (r) {
                return UI.btn('', { ikon: 'trash', kecil: true, gaya: 'btn-ghost', title: 'Hapus',
                  onKlik: function (e) {
                    var salinan = f.whatIf.slice();
                    f.whatIf = f.whatIf.filter(function (x) { return x.id !== r.id; });
                    UI.toast('Simulasi dihapus', 'sukses', {
                      onUndo: function () { f.whatIf = salinan; ulang(); }
                    });
                    ulang();
                  } }); } }
          ], f.whatIf),
          el('div', { class: 'baris' }, [
            UI.btn('Kosongkan', { kecil: true, ikon: 'trash', onKlik: function () {
              var salinan = f.whatIf.slice();
              f.whatIf = [];
              UI.toast('Semua simulasi dikosongkan', 'sukses', { onUndo: function () { f.whatIf = salinan; ulang(); } });
              ulang();
            } }),
            UI.btn('Jadikan RAB', { kecil: true, gaya: 'btn-utama', ikon: 'fileText',
              onKlik: function () { simulasiKeRab(ulang); } })
          ])
        ));
      } else {
        root.appendChild(UI.seksi('Simulasi aktif', null, UI.kosong({
          ikon: 'flask', judul: 'Belum ada simulasi',
          pesan: 'Tambahkan rencana di form atas untuk melihat dampaknya ke kurva saldo.'
        })));
      }

      /* --- dampak --- */
      var g3 = el('div', { class: 'grid g3' });
      CFG.SKENARIO.forEach(function (sk) {
        var a = tanpa[sk.id].ringkas, b = dengan[sk.id].ringkas;
        var selisih = b.saldoAkhir - a.saldoAkhir;
        var tA = a.terendahProyeksi || a.terendah, tB = b.terendahProyeksi || b.terendah;
        var minA = tA ? tA.saldo : 0, minB = tB ? tB.saldo : 0;
        g3.appendChild(el('div', { class: 'sk-kartu' + (f.skenario === sk.id ? ' aktif' : '') }, [
          el('div', { class: 'sk-head' }, [
            el('span', { class: 'sk-nama' }, [
              el('span', { class: 'pil-titik', style: 'background:' + sk.warna }),
              el('span', { text: sk.nama })
            ])
          ]),
          el('div', { class: 'sk-row' }, [el('span', { text: 'Saldo akhir semula' }), el('b', { text: UI.rpS(a.saldoAkhir) })]),
          el('div', { class: 'sk-row' }, [el('span', { text: 'Setelah simulasi' }), el('b', { style: 'color:' + sk.warna, text: UI.rpS(b.saldoAkhir) })]),
          el('div', { class: 'sk-row' }, [el('span', { text: 'Selisih' }),
            el('b', { class: selisih < 0 ? 'merah' : 'hijau', text: (selisih >= 0 ? '+' : '') + UI.rpS(selisih) })]),
          el('div', { class: 'sk-row sk-akhir' }, [
            el('span', { text: 'Kas terendah' }),
            el('b', { class: minB < cfg().ambangBahaya ? 'merah' : '',
              text: UI.rpS(minB) + (minB !== minA ? ' (dari ' + UI.rpS(minA) + ')' : '') })
          ])
        ]));
      });
      root.appendChild(g3);

      var plotWrap = el('div');
      root.appendChild(UI.seksi('Kurva setelah simulasi', 'Skenario aktif: ' + dengan[f.skenario].skenario.nama, plotWrap));
      CHART.saldoHarian(plotWrap, { hasil: dengan, aktif: f.skenario, cfg: cfg(), tinggi: 360,
        onKlikHari: function (h) { detailHari(h, dengan[f.skenario]); } });
      plotWrap.appendChild(CHART.legenda());
    }
  };

  function simulasiKeRab(ulang) {
    var f = global.APP.filter;
    var keluar = f.whatIf.filter(function (w) { return w.tipe === 'out'; });
    if (!keluar.length) { UI.toast('Tidak ada item pengeluaran untuk dipindahkan', 'warn'); return; }
    UI.konfirmasi('Pindahkan ke RAB?',
      keluar.length + ' item simulasi akan disimpan jadi RAB berstatus draft dan ikut terhitung permanen di forecast.',
      function () {
        Promise.all(keluar.map(function (w) {
          return S.tambah('rab', {
            bulan: w.tanggal.slice(0, 7), divisi: 'FINANCE', kegiatan: 'Dari simulasi',
            tanggalRencana: w.tanggal, deskripsi: w.label, item: 1, satuan: w.nominal,
            ket: 'idr', total: w.nominal, coa: w.coa, status: 'draft'
          });
        })).then(function () {
          f.whatIf = f.whatIf.filter(function (w) { return w.tipe !== 'out'; });
          UI.toast(keluar.length + ' item tersimpan sebagai RAB draft', 'sukses');
          ulang();
        });
      }, { aman: true, labelYa: 'Simpan sebagai RAB' });
  }

  HAL._detailHari = detailHari;
  HAL._kartuIsiSaldo = kartuIsiSaldo;
  HAL._pemilihPeriode = pemilihPeriode;
  HAL._pilSkenario = pilSkenario;
  HAL._setPeriode = setPeriode;
})(window);
