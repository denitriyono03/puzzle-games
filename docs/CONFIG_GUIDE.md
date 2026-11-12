# Panduan `config.json` — Puzzle Games

Satu file mengendalikan seluruh situs: **`public/config.json`**. File ini dimuat
saat aplikasi mulai (`APP_INITIALIZER` → `ConfigService`), lalu diterapkan sebagai
CSS variables di `:root` dan dipakai komponen untuk merender navigasi & game.

> **Tidak perlu rebuild.** Setelah `npm run build`, file ini tersalin ke
> `dist/puzzle-games/browser/config.json`. Edit file itu di server/hosting lalu
> refresh browser — tampilan langsung berubah. Bila `config.json` gagal dimuat
> (mis. 404), aplikasi tetap jalan memakai nilai fallback di
> `src/app/config/config.service.ts` (`FALLBACK_CONFIG`).

## Struktur lengkap

```jsonc
{
  "site": { ... },        // identitas situs
  "theme": { ... },       // warna + font + latar (terang & gelap)
  "layout": { ... },      // ukuran sidebar / topbar / konten
  "features": { ... },    // saklar fitur
  "navigation": [ ... ],  // menu sidebar + topbar
  "games": { "tango": { ... } }
}
```

## `site`

| Kunci | Tipe | Contoh | Keterangan |
|---|---|---|---|
| `name` | string | `"Puzzle Games"` | Nama di topbar, sidebar, hero, `<title>` |
| `tagline` | string | `"Asah otakmu, satu teka-teki setiap kali."` | Subjudul hero & sidebar |
| `description` | string | `"Hub game teka-teki logika: ..."` | Paragraf hero |
| `logo` | string | `"🧩"` | Emoji/text logo (topbar & sidebar) |
| `footer` | string | `"Puzzle Games — dibuat dengan ..."` | Teks footer |
| `github` | string (URL) | `"https://github.com/denitriyono03/puzzle-games"` | Tautan ikon GitHub di topbar |
| `version` | string | `"1.0.0"` | Teks versi di bawah sidebar |

## `theme` — warna

Warna terang ada di `theme` langsung; varian gelap di `theme.darkTheme`
(kunci yang **sama persis**). Mode gelap aktif saat `<body>` punya class `dark`.

| Kunci | Dipakai untuk |
|---|---|
| `primary` | Warna utama: gradient topbar & hero, aksen tombol, ikon aktif |
| `secondary` | Warna kedua gradient, badge `×` |
| `accent` | Tombol aksen, badge "Segera", badge `=` |
| `background` | Warna dasar halaman (di balik gambar latar) |
| `surface` | Sidebar, permukaan Material |
| `card` | Kartu (hero, game, statistik, toolbar) |
| `text` | Teks utama |
| `muted` | Teks sekunder / deskripsi |
| `border` | Garis pemisah kartu & sidebar |
| `success` / `warning` / `error` | Status; `error` untuk sel bermasalah di Tango |

Nilai default (terang): primary `#7c5cff`, secondary `#22d3ee`, accent `#fbbf24`,
background `#f3f4fa`, surface/card `#ffffff`, text `#1d1b2e`, muted `#6b7280`,
border `#e4e6f0`. Nilai default (gelap): primary `#8b5cf6`, secondary `#22d3ee`,
accent `#fbbf24`, background `#0b0b16`, surface `#151524`, card `#1b1b2e`,
text `#f3f4f6`, muted `#9ca3af`, border `#2e2e47`.

### Contoh: mengganti warna

```jsonc
"theme": {
  "primary": "#059669",      // hijau zamrud sebagai warna utama ...
  "secondary": "#0ea5e9",
  "accent": "#f59e0b",
  // ...
  "darkTheme": {
    "primary": "#34d399",    // ... dan versi gelapnya
    "secondary": "#38bdf8",
    "accent": "#fbbf24",
    // ... (kunci lain tetap sama seperti sebelumnya)
  }
}
```

### Kunci tema lainnya

| Kunci | Tipe | Default | Keterangan |
|---|---|---|---|
| `borderRadius` | string (px) | `"16px"` | Radius sudut kartu & grid (`--pg-radius`) |
| `fontFamily.heading` | string | `"'Plus Jakarta Sans', system-ui, sans-serif"` | Font judul (harus tersedia — lihat catatan font) |
| `fontFamily.body` | string | `"'Inter', system-ui, sans-serif"` | Font teks isi |
| `backgroundImage` | string (URL/path) | `"images/bg.jpg"` | Gambar latar halaman. Path relatif → relatif terhadap base href (`/puzzle-games/`); boleh juga URL `https://…` penuh |
| `backgroundOverlayOpacity` | number 0–1 | `0.82` | Seberapa kuat warna latar menutupi gambar (0.82 = gambar samar 18%) |
| `backgroundBlur` | number (px) | `6` | Blur gambar latar |

### Contoh: mengganti latar

```jsonc
"theme": {
  "backgroundImage": "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80&auto=format&fit=crop",
  "backgroundOverlayOpacity": 0.7,
  "backgroundBlur": 4
}
```

