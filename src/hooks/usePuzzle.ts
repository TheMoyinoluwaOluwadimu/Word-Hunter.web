import { useEffect, useState } from 'react';
import { fetchPuzzle } from '../lib/puzzle';
import type { Puzzle } from '../types';

export type PuzzleState =
  | { status: 'loading' }
  | { status: 'ready'; puzzle: Puzzle }
  | { status: 'error'; message: string };

/**
 * Loads a puzzle file. Nothing theme-related renders until status is 'ready', so no placeholder flash.
 * A null file (not known yet, e.g. the schedule is still loading) stays in 'loading'.
 */
export function usePuzzle(
  file: string | null,
  folder: 'puzzles' | 'challenges' = 'puzzles',
  key?: string,
): PuzzleState {
  const [state, setState] = useState<PuzzleState>({ status: 'loading' });

  useEffect(() => {
    setState({ status: 'loading' });
    if (file === null) return;
    const ctrl = new AbortController();
    fetchPuzzle(file, ctrl.signal, folder, key)
      .then((puzzle) => setState({ status: 'ready', puzzle }))
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => ctrl.abort();
  }, [file, folder, key]);

  return state;
}
