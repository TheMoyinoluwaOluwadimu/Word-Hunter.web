import { LAUNCH_DATE } from '../config';
import { utcDate } from './storage';

// The daily puzzle is picked from the ordered puzzle list by UTC date, so every player
// gets the same one and the rollover matches the streak reset. No config to edit per day.

export interface PuzzleSchedule {
  /** Today's puzzle file. */
  daily: string;
  /** Puzzles that have already been "the daily", newest first. Today's is never in here. */
  archive: string[];
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
  return { daily: files[mod(day, files.length)], archive };
}

const indexCache = new Map<string, Promise<string[]>>();

/** The ordered file list (index.json) of a puzzle folder, fetched once per page load. */
function fetchIndex(folder: 'puzzles' | 'challenges'): Promise<string[]> {
  let cached = indexCache.get(folder);
  if (!cached) {
    cached = (async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}${folder}/index.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Could not load the ${folder} list (HTTP ${res.status}).`);
      const data = (await res.json()) as { files?: unknown };
      if (!Array.isArray(data.files) || data.files.length === 0 || !data.files.every((f) => typeof f === 'string')) {
        throw new Error(`The ${folder} list is empty or malformed.`);
      }
      return data.files as string[];
    })().catch((e) => {
      indexCache.delete(folder); // let a later visit retry
      throw e;
    });
    indexCache.set(folder, cached);
  }
  return cached;
}

/** The daily schedule's puzzle list (public/puzzles/index.json). */
export const fetchPuzzleFiles = () => fetchIndex('puzzles');

/** The puzzles the Challenge spinner can land on (public/challenges/index.json). */
export const fetchChallengePool = () => fetchIndex('challenges');
