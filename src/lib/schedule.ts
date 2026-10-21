import { LAUNCH_DATE } from '../config';
import { utcDate } from './storage';

// The daily theme is picked from the ordered puzzle list by UTC date, so every player
// gets the same one and the rollover matches the streak reset. No config to edit per day.

export interface PuzzleSchedule {
  /** Today's puzzle file. */
  daily: string;
  /** Puzzles that have already been "the daily", newest first. Today's is never in here. */
  archive: string[];
  /** How many turns today's theme has had as the daily before this one (0 the first time it comes up). */
  dailyAppearance: number;
  /** The turns a theme has already had as the daily, in the past. Today's turn is never in here. */
  pastAppearances: (file: string) => number[];
}

/** Whole UTC days since LAUNCH_DATE (0 on launch day, never negative). */
export function dayNumber(now: Date = new Date()): number {
  const today = Date.parse(`${utcDate(now)}T00:00:00Z`);
  const launch = Date.parse(`${LAUNCH_DATE}T00:00:00Z`);
  return Math.max(0, Math.round((today - launch) / 86_400_000));
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** `files` must be non-empty. The list cycles, so a long-running game never runs out. */
export function buildSchedule(files: string[], now: Date = new Date()): PuzzleSchedule {
  const day = dayNumber(now);
  const archive: string[] = [];
  for (let k = 1; k <= Math.min(day, files.length - 1); k++) archive.push(files[mod(day - k, files.length)]);
  const n = files.length;
  const pastAppearances = (file: string): number[] => {
    const at = files.indexOf(file);
    const out: number[] = [];
    // the theme sits on days at, at + n, at + 2n ...; only those before today have happened
    for (let d = at; at >= 0 && d < day; d += n) out.push((d - at) / n);
    return out;
  };
  return { daily: files[mod(day, n)], archive, dailyAppearance: Math.floor(day / n), pastAppearances };
}

let indexCache: Promise<string[]> | null = null;

/** The ordered theme list (public/puzzles/index.json): the daily schedule, and the pool the Challenge spinner draws from. */
export function fetchPuzzleFiles(): Promise<string[]> {
  if (!indexCache) {
    indexCache = (async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}puzzles/index.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Could not load the puzzle list (HTTP ${res.status}).`);
      const data = (await res.json()) as { files?: unknown };
      if (!Array.isArray(data.files) || data.files.length === 0 || !data.files.every((f) => typeof f === 'string')) {
        throw new Error('The puzzle list is empty or malformed.');
      }
      return data.files as string[];
    })().catch((e) => {
      indexCache = null; // let a later visit retry
      throw e;
    });
  }
  return indexCache;
}
