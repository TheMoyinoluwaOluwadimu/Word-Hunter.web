/** One row of a puzzle: the text shown to the player and the chunks it is built from. */
/** Which part of a theme's word bank a word belongs to: the three play types never share a lane. */
export type WordPool = 'daily' | 'challenge' | 'practice';

export interface PuzzleItem {
  /** Stable name of the word (its answer), used to remember what a player has already seen. */
  id: string;
  label: string;
  chunks: string[];
  pool: WordPool;
}

export interface Puzzle {
  theme: string | null;
  items: PuzzleItem[];
}

export interface PlayerStats {
  streak: number;
  longestStreak: number;
  totalSolved: number;
  /** UTC date, YYYY-MM-DD */
  lastSolvedDate: string | null;
}

export interface TileModel {
  id: string;
  chunk: string;
  wordIdx: number;
  chunkIdx: number;
}
