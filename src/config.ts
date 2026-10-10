/** Puzzle file (inside public/puzzles/) used for today's puzzle. */
export const DAILY_PUZZLE_FILE = 'Music.json';

/** localStorage key. Same key the old HTML prototype used, so saved streaks carry over. */
export const STORAGE_KEY = 'wordhunter_state';

/**
 * Past puzzles shown in Practice, in display order (files inside public/puzzles/).
 * When you swap DAILY_PUZZLE_FILE, add the puzzle it replaces here.
 */
export const ARCHIVE_PUZZLE_FILES = ['Architecture.json', 'Coffee.json', 'OceanLife.json'];

/** localStorage key for Practice progress (best times). Kept apart from streak stats on purpose. */
export const PRACTICE_STORAGE_KEY = 'wordhunter_practice';
