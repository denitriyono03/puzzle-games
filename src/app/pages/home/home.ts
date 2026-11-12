import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { ConfigService } from '../../config/config.service';

interface GameCard {
  id: string;
  name: string;
  icon: string;
  emoji: string;
  description: string;
  route: string;
  enabled: boolean;
  chips: string[];
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule, MatChipsModule, MatIconModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  protected config = inject(ConfigService);

  solved = Number(localStorage.getItem('pg-stats-solved') ?? 0);
  streak = Number(localStorage.getItem('pg-tango-daily-streak') ?? 0);

  ngOnInit(): void {
    // Status kartu mengikuti config.json → navigation (enabled),
    // jadi mematikan game cukup dengan mengubah satu file config.
    for (const g of this.games) {
      const nav = this.config.config.navigation.find((n) => n.id === g.id);
      if (nav) g.enabled = nav.enabled;
    }
  }

  games: GameCard[] = [
    {
      id: 'tango', name: 'Tango', icon: 'wb_sunny', emoji: '☀️🌙',
      description: 'Isi grid 6×6 dengan matahari dan bulan. Tiap baris dan kolom harus punya tepat 3 matahari dan 3 bulan, tanpa tiga simbol sama berurutan, dan patuhi tanda = dan ×.',
      route: '/tango', enabled: true, chips: ['Mudah', 'Sedang', 'Sulit', 'Harian'],
    },
    {
      id: 'queens', name: 'Queens', icon: 'grid_on', emoji: '👑',
      description: 'Tempatkan satu ratu di tiap baris, kolom, dan wilayah warna — tanpa ada ratu yang saling menyerang, termasuk secara diagonal.',
      route: '/queens', enabled: true, chips: ['Mudah', 'Sedang', 'Sulit', 'Harian'],
    },
    {
      id: 'zip', name: 'Zip', icon: 'route', emoji: '🔢',
      description: 'Tarik satu jalur dari angka 1 sampai 36, lewati semua angka berurutan, dan isi seluruh papan 6×6 tanpa ada sel yang terlewat.',
      route: '/zip', enabled: true, chips: ['Mudah', 'Sedang', 'Sulit', 'Harian'],
    },
    {
      id: 'thread', name: 'Common Thread', icon: 'link', emoji: '🧵',
      description: 'Tebak kata yang menghubungkan empat petunjuk — temukan benang merahnya! Petunjuk dan jawaban dalam Bahasa Inggris.',
      route: '/thread', enabled: true, chips: ['Mudah', 'Sedang', 'Sulit', 'Harian'],
    },
  ];

  get enabledCount(): number {
    return this.games.filter((g) => g.enabled).length;
  }
}
