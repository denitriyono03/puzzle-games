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
  games: { tango: TangoConfig };
}
