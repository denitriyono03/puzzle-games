// Puzzle Bot proxy — Cloudflare Worker (serverless).
//
// Tugasnya cuma satu: menerima pertanyaan dari situs Puzzle Games,
// meneruskannya ke Gemini dengan API key, lalu mengembalikan jawaban.
// API key TIDAK ADA di file ini dan TIDAK ADA di repo — key disimpan
// sebagai secret di dashboard Cloudflare:
//   Workers & Pages -> puzzle-bot-proxy -> Settings -> Variables
//   -> Add variable -> GEMINI_API_KEY (pilih "Encrypt" / secret).
//
// Pengaman yang diterapkan di sini:
// - CORS: hanya situs https://denitriyono03.github.io yang boleh memanggil
//   worker ini dari browser.
// - Validasi: pesan maks 1000 karakter, riwayat maks 6 pesan.
// - Rate limit sederhana per IP: maks 20 request per menit (best-effort,
//   dihitung di memori tiap isolate Worker).
// - System instruction dipasang di sisi server, jadi pemanggil tidak bisa
//   mengubah peran bot lewat request.

const MODEL = 'gemini-3.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const ALLOWED_ORIGIN = 'https://denitriyono03.github.io';
const MAX_MESSAGE_CHARS = 1000;
const MAX_HISTORY = 6;
const MAX_CONTEXT_CHARS = 4000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

// Best-effort per-IP rate limit (in-memory; hilang saat isolate didaur ulang).
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 10000) hits.clear();
  return arr.length > RATE_LIMIT_MAX;
}

const SYSTEM_PROMPT =
  'Kamu adalah Puzzle Bot, asisten chat untuk situs Puzzle Games ' +
  '(denitriyono03.github.io/puzzle-games). Jawab HANYA pertanyaan seputar situs ini: ' +
  'game Tango dan Zip, game harian, skor dan waktu terbaik, cara main, fitur situs, ' +
  'dan pengaturan tema. Jika pertanyaan di luar topik itu, tolak dengan sopan dalam ' +
  'Bahasa Indonesia dan arahkan kembali ke topik situs. ' +
  'Jawab dalam Bahasa Indonesia kecuali pengguna meminta bahasa lain. ' +
  'Jawab singkat dan jelas.';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(ALLOWED_ORIGIN) });
    }

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse({ ok: true }, 200, allowedOrigin);
    }

    if (request.method !== 'POST' || url.pathname !== '/chat') {
      return jsonResponse({ error: 'Not found' }, 404, allowedOrigin);
    }

    // Hanya situs live yang boleh memanggil dari browser.
    if (origin && origin !== ALLOWED_ORIGIN) {
      return jsonResponse({ error: 'Origin tidak diizinkan.' }, 403, allowedOrigin);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (rateLimited(ip)) {
      return jsonResponse(
        { error: 'Terlalu banyak pertanyaan. Coba lagi sebentar lagi ya.' },
        429,
        allowedOrigin,
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Body harus JSON.' }, 400, allowedOrigin);
    }

    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message || message.length > MAX_MESSAGE_CHARS) {
      return jsonResponse(
        { error: 'Pesan kosong atau terlalu panjang (maks 1000 karakter).' },
        400,
        allowedOrigin,
      );
    }
    const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];
    const context =
      typeof body?.context === 'string' ? body.context.slice(0, MAX_CONTEXT_CHARS) : '';

    const contents = [];
    for (const h of history) {
      if (h && typeof h.text === 'string' && (h.role === 'user' || h.role === 'model')) {
        contents.push({ role: h.role, parts: [{ text: h.text.slice(0, MAX_MESSAGE_CHARS) }] });
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const systemText = context
      ? `${SYSTEM_PROMPT}\n\nKonteks situs saat ini:\n${context}`
      : SYSTEM_PROMPT;

    if (!env.GEMINI_API_KEY) {
      return jsonResponse(
        { error: 'Server belum dikonfigurasi (GEMINI_API_KEY belum diset).' },
        500,
        allowedOrigin,
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let geminiRes;
    try {
      geminiRes = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemText }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
        }),
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timeout);
      return jsonResponse(
        { error: 'Tidak bisa menghubungi Gemini. Coba lagi sebentar lagi.' },
        502,
        allowedOrigin,
      );
    }
    clearTimeout(timeout);

    if (!geminiRes.ok) {
      return jsonResponse(
        { error: 'Gemini sedang bermasalah. Coba lagi sebentar lagi.' },
        502,
        allowedOrigin,
      );
    }

    let data;
    try {
      data = await geminiRes.json();
    } catch {
      return jsonResponse({ error: 'Jawaban Gemini tidak bisa dibaca.' }, 502, allowedOrigin);
    }
    const reply = data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || '')
      .join('')
      .trim();
    if (!reply) {
      return jsonResponse({ error: 'Gemini tidak memberikan jawaban.' }, 502, allowedOrigin);
    }
    return jsonResponse({ reply }, 200, allowedOrigin);
  },
};
