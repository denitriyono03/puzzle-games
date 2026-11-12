/**
 * Solver Tango 6x6 (Sun & Moon).
 * Nilai sel: 0 = kosong, 1 = Matahari (☀️), 2 = Bulan (🌙).
 * Aturan: tiap baris/kolom tepat 3 matahari + 3 bulan, maks 2 simbol
 * sama berurutan, dan semua constraint "=" / "×" antar sel bertetangga
 * harus dipenuhi.
 */

export type CellValue = 0 | 1 | 2;
export type ConstraintType = 'eq' | 'neq';

export interface Constraint {
  r1: number; c1: number;
  r2: number; c2: number;
  type: ConstraintType;
}

export const SIZE = 6;
export const SUN: CellValue = 1;
export const MOON: CellValue = 2;

/** PRNG deterministik (mulberry32) dari string seed — dipakai puzzle harian. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Cek apakah menaruh `v` di (r,c) melanggar aturan baris/kolom (tanpa constraint). */
export function canPlace(board: CellValue[][], r: number, c: number, v: CellValue): boolean {
  const n = board.length;
  // Maks 2 simbol sama berurutan (cek 2 sel ke kiri/atas dan pola tengah).
  for (const [dr, dc] of [[0, 1], [1, 0]] as const) {
    let run = 1;
    for (const s of [-1, 1]) {
      let rr = r + dr * s, cc = c + dc * s;
      while (rr >= 0 && rr < n && cc >= 0 && cc < n && board[rr][cc] === v) {
        run++;
        rr += dr * s; cc += dc * s;
      }
    }
    if (run > 2) return false;
  }
  // Tiap baris/kolom maks 3 simbol yang sama.
  let rowCount = 0, colCount = 0;
  for (let i = 0; i < n; i++) {
    if (board[r][i] === v) rowCount++;
    if (board[i][c] === v) colCount++;
  }
  return rowCount < n / 2 && colCount < n / 2;
}

function constraintOk(board: CellValue[][], cons: Constraint[], r: number, c: number): boolean {
  for (const k of cons) {
    const involves = (k.r1 === r && k.c1 === c) || (k.r2 === r && k.c2 === c);
    if (!involves) continue;
    const a = board[k.r1][k.c1], b = board[k.r2][k.c2];
    if (a === 0 || b === 0) continue;
    if (k.type === 'eq' && a !== b) return false;
    if (k.type === 'neq' && a === b) return false;
  }
  return true;
}

/** Cari sel kosong pertama (row-major). */
function findEmpty(board: CellValue[][]): [number, number] | null {
  for (let r = 0; r < board.length; r++)
    for (let c = 0; c < board.length; c++)
      if (board[r][c] === 0) return [r, c];
  return null;
}

/**
 * Hitung jumlah solusi (dibatasi `cap`) dari papan parsial + constraints.
 * Mengembalikan jumlah solusi hingga cap (mis. cap=2 untuk uji keunikan).
 */
export function countSolutions(
  givens: CellValue[][],
  constraints: Constraint[],
  cap = 2,
): number {
  const board = givens.map((row) => [...row]);
  let count = 0;

  function backtrack(): void {
    if (count >= cap) return;
    const empty = findEmpty(board);
    if (!empty) {
      // Papan penuh: tiap baris/kolom otomatis 3+3 karena canPlace membatasi <=3
      // dan total 6 sel — valid hanya bila tiap simbol tepat 3.
      for (let i = 0; i < board.length; i++) {
        let suns = 0;
        for (let j = 0; j < board.length; j++) if (board[i][j] === SUN) suns++;
        if (suns !== board.length / 2) return;
        suns = 0;
        for (let j = 0; j < board.length; j++) if (board[j][i] === SUN) suns++;
        if (suns !== board.length / 2) return;
      }
      count++;
      return;
    }
    const [r, c] = empty;
    for (const v of [SUN, MOON] as CellValue[]) {
      if (!canPlace(board, r, c, v)) continue;
      board[r][c] = v;
      if (constraintOk(board, constraints, r, c)) backtrack();
      board[r][c] = 0;
      if (count >= cap) return;
    }
  }

  backtrack();
  return count;
}

