/**
 * Generator puzzle Zip.
 * 1. Bangun satu Hamiltonian path acak menutupi seluruh grid (greedy Warnsdorff
 *    — pilih tetangga dengan langkah lanjutan paling sedikit — dengan fallback
 *    DFS backtracking).
 * 2. Pasang nomor: 1 di awal path, angka tertinggi di akhir, plus sejumlah angka
 *    perantara di posisi acak sepanjang path (jumlahnya = `givens` per level).
 * 3. Verifikasi UNIK dengan solver (cap 2 solusi). Bila tidak unik, tambah satu
 *    angka lagi di tengah celah terbesar dan cek ulang (maks 4 tambahan);
 *    bila masih tidak unik, bangun path baru. Anggaran waktu < 2 detik.
 */

import { seededRandom, shuffled } from '../tango/tango-solver';
import { countZipCompletions, zipNeighbors, ZipCell } from './zip-solver';

export interface ZipPuzzle {
  size: number;
  /** numbers[r][c] = nomor petunjuk (0 = tanpa nomor). */
  clues: number[][];
  /** Jalur solusi lengkap, urut dari angka 1 sampai angka tertinggi. */
  solution: ZipCell[];
  maxNumber: number;
  clueCount: number;
}

function warnsdorffWalk(n: number, start: ZipCell, rand: () => number): ZipCell[] {
  const visited: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
  const path: ZipCell[] = [start];
  visited[start[0]][start[1]] = true;
  while (path.length < n * n) {
    const [r, c] = path[path.length - 1];
    const cands = zipNeighbors(r, c, n).filter(([rr, cc]) => !visited[rr][cc]);
    if (cands.length === 0) break;
    const scored = shuffled(cands, rand).map(([rr, cc]) => ({
      cell: [rr, cc] as ZipCell,
      onward: zipNeighbors(rr, cc, n).filter(([a, b]) => !visited[a][b]).length,
    }));
    scored.sort((a, b) => a.onward - b.onward);
    const next = scored[0].cell;
    visited[next[0]][next[1]] = true;
    path.push(next);
  }
  return path;
}

function dfsHamiltonian(n: number, rand: () => number, nodeBudget = 60000): ZipCell[] | null {
  const visited: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
  const path: ZipCell[] = [];
  const start: ZipCell = [Math.floor(rand() * n), Math.floor(rand() * n)];
  let nodes = 0;
  let aborted = false;

  const onward = (r: number, c: number): number =>
    zipNeighbors(r, c, n).filter(([a, b]) => !visited[a][b]).length;

  function dfs(r: number, c: number): boolean {
    if (aborted) return false;
    if (++nodes > nodeBudget) { aborted = true; return false; }
    visited[r][c] = true;
    path.push([r, c]);
    if (path.length === n * n) return true;
    const cands = shuffled(
      zipNeighbors(r, c, n).filter(([rr, cc]) => !visited[rr][cc]),
      rand,
    );
    cands.sort((a, b) => onward(a[0], a[1]) - onward(b[0], b[1]));
    for (const [rr, cc] of cands) if (dfs(rr, cc)) return true;
    visited[r][c] = false;
    path.pop();
    return false;
  }

  return dfs(start[0], start[1]) ? path : null;
}

function randomHamiltonianPath(n: number, rand: () => number): ZipCell[] | null {
  for (let i = 0; i < 200; i++) {
    const start: ZipCell = [Math.floor(rand() * n), Math.floor(rand() * n)];
    const p = warnsdorffWalk(n, start, rand);
    if (p.length === n * n) return p;
  }
  return dfsHamiltonian(n, rand);
}

/** Pilih `count` posisi angka perantara (indeks path), tersebar dengan jarak min. 3. */
function pickIntermediateIndices(total: number, count: number, rand: () => number): number[] {
  // Hindari nomor 2 dan total-1 (terlalu dekat dengan ujung) agar puzzle lebih menarik.
  const candidates = shuffled(
    Array.from({ length: total - 4 }, (_, i) => i + 2),
    rand,
  );
  const picked: number[] = [];
  for (let gap = 3; gap >= 1 && picked.length < count; gap--) {
    for (const idx of candidates) {
      if (picked.length >= count) break;
      if (picked.includes(idx)) continue;
      if ([0, total - 1, ...picked].every((p) => Math.abs(p - idx) >= gap)) picked.push(idx);
    }
  }
  return picked.sort((a, b) => a - b);
}

/** Indeks path di tengah celah bernomor terbesar (untuk tambahan angka). */
function pickExtraIndex(total: number, numbered: Set<number>, rand: () => number): number {
  const sorted = [0, ...[...numbered].sort((a, b) => a - b), total - 1];
  let bestGap = -1, bestIdx = -1;
  for (let i = 0; i + 1 < sorted.length; i++) {
    const gap = sorted[i + 1] - sorted[i];
    if (gap > bestGap) {
      bestGap = gap;
      bestIdx = Math.floor((sorted[i] + sorted[i + 1]) / 2);
    }
  }
  if (bestIdx <= 0 || bestIdx >= total - 1 || numbered.has(bestIdx)) return -1;
  void rand;
  return bestIdx;
}

function buildClues(size: number, path: ZipCell[], indices: number[]): number[][] {
  const clues: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  const total = size * size;
  const [sr, sc] = path[0];
  clues[sr][sc] = 1;
  const [er, ec] = path[total - 1];
  clues[er][ec] = total;
  for (const idx of indices) {
    const [r, c] = path[idx];
    clues[r][c] = idx + 1;
  }
  return clues;
}

export function generateZipPuzzle(
  size: number,
  intermediates: number,
  seed?: string,
): ZipPuzzle {
  const rand = seed ? seededRandom(seed) : Math.random;
  const deadline = Date.now() + 1800; // anggaran < 2 detik
  const total = size * size;

  for (let attempt = 0; attempt < 12; attempt++) {
    if (Date.now() > deadline) break;
    const path = randomHamiltonianPath(size, rand);
    if (!path) continue;

    const indices = pickIntermediateIndices(total, intermediates, rand);
    const clues = buildClues(size, path, indices);
    const numbered = new Set<number>([0, total - 1, ...indices]);
    let clueCount = indices.length + 2;

    if (countZipCompletions(clues, [], 2).count === 1) {
      return { size, clues, solution: path, maxNumber: total, clueCount };
    }
    // Tambah angka satu per satu sampai unik (maks 4 tambahan).
    for (let extra = 0; extra < 4; extra++) {
      if (Date.now() > deadline) break;
      const idx = pickExtraIndex(total, numbered, rand);
      if (idx === -1) break;
      const [r, c] = path[idx];
      clues[r][c] = idx + 1;
      numbered.add(idx);
      clueCount++;
      if (countZipCompletions(clues, [], 2).count === 1) {
        return { size, clues, solution: path, maxNumber: total, clueCount };
      }
    }
  }
  throw new Error('Gagal membangkitkan puzzle Zip');
}

/** Puzzle harian: seed dari tanggal UTC (YYYY-MM-DD), deterministik. */
export function dailySeed(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `zip-daily-${y}-${m}-${d}`;
}

export function generateDailyZipPuzzle(
  size: number,
  intermediates: number,
  date = new Date(),
): ZipPuzzle {
  return generateZipPuzzle(size, intermediates, dailySeed(date));
}
