import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfig, ThemeColors } from './config.model';

/** Warna fallback bila config.json belum / gagal dimuat. */
export const FALLBACK_CONFIG: AppConfig = {
  site: {
    name: 'Puzzle Games',
    tagline: 'Asah otakmu, satu teka-teki setiap kali.',
    description: 'Hub game teka-teki logika.',
    logo: '🧩',
    footer: 'Puzzle Games',
    github: 'https://github.com/denitriyono03/puzzle-games',
    version: '1.0.0',
  },
  theme: {
    primary: '#7c5cff', secondary: '#22d3ee', accent: '#fbbf24',
    background: '#f3f4fa', surface: '#ffffff', card: '#ffffff',
    text: '#1d1b2e', muted: '#6b7280', border: '#e4e6f0',
    success: '#16a34a', warning: '#d97706', error: '#dc2626',
    darkTheme: {
      primary: '#8b5cf6', secondary: '#22d3ee', accent: '#fbbf24',
      background: '#0b0b16', surface: '#151524', card: '#1b1b2e',
      text: '#f3f4f6', muted: '#9ca3af', border: '#2e2e47',
      success: '#22c55e', warning: '#f59e0b', error: '#ef4444',
    },
    borderRadius: '16px',
    fontFamily: { heading: "'Plus Jakarta Sans', system-ui, sans-serif", body: "'Inter', system-ui, sans-serif" },
    backgroundImage: 'images/bg.jpg',
    backgroundOverlayOpacity: 0.82,
    backgroundBlur: 6,
  },
  layout: { sidebarWidth: 264, topbarHeight: 64, contentMaxWidth: 1180 },
  features: { darkModeDefault: true, animations: true, soundEffects: false },
  navigation: [
    { id: 'home', label: 'Beranda', icon: 'home', route: '/', enabled: true, badge: '' },
    { id: 'tango', label: 'Tango', icon: 'wb_sunny', route: '/tango', enabled: true, badge: '' },
    { id: 'queens', label: 'Queens', icon: 'grid_on', route: '/queens', enabled: false, badge: 'Segera' },
    { id: 'zip', label: 'Zip', icon: 'route', route: '/zip', enabled: false, badge: 'Segera' },
  ],
  games: {
    tango: {
      gridSize: 6,
      difficulties: [
        { id: 'easy', label: 'Mudah', givens: 14 },
        { id: 'medium', label: 'Sedang', givens: 10 },
        { id: 'hard', label: 'Sulit', givens: 7 },
      ],
      maxHints: 3, showTimer: true, dailyPuzzle: true,
    },
    zip: {
      gridSize: 6,
      difficulties: [
        { id: 'easy', label: 'Mudah', givens: 4 },
        { id: 'medium', label: 'Sedang', givens: 3 },
        { id: 'hard', label: 'Sulit', givens: 2 },
      ],
      maxHints: 3, showTimer: true, dailyPuzzle: true,
    },
  },
  chat: {
    enabled: true,
    botName: 'Puzzle Bot',
    welcomeMessage:
      'Halo! 👋 Aku Puzzle Bot. Tanya apa saja seputar Puzzle Games — cara main Tango & Zip, game harian, skor, atau pengaturan tema.',
    geminiModel: 'gemini-3.5-flash-lite',
    geminiApiKey: '',
    useGemini: true,
    maxHistoryMessages: 6,
    quickReplies: [
      'Cara main Tango',
      'Cara main Zip',
      'Game harian',
      'Game apa saja?',
      'Skor & waktu terbaik',
      'Mode gelap',
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private http = inject(HttpClient);
  config: AppConfig = FALLBACK_CONFIG;
  loaded = false;

  async load(): Promise<void> {
    try {
      const cfg = await firstValueFrom(this.http.get<AppConfig>('config.json'));
      if (cfg?.site && cfg?.theme) {
        // Gabung dalam (khususnya `games` dan `chat`) agar config.json lama
        // yang belum punya games.zip / chat tidak merusak game & bot.
        this.config = {
          ...FALLBACK_CONFIG,
          ...cfg,
          games: { ...FALLBACK_CONFIG.games, ...cfg.games },
          chat: { ...FALLBACK_CONFIG.chat, ...(cfg.chat ?? {}) },
        };
      }
      this.loaded = true;
    } catch {
      // Tetap jalan dengan FALLBACK_CONFIG bila config.json gagal dimuat.
      this.loaded = true;
    }
  }

  /** Terapkan warna tema (terang/gelap) + layout sebagai CSS variables di :root. */
  applyTheme(dark: boolean): void {
    const t = this.config.theme;
    const c: ThemeColors = dark ? t.darkTheme : t;
    const root = document.documentElement;
    const set = (k: string, v: string) => root.style.setProperty(k, v);
    set('--pg-primary', c.primary);
    set('--pg-secondary', c.secondary);
    set('--pg-accent', c.accent);
    set('--pg-background', c.background);
    set('--pg-surface', c.surface);
    set('--pg-card', c.card);
    set('--pg-text', c.text);
    set('--pg-muted', c.muted);
    set('--pg-border', c.border);
    set('--pg-success', c.success);
    set('--pg-warning', c.warning);
    set('--pg-error', c.error);
    set('--pg-radius', t.borderRadius);
    set('--pg-font-heading', t.fontFamily.heading);
    set('--pg-font-body', t.fontFamily.body);
    set('--pg-bg-image', `url("${t.backgroundImage}")`);
    set('--pg-overlay-opacity', String(t.backgroundOverlayOpacity));
    set('--pg-blur', `${t.backgroundBlur}px`);
    set('--pg-sidebar-width', `${this.config.layout.sidebarWidth}px`);
    set('--pg-topbar-height', `${this.config.layout.topbarHeight}px`);
    set('--pg-content-max-width', `${this.config.layout.contentMaxWidth}px`);
  }
}
