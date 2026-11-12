import { Injectable, inject, signal } from '@angular/core';
import { ConfigService } from '../config/config.service';

export interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  time: number;
}

/** localStorage: riwayat chat (maks 20 pesan terakhir). */
const HISTORY_KEY = 'pg-chat-history';
/** localStorage: API key Gemini milik pengunjung (disimpan di browser saja). */
const GEMINI_KEY = 'pg-gemini-key';
const HISTORY_LIMIT = 20;
const GEMINI_TIMEOUT_MS = 20_000;

/** Jawaban terprogram — selalu dijawab lokal, tanpa memanggil Gemini. */
interface Intent {
  test: (n: string) => boolean;
  answer: () => string;
}

function fmtTime(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private config = inject(ConfigService);

  messages = signal<ChatMessage[]>([]);
  typing = signal(false);

  constructor() {
    this.loadHistory();
    if (this.messages().length === 0) {
      this.pushBot(this.config.config.chat.welcomeMessage);
    }
  }

  // ---------- riwayat ----------

  private loadHistory(): void {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ChatMessage[];
      if (Array.isArray(parsed)) this.messages.set(parsed.slice(-HISTORY_LIMIT));
    } catch {
      // Riwayat rusak — mulai dari kosong.
    }
  }

  private saveHistory(): void {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.messages().slice(-HISTORY_LIMIT)));
    } catch {
      // Penyimpanan penuh / tidak tersedia — chat tetap jalan di memori.
    }
  }

  clearHistory(): void {
    this.messages.set([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // Abaikan.
    }
    this.pushBot(this.config.config.chat.welcomeMessage);
  }

  // ---------- kunci Gemini ----------

  /** Kunci dari localStorage didahulukan, lalu dari config.json. */
  resolveGeminiKey(): string {
    try {
      const stored = (localStorage.getItem(GEMINI_KEY) ?? '').trim();
      if (stored) return stored;
    } catch {
      // Abaikan.
    }
    return (this.config.config.chat.geminiApiKey ?? '').trim();
  }

  hasStoredKey(): boolean {
    try {
      return Boolean((localStorage.getItem(GEMINI_KEY) ?? '').trim());
    } catch {
      return false;
    }
  }

  saveGeminiKey(key: string): void {
    try {
      const v = key.trim();
      if (v) localStorage.setItem(GEMINI_KEY, v);
      else localStorage.removeItem(GEMINI_KEY);
    } catch {
      // Abaikan.
    }
  }

  // ---------- pengiriman ----------

  async send(rawText: string): Promise<void> {
    const text = rawText.trim();
    if (!text || this.typing()) return;
    this.messages.update((m) => [...m, { role: 'user', text, time: Date.now() }]);
    this.saveHistory();
    this.typing.set(true);

    const programmed = this.matchProgrammed(text);
    if (programmed !== null) {
      await this.delay(450 + Math.min(programmed.length * 4, 900));
      this.typing.set(false);
      this.pushBot(programmed);
      return;
    }

    if (!this.config.config.chat.useGemini) {
      await this.delay(400);
      this.typing.set(false);
      this.pushBot(
        'Maaf, untuk pertanyaan itu aku belum bisa jawab. Coba tanya seputar Puzzle Games ya — misalnya "cara main Tango", "cara main Zip", "game harian", atau "skor".',
      );
      return;
    }

    const key = this.resolveGeminiKey();
    if (!key) {
      await this.delay(400);
      this.typing.set(false);
      this.pushBot(
        'Untuk pertanyaan itu aku butuh Gemini, tapi API key Gemini belum diatur di browser ini. ' +
          'Aku masih bisa jawab pertanyaan seputar situs ini — coba "cara main Tango", "cara main Zip", "game harian", atau "skor". ' +
          'Kalau mau mengaktifkan Gemini, buka ikon ⚙️ di atas dan masukkan API key kamu (disimpan di browser kamu saja).',
      );
      return;
    }

    try {
      const reply = await this.askGemini(text);
      this.typing.set(false);
      this.pushBot(reply);
    } catch (err) {
      this.typing.set(false);
      this.pushBot(this.geminiErrorMessage(err));
    }
  }

  private pushBot(text: string): void {
    this.messages.update((m) => [...m, { role: 'bot', text, time: Date.now() }]);
    this.saveHistory();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
  }

  // ---------- bot terprogram ----------

  private norm(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private intents(): Intent[] {
    const cfg = this.config.config;
    const games = cfg.navigation.filter((n) => n.enabled && n.id !== 'home');
    const coming = cfg.navigation.filter((n) => !n.enabled);
    const gameNames = games.map((g) => g.label).join(', ');
    const comingNames = coming.map((g) => g.label).join(', ');
    const dailyLinks =
      'Tango Harian: [Main Tango Harian](route:/tango?mode=daily) · Zip Harian: [Main Zip Harian](route:/zip?mode=daily)';

    return [
      {
        test: (n) =>
          /^(halo|hai|hi|hello|hei|pagi|siang|sore|malam)\b/.test(n) ||
          n.includes('halo') || n.includes('selamat pagi') || n.includes('selamat siang') ||
          n.includes('selamat sore') || n.includes('selamat malam') || n.includes('assalamu'),
        answer: () =>
          `Halo juga! 👋 Aku ${cfg.chat.botName}. Aku bisa bantu seputar Puzzle Games — cara main Tango & Zip, game harian, skor dan waktu terbaik, atau pengaturan tema. Silakan tanya!`,
      },
      {
        test: (n) =>
          n.includes('tango') && (n.includes('cara') || n.includes('main') || n.includes('aturan') || n.includes('rule') || n.includes('gimana') || n.includes('bagaimana') || n.includes('panduan')),
        answer: () =>
          'Cara main Tango ☀️🌙:\n' +
          '• Grid 6×6. Klik sel untuk mengganti: kosong → ☀️ → 🌙 → kosong.\n' +
          '• Tiap baris dan kolom harus berisi tepat 3 matahari dan 3 bulan.\n' +
          '• Tidak boleh ada 3 simbol yang sama berurutan di baris atau kolom.\n' +
          '• Tanda = berarti kedua sel bersebelahan harus sama; tanda × berarti harus berbeda.\n' +
          '• Sel abu-abu dengan simbol adalah petunjuk awal dan tidak bisa diubah.\n' +
          'Ada tombol Petunjuk (maks 3), Urungkan, dan Periksa di atas papan. Selamat bermain!',
      },
      {
        test: (n) =>
          n.includes('zip') && (n.includes('cara') || n.includes('main') || n.includes('aturan') || n.includes('rule') || n.includes('gimana') || n.includes('bagaimana') || n.includes('panduan')),
        answer: () =>
          'Cara main Zip 🔢:\n' +
          '• Grid 6×6. Tarik satu jalur dari angka 1 sampai 36 secara berurutan.\n' +
          '• Jalur hanya bergerak ke atas, bawah, kiri, atau kanan — tidak boleh kembali ke sel yang sudah dilewati.\n' +
          '• Lewati semua angka secara berurutan (1 → 2 → 3 …); angka hanya bisa dimasuki tepat pada gilirannya.\n' +
          '• Isi seluruh papan (36 sel) dan akhiri di angka tertinggi untuk menang.\n' +
          '• Bisa diseret dari sel 1, atau ketuk sel sebelah untuk melangkah; ketuk ujung jalur untuk mengurungkan satu langkah.',
      },
      {
        test: (n) => n.includes('harian') || n.includes('daily'),
        answer: () =>
          'Game Harian 🎯: satu teka-teki baru setiap hari, sama untuk semua pemain. Selesaikan dan jaga streak harianmu!\n' + dailyLinks,
      },
      {
        test: (n) =>
          n.includes('skor') || n.includes('waktu terbaik') || n.includes('best') || n.includes('rekor') ||
          n.includes('streak') || n.includes('statistik') || n.includes('sudah berapa') || n.includes('berapa puzzle'),
        answer: () => this.scoresAnswer(),
      },
      {
        test: (n) =>
          n.includes('queens'),
        answer: () =>
          'Queens 👑 masih "Segera Hadir" — belum bisa dimainkan. Di Queens nanti kamu menempatkan satu ratu di tiap baris, kolom, dan wilayah warna tanpa ada ratu yang saling menyerang. Sementara itu, Tango dan Zip sudah bisa dimainkan!',
      },
      {
        test: (n) =>
          n.includes('game apa') || n.includes('ada game apa') || n.includes('daftar game') || n.includes('game apa saja') ||
          n.includes('game apa aja') || n === 'game' || n.includes('pilihan game'),
        answer: () =>
          `Game yang bisa dimainkan sekarang: ${gameNames}.` +
          (comingNames ? ` Segera hadir: ${comingNames}.` : '') +
          ' Tango itu teka-teki matahari & bulan, Zip itu teka-teki jalur angka 1–36.',
      },
      {
        test: (n) => n.includes('gelap') || n.includes('terang') || n.includes('dark') || n.includes('mode malam') || n.includes('mode terang'),
        answer: () =>
          'Mode gelap/terang bisa diubah dengan tombol ☀️/🌙 di pojok kanan atas (topbar). Pilihanmu tersimpan di browser, jadi lain kali dibuka tetap sama.',
      },
      {
        test: (n) =>
          n.includes('ganti warna') || n.includes('ubah warna') || n.includes('ganti tema') ||
          n.includes('ubah tema') || n.includes('warna situs') || n.includes('config') ||
          n.includes('ubah tampilan') || n.includes('ganti tampilan'),
        answer: () =>
          'Tampilan situs ini diatur dari satu file config.json — warna primary/secondary/accent, gambar latar, font, sampai pengaturan game. Pemilik situs bisa mengubahnya tanpa rebuild. Kalau kamu pengunjung, kamu bisa ganti mode gelap/terang lewat tombol di topbar.',
      },
      {
        test: (n) =>
          n.includes('petunjuk') || n.includes('hint') || n.includes('urungkan') || n.includes('undo') || n.includes('periksa'),
        answer: () =>
          'Di setiap game ada tombol bantuan di atas papan:\n' +
          '• Petunjuk (💡, maks 3 per game) — mengisi satu sel yang benar.\n' +
          '• Urungkan — membatalkan satu langkah terakhir.\n' +
          '• Ulangi — mulai ulang puzzle yang sama dari awal.\n' +
          '• Periksa — memeriksa jalur/isian sejauh ini dan menunjukkan kalau ada yang salah.',
      },
      {
        test: (n) =>
          n.includes('tentang') || n.includes('situs ini') || n.includes('aplikasi ini') || n.includes('website ini') || n.includes('siapa yang buat'),
        answer: () =>
          `${cfg.site.name} — ${cfg.site.tagline} ${cfg.site.description} Semua game berjalan lokal di browsermu, gratis dan tanpa iklan.`,
      },
      {
        test: (n) =>
          n.includes('bantu') || n.includes('help') || n.includes('bisa apa') || n.includes('bisa jawab apa') || n.includes('perintah'),
        answer: () =>
          'Aku bisa bantu seputar situs ini, misalnya:\n' +
          '• "Cara main Tango" / "Cara main Zip"\n' +
          '• "Game harian"\n' +
          '• "Game apa saja?"\n' +
          '• "Skor & waktu terbaik"\n' +
          '• "Mode gelap"\n' +
          'Kalau pertanyaannya di luar itu, aku akan coba jawab lewat Gemini (kalau API key sudah diatur).',
      },
      {
        test: (n) => n.includes('terima kasih') || n.includes('makasih') || n.includes('thanks') || n.includes('thank you'),
        answer: () => 'Sama-sama! 😊 Senang bisa membantu. Selamat bermain!',
      },
      {
        test: (n) => n.includes('dadah') || n.includes('bye') || n.includes('sampai jumpa') || n.includes('selamat tinggal'),
        answer: () => 'Sampai jumpa! 👋 Semoga streak harianmu tetap terjaga.',
      },
    ];
  }

  private matchProgrammed(text: string): string | null {
    const n = this.norm(text);
    for (const intent of this.intents()) {
      try {
        if (intent.test(n)) return intent.answer();
      } catch {
        // Lanjut ke intent berikutnya.
      }
    }
    return null;
  }

  private scoresAnswer(): string {
    const read = (key: string): number | null => {
      try {
        const v = localStorage.getItem(key);
        return v === null ? null : Number(v);
      } catch {
        return null;
      }
    };
    const solved = read('pg-stats-solved') ?? 0;
    const tangoStreak = read('pg-tango-daily-streak') ?? 0;
    const zipStreak = read('pg-zip-daily-streak') ?? 0;
    const diffs = this.config.config.games.tango.difficulties;
    const label = (id: string) => diffs.find((d) => d.id === id)?.label ?? id;

    const lines: string[] = [`Puzzle selesai (total): ${solved}`];
    lines.push(`Streak harian — Tango: ${tangoStreak} hari · Zip: ${zipStreak} hari`);
    const tangoBest = ['easy', 'medium', 'hard']
      .map((id) => `${label(id)}: ${fmtTime(read(`pg-tango-best-${id}`))}`)
      .join(' · ');
    lines.push(`Waktu terbaik Tango — ${tangoBest}`);
    const zipBest = ['easy', 'medium', 'hard']
      .map((id) => `${label(id)}: ${fmtTime(read(`pg-zip-best-${id}`))}`)
      .join(' · ');
    lines.push(`Waktu terbaik Zip — ${zipBest}`);
    if (solved === 0) {
      lines.push('Kamu belum menyelesaikan puzzle di browser ini — ayo main satu!');
    }
    return 'Skor kamu 📊:\n' + lines.map((l) => '• ' + l).join('\n');
  }

  // ---------- Gemini ----------

  private siteContext(): string {
    const cfg = this.config.config;
    const games = cfg.navigation
      .filter((n) => n.id !== 'home')
      .map((n) => `- ${n.label}: ${n.enabled ? 'bisa dimainkan di ' + n.route : 'segera hadir'}`)
      .join('\n');
    return [
      `Situs: ${cfg.site.name} — ${cfg.site.tagline}`,
      `Deskripsi: ${cfg.site.description}`,
      'Game:',
      games,
      'Aturan Tango: grid 6x6, klik sel kosong -> matahari -> bulan; tiap baris dan kolom tepat 3 matahari dan 3 bulan; tidak boleh 3 simbol sama berurutan; tanda = berarti sel bersebelahan sama, tanda x berarti berbeda; sel abu-abu adalah petunjuk awal yang terkunci.',
      'Aturan Zip: grid 6x6, tarik satu jalur dari angka 1 sampai 36 berurutan; jalur hanya bergerak ortogonal (atas/bawah/kiri/kanan), tidak boleh kembali ke sel yang sudah dilewati; isi seluruh papan dan akhiri di angka tertinggi.',
      'Fitur: game harian (satu teka-teki baru tiap hari, sama untuk semua pemain, di /tango?mode=daily dan /zip?mode=daily), Petunjuk maks 3 per game, Urungkan, Ulangi, Periksa, timer, waktu terbaik per level kesulitan (Mudah/Sedang/Sulit) dan streak harian tersimpan di localStorage browser.',
      'Pengaturan: mode gelap/terang via tombol di topbar; tampilan diatur dari satu file config.json.',
    ].join('\n');
  }

  private async askGemini(text: string): Promise<string> {
    const cfg = this.config.config.chat;
    const key = this.resolveGeminiKey();
    const model = cfg.geminiModel || 'gemini-3.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

    const history = this.messages()
      .slice(0, -1) // pesan terakhir adalah pertanyaan saat ini — ditambahkan di bawah
      .slice(-cfg.maxHistoryMessages)
      .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  'Kamu adalah Puzzle Bot, asisten chat di situs Puzzle Games. ' +
                  'Jawab HANYA pertanyaan seputar situs Puzzle Games (game Tango, Zip, Queens, aturan main, game harian, skor/waktu terbaik, fitur, pengaturan tema). ' +
                  'Jika pertanyaan di luar topik situs ini, tolak dengan sopan dalam Bahasa Indonesia dan arahkan kembali ke topik situs (misalnya: "Maaf, aku hanya bisa membantu seputar Puzzle Games. Coba tanya cara main Tango atau Zip, ya!"). ' +
                  'Jawab singkat, ramah, dan dalam Bahasa Indonesia.\n\nKonteks situs:\n' +
                  this.siteContext(),
              },
            ],
          },
          contents: [...history, { role: 'user', parts: [{ text }] }],
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const err = new Error(`Gemini HTTP ${res.status}`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const reply = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!reply) throw new Error('Gemini empty reply');
    return reply;
  }

  private geminiErrorMessage(err: unknown): string {
    const status = (err as { status?: number })?.status;
    const name = (err as { name?: string })?.name;
    if (name === 'AbortError' || name === 'TimeoutError') {
      return 'Waduh, Gemini terlalu lama merespons (timeout). Coba tanyakan lagi, atau pakai pertanyaan cepat di atas — misalnya "cara main Tango" atau "game harian".';
    }
    if (status === 401 || status === 403) {
      return 'API key Gemini ditolak (401/403). Periksa lagi key-nya lewat ikon ⚙️ di atas — pastikan key benar dan masih aktif.';
    }
    if (status === 429) {
      return 'Gemini sedang sibuk / batas kuota gratis tercapai (429). Coba lagi sebentar lagi, atau tanya seputar situs ini — misalnya "cara main Zip" atau "skor".';
    }
    return 'Maaf, Gemini sedang tidak bisa dihubungi. Aku masih bisa jawab pertanyaan seputar situs ini — coba "cara main Tango", "cara main Zip", "game harian", atau "skor".';
  }
}
