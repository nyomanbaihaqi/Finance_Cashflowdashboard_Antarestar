/* ============================================================================
   ANTARESTAR — CASHFLOW PROJECTION · Backend Google Apps Script
   Spreadsheet: Finance Dashboard
   https://docs.google.com/spreadsheets/d/1trHZ_CLBoA0Wl3vr9hIPgtKp2GRIF1asc-fWsxViPY8/edit

   Cara deploy ada di apps-script/README.md — BACA ITU DULU.
   ========================================================================== */

/* TOKEN opsional. Biarkan '' → siapa pun yang tahu URL Web App bisa baca &
   tulis spreadsheet ini. Untuk mengaktifkan, isi string acak di sini DAN isi
   nilai yang sama di CFG.CONN.TOKEN pada assets/config.js.

   Catatan: token di app statis tetap bisa dibaca dari source halaman, jadi
   ini cuma menaikkan bar terhadap request iseng — bukan pengaman sungguhan.
   Pengaman sebenarnya ada di level akses halaman (repo privat + Vercel
   Deployment Protection). Lihat README. */
var TOKEN = '';

/* Kolom tiap tab. Nama kolom = nama properti di frontend. */
var SKEMA = {
  Actual:        ['id', 'tanggal', 'coa', 'tipe', 'nominal', 'catatan'],
  TargetBulanan: ['id', 'bulan', 'channel', 'gmv', 'skenario'],
  TargetHarian:  ['id', 'tanggal', 'channel', 'gmv', 'skenario'],
  RAB:           ['id', 'bulan', 'divisi', 'kegiatan', 'benefit', 'tanggalRencana',
                  'deskripsi', 'item', 'satuan', 'ket', 'total', 'coa', 'status'],
  Recurring:      ['id', 'nama', 'coa', 'nominal', 'tanggal', 'mulai', 'selesai', 'aktif'],
  Variabel:       ['id', 'nama', 'coa', 'persen', 'aktif'],
  /* 'keterangan' menyimpan detail yang lebih halus dari COA-nya, misalnya
     BPJS di dalam pos gaji, atau PPN berjalan vs tunggakan di dalam pos PPN.
     Tanpa kolom ini detail itu hilang begitu diunggah. */
  RencanaBulanan: ['id', 'bulan', 'coa', 'nominal', 'keterangan'],
  RencanaHarian:  ['id', 'tanggal', 'coa', 'nominal', 'keterangan']
};

/* Nama key di frontend → nama tab di spreadsheet */
var TAB = {
  actual: 'Actual',
  targetBulanan: 'TargetBulanan',
  targetHarian: 'TargetHarian',
  rab: 'RAB',
  recurring: 'Recurring',
  variabel: 'Variabel',
  rencanaBulanan: 'RencanaBulanan',
  rencanaHarian: 'RencanaHarian'
};

/* Kolom yang isinya tanggal — dipaksa jadi teks 'YYYY-MM-DD' saat dibaca */
var KOLOM_TANGGAL = { tanggal: 1, tanggalRencana: 1, bulan: 1, mulai: 1, selesai: 1 };

/* ========================================================================== */

