import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { LOCAL_DATA_EVENT, loadStats, recordSolve, saveStats } from '../lib/storage';
import { pushStats } from '../lib/sync';
import type { PlayerStats } from '../types';

export function usePlayerStats() {
  const [stats, setStats] = useState<PlayerStats>(loadStats);
  const { user } = useAuth();
  const userId = user?.id;

  // Local data can change under us (sign-in merge, sign-out wipe).
  useEffect(() => {
    const reload = () => setStats(loadStats());
    window.addEventListener(LOCAL_DATA_EVENT, reload);
    return () => window.removeEventListener(LOCAL_DATA_EVENT, reload);
  }, []);

  /** Records a win. `counted` is false when today was already solved (a replay). */
  const registerSolve = useCallback(() => {
    const current = loadStats();
    const next = recordSolve(current);
    const counted = next !== current;
    if (counted) {
      saveStats(next);
      if (userId) void pushStats(userId, next);
    }
    setStats(next);
    return { stats: next, counted };
  }, [userId]);

  return { stats, registerSolve };
}
