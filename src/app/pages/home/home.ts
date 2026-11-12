import { Component, inject } from '@angular/core';
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
export class Home {
  protected config = inject(ConfigService);

  solved = Number(localStorage.getItem('pg-stats-solved') ?? 0);
  streak = Number(localStorage.getItem('pg-tango-daily-streak') ?? 0);

  games: GameCard[] = [
    {
      id: 'tango', name: 'Tango', icon: 'wb_sunny', emoji: '☀️🌙',
      description: 'Isi grid 6×6 dengan matahari dan bulan. Tiap baris dan kolom harus punya tepat 3 matahari dan 3 bulan, tanpa tiga simbol sama berurutan, dan patuhi tanda = dan ×.',
      route: '/tango', enabled: true, chips: ['Mudah', 'Sedang', 'Sulit', 'Harian'],
    },
    {
      id: 'queens', name: 'Queens', icon: 'grid_on', emoji: '👑',
      description: 'Tempatkan satu ratu di tiap baris, kolom, dan wilayah warna — tanpa ada ratu yang saling menyerang. Segera hadir di Puzzle Games.',
      route: '/queens', enabled: false, chips: ['Segera Hadir'],
    },
    {
      id: 'zip', name: 'Zip', icon: 'route', emoji: '🔢',
      description: 'Hubungkan semua angka secara berurutan dalam satu jalur yang mengisi seluruh papan. Segera hadir di Puzzle Games.',
      route: '/zip', enabled: false, chips: ['Segera Hadir'],
    },
  ];

  get enabledCount(): number {
    return this.games.filter((g) => g.enabled).length;
  }
}