function doGet(e) {
  return keluar({ ok: true, data: { pesan: 'Antarestar Cashflow API aktif', tab: Object.keys(SKEMA) } });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return keluar({ ok: false, error: 'Server sibuk, coba lagi.' });
  }

  try {
    var req = JSON.parse(e.postData.contents);
    if (TOKEN && req.token !== TOKEN) return keluar({ ok: false, error: 'Token tidak valid.' });

    siapkanSpreadsheet();
    var p = req.payload || {};
    var hasil;

    switch (req.action) {
      case 'bootstrap': hasil = aksiBootstrap(); break;
      case 'mutate':    hasil = aksiMutate(p.tab, p.aksi, p.row); break;
      case 'replace':   hasil = aksiReplace(p.tab, p.rows); break;
      case 'config':    hasil = aksiConfig(p.config); break;
      case 'ping':      hasil = { pesan: 'pong' }; break;
      default:          return keluar({ ok: false, error: 'Action tidak dikenal: ' + req.action });
    }

    return keluar({ ok: true, data: hasil });
  } catch (err) {
    return keluar({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

function keluar(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* -------------------------------------------------------------- struktur */

function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }

/* Bikin semua tab + header kalau belum ada. Aman dipanggil berulang kali. */
function siapkanSpreadsheet() {
  var buku = ss(), nama;

  for (nama in SKEMA) {
    if (!SKEMA.hasOwnProperty(nama)) continue;
    var kolom = SKEMA[nama];
    var sh = buku.getSheetByName(nama);

    if (!sh) {
      sh = buku.insertSheet(nama);
      sh.getRange(1, 1, 1, kolom.length).setValues([kolom]);
      sh.getRange(1, 1, 1, kolom.length).setFontWeight('bold').setBackground('#f1f5f9');
      sh.setFrozenRows(1);
      /* semua kolom sebagai teks polos supaya tanggal & angka tidak diubah Sheets */
      sh.getRange(1, 1, sh.getMaxRows(), kolom.length).setNumberFormat('@');
      continue;
    }

    /* Tab sudah ada: samakan header kalau skema bertambah kolom.
       Ini yang bikin penambahan kolom baru tidak perlu bikin ulang tab. */
    var lebarSekarang = Math.max(sh.getLastColumn(), 1);
    var judul = sh.getRange(1, 1, 1, lebarSekarang).getValues()[0];
    var beda = judul.length < kolom.length;
    if (!beda) {
      for (var q = 0; q < kolom.length; q++) {
        if (String(judul[q] || '').trim() !== kolom[q]) { beda = true; break; }
      }
    }
    if (beda) {
      if (sh.getMaxColumns() < kolom.length) {
        sh.insertColumnsAfter(sh.getMaxColumns(), kolom.length - sh.getMaxColumns());
      }
      sh.getRange(1, 1, 1, kolom.length).setValues([kolom])
        .setFontWeight('bold').setBackground('#f1f5f9');
      sh.getRange(1, 1, sh.getMaxRows(), kolom.length).setNumberFormat('@');
    }
  }

  var cfg = buku.getSheetByName('Config');
  if (!cfg) {
    cfg = buku.insertSheet('Config');
    cfg.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
    cfg.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#f1f5f9');
    cfg.setFrozenRows(1);
    cfg.getRange(1, 1, cfg.getMaxRows(), 2).setNumberFormat('@');
  }

  var log = buku.getSheetByName('Log');
  if (!log) {
    log = buku.insertSheet('Log');
    log.getRange(1, 1, 1, 4).setValues([['waktu', 'aksi', 'tab', 'detail']]);
    log.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#f1f5f9');
    log.setFrozenRows(1);
  }

  /* Sheet1 bawaan yang masih kosong → dibuang biar rapi */
  var s1 = buku.getSheetByName('Sheet1');
  if (s1 && buku.getSheets().length > 1 && s1.getLastRow() === 0) buku.deleteSheet(s1);
}

/* ---------------------------------------------------------------- baca */

function bacaTab(nama) {
  var sh = ss().getSheetByName(nama);
  if (!sh || sh.getLastRow() < 2) return [];

  var kolom = SKEMA[nama];
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, kolom.length).getValues();
  var out = [], i, j;

  for (i = 0; i < data.length; i++) {
    if (!String(data[i][0]).trim()) continue;          // baris tanpa id = kosong
    var obj = {};
    for (j = 0; j < kolom.length; j++) {
      obj[kolom[j]] = normalisasiNilai(kolom[j], data[i][j]);
    }
    out.push(obj);
  }
  return out;
}

function normalisasiNilai(kolom, v) {
  if (v instanceof Date) {
    var s = Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return KOLOM_TANGGAL[kolom] === 1 && (kolom === 'bulan' || kolom === 'mulai' || kolom === 'selesai')
      ? s.slice(0, 7) : s;
  }
  if (v === 'TRUE' || v === true) return true;
  if (v === 'FALSE' || v === false) return false;
  return v;
}

function bacaConfig() {
  var sh = ss().getSheetByName('Config');
  var out = {};
  if (!sh || sh.getLastRow() < 2) return out;

  var data = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues(), i;
  for (i = 0; i < data.length; i++) {
    var k = String(data[i][0]).trim();
    if (!k) continue;
    var v = data[i][1];
    if (typeof v === 'string') {
      var t = v.trim();
      if (t === 'TRUE') v = true;
      else if (t === 'FALSE') v = false;
      else if (t.charAt(0) === '{' || t.charAt(0) === '[') {
        try { v = JSON.parse(t); } catch (err) { /* biarkan sebagai teks */ }
      }
    }
    out[k] = v;
  }
  return out;
}

function aksiBootstrap() {
  return {
    config:        bacaConfig(),
    actual:        bacaTab('Actual'),
    targetBulanan: bacaTab('TargetBulanan'),
    targetHarian:  bacaTab('TargetHarian'),
    rab:           bacaTab('RAB'),
    recurring:     bacaTab('Recurring'),
    variabel:      bacaTab('Variabel'),
    rencanaBulanan: bacaTab('RencanaBulanan'),
    rencanaHarian:  bacaTab('RencanaHarian')
  };
}

/* --------------------------------------------------------------- tulis */

function cariBaris(sh, id) {
  if (sh.getLastRow() < 2) return -1;
  var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues(), i;
  for (i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function keBaris(nama, row) {
  var kolom = SKEMA[nama], out = [], i;
  for (i = 0; i < kolom.length; i++) {
    var v = row[kolom[i]];
    if (v === undefined || v === null) v = '';
    if (typeof v === 'boolean') v = v ? 'TRUE' : 'FALSE';
    if (typeof v === 'object') v = JSON.stringify(v);
    out.push(v);
  }
  return out;
}

function aksiMutate(tabKey, aksi, row) {
  var nama = TAB[tabKey];
  if (!nama) throw new Error('Tab tidak dikenal: ' + tabKey);
  var sh = ss().getSheetByName(nama);
  if (!sh) throw new Error('Sheet ' + nama + ' tidak ada');

  var baris = cariBaris(sh, row.id);

  if (aksi === 'hapus') {
    if (baris > 0) sh.deleteRow(baris);
    catat('hapus', nama, row.id);
    return { id: row.id, dihapus: baris > 0 };
  }

  var nilai = keBaris(nama, row);

  if (aksi === 'tambah' || baris < 0) {
    sh.appendRow(nilai);
    sh.getRange(sh.getLastRow(), 1, 1, nilai.length).setNumberFormat('@');
    catat('tambah', nama, row.id);
    return { id: row.id, baris: sh.getLastRow() };
  }

  sh.getRange(baris, 1, 1, nilai.length).setValues([nilai]);
  catat('ubah', nama, row.id);
  return { id: row.id, baris: baris };
}

function aksiReplace(tabKey, rows) {
  var nama = TAB[tabKey];
  if (!nama) throw new Error('Tab tidak dikenal: ' + tabKey);
  var sh = ss().getSheetByName(nama);
  var kolom = SKEMA[nama];

  /* Kosongkan isi, JANGAN deleteRows. Baris 1 di-freeze sebagai header, jadi
     kalau seluruh baris sisanya dihapus sekaligus Sheets menolak dengan
     "menghapus semua baris non-beku tidak mungkin dilakukan". clearContent
     tidak punya batasan itu dan juga lebih cepat. */
  var isiLama = sh.getLastRow();
  if (isiLama > 1) sh.getRange(2, 1, isiLama - 1, sh.getMaxColumns()).clearContent();

  rows = rows || [];
  if (rows.length) {
    /* Pastikan sheet cukup panjang sebelum menulis sekaligus. */
    var butuh = rows.length + 1;
    if (sh.getMaxRows() < butuh) sh.insertRowsAfter(sh.getMaxRows(), butuh - sh.getMaxRows());

    var nilai = rows.map(function (r) { return keBaris(nama, r); });
    sh.getRange(2, 1, nilai.length, kolom.length).setNumberFormat('@').setValues(nilai);
  }
  catat('replace', nama, rows.length + ' baris');
  return { jumlah: rows.length };
}

function aksiConfig(config) {
  var sh = ss().getSheetByName('Config');
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);

  var rows = [], k;
  for (k in config) {
    if (!config.hasOwnProperty(k)) continue;
    var v = config[k];
    if (typeof v === 'boolean') v = v ? 'TRUE' : 'FALSE';
    else if (v !== null && typeof v === 'object') v = JSON.stringify(v);
    rows.push([k, v === null || v === undefined ? '' : v]);
  }
  if (rows.length) sh.getRange(2, 1, rows.length, 2).setNumberFormat('@').setValues(rows);
  catat('config', 'Config', rows.length + ' key');
  return { jumlah: rows.length };
}

function catat(aksi, tab, detail) {
  try {
    var log = ss().getSheetByName('Log');
    log.appendRow([new Date(), aksi, tab, String(detail)]);
    /* simpan 2000 baris terakhir saja */
    if (log.getLastRow() > 2001) log.deleteRows(2, log.getLastRow() - 2001);
  } catch (err) { /* log gagal tidak boleh menggagalkan transaksi */ }
}

/* ==========================================================================
   Jalankan sekali dari editor Apps Script untuk membuat semua tab.
   ========================================================================== */
function setupSekali() {
  siapkanSpreadsheet();

  var pesan = 'Selesai. Tab siap: ' + Object.keys(SKEMA).join(', ') + ', Config, Log';
  Logger.log(pesan);

  /* Popup hanya bisa muncul kalau dijalankan dari menu spreadsheet. Dari editor
     Apps Script, getUi() melempar error — dan itu dulu terlihat seperti setup
     gagal padahal tab-nya sudah jadi. Sekarang kegagalan popup diabaikan. */
  try {
    SpreadsheetApp.getUi().alert(pesan);
  } catch (e) {
    /* tidak ada UI di konteks ini — cukup lihat hasilnya di Logs / spreadsheet */
  }
  return pesan;
}
