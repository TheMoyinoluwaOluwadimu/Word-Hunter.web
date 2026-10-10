import { PRACTICE_STORAGE_KEY } from '../config';

// Practice results never touch streak stats. They only remember, per puzzle file,
// the best solve time and how many times it has been solved.

export interface PracticeEntry {
  /** Fastest solve, in seconds. */
  best: number;
  solves: number;
}

export type PracticeProgress = Record<string, PracticeEntry>;

export function loadPractice(): PracticeProgress {
  try {
    const raw = localStorage.getItem(PRACTICE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<PracticeEntry>>;
    const out: PracticeProgress = {};
    for (const [file, e] of Object.entries(parsed ?? {})) {
      if (typeof e?.best === 'number' && e.best >= 0) out[file] = { best: e.best, solves: Number(e.solves) || 1 };
    }
    return out;
  } catch {
    // corrupted or inaccessible storage: start clean
    return {};
  }
}

/** Combines two progress maps: fastest time wins per puzzle, solve counts only grow. */
export function mergePractice(a: PracticeProgress, b: PracticeProgress): PracticeProgress {
  const out: PracticeProgress = { ...a };
  for (const [file, e] of Object.entries(b)) {
    const mine = out[file];
    out[file] = mine ? { best: Math.min(mine.best, e.best), solves: Math.max(mine.solves, e.solves) } : e;
  }
  return out;
}

export function savePractice(progress: PracticeProgress): void {
  try {
    localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // storage unavailable (private mode, quota): the session still works
  }
}

/** Records a practice solve. `newBest` is also true on the very first solve of a puzzle. */
export function recordPracticeSolve(
  file: string,
  seconds: number,
): { progress: PracticeProgress; newBest: boolean; best: number } {
  const progress = loadPractice();
  const prev = progress[file];
  const newBest = prev === undefined || seconds < prev.best;
  const best = newBest ? seconds : prev.best;
  const next = { ...progress, [file]: { best, solves: (prev?.solves ?? 0) + 1 } };
  savePractice(next);
  return { progress: next, newBest, best };
}
