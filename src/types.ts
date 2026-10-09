/** One row of a puzzle: the text shown to the player and the chunks it is built from. */
export interface PuzzleItem {
  label: string;
  chunks: string[];
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
