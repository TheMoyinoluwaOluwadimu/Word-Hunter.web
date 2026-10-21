import type { Puzzle, PuzzleItem, WordPool } from '../types';
import { seededRandom } from './array';
import { getSeen, resetSeen } from './seen';

export class PuzzleError extends Error {}

/** Every play shows this many words, picked from the theme's bigger word bank. */
export const WORDS_PER_PUZZLE = 5;

// A theme file is a word bank. Each word sits in one lane, so the three play types never share a word:
//   daily      the Word of the Day, taken in a fixed shuffled order with no repeats until the lane is used up
//   challenge  the spinner (friend challenges)
//   practice   extra words only Practice uses, mixed with daily words that are already in the past
const POOLS: WordPool[] = ['daily', 'challenge', 'practice'];

/* ---------- small helpers ---------- */

/** FNV-1a: turns any string into a stable 32-bit seed. */
export function hashSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shuffleWith<T>(input: readonly T[], random: () => number): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- how tall the tray gets ---------- */

/** Rough pixel width of one chunk tile (56px minimum, ~10px per letter plus padding) and the gap between tiles. */
const tileWidth = (chunk: string) => Math.max(56, chunk.length * 10 + 20);
const TILE_GAP = 7;
/** Usable tray width on a small phone (360px screen minus page and tray padding). */
const TRAY_WIDTH = 290;
/** The tray gets harder to use the taller it grows: aim for 2 rows. */
const IDEAL_ROWS = 2;
/** Most tiles a draw may have before the tray needs a fourth row on a small phone. */
const MAX_TILES = 12;

/**
 * Tray rows these words' chunks need. The tray shuffles its tiles, so wrap them in a few shuffled
 * orders and take the worst case.
 */
