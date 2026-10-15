import { useEffect, useMemo, useState } from 'react';
import { buildSchedule, fetchPuzzleFiles } from '../lib/schedule';
import type { PuzzleSchedule } from '../lib/schedule';

export type ScheduleState =
  | { status: 'loading' }
  | { status: 'ready'; schedule: PuzzleSchedule }
  | { status: 'error'; message: string };

/**
 * Today's puzzle and the archive. Pass `now` (e.g. from useNow) to roll over at UTC midnight
 * while the page stays open; without it the day is fixed when the screen opens, so a board
 * in play never swaps puzzles under the player.
 */
export function usePuzzleSchedule(now?: Date): ScheduleState {
  const [files, setFiles] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openedAt] = useState(() => new Date());
  const at = now ?? openedAt;
  // only the date matters, so don't rebuild on every tick of `now`
  const day = at.toISOString().slice(0, 10);

  useEffect(() => {
    let live = true;
    fetchPuzzleFiles().then(
      (f) => live && setFiles(f),
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
  }, []);

  return useMemo<ScheduleState>(() => {
    if (error) return { status: 'error', message: error };
    if (!files) return { status: 'loading' };
    return { status: 'ready', schedule: buildSchedule(files, at) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, error, day]);
}
