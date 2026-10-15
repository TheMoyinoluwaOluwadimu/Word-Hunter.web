/**
 * UTC date (YYYY-MM-DD) of puzzle #1. The daily puzzle is the Nth file in public/puzzles/
 * (alphabetical, see scripts/build-puzzle-index.mjs) where N = days since this date, cycling.
 * Set to Oct 13 so that 2026-10-15 lands on Music.json, the puzzle that was live before scheduling.
 * Don't change it once players exist: it re-times every puzzle.
 */
export const LAUNCH_DATE = '2026-10-13';

/** localStorage key for streak stats. */
export const STORAGE_KEY = 'wordchunk_state';

/** Keys used before the rename from Wordhunter. Moved to the new keys on startup (see migrateLegacyKeys). */
export const LEGACY_KEYS: Record<string, string> = {
  wordhunter_state: STORAGE_KEY,
  wordhunter_practice: 'wordchunk_practice',
};

/** localStorage key for Practice progress (best times). Kept apart from streak stats on purpose. */
export const PRACTICE_STORAGE_KEY = 'wordchunk_practice';
