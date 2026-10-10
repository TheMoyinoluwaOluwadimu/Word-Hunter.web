/** Puzzle file (inside public/puzzles/) used for today's puzzle. */
export const DAILY_PUZZLE_FILE = 'Music.json';

/** localStorage key for streak stats. */
export const STORAGE_KEY = 'wordchunk_state';

/** Keys used before the rename from Wordhunter. Moved to the new keys on startup (see migrateLegacyKeys). */
export const LEGACY_KEYS: Record<string, string> = {
  wordhunter_state: STORAGE_KEY,
  wordhunter_practice: 'wordchunk_practice',
};

/**
 * Past puzzles shown in Practice, in display order (files inside public/puzzles/).
 * When you swap DAILY_PUZZLE_FILE, add the puzzle it replaces here.
 */
export const ARCHIVE_PUZZLE_FILES = ['Architecture.json', 'Coffee.json', 'OceanLife.json'];

/** localStorage key for Practice progress (best times). Kept apart from streak stats on purpose. */
export const PRACTICE_STORAGE_KEY = 'wordchunk_practice';