/** Cari satu solusi (atau null bila tak ada). */
export function solveOne(
  givens: CellValue[][],
  constraints: Constraint[],
): CellValue[][] | null {
  const board = givens.map((row) => [...row]);
  let found: CellValue[][] | null = null;

  function backtrack(): boolean {
    const empty = findEmpty(board);
    if (!empty) {
      for (let i = 0; i < board.length; i++) {
        let suns = 0;
        for (let j = 0; j < board.length; j++) if (board[i][j] === SUN) suns++;
        if (suns !== board.length / 2) return false;
        suns = 0;
        for (let j = 0; j < board.length; j++) if (board[j][i] === SUN) suns++;
        if (suns !== board.length / 2) return false;
      }
      found = board.map((row) => [...row]);
      return true;
    }
    const [r, c] = empty;
    for (const v of [SUN, MOON] as CellValue[]) {
      if (!canPlace(board, r, c, v)) continue;
      board[r][c] = v;
      if (constraintOk(board, constraints, r, c) && backtrack()) return true;
      board[r][c] = 0;
    }
    return false;
  }

  backtrack();
  return found;
}

/** Validasi papan penuh: aturan + constraints. Kembalikan daftar pesan masalah. */
export function validateBoard(
  board: CellValue[][],
  constraints: Constraint[],
): { ok: boolean; problems: string[]; badCells: Set<string> } {
  const n = board.length;
  const problems: string[] = [];
  const badCells = new Set<string>();
  const key = (r: number, c: number) => `${r},${c}`;

  for (let i = 0; i < n; i++) {
    for (const axis of ['row', 'col'] as const) {
      const line = axis === 'row' ? board[i] : board.map((row) => row[i]);
      let suns = 0, moons = 0;
      line.forEach((v) => { if (v === SUN) suns++; else if (v === MOON) moons++; });
      if (suns > n / 2 || moons > n / 2) {
        problems.push(`${axis === 'row' ? 'Baris' : 'Kolom'} ${i + 1} punya lebih dari ${n / 2} simbol yang sama`);
        line.forEach((_, j) => badCells.add(axis === 'row' ? key(i, j) : key(j, i)));
      }
      for (let j = 0; j + 2 < n; j++) {
        if (line[j] !== 0 && line[j] === line[j + 1] && line[j] === line[j + 2]) {
          problems.push(`${axis === 'row' ? 'Baris' : 'Kolom'} ${i + 1}: tiga simbol sama berurutan`);
          for (let k = j; k < j + 3; k++) badCells.add(axis === 'row' ? key(i, k) : key(k, i));
        }
      }
    }
  }
  for (const k of constraints) {
    const a = board[k.r1][k.c1], b = board[k.r2][k.c2];
    if (a === 0 || b === 0) continue;
    const ok = k.type === 'eq' ? a === b : a !== b;
    if (!ok) {
      problems.push(`Tanda "${k.type === 'eq' ? '=' : '×'}" antara (${k.r1 + 1},${k.c1 + 1}) dan (${k.r2 + 1},${k.c2 + 1}) dilanggar`);
      badCells.add(key(k.r1, k.c1));
      badCells.add(key(k.r2, k.c2));
    }
  }
  // Deduplikasi pesan.
  return { ok: problems.length === 0, problems: [...new Set(problems)], badCells };
}

/** Cek solusi penuh mematuhi semua aturan + constraints. */
export function isValidSolution(board: CellValue[][], constraints: Constraint[]): boolean {
  return validateBoard(board, constraints).ok &&
    board.every((row) => row.every((v) => v !== 0));
}
