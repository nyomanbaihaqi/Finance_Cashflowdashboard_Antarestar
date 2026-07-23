# Panduan Deploy

Urutan yang benar: **backend dulu → isi config → baru push & deploy.**
Kalau dibalik, deployment pertama akan jalan di mode demo.

---

## 1 · Backend Apps Script (± 10 menit)

Ikuti `apps-script/README.md`. Ringkasnya:

1. Buka spreadsheet **Finance Dashboard** → **Extensions → Apps Script**
2. Tempel isi `apps-script/Code.gs` → **Save**
3. Pilih fungsi **`setupSekali`** → **Run** → beri izin → 8 tab terbentuk
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Salin **Web app URL** (harus berakhiran `/exec`, bukan `/dev`)

## 2 · Isi koneksi

Buka `assets/config.js`, baris paling atas:

```js
var CONN = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycb...../exec',
  TOKEN: '',   // biarkan kosong — lihat catatan keamanan di bawah
  ...
};
```

Tes lokal dulu:

```
node serve.js          →  http://localhost:5177
```

Status pojok kiri bawah harus 🟢 **Tersambung ke Sheet**.

## 3 · Push ke GitHub

```bash
git init
git add .
git commit -m "Antarestar cashflow projection dashboard"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

> **Repo harus PRIVATE.** Isi `assets/config.js` memuat URL Apps Script yang
> punya akses baca–tulis penuh ke spreadsheet keuangan.

`.gitignore` sudah menolak `*.xlsx`, `*.csv`, dan `_contoh/` supaya file
cashflow asli tidak ikut ter-commit.

## 4 · Deploy ke Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → pilih repo
2. Framework Preset: **Other**
3. Build Command: **kosongkan**
4. Output Directory: **kosongkan** (root)
5. **Deploy**

Tidak ada build step, tidak ada environment variable, tidak ada dependency.
`apps-script/`, `serve.js`, dan `DEPLOY.md` otomatis dilewati lewat `.vercelignore`.

## 5 · Kunci aksesnya

Vercel → Project → **Settings → Deployment Protection**:

- **Vercel Authentication** — hanya anggota tim Vercel yang bisa buka, atau
- **Password Protection** — satu password untuk semua orang (paling praktis
  buat dibagikan ke tim finance)

Lakukan ini **sebelum** URL-nya dibagikan.

---

## Setelah deploy — pengisian awal

1. **Pengaturan** → isi **Saldo kas awal** + tanggalnya ← wajib, semua proyeksi
   berangkat dari sini
2. **Input → Unggah sheet** → unggah `CASHFLOW PROJECTION AGUST - DES 2026.xlsx`
   - pilih sheet **Copy of CASHFLOW HARIAN** → jadi mutasi aktual
   - ulangi, pilih sheet **CASHFLOW AGUST - DES OPTIMIS** → jadi RAB + target bulanan
3. **Target Digicom** → cek/rapikan target per channel sampai Desember
4. **Pengeluaran Rutin** → cek fixed cost & baseline operasional
5. **Proyeksi Kas** → lihat hasilnya

---

## Kalau ada perubahan kode

```bash
git add . && git commit -m "..." && git push
```

Vercel auto-deploy. **Naikkan angka `?v=` di `index.html`** setiap kali file di
`assets/` berubah — kalau tidak, browser yang sudah pernah buka akan memakai
cache lama.

Kalau `Code.gs` yang berubah: **Deploy → Manage deployments → (pensil) →
Version: New version → Deploy**. Jangan bikin *New deployment* baru, URL-nya
akan berubah.

---

## ⚠️ Catatan keamanan — baca sekali

`TOKEN` sengaja dikosongkan sesuai permintaan. Konsekuensinya jujur saja:

**Siapa pun yang tahu URL Apps Script bisa membaca dan menulis seluruh isi
spreadsheet keuangan tanpa login.** URL itu ada di dalam `assets/config.js`,
yang bisa dibaca lewat *view-source* oleh siapa pun yang bisa membuka halaman.

Itu **tidak masalah** selama:

- repo GitHub-nya **private**, dan
- Vercel **Deployment Protection** aktif

Dua hal itu yang jadi pengaman sebenarnya. Kalau salah satu bocor — repo tidak
sengaja dijadikan publik, atau URL Vercel tanpa proteksi tersebar — spreadsheet
langsung terbuka.

Kalau nanti mau naik satu tingkat, ada dua opsi:

1. **Aktifkan token** — isi `TOKEN` dengan string acak di `Code.gs` **dan**
   `config.js`. Menahan bot yang menembak URL acak, tapi tidak menahan orang
   yang bisa membuka halamannya.
2. **Proxy lewat Vercel Function** — pindahkan URL + token ke
   `api/sheet.js` sebagai Environment Variable, halaman memanggil `/api/sheet`.
   URL Apps Script tidak pernah sampai ke browser. Ini yang benar-benar aman,
   dan tetap tanpa build step. Bilang saja kalau mau dibuatkan.
