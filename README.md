# Antarestar — Cashflow Projection

Dashboard proyeksi arus kas: memperkirakan **saldo kas harian sampai beberapa bulan
ke depan** dari target penjualan divisi digicom + RAB tiap divisi, dalam 3 skenario
(**Optimis · Moderate · Pesimis**), supaya finance tahu lebih awal:

- uang banyak masuk tanggal berapa
- uang tipis tanggal berapa (dan seberapa parah)
- kalau ada rencana di luar plan (bayar pajak, budget event, DP mendadak),
  dampaknya ke saldo seperti apa

Static murni — vanilla JS, tanpa build step. Data persist ke **Google Spreadsheet**
lewat **Apps Script** sebagai REST API. Deploy ke **Vercel** cukup drag folder.

---

## Isi folder

```
Finance Projection Antarestar/
├─ index.html               ← buka ini di browser
├─ assets/
│  ├─ config.js             ← MASTER DATA: COA, channel, target 2026, koneksi sheet
│  ├─ engine.js             ← mesin forecast (sebaran harian, lag H+5, 3 skenario)
│  ├─ store.js              ← state + sinkron sheet + fallback demo/localStorage
│  ├─ icons.js              ← set ikon SVG (tanpa font ikon eksternal)
│  ├─ ui.js                 ← formatter Rupiah/tanggal + komponen (modal, tabel, form)
│  ├─ chart.js              ← grafik SVG buatan sendiri (tanpa library, jalan offline)
│  ├─ xlsx.js               ← pembaca .xlsx/.csv sendiri (bongkar ZIP + urai XML)
│  ├─ import.js             ← wizard unggah sheet: deteksi layout → cocokkan pos
│  ├─ pages-1.js            ← Proyeksi Kas · Kalender Kas · Simulasi What-if
│  ├─ pages-2.js            ← RAB · Target Digicom · Pengeluaran Rutin · Aktual · Pengaturan
│  ├─ pages-3.js            ← Input Center + form kas cepat
│  ├─ ux.js                 ← command palette (Ctrl+K) + pintasan keyboard
│  ├─ app.js                ← sidebar + topbar + router
│  └─ style.css
├─ apps-script/
│  ├─ Code.gs               ← backend, tempel ke Apps Script
│  └─ README.md             ← panduan deploy backend
├─ serve.js                 ← server statis buat development lokal (opsional)
├─ vercel.json
├─ DEPLOY.md                ← langkah deploy + catatan keamanan (BACA INI DULU)
└─ README.md                ← file ini
```

---

## Unggah sheet lama

**Input → Unggah sheet** menerima `.xlsx` (Excel / Google Sheets) dan `.csv`.
Pembacanya ditulis sendiri — membongkar ZIP-nya pakai `DecompressionStream`
bawaan browser, jadi tetap nol dependency dan tidak ada file yang dikirim ke mana pun.

Alurnya: pilih file → pilih sheet → **tinjau hasil pencocokan pos** → impor.
Tidak ada yang tersimpan sebelum tombol Impor ditekan.

Dua layout dikenali otomatis:

| Layout | Ciri | Masuk ke |
|---|---|---|
| **Mutasi harian** | baris header berisi tanggal | Aktual Harian |
| **Rencana bulanan** | baris header berisi nama bulan (Agust, Sep, …) | pengeluaran → RAB draft · penerimaan → target bulanan |

Nama pos dicocokkan otomatis (persis → alias → kemiripan token). Yang tidak
yakin diberi label **Kurang yakin**, yang tidak ketemu diberi **Tidak ketemu** —
keduanya bisa dipetakan manual lewat dropdown sebelum impor.

Arah masuk/keluar **ditentukan dari pos hasil pencocokan**, bukan dari baris
penanda seksi. Banyak sheet punya baris `II PENERIMAAN` tapi lupa menulis
`III PENGELUARAN`, yang bikin seluruh biaya salah terbaca sebagai pemasukan.

Kalau ada nama pos baru yang sering muncul, daftarkan di `ALIAS_IMPOR`
(`assets/config.js`) supaya seterusnya kecocokannya persis.

---

## Cara pakai

### Mode demo (langsung, tanpa setup)
Buka `index.html` di browser. `APPS_SCRIPT_URL` masih kosong → app jalan dengan
**data contoh Juli 2026**. Semua fitur aktif, perubahan tersimpan di localStorage
browser saja.

Kalau browser menolak `file://`, jalankan server lokal:
```
node serve.js      →  http://localhost:5177
```

