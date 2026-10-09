import { shuffle } from '../lib/array';
import type { Puzzle, TileModel } from '../types';

/** Slots are addressed as "wordIndex:chunkIndex". */
export const slotKey = (wordIdx: number, chunkIdx: number) => `${wordIdx}:${chunkIdx}`;

export type Phase = 'playing' | 'checking' | 'revealing' | 'solved';

export interface BoardState {
  tiles: TileModel[]; // shuffled once per board
  expected: Record<string, string>; // slotKey -> the chunk text that belongs there
  totalSlots: number;
  placements: Record<string, string>; // slotKey -> tileId
  locked: string[]; // tiles confirmed correct; they can't move any more
  wrong: string[]; // tiles flagged wrong during the reveal
  phase: Phase;
  message: string | null;
}

export type BoardAction =
  | { type: 'DROP'; tileId: string; slot: string }
  | { type: 'RETURN'; tileId: string }
  | { type: 'BEGIN_CHECK' }
  | { type: 'CHECK' }
  | { type: 'RETRY' };

export function createBoard(puzzle: Puzzle): BoardState {
  const tiles: TileModel[] = [];
  const expected: Record<string, string> = {};
  puzzle.items.forEach((item, wordIdx) => {
    item.chunks.forEach((chunk, chunkIdx) => {
      tiles.push({ id: `${wordIdx}-${chunkIdx}`, chunk, wordIdx, chunkIdx });
      expected[slotKey(wordIdx, chunkIdx)] = chunk;
    });
  });
  return {
    tiles: shuffle(tiles),
    expected,
    totalSlots: tiles.length,
    placements: {},
    locked: [],
    wrong: [],
    phase: 'playing',
    message: null,
  };
}

function withoutTile(placements: Record<string, string>, tileId: string) {
  const next = { ...placements };
  for (const key of Object.keys(next)) {
    if (next[key] === tileId) delete next[key];
  }
  return next;
}

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    // Placement never says right or wrong. Correctness is only revealed once the whole board is full.
    case 'DROP': {
      if (state.phase !== 'playing' || state.locked.includes(action.tileId)) return state;
      const placements = withoutTile(state.placements, action.tileId);
      const occupant = placements[action.slot];
      if (occupant !== undefined) {
        // can't displace a locked tile: the dragged tile just goes back to the pool
        if (state.locked.includes(occupant)) return { ...state, placements, message: null };
        delete placements[action.slot]; // swap: the old tile returns to the pool
      }
      placements[action.slot] = action.tileId;
      return { ...state, placements, message: null };
    }

    case 'RETURN': {
      if (state.phase !== 'playing' || state.locked.includes(action.tileId)) return state;
      return { ...state, placements: withoutTile(state.placements, action.tileId), message: null };
    }

    case 'BEGIN_CHECK':
      return state.phase === 'playing' ? { ...state, phase: 'checking' } : state;

    case 'CHECK': {
      if (state.phase !== 'checking') return state;
      const chunkOf = new Map(state.tiles.map((t) => [t.id, t.chunk]));
      const right: string[] = [];
      const wrong: string[] = [];
      for (const [slot, tileId] of Object.entries(state.placements)) {
        // compare text, so two identical chunks are interchangeable
        (chunkOf.get(tileId) === state.expected[slot] ? right : wrong).push(tileId);
      }
      const locked = Array.from(new Set([...state.locked, ...right]));
      if (wrong.length === 0) return { ...state, phase: 'solved', locked, wrong: [] };
      return { ...state, phase: 'revealing', locked, wrong };
    }

    case 'RETRY': {
      if (state.phase !== 'revealing') return state;
      let placements = state.placements;
      for (const id of state.wrong) placements = withoutTile(placements, id);
      const n = state.wrong.length;
      return {
        ...state,
        placements,
        wrong: [],
        phase: 'playing',
        message: n === 1 ? '1 tile was wrong, try again' : `${n} tiles were wrong, try again`,
      };
    }
  }
}
