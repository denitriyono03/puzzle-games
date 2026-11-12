# Puzzle Bot Proxy (Cloudflare Worker)

Perantara antara chat bot Puzzle Games dan Gemini, supaya API key tidak
perlu disimpan di repo publik atau dimasukkan manual oleh pengunjung.

## Cara kerja

```
Pengunjung -> https://puzzle-bot-proxy.<subdomain>.workers.dev/chat
           -> Worker menambahkan GEMINI_API_KEY (secret, di server saja)
           -> Gemini (gemini-3.5-flash-lite)
           -> jawaban kembali ke situs
```

Key tidak pernah sampai ke browser pengunjung dan tidak ada di repo ini.

## Deploy (sekali saja)

1. Buat akun gratis di https://dash.cloudflare.com/sign-up
2. Install wrangler: `npm install -g wrangler`
3. Login: `npx wrangler login`
4. Dari folder ini: `npx wrangler deploy`
5. Set secret key-nya (jangan tulis key di file mana pun):
   `npx wrangler secret put GEMINI_API_KEY`
   lalu tempel key Gemini saat diminta.
   (Alternatif tanpa CLI: dashboard Cloudflare -> Workers & Pages ->
   puzzle-bot-proxy -> Settings -> Variables -> Add variable
   `GEMINI_API_KEY`, pilih "Encrypt".)
6. Catat URL worker-nya, misalnya
   `https://puzzle-bot-proxy.<subdomain>.workers.dev/chat`

## Mengaktifkan di situs

Isi `chat.proxyUrl` di `public/config.json` dengan URL `/chat` di atas
(contoh: `"proxyUrl": "https://puzzle-bot-proxy.<subdomain>.workers.dev/chat"`),
lalu push seperti biasa. Selama `proxyUrl` kosong, situs memakai mode
langsung (butuh key dari pengunjung lewat ikon ⚙️ di popup chat).

## Uji cepat

```bash
# Health check
curl https://puzzle-bot-proxy.<subdomain>.workers.dev/health

# Satu pertanyaan (ganti Origin sesuai situs live)
curl https://puzzle-bot-proxy.<subdomain>.workers.dev/chat \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://denitriyono03.github.io' \
  -d '{"message": "Bagaimana cara main Tango?", "history": [], "context": ""}'
```

## Pengaman di Worker

- CORS: hanya `https://denitriyono03.github.io` yang boleh memanggil
  dari browser.
- Pesan maks 1000 karakter, riwayat maks 6 pesan.
- Rate limit: maks 20 request per menit per IP (best-effort, in-memory).
- System instruction dipasang di sisi server, jadi peran bot tidak bisa
  diubah dari request.
- Model: `gemini-3.5-flash-lite` (free tier).
