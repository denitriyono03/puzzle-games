export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

export interface ThemeConfig extends ThemeColors {
  darkTheme: ThemeColors;
  borderRadius: string;
  fontFamily: { heading: string; body: string };
  backgroundImage: string;
  backgroundOverlayOpacity: number;
  backgroundBlur: number;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  enabled: boolean;
  badge: string;
}

export interface Difficulty {
  id: string;
  label: string;
  givens: number;
}

export interface TangoConfig {
  gridSize: number;
  difficulties: Difficulty[];
  maxHints: number;
  showTimer: boolean;
  dailyPuzzle: boolean;
}

/**
 * Konfigurasi Zip. `givens` tiap level = jumlah angka perantara di jalur
 * (selain angka 1 dan angka tertinggi). Makin sedikit angka, makin sulit.
 */
export interface ZipConfig {
  gridSize: number;
  difficulties: Difficulty[];
  maxHints: number;
  showTimer: boolean;
  dailyPuzzle: boolean;
}

export interface QueensDifficulty {
  id: string;
  label: string;
  /** Ukuran papan (6, 7, atau 8) — jumlah ratu yang harus dipasang. */
  size: number;
}

/**
 * Konfigurasi Queens. `size` tiap level = ukuran papan; makin besar
 * papan (dan makin banyak wilayah), makin sulit.
 */
export interface QueensConfig {
  difficulties: QueensDifficulty[];
  maxHints: number;
  showTimer: boolean;
  dailyPuzzle: boolean;
}

export interface ThreadDifficulty {
  id: string;
  label: string;
}

/**
 * Konfigurasi Common Thread. Tiap level punya 5 puzzle kurasi (lihat
 * `src/app/games/thread/thread-data.ts`); `difficulties` hanya memilih
 * label & pool puzzle.
 */
export interface ThreadConfig {
  difficulties: ThreadDifficulty[];
  maxHints: number;
  showTimer: boolean;
  dailyPuzzle: boolean;
}

export interface ChatConfig {
  enabled: boolean;
  botName: string;
  welcomeMessage: string;
  geminiModel: string;
  /** Kosongkan di repo publik — key diisi pengunjung lewat popup chat (localStorage). */
  geminiApiKey: string;
  /** URL Cloudflare Worker proxy (opsional). Kalau diisi, chat memakai proxy dan key tidak diperlukan di browser. */
  proxyUrl: string;
  useGemini: boolean;
  maxHistoryMessages: number;
  quickReplies: string[];
}

export interface AppConfig {
  site: {
    name: string;
    tagline: string;
    description: string;
    logo: string;
    footer: string;
    github: string;
    version: string;
  };
  theme: ThemeConfig;
  layout: { sidebarWidth: number; topbarHeight: number; contentMaxWidth: number };
  features: { darkModeDefault: boolean; animations: boolean; soundEffects: boolean };
  navigation: NavItem[];
  games: { tango: TangoConfig; zip: ZipConfig; queens: QueensConfig; thread: ThreadConfig };
  chat: ChatConfig;
}
