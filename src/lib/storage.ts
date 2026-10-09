import { STORAGE_KEY } from '../config';
import type { PlayerStats } from '../types';

// Streaks live in the browser until there is a backend. The daily reset is a
// single global UTC date (not the player's local midnight), so it behaves the
// same everywhere. No grace period: miss a day and the streak restarts at 1.

export const EMPTY_STATS: PlayerStats = {
  streak: 0,
  longestStreak: 0,
  totalSolved: 0,
  lastSolvedDate: null,
};

export function utcDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function yesterdayUTC(now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - 1);
  return utcDate(d);
}

export function loadStats(): PlayerStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STATS };
    const p = JSON.parse(raw) as Partial<PlayerStats>;
    return {
      streak: Number(p.streak) || 0,
      longestStreak: Number(p.longestStreak) || 0,
      totalSolved: Number(p.totalSolved) || 0,
      lastSolvedDate: typeof p.lastSolvedDate === 'string' ? p.lastSolvedDate : null,
    };
  } catch {
    // corrupted or inaccessible storage: start clean
    return { ...EMPTY_STATS };
  }
}

export function saveStats(stats: PlayerStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // storage unavailable (private mode, quota): the session still works
  }
}

export function hasSolvedToday(stats: PlayerStats, now: Date = new Date()): boolean {
  return stats.lastSolvedDate === utcDate(now);
}

/**
 * Applies a win. Returns the SAME object if today was already counted, so
 * callers can detect a replay with `next === current`.
 */
export function recordSolve(stats: PlayerStats, now: Date = new Date()): PlayerStats {
  if (hasSolvedToday(stats, now)) return stats;
  const streak = stats.lastSolvedDate === yesterdayUTC(now) ? stats.streak + 1 : 1;
  return {
    streak,
    longestStreak: Math.max(stats.longestStreak, streak),
    totalSolved: stats.totalSolved + 1,
    lastSolvedDate: utcDate(now),
  };
}

/** "6h 54m" until the next 00:00 UTC. */
export function timeUntilReset(now: Date = new Date()): string {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const ms = next - now.getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}
