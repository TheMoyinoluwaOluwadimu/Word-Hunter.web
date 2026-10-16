import { supabase } from './supabase';

// Typed wrappers over the leaderboard functions in supabase/leaderboard.sql.

export type BoardTab = 'today' | 'streak' | 'alltime';
export type BoardScope = 'global' | 'friends';

export interface BoardEntry {
  rank: number;
  name: string;
  /** today: seconds, streak: days, alltime: puzzles solved. */
  value: number;
  isMe: boolean;
}

export interface Board {
  /** Best first, at most the requested limit. */
  entries: BoardEntry[];
  /** The signed-in player's own standing, wherever it falls. Null when not ranked. */
  me: { rank: number; value: number } | null;
  /** Everyone ranked in this tab and scope. */
  total: number;
}

export async function getLeaderboard(tab: BoardTab, scope: BoardScope, limit = 20): Promise<Board> {
  if (!supabase) throw new Error('The leaderboard needs an online connection to WordChunk.');
  const { data, error } = await supabase.rpc('get_leaderboard', { p_tab: tab, p_scope: scope, p_limit: limit });
  if (error) {
    console.warn('[leaderboard]', error.message);
    throw new Error('Could not load the leaderboard. Please try again.');
  }
  const d = data as {
    entries?: { rank: number; name: string; value: number; is_me: boolean }[];
    me?: { rank: number; value: number } | null;
    total?: number;
  };
  return {
    entries: (d.entries ?? []).map((e) => ({ rank: e.rank, name: e.name, value: e.value, isMe: e.is_me })),
    me: d.me ?? null,
    total: d.total ?? 0,
  };
}
