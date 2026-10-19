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

/** Same key, same words: a seeded pick of `count` rows, kept in file order. Short puzzles pass through whole. */
export function pickItems(items: PuzzleItem[], key: string, count = WORDS_PER_PUZZLE): PuzzleItem[] {
  if (items.length <= count) return items;
  const random = seededRandom(hashSeed(key));
  const order = items.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order
    .slice(0, count)
    .sort((a, b) => a - b)
    .map((i) => items[i]);
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
