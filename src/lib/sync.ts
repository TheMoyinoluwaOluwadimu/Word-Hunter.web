import { loadPractice, mergePractice, savePractice } from './practice';
import type { PracticeEntry, PracticeProgress } from './practice';
import { loadStats, mergeStats, notifyLocalDataChanged, saveStats } from './storage';
import { supabase } from './supabase';
import type { PlayerStats } from '../types';

// Signed-in players keep the same data in Supabase. localStorage stays the working
// copy, so the game is instant and still works offline; the cloud is written after
// each solve and merged in once at sign-in.

function warn(what: string, error: unknown) {
  console.warn(`[sync] ${what} failed`, error);
}

export async function pushStats(userId: string, s: PlayerStats): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('player_stats').upsert({
    user_id: userId,
    streak: s.streak,
    longest_streak: s.longestStreak,
    total_solved: s.totalSolved,
    last_solved_date: s.lastSolvedDate,
    updated_at: new Date().toISOString(),
  });
  if (error) warn('pushStats', error);
}

export async function pushPracticeEntry(userId: string, file: string, e: PracticeEntry): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('practice_progress').upsert({
    user_id: userId,
    puzzle_file: file,
    best_seconds: Math.round(e.best),
    solves: e.solves,
    updated_at: new Date().toISOString(),
  });
  if (error) warn('pushPracticeEntry', error);
}

/**
 * Runs once per sign-in: merges this device's progress (guest play included) with the
 * account's, stores the result locally, and writes it back so both sides agree.
 */
export async function syncOnSignIn(userId: string): Promise<void> {
  if (!supabase) return;

  const [statsRes, practiceRes] = await Promise.all([
    supabase.from('player_stats').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('practice_progress').select('puzzle_file,best_seconds,solves').eq('user_id', userId),
  ]);
  if (statsRes.error || practiceRes.error) {
    // Leave local data alone rather than overwrite the account with a partial view.
    warn('syncOnSignIn', statsRes.error ?? practiceRes.error);
    return;
  }

  const row = statsRes.data;
  const remoteStats: PlayerStats = row
    ? {
        streak: row.streak,
        longestStreak: row.longest_streak,
        totalSolved: row.total_solved,
        lastSolvedDate: row.last_solved_date,
      }
    : { streak: 0, longestStreak: 0, totalSolved: 0, lastSolvedDate: null };

  const remotePractice: PracticeProgress = {};
  for (const p of practiceRes.data ?? []) {
    remotePractice[p.puzzle_file] = { best: p.best_seconds, solves: p.solves };
  }

  const stats = mergeStats(loadStats(), remoteStats);
  const practice = mergePractice(loadPractice(), remotePractice);
  saveStats(stats);
  savePractice(practice);
  notifyLocalDataChanged();

  await Promise.all([
    pushStats(userId, stats),
    ...Object.entries(practice).map(([file, e]) => pushPracticeEntry(userId, file, e)),
  ]);
}
