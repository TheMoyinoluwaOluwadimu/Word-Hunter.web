import { supabase } from './supabase';

// Thin typed wrappers over the challenge functions in supabase/challenges.sql.
// The server owns all challenge state; nothing here touches localStorage.

export interface ChallengeEntry {
  name: string | null;
  seconds: number | null;
  finished: boolean;
  isCreator: boolean;
  isMe: boolean;
}

export interface Challenge {
  code: string;
  puzzleFile: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  isCreator: boolean;
  creatorName: string | null;
  /** Friends can only play once the creator has set a time. */
  creatorFinished: boolean;
  /** Fastest first, unfinished last. */
  entries: ChallengeEntry[];
}

export interface ChallengeStart {
  puzzleFile: string;
  /** Shuffle seed: every player gets the same board. */
  seed: number;
  startedAt: string;
  /** The server's clock when it answered. Elapsed time = serverNow - startedAt, so a wrong phone clock can't skew it. */
  serverNow: string;
}

export interface ChallengeSummary {
  code: string;
  puzzleFile: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  isCreator: boolean;
  creatorName: string | null;
  mySeconds: number | null;
  myFinished: boolean;
  players: number;
  bestSeconds: number | null;
}

export type ChallengeErrorCode =
  | 'not_configured'
  | 'not_signed_in'
  | 'not_found'
  | 'expired'
  | 'not_ready'
  | 'already_played'
  | 'not_started'
  | 'bad_puzzle'
  | 'too_many_challenges'
  | 'unknown';

const KNOWN: ChallengeErrorCode[] = [
  'not_signed_in',
  'not_found',
  'expired',
  'not_ready',
  'already_played',
  'not_started',
  'bad_puzzle',
  'too_many_challenges',
];

const MESSAGES: Record<ChallengeErrorCode, string> = {
  not_configured: 'Challenges need an online connection to WordChunk.',
  not_signed_in: 'Sign in to play challenges.',
  not_found: "That challenge doesn't exist. Check the link.",
  expired: 'This challenge has expired.',
  not_ready: "Your friend hasn't finished their run yet. Try again in a bit.",
  already_played: "You've already played this challenge.",
  not_started: 'This attempt was never started.',
  bad_puzzle: "That puzzle can't be used for a challenge.",
  too_many_challenges: "You've made a lot of challenges today. Try again tomorrow.",
  unknown: 'Something went wrong. Please try again.',
};

export class ChallengeError extends Error {
  constructor(public code: ChallengeErrorCode, detail?: string) {
    super(MESSAGES[code]);
    if (detail) console.warn(`[challenge] ${code}: ${detail}`);
  }
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new ChallengeError('not_configured');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    // The SQL functions raise their code as the message, e.g. raise exception 'expired'.
    const code = KNOWN.find((k) => error.message === k) ?? 'unknown';
    throw new ChallengeError(code, code === 'unknown' ? error.message : undefined);
  }
  return data as T;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toChallenge(r: any): Challenge {
  return {
    code: r.code,
    puzzleFile: r.puzzle_file,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    expired: r.expired,
    isCreator: r.is_creator,
    creatorName: r.creator_name,
    creatorFinished: r.creator_finished,
    entries: (r.entries ?? []).map((e: any) => ({
      name: e.name,
      seconds: e.seconds,
      finished: e.finished,
      isCreator: e.is_creator,
      isMe: e.is_me,
    })),
  };
}

function toSummary(r: any): ChallengeSummary {
  return {
    code: r.code,
    puzzleFile: r.puzzle_file,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    expired: r.expired,
    isCreator: r.is_creator,
    creatorName: r.creator_name,
    mySeconds: r.my_seconds,
    myFinished: r.my_finished,
    players: r.players,
    bestSeconds: r.best_seconds,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Creates a challenge on `puzzleFile` and returns its share code. The creator plays it next.
 * `seed` picks the five words (and shuffles the tiles); without it the server makes one up. If the database
 * has not been updated to accept a seed yet (supabase/challenge-seed.sql), this falls back to the old call.
 */
export async function createChallenge(puzzleFile: string, seed?: number): Promise<string> {
  if (seed !== undefined) {
    try {
      const r = await rpc<{ code: string }>('create_challenge', { p_puzzle_file: puzzleFile, p_seed: seed });
      return r.code;
    } catch (e) {
      // an old create_challenge(text) has no p_seed: PostgREST answers "function not found" (unknown here)
      if (!(e instanceof ChallengeError) || e.code !== 'unknown') throw e;
    }
  }
  const r = await rpc<{ code: string }>('create_challenge', { p_puzzle_file: puzzleFile });
  return r.code;
}

/** Works signed out too, so a shared link can show who's challenging you. Null if no such code. */
export async function getChallenge(code: string): Promise<Challenge | null> {
  const r = await rpc<unknown>('get_challenge', { p_code: code });
  return r ? toChallenge(r) : null;
}

/** Starts (or resumes) the caller's single attempt. Call when the board is shown: the server clock starts here. */
export async function startChallenge(code: string): Promise<ChallengeStart> {
  const r = await rpc<{ puzzle_file: string; seed: number; started_at: string; server_now: string }>('start_challenge', {
    p_code: code,
  });
  return { puzzleFile: r.puzzle_file, seed: r.seed, startedAt: r.started_at, serverNow: r.server_now };
}

/** Submits the caller's time and returns the updated results. */
export async function finishChallenge(code: string, clientSeconds: number): Promise<Challenge> {
  const r = await rpc<unknown>('finish_challenge', {
    p_code: code,
    p_client_seconds: Math.round(clientSeconds),
  });
  return toChallenge(r);
}

export async function listMyChallenges(): Promise<ChallengeSummary[]> {
  const r = await rpc<unknown[]>('list_my_challenges');
  return (r ?? []).map(toSummary);
}
