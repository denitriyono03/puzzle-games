/**
 * Solver Zip (ala LinkedIn).
 * Puzzle: grid N×N dengan beberapa sel bernomor. Satu jalur kontinu mulai dari 1,
 * melewati 2, 3, ... secara berurutan, berakhir di angka tertinggi, bergerak
 * ortogonal (atas/bawah/kiri/kanan), tanpa mengunjungi sel dua kali, dan mengisi
 * SEMUA sel grid tepat satu kali (Hamiltonian path).
 *
 * `numbers[r][c]` = nomor petunjuk di sel itu (0 = tanpa nomor).
 */

export type ZipCell = [number, number];

export function zipNeighbors(r: number, c: number, n: number): ZipCell[] {
  const out: ZipCell[] = [];
  if (r > 0) out.push([r - 1, c]);
  if (r + 1 < n) out.push([r + 1, c]);
  if (c > 0) out.push([r, c - 1]);
  if (c + 1 < n) out.push([r, c + 1]);
  return out;
}

/** Peta nomor petunjuk -> posisi sel. */
export function zipCluePositions(numbers: number[][]): Map<number, ZipCell> {
  const m = new Map<number, ZipCell>();
  for (let r = 0; r < numbers.length; r++)
    for (let c = 0; c < numbers[r].length; c++)
      if (numbers[r][c] > 0) m.set(numbers[r][c], [r, c]);
  return m;
}

export interface ZipSearchResult {
  /** Jumlah solusi yang ditemukan (dibatasi `cap`). */
  count: number;
  /** Satu solusi penuh (bila `recordFirst` dan ada solusi). */
  first: ZipCell[] | null;
  /** True bila pencarian dihentikan anggaran node (hasil tidak bisa dipercaya). */
  aborted: boolean;
}

interface SearchOpts {
  cap: number;
  nodeBudget: number;
  recordFirst: boolean;
}

