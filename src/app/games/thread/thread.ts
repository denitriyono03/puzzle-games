import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { ConfigService } from '../../config/config.service';
import { checkThreadAnswer, generateDailyThreadPuzzle, generateThreadPuzzle, ThreadPuzzle } from './thread-data';

export interface ThreadWinData {
  seconds: number;
  attempts: number;
  answer: string;
  difficultyLabel: string;
  isDaily: boolean;
  streak: number;
  isBest: boolean;
}

@Component({
  selector: 'app-thread-win-dialog',
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
      <h2 mat-dialog-title>🎉 Jawaban Benar!</h2>
      <mat-dialog-content>
        <p class="win-sub">Kamu menemukan benang merahnya: <strong>{{ data.answer }}</strong>.</p>
        <p class="win-sub">Common Thread {{ data.difficultyLabel }} selesai.</p>
        <div class="win-stats">
          <div><span class="win-num">{{ fmt(data.seconds) }}</span><span class="win-label">Waktu</span></div>
          <div><span class="win-num">{{ data.attempts }}</span><span class="win-label">Percobaan</span></div>
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
export class ThreadWinDialog {
  data = inject<ThreadWinData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<ThreadWinDialog>);
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
  selector: 'app-thread',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatCardModule, MatSelectModule,
    MatFormFieldModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule,
    MatDialogModule, MatTooltipModule, MatInputModule,
  ],
  templateUrl: './thread.html',
  styleUrl: './thread.scss',
})
export class Thread implements OnInit, OnDestroy {
  private config = inject(ConfigService);
  private route = inject(ActivatedRoute);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);

  puzzle: ThreadPuzzle | null = null;
  draft = '';
  /** revealed[i] = huruf jawaban ke-i sudah dibuka petunjuk (spasi selalu terbuka). */
  revealed: boolean[] = [];
  difficultyId = 'medium';
  isDaily = false;
  hintsLeft = 3;
  attempts = 0;
  seconds = 0;
  won = false;
  generating = false;
  started = false;
  bestTime: number | null = null;
  streak = 0;
  wrongFlash = false;

  private timerId: ReturnType<typeof setInterval> | null = null;

  get cfg() { return this.config.config.games.thread; }
  get difficulties() { return this.cfg.difficulties; }
  get difficultyLabel(): string {
    return this.difficulties.find((d) => d.id === this.difficultyId)?.label ?? '';
  }

  /** Pola jawaban untuk layar: huruf yang sudah dibuka tampil, sisanya "_". */
  get patternChars(): string[] {
    if (!this.puzzle) return [];
    return Array.from(this.puzzle.answer).map((ch, i) =>
      ch === ' ' ? ' ' : this.revealed[i] ? ch : '_',
    );
  }

  ngOnInit(): void {
    this.streak = Number(localStorage.getItem('pg-thread-daily-streak') ?? 0);
    this.route.queryParamMap.subscribe((params) => {
      if (params.get('mode') === 'daily') this.startDaily();
      else if (!this.puzzle) this.newGame(this.difficultyId);
    });
  }

  ngOnDestroy(): void { this.stopTimer(); }

  fmt(s: number): string {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  newGame(difficultyId: string): void {
    this.difficultyId = difficultyId;
    this.isDaily = false;
    this.loadPuzzle(() => generateThreadPuzzle(difficultyId));
  }

  startDaily(): void {
    this.isDaily = true;
    this.difficultyId = 'medium';
    this.loadPuzzle(() => generateDailyThreadPuzzle());
  }

  private loadPuzzle(gen: () => ThreadPuzzle): void {
    this.generating = true;
    this.stopTimer();
    // Beri spinner sempat tampil sebelum generasi sinkron berjalan.
    setTimeout(() => {
      try {
        const p = gen();
        this.puzzle = p;
        this.revealed = Array.from(p.answer).map((ch) => ch === ' ');
        this.draft = '';
        this.hintsLeft = this.cfg.maxHints;
        this.attempts = 0;
        this.seconds = 0;
        this.won = false;
        this.started = false;
        this.wrongFlash = false;
        this.bestTime = this.readBest();
        this.generating = false;
        // Pastikan tampilan diperbarui setelah generasi asinkron.
        this.cdr.detectChanges();
      } catch (e) {
        console.error('[thread] Gagal membuat puzzle', e);
        this.generating = false;
        this.cdr.detectChanges();
      }
    }, 40);
  }

  // ---------- Permainan ----------

  submit(): void {
    if (this.won || this.generating || !this.puzzle) return;
    const answer = this.draft.trim();
    if (!answer) {
      this.snack.open('Ketik dulu jawabanmu.', 'Tutup', { duration: 2000 });
      return;
    }
    this.attempts++;
    if (!this.started) { this.started = true; this.startTimer(); }
    if (checkThreadAnswer(answer, this.puzzle)) {
      this.win();
      return;
    }
    this.wrongFlash = true;
    setTimeout(() => { this.wrongFlash = false; }, 400);
    this.snack.open(
      `Belum tepat — "${answer}" bukan benang merahnya. Coba lagi! (Percobaan ke-${this.attempts})`,
      'Tutup', { duration: 3500 },
    );
  }

  /** Petunjuk: buka satu huruf jawaban berikutnya (dari kiri). */
  hint(): void {
    if (this.won || this.hintsLeft <= 0 || this.generating || !this.puzzle) return;
    const idx = this.revealed.findIndex((r, i) => !r && this.puzzle!.answer[i] !== ' ');
    if (idx === -1) {
      this.snack.open('Semua huruf sudah terbuka.', 'Tutup', { duration: 2500 });
      return;
    }
    this.revealed = [...this.revealed];
    this.revealed[idx] = true;
    this.hintsLeft--;
    if (!this.started) { this.started = true; this.startTimer(); }
    this.snack.open(
      `Petunjuk: huruf ke-${idx + 1} adalah "${this.puzzle.answer[idx]}". Sisa: ${this.hintsLeft}`,
      'Tutup', { duration: 2500 },
    );
  }

  reset(): void {
    if (this.generating || !this.puzzle) return;
    this.revealed = Array.from(this.puzzle.answer).map((ch) => ch === ' ');
    this.draft = '';
    this.hintsLeft = this.cfg.maxHints;
    this.attempts = 0;
    this.seconds = 0;
    this.won = false;
    this.started = false;
    this.wrongFlash = false;
    this.stopTimer();
  }

  private win(): void {
    if (!this.puzzle) return;
    this.won = true;
    this.stopTimer();
    // Game harian tidak menyimpan waktu terbaik (seperti Tango, Zip & Queens).
    const isBest = !this.isDaily && (this.bestTime === null || this.seconds < this.bestTime);
    if (isBest && !this.isDaily) {
      localStorage.setItem(`pg-thread-best-${this.difficultyId}`, String(this.seconds));
      this.bestTime = this.seconds;
    }
    localStorage.setItem('pg-stats-solved', String(Number(localStorage.getItem('pg-stats-solved') ?? 0) + 1));
    if (this.isDaily) {
      const today = new Date().toISOString().slice(0, 10);
      const last = localStorage.getItem('pg-thread-daily-last');
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      this.streak = last === yesterday ? this.streak + 1 : 1;
      localStorage.setItem('pg-thread-daily-streak', String(this.streak));
      localStorage.setItem('pg-thread-daily-last', today);
    }
    this.dialog.open(ThreadWinDialog, {
      data: {
        seconds: this.seconds, attempts: this.attempts, answer: this.puzzle.answer,
        difficultyLabel: this.isDaily ? 'Harian' : this.difficultyLabel,
        isDaily: this.isDaily, streak: this.streak, isBest,
      } satisfies ThreadWinData,
      disableClose: true,
    }).afterClosed().subscribe(() => {
      if (this.isDaily) this.startDaily();
      else this.newGame(this.difficultyId);
    });
  }

  private readBest(): number | null {
    if (this.isDaily) return null;
    const v = localStorage.getItem(`pg-thread-best-${this.difficultyId}`);
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
