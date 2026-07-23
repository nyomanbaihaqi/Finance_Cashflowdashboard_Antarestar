/* ============================================================================
   ANTARESTAR — CASHFLOW PROJECTION
   chart.js — grafik SVG buatan sendiri (tanpa library, jalan offline)
     · garis saldo aktual (solid) + 3 skenario (putus-putus)
     · pita area antara Optimis & Pesimis
     · garis ambang bahaya + penanda batas aktual
     · stacked bar kategori arus kas harian
     · tooltip hover
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

  /* Lebar wadah — naik ke induk kalau elemen belum punya lebar (mis. saat
     dokumen belum di-layout), supaya grafik tidak pernah kosong. */
  function lebarWadah(n) {
    var el = n, guard = 0;
    while (el && guard++ < 6) {
      if (el.clientWidth) return el.clientWidth;
      el = el.parentElement;
    }
    return 960;
  }

  /* Skala "cantik" untuk sumbu Y */
  function langkahRapi(span, target) {
    var kasar = span / (target || 5);
    var pow = Math.pow(10, Math.floor(Math.log(kasar) / Math.LN10));
    var n = kasar / pow;
    var mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return mult * pow;
  }

  /* ==========================================================================
     saldoHarian(wadah, opt)
     opt = { hasil:{optimis,moderate,pesimis}, aktif, cfg, judul, sub, onKlikHari }
     ========================================================================== */
  function saldoHarian(wadah, opt) {
    UI.kosongkan(wadah);
    var hasil = opt.hasil, aktif = opt.aktif || 'moderate', cfg = opt.cfg || {};
    var utama = hasil[aktif];
    if (!utama || !utama.hari.length) {
      wadah.appendChild(UI.el('div', { class: 'kosong-plot', text: 'Belum ada data untuk periode ini.' }));
      return;
    }

    var hari = utama.hari;
    var n = hari.length;
    var lebar = Math.max(lebarWadah(wadah), 560);
    var tinggi = opt.tinggi || 380;
    var padKiri = 66, padKanan = 22, padAtas = 26, padBawah = 46;
    var plotW = lebar - padKiri - padKanan;
    var plotH = tinggi - padAtas - padBawah;

    /* ---- skala Y (saldo) ---- */
    var minS = Infinity, maxS = -Infinity, i, j, s;
    for (s in hasil) {
      if (!hasil.hasOwnProperty(s)) continue;
      for (i = 0; i < hasil[s].hari.length; i++) {
        var v = hasil[s].hari[i].saldo;
        if (v < minS) minS = v;
        if (v > maxS) maxS = v;
      }
    }
    var ambang = Number(cfg.ambangBahaya) || 0;
    if (ambang) { if (ambang < minS) minS = ambang; if (ambang > maxS) maxS = ambang; }
    if (minS > 0) minS = 0;
    if (maxS === minS) maxS = minS + 1;
    var pad = (maxS - minS) * 0.12;
    var yMin = minS - pad * 0.4, yMax = maxS + pad;
    var step = langkahRapi(yMax - yMin, 5);
    yMin = Math.floor(yMin / step) * step;
    yMax = Math.ceil(yMax / step) * step;

    function X(idx) { return padKiri + (n <= 1 ? plotW / 2 : plotW * idx / (n - 1)); }
    function Y(val) { return padAtas + plotH * (1 - (val - yMin) / (yMax - yMin)); }

    /* ---- skala bar (arus kas harian) ---- */
    var maxBar = 0;
    for (i = 0; i < n; i++) {
      var tot = 0;
      for (var b in hari[i].bucket) if (hari[i].bucket.hasOwnProperty(b)) tot += hari[i].bucket[b];
      /* pemasukan & pengeluaran ditumpuk terpisah → pakai yang terbesar */
      var masuk = hari[i].bucket.pemasukan || 0;
      var keluar = tot - masuk;
      if (masuk > maxBar) maxBar = masuk;
      if (keluar > maxBar) maxBar = keluar;
    }
    if (!maxBar) maxBar = 1;
    var barZonaH = plotH * 0.40;
    var barBase = padAtas + plotH;
    function BH(val) { return barZonaH * val / maxBar; }

    var svg = sv('svg', { class: 'plot', viewBox: '0 0 ' + lebar + ' ' + tinggi, width: '100%', height: tinggi });

    /* ---- gridline + label sumbu Y ---- */
    var g = sv('g');
    for (var val = yMin; val <= yMax + 1; val += step) {
      var y = Y(val);
      g.appendChild(sv('line', { x1: padKiri, y1: y, x2: lebar - padKanan, y2: y, class: 'grid' }));
      var t = sv('text', { x: padKiri - 10, y: y + 4, class: 'ax-y' });
      t.textContent = UI.angkaS(val);
      g.appendChild(t);
    }
    svg.appendChild(g);

    /* ---- bar kategori harian ---- */
    var urutan = ['pemasukan', 'supplier', 'import', 'iklan', 'operasional', 'gaji', 'lain'];
    var lebarBar = Math.max(2, Math.min(11, plotW / n * 0.5));
    var gBar = sv('g', { class: 'bars' });
    for (i = 0; i < n; i++) {
      var h = hari[i], cx = X(i);
      /* pemasukan (kiri) */
      var masukN = h.bucket.pemasukan || 0;
      if (masukN > 0) {
        var mh = BH(masukN);
        gBar.appendChild(sv('rect', {
          x: cx - lebarBar - 1, y: barBase - mh, width: lebarBar, height: mh,
          fill: CFG.BUCKET.pemasukan.warna, rx: 1.5, opacity: h.tipe === 'aktual' ? 0.9 : 0.45
        }));
      }
      /* pengeluaran ditumpuk (kanan) */
      var offset = 0;
      for (j = 1; j < urutan.length; j++) {
        var key = urutan[j], nilai = h.bucket[key] || 0;
        if (nilai <= 0) continue;
        var bh = BH(nilai);
        gBar.appendChild(sv('rect', {
          x: cx + 1, y: barBase - offset - bh, width: lebarBar, height: bh,
          fill: CFG.BUCKET[key].warna, rx: 1.5, opacity: h.tipe === 'aktual' ? 0.9 : 0.45
        }));
        offset += bh;
      }
    }
    svg.appendChild(gBar);

    /* ---- garis ambang bahaya ---- */
    if (ambang) {
      var ya = Y(ambang);
      svg.appendChild(sv('line', { x1: padKiri, y1: ya, x2: lebar - padKanan, y2: ya, class: 'ambang' }));
      var ta = sv('text', { x: padKiri + 8, y: ya - 7, class: 'ambang-label' });
      ta.textContent = 'Ambang bahaya ' + UI.rpS(ambang);
      svg.appendChild(ta);
    }

    /* ---- indeks batas aktual ---- */
    var idxCutoff = -1;
    for (i = 0; i < n; i++) if (hari[i].tipe === 'aktual') idxCutoff = i;

    /* ---- pita antara Optimis & Pesimis (bagian proyeksi) ---- */
    if (hasil.optimis && hasil.pesimis && idxCutoff < n - 1) {
      var mulai = Math.max(idxCutoff, 0);
      var atas = [], bawah = [];
      for (i = mulai; i < n; i++) {
        atas.push(X(i) + ',' + Y(hasil.optimis.hari[i].saldo));
        bawah.unshift(X(i) + ',' + Y(hasil.pesimis.hari[i].saldo));
      }
      svg.appendChild(sv('polygon', {
        points: atas.concat(bawah).join(' '),
        fill: (CFG.SKENARIO.filter(function (x) { return x.id === aktif; })[0] || CFG.SKENARIO[1]).warna,
        opacity: 0.09
      }));
    }

    /* ---- garis skenario (proyeksi, putus-putus) ---- */
    function jalur(arr, dari) {
      var d = [], k;
      for (k = dari; k < arr.length; k++) d.push((k === dari ? 'M' : 'L') + X(k) + ' ' + Y(arr[k].saldo));
      return d.join(' ');
    }
    CFG.SKENARIO.forEach(function (sk) {
      var r = hasil[sk.id];
      if (!r) return;
      var dari = Math.max(idxCutoff, 0);
      if (dari >= n - 1 && idxCutoff >= 0) return;
      svg.appendChild(sv('path', {
        d: jalur(r.hari, dari), fill: 'none', stroke: sk.warna,
        'stroke-width': sk.id === aktif ? 2.6 : 1.6,
        'stroke-dasharray': '7 5',
        opacity: sk.id === aktif ? 1 : 0.55,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }));
      /* titik akhir + label */
      var akhir = r.hari[n - 1];
      svg.appendChild(sv('circle', {
        cx: X(n - 1), cy: Y(akhir.saldo), r: sk.id === aktif ? 4.5 : 3.2,
        fill: sk.warna, opacity: sk.id === aktif ? 1 : 0.6
      }));
    });

    /* ---- garis aktual (solid) ---- */
    if (idxCutoff >= 0) {
      var da = [];
      for (i = 0; i <= idxCutoff; i++) da.push((i === 0 ? 'M' : 'L') + X(i) + ' ' + Y(hari[i].saldo));
      svg.appendChild(sv('path', {
        d: da.join(' '), fill: 'none', stroke: '#0f172a', 'stroke-width': 2.4,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }));
      for (i = 0; i <= idxCutoff; i++) {
        svg.appendChild(sv('circle', { cx: X(i), cy: Y(hari[i].saldo), r: 2.8, fill: '#0f172a' }));
      }
      /* penanda vertikal batas aktual */
      var xc = X(idxCutoff);
      svg.appendChild(sv('line', { x1: xc, y1: padAtas, x2: xc, y2: barBase, class: 'cutoff' }));
      var tc = sv('text', { x: xc - 8, y: padAtas - 8, class: 'cutoff-label', 'text-anchor': 'end' });
      tc.textContent = 'AKTUAL s/d ' + UI.tglPendek(hari[idxCutoff].tgl);
      svg.appendChild(tc);
    }

    /* ---- label sumbu X ---- */
    var lompat = Math.max(1, Math.ceil(n / 12));
    for (i = 0; i < n; i += lompat) {
      var tx = sv('text', { x: X(i), y: tinggi - 22, class: 'ax-x', 'text-anchor': 'middle' });
      tx.textContent = UI.tglPendek(hari[i].tgl);
      svg.appendChild(tx);
    }

    /* ---- lapisan hover ---- */
    var hoverLine = sv('line', { x1: 0, y1: padAtas, x2: 0, y2: barBase, class: 'hover-line', opacity: 0 });
    svg.appendChild(hoverLine);
    var hoverDot = sv('circle', { r: 5, class: 'hover-dot', opacity: 0 });
    svg.appendChild(hoverDot);

    var tip = UI.el('div', { class: 'plot-tip' });
    var box = UI.el('div', { class: 'plot-box' }, [svg, tip]);
    wadah.appendChild(box);

    var rectHover = sv('rect', {
      x: padKiri - plotW / (n * 2), y: padAtas,
      width: plotW + plotW / n, height: plotH,
      fill: 'transparent', style: 'cursor:crosshair'
    });
    svg.appendChild(rectHover);

    function idxDariX(px) {
      var rel = (px - padKiri) / plotW * (n - 1);
      return Math.max(0, Math.min(n - 1, Math.round(rel)));
    }

    function idxDariEvent(e) {
      var r = svg.getBoundingClientRect();
      var klienX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
      return { idx: idxDariX((klienX - r.left) * (lebar / r.width)), layarX: klienX - r.left, lebarLayar: r.width };
    }

    function sembunyikan() {
      tip.classList.remove('tampil');
      hoverLine.setAttribute('opacity', 0);
      hoverDot.setAttribute('opacity', 0);
    }

    rectHover.addEventListener('mousemove', function (e) {
      var p = idxDariEvent(e);
      tampilTip(p.idx, p.layarX, p.lebarLayar);
    });
    rectHover.addEventListener('mouseleave', sembunyikan);

    /* sentuh: geser jari untuk menelusuri tanggal, angkat untuk menutup */
    var geser = false;
    rectHover.addEventListener('touchstart', function (e) {
      geser = true;
      var p = idxDariEvent(e);
      tampilTip(p.idx, p.layarX, p.lebarLayar);
    }, { passive: true });
    rectHover.addEventListener('touchmove', function (e) {
      if (!geser) return;
      e.preventDefault();                       /* jangan ikut men-scroll halaman */
      var p = idxDariEvent(e);
      tampilTip(p.idx, p.layarX, p.lebarLayar);
    }, { passive: false });
    rectHover.addEventListener('touchend', function () {
      geser = false;
      setTimeout(sembunyikan, 2200);            /* beri waktu baca sebelum hilang */
    }, { passive: true });

    if (opt.onKlikHari) {
      rectHover.addEventListener('click', function (e) {
        var p = idxDariEvent(e);
        opt.onKlikHari(hari[p.idx], p.idx);
      });
    }

    function tampilTip(idx, pxLayar, lebarLayar) {
      var h = hari[idx];
      var xs = X(idx);
      hoverLine.setAttribute('x1', xs); hoverLine.setAttribute('x2', xs); hoverLine.setAttribute('opacity', 1);
      hoverDot.setAttribute('cx', xs); hoverDot.setAttribute('cy', Y(h.saldo));
      hoverDot.setAttribute('fill', h.tipe === 'aktual' ? '#0f172a'
        : (CFG.SKENARIO.filter(function (x) { return x.id === aktif; })[0] || {}).warna);
      hoverDot.setAttribute('opacity', 1);

      var rows = '';
      var urut = ['supplier', 'import', 'iklan', 'operasional', 'gaji', 'lain'];
      urut.forEach(function (k) {
        var v = h.bucket[k];
        if (!v) return;
        rows += '<div class="tip-row"><span class="tip-dot" style="background:' + CFG.BUCKET[k].warna + '"></span>' +
                '<span class="tip-k">' + CFG.BUCKET[k].label + '</span>' +
                '<span class="tip-v">' + UI.rpS(v) + '</span></div>';
      });

      tip.innerHTML =
        '<div class="tip-tgl">' + UI.tglPanjang(h.tgl) + ' · <b>' + (h.tipe === 'aktual' ? 'aktual' : 'proyeksi') + '</b></div>' +
        (h.tipe === 'proyeksi' ? '<div class="tip-sk">' + (CFG.SKENARIO.filter(function (x) { return x.id === aktif; })[0] || {}).nama + '</div>' : '') +
        '<div class="tip-utama"><span>Saldo</span><b>' + UI.rpS(h.saldo) + '</b></div>' +
        '<div class="tip-row"><span class="tip-dot" style="background:' + CFG.BUCKET.pemasukan.warna + '"></span><span class="tip-k">Penerimaan</span><span class="tip-v">' + UI.rpS(h.masuk) + '</span></div>' +
        rows +
        '<div class="tip-total"><span>Total keluar</span><b>' + UI.rpS(h.keluar) + '</b></div>' +
        '<div class="tip-kecil">' + UI.rp(h.saldo) + '</div>';

      tip.classList.add('tampil');
      var tw = tip.offsetWidth || 210;
      var kiri = pxLayar + 16;
      if (kiri + tw > lebarLayar - 8) kiri = pxLayar - tw - 16;
      tip.style.left = Math.max(4, kiri) + 'px';
      tip.style.top = Math.max(4, (Y(h.saldo) / tinggi) * (box.clientHeight || tinggi) - 40) + 'px';
    }
  }

  /* ==========================================================================
     legenda kategori
     ========================================================================== */
  function legenda() {
    var wrap = UI.el('div', { class: 'legend' });
    wrap.appendChild(UI.el('div', { class: 'legend-grup' }, [
      UI.el('span', { class: 'lg-line lg-solid' }), UI.el('span', { text: 'Aktual' }),
      UI.el('span', { class: 'lg-line lg-dash' }), UI.el('span', { text: 'Proyeksi skenario' }),
      UI.el('span', { class: 'lg-line lg-dot-pink' }), UI.el('span', { text: 'Ambang bahaya' })
    ]));
    var kat = UI.el('div', { class: 'legend-grup legend-kat' }, [UI.el('span', { class: 'legend-judul', text: 'KATEGORI HARIAN:' })]);
    ['pemasukan', 'supplier', 'import', 'iklan', 'operasional', 'gaji', 'lain'].forEach(function (k) {
      kat.appendChild(UI.el('span', { class: 'lg-item' }, [
        UI.el('span', { class: 'lg-dot', style: 'background:' + CFG.BUCKET[k].warna }),
        UI.el('span', { text: CFG.BUCKET[k].label })
      ]));
    });
    wrap.appendChild(kat);
    return wrap;
  }

  /* ==========================================================================
     batangBulanan — perbandingan target vs proyeksi per bulan
     data = [{label, a, b}]  a = target/optimis, b = proyeksi skenario aktif
     ========================================================================== */
  function batangBulanan(wadah, data, opt) {
    UI.kosongkan(wadah);
    opt = opt || {};
    if (!data.length) { wadah.appendChild(UI.el('div', { class: 'kosong-plot', text: 'Belum ada data.' })); return; }

    var lebar = Math.max(lebarWadah(wadah), 480), tinggi = opt.tinggi || 240;
    var padKiri = 60, padKanan = 16, padAtas = 16, padBawah = 34;
    var plotW = lebar - padKiri - padKanan, plotH = tinggi - padAtas - padBawah;
    var maks = 0, i;
    for (i = 0; i < data.length; i++) maks = Math.max(maks, data[i].a || 0, data[i].b || 0);
    if (!maks) maks = 1;
    var step = langkahRapi(maks, 4);
    var yMax = Math.ceil(maks / step) * step;

    var svg = sv('svg', { class: 'plot', viewBox: '0 0 ' + lebar + ' ' + tinggi, width: '100%', height: tinggi });
    for (var v = 0; v <= yMax + 1; v += step) {
      var y = padAtas + plotH * (1 - v / yMax);
      svg.appendChild(sv('line', { x1: padKiri, y1: y, x2: lebar - padKanan, y2: y, class: 'grid' }));
      var t = sv('text', { x: padKiri - 8, y: y + 4, class: 'ax-y' }); t.textContent = UI.angkaS(v);
      svg.appendChild(t);
    }

    var slot = plotW / data.length, w = Math.min(26, slot * 0.32);
    data.forEach(function (d, idx) {
      var cx = padKiri + slot * (idx + 0.5);
      var ha = plotH * (d.a || 0) / yMax, hb = plotH * (d.b || 0) / yMax;
      svg.appendChild(sv('rect', { x: cx - w - 2, y: padAtas + plotH - ha, width: w, height: ha, fill: '#cbd5e1', rx: 3 }));
      svg.appendChild(sv('rect', { x: cx + 2, y: padAtas + plotH - hb, width: w, height: hb, fill: opt.warna || '#ea580c', rx: 3 }));
      var tx = sv('text', { x: cx, y: tinggi - 12, class: 'ax-x', 'text-anchor': 'middle' });
      tx.textContent = d.label;
      svg.appendChild(tx);
    });

    wadah.appendChild(svg);
    wadah.appendChild(UI.el('div', { class: 'legend' }, UI.el('div', { class: 'legend-grup' }, [
      UI.el('span', { class: 'lg-dot', style: 'background:#cbd5e1' }), UI.el('span', { text: opt.labelA || 'Target' }),
      UI.el('span', { class: 'lg-dot', style: 'background:' + (opt.warna || '#ea580c') }), UI.el('span', { text: opt.labelB || 'Proyeksi' })
    ])));
  }

  global.CHART = { saldoHarian: saldoHarian, legenda: legenda, batangBulanan: batangBulanan };
})(window);