function searchZip(numbers: number[][], prefix: ZipCell[], opts: SearchOpts): ZipSearchResult {
  const n = numbers.length;
  const total = n * n;
  const clues = zipCluePositions(numbers);
  const visited: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));

  // Validasi awalan: langkah ortogonal, tanpa sel ganda, nomor petunjuk cocok
  // dengan urutan langkah, dan awalan harus dimulai dari sel bernomor 1.
  for (let i = 0; i < prefix.length; i++) {
    const [r, c] = prefix[i];
    if (r < 0 || r >= n || c < 0 || c >= n || visited[r][c]) {
      return { count: 0, first: null, aborted: false };
    }
    if (i > 0) {
      const [pr, pc] = prefix[i - 1];
      if (Math.abs(pr - r) + Math.abs(pc - c) !== 1) {
        return { count: 0, first: null, aborted: false };
      }
    }
    const clue = numbers[r][c];
    if (clue > 0 && clue !== i + 1) return { count: 0, first: null, aborted: false };
    visited[r][c] = true;
  }
  if (prefix.length > 0) {
    const start = clues.get(1);
    if (!start || prefix[0][0] !== start[0] || prefix[0][1] !== start[1]) {
      return { count: 0, first: null, aborted: false };
    }
  }

  const path: ZipCell[] = [...prefix];
  let count = 0;
  let first: ZipCell[] | null = null;
  let nodes = 0;
  let aborted = false;

  function nextClueAfter(step: number): { num: number; at: ZipCell } | null {
    for (let m = step + 1; m <= total; m++) {
      const at = clues.get(m);
      if (at) return { num: m, at };
    }
    return null;
  }

  /** Cek sel yang belum dikunjungi masih membentuk satu komponen terhubung. */
  function connectedAfter(placed: number): boolean {
    const remaining = total - placed;
    if (remaining === 0) return true;
    let sr = -1, sc = -1;
    outer: for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        if (!visited[r][c]) { sr = r; sc = c; break outer; }
    if (sr === -1) return remaining === 0;
    let seen = 0;
    const stack: ZipCell[] = [[sr, sc]];
    const seenGrid: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
    seenGrid[sr][sc] = true;
    while (stack.length) {
      const [r, c] = stack.pop()!;
      seen++;
      for (const [rr, cc] of zipNeighbors(r, c, n)) {
        if (!visited[rr][cc] && !seenGrid[rr][cc]) {
          seenGrid[rr][cc] = true;
          stack.push([rr, cc]);
        }
      }
    }
    return seen === remaining;
  }

  function dfs(): void {
    if (aborted || count >= opts.cap) return;
    if (++nodes > opts.nodeBudget) { aborted = true; return; }
    const k = path.length; // sel sudah terisi; nomor berikutnya = k + 1
    if (k === total) {
      count++;
      if (opts.recordFirst && !first) first = path.map(([r, c]) => [r, c] as ZipCell);
      return;
    }
    const [hr, hc] = path[path.length - 1];
    const nextNum = k + 1;
    const forced = clues.get(nextNum);

    let candidates: ZipCell[];
    if (forced) {
      // Angka berikutnya sudah ditentukan posisinya: harus bersebelahan.
      const [fr, fc] = forced;
      if (visited[fr][fc] || Math.abs(fr - hr) + Math.abs(fc - hc) !== 1) return;
      candidates = [forced];
    } else {
      // Tetangga belum dikunjungi; sel bernomor tidak boleh dimasuki sebelum gilirannya.
      candidates = zipNeighbors(hr, hc, n).filter(
        ([rr, cc]) => !visited[rr][cc] && numbers[rr][cc] === 0,
      );
    }

    for (const [r, c] of candidates) {
      visited[r][c] = true;
      path.push([r, c]);
      let ok = connectedAfter(k + 1);
      if (ok) {
        // Pruning paritas/jarak ke angka petunjuk berikutnya.
        const nxt = nextClueAfter(k + 1);
        if (nxt) {
          const dist = Math.abs(nxt.at[0] - r) + Math.abs(nxt.at[1] - c);
          const stepsLeft = nxt.num - (k + 1);
          if (dist > stepsLeft || (stepsLeft - dist) % 2 !== 0) ok = false;
        }
      }
      if (ok) dfs();
      path.pop();
      visited[r][c] = false;
      if (aborted || count >= opts.cap) return;
    }
  }

  if (path.length === 0) {
    // Tanpa awalan: mulai dari sel bernomor 1.
    const start = clues.get(1);
    if (!start) return { count: 0, first: null, aborted: false };
    visited[start[0]][start[1]] = true;
    path.push(start);
  }
  dfs();
  return { count, first, aborted };
}

/**
 * Hitung jumlah penyelesaian (dibatasi `cap`) dari petunjuk + awalan jalur
 * yang sudah digambar. Dipakai untuk uji keunikan generator dan tombol Periksa.
 */
export function countZipCompletions(
  numbers: number[][],
  prefix: ZipCell[] = [],
  cap = 2,
): { count: number; aborted: boolean } {
  const r = searchZip(numbers, prefix, { cap, nodeBudget: 250000, recordFirst: false });
  return { count: r.count, aborted: r.aborted };
}

/** Cari satu solusi penuh (atau null bila tidak ada). */
export function findZipSolution(numbers: number[][]): ZipCell[] | null {
  const r = searchZip(numbers, [], { cap: 1, nodeBudget: 500000, recordFirst: true });
  return r.first;
}

/** Nomor petunjuk terkecil yang selnya belum ada di `path` (0 bila semua sudah dilewati). */
export function nextUnvisitedClue(numbers: number[][], path: ZipCell[]): number {
  const inPath = new Set(path.map(([r, c]) => `${r},${c}`));
  const clues = zipCluePositions(numbers);
  for (let m = 1; m <= numbers.length * numbers.length; m++) {
    const at = clues.get(m);
    if (at && !inPath.has(`${at[0]},${at[1]}`)) return m;
  }
  return 0;
}
