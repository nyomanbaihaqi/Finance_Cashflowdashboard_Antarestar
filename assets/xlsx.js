/* ============================================================================
   ANTARESTAR — CASHFLOW PROJECTION
   xlsx.js — pembaca file .xlsx tanpa library.

   .xlsx sebenarnya arsip ZIP berisi XML. File ini:
     1. membongkar ZIP-nya sendiri (baca central directory),
     2. men-decompress tiap entri pakai DecompressionStream('deflate-raw')
        yang sudah tersedia di browser modern — tidak perlu pustaka inflate,
     3. mengurai workbook.xml / sharedStrings.xml / sheetN.xml jadi grid 2 dimensi.

   Kalau browser terlalu tua (tidak punya DecompressionStream), fungsi
   `didukung()` mengembalikan false supaya UI bisa menyarankan unggah CSV.
   ========================================================================== */
(function (global) {
  'use strict';

  var td = new TextDecoder('utf-8');

  function didukung() {
    return typeof global.DecompressionStream === 'function';
  }

  /* -------------------------------------------------------------- ZIP */
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

  /* Cari End Of Central Directory dari belakang (comment maksimal 64 KB). */
  function cariEOCD(b) {
    var mulai = Math.max(0, b.length - 66000);
    for (var i = b.length - 22; i >= mulai; i--) {
      if (u32(b, i) === 0x06054b50) return i;
    }
    return -1;
  }

  function daftarEntri(b) {
    var eocd = cariEOCD(b);
    if (eocd < 0) throw new Error('Bukan file ZIP/XLSX yang valid.');

    var jml = u16(b, eocd + 10);
    var awalCD = u32(b, eocd + 16);
    if (awalCD === 0xffffffff) throw new Error('File ZIP64 belum didukung. Coba simpan ulang dari Excel/Sheets.');

    var entri = [], p = awalCD;
    for (var i = 0; i < jml && p + 46 <= b.length; i++) {
      if (u32(b, p) !== 0x02014b50) break;
      var metode = u16(b, p + 10);
      var ukComp = u32(b, p + 20);
      var ukAsli = u32(b, p + 24);
      var lnNama = u16(b, p + 28);
      var lnExtra = u16(b, p + 30);
      var lnKomen = u16(b, p + 32);
      var offLokal = u32(b, p + 42);
      var nama = td.decode(b.subarray(p + 46, p + 46 + lnNama));
      entri.push({ nama: nama, metode: metode, ukComp: ukComp, ukAsli: ukAsli, offLokal: offLokal });
      p += 46 + lnNama + lnExtra + lnKomen;
    }
    return entri;
  }

  function dataMentah(b, e) {
    if (u32(b, e.offLokal) !== 0x04034b50) throw new Error('Header lokal ZIP rusak pada ' + e.nama);
    var lnNama = u16(b, e.offLokal + 26);
    var lnExtra = u16(b, e.offLokal + 28);
    var awal = e.offLokal + 30 + lnNama + lnExtra;
    return b.subarray(awal, awal + e.ukComp);
  }

  function inflate(bytes) {
    var ds = new global.DecompressionStream('deflate-raw');
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }

  function isiEntri(b, e) {
    var raw = dataMentah(b, e);
    if (e.metode === 0) return Promise.resolve(td.decode(raw));          /* disimpan apa adanya */
    if (e.metode === 8) return inflate(raw).then(function (u) { return td.decode(u); });
    return Promise.reject(new Error('Metode kompresi ' + e.metode + ' tidak didukung pada ' + e.nama));
  }

  /* -------------------------------------------------------------- XML */
  function lepasEntitas(s) {
    return s.replace(/&#x([0-9a-fA-F]+);/g, function (a, h) { return String.fromCharCode(parseInt(h, 16)); })
            .replace(/&#(\d+);/g, function (a, d) { return String.fromCharCode(+d); })
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
            .replace(/&amp;/g, '&');
  }

  function bacaSharedStrings(xml) {
    var out = [];
    if (!xml) return out;
    var re = /<si>([\s\S]*?)<\/si>/g, m;
    while ((m = re.exec(xml))) {
      var potong = m[1].match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
      out.push(lepasEntitas(potong.map(function (t) { return t.replace(/<[^>]+>/g, ''); }).join('')));
    }
    return out;
  }

  /* Nomor kolom dari referensi sel: A→1, Z→26, AA→27 */
  function kolomDari(ref) {
    var m = /^([A-Z]+)/.exec(ref);
    if (!m) return 0;
    var n = 0, s = m[1];
    for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n;
  }

  /* Serial Excel → 'YYYY-MM-DD' (basis 1899-12-30, sesuai Excel & Sheets) */
  function serialKeTanggal(n) {
    var ms = Math.round((n - 25569) * 86400000);   /* 25569 = 1970-01-01 */
    var d = new Date(ms);
    if (isNaN(d.getTime())) return '';
    function p(x) { return x < 10 ? '0' + x : '' + x; }
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
  }

  /* Apakah angka ini masuk akal sebagai serial tanggal 2015–2035? */
  function mungkinTanggal(n) {
    return typeof n === 'number' && n >= 42000 && n <= 50000 && Math.abs(n - Math.round(n)) < 0.5;
  }

  function bacaSheet(xml, ss, batasBaris, batasKolom) {
    var grid = [], maksKolom = 0;
    var reBaris = /<row[^>]*\br="(\d+)"[^>]*(?:\/>|>([\s\S]*?)<\/row>)/g, mb;

    while ((mb = reBaris.exec(xml))) {
      var noBaris = +mb[1];
      if (batasBaris && noBaris > batasBaris) continue;
      var isi = mb[2] || '';
      var baris = [];
      var reSel = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g, ms;

      while ((ms = reSel.exec(isi))) {
        var atr = ms[1] || '', dalam = ms[2] || '';
        var mr = /\br="([A-Z]+\d+)"/.exec(atr);
        if (!mr) continue;
        var kol = kolomDari(mr[1]);
        if (batasKolom && kol > batasKolom) continue;

        var tipe = (/\bt="([^"]+)"/.exec(atr) || [])[1] || 'n';
        var nilai = null;

        if (tipe === 'inlineStr') {
          var potong = dalam.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
          nilai = lepasEntitas(potong.map(function (t) { return t.replace(/<[^>]+>/g, ''); }).join(''));
        } else {
          var mv = /<v>([\s\S]*?)<\/v>/.exec(dalam);
          if (!mv) continue;
          var v = mv[1];
          if (tipe === 's') nilai = ss[+v] !== undefined ? ss[+v] : '';
          else if (tipe === 'str') nilai = lepasEntitas(v);
          else if (tipe === 'e') nilai = null;                      /* #DIV/0! dsb → kosong */
          else if (tipe === 'b') nilai = v === '1';
          else { var f = parseFloat(v); nilai = isFinite(f) ? f : null; }
        }

        if (nilai === null || nilai === '') continue;
        baris[kol - 1] = nilai;
        if (kol > maksKolom) maksKolom = kol;
      }
      grid[noBaris - 1] = baris;
    }

    /* rapikan: pastikan semua baris array (bukan lubang) */
    var tinggi = grid.length;
    for (var i = 0; i < tinggi; i++) if (!grid[i]) grid[i] = [];
    return { grid: grid, kolom: maksKolom };
  }

  /* ==========================================================================
     baca(arrayBuffer, opsi) → Promise<{ sheets: [{nama, grid, kolom}] }>
     opsi.batasBaris / opsi.batasKolom membatasi ukuran yang diurai.
     ========================================================================== */
  function baca(arrayBuffer, opsi) {
    opsi = opsi || {};
    if (!didukung()) {
      return Promise.reject(new Error(
        'Browser ini belum mendukung pembacaan .xlsx. Pakai Chrome/Edge versi baru, ' +
        'atau simpan sheet-nya sebagai .csv lalu unggah CSV-nya.'));
    }

    var b = new Uint8Array(arrayBuffer);
    var entri;
    try { entri = daftarEntri(b); }
    catch (e) { return Promise.reject(e); }

    var peta = {};
    entri.forEach(function (e) { peta[e.nama] = e; });

    if (!peta['xl/workbook.xml']) {
      return Promise.reject(new Error('File ini bukan workbook Excel (xl/workbook.xml tidak ada).'));
    }

    var ss = [], daftarSheet = [];

    return isiEntri(b, peta['xl/workbook.xml'])
      .then(function (wbXml) {
        var relEntri = peta['xl/_rels/workbook.xml.rels'];
        return (relEntri ? isiEntri(b, relEntri) : Promise.resolve(''))
          .then(function (relXml) {
            var rel = {}, mr;
            var reRel = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
            while ((mr = reRel.exec(relXml))) rel[mr[1]] = mr[2];
            /* atribut bisa berurutan terbalik */
            reRel = /<Relationship\b[^>]*Target="([^"]+)"[^>]*Id="([^"]+)"/g;
            while ((mr = reRel.exec(relXml))) if (!rel[mr[2]]) rel[mr[2]] = mr[1];

            var ms, reSheet = /<sheet\b([^>]*)\/?>/g;
            while ((ms = reSheet.exec(wbXml))) {
              var atr = ms[1];
              var nama = (/name="([^"]*)"/.exec(atr) || [])[1];
              var rid = (/r:id="([^"]+)"/.exec(atr) || [])[1];
              var status = (/state="([^"]+)"/.exec(atr) || [])[1];
              if (!nama) continue;
              var target = rel[rid] || '';
              var jalur = target.replace(/^\/?xl\//, '').replace(/^\//, '');
              daftarSheet.push({
                nama: lepasEntitas(nama),
                jalur: 'xl/' + jalur,
                tersembunyi: status === 'hidden' || status === 'veryHidden'
              });
            }
          });
      })
      .then(function () {
        var e = peta['xl/sharedStrings.xml'];
        return e ? isiEntri(b, e).then(function (x) { ss = bacaSharedStrings(x); }) : null;
      })
      .then(function () {
        /* urai sheet satu per satu (berurutan supaya memori tidak meledak) */
        var hasil = [];
        return daftarSheet.reduce(function (rantai, s) {
          return rantai.then(function () {
            var e = peta[s.jalur];
            if (!e) { hasil.push({ nama: s.nama, grid: [], kolom: 0, tersembunyi: s.tersembunyi }); return; }
            return isiEntri(b, e).then(function (xml) {
              var r = bacaSheet(xml, ss, opsi.batasBaris || 400, opsi.batasKolom || 60);
              hasil.push({ nama: s.nama, grid: r.grid, kolom: r.kolom, tersembunyi: s.tersembunyi });
            });
          });
        }, Promise.resolve()).then(function () { return { sheets: hasil }; });
      });
  }

  /* --------------------------------------------------------------- CSV */
  /* Pemisah dideteksi otomatis: tab, titik koma, atau koma. */
  function bacaCsv(teks) {
    var baris = String(teks).replace(/\r\n?/g, '\n').split('\n');
    var contoh = baris.slice(0, 12).join('\n');
    var sep = (contoh.indexOf('\t') >= 0) ? '\t'
            : ((contoh.split(';').length > contoh.split(',').length) ? ';' : ',');

    var grid = [], maksKolom = 0;
    baris.forEach(function (b) {
      if (b === '') { grid.push([]); return; }
      var sel = [], kini = '', dalamKutip = false, i;
      for (i = 0; i < b.length; i++) {
        var c = b.charAt(i);
        if (dalamKutip) {
          if (c === '"' && b.charAt(i + 1) === '"') { kini += '"'; i++; }
          else if (c === '"') dalamKutip = false;
          else kini += c;
        } else if (c === '"') dalamKutip = true;
        else if (c === sep) { sel.push(kini); kini = ''; }
        else kini += c;
      }
      sel.push(kini);
      if (sel.length > maksKolom) maksKolom = sel.length;
      grid.push(sel.map(function (s) { return s.trim(); }));
    });

    return { sheets: [{ nama: 'CSV', grid: grid, kolom: maksKolom }] };
  }

  global.XLSX = {
    didukung: didukung,
    baca: baca,
    bacaCsv: bacaCsv,
    serialKeTanggal: serialKeTanggal,
    mungkinTanggal: mungkinTanggal,
    kolomDari: kolomDari
  };
})(window);