function trayRows(items: PuzzleItem[], random: () => number): number {
  const widths = items.flatMap((it) => it.chunks.map(tileWidth));
  let worst = 1;
  for (let trial = 0; trial < 6; trial++) {
    const w = shuffleWith(widths, random);
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

/* ---------- reading a theme file ---------- */

function isChunkList(v: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.every((c) => typeof c === 'string' && c.length > 0);
}

/**
 * Validates a theme file. Accepts `{ theme, puzzle: [...] }` or a bare array.
 * Each row needs `chunks` plus a display text in `clue` (or `word`); `answer` and `pool` are optional
 * (a row with no pool counts as a daily word).
 */
export function parsePuzzle(data: unknown, source: string): Puzzle {
  const root = (Array.isArray(data) ? { puzzle: data } : data) as { theme?: unknown; puzzle?: unknown } | null;

  if (!root || typeof root !== 'object' || !Array.isArray(root.puzzle) || root.puzzle.length === 0) {
    throw new PuzzleError(`${source}: expected a non-empty "puzzle" array.`);
  }

  const items = root.puzzle.map((raw: Record<string, unknown>, i: number): PuzzleItem => {
    const label = typeof raw?.clue === 'string' ? raw.clue : typeof raw?.word === 'string' ? raw.word : null;
    if (!label) throw new PuzzleError(`${source}: row ${i + 1} has no "clue" (or "word") text.`);
    if (!isChunkList(raw.chunks)) {
      throw new PuzzleError(`${source}: row ${i + 1} needs a non-empty "chunks" array of strings.`);
    }
    const pool = POOLS.includes(raw.pool as WordPool) ? (raw.pool as WordPool) : 'daily';
    const id = (typeof raw.answer === 'string' && raw.answer ? raw.answer : raw.chunks.join('')).toLowerCase();
    return { id, label, chunks: raw.chunks, pool };
  });

  return { theme: typeof root.theme === 'string' ? root.theme : null, items };
}

const banks = new Map<string, Promise<Puzzle>>();

/** The whole word bank of a theme file, fetched once per page load. */
export function fetchBank(file: string): Promise<Puzzle> {
  let cached = banks.get(file);
  if (!cached) {
    cached = (async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}puzzles/${file}`);
      if (!res.ok) throw new PuzzleError(`Could not load ${file} (HTTP ${res.status}).`);
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        throw new PuzzleError(`${file} is missing or is not valid JSON. It should live in public/puzzles/.`);
      }
      return parsePuzzle(data, file);
    })().catch((e) => {
      banks.delete(file); // let a later try go again
      throw e;
    });
    banks.set(file, cached);
  }
  return cached;
}

export const laneOf = (bank: Puzzle, pool: WordPool): PuzzleItem[] => bank.items.filter((i) => i.pool === pool);

/* ---------- picking words ---------- */

interface Group {
  items: PuzzleItem[];
  take: number;
}

/**
 * Draws `take` words from each group. Words the player has not seen come first, then it looks for the
 * draw whose chunks fit the shortest tray. The same key always gives the same words.
 */
function pickGroups(groups: Group[], key: string, seen: Set<string> = new Set()): PuzzleItem[] {
  const random = seededRandom(hashSeed(key));
  let best: PuzzleItem[] = [];
  let bestScore = Infinity;
  for (let attempt = 0; attempt < 200; attempt++) {
    const picked: PuzzleItem[] = [];
    for (const g of groups) {
      const order = shuffleWith(g.items, random);
      // every other draw puts unseen words first; the rest are free, so a tall tray can still be avoided
      if (attempt % 2 === 0) order.sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)));
      picked.push(...order.slice(0, g.take));
    }
    const rows = trayRows(picked, random);
    const seenCount = picked.filter((i) => seen.has(i.id)).length;
    const tiles = picked.reduce((n, i) => n + i.chunks.length, 0);
    // a tray taller than three rows is the worst outcome, then words already seen, then the shortest tray
    // (measured on a 360px phone: up to 12 tiles fit three rows, 13 spill into a fourth)
    const score = (Math.max(0, rows - 3) + Math.max(0, tiles - MAX_TILES)) * 10000 + seenCount * 1000 + rows * 100 + tiles;
    if (score < bestScore) {
      best = picked;
      bestScore = score;
    }
    if (seenCount === 0 && rows <= 3 && tiles <= MAX_TILES && attempt >= 60) break;
  }
  return shuffleWith(best, seededRandom(hashSeed(`${key}/order`)));
}

/* ---------- daily lane ---------- */

/** The daily words, trimmed to a whole number of 5-word sets so a set never straddles a reshuffle. */
function dailyLane(bank: Puzzle): PuzzleItem[] {
  const lane = laneOf(bank, 'daily');
  const whole = Math.floor(lane.length / WORDS_PER_PUZZLE) * WORDS_PER_PUZZLE;
  return whole > 0 ? lane.slice(0, whole) : lane;
}

const passCache = new Map<string, number[]>();

/**
 * One full pass over the daily lane: every word exactly once, in a fixed shuffled order that is picked so the
 * 5-word sets it makes keep the tray short. Pass 0 is the first trip through the lane, pass 1 the second, and so on.
 */
function dailyPass(file: string, lane: PuzzleItem[], pass: number): number[] {
  const cacheKey = `${file}/${pass}/${lane.map((i) => i.id).join(',')}`;
  const hit = passCache.get(cacheKey);
  if (hit) return hit;

  const groups = Math.max(1, Math.floor(lane.length / WORDS_PER_PUZZLE));
  const idx = lane.map((_, i) => i);
  let best = idx;
  let bestCost = Infinity;
  for (let attempt = 0; attempt < 80; attempt++) {
    const random = seededRandom(hashSeed(`${file}/pass${pass}/try${attempt}`));
    const order = shuffleWith(idx, random);
    let cost = 0;
    for (let g = 0; g < groups; g++) {
      const set = order.slice(g * WORDS_PER_PUZZLE, (g + 1) * WORDS_PER_PUZZLE).map((i) => lane[i]);
      cost += Math.max(0, trayRows(set, random) - IDEAL_ROWS);
    }
    if (cost < bestCost) {
      best = order;
      bestCost = cost;
    }
    if (cost === 0) break;
  }
  passCache.set(cacheKey, best);
  return best;
}

/** The words of a theme's `appearance`-th turn as the Word of the Day (0 = first time it came up). */
export function dailyWords(file: string, bank: Puzzle, appearance: number): PuzzleItem[] {
  const lane = dailyLane(bank);
  if (lane.length <= WORDS_PER_PUZZLE) return lane;
  const groups = lane.length / WORDS_PER_PUZZLE;
  const pass = Math.floor(appearance / groups);
  const g = appearance % groups;
  const order = dailyPass(file, lane, pass);
  return order.slice(g * WORDS_PER_PUZZLE, (g + 1) * WORDS_PER_PUZZLE).map((i) => lane[i]);
}

/* ---------- challenge lane ---------- */

/** The words of a challenge: decided entirely by its seed, so everyone who opens it gets the same five. */
export function challengeWords(bank: Puzzle, seed: number): PuzzleItem[] {
  const lane = laneOf(bank, 'challenge');
  return pickGroups([{ items: lane, take: Math.min(WORDS_PER_PUZZLE, lane.length) }], `challenge/${seed}`);
}

/**
 * Picks the seed for a new challenge: of a few dozen random seeds, the one whose five words overlap least
 * with what this player has already played. Starts the theme over once they have seen nearly all of it.
 */
export function chooseChallengeSeed(file: string, bank: Puzzle): number {
  const lane = laneOf(bank, 'challenge');
  let seen = getSeen('challenge', file);
  if (lane.filter((i) => !seen.has(i.id)).length < WORDS_PER_PUZZLE) {
    resetSeen('challenge', file);
    seen = new Set();
  }
  let bestSeed = 1 + Math.floor(Math.random() * 2147483646);
  let bestOverlap = Infinity;
  for (let n = 0; n < 30 && bestOverlap > 0; n++) {
    const seed = 1 + Math.floor(Math.random() * 2147483646);
    const overlap = challengeWords(bank, seed).filter((i) => seen.has(i.id)).length;
    if (overlap < bestOverlap) {
      bestSeed = seed;
      bestOverlap = overlap;
    }
  }
  return bestSeed;
}

/* ---------- practice ---------- */

/** Every daily word this theme has already shown, in the past turns given. Future words are never in here. */
function usedDailyWords(file: string, bank: Puzzle, appearances: number[]): PuzzleItem[] {
  const out = new Map<string, PuzzleItem>();
  for (const a of appearances) for (const item of dailyWords(file, bank, a)) out.set(item.id, item);
  return [...out.values()];
}

function practiceWords(file: string, bank: Puzzle, key: string, appearances: number[]): PuzzleItem[] {
  const own = laneOf(bank, 'practice');
  const used = usedDailyWords(file, bank, appearances);
  let seen = getSeen('practice', file);
  if ([...own, ...used].filter((i) => !seen.has(i.id)).length < WORDS_PER_PUZZLE) {
    resetSeen('practice', file);
    seen = new Set();
  }
  // a mix: new practice-only words with a couple of past daily words
  let takeUsed = Math.min(2, used.length);
  const takeOwn = Math.min(own.length, WORDS_PER_PUZZLE - takeUsed);
  takeUsed = Math.min(used.length, WORDS_PER_PUZZLE - takeOwn);
  return pickGroups(
    [
      { items: own, take: takeOwn },
      { items: used, take: takeUsed },
    ],
    `practice/${file}/${key}`,
    seen,
  );
}

/* ---------- putting it together ---------- */

export type PuzzleSpec =
  | { mode: 'daily'; appearance: number }
  | { mode: 'practice'; key: string; pastAppearances: number[] }
  | { mode: 'challenge'; seed: number };

/** Turns a theme's word bank into the five words to play for the given play type. */
export function buildPuzzle(file: string, bank: Puzzle, spec: PuzzleSpec): Puzzle {
  let items: PuzzleItem[];
  if (spec.mode === 'daily') items = dailyWords(file, bank, spec.appearance);
  else if (spec.mode === 'challenge') items = challengeWords(bank, spec.seed);
  else items = practiceWords(file, bank, spec.key, spec.pastAppearances);
  if (items.length === 0) throw new PuzzleError(`${file} has no words for this kind of play. Check the "pool" tags.`);
  return { theme: bank.theme, items };
}
