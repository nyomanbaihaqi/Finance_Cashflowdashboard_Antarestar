/* ============================================================================
   ANTARESTAR — CASHFLOW PROJECTION
   chart-board.js — grafik level board/komisaris.

   Prinsip: SATU grafik menjawab SATU pertanyaan.
     garisSaldo   → "kas kita aman nggak, dan kapan paling tipis?"
     batangArus   → "masuk berapa, keluar berapa, surplus/defisit?"
     donatKeluar  → "duitnya lari ke mana?"
     jembatan     → "kok saldo akhir jadi segini?" (waterfall)
   ========================================================================== */
(function (global) {
  'use strict';

  var UI = global.UI, CFG = global.CFG;
  var NS = 'http://www.w3.org/2000/svg';

  /* Warna & gaya garis dipatok di sini, bukan ikut warna skenario.
     Alasan: skenario memakai hijau/oranye/merah — kalau saldo ikut skenario,
     garis saldo bertabrakan dengan garis masuk (hijau) atau keluar (merah).
     Tiap garis juga dibedakan ketebalan + pola putus, jadi masih terbaca
     tanpa warna (cetak hitam-putih / buta warna). */
  var GARIS = {
    saldo:  { warna: '#1e40af', tebal: 3.0, dash: '' },        /* biru tua — hasil akhir */
    masuk:  { warna: '#059669', tebal: 2.0, dash: '' },        /* hijau — solid */
    keluar: { warna: '#dc2626', tebal: 2.0, dash: '7 4' }      /* merah — putus-putus */
  };

  function sv(tag, attrs) {
    var n = document.createElementNS(NS, tag), k;
    if (attrs) for (k in attrs) if (attrs.hasOwnProperty(k) && attrs[k] !== null && attrs[k] !== undefined) {
      n.setAttribute(k, attrs[k]);
    }
    return n;
  }

  function lebarWadah(n) {
    var el = n, g = 0;
    while (el && g++ < 6) { if (el.clientWidth) return el.clientWidth; el = el.parentElement; }
    return 960;
  }

  function langkahRapi(span, target) {
    var kasar = span / (target || 5);
    if (kasar <= 0) return 1;
    var pow = Math.pow(10, Math.floor(Math.log(kasar) / Math.LN10));
    var n = kasar / pow;
    var mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return mult * pow;
  }

  /* tooltip bersama */
  function buatTip(box) {
    var tip = UI.el('div', { class: 'plot-tip' });
    box.appendChild(tip);
    return {
      tampil: function (html, x, y, lebarBox) {
        tip.innerHTML = html;
        tip.classList.add('tampil');
        var tw = tip.offsetWidth || 210;
        var kiri = x + 16;
        if (kiri + tw > lebarBox - 8) kiri = x - tw - 16;
        tip.style.left = Math.max(4, kiri) + 'px';
        tip.style.top = Math.max(4, y - 20) + 'px';
      },
      sembunyi: function () { tip.classList.remove('tampil'); }
    };
  }

  function labelPeriode(p, grain) {
    if (grain === 'bulanan') return UI.namaBulanPendek(p.key);
    if (grain === 'mingguan') return UI.tglPendek(p.tglAwal);
    return UI.tglPendek(p.tglAwal);
  }
  function labelPanjang(p, grain) {
    if (grain === 'bulanan') return UI.namaBulan(p.key);
    if (p.tglAwal === p.tglAkhir) return UI.tglLengkap(p.tglAwal);
    return UI.tglPendek(p.tglAwal) + ' – ' + UI.tglPendek(p.tglAkhir);
  }

  /* ==========================================================================
     1. GARIS SALDO — "kas aman nggak?"
     Cuma garis saldo + zona bahaya. Tanpa bar, tanpa distraksi.
     opt = { seri:{optimis:[],moderate:[],pesimis:[]}, aktif, grain, cfg,
             tinggi, semuaSkenario, onKlik }
     ========================================================================== */
  function garisSaldo(wadah, opt) {
    UI.kosongkan(wadah);
    var seri = opt.seri, aktif = opt.aktif || 'moderate', grain = opt.grain || 'harian';
    var utama = seri[aktif] || [];
    if (!utama.length) {
      wadah.appendChild(UI.el('div', { class: 'kosong-plot', text: 'Belum ada data untuk periode ini.' }));
      return;
    }

    var n = utama.length;
    var lebar = Math.max(lebarWadah(wadah), 560);
    var tinggi = opt.tinggi || 380;

    var tampilCfg = opt.tampil || { saldo: true, masuk: false, keluar: false };
    if (!tampilCfg.saldo && !tampilCfg.masuk && !tampilCfg.keluar) tampilCfg = { saldo: true };

    var adaArus = !!(tampilCfg.masuk || tampilCfg.keluar);
    var ganda = !!(tampilCfg.saldo && adaArus);   /* sumbu ganda */

    /* Padding dirampingkan supaya garis memakai hampir seluruh lebar kartu —
       label sumbu cukup 52px, tidak perlu 72px. Panel bertumpuk: panel atas
       tidak menampilkan label tanggal (dipakai bersama panel bawah). */
    var tanpaLabelX = !!opt.tanpaLabelX;
    var padKiri = 52, padKanan = ganda ? 52 : 14;
    var padAtas = opt.judulPanel ? 26 : 34;
    var padBawah = tanpaLabelX ? 12 : 44;
    var plotW = lebar - padKiri - padKanan, plotH = tinggi - padAtas - padBawah;

    var i, s;
    var TIK = 5;

    /* Bangun skala rapi dari rentang nilai. */
    function buatSkala(min, max) {
      if (!isFinite(min)) { min = 0; max = 1; }
      if (min > 0) min = 0;
      if (max === min) max = min + 1;
      var p = (max - min) * 0.14;
      var lo = min - p * 0.5, hi = max + p;
      var st = langkahRapi(hi - lo, TIK);
      lo = Math.floor(lo / st) * st;
      hi = Math.ceil(hi / st) * st;
      return { lo: lo, hi: hi, step: st, n: Math.max(1, Math.round((hi - lo) / st)) };
    }

    /* --- rentang saldo --- */
    var sMin = Infinity, sMax = -Infinity;
    var daftarSeri = (tampilCfg.saldo && opt.semuaSkenario) ? Object.keys(seri) : [aktif];
    if (tampilCfg.saldo) {
      daftarSeri.forEach(function (id) {
        (seri[id] || []).forEach(function (p) {
          if (p.saldo < sMin) sMin = p.saldo;
          if (p.saldo > sMax) sMax = p.saldo;
        });
      });
    }
    var ambang = (tampilCfg.saldo ? (Number(opt.cfg.ambangBahaya) || 0) : 0);
    if (ambang) { sMin = Math.min(sMin, ambang); sMax = Math.max(sMax, ambang); }

    /* --- rentang arus --- */
    var aMin = Infinity, aMax = -Infinity;
    ['masuk', 'keluar'].forEach(function (k) {
      if (!tampilCfg[k]) return;
      utama.forEach(function (p) {
        if (p[k] < aMin) aMin = p[k];
        if (p[k] > aMax) aMax = p[k];
      });
    });

    var skS = tampilCfg.saldo ? buatSkala(sMin, sMax) : null;
    var skA = adaArus ? buatSkala(aMin, aMax) : null;

    /* Samakan jumlah garis bantu supaya kedua sumbu sejajar rapi. */
    if (ganda) {
      var nMax = Math.max(skS.n, skA.n);
      skS.hi = skS.lo + skS.step * nMax; skS.n = nMax;
      skA.hi = skA.lo + skA.step * nMax; skA.n = nMax;
    }

    /* skala tunggal dipakai saat cuma satu jenis yang tampil */
    var skUtama = skS || skA;

    function X(i2) { return padKiri + (n <= 1 ? plotW / 2 : plotW * i2 / (n - 1)); }
    function Ysk(v, sk) { return padAtas + plotH * (1 - (v - sk.lo) / (sk.hi - sk.lo)); }
    /* saldo selalu pakai skala saldo; arus pakai skala arus kalau sumbu ganda */
    function Y(v) { return Ysk(v, skS || skUtama); }
    function Ya(v) { return Ysk(v, ganda ? skA : skUtama); }

    var svg = sv('svg', { class: 'plot', viewBox: '0 0 ' + lebar + ' ' + tinggi, width: lebar, height: tinggi });

    /* zona bahaya (blok merah tipis di bawah ambang) */
    if (ambang) {
      var yA = Y(ambang), yBawah = padAtas + plotH;
      if (yA < yBawah) {
        svg.appendChild(sv('rect', {
          x: padKiri, y: yA, width: plotW, height: yBawah - yA,
          fill: '#e11d48', opacity: 0.055
        }));
      }
    }

    /* grid + label sumbu.
       Sumbu ganda: kiri = arus kas harian, kanan = saldo. Keduanya punya skala
       sendiri tapi garis bantunya sejajar, jadi masuk vs keluar tetap terlihat
       saling menyilang walau saldo jauh lebih besar. */
    var skKiri = ganda ? skA : skUtama;
    for (var k2 = 0; k2 <= skKiri.n; k2++) {
      var yg = padAtas + plotH * (1 - k2 / skKiri.n);
      svg.appendChild(sv('line', { x1: padKiri, y1: yg, x2: lebar - padKanan, y2: yg, class: 'grid' }));

      var tKiri = sv('text', { x: padKiri - 8, y: yg + 4, class: 'ax-y' });
      tKiri.textContent = UI.angkaS(skKiri.lo + skKiri.step * k2);
      svg.appendChild(tKiri);

      if (ganda) {
        var tKanan = sv('text', { x: lebar - padKanan + 8, y: yg + 4, class: 'ax-y ax-y-kanan' });
        tKanan.textContent = UI.angkaS(skS.lo + skS.step * k2);
        svg.appendChild(tKanan);
      }
    }
    /* Garis nol ditebalkan — batas antara "masih punya uang" dan "minus" itu
       titik terpenting di grafik keuangan, jangan sama dengan garis bantu lain. */
    function garisNol(sk, kelas) {
      if (!sk || sk.lo >= 0 || sk.hi <= 0) return;
      var y0 = Ysk(0, sk);
      svg.appendChild(sv('line', { x1: padKiri, y1: y0, x2: lebar - padKanan, y2: y0, class: kelas }));
    }
    garisNol(skKiri, 'nol');
    if (ganda) garisNol(skS, 'nol nol-kanan');

    if (ganda) {
      var jKiri = sv('text', { x: padKiri - 8, y: padAtas - 14, class: 'ax-judul', 'text-anchor': 'end',
        fill: GARIS.masuk.warna });
      jKiri.textContent = 'ARUS HARIAN';
      svg.appendChild(jKiri);
      var jKanan = sv('text', { x: lebar - padKanan + 8, y: padAtas - 14, class: 'ax-judul',
        fill: GARIS.saldo.warna });
      jKanan.textContent = 'SALDO';
      svg.appendChild(jKanan);
    }

    /* garis ambang */
    if (ambang) {
      var ya = Y(ambang);
      svg.appendChild(sv('line', { x1: padKiri, y1: ya, x2: lebar - padKanan, y2: ya, class: 'ambang' }));
      var ta = sv('text', { x: lebar - padKanan - 4, y: ya - 7, class: 'ambang-label', 'text-anchor': 'end' });
      ta.textContent = 'Batas aman ' + UI.rpS(ambang);
      svg.appendChild(ta);
    }

    /* indeks batas aktual */
    var idxCut = -1;
    for (i = 0; i < n; i++) if (utama[i].tipe === 'aktual') idxCut = i;


    /* ---- arsiran surplus / defisit antara garis masuk & keluar ----
       Ini yang bikin persilangan dua garis punya arti: hijau = hari itu
       pemasukan menang, merah = hari itu tekor. Dipotong tepat di titik
       perpotongan supaya warnanya tidak meleber. */
    if (tampilCfg.masuk && tampilCfg.keluar) {
      for (i = 0; i < n - 1; i++) {
        var m1 = utama[i].masuk, k1 = utama[i].keluar;
        var m2 = utama[i + 1].masuk, k2b = utama[i + 1].keluar;
        var d1 = m1 - k1, d2 = m2 - k2b;
        var x1 = X(i), x2 = X(i + 1);

        function petak(xa, ma, ka, xb, mb, kb, positif) {
          svg.appendChild(sv('polygon', {
            points: xa + ',' + Ya(ma) + ' ' + xb + ',' + Ya(mb) + ' ' +
                    xb + ',' + Ya(kb) + ' ' + xa + ',' + Ya(ka),
            fill: positif ? GARIS.masuk.warna : GARIS.keluar.warna,
            opacity: positif ? 0.13 : 0.11
          }));
        }

        if (d1 === 0 && d2 === 0) continue;
        if (d1 * d2 >= 0) {
          petak(x1, m1, k1, x2, m2, k2b, (d1 + d2) >= 0);
        } else {
          /* menyilang di antara dua titik — cari x potongnya */
          var t = d1 / (d1 - d2);
          var xc = x1 + (x2 - x1) * t;
          var mc = m1 + (m2 - m1) * t;   /* di titik potong masuk == keluar */
          petak(x1, m1, k1, xc, mc, mc, d1 > 0);
          petak(xc, mc, mc, x2, m2, k2b, d2 > 0);
        }
      }
    }

    /* ---- garis arus ---- */
    function garisArus(kunci) {
      if (!tampilCfg[kunci]) return;
      var g = GARIS[kunci];
      var dd = [], k;
      for (k = 0; k < n; k++) dd.push((k ? 'L' : 'M') + X(k) + ' ' + Ya(utama[k][kunci]));
      /* kalau arus tampil sendirian (tanpa lawannya), beri area tipis */
      if (!tampilCfg.saldo && !(tampilCfg.masuk && tampilCfg.keluar)) {
        var dasar = Ya(Math.max((ganda ? skA : skUtama).lo, 0));
        var area = dd.slice();
        area.push('L' + X(n - 1) + ' ' + dasar);
        area.push('L' + X(0) + ' ' + dasar + ' Z');
        svg.appendChild(sv('path', { d: area.join(' '), fill: g.warna, opacity: 0.08 }));
      }
      svg.appendChild(sv('path', {
        d: dd.join(' '), fill: 'none', stroke: g.warna, 'stroke-width': g.tebal,
        'stroke-dasharray': g.dash || null,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }));
    }

    if (tampilCfg.saldo) {
      /* Area di bawah saldo hanya saat saldo berdiri sendiri — kalau arus juga
         tampil, arsiran surplus/defisit yang lebih informatif dan dua isian
         sekaligus bikin grafik keruh. */
      if (!adaArus) {
        var titikArea = [];
        for (i = 0; i < n; i++) titikArea.push(X(i) + ',' + Y(utama[i].saldo));
        titikArea.push(X(n - 1) + ',' + (padAtas + plotH));
        titikArea.push(X(0) + ',' + (padAtas + plotH));
        svg.appendChild(sv('polygon', { points: titikArea.join(' '), fill: GARIS.saldo.warna, opacity: 0.08 }));
      }

      /* skenario pembanding hanya saat arus mati (kalau tidak, warnanya bentrok) */
      if (opt.semuaSkenario && !adaArus) {
        CFG.SKENARIO.forEach(function (sk) {
          if (sk.id === aktif || !seri[sk.id]) return;
          var dd2 = [];
          for (i = 0; i < seri[sk.id].length; i++) dd2.push((i ? 'L' : 'M') + X(i) + ' ' + Y(seri[sk.id][i].saldo));
          svg.appendChild(sv('path', {
            d: dd2.join(' '), fill: 'none', stroke: sk.warna, 'stroke-width': 1.4,
            'stroke-dasharray': '5 5', opacity: 0.45, 'stroke-linecap': 'round'
          }));
        });
      }
    }

    /* arus digambar sebelum saldo supaya garis saldo tetap paling menonjol */
    garisArus('masuk');
    garisArus('keluar');

    /* garis saldo: bagian aktual solid, proyeksi putus-putus */
    function jalur(dari, sampai) {
      var dd = [];
      for (var k = dari; k <= sampai; k++) dd.push((k === dari ? 'M' : 'L') + X(k) + ' ' + Y(utama[k].saldo));
      return dd.join(' ');
    }
    if (tampilCfg.saldo) {
      /* aktual = solid gelap, proyeksi = biru saldo. Skenario tidak lagi
         mewarnai garis ini supaya tidak bentrok dengan hijau/merah arus. */
      if (idxCut >= 0) {
        svg.appendChild(sv('path', { d: jalur(0, idxCut), fill: 'none', stroke: '#0f172a',
          'stroke-width': GARIS.saldo.tebal, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      }
      if (idxCut < n - 1) {
        svg.appendChild(sv('path', { d: jalur(Math.max(idxCut, 0), n - 1), fill: 'none',
          stroke: GARIS.saldo.warna, 'stroke-width': GARIS.saldo.tebal,
          'stroke-dasharray': idxCut >= 0 ? '7 5' : '0',
          'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      }
    }

    /* penanda batas aktual */
    if (idxCut >= 0 && idxCut < n - 1) {
      var xc = X(idxCut);
      svg.appendChild(sv('line', { x1: xc, y1: padAtas, x2: xc, y2: padAtas + plotH, class: 'cutoff' }));
      var tc = sv('text', { x: xc - 8, y: padAtas - 10, class: 'cutoff-label', 'text-anchor': 'end' });
      tc.textContent = 'AKTUAL';
      svg.appendChild(tc);
    }

    /* titik terendah + titik akhir — hanya relevan untuk garis saldo */
    if (tampilCfg.saldo) {
      var idxMin = -1, minVal = Infinity;
      for (i = 0; i < n; i++) {
        if (idxCut >= 0 && i <= idxCut) continue;
        if (utama[i].saldo < minVal) { minVal = utama[i].saldo; idxMin = i; }
      }
      if (idxMin < 0) { for (i = 0; i < n; i++) if (utama[i].saldo < minVal) { minVal = utama[i].saldo; idxMin = i; } }
      if (idxMin >= 0) {
        var xm = X(idxMin), ym = Y(minVal);
        var bahaya = ambang && minVal < ambang;
        svg.appendChild(sv('circle', { cx: xm, cy: ym, r: 6, fill: 'none',
          stroke: bahaya ? GARIS.keluar.warna : GARIS.saldo.warna, 'stroke-width': 2, opacity: 0.45 }));
        svg.appendChild(sv('circle', { cx: xm, cy: ym, r: 3.5, fill: bahaya ? GARIS.keluar.warna : GARIS.saldo.warna }));
        var lbl = sv('text', { x: xm, y: ym + 22, class: 'titik-label', 'text-anchor': 'middle',
          fill: bahaya ? GARIS.keluar.warna : "#475569" });
        lbl.textContent = 'terendah ' + UI.rpS(minVal);
        svg.appendChild(lbl);
      }
      svg.appendChild(sv('circle', { cx: X(n - 1), cy: Y(utama[n - 1].saldo), r: 4.5, fill: GARIS.saldo.warna }));
    }

    /* judul panel (dipakai saat grafik dipecah jadi beberapa panel) */
    if (opt.judulPanel) {
      var jp = sv('text', { x: padKiri - 8, y: padAtas - 10, class: 'ax-judul', 'text-anchor': 'end' });
      jp.textContent = opt.judulPanel;
      svg.appendChild(jp);
    }

    /* label X — panel atas melewatkannya karena berbagi sumbu dengan panel bawah */
    if (!tanpaLabelX) {
      var lompat = Math.max(1, Math.ceil(n / 12));
      for (i = 0; i < n; i += lompat) {
        var tx = sv('text', { x: X(i), y: tinggi - 20, class: 'ax-x', 'text-anchor': 'middle' });
        tx.textContent = labelPeriode(utama[i], grain);
        svg.appendChild(tx);
      }
    }

    var hoverLine = sv('line', { x1: 0, y1: padAtas, x2: 0, y2: padAtas + plotH, class: 'hover-line', opacity: 0 });
    svg.appendChild(hoverLine);
    var hoverDot = sv('circle', { r: 5, class: 'hover-dot', opacity: 0 });
    svg.appendChild(hoverDot);

    var box = UI.el('div', { class: 'plot-box' }, svg);
    wadah.appendChild(box);
    var tip = buatTip(box);

    var rect = sv('rect', { x: padKiri - plotW / (n * 2), y: padAtas, width: plotW + plotW / n, height: plotH,
      fill: 'transparent', style: 'cursor:crosshair' });
    svg.appendChild(rect);

    function idxDari(e) {
      var r = svg.getBoundingClientRect();
      var cx = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
      var px = (cx - r.left) * (lebar / r.width);
      return { i: Math.max(0, Math.min(n - 1, Math.round((px - padKiri) / plotW * (n - 1)))),
               x: cx - r.left, w: r.width };
    }
    function tampil(p) {
      var d = utama[p.i];
      /* titik hover menempel ke garis pertama yang sedang tampil */
      var kunciDot = tampil_kunciUtama();
      var yDot = kunciDot === 'saldo' ? Y(d.saldo) : Ya(d[kunciDot]);
      hoverLine.setAttribute('x1', X(p.i)); hoverLine.setAttribute('x2', X(p.i)); hoverLine.setAttribute('opacity', 1);
      hoverDot.setAttribute('cx', X(p.i)); hoverDot.setAttribute('cy', yDot);
      hoverDot.setAttribute('fill', kunciDot === 'masuk' ? GARIS.masuk.warna
        : kunciDot === 'keluar' ? GARIS.keluar.warna
        : (d.tipe === 'aktual' ? '#0f172a' : GARIS.saldo.warna));
      hoverDot.setAttribute('opacity', 1);

      var html = '<div class="tip-tgl">' + labelPanjang(d, grain) + ' · <b>' + d.tipe + '</b></div>';
      html += '<div class="tip-utama"><span>Saldo akhir</span><b>' + UI.rpS(d.saldo) + '</b></div>' +
        '<div class="tip-row"><span class="tip-dot" style="background:#10b981"></span><span class="tip-k">Masuk</span><span class="tip-v">' + UI.rpS(d.masuk) + '</span></div>' +
        '<div class="tip-row"><span class="tip-dot" style="background:#e11d48"></span><span class="tip-k">Keluar</span><span class="tip-v">' + UI.rpS(d.keluar) + '</span></div>' +
        '<div class="tip-total"><span>Selisih</span><b class="' + (d.net >= 0 ? 'hijau' : 'merah') + '">' +
          (d.net >= 0 ? '+' : '') + UI.rpS(d.net) + '</b></div>';
      tip.tampil(html, p.x, yDot / tinggi * (box.clientHeight || tinggi), p.w);
    }
    function tampil_kunciUtama() {
      if (tampilCfg.saldo) return 'saldo';
      if (tampilCfg.masuk) return 'masuk';
      if (tampilCfg.keluar) return 'keluar';
      return 'saldo';
    }
    rect.addEventListener('mousemove', function (e) { tampil(idxDari(e)); });
    rect.addEventListener('mouseleave', function () {
      tip.sembunyi(); hoverLine.setAttribute('opacity', 0); hoverDot.setAttribute('opacity', 0);
    });
    rect.addEventListener('touchstart', function (e) { tampil(idxDari(e)); }, { passive: true });
    rect.addEventListener('touchmove', function (e) { e.preventDefault(); tampil(idxDari(e)); }, { passive: false });
    if (opt.onKlik) rect.addEventListener('click', function (e) { opt.onKlik(utama[idxDari(e).i]); });
  }

  /* ==========================================================================
     2. BATANG ARUS — "masuk berapa, keluar berapa?"
     Batang berpasangan + garis selisih. Paling jelas di grain bulanan.
     ========================================================================== */
  function batangArus(wadah, opt) {
    UI.kosongkan(wadah);
    var data = opt.data || [], grain = opt.grain || 'bulanan';
    if (!data.length) { wadah.appendChild(UI.el('div', { class: 'kosong-plot', text: 'Belum ada data.' })); return; }

    var lebar = Math.max(lebarWadah(wadah), 520), tinggi = opt.tinggi || 340;
    var padKiri = 52, padKanan = 14, padAtas = 30, padBawah = 40;
    var plotW = lebar - padKiri - padKanan, plotH = tinggi - padAtas - padBawah;

    var maks = 0, i;
    for (i = 0; i < data.length; i++) maks = Math.max(maks, data[i].masuk, data[i].keluar);
    if (!maks) maks = 1;
    var step = langkahRapi(maks, 4);
    var yMax = Math.ceil(maks / step) * step;

    function Y(v) { return padAtas + plotH * (1 - v / yMax); }

    var svg = sv('svg', { class: 'plot', viewBox: '0 0 ' + lebar + ' ' + tinggi, width: lebar, height: tinggi });

    for (var v = 0; v <= yMax + step / 2; v += step) {
      var y = Y(v);
      svg.appendChild(sv('line', { x1: padKiri, y1: y, x2: lebar - padKanan, y2: y, class: 'grid' }));
      var t = sv('text', { x: padKiri - 8, y: y + 4, class: 'ax-y' }); t.textContent = UI.angkaS(v);
      svg.appendChild(t);
    }

    /* Batang memenuhi slotnya (celah 12%) supaya grafik mentok kiri-kanan,
       sudut cuma dibulatkan tipis — tidak lancip, tidak juga kapsul. */
    var slot = plotW / data.length;
    var w = Math.max(2, slot * 0.44 - 1);
    var radius = Math.min(2, w / 3);

    /* Label angka & tanggal hanya digambar kalau muat — kalau dipaksa,
       teksnya saling menimpa dan malah tidak terbaca sama sekali. */
    var lebarLabelNilai = 44, lebarLabelTgl = 40;
    var lompatNilai = Math.max(1, Math.ceil(lebarLabelNilai / slot));
    var lompatTgl = Math.max(1, Math.ceil(lebarLabelTgl / slot));
    var muatNilai = slot >= 26;

    var box = UI.el('div', { class: 'plot-box' }, svg);
    wadah.appendChild(box);
    var tip = buatTip(box);

    data.forEach(function (p, idx) {
      var cx = padKiri + slot * (idx + 0.5);
      var hm = plotH * p.masuk / yMax, hk = plotH * p.keluar / yMax;
      var proy = p.tipe === 'proyeksi';

      svg.appendChild(sv('rect', { x: cx - w - 0.5, y: Y(p.masuk), width: w, height: Math.max(hm, 0),
        fill: '#059669', rx: radius, opacity: proy ? 0.62 : 1 }));
      svg.appendChild(sv('rect', { x: cx + 0.5, y: Y(p.keluar), width: w, height: Math.max(hk, 0),
        fill: '#dc2626', rx: radius, opacity: proy ? 0.62 : 1 }));

      /* selisih ditulis hanya kalau ada ruang & di posisi yang tidak bertabrakan */
      if (muatNilai && idx % lompatNilai === 0) {
        var atas = Math.min(Y(p.masuk), Y(p.keluar)) - 7;
        var tn = sv('text', { x: cx, y: atas, class: 'bar-net', 'text-anchor': 'middle',
          fill: p.net >= 0 ? '#059669' : '#dc2626' });
        tn.textContent = (p.net >= 0 ? '+' : '') + UI.angkaS(p.net);
        svg.appendChild(tn);
      }

      if (idx % lompatTgl === 0) {
        var tx = sv('text', { x: cx, y: tinggi - 22, class: 'ax-x', 'text-anchor': 'middle' });
        tx.textContent = labelPeriode(p, grain);
        svg.appendChild(tx);
      }

      var hit = sv('rect', { x: cx - slot / 2, y: padAtas, width: slot, height: plotH, fill: 'transparent' });
      hit.addEventListener('mousemove', function (e) {
        var r = svg.getBoundingClientRect();
        tip.tampil(
          '<div class="tip-tgl">' + labelPanjang(p, grain) + ' · <b>' + p.tipe + '</b></div>' +
          '<div class="tip-row"><span class="tip-dot" style="background:#10b981"></span><span class="tip-k">Masuk</span><span class="tip-v">' + UI.rpS(p.masuk) + '</span></div>' +
          '<div class="tip-row"><span class="tip-dot" style="background:#e11d48"></span><span class="tip-k">Keluar</span><span class="tip-v">' + UI.rpS(p.keluar) + '</span></div>' +
          '<div class="tip-utama"><span>Selisih</span><b class="' + (p.net >= 0 ? 'hijau' : 'merah') + '">' + (p.net >= 0 ? '+' : '') + UI.rpS(p.net) + '</b></div>' +
          '<div class="tip-total"><span>Saldo akhir</span><b>' + UI.rpS(p.saldo) + '</b></div>',
          e.clientX - r.left, padAtas + 20, r.width);
      });
      hit.addEventListener('mouseleave', function () { tip.sembunyi(); });
      svg.appendChild(hit);
    });

    var adaProyeksi = data.some(function (p) { return p.tipe === 'proyeksi'; });
    var adaAktual = data.some(function (p) { return p.tipe === 'aktual'; });
    wadah.appendChild(UI.el('div', { class: 'legend' }, UI.el('div', { class: 'legend-grup' }, [
      UI.el('span', { class: 'lg-dot', style: 'background:#059669' }), UI.el('span', { text: 'Uang masuk' }),
      UI.el('span', { class: 'lg-dot', style: 'background:#dc2626' }), UI.el('span', { text: 'Uang keluar' }),
      (adaProyeksi && adaAktual)
        ? UI.el('span', { class: 'muted2', text: '· batang pudar = proyeksi' })
        : null,
      muatNilai
        ? UI.el('span', { class: 'muted2', text: '· angka di atas batang = surplus/defisit' })
        : UI.el('span', { class: 'muted2', text: '· arahkan kursor ke batang untuk angka detailnya' })
    ])));
  }

  /* ==========================================================================
     3. DONAT KOMPOSISI — "duitnya lari ke mana?"
     ========================================================================== */
  function donatKeluar(wadah, opt) {
    UI.kosongkan(wadah);
    var potong = (opt.data || []).filter(function (p) { return p.nilai > 0; });
    if (!potong.length) {
      wadah.appendChild(UI.el('div', { class: 'kosong-plot', text: 'Belum ada pengeluaran di periode ini.' }));
      return;
    }
    potong.sort(function (a, b) { return b.nilai - a.nilai; });
    var total = potong.reduce(function (a, p) { return a + p.nilai; }, 0);

    var sisi = 230, R = 100, r = 62, cx = sisi / 2, cy = sisi / 2;
    var svg = sv('svg', { class: 'plot', viewBox: '0 0 ' + sisi + ' ' + sisi, width: sisi, height: sisi });

    var sudut = -Math.PI / 2;
    var wrap = UI.el('div', { class: 'donat-wrap' });
    var box = UI.el('div', { class: 'plot-box donat-svg' }, svg);
    var tip = buatTip(box);

    potong.forEach(function (p) {
      var porsi = p.nilai / total;
      var akhir = sudut + porsi * Math.PI * 2;
      var besar = porsi > 0.5 ? 1 : 0;
      var x1 = cx + R * Math.cos(sudut), y1 = cy + R * Math.sin(sudut);
      var x2 = cx + R * Math.cos(akhir), y2 = cy + R * Math.sin(akhir);
      var x3 = cx + r * Math.cos(akhir), y3 = cy + r * Math.sin(akhir);
      var x4 = cx + r * Math.cos(sudut), y4 = cy + r * Math.sin(sudut);

      var path = sv('path', {
        d: 'M' + x1 + ' ' + y1 + ' A' + R + ' ' + R + ' 0 ' + besar + ' 1 ' + x2 + ' ' + y2 +
           ' L' + x3 + ' ' + y3 + ' A' + r + ' ' + r + ' 0 ' + besar + ' 0 ' + x4 + ' ' + y4 + ' Z',
        fill: p.warna, class: 'donat-potong'
      });
      path.addEventListener('mousemove', function (e) {
        var rr = box.getBoundingClientRect();
        tip.tampil('<div class="tip-tgl">' + p.label + '</div>' +
          '<div class="tip-utama"><span>' + UI.persen(porsi * 100, 1) + '</span><b>' + UI.rpS(p.nilai) + '</b></div>',
          e.clientX - rr.left, e.clientY - rr.top, rr.width);
      });
      path.addEventListener('mouseleave', function () { tip.sembunyi(); });
      svg.appendChild(path);
      sudut = akhir;
    });

    var tt = sv('text', { x: cx, y: cy - 4, 'text-anchor': 'middle', class: 'donat-total' });
    tt.textContent = UI.rpS(total);
    svg.appendChild(tt);
    var tl = sv('text', { x: cx, y: cy + 14, 'text-anchor': 'middle', class: 'donat-label' });
    tl.textContent = 'total keluar';
    svg.appendChild(tl);

    var daftar = UI.el('div', { class: 'donat-legend' });
    potong.forEach(function (p) {
      daftar.appendChild(UI.el('div', { class: 'dl-baris' }, [
        UI.el('span', { class: 'dl-dot', style: 'background:' + p.warna }),
        UI.el('span', { class: 'dl-nama', text: p.label }),
        UI.el('span', { class: 'dl-persen', text: UI.persen(p.nilai / total * 100, 1) }),
        UI.el('span', { class: 'dl-nilai', text: UI.rpS(p.nilai) })
      ]));
    });

    wrap.appendChild(box);
    wrap.appendChild(daftar);
    wadah.appendChild(wrap);
  }

  /* ==========================================================================
     4. JEMBATAN (waterfall) — "kok saldo akhir jadi segini?"
     Saldo awal → + penerimaan → − tiap kategori → saldo akhir.
     ========================================================================== */
  function jembatan(wadah, opt) {
    UI.kosongkan(wadah);
    var langkah = opt.data || [];
    if (langkah.length < 2) {
      wadah.appendChild(UI.el('div', { class: 'kosong-plot', text: 'Belum ada arus kas di periode ini.' }));
      return;
    }

    var lebar = Math.max(lebarWadah(wadah), 560), tinggi = opt.tinggi || 360;
    var padKiri = 72, padKanan = 26, padAtas = 30, padBawah = 66;
    var plotW = lebar - padKiri - padKanan, plotH = tinggi - padAtas - padBawah;

    /* hitung posisi kumulatif tiap batang */
    var jalan = 0, batang = [], i;
    for (i = 0; i < langkah.length; i++) {
      var L = langkah[i];
      if (L.jenis === 'total') {
        batang.push({ L: L, dari: 0, ke: L.nilai, total: true });
        jalan = L.nilai;
      } else {
        batang.push({ L: L, dari: jalan, ke: jalan + L.nilai, total: false });
        jalan += L.nilai;
      }
    }

    var minV = 0, maxV = 0;
    batang.forEach(function (b) { minV = Math.min(minV, b.dari, b.ke); maxV = Math.max(maxV, b.dari, b.ke); });
    if (maxV === minV) maxV = minV + 1;
    var pad = (maxV - minV) * 0.12;
    var yMin = minV - pad, yMax = maxV + pad;
    var step = langkahRapi(yMax - yMin, 4);
    yMin = Math.floor(yMin / step) * step; yMax = Math.ceil(yMax / step) * step;
    function Y(v) { return padAtas + plotH * (1 - (v - yMin) / (yMax - yMin)); }

    var svg = sv('svg', { class: 'plot', viewBox: '0 0 ' + lebar + ' ' + tinggi, width: lebar, height: tinggi });
    for (var v = yMin; v <= yMax + step / 2; v += step) {
      var y = Y(v);
      svg.appendChild(sv('line', { x1: padKiri, y1: y, x2: lebar - padKanan, y2: y, class: 'grid' }));
      var t = sv('text', { x: padKiri - 12, y: y + 4, class: 'ax-y' }); t.textContent = UI.angkaS(v);
      svg.appendChild(t);
    }

    var slot = plotW / batang.length, w = Math.min(46, slot * 0.62);
    var box = UI.el('div', { class: 'plot-box' }, svg);
    wadah.appendChild(box);
    var tip = buatTip(box);

    batang.forEach(function (b, idx) {
      var cx = padKiri + slot * (idx + 0.5);
      var atas = Y(Math.max(b.dari, b.ke)), bawah = Y(Math.min(b.dari, b.ke));
      var h = Math.max(bawah - atas, 2);
      var warna = b.total ? '#0f172a' : (b.L.nilai >= 0 ? '#10b981' : '#e11d48');

      svg.appendChild(sv('rect', { x: cx - w / 2, y: atas, width: w, height: h, fill: warna, rx: 3,
        opacity: b.L.pudar ? 0.55 : 1 }));

      /* konektor ke batang berikutnya */
      if (idx < batang.length - 1) {
        var yk = Y(b.ke);
        svg.appendChild(sv('line', { x1: cx + w / 2, y1: yk, x2: cx + slot - w / 2, y2: yk,
          stroke: '#cbd5e1', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
      }

      var tv = sv('text', { x: cx, y: atas - 7, class: 'bar-net', 'text-anchor': 'middle',
        fill: b.total ? '#0f172a' : (b.L.nilai >= 0 ? '#059669' : '#e11d48') });
      tv.textContent = (b.total ? '' : (b.L.nilai >= 0 ? '+' : '−')) + UI.angkaS(Math.abs(b.total ? b.ke : b.L.nilai));
      svg.appendChild(tv);

      /* label bawah, dipotong biar muat */
      var nama = b.L.label.length > 16 ? b.L.label.slice(0, 15) + '…' : b.L.label;
      var tl2 = sv('text', { x: cx, y: tinggi - 40, class: 'ax-x', 'text-anchor': 'end',
        transform: 'rotate(-35 ' + cx + ' ' + (tinggi - 40) + ')' });
      tl2.textContent = nama;
      svg.appendChild(tl2);

      var hit = sv('rect', { x: cx - slot / 2, y: padAtas, width: slot, height: plotH, fill: 'transparent' });
      hit.addEventListener('mousemove', function (e) {
        var rr = svg.getBoundingClientRect();
        tip.tampil('<div class="tip-tgl">' + b.L.label + '</div>' +
          '<div class="tip-utama"><span>' + (b.total ? 'Posisi' : 'Perubahan') + '</span><b>' +
          (b.total ? UI.rpS(b.ke) : ((b.L.nilai >= 0 ? '+' : '') + UI.rpS(b.L.nilai))) + '</b></div>' +
          (b.total ? '' : '<div class="tip-total"><span>Saldo jadi</span><b>' + UI.rpS(b.ke) + '</b></div>'),
          e.clientX - rr.left, atas, rr.width);
      });
      hit.addEventListener('mouseleave', function () { tip.sembunyi(); });
      svg.appendChild(hit);
    });

    wadah.appendChild(UI.el('div', { class: 'legend' }, UI.el('div', { class: 'legend-grup' }, [
      UI.el('span', { class: 'lg-dot', style: 'background:#0f172a' }), UI.el('span', { text: 'Posisi saldo' }),
      UI.el('span', { class: 'lg-dot', style: 'background:#10b981' }), UI.el('span', { text: 'Menambah' }),
      UI.el('span', { class: 'lg-dot', style: 'background:#e11d48' }), UI.el('span', { text: 'Mengurangi' })
    ])));
  }

  /* ==========================================================================
     SPARKLINE — tren mini di dalam kartu KPI. tipe: 'garis' | 'batang'
     ========================================================================== */
  function sparkline(nilai, opt) {
    opt = opt || {};
    var w = opt.lebar || 88, h = opt.tinggi || 30, pad = 3;
    var warna = opt.warna || '#2563eb';
    var svg = sv('svg', { class: 'spark', viewBox: '0 0 ' + w + ' ' + h, width: w, height: h,
      preserveAspectRatio: 'none' });
    if (!nilai || nilai.length < 2) return svg;

    var min = Math.min.apply(null, nilai), max = Math.max.apply(null, nilai);
    if (max === min) { max += 1; min -= 1; }
    var n = nilai.length;
    function X(i) { return pad + (w - pad * 2) * i / (n - 1); }
    function Y(v) { return pad + (h - pad * 2) * (1 - (v - min) / (max - min)); }

    if (opt.tipe === 'batang') {
      var bw = Math.max(1.5, (w - pad * 2) / n * 0.6);
      var base = h - pad;
      for (var i = 0; i < n; i++) {
        var v = nilai[i];
        var bh = (h - pad * 2) * (max ? Math.abs(v) / max : 0);
        svg.appendChild(sv('rect', { x: X(i) - bw / 2, y: base - bh, width: bw, height: Math.max(bh, 0.5),
          rx: 1, fill: warna, opacity: 0.85 }));
      }
      return svg;
    }

    /* garis + area */
    var d = [], area = [];
    for (var j = 0; j < n; j++) {
      d.push((j ? 'L' : 'M') + X(j).toFixed(1) + ' ' + Y(nilai[j]).toFixed(1));
    }
    area = d.slice();
    area.push('L' + X(n - 1).toFixed(1) + ' ' + (h - pad));
    area.push('L' + X(0).toFixed(1) + ' ' + (h - pad) + ' Z');
    svg.appendChild(sv('path', { d: area.join(' '), fill: warna, opacity: 0.12 }));
    svg.appendChild(sv('path', { d: d.join(' '), fill: 'none', stroke: warna, 'stroke-width': 1.8,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    svg.appendChild(sv('circle', { cx: X(n - 1), cy: Y(nilai[n - 1]), r: 2.4, fill: warna }));
    return svg;
  }

  /* ==========================================================================
     GAUGE setengah lingkaran — persen 0..100. Buat "kesehatan kas" dll.
     ========================================================================== */
  function gauge(persen, opt) {
    opt = opt || {};
    persen = Math.max(0, Math.min(100, persen));
    var w = opt.lebar || 150, h = opt.tinggi || 92, sw = opt.tebal || 13;
    var cx = w / 2, cy = h - 6, R = Math.min(w / 2 - sw / 2 - 2, cy - sw / 2 - 2);
    var warna = opt.warna || '#2563eb';

    function titik(frac) {
      var a = Math.PI * (1 - frac);
      return [cx + R * Math.cos(a), cy - R * Math.sin(a)];
    }
    function busur(f1, f2) {
      var a = titik(f1), b = titik(f2);
      var besar = (f2 - f1) > 0.5 ? 1 : 0;
      return 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) +
             ' A' + R + ' ' + R + ' 0 ' + besar + ' 1 ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
    }

    var svg = sv('svg', { class: 'gauge', viewBox: '0 0 ' + w + ' ' + h, width: w, height: h });
    svg.appendChild(sv('path', { d: busur(0, 1), fill: 'none', stroke: '#e8edf5', 'stroke-width': sw, 'stroke-linecap': 'round' }));
    if (persen > 0) {
      svg.appendChild(sv('path', { d: busur(0, persen / 100), fill: 'none', stroke: warna,
        'stroke-width': sw, 'stroke-linecap': 'round' }));
    }
    var tv = sv('text', { x: cx, y: cy - 6, 'text-anchor': 'middle', class: 'gauge-val' });
    tv.textContent = Math.round(persen) + '%';
    svg.appendChild(tv);
    if (opt.label) {
      var tl = sv('text', { x: cx, y: cy + 8, 'text-anchor': 'middle', class: 'gauge-lbl' });
      tl.textContent = opt.label;
      svg.appendChild(tl);
    }
    return svg;
  }

  global.CHARTB = { garisSaldo: garisSaldo, batangArus: batangArus, donatKeluar: donatKeluar,
    jembatan: jembatan, sparkline: sparkline, gauge: gauge, GARIS: GARIS };
})(window);
