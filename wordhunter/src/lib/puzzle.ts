import type { Puzzle, PuzzleItem } from '../types';

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

export async function fetchPuzzle(file: string, signal?: AbortSignal): Promise<Puzzle> {
  const url = `${import.meta.env.BASE_URL}puzzles/${file}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new PuzzleError(`Could not load ${file} (HTTP ${res.status}).`);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new PuzzleError(`${file} is missing or is not valid JSON. It should live in public/puzzles/.`);
  }
  return parsePuzzle(data, file);
}
