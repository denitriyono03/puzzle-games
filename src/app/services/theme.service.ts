import { Injectable, inject, signal } from '@angular/core';
import { ConfigService } from '../config/config.service';

const KEY = 'pg-dark-mode';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private config = inject(ConfigService);
  dark = signal(false);

  init(): void {
    const stored = localStorage.getItem(KEY);
    const dark = stored !== null
      ? stored === '1'
      : this.config.config.features.darkModeDefault;
    this.setDark(dark);
  }

  toggle(): void {
    this.setDark(!this.dark());
  }

  setDark(dark: boolean): void {
    this.dark.set(dark);
    localStorage.setItem(KEY, dark ? '1' : '0');
    document.body.classList.toggle('dark', dark);
    this.config.applyTheme(dark);
  }
}
