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
    var padKiri = 72, padKanan = 26, padAtas = 30, padBawah = 46;
    var plotW = lebar - padKiri - padKanan, plotH = tinggi - padAtas - padBawah;

    /* skala Y */
    var minS = Infinity, maxS = -Infinity, s, i;
    var daftarSeri = opt.semuaSkenario ? Object.keys(seri) : [aktif];
    daftarSeri.forEach(function (id) {
      (seri[id] || []).forEach(function (p) {
        if (p.saldo < minS) minS = p.saldo;
        if (p.saldo > maxS) maxS = p.saldo;
      });
    });
    var ambang = Number(opt.cfg.ambangBahaya) || 0;
    if (ambang) { minS = Math.min(minS, ambang); maxS = Math.max(maxS, ambang); }
    if (minS > 0) minS = 0;
    if (maxS === minS) maxS = minS + 1;
    var pad = (maxS - minS) * 0.14;
    var yMin = minS - pad * 0.5, yMax = maxS + pad;
    var step = langkahRapi(yMax - yMin, 5);
    yMin = Math.floor(yMin / step) * step;
    yMax = Math.ceil(yMax / step) * step;

    function X(i2) { return padKiri + (n <= 1 ? plotW / 2 : plotW * i2 / (n - 1)); }
    function Y(v) { return padAtas + plotH * (1 - (v - yMin) / (yMax - yMin)); }

    var svg = sv('svg', { class: 'plot', viewBox: '0 0 ' + lebar + ' ' + tinggi, width: '100%', height: tinggi });

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

    /* grid + label Y */
    for (var v = yMin; v <= yMax + step / 2; v += step) {
      var y = Y(v);
      svg.appendChild(sv('line', { x1: padKiri, y1: y, x2: lebar - padKanan, y2: y, class: 'grid' }));
      var t = sv('text', { x: padKiri - 12, y: y + 4, class: 'ax-y' });
      t.textContent = UI.angkaS(v);
      svg.appendChild(t);
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

    var warnaAktif = (CFG.SKENARIO.filter(function (x) { return x.id === aktif; })[0] || CFG.SKENARIO[1]).warna;

    /* area di bawah garis aktif */
    var titikArea = [];
    for (i = 0; i < n; i++) titikArea.push(X(i) + ',' + Y(utama[i].saldo));
    titikArea.push(X(n - 1) + ',' + (padAtas + plotH));
    titikArea.push(X(0) + ',' + (padAtas + plotH));
    svg.appendChild(sv('polygon', { points: titikArea.join(' '), fill: warnaAktif, opacity: 0.10 }));

    /* skenario lain (tipis) */
    if (opt.semuaSkenario) {
      CFG.SKENARIO.forEach(function (sk) {
        if (sk.id === aktif || !seri[sk.id]) return;
        var dd = [];
        for (i = 0; i < seri[sk.id].length; i++) dd.push((i ? 'L' : 'M') + X(i) + ' ' + Y(seri[sk.id][i].saldo));
        svg.appendChild(sv('path', {
          d: dd.join(' '), fill: 'none', stroke: sk.warna, 'stroke-width': 1.5,
          'stroke-dasharray': '6 5', opacity: 0.5, 'stroke-linecap': 'round'
        }));
      });
    }

    /* garis utama: bagian aktual solid, proyeksi putus-putus */
    function jalur(dari, sampai) {
      var dd = [];
      for (var k = dari; k <= sampai; k++) dd.push((k === dari ? 'M' : 'L') + X(k) + ' ' + Y(utama[k].saldo));
      return dd.join(' ');
    }
    if (idxCut >= 0) {
      svg.appendChild(sv('path', { d: jalur(0, idxCut), fill: 'none', stroke: '#0f172a',
        'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    }
    if (idxCut < n - 1) {
      svg.appendChild(sv('path', { d: jalur(Math.max(idxCut, 0), n - 1), fill: 'none', stroke: warnaAktif,
        'stroke-width': 2.8, 'stroke-dasharray': idxCut >= 0 ? '7 5' : '0',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    }

    /* penanda batas aktual */
    if (idxCut >= 0 && idxCut < n - 1) {
      var xc = X(idxCut);
      svg.appendChild(sv('line', { x1: xc, y1: padAtas, x2: xc, y2: padAtas + plotH, class: 'cutoff' }));
      var tc = sv('text', { x: xc - 8, y: padAtas - 10, class: 'cutoff-label', 'text-anchor': 'end' });
      tc.textContent = 'AKTUAL';
      svg.appendChild(tc);
    }

    /* titik terendah (proyeksi) — inti pesan chart ini */
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
        stroke: bahaya ? '#e11d48' : warnaAktif, 'stroke-width': 2, opacity: 0.45 }));
      svg.appendChild(sv('circle', { cx: xm, cy: ym, r: 3.5, fill: bahaya ? '#e11d48' : warnaAktif }));
      var lbl = sv('text', { x: xm, y: ym + 22, class: 'titik-label', 'text-anchor': 'middle',
        fill: bahaya ? '#e11d48' : '#475569' });
      lbl.textContent = 'terendah ' + UI.rpS(minVal);
      svg.appendChild(lbl);
    }

    /* titik akhir */
    svg.appendChild(sv('circle', { cx: X(n - 1), cy: Y(utama[n - 1].saldo), r: 4.5, fill: warnaAktif }));

    /* label X */
    var lompat = Math.max(1, Math.ceil(n / 12));
    for (i = 0; i < n; i += lompat) {
      var tx = sv('text', { x: X(i), y: tinggi - 20, class: 'ax-x', 'text-anchor': 'middle' });
      tx.textContent = labelPeriode(utama[i], grain);
      svg.appendChild(tx);
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
      hoverLine.setAttribute('x1', X(p.i)); hoverLine.setAttribute('x2', X(p.i)); hoverLine.setAttribute('opacity', 1);
      hoverDot.setAttribute('cx', X(p.i)); hoverDot.setAttribute('cy', Y(d.saldo));
      hoverDot.setAttribute('fill', d.tipe === 'aktual' ? '#0f172a' : warnaAktif);
      hoverDot.setAttribute('opacity', 1);
      var html = '<div class="tip-tgl">' + labelPanjang(d, grain) + ' · <b>' + d.tipe + '</b></div>' +
        '<div class="tip-utama"><span>Saldo akhir</span><b>' + UI.rpS(d.saldo) + '</b></div>' +
        '<div class="tip-row"><span class="tip-dot" style="background:#10b981"></span><span class="tip-k">Masuk</span><span class="tip-v">' + UI.rpS(d.masuk) + '</span></div>' +
        '<div class="tip-row"><span class="tip-dot" style="background:#e11d48"></span><span class="tip-k">Keluar</span><span class="tip-v">' + UI.rpS(d.keluar) + '</span></div>' +
        '<div class="tip-total"><span>Selisih</span><b class="' + (d.net >= 0 ? 'hijau' : 'merah') + '">' +
          (d.net >= 0 ? '+' : '') + UI.rpS(d.net) + '</b></div>';
      tip.tampil(html, p.x, Y(d.saldo) / tinggi * (box.clientHeight || tinggi), p.w);
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
    var padKiri = 72, padKanan = 26, padAtas = 26, padBawah = 52;
    var plotW = lebar - padKiri - padKanan, plotH = tinggi - padAtas - padBawah;

    var maks = 0, i;
    for (i = 0; i < data.length; i++) maks = Math.max(maks, data[i].masuk, data[i].keluar);
    if (!maks) maks = 1;
    var step = langkahRapi(maks, 4);
    var yMax = Math.ceil(maks / step) * step;

    function Y(v) { return padAtas + plotH * (1 - v / yMax); }

    var svg = sv('svg', { class: 'plot', viewBox: '0 0 ' + lebar + ' ' + tinggi, width: '100%', height: tinggi });

    for (var v = 0; v <= yMax + step / 2; v += step) {
      var y = Y(v);
      svg.appendChild(sv('line', { x1: padKiri, y1: y, x2: lebar - padKanan, y2: y, class: 'grid' }));
      var t = sv('text', { x: padKiri - 12, y: y + 4, class: 'ax-y' }); t.textContent = UI.angkaS(v);
      svg.appendChild(t);
    }

    var slot = plotW / data.length;
    var w = Math.min(30, slot * 0.30);
    var box = UI.el('div', { class: 'plot-box' }, svg);
    wadah.appendChild(box);
    var tip = buatTip(box);

    data.forEach(function (p, idx) {
      var cx = padKiri + slot * (idx + 0.5);
      var hm = plotH * p.masuk / yMax, hk = plotH * p.keluar / yMax;
      var proy = p.tipe === 'proyeksi';

      var rm = sv('rect', { x: cx - w - 3, y: Y(p.masuk), width: w, height: Math.max(hm, 0),
        fill: '#10b981', rx: 4, opacity: proy ? 0.55 : 1 });
      var rk = sv('rect', { x: cx + 3, y: Y(p.keluar), width: w, height: Math.max(hk, 0),
        fill: '#e11d48', rx: 4, opacity: proy ? 0.55 : 1 });
      svg.appendChild(rm); svg.appendChild(rk);

      /* label selisih di atas pasangan batang */
      var atas = Math.min(Y(p.masuk), Y(p.keluar)) - 8;
      var tn = sv('text', { x: cx, y: atas, class: 'bar-net', 'text-anchor': 'middle',
        fill: p.net >= 0 ? '#059669' : '#e11d48' });
      tn.textContent = (p.net >= 0 ? '+' : '') + UI.angkaS(p.net);
      svg.appendChild(tn);

      var tx = sv('text', { x: cx, y: tinggi - 26, class: 'ax-x', 'text-anchor': 'middle' });
      tx.textContent = labelPeriode(p, grain);
      svg.appendChild(tx);
      if (proy) {
        var tp = sv('text', { x: cx, y: tinggi - 13, class: 'ax-tag', 'text-anchor': 'middle' });
        tp.textContent = 'proyeksi';
        svg.appendChild(tp);
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

    wadah.appendChild(UI.el('div', { class: 'legend' }, UI.el('div', { class: 'legend-grup' }, [
      UI.el('span', { class: 'lg-dot', style: 'background:#10b981' }), UI.el('span', { text: 'Uang masuk' }),
      UI.el('span', { class: 'lg-dot', style: 'background:#e11d48' }), UI.el('span', { text: 'Uang keluar' }),
      UI.el('span', { class: 'muted2', text: '· angka di atas batang = surplus/defisit periode itu' })
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

    var svg = sv('svg', { class: 'plot', viewBox: '0 0 ' + lebar + ' ' + tinggi, width: '100%', height: tinggi });
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
    jembatan: jembatan, sparkline: sparkline, gauge: gauge };
})(window);
