import { useEffect, useState } from 'react';
import { fetchPuzzle } from '../lib/puzzle';
import type { Puzzle } from '../types';

export type PuzzleState =
  | { status: 'loading' }
  | { status: 'ready'; puzzle: Puzzle }
  | { status: 'error'; message: string };

/** Loads a puzzle file. Nothing theme-related renders until status is 'ready', so no placeholder flash. */
export function usePuzzle(file: string): PuzzleState {
  const [state, setState] = useState<PuzzleState>({ status: 'loading' });

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    fetchPuzzle(file, ctrl.signal)
      .then((puzzle) => setState({ status: 'ready', puzzle }))
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => ctrl.abort();
  }, [file]);

  return state;
}
