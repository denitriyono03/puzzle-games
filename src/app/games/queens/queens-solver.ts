/**
 * Solver / validator Queens.
 * Sel: 0 kosong, 1 ratu, 2 tanda X (tanda X tidak dihitung sebagai ratu).
 * Kemenangan = tepat `size` ratu dan tidak ada pelanggaran aturan.
 */

import { QueensPuzzle } from './queens-generator';

export interface QueensCheck {
  valid: boolean;
  complete: boolean;
  /** Pesan masalah dalam Bahasa Indonesia (unik, urut). */
  problems: string[];
  /** Sel ratu yang terlibat pelanggaran, format "r,c". */
  badCells: Set<string>;
  queenCount: number;
}

export function validateQueens(grid: number[], puzzle: QueensPuzzle): QueensCheck {
  const n = puzzle.size;
  const problems: string[] = [];
  const badCells = new Set<string>();
  const key = (r: number, c: number) => `${r},${c}`;
  const queens: [number, number][] = [];
  grid.forEach((v, i) => {
    if (v === 1) queens.push([Math.floor(i / n), i % n]);
  });

  const seenRow = new Map<number, [number, number]>();
  const seenCol = new Map<number, [number, number]>();
  const seenRegion = new Map<number, [number, number]>();
  for (const [r, c] of queens) {
    const firstRow = seenRow.get(r);
    if (firstRow) {
      problems.push(`Baris ${r + 1} punya lebih dari satu ratu`);
      badCells.add(key(firstRow[0], firstRow[1]));
      badCells.add(key(r, c));
    } else seenRow.set(r, [r, c]);
    const firstCol = seenCol.get(c);
    if (firstCol) {
      problems.push(`Kolom ${c + 1} punya lebih dari satu ratu`);
      badCells.add(key(firstCol[0], firstCol[1]));
      badCells.add(key(r, c));
    } else seenCol.set(c, [r, c]);
    const reg = puzzle.regions[r][c];
    const firstReg = seenRegion.get(reg);
    if (firstReg) {
      problems.push(`Wilayah ${reg + 1} punya lebih dari satu ratu`);
      badCells.add(key(firstReg[0], firstReg[1]));
      badCells.add(key(r, c));
    } else seenRegion.set(reg, [r, c]);
  }
  for (let i = 0; i < queens.length; i++)
    for (let j = i + 1; j < queens.length; j++) {
      const [r1, c1] = queens[i];
      const [r2, c2] = queens[j];
      if (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1) {
        problems.push('Dua ratu bersebelahan (termasuk diagonal)');
        badCells.add(key(r1, c1));
        badCells.add(key(r2, c2));
      }
    }

  const complete = queens.length === n && problems.length === 0;
  return {
    valid: problems.length === 0,
    complete,
    problems: [...new Set(problems)],
    badCells,
    queenCount: queens.length,
  };
}

/** Ratu pertama dari solusi yang belum dipasang (indeks flat), atau null bila lengkap. */
export function queensHint(grid: number[], puzzle: QueensPuzzle): number | null {
  for (let r = 0; r < puzzle.size; r++) {
    const idx = r * puzzle.size + puzzle.solution[r];
    if (grid[idx] !== 1) return idx;
  }
  return null;
}

/**
 * Benar bila semua ratu yang dipasang pemain cocok dengan solusi yang
 * disimpan — syarat petunjuk (hint) boleh dipakai. Bila pemain mengikuti
 * solusi lain yang juga valid, hint menolak dan minta urungkan dulu.
 */
export function queensSubsetOfSolution(grid: number[], puzzle: QueensPuzzle): boolean {
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] !== 1) continue;
    const r = Math.floor(i / puzzle.size);
    if (puzzle.solution[r] !== i % puzzle.size) return false;
  }
  return true;
}
