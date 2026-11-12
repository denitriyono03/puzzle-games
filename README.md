# Puzzle Games 🧩

Hub game teka-teki logika berbasis **Angular 22 + Angular Material 22** (standalone
components, SCSS, tanpa SSR). Saat ini berisi **Tango** (Matahari & Bulan ala LinkedIn)
dan **Zip** (satu jalur angka ala LinkedIn) yang sepenuhnya bisa dimainkan;
**Queens** sudah disiapkan sebagai kartu "Segera Hadir".

- 🌐 Live (setelah deploy): https://denitriyono03.github.io/puzzle-games/
- ⚙️ Semua tampilan & navigasi dikendalikan satu file: [`public/config.json`](public/config.json)
  — ubah warna, latar, atau menu tanpa rebuild. Panduan lengkap: [`docs/CONFIG_GUIDE.md`](docs/CONFIG_GUIDE.md)

## Fitur

- **Satu config, semua tampilan** — `config.json` dimuat saat startup (`APP_INITIALIZER`)
  dan diterapkan sebagai CSS variables. Ganti warna/latar/menu cukup edit file itu.
- **Mode gelap/terang** — tersimpan di `localStorage`, diterapkan lewat class `dark` di `<body>`.
- **Layout responsif** — topbar sticky + sidebar (`side` di desktop, drawer `over` di mobile),
  navigasi dirender dari `config.json`.
- **Tango 6×6, lazy-loaded** (`/tango`, chunk terpisah + spinner saat memuat):
  klik sel untuk mengganti kosong → ☀️ → 🌙 → kosong, constraint `=` / `×` antar sel,
  generator puzzle dengan solusi **unik terverifikasi** (backtracking + solver),
  3 tingkat kesulitan, puzzle harian (seed tanggal UTC), petunjuk (maks 3), undo,
  reset, periksa (sorot sel bermasalah + snackbar), timer, penghitung langkah,
  progress, dialog menang + confetti CSS, waktu terbaik per level & streak harian
  tersimpan di `localStorage`. Semua teks Bahasa Indonesia.
- **Zip 6×6, lazy-loaded** (`/zip`, chunk terpisah + spinner saat memuat):
  seret satu jalur dari angka 1 sampai 36 melewati semua angka berurutan dan
  mengisi seluruh papan (Hamiltonian path), generator puzzle dengan solusi
  **unik terverifikasi** (Warnsdorff + solver), 3 tingkat kesulitan, puzzle
  harian (seed tanggal UTC), petunjuk (maks 3), undo, reset, periksa (deteksi
  jalur buntu lewat solver + snackbar), timer, penghitung langkah, progress,
  dialog menang + confetti CSS, waktu terbaik per level & streak harian
  tersimpan di `localStorage`. Semua teks Bahasa Indonesia.
- **Chat dengan Bot** — tombol mengambang (FAB) di pojok kanan bawah membuka
  popup chat di semua halaman. Bot hibrida: pertanyaan yang dikenali (aturan
  Tango/Zip, game harian, skor & waktu terbaik dari `localStorage`, tema, daftar
  game) dijawab langsung oleh bot terprogram; pertanyaan lain diteruskan ke
  Gemini (`gemini-3.5-flash-lite`, model free tier termurah) dengan instruksi
  sistem agar hanya menjawab seputar situs ini. API key Gemini **tidak pernah**
  di-commit ke repo publik ini — cara yang dipakai adalah proxy Cloudflare
  Worker (`worker/`, key disimpan sebagai secret di Cloudflare; aktifkan
  dengan mengisi `chat.proxyUrl` di `config.json`), atau pengunjung
  memasukkannya sendiri lewat ikon ⚙️ di popup chat (tersimpan di
  `localStorage` browsernya). Lihat bagian Keamanan di
  [`docs/CONFIG_GUIDE.md`](docs/CONFIG_GUIDE.md).
  Riwayat chat tersimpan lokal (maks 20 pesan) dan bisa dihapus.

## Menjalankan

```bash
npm install
npm start            # dev server di http://localhost:4200/
npm run build        # build produksi (base href /puzzle-games/) ke dist/puzzle-games/
```

Prasyarat: Node 22+ (dikembangkan dengan Node v24.22.1, npm 10.9.4).

## Struktur