### Mode produksi (tersimpan ke Spreadsheet)
1. Ikuti **`apps-script/README.md`** (pasang script → `setupSekali` → deploy Web App).
2. Isi `APPS_SCRIPT_URL` + `TOKEN` di `assets/config.js`.
3. Buka dashboard → **Pengaturan** → isi **Saldo kas awal** + tanggalnya.
4. **Aktual Harian** → tempel mutasi kas dari sheet lama.
5. **Target Digicom** → isi target GMV per channel sampai Desember.
6. **Pengeluaran Rutin** → cek fixed cost & baseline operasional.

### Deploy ke Vercel
Langkah lengkapnya ada di **`DEPLOY.md`**. Ringkasnya: push ke GitHub (repo
**private**), import di Vercel dengan preset **Other** tanpa build command,
lalu nyalakan **Deployment Protection**.

> URL Apps Script ada di `assets/config.js` dan bisa dibaca lewat view-source.
> Repo private + Deployment Protection adalah pengamannya — jangan dilewat.

---

## Cara forecast-nya bekerja

```
Target GMV bulanan per channel   (input divisi DIGICOM)
        │
        ├─ disebar ke harian pakai POLA
        │    weekday 1,00 · weekend 1,05 · tanggal kembar ×3,0 (8.8, 9.9, 12.12)
        │    tgl 15 ×1,35 · tgl 25–27 ×1,15 · tgl 28+ ×0,90
        │    (bisa di-override manual per tanggal)
        │
        ├─ digeser +LAG hari         ← uang yang ke-track digicom di tanggal D
        │    default H+5               baru diakui finance jadi kas di D+5
        │
        ├─ dikali NETTO %            ← porsi GMV yang benar-benar jadi kas
        │    (fee marketplace, retur, cancel — diatur per channel)
        │
        └─ dikali FAKTOR SKENARIO
             Optimis  1,00
             Moderate 0,90   (−10% dari Optimis)
             Pesimis  0,81   (−10% dari Moderate)
                              ↓
                      PENERIMAAN HARIAN
                              −
                      PENGELUARAN HARIAN
                        ├─ RAB per divisi          (di tanggal rencananya)
                        ├─ Fixed cost bulanan      (di tanggal jatuh temponya)
                        ├─ Baseline operasional    (rata-rata realisasi harian)
                        └─ Biaya variabel % omset  (opsional, default OFF)
                              ↓
                      SALDO HARIAN BERJALAN
```

**Pengeluaran identik di ketiga skenario** — komitmen tetap harus dibayar berapa pun
omsetnya. Yang berubah cuma sisi penerimaan.

**Tanggal ≤ data aktual terakhir** memakai angka aktual, bukan proyeksi. Proyeksi
dimulai persis dari saldo aktual terakhir.

### Kenapa ada "baseline operasional"
Belanja yang jalan hampir tiap hari (bayar supplier, top up iklan, ops) tidak pernah
diajukan lewat RAB satu per satu. Kalau tidak dimodelkan, proyeksi saldo jadi **jauh
terlalu optimis**. Baseline = rata-rata realisasi harian tiap pos selama N hari terakhir.
Pos yang sudah dijadwalkan lewat Fixed Cost otomatis dikecualikan supaya tidak dobel.

> Kalau satu pos sudah direncanakan detail lewat RAB (mis. `PEMBELIAN BARANG MATERIAL /
> IMPORT`), **matikan** baseline-nya di halaman Pengeluaran Rutin — kalau tidak,
> pos itu dihitung dua kali.

---

## Halaman

| Halaman | Fungsi |
|---|---|
| **Proyeksi Kas** | KPI, grafik saldo harian 3 skenario, peringatan hari bahaya, agenda kas besar |
| **Kalender Kas** | tampilan bulanan — tiap tanggal berwarna sesuai aman/waspada/bahaya |
| **Simulasi What-if** | tambah rencana di luar plan, lihat dampaknya, bisa dipromosikan jadi RAB |
| **Input** | satu pintu semua input + form kas cepat + checklist kelengkapan data |
| **RAB** | form pengajuan per divisi (format sama dengan RAB yang dipakai sekarang) |
| **Target Digicom** | grid channel × bulan, override harian, target vs realisasi |
| **Pengeluaran Rutin** | fixed cost bulanan, baseline operasional, biaya variabel |
| **Aktual Harian** | catat realisasi kas, atau tempel langsung dari sheet |
| **Pengaturan** | saldo awal, ambang kas, lag & netto per channel, pola sebaran, backup |

> KPI dan peringatan di **Proyeksi Kas** sengaja hanya menghitung bagian **proyeksi**.
> Titik kas terendah yang sudah lewat tidak bisa ditindaklanjuti, jadi cuma disebut
> sebagai catatan di baris kecil.

---

## Cara pakai yang bikin cepat

