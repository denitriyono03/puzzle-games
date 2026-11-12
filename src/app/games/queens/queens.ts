import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfigService } from '../../config/config.service';
import { generateDailyQueensPuzzle, generateQueensPuzzle, QueensPuzzle } from './queens-generator';
import { queensHint, queensSubsetOfSolution, validateQueens } from './queens-solver';

export interface QueensWinData {
  seconds: number;
  moves: number;
  difficultyLabel: string;
  isDaily: boolean;
  streak: number;
  isBest: boolean;
}

@Component({
  selector: 'app-queens-win-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="win-dialog">
      <div class="confetti" aria-hidden="true">
        @for (p of pieces; track $index) {
          <span [style.left.%]="p.left" [style.background]="p.color"
                [style.animation-delay.s]="p.delay" [style.animation-duration.s]="p.dur"></span>
        }
      </div>
      <h2 mat-dialog-title>🎉 Semua Ratu Terpasang!</h2>
      <mat-dialog-content>
        <p class="win-sub">Kamu menyelesaikan Queens {{ data.difficultyLabel }}.</p>
        <div class="win-stats">
          <div><span class="win-num">{{ fmt(data.seconds) }}</span><span class="win-label">Waktu</span></div>
          <div><span class="win-num">{{ data.moves }}</span><span class="win-label">Langkah</span></div>
          @if (data.isDaily) {
            <div><span class="win-num">{{ data.streak }} 🔥</span><span class="win-label">Streak Harian</span></div>
          }
        </div>
        @if (data.isBest) {
          <p class="win-best">🏆 Waktu terbaik baru untuk level ini!</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-raised-button color="primary" (click)="close()">Main Lagi</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .win-dialog { position: relative; overflow: hidden; text-align: center; min-width: 320px; }
    .win-dialog > * { position: relative; }
    .confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
    .confetti span { position: absolute; top: -12px; width: 9px; height: 14px; border-radius: 2px;
      animation: confetti-fall linear infinite; }
    @keyframes confetti-fall { to { transform: translateY(340px) rotate(720deg); opacity: 0.6; } }
    .win-sub { color: var(--pg-muted); }
    .win-stats { display: flex; gap: 24px; justify-content: center; margin: 16px 0; }
    .win-num { display: block; font-size: 1.6rem; font-weight: 900; font-family: var(--pg-font-heading); }
    .win-label { font-size: 0.8rem; color: var(--pg-muted); }
    .win-best { color: var(--pg-accent); font-weight: 700; }
  `],
})
export class QueensWinDialog {
  data = inject<QueensWinData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<QueensWinDialog>);
  pieces = Array.from({ length: 28 }, (_, i) => ({
    left: (i * 37) % 100,
    color: ['#7c5cff', '#22d3ee', '#fbbf24', '#22c55e', '#ef4444'][i % 5],
    delay: (i % 10) * 0.18,
    dur: 2.2 + (i % 5) * 0.35,
  }));
  fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  close(): void { this.ref.close(); }
}

/** Warna wilayah (8 warna, satu per wilayah) — pastel agar ratu tetap terbaca di tema terang & gelap. */
const REGION_COLORS = ['#ef9a9a', '#f48fb1', '#ce93d8', '#90caf9', '#80cbc4', '#a5d6a7', '#fff59d', '#ffcc80'];

@Component({
  selector: 'app-queens',
  standalone: true,
  imports: [
    CommonModule, MatButtonModule, MatCardModule, MatSelectModule, MatFormFieldModule,
    MatIconModule, MatProgressBarModule, MatProgressSpinnerModule, MatSnackBarModule,
    MatDialogModule, MatTooltipModule,
  ],
  templateUrl: './queens.html',
  styleUrl: './queens.scss',
})
export class Queens implements OnInit, OnDestroy {
  private config = inject(ConfigService);
  private route = inject(ActivatedRoute);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);

  size = 7;
  regions: number[][] = [];
  solution: number[] = [];
  /** grid flat: 0 kosong, 1 ratu, 2 tanda X. */
  grid: number[] = [];
  badCells = new Set<string>();
  difficultyId = 'medium';
  isDaily = false;
  hintsLeft = 3;
  moves = 0;
  seconds = 0;
  won = false;
  generating = false;
  started = false;
  bestTime: number | null = null;
  streak = 0;

  private history: number[][] = [];
  private timerId: ReturnType<typeof setInterval> | null = null;

  get cfg() { return this.config.config.games.queens; }
  get difficulties() { return this.cfg.difficulties; }
  get difficultyLabel(): string {
    return this.difficulties.find((d) => d.id === this.difficultyId)?.label ?? '';
  }
  get queenCount(): number {
    return this.grid.filter((v) => v === 1).length;
  }

  /** Warna latar sel dari wilayahnya. */
  regionBg(r: number, c: number): string {
    const color = REGION_COLORS[this.regions[r][c] % REGION_COLORS.length];
    return `color-mix(in srgb, ${color} 45%, var(--pg-surface))`;
  }

  /**
   * Kelas garis batas wilayah: sisi sel yang berbatasan dengan wilayah lain
   * (atau tepi papan) digambar lebih tebal, ala Queens LinkedIn.
   */
  edgeClasses(r: number, c: number): string {
    const reg = this.regions[r][c];
    const n = this.size;
    const cls: string[] = [];
    if (r === 0 || this.regions[r - 1][c] !== reg) cls.push('e-t');
    if (c === 0 || this.regions[r][c - 1] !== reg) cls.push('e-l');
    if (r === n - 1 || this.regions[r + 1][c] !== reg) cls.push('e-b');
    if (c === n - 1 || this.regions[r][c + 1] !== reg) cls.push('e-r');
    return cls.join(' ');
  }

  ngOnInit(): void {
    this.streak = Number(localStorage.getItem('pg-queens-daily-streak') ?? 0);
    this.route.queryParamMap.subscribe((params) => {
      if (params.get('mode') === 'daily') this.startDaily();
      else if (!this.regions.length) this.newGame(this.difficultyId);
    });
  }

  ngOnDestroy(): void { this.stopTimer(); }

  fmt(s: number): string {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  newGame(difficultyId: string): void {
    this.difficultyId = difficultyId;
    this.isDaily = false;
    const size = this.difficulties.find((d) => d.id === difficultyId)?.size ?? 7;
    this.loadPuzzle(() => generateQueensPuzzle(size));
  }

  startDaily(): void {
    this.isDaily = true;
    this.difficultyId = 'medium';
    const size = this.difficulties.find((d) => d.id === 'medium')?.size ?? 7;
    this.loadPuzzle(() => generateDailyQueensPuzzle(size));
  }

  private loadPuzzle(gen: () => QueensPuzzle): void {
    this.generating = true;
    this.stopTimer();
    // Beri spinner sempat tampil sebelum generasi sinkron berjalan.
    setTimeout(() => {
      try {
        const p = gen();
        this.size = p.size;
        this.regions = p.regions;
        this.solution = p.solution;
        this.grid = Array(p.size * p.size).fill(0);
        this.badCells = new Set();
        this.history = [];
        this.hintsLeft = this.cfg.maxHints;
        this.moves = 0;
        this.seconds = 0;
        this.won = false;
        this.started = false;
        this.bestTime = this.readBest();
        this.generating = false;
        // Pastikan tampilan diperbarui setelah generasi asinkron.
        this.cdr.detectChanges();
      } catch (e) {
        console.error('[queens] Gagal membuat puzzle', e);
        this.generating = false;
        this.cdr.detectChanges();
      }
    }, 40);
  }

  // ---------- Interaksi papan ----------

  /** Ketuk sel: kosong → ratu 👑 → tanda X ✕ → kosong. */
  tap(r: number, c: number): void {
    if (this.won || this.generating) return;
    const idx = r * this.size + c;
    this.history.push([...this.grid]);
    this.grid = [...this.grid];
    this.grid[idx] = (this.grid[idx] + 1) % 3;
    this.moves++;
    if (!this.started) { this.started = true; this.startTimer(); }
    this.refreshValidation();
  }

  /** Validasi aturan setelah tiap perubahan; menang bila lengkap & valid. */
  private refreshValidation(): void {
    const v = validateQueens(this.grid, { size: this.size, regions: this.regions, solution: this.solution });
    this.badCells = v.badCells;
    if (v.complete) this.win();
  }

  // ---------- Kontrol permainan ----------

  hint(): void {
    if (this.won || this.hintsLeft <= 0 || this.generating) return;
    const puzzle = { size: this.size, regions: this.regions, solution: this.solution };
    if (!queensSubsetOfSolution(this.grid, puzzle)) {
      this.snack.open(
        'Ratu yang sudah dipasang tidak sesuai solusi — urungkan dulu, baru minta petunjuk.',
        'Tutup', { duration: 4000 },
      );
      return;
    }
    const idx = queensHint(this.grid, puzzle);
    if (idx === null) {
      this.snack.open('Tidak ada ratu yang bisa diberi petunjuk.', 'Tutup', { duration: 2500 });
      return;
    }
    this.history.push([...this.grid]);
    this.grid = [...this.grid];
    this.grid[idx] = 1;
    this.hintsLeft--;
    if (!this.started) { this.started = true; this.startTimer(); }
    this.snack.open(
      `Petunjuk: pasang ratu di baris ${Math.floor(idx / this.size) + 1}, kolom ${(idx % this.size) + 1}. Sisa: ${this.hintsLeft}`,
      'Tutup', { duration: 2500 },
    );
    this.refreshValidation();
  }

  undo(): void {
    const prev = this.history.pop();
    if (!prev || this.won) return;
    this.grid = prev;
    this.moves = Math.max(0, this.moves - 1);
    this.refreshValidation();
  }

  reset(): void {
    if (this.generating) return;
    this.history.push([...this.grid]);
    this.grid = Array(this.size * this.size).fill(0);
    this.hintsLeft = this.cfg.maxHints;
    this.moves = 0;
    this.seconds = 0;
    this.won = false;
    this.started = false;
    this.badCells.clear();
    this.stopTimer();
  }

  check(): void {
    if (this.generating) return;
    const v = validateQueens(this.grid, { size: this.size, regions: this.regions, solution: this.solution });
    this.badCells = v.badCells;
    if (v.complete) { this.win(); return; }
    if (!v.valid) {
      this.snack.open(
        `Ada yang salah: ${v.problems[0]}. Perbaiki sel yang ditandai merah.`,
        'Tutup', { duration: 5000 },
      );
      return;
    }
    this.snack.open(
      `Sejauh ini benar. Sisa ${this.size - v.queenCount} ratu lagi.`,
      'Tutup', { duration: 3000 },
    );
  }

  private win(): void {
    this.won = true;
    this.stopTimer();
    // Game harian tidak menyimpan waktu terbaik (seperti Tango & Zip).
    const isBest = !this.isDaily && (this.bestTime === null || this.seconds < this.bestTime);
    if (isBest && !this.isDaily) {
      localStorage.setItem(`pg-queens-best-${this.difficultyId}`, String(this.seconds));
      this.bestTime = this.seconds;
    }
    localStorage.setItem('pg-stats-solved', String(Number(localStorage.getItem('pg-stats-solved') ?? 0) + 1));
    if (this.isDaily) {
      const today = new Date().toISOString().slice(0, 10);
      const last = localStorage.getItem('pg-queens-daily-last');
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      this.streak = last === yesterday ? this.streak + 1 : 1;
      localStorage.setItem('pg-queens-daily-streak', String(this.streak));
      localStorage.setItem('pg-queens-daily-last', today);
    }
    this.dialog.open(QueensWinDialog, {
      data: {
        seconds: this.seconds, moves: this.moves,
        difficultyLabel: this.isDaily ? 'Harian' : this.difficultyLabel,
        isDaily: this.isDaily, streak: this.streak, isBest,
      } satisfies QueensWinData,
      disableClose: true,
    }).afterClosed().subscribe(() => {
      if (this.isDaily) this.startDaily();
      else this.newGame(this.difficultyId);
    });
  }

  private readBest(): number | null {
    if (this.isDaily) return null;
    const v = localStorage.getItem(`pg-queens-best-${this.difficultyId}`);
    return v === null ? null : Number(v);
  }

  private startTimer(): void {
    if (!this.cfg.showTimer) return;
    this.stopTimer();
    this.timerId = setInterval(() => this.seconds++, 1000);
  }

  private stopTimer(): void {
    if (this.timerId !== null) { clearInterval(this.timerId); this.timerId = null; }
  }
}
