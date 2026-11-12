/**
 * Generator puzzle Tango 6x6.
 * 1. Bangun solusi penuh lewat backtracking acak.
 * 2. Pasang constraint "=" / "×" pada sebagian pasangan sel bertetangga,
 *    konsisten dengan solusi.
 * 3. Hapus sel satu per satu sampai tersisa `givens` sel, dan hanya
 *    pertahankan penghapusan bila solusinya tetap UNIK (solver cap 2).
 * Anggaran waktu mencegah generasi yang lambat (<2 dtk per puzzle).
 */

import {
  CellValue, Constraint, MOON, SUN, canPlace, countSolutions,
  seededRandom, shuffled,
} from './tango-solver';

export interface TangoPuzzle {
  givens: CellValue[][];
  solution: CellValue[][];
  constraints: Constraint[];
  givensCount: number;
}

function generateSolution(rand: () => number): CellValue[][] {
  const board: CellValue[][] = Array.from({ length: 6 }, () => Array(6).fill(0) as CellValue[]);

  function backtrack(pos: number): boolean {
    if (pos === 36) return true;
    const r = Math.floor(pos / 6), c = pos % 6;
    for (const v of shuffled([SUN, MOON] as CellValue[], rand)) {
      if (!canPlace(board, r, c, v)) continue;
      board[r][c] = v;
      if (backtrack(pos + 1)) return true;
      board[r][c] = 0;
    }
    return false;
  }

  if (!backtrack(0)) throw new Error('Gagal membangkitkan solusi Tango');
  return board;
}

function pickConstraints(solution: CellValue[][], rand: () => number): Constraint[] {
  const pairs: Constraint[] = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      if (c < 5) pairs.push({ r1: r, c1: c, r2: r, c2: c + 1, type: solution[r][c] === solution[r][c + 1] ? 'eq' : 'neq' });
      if (r < 5) pairs.push({ r1: r, c1: c, r2: r + 1, c2: c, type: solution[r][c] === solution[r + 1][c] ? 'eq' : 'neq' });
    }
  }
  // ~30% pasangan bertetangga diberi constraint, maks 12.
  return shuffled(pairs, rand).filter(() => rand() < 0.3).slice(0, 12);
}

export function generatePuzzle(givensTarget: number, seed?: string): TangoPuzzle {
  const rand = seed ? seededRandom(seed) : Math.random;
  const deadline = Date.now() + 1800; // anggaran <2 dtk
  const solution = generateSolution(rand);
  const constraints = pickConstraints(solution, rand);

  const givens = solution.map((row) => [...row]);
  let remaining = 36;
  for (const [r, c] of shuffled(
    Array.from({ length: 36 }, (_, i) => [Math.floor(i / 6), i % 6] as [number, number]),
    rand,
  )) {
    if (remaining <= givensTarget) break;
    if (Date.now() > deadline) break;
    const saved = givens[r][c];
    givens[r][c] = 0;
    // Unik? (cap 2 — berhenti begitu solusi kedua ditemukan)
    if (countSolutions(givens, constraints, 2) !== 1) givens[r][c] = saved;
    else remaining--;
  }

  return { givens, solution, constraints, givensCount: remaining };
}

/** Puzzle harian: seed dari tanggal UTC (YYYY-MM-DD), deterministik. */
export function dailySeed(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `tango-daily-${y}-${m}-${d}`;
}

export function generateDailyPuzzle(givensTarget = 10, date = new Date()): TangoPuzzle {
  return generatePuzzle(givensTarget, dailySeed(date));
}
