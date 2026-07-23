# Backend — Google Apps Script

Menghubungkan dashboard ke spreadsheet **Finance Dashboard**
(`1trHZ_CLBoA0Wl3vr9hIPgtKp2GRIF1asc-fWsxViPY8`).

Selama langkah ini belum dikerjakan, dashboard tetap jalan — cuma pakai
**data demo / localStorage** dan tidak tersimpan ke sheet.

---

## 1. Pasang script

1. Buka spreadsheet **Finance Dashboard**.
2. Menu **Extensions → Apps Script**.
3. Hapus isi `Code.gs` bawaan, tempel seluruh isi file `apps-script/Code.gs` dari repo ini.
4. **Save** (ikon disket).

## 2. Bikin tab-nya

1. Di dropdown fungsi (atas), pilih **`setupSekali`** → klik **Run**.
2. Google minta izin → **Review permissions** → pilih akun → **Advanced** →
   *Go to (nama project) (unsafe)* → **Allow**.
   (Wajar: script ini memang butuh akses ke spreadsheet milik lu sendiri.)
3. Setelah selesai, cek spreadsheet — sekarang ada 8 tab:

   | Tab | Isi |
   |---|---|
   | `Config` | saldo awal, ambang kas, lag, kurs, setelan channel |
   | `Actual` | realisasi kas harian (uang masuk & keluar) |
   | `TargetBulanan` | target GMV per channel per bulan (dari digicom) |
   | `TargetHarian` | override target per tanggal |
   | `RAB` | pengajuan anggaran per divisi |
   | `Recurring` | fixed cost bulanan |
   | `Variabel` | biaya variabel (% dari omset) |
   | `Log` | audit trail semua perubahan |

## 3. Deploy jadi Web App

1. Tombol **Deploy → New deployment**.
2. Ikon gerigi → **Web app**.
3. Isi:
   - **Description**: `Antarestar Cashflow API`
   - **Execute as**: **Me** (akun pemilik spreadsheet)
   - **Who has access**: **Anyone**
4. **Deploy** → salin **Web app URL**
   (bentuknya `https://script.google.com/macros/s/AKfycb.../exec`).

> **"Anyone" itu perlu** supaya browser bisa akses tanpa login Google.
> Pengamannya ada di `TOKEN`. Baca catatan keamanan di bawah.

## 4. Sambungkan ke dashboard

Buka `assets/config.js`, isi bagian paling atas:

```js
var CONN = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycb...../exec',
  TOKEN: '',        // kosong = tanpa token (default)
  ...
};
```

Refresh dashboard → status di pojok kiri bawah berubah jadi
🟢 **Tersambung ke Sheet**.

### Token (opsional)

Default-nya **mati**. Kalau mau dinyalakan, isi string acak yang sama di dua tempat:
variabel `TOKEN` di baris awal `Code.gs`, dan `CONN.TOKEN` di `config.js`.
Kalau salah satu diisi tapi yang lain tidak, semua request akan ditolak.

Token hanya menahan bot yang menembak URL acak — bukan pengaman sungguhan,
karena nilainya tetap terbaca dari source halaman. Pengaman yang sebenarnya
ada di `DEPLOY.md`.

## 5. Kalau ada perubahan di Code.gs

**Deploy → Manage deployments → (pensil) → Version: New version → Deploy.**
Kalau bikin *New deployment* lagi, URL-nya berubah dan harus diganti di `config.js`.

---

## Cek cepat kalau bermasalah

| Gejala | Kemungkinan |
|---|---|
| Status tetap 🔵 Mode demo | `APPS_SCRIPT_URL` masih kosong atau tidak diawali `http` |
| Toast "Token tidak valid" | `TOKEN` diisi di `Code.gs` tapi tidak di `config.js` (atau sebaliknya) |
| Toast gagal sinkron / CORS | Deployment belum **Anyone**, atau masih pakai URL `/dev` (harus `/exec`) |
| Data lama muncul terus | Deployment belum di-update ke **New version** |
| Tab tidak muncul | `setupSekali` belum dijalankan / izin belum di-Allow |

Untuk melihat error mentah: Apps Script → **Executions**.

---

## ⚠️ Catatan keamanan

Deployment Web App memakai **Who has access: Anyone**, dan token default-nya mati.
Artinya **siapa pun yang tahu URL `/exec` bisa membaca & menulis spreadsheet ini
tanpa login.** URL itu ada di `assets/config.js` yang bisa dibaca lewat view-source.

Pengaman sebenarnya ada di level akses halaman:

- **repo GitHub private**, dan
- **Vercel Deployment Protection** aktif

Baca `DEPLOY.md` di root untuk langkah lengkapnya. Jangan taruh URL Apps Script
di repo publik.