```
public/
  config.json            # <-- SATU file pengendali: situs, tema, layout, navigasi, game
  images/bg.jpg          # gambar latar (lokal, dari Unsplash)
src/
  app/
    config/              # ConfigService (load + terapkan CSS variables) + model + fallback
    services/theme.service.ts   # mode gelap/terang (localStorage)
    pages/home/          # beranda: hero, statistik, kartu game
    games/tango/
      tango.ts / .html / .scss  # komponen game + dialog menang
      tango-generator.ts        # generator puzzle (solusi unik)
      tango-solver.ts           # solver/backtracking + validasi
    games/zip/
      zip.ts / .html / .scss    # komponen game + dialog menang
      zip-generator.ts          # generator Hamiltonian path (Warnsdorff + solusi unik)
      zip-solver.ts             # solver jalur + validasi
    app.routes.ts        # home (lazy) + tango & zip (lazy, loadComponent)
  styles.scss            # tema Material + font self-hosted (Fontsource) + CSS variables
docs/CONFIG_GUIDE.md     # panduan lengkap config.json
```

## Mengubah tampilan tanpa rebuild

Edit `public/config.json` (atau salinan hasil build di `dist/puzzle-games/browser/config.json`),
lalu refresh browser — tidak perlu `npm run build` lagi. Contoh: ganti `theme.primary`
dari `#7c5cff` ke warna lain, atau `theme.backgroundImage` ke URL gambar lain.
Detail tiap kunci ada di [`docs/CONFIG_GUIDE.md`](docs/CONFIG_GUIDE.md).

## Menambah game baru

1. Buat komponen standalone di `src/app/games/<nama>/` (contoh: `queens.ts`).
2. Daftarkan route lazy di `src/app/app.routes.ts`:
   `{ path: 'queens', loadComponent: () => import('./games/queens/queens').then(m => m.Queens) }`
3. Tambahkan item navigasi di `public/config.json → navigation` (`enabled: true`,
   `route: "/queens"`) dan kartu game di `src/app/pages/home/home.ts`.
4. Bila perlu, tambahkan konfigurasi game di `public/config.json → games`.

## Deploy (GitHub Pages)

Repo `denitriyono03/puzzle-games` sudah dibuat (kosong). Build memakai
`baseHref: "/puzzle-games/"` (di `angular.json`), jadi hasil `dist/puzzle-games/browser/`
bisa langsung di-deploy ke GitHub Pages (mis. via Actions `upload-pages-artifact` +
`deploy-pages`, atau push isi `browser/` ke branch `gh-pages`).

> Catatan: repo ini sengaja **tidak berisi file `.github/workflows/`** — workflow
> deploy dibuat/dipasang terpisah oleh pemilik repo.

## Catatan teknis

- **Font self-hosted** (`@fontsource/inter`, `@fontsource/plus-jakarta-sans`,
  `@fontsource/material-icons`) — situs tidak bergantung pada Google Fonts saat runtime.
  Aturan kelas `.material-icons` didefinisikan manual di `styles.scss` karena paket
  Fontsource hanya menyediakan `@font-face`.
- **Zone.js**: Angular 22 CLI membuat proyek *zoneless* secara default; karena
  game memakai `setTimeout`/`setInterval` dan mutasi properti biasa, proyek ini
  memakai `provideZoneChangeDetection()` + `import 'zone.js'` di `main.ts`
  (plus `ChangeDetectorRef.detectChanges()` eksplisit setelah generator puzzle selesai).
- **Generator**: solusi penuh dibuat dengan backtracking acak, constraint dipasang
  konsisten dengan solusi, lalu sel dihapus satu per satu — penghapusan hanya
  dipertahankan bila solver (cap 2 solusi) memastikan solusi tetap unik.
  Anggaran waktu generasi < 2 detik; terukur ~1–7 ms per puzzle di pengujian.
- **Generator Zip**: satu Hamiltonian path acak dibuat dengan greedy Warnsdorff
  (fallback DFS backtracking), lalu nomor 1, angka tertinggi, dan sejumlah angka
  perantara dipasang di sepanjang path. Keunikan solusi diverifikasi solver
  (cap 2 solusi, dengan pruning konektivitas + paritas jarak ke angka berikutnya);
  bila tidak unik, satu angka tambahan dipasang di tengah celah terbesar
  (maks 4 tambahan) sebelum path dibuat ulang. Anggaran waktu generasi < 2 detik.
