/**
 * Generator puzzle Queens (port dari PuzzleVerse `src/games/queens.ts`).
 * Aturan: tepat satu ratu per baris, per kolom, dan per wilayah warna;
 * tidak ada dua ratu yang bersebelahan, termasuk diagonal.
 * Sel: 0 kosong, 1 ratu, 2 tanda X.
 *
 * 1. Bangun satu permutasi penempatan ratu yang valid (backtracking per
 *    baris, hanya baris berurutan yang bisa bersebelahan diagonal).
 * 2. Tumbuhkan wilayah warna dari tiap sel ratu (flood fill acak) sampai
 *    seluruh papan terisi — tiap wilayah berisi tepat satu ratu solusi.
 * 3. Kemenangan dinilai dari aturan (bukan dari solusi), jadi puzzle tidak
 *    perlu diverifikasi unik: penempatan lain yang memenuhi aturan juga menang.
 */

import { seededRandom, shuffled } from '../tango/tango-solver';

export interface QueensPuzzle {
  size: number;
  /** regions[r][c] = id wilayah (0..size-1). */
  regions: number[][];
  /** solution[r] = kolom ratu di baris r. */
  solution: number[];
}

function genPermutation(n: number, rand: () => number): number[] | null {
  const cols = shuffled(Array.from({ length: n }, (_, i) => i), rand);
  const used = new Set<number>();
  const perm: number[] = [];
  // Backtracking per baris; hanya baris berurutan yang bisa bersebelahan diagonal.
  function bt(row: number): boolean {
    if (row === n) return true;
    for (const c of shuffled(cols.filter((x) => !used.has(x)), rand)) {
      if (row > 0 && Math.abs(c - perm[row - 1]) === 1) continue;
      used.add(c);
      perm.push(c);
      if (bt(row + 1)) return true;
      used.delete(c);
      perm.pop();
    }
    return false;
  }
  return bt(0) ? perm : null;
}

export function buildRegions(n: number, solution: number[], rand: () => number): number[][] {
  const regions: number[][] = Array.from({ length: n }, () => Array(n).fill(-1));
  solution.forEach((col, row) => {
    regions[row][col] = row;
  });
  let remaining = n * n - n;
  while (remaining > 0) {
    let progressed = false;
    for (const rid of shuffled(Array.from({ length: n }, (_, i) => i), rand)) {
      const frontier: [number, number][] = [];
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++)
          if (regions[r][c] === rid) {
            for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < n && nc >= 0 && nc < n && regions[nr][nc] === -1) {
                frontier.push([nr, nc]);
              }
            }
          }
      if (frontier.length) {
        const [r, c] = frontier[Math.floor(rand() * frontier.length)];
        regions[r][c] = rid;
        remaining--;
        progressed = true;
      }
    }
    if (!progressed) break; // grid terhubung, seharusnya tidak terjadi
  }
  return regions;
}

export function generateQueensPuzzle(size: number, seed?: string): QueensPuzzle {
  const rand = seed ? seededRandom(seed) : Math.random;
  for (let attempt = 0; attempt < 50; attempt++) {
    const perm = genPermutation(size, rand);
    if (!perm) continue;
    const regions = buildRegions(size, perm, rand);
    if (regions.flat().some((x) => x === -1)) continue;
    return { size, regions, solution: perm };
  }
  throw new Error('Gagal membangkitkan puzzle Queens');
}

/** Puzzle harian: seed dari tanggal UTC (YYYY-MM-DD), deterministik. */
export function dailySeed(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `queens-daily-${y}-${m}-${d}`;
}

export function generateDailyQueensPuzzle(size: number, date = new Date()): QueensPuzzle {
  return generateQueensPuzzle(size, dailySeed(date));
}
