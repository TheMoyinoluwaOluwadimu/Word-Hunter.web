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

let filesPromise: Promise<string[]> | null = null;

/** The ordered puzzle list (public/puzzles/index.json), fetched once per page load. */
export function fetchPuzzleFiles(): Promise<string[]> {
  filesPromise ??= (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}puzzles/index.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Could not load the puzzle list (HTTP ${res.status}).`);
    const data = (await res.json()) as { files?: unknown };
    if (!Array.isArray(data.files) || data.files.length === 0 || !data.files.every((f) => typeof f === 'string')) {
      throw new Error('The puzzle list is empty or malformed.');
    }
    return data.files as string[];
  })().catch((e) => {
    filesPromise = null; // let a later visit retry
    throw e;
  });
  return filesPromise;
}