> **Catatan font:** font dibundel lewat `@fontsource` (Inter + Plus Jakarta Sans),
> jadi mengganti `fontFamily` ke font lain hanya berpengaruh bila font itu
> tersedia di browser pengunjung (font sistem) atau ditambahkan paket Fontsource
> + import di `src/styles.scss`.

## `layout`

| Kunci | Tipe | Default | Keterangan |
|---|---|---|---|
| `sidebarWidth` | number (px) | `264` | Lebar sidebar desktop |
| `topbarHeight` | number (px) | `64` | Tinggi topbar (dan offset drawer mobile) |
| `contentMaxWidth` | number (px) | `1180` | Lebar maks konten halaman |

## `features`

| Kunci | Tipe | Default | Keterangan |
|---|---|---|---|
| `darkModeDefault` | boolean | `true` | Mode gelap saat pertama kali dibuka (sebelum pengguna memilih; pilihan tersimpan di `localStorage` kunci `pg-dark-mode`) |
| `animations` | boolean | `true` | Saklar fitur (saat ini informatif; animasi dikendalikan CSS) |
| `soundEffects` | boolean | `false` | Saklar fitur (belum dipakai — disiapkan untuk efek suara) |

## `navigation`

Array menu — dirender di **topbar** (hanya yang `enabled`) dan **sidebar** (semua;
yang `disabled` tampil abu-abu + badge).

```jsonc
"navigation": [
  { "id": "home",   "label": "Beranda", "icon": "home",     "route": "/",       "enabled": true,  "badge": "" },
  { "id": "tango",  "label": "Tango",   "icon": "wb_sunny", "route": "/tango",  "enabled": true,  "badge": "" },
  { "id": "queens", "label": "Queens",  "icon": "grid_on",  "route": "/queens", "enabled": false, "badge": "Segera" },
  { "id": "zip",    "label": "Zip",     "icon": "route",    "route": "/zip",    "enabled": true,  "badge": "" }
]
```

