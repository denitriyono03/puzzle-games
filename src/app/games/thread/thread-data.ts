/**
 * Data & logika Common Thread (port dari PuzzleVerse `src/games/thread.ts`).
 * Tebak kata/kategori yang menghubungkan keempat petunjuk.
 * Pencocokan jawaban: tidak peka huruf besar/kecil, mengabaikan spasi dan
 * tanda baca di ujung, dan menerima alias.
 *
 * CATATAN BAHASA: 15 puzzle kurasi ini berbahasa Inggris (sesuai aslinya di
 * PuzzleVerse); UI situs tetap Bahasa Indonesia dan halaman game memberi
 * tahu pemain bahwa petunjuk & jawaban dalam Bahasa Inggris.
 */

import { seededRandom } from '../tango/tango-solver';

export type ThreadDifficultyId = 'easy' | 'medium' | 'hard';

export interface ThreadDef {
  clues: string[];
  answer: string;
  aliases: string[];
  difficulty: ThreadDifficultyId;
}

export const THREAD_DEFS: ThreadDef[] = [
  { clues: ['Oak', 'Maple', 'Birch', 'Pine'], answer: 'Trees', aliases: ['tree'], difficulty: 'easy' },
  { clues: ['Red', 'Blue', 'Green', 'Yellow'], answer: 'Colours', aliases: ['colors', 'color', 'colour'], difficulty: 'easy' },
  { clues: ['Apple', 'Banana', 'Mango', 'Grape'], answer: 'Fruits', aliases: ['fruit'], difficulty: 'easy' },
  { clues: ['Carrot', 'Broccoli', 'Spinach', 'Potato'], answer: 'Vegetables', aliases: ['vegetable', 'veggies'], difficulty: 'easy' },
  { clues: ['Guitar', 'Piano', 'Violin', 'Drum'], answer: 'Musical Instruments', aliases: ['instruments', 'instrument'], difficulty: 'easy' },
  { clues: ['Mercury', 'Venus', 'Mars', 'Jupiter'], answer: 'Planets', aliases: ['planet'], difficulty: 'medium' },
  { clues: ['Shark', 'Dolphin', 'Octopus', 'Whale'], answer: 'Sea Animals', aliases: ['sea creatures', 'ocean animals', 'marine animals'], difficulty: 'medium' },
  { clues: ['Eagle', 'Penguin', 'Owl', 'Sparrow'], answer: 'Birds', aliases: ['bird'], difficulty: 'medium' },
  { clues: ['Doctor', 'Teacher', 'Chef', 'Pilot'], answer: 'Occupations', aliases: ['jobs', 'professions', 'occupation', 'job', 'profession'], difficulty: 'medium' },
  { clues: ['Car', 'Bicycle', 'Train', 'Boat'], answer: 'Vehicles', aliases: ['vehicle', 'transport', 'transportation'], difficulty: 'medium' },
  { clues: ['Egg', 'Toast', 'Cereal', 'Pancakes'], answer: 'Breakfast Foods', aliases: ['breakfast', 'breakfast food'], difficulty: 'hard' },
  { clues: ['Knife', 'Pan', 'Spoon', 'Oven'], answer: 'Kitchen Items', aliases: ['kitchen tools', 'kitchenware', 'cooking tools'], difficulty: 'hard' },
  { clues: ['Chess', 'Monopoly', 'Scrabble', 'Checkers'], answer: 'Board Games', aliases: ['board game'], difficulty: 'hard' },
  { clues: ['Ball', 'Moon', 'Orange', 'Coin'], answer: 'Round Things', aliases: ['things that are round', 'round objects'], difficulty: 'hard' },
  { clues: ['Book', 'Newspaper', 'Magazine', 'Letter'], answer: 'Reading Material', aliases: ['things to read', 'reading materials'], difficulty: 'hard' },
];

export interface ThreadPuzzle {
  clues: string[];
  answer: string;
  aliases: string[];
  difficulty: string;
}

export function normalizeAnswer(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
}

export function checkThreadAnswer(input: string, puzzle: ThreadPuzzle): boolean {
  const n = normalizeAnswer(input);
  return n === normalizeAnswer(puzzle.answer) || puzzle.aliases.map(normalizeAnswer).includes(n);
}

/** Pilih satu puzzle acak dari pool level itu (seed opsional untuk harian). */
export function generateThreadPuzzle(difficulty: string, seed?: string): ThreadPuzzle {
  const pool = THREAD_DEFS.filter((d) => d.difficulty === difficulty);
  if (!pool.length) throw new Error(`Tidak ada puzzle Common Thread untuk level ${difficulty}`);
  const rand = seed ? seededRandom(seed) : Math.random;
  const def = pool[Math.floor(rand() * pool.length)];
  return { clues: def.clues, answer: def.answer, aliases: def.aliases, difficulty };
}

/** Puzzle harian: seed dari tanggal UTC (YYYY-MM-DD), deterministik. */
export function dailySeed(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `thread-daily-${y}-${m}-${d}`;
}

export function generateDailyThreadPuzzle(date = new Date()): ThreadPuzzle {
  return generateThreadPuzzle('medium', dailySeed(date));
}