**Ctrl + K** (⌘ K di Mac) membuka *perintah cepat* — semua aksi bisa dijangkau dari
sini tanpa pindah halaman: catat kas masuk/keluar, buat RAB, ganti skenario, buka sheet,
unduh backup. Ketik singkatannya saja (`ktm` → Catat uang masuk).

| Pintasan | Fungsi |
|---|---|
| `Ctrl/⌘ K` | perintah cepat |
| `N` | catat uang masuk |
| `?` | daftar pintasan |
| `Enter` | simpan form yang sedang dibuka (di form kas: simpan lalu lanjut entri berikutnya) |
| `Esc` | tutup dialog |

**Input nominal menerima singkatan** supaya tidak perlu menghitung nol:

| Ketik | Jadi |
|---|---|
| `500jt` | Rp 500.000.000 |
| `1,5m` atau `1.5m` | Rp 1.500.000.000 |
| `2,75jt` | Rp 2.750.000 |
| `250rb` / `300k` | Rp 250.000 / Rp 300.000 |

`m` = **miliar** (bukan million), mengikuti kebiasaan finance Indonesia.

**Semua penghapusan bisa diurungkan** — toast "Urungkan" muncul selama beberapa detik
setelah menghapus RAB, fixed cost, atau transaksi.

---

## Alur kerja bulanan

1. **Digicom** isi target GMV per channel di *Target Digicom* sampai akhir tahun.
2. **Tiap divisi** isi *RAB* untuk rencana pengeluaran bulan depan.
3. **Finance** cek *Pengeluaran Rutin* (fixed cost + baseline), lalu buka *Proyeksi Kas*:
   - kalau ada hari yang menembus ambang bahaya → geser tanggal RAB, atau kejar penerimaan
   - pakai *Simulasi What-if* untuk menguji rencana besar sebelum diputuskan
4. **Harian**: input realisasi di *Aktual Harian* → kurva proyeksi otomatis menyesuaikan.

---

## Menyesuaikan master data

Semua di `assets/config.js`:

| Yang mau diubah | Bagian |
|---|---|
| Tambah/ubah pos penerimaan | `COA_IN` |
| Tambah/ubah pos pengeluaran | `COA_OUT` (`bucket` menentukan warna di grafik) |
| Tambah channel jualan | `CHANNELS` + `PORSI_MP` |
| Daftar divisi pengisi RAB | `DIVISI` |
| Target master per bulan | `TARGET_2026` |
| Faktor skenario | `SKENARIO` |
| Pola sebaran harian | `POLA` (juga bisa diubah dari halaman Pengaturan) |

---

## Status

Frontend lengkap (9 halaman) + backend Apps Script + grafik SVG mandiri.

Sudah diuji lewat `node serve.js`:

- 9 halaman render tanpa error console
- Skenario: Moderate = `0,9000` × Optimis, Pesimis = `0,8100` × Optimis, pengeluaran identik
- Lag H+5: GMV Shopee 1 Agu masuk persis sebagai kas 6 Agu
- RAB Rp 1 M di 12 Agu menurunkan saldo akhir bulan tepat Rp 1 M, dan pulih saat dihapus
- Perhitungan RAB (ITEM × SATUAN) cocok dengan form yang dipakai sekarang
  (2.220 RMB × 2.370 = Rp 5.261.400)
- Parsing singkatan nominal benar untuk 12 pola uji
- Alur input: ketik `750jt` → Enter → tersimpan, toast undo muncul, fokus balik ke
  kolom nominal untuk entri berikutnya
- Command palette: pencocokan berurutan (`ktm` → "Catat uang masuk"), Esc menutup
- Modal: autofokus ke isian pertama, Esc menutup, fokus terkunci di dalam dialog
- Tidak ada horizontal scroll di 1240px, 1120px, maupun 375px (HP)

**Belum diuji end-to-end ke Google Sheet** — butuh deploy Apps Script dulu.

### Checklist tes setelah backend nyambung
- [ ] Status pojok kiri bawah 🟢 *Tersambung ke Sheet*
- [ ] Tambah 1 item RAB → muncul di tab `RAB` spreadsheet
- [ ] Refresh browser → item RAB tadi masih ada (berarti bootstrap jalan)
- [ ] Ubah saldo awal di Pengaturan → tab `Config` ikut berubah
- [ ] Tempel 10 baris mutasi di Aktual Harian → masuk tab `Actual`
- [ ] Isi target 1 channel 1 bulan → kurva proyeksi berubah
- [ ] Hapus 1 item → hilang dari sheet, tercatat di tab `Log`
- [ ] Buka dari HP → sidebar jadi tab horizontal, tidak ada scroll samping