| Kunci | Keterangan |
|---|---|
| `id` | Pengenal unik (dipakai `track by`) |
| `label` | Teks menu |
| `icon` | Nama ikon [Material Icons](https://fonts.google.com/icons) (mis. `home`, `wb_sunny`, `grid_on`) |
| `route` | Path Angular (`/` atau `/tango`). Route harus ada di `src/app/app.routes.ts` bila `enabled: true` |
| `enabled` | `false` → menu nonaktif (abu-abu + badge) |
| `badge` | Teks lencana kecil, mis. `"Segera"` (kosongkan dengan `""` bila tidak ada) |

## `games.tango`

```jsonc
"games": {
  "tango": {
    "gridSize": 6,
    "difficulties": [
      { "id": "easy",   "label": "Mudah", "givens": 14 },
      { "id": "medium", "label": "Sedang", "givens": 10 },
      { "id": "hard",   "label": "Sulit",  "givens": 7 }
    ],
    "maxHints": 3,
    "showTimer": true,
    "dailyPuzzle": true
  }
}
```

| Kunci | Keterangan |
|---|---|
| `gridSize` | Ukuran grid (saat ini 6; generator & solver ditulis untuk 6×6) |
| `difficulties[]` | Daftar level: `id` (disimpan untuk waktu terbaik), `label`, `givens` = jumlah sel petunjuk awal. Makin sedikit givens, makin sulit |
| `maxHints` | Jumlah petunjuk per permainan |
| `showTimer` | Tampilkan timer & mulai hitung saat langkah pertama |
| `dailyPuzzle` | Aktifkan tombol & route Game Harian (`/tango?mode=daily`) |

## `games.zip`

```jsonc
"games": {
  "zip": {
    "gridSize": 6,
    "difficulties": [
      { "id": "easy",   "label": "Mudah", "givens": 4 },
      { "id": "medium", "label": "Sedang", "givens": 3 },
      { "id": "hard",   "label": "Sulit",  "givens": 2 }
    ],
    "maxHints": 3,
    "showTimer": true,
    "dailyPuzzle": true
  }
}
```

| Kunci | Keterangan |
|---|---|
| `gridSize` | Ukuran grid (saat ini 6; generator & solver ditulis untuk 6×6) |
| `difficulties[]` | Daftar level: `id` (disimpan untuk waktu terbaik), `label`, `givens` = jumlah **angka perantara** di jalur (selain angka 1 dan angka tertinggi). Makin sedikit angka, makin sulit |
| `maxHints` | Jumlah petunjuk per permainan |
| `showTimer` | Tampilkan timer & mulai hitung saat langkah pertama |
| `dailyPuzzle` | Aktifkan tombol & route Game Harian (`/zip?mode=daily`) |

## Mengaktifkan / menonaktifkan game

Satu game dinyalakan atau dimatikan hanya lewat `config.json` — tanpa ubah kode:

1. Di `navigation`, ubah `enabled` item game itu (`true` = tampil sebagai menu aktif
   di sidebar & topbar, `false` = masuk grup "Segera Hadir" di sidebar).
2. Kartu game di beranda mengikuti `navigation` secara otomatis (status
   "Siap dimainkan" / "Segera Hadir" dan tombol "Main Sekarang").
3. Route game harus ada di `src/app/app.routes.ts` bila `enabled: true`
   (mis. `/zip` → `loadComponent` ke `src/app/games/zip/zip.ts`).

> Bila `config.json` tidak punya blok `games.zip` sama sekali (mis. config lama),
> aplikasi memakai nilai fallback dari `src/app/config/config.service.ts`
> (`FALLBACK_CONFIG`) sehingga game Zip tetap jalan.

## Data tersimpan di browser (`localStorage`)

| Kunci | Isi |
|---|---|
| `pg-dark-mode` | `"1"` / `"0"` |
| `pg-tango-best-<difficultyId>` | Waktu terbaik (detik) per level Tango |
| `pg-tango-daily-streak` / `pg-tango-daily-last` | Streak & tanggal terakhir game harian Tango selesai |
| `pg-zip-best-<difficultyId>` | Waktu terbaik (detik) per level Zip |
| `pg-zip-daily-streak` / `pg-zip-daily-last` | Streak & tanggal terakhir game harian Zip selesai |
| `pg-stats-solved` | Total puzzle (Tango + Zip) yang diselesaikan (tampil di beranda) |
| `pg-chat-history` | Riwayat chat dengan bot (maks 20 pesan terakhir) |
| `pg-gemini-key` | API key Gemini milik pengunjung, diisi lewat popup chat (tidak pernah dari repo) |

## `chat` — Chat dengan Bot

Tombol mengambang (FAB) di pojok kanan bawah membuka popup chat. Bot bersifat
hibrida: pertanyaan yang dikenali (aturan Tango/Zip, game harian, skor, tema,
dll.) dijawab langsung oleh bot terprogram (tanpa internet); sisanya diteruskan
ke Gemini — hanya bila API key tersedia.

| Kunci | Tipe | Contoh | Keterangan |
|---|---|---|---|
| `enabled` | boolean | `true` | `false` = sembunyikan FAB & chat sepenuhnya |
| `botName` | string | `"Puzzle Bot"` | Nama bot di header popup |
| `welcomeMessage` | string | `"Halo! 👋 ..."` | Pesan pembuka saat riwayat kosong |
| `geminiModel` | string | `"gemini-3.5-flash-lite"` | Model Gemini (free tier, paling murah) |
| `geminiApiKey` | string | `""` | Key pemilik, hanya bila tidak memakai proxy (lihat Keamanan di bawah) |
| `proxyUrl` | string | `""` | URL Cloudflare Worker proxy, mis. `https://puzzle-bot-proxy.<subdomain>.workers.dev/chat` — kalau diisi, pengunjung tidak perlu memasukkan key (lihat `worker/README.md`) |
| `useGemini` | boolean | `true` | `false` = hanya bot terprogram, tanpa Gemini |
| `maxHistoryMessages` | number | `6` | Jumlah pesan terakhir yang dikirim ke Gemini |
| `quickReplies` | string[] | `["Cara main Tango", ...]` | Chip balasan cepat di atas kolom chat |

Riwayat chat tersimpan di browser pengunjung (`localStorage` `pg-chat-history`,
maks 20 pesan) dan bisa dihapus lewat tombol 🗑️ di popup. Kunci Gemini milik
pengunjung disimpan di `localStorage` `pg-gemini-key` (diatur lewat ikon ⚙️ di
popup chat) dan didahulukan atas `chat.geminiApiKey` dari config.

## Keamanan — API key Gemini

**Key Gemini pemilik situs disimpan sebagai secret di Cloudflare Worker
(`GEMINI_API_KEY`), bukan di repo ini.** Cara yang dipakai sekarang:

1. **Mode proxy (aktif bila `chat.proxyUrl` diisi):** key hanya ada di
   dashboard Cloudflare sebagai secret; situs memanggil Worker, Worker yang
   memanggil Gemini. Key tidak pernah sampai ke browser pengunjung dan tidak
   ada di repo. Deploy Worker mengikuti `worker/README.md`.
2. **Mode langsung (`proxyUrl` kosong):** pengunjung yang mau memakai Gemini
   memasukkan key-nya sendiri lewat ikon ⚙️ di popup chat; key itu hanya
   tersimpan di `localStorage` browsernya.

Catatan: sempat ada percobaan menulis key ke `public/config.json` pada
12 Nov 2026 atas perintah pemilik, tetapi push-nya ditolak GitHub Secret
Scanning — key tidak pernah masuk repo. Jangan ulangi percobaan itu:
sekali key ter-commit ke repo publik, menghapusnya dari file saja tidak
cukup karena riwayat commit tetap menyimpan key lama.

Kalau key disalahgunakan / kuota habis mendadak: hapus key itu di Google
Cloud Console, buat key baru, lalu perbarui secret `GEMINI_API_KEY` di
Worker (`npx wrangler secret put GEMINI_API_KEY`) — tidak perlu mengubah
repo.
