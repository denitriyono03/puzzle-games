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
import { countZipCompletions, nextUnvisitedClue, ZipCell } from './zip-solver';
import { generateDailyZipPuzzle, generateZipPuzzle, ZipPuzzle } from './zip-generator';

export interface ZipWinData {
  seconds: number;
  moves: number;
  difficultyLabel: string;
  isDaily: boolean;
  streak: number;
  isBest: boolean;
}

@Component({
  selector: 'app-zip-win-dialog',
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
      <h2 mat-dialog-title>🎉 Jalur Selesai!</h2>
      <mat-dialog-content>
        <p class="win-sub">Kamu menyelesaikan Zip {{ data.difficultyLabel }}.</p>
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
export class ZipWinDialog {
  data = inject<ZipWinData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<ZipWinDialog>);
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
  selector: 'app-zip',
  standalone: true,
  imports: [
    CommonModule, MatButtonModule, MatCardModule, MatSelectModule, MatFormFieldModule,
    MatIconModule, MatProgressBarModule, MatProgressSpinnerModule, MatSnackBarModule,
    MatDialogModule, MatTooltipModule,
  ],
  templateUrl: './zip.html',
  styleUrl: './zip.scss',
})
export class Zip implements OnInit, OnDestroy {
  private config = inject(ConfigService);
  private route = inject(ActivatedRoute);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);

  size = 6;
  clues: number[][] = [];
  solution: ZipCell[] = [];
  /** Jalur yang sedang digambar, urut dari angka 1. */
  path: ZipCell[] = [];
  /** pathIndex[r][c] = indeks langkah di `path` (-1 bila belum dilewati). */
  pathIndex: number[][] = [];
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

  private history: ZipCell[][] = [];
  private timerId: ReturnType<typeof setInterval> | null = null;
  private dragging = false;
  private pendingRetract = false;
  private dragStart = { x: 0, y: 0 };

  get cfg() { return this.config.config.games.zip; }
  get difficulties() { return this.cfg.difficulties; }
  get difficultyLabel(): string {
    return this.difficulties.find((d) => d.id === this.difficultyId)?.label ?? '';
  }
  get maxNumber(): number { return this.size * this.size; }
  get pathHead(): ZipCell | null {
    return this.path.length ? this.path[this.path.length - 1] : null;
  }
  isHead(r: number, c: number): boolean {
    const h = this.pathHead;
    return !!h && h[0] === r && h[1] === c;
  }

  /**
   * Titik-titik garis jalur (SVG overlay). viewBox 0 0 394 394 mengikuti ukuran
   * papan desktop (padding 14, sel 56, gap 6); di layar kecil SVG diskalakan
   * seragam lewat preserveAspectRatio="none" sehingga garis tetap di tengah sel.
   */
  get pathPoints(): string {
    return this.path.map(([r, c]) => `${14 + c * 62 + 28},${14 + r * 62 + 28}`).join(' ');
  }

  /**
   * Posisi tengah sel ke-i (0..5) sebagai persen lebar/tinggi papan — dipakai
   * lingkaran angka (.clue-dot) agar selalu tepat di tengah sel, di semua ukuran layar.
   * Rumusnya sama dengan pathPoints: tengah sel = 14 + i*62 + 28 dari 394.
   */
  cellCenterPct(i: number): number {
    return ((42 + i * 62) / 394) * 100;
  }

  ngOnInit(): void {
    this.streak = Number(localStorage.getItem('pg-zip-daily-streak') ?? 0);
    this.route.queryParamMap.subscribe((params) => {
      if (params.get('mode') === 'daily') this.startDaily();
      else if (!this.clues.length) this.newGame(this.difficultyId);
    });
  }

  ngOnDestroy(): void { this.stopTimer(); }

  fmt(s: number): string {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  newGame(difficultyId: string): void {
    this.difficultyId = difficultyId;
    this.isDaily = false;
    const givens = this.difficulties.find((d) => d.id === difficultyId)?.givens ?? 3;
    this.loadPuzzle(() => generateZipPuzzle(this.cfg.gridSize, givens));
  }

  startDaily(): void {
    this.isDaily = true;
    this.difficultyId = 'medium';
    const givens = this.difficulties.find((d) => d.id === 'medium')?.givens ?? 3;
    this.loadPuzzle(() => generateDailyZipPuzzle(this.cfg.gridSize, givens));
  }

  private loadPuzzle(gen: () => ZipPuzzle): void {
    this.generating = true;
    this.stopTimer();
    // Beri spinner sempat tampil sebelum generasi sinkron berjalan.
    setTimeout(() => {
      try {
        const p = gen();
        this.size = p.size;
        this.clues = p.clues;
        this.solution = p.solution;
        this.path = [p.solution[0]];
        this.pathIndex = Array.from({ length: p.size }, () => Array(p.size).fill(-1));
        this.pathIndex[p.solution[0][0]][p.solution[0][1]] = 0;
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
        console.error('[zip] Gagal membuat puzzle', e);
        this.generating = false;
        this.cdr.detectChanges();
      }
    }, 40);
  }

  // ---------- Interaksi jalur (mouse + sentuhan) ----------

  private isAdjacent(r1: number, c1: number, r2: number, c2: number): boolean {
    return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
  }

  onPointerDown(e: PointerEvent, r: number, c: number): void {
    if (this.won || this.generating) return;
    const head = this.pathHead;
    if (!head) return;
    if (r === head[0] && c === head[1]) {
      // Mulai seret dari ujung jalur; ketuk tanpa gerak = urungkan satu langkah.
      this.dragging = true;
      this.pendingRetract = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      return;
    }
    if (this.isAdjacent(head[0], head[1], r, c) && this.pathIndex[r][c] === -1) {
      if (this.tryExtend(r, c)) {
        this.dragging = true;
        this.pendingRetract = false;
        this.dragStart = { x: e.clientX, y: e.clientY };
      }
    }
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.dragging || this.won) return;
    if (Math.hypot(e.clientX - this.dragStart.x, e.clientY - this.dragStart.y) > 8) {
      this.pendingRetract = false;
    }
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-cell]');
    if (!el) return;
    const r = Number((el as HTMLElement).dataset['r']);
    const c = Number((el as HTMLElement).dataset['c']);
    if (Number.isNaN(r) || Number.isNaN(c)) return;
    const head = this.pathHead;
    if (!head) return;
    if (this.isAdjacent(head[0], head[1], r, c) && this.pathIndex[r][c] === -1) {
      this.tryExtend(r, c);
    }
  }

  onPointerUp(): void {
    if (this.dragging && this.pendingRetract) this.retractOne();
    this.dragging = false;
    this.pendingRetract = false;
  }

  onPointerCancel(): void {
    this.dragging = false;
    this.pendingRetract = false;
  }

  /** Tambah satu sel ke ujung jalur. False bila sel bernomor itu bukan gilirannya. */
  private tryExtend(r: number, c: number): boolean {
    const nextNum = this.path.length + 1;
    const clue = this.clues[r][c];
    if (clue > 0 && clue !== nextNum) return false;
    this.history.push(this.path.map(([pr, pc]) => [pr, pc] as ZipCell));
    this.path = [...this.path, [r, c]];
    this.pathIndex[r][c] = this.path.length - 1;
    this.moves++;
    this.badCells.delete(`${r},${c}`);
    if (!this.started) { this.started = true; this.startTimer(); }
    if (this.path.length === this.maxNumber) this.win();
    return true;
  }

  private retractOne(): void {
    if (this.path.length <= 1 || this.won) return;
    this.history.push(this.path.map(([pr, pc]) => [pr, pc] as ZipCell));
    const [r, c] = this.path[this.path.length - 1];
    this.path = this.path.slice(0, -1);
    this.pathIndex[r][c] = -1;
    this.moves++;
    this.badCells.clear();
  }

  // ---------- Kontrol permainan ----------

  hint(): void {
    if (this.won || this.hintsLeft <= 0 || this.generating) return;
    if (!this.isSolutionPrefix()) {
      this.snack.open(
        'Jalurmu sudah menyimpang dari solusi — urungkan beberapa langkah dulu, baru minta petunjuk.',
        'Tutup', { duration: 4000 },
      );
      return;
    }
    const next = this.solution[this.path.length];
    if (!next) {
      this.snack.open('Tidak ada sel yang bisa diberi petunjuk.', 'Tutup', { duration: 2500 });
      return;
    }
    this.history.push(this.path.map(([pr, pc]) => [pr, pc] as ZipCell));
    this.path = [...this.path, next];
    this.pathIndex[next[0]][next[1]] = this.path.length - 1;
    this.hintsLeft--;
    if (!this.started) { this.started = true; this.startTimer(); }
    this.snack.open(
      `Petunjuk: lanjut ke baris ${next[0] + 1}, kolom ${next[1] + 1}. Sisa: ${this.hintsLeft}`,
      'Tutup', { duration: 2500 },
    );
    if (this.path.length === this.maxNumber) this.win();
  }

  undo(): void {
    const prev = this.history.pop();
    if (!prev || this.won || prev.length < 1) return;
    this.path = prev;
    this.pathIndex = Array.from({ length: this.size }, () => Array(this.size).fill(-1));
    this.path.forEach(([r, c], i) => { this.pathIndex[r][c] = i; });
    this.moves = Math.max(0, this.moves - 1);
    this.badCells.clear();
  }

  reset(): void {
    if (this.generating) return;
    this.history.push(this.path.map(([pr, pc]) => [pr, pc] as ZipCell));
    const start = this.solution[0];
    this.path = [start];
    this.pathIndex = Array.from({ length: this.size }, () => Array(this.size).fill(-1));
    this.pathIndex[start[0]][start[1]] = 0;
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
    const remaining = this.maxNumber - this.path.length;
    if (remaining === 0) { this.win(); return; }
    const { count, aborted } = countZipCompletions(this.clues, this.path, 1);
    if (aborted) {
      this.snack.open('Pemeriksaan terlalu berat — urungkan lalu periksa lagi.', 'Tutup', { duration: 4000 });
      return;
    }
    if (count === 0) {
      const head = this.pathHead;
      if (head) this.badCells = new Set([`${head[0]},${head[1]}`]);
      const nextClue = nextUnvisitedClue(this.clues, this.path);
      this.snack.open(
        nextClue > 0
          ? `Jalur ini buntu — angka ${nextClue} tidak bisa lagi dicapai. Urungkan beberapa langkah dan coba rute lain.`
          : 'Jalur ini buntu — tidak ada cara mengisi semua sel. Urungkan beberapa langkah.',
        'Tutup', { duration: 5000 },
      );
      return;
    }
    this.badCells.clear();
    this.snack.open(`Jalur sejauh ini masih bisa diselesaikan. Sisa ${remaining} sel.`, 'Tutup', { duration: 3000 });
  }

  private isSolutionPrefix(): boolean {
    return this.path.every(([r, c], i) => this.solution[i][0] === r && this.solution[i][1] === c);
  }

  private win(): void {
    this.won = true;
    this.stopTimer();
    // Game harian tidak menyimpan waktu terbaik (seperti Tango), jadi trofi
    // hanya tampil untuk game biasa.
    const isBest = !this.isDaily && (this.bestTime === null || this.seconds < this.bestTime);
    if (isBest && !this.isDaily) {
      localStorage.setItem(`pg-zip-best-${this.difficultyId}`, String(this.seconds));
      this.bestTime = this.seconds;
    }
    localStorage.setItem('pg-stats-solved', String(Number(localStorage.getItem('pg-stats-solved') ?? 0) + 1));
    if (this.isDaily) {
      const today = new Date().toISOString().slice(0, 10);
      const last = localStorage.getItem('pg-zip-daily-last');
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      this.streak = last === yesterday ? this.streak + 1 : 1;
      localStorage.setItem('pg-zip-daily-streak', String(this.streak));
      localStorage.setItem('pg-zip-daily-last', today);
    }
    this.dialog.open(ZipWinDialog, {
      data: {
        seconds: this.seconds, moves: this.moves,
        difficultyLabel: this.isDaily ? 'Harian' : this.difficultyLabel,
        isDaily: this.isDaily, streak: this.streak, isBest,
      } satisfies ZipWinData,
      disableClose: true,
    }).afterClosed().subscribe(() => {
      if (this.isDaily) this.startDaily();
      else this.newGame(this.difficultyId);
    });
  }

  private readBest(): number | null {
    if (this.isDaily) return null;
    const v = localStorage.getItem(`pg-zip-best-${this.difficultyId}`);
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
