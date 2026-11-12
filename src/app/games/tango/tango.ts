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
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfigService } from '../../config/config.service';
import { CellValue, Constraint, MOON, SUN, validateBoard } from './tango-solver';
import { TangoPuzzle, generateDailyPuzzle, generatePuzzle } from './tango-generator';

export interface WinData {
  seconds: number;
  moves: number;
  difficultyLabel: string;
  isDaily: boolean;
  streak: number;
  isBest: boolean;
}

@Component({
  selector: 'app-win-dialog',
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
      <h2 mat-dialog-title>🎉 Puzzle Selesai!</h2>
      <mat-dialog-content>
        <p class="win-sub">Kamu menyelesaikan Tango {{ data.difficultyLabel }}.</p>
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
export class WinDialog {
  data = inject<WinData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<WinDialog>);
  pieces = Array.from({ length: 28 }, (_, i) => ({
    left: (i * 37) % 100,
    color: ['#7c5cff', '#22d3ee', '#fbbf24', '#22c55e', '#ef4444'][i % 5],
    delay: (i % 10) * 0.18,
    dur: 2.2 + (i % 5) * 0.35,
  }));
  fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  close(): void { this.ref.close(); }
}

@Component({
  selector: 'app-tango',
  standalone: true,
  imports: [
    CommonModule, MatButtonModule, MatCardModule, MatSelectModule, MatFormFieldModule,
    MatIconModule, MatProgressBarModule, MatProgressSpinnerModule, MatSnackBarModule,
    MatDialogModule, MatChipsModule, MatTooltipModule,
  ],
  templateUrl: './tango.html',
  styleUrl: './tango.scss',
})
export class Tango implements OnInit, OnDestroy {
  private config = inject(ConfigService);
  private route = inject(ActivatedRoute);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);

  board: CellValue[][] = [];
  solution: CellValue[][] = [];
  constraints: Constraint[] = [];
  givenMask: boolean[][] = [];
  hintMask: boolean[][] = [];
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

  private history: CellValue[][][] = [];
  private timerId: ReturnType<typeof setInterval> | null = null;

  get cfg() { return this.config.config.games.tango; }
  get difficulties() { return this.cfg.difficulties; }
  get difficultyLabel(): string {
    return this.difficulties.find((d) => d.id === this.difficultyId)?.label ?? '';
  }
  get filledCount(): number {
    return this.board.flat().filter((v) => v !== 0).length;
  }
  get rightEdge(): Record<string, Constraint> {
    const m: Record<string, Constraint> = {};
    for (const k of this.constraints) if (k.r1 === k.r2 && k.c2 === k.c1 + 1) m[`${k.r1},${k.c1}`] = k;
    return m;
  }
  get bottomEdge(): Record<string, Constraint> {
    const m: Record<string, Constraint> = {};
    for (const k of this.constraints) if (k.c1 === k.c2 && k.r2 === k.r1 + 1) m[`${k.r1},${k.c1}`] = k;
    return m;
  }

  ngOnInit(): void {
    this.streak = Number(localStorage.getItem('pg-tango-daily-streak') ?? 0);
    this.route.queryParamMap.subscribe((params) => {
      if (params.get('mode') === 'daily') this.startDaily();
      else if (!this.board.length) this.newGame(this.difficultyId);
    });
  }

  ngOnDestroy(): void { this.stopTimer(); }

  fmt(s: number): string {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  newGame(difficultyId: string): void {
    this.difficultyId = difficultyId;
    this.isDaily = false;
    const givens = this.difficulties.find((d) => d.id === difficultyId)?.givens ?? 10;
    this.loadPuzzle(() => generatePuzzle(givens));
  }

  startDaily(): void {
    this.isDaily = true;
    this.difficultyId = 'medium';
    this.loadPuzzle(() => generateDailyPuzzle(10));
  }

  private loadPuzzle(gen: () => TangoPuzzle): void {
    this.generating = true;
    this.stopTimer();
    // Beri spinner sempat tampil sebelum generasi sinkron berjalan.
    setTimeout(() => {
      try {
        const p = gen();
        this.board = p.givens.map((r) => [...r]);
        this.solution = p.solution;
        this.constraints = p.constraints;
        this.givenMask = p.givens.map((r) => r.map((v) => v !== 0));
        this.hintMask = p.givens.map((r) => r.map(() => false));
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
        console.error('[tango] Gagal membuat puzzle', e);
        this.generating = false;
        this.cdr.detectChanges();
      }
    }, 40);
  }

  cycleCell(r: number, c: number): void {
    if (this.won || this.generating) return;
    if (this.givenMask[r][c] || this.hintMask[r][c]) return;
    this.history.push(this.board.map((row) => [...row]));
    this.board[r][c] = this.board[r][c] === 0 ? SUN : this.board[r][c] === SUN ? MOON : 0;
    this.moves++;
    this.badCells.delete(`${r},${c}`);
    if (!this.started) { this.started = true; this.startTimer(); }
    if (this.filledCount === 36) {
      const { ok } = validateBoard(this.board, this.constraints);
      if (ok) this.win();
    }
  }

  hint(): void {
    if (this.won || this.hintsLeft <= 0 || this.generating) return;
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        if (this.board[r][c] !== this.solution[r][c]) {
          this.history.push(this.board.map((row) => [...row]));
          this.board[r][c] = this.solution[r][c];
          this.hintMask[r][c] = true;
          this.hintsLeft--;
          this.badCells.delete(`${r},${c}`);
          if (!this.started) { this.started = true; this.startTimer(); }
          this.snack.open(`Petunjuk: sel baris ${r + 1}, kolom ${c + 1} terisi. Sisa: ${this.hintsLeft}`, 'Tutup', { duration: 2500 });
          if (this.filledCount === 36) {
            const { ok } = validateBoard(this.board, this.constraints);
            if (ok) this.win();
          }
          return;
        }
      }
    }
    this.snack.open('Tidak ada sel yang bisa diberi petunjuk.', 'Tutup', { duration: 2500 });
  }

  undo(): void {
    const prev = this.history.pop();
    if (!prev || this.won) return;
    this.board = prev;
    this.moves = Math.max(0, this.moves - 1);
    this.badCells = new Set();
  }

  reset(): void {
    if (this.generating) return;
    this.history.push(this.board.map((row) => [...row]));
    this.board = this.solution.map((row, r) => row.map((v, c) => (this.givenMask[r][c] ? v : 0)));
    this.hintMask = this.hintMask.map((r) => r.map(() => false));
    this.hintsLeft = this.cfg.maxHints;
    this.moves = 0;
    this.seconds = 0;
    this.won = false;
    this.started = false;
    this.badCells = new Set();
    this.stopTimer();
  }

  check(): void {
    if (this.generating) return;
    const empty = 36 - this.filledCount;
    const { ok, problems, badCells } = validateBoard(this.board, this.constraints);
    this.badCells = badCells;
    if (empty > 0) {
      this.snack.open(
        problems.length
          ? `Masih ada ${empty} sel kosong. Masalah: ${problems[0]}`
          : `Masih ada ${empty} sel kosong.`,
        'Tutup', { duration: 4000 },
      );
      return;
    }
    if (!ok) {
      this.snack.open(`Belum benar: ${problems.slice(0, 2).join('; ')}`, 'Tutup', { duration: 5000 });
      return;
    }
    this.win();
  }

  private win(): void {
    this.won = true;
    this.stopTimer();
    const isBest = this.bestTime === null || this.seconds < this.bestTime;
    if (isBest && !this.isDaily) {
      localStorage.setItem(`pg-tango-best-${this.difficultyId}`, String(this.seconds));
      this.bestTime = this.seconds;
    }
    localStorage.setItem('pg-stats-solved', String(Number(localStorage.getItem('pg-stats-solved') ?? 0) + 1));
    if (this.isDaily) {
      const today = new Date().toISOString().slice(0, 10);
      const last = localStorage.getItem('pg-tango-daily-last');
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      this.streak = last === yesterday ? this.streak + 1 : 1;
      localStorage.setItem('pg-tango-daily-streak', String(this.streak));
      localStorage.setItem('pg-tango-daily-last', today);
    }
    this.dialog.open(WinDialog, {
      data: {
        seconds: this.seconds, moves: this.moves,
        difficultyLabel: this.isDaily ? 'Harian' : this.difficultyLabel,
        isDaily: this.isDaily, streak: this.streak, isBest,
      } satisfies WinData,
      disableClose: true,
    }).afterClosed().subscribe(() => {
      if (this.isDaily) this.startDaily();
      else this.newGame(this.difficultyId);
    });
  }

  private readBest(): number | null {
    if (this.isDaily) return null;
    const v = localStorage.getItem(`pg-tango-best-${this.difficultyId}`);
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
