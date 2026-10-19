import type { Puzzle, PuzzleItem } from '../types';
import { seededRandom } from './array';

/** Puzzle files may hold more rows than this; each play shows a random handful. */
export const WORDS_PER_PUZZLE = 5;

/** FNV-1a: turns any string into a stable 32-bit seed. */
export function hashSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Rough pixel width of one chunk tile (56px minimum, ~10px per letter plus padding) and the gap between tiles. */
const tileWidth = (chunk: string) => Math.max(56, chunk.length * 10 + 20);
const TILE_GAP = 7;
/** Usable tray width on a small phone (360px screen minus page and tray padding). */
const TRAY_WIDTH = 290;
/** The tray gets harder to use the taller it grows: aim for 2 rows, never more than 3. */
const IDEAL_ROWS = 2;
const MAX_ROWS = 3;
const MIN_WORDS = 3;

/**
 * Tray rows these words' chunks need. The tray shuffles its tiles, so wrap them in a few shuffled
 * orders and take the worst case.
 */
function trayRows(items: PuzzleItem[], random: () => number): number {
  const widths = items.flatMap((it) => it.chunks.map(tileWidth));
  let worst = 1;
  for (let trial = 0; trial < 6; trial++) {
    const w = [...widths];
    for (let i = w.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [w[i], w[j]] = [w[j], w[i]];
    }
    let rows = 1;
    let x = 0;
    for (const width of w) {
      if (x > 0 && x + TILE_GAP + width > TRAY_WIDTH) {
        rows++;
        x = width;
      } else {
        x += (x > 0 ? TILE_GAP : 0) + width;
      }
    }
    worst = Math.max(worst, rows);
  }
  return worst;
}

/**
 * Same key, same words: a seeded pick of up to `count` rows, kept in file order.
 * It takes the first candidate whose chunks fit in 2 tray rows; failing that the most compact one,
 * dropping to fewer words (down to 3) if that is what it takes to stay within 3 rows.
 */
export function pickItems(items: PuzzleItem[], key: string, count = WORDS_PER_PUZZLE): PuzzleItem[] {
  const random = seededRandom(hashSeed(key));
  let best = items;
  let bestScore = Infinity;
  for (let size = Math.min(count, items.length); size >= Math.min(MIN_WORDS, items.length); size--) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const order = items.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const picked = order
        .slice(0, size)
        .sort((x, y) => x - y)
        .map((i) => items[i]);
      const rows = trayRows(picked, random);
      if (rows <= IDEAL_ROWS) return picked;
      // prefer fewer rows, then more words
      const score = rows * 100 - size;
      if (score < bestScore) {
        best = picked;
        bestScore = score;
      }
      if (size === items.length) break; // nothing to choose between: it is the whole puzzle
    }
    if (bestScore < (MAX_ROWS + 1) * 100 - count) return best; // a set that fits 3 rows is good enough
  }
  return best;
}

export class PuzzleError extends Error {}

function isChunkList(v: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.every((c) => typeof c === 'string' && c.length > 0);
}

/**
 * Validates puzzle JSON. Accepts `{ theme, puzzle: [...] }` or a bare array.
 * Each row needs `chunks` plus a display text in `clue` (or `word`).
 */
export function parsePuzzle(data: unknown, source: string): Puzzle {
  const root = (Array.isArray(data) ? { puzzle: data } : data) as
    | { theme?: unknown; puzzle?: unknown }
    | null;

  if (!root || typeof root !== 'object' || !Array.isArray(root.puzzle) || root.puzzle.length === 0) {
    throw new PuzzleError(`${source}: expected a non-empty "puzzle" array.`);
  }

  const items = root.puzzle.map((raw: Record<string, unknown>, i: number): PuzzleItem => {
    const label =
      typeof raw?.clue === 'string' ? raw.clue : typeof raw?.word === 'string' ? raw.word : null;
    if (!label) throw new PuzzleError(`${source}: row ${i + 1} has no "clue" (or "word") text.`);
    if (!isChunkList(raw.chunks)) {
      throw new PuzzleError(`${source}: row ${i + 1} needs a non-empty "chunks" array of strings.`);
    }
    return { label, chunks: raw.chunks };
  });

  return { theme: typeof root.theme === 'string' ? root.theme : null, items };
}

/**
 * `key` decides which rows a long puzzle shows: every player using the same key sees the same words
 * (daily: file + day, challenge: its code). Defaults to the file name.
 * `folder` is 'puzzles' (daily + archive) or 'challenges' (the Challenge pool), both under public/. */
export async function fetchPuzzle(
  file: string,
  signal?: AbortSignal,
  folder: 'puzzles' | 'challenges' = 'puzzles',
  key: string = file,
): Promise<Puzzle> {
  const url = `${import.meta.env.BASE_URL}${folder}/${file}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new PuzzleError(`Could not load ${file} (HTTP ${res.status}).`);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new PuzzleError(`${file} is missing or is not valid JSON. It should live in public/${folder}/.`);
  }
  const puzzle = parsePuzzle(data, file);
  return { ...puzzle, items: pickItems(puzzle.items, `${folder}/${file}/${key}`) };
}
