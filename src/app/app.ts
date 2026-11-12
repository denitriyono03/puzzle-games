import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { ConfigService } from './config/config.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule, MatSidenavModule, MatButtonModule, MatIconModule,
    MatListModule, MatCardModule, MatProgressSpinnerModule, MatTooltipModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected config = inject(ConfigService);
  protected theme = inject(ThemeService);
  private router = inject(Router);
  private bp = inject(BreakpointObserver);

  @ViewChild('sidenav') sidenav!: MatSidenav;

  isHandset = signal(false);
  loading = signal(false);
  hasComingSoon = computed(() => this.config.config.navigation.some((i) => !i.enabled));

  constructor() {
    this.bp.observe([Breakpoints.Handset]).subscribe((r) => this.isHandset.set(r.matches));
    // Spinner global selama navigasi — termasuk saat chunk lazy Tango diunduh.
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) this.loading.set(true);
      if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) {
        this.loading.set(false);
      }
    });
  }

  navClicked(): void {
    // Di mobile, tutup drawer setelah memilih menu; spinner tampil sampai navigasi selesai.
    if (this.isHandset() && this.sidenav) this.sidenav.close();
  }
}
