import { useEffect, useMemo, useState } from 'react';
import { buildPuzzle, fetchBank } from '../lib/puzzle';
import type { PuzzleSpec } from '../lib/puzzle';
import type { Puzzle } from '../types';

export type PuzzleState =
  | { status: 'loading' }
  | { status: 'ready'; puzzle: Puzzle }
  | { status: 'error'; message: string };

type BankState =
  | { status: 'loading' }
  | { status: 'ready'; file: string; bank: Puzzle }
  | { status: 'error'; message: string };

/**
 * Loads a theme file and turns its word bank into the words to play (`spec` says which play type and
 * which turn). Nothing theme-related renders until status is 'ready', so no placeholder flash.
 * A null file or spec (not known yet, e.g. the schedule is still loading) stays in 'loading'.
 * Changing the spec re-picks the words without fetching the file again.
 */
export function usePuzzle(file: string | null, spec: PuzzleSpec | null): PuzzleState {
  const [bank, setBank] = useState<BankState>({ status: 'loading' });

  useEffect(() => {
    setBank({ status: 'loading' });
    if (file === null) return;
    let live = true;
    fetchBank(file).then(
      (b) => live && setBank({ status: 'ready', file, bank: b }),
      (err: unknown) => live && setBank({ status: 'error', message: err instanceof Error ? err.message : String(err) }),
    );
    return () => {
      live = false;
    };
  }, [file]);

  const specKey = spec === null ? null : JSON.stringify(spec);

  return useMemo<PuzzleState>(() => {
    if (bank.status !== 'ready' || bank.file !== file || file === null || spec === null) {
      return bank.status === 'error' ? bank : { status: 'loading' };
    }
    try {
      return { status: 'ready', puzzle: buildPuzzle(file, bank.bank, spec) };
    } catch (err) {
      return { status: 'error', message: err instanceof Error ? err.message : String(err) };
    }
    // `spec` is covered by specKey, which only changes when its contents do
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bank, file, specKey]);
}
