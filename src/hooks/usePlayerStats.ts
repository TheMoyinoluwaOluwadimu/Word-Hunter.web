import { useCallback, useState } from 'react';
import { loadStats, recordSolve, saveStats } from '../lib/storage';
import type { PlayerStats } from '../types';

export function usePlayerStats() {
  const [stats, setStats] = useState<PlayerStats>(loadStats);

  /** Records a win. `counted` is false when today was already solved (a replay). */
  const registerSolve = useCallback(() => {
    const current = loadStats();
    const next = recordSolve(current);
    const counted = next !== current;
    if (counted) saveStats(next);
    setStats(next);
    return { stats: next, counted };
  }, []);

  return { stats, registerSolve };
}
