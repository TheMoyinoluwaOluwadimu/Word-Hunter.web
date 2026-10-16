import { supabase } from './supabase';
import { utcDate } from './storage';

// The daily puzzle is timed by the server too, so its leaderboard can't be filled with made-up
// times. This is best effort and never blocks play: if it fails the game and local streak
// still work, the run just isn't ranked.

const PENDING_KEY = 'wordchunk_pending_daily';

interface Pending {
  date: string;
  seconds: number;
}

/** Errors the server raises on purpose. Retrying one of these can never succeed. */
const FINAL_ERRORS = ['not_signed_in', 'not_started', 'already_played'];

function readPending(): Pending | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as Pending | null;
    return p && typeof p.date === 'string' && typeof p.seconds === 'number' ? p : null;
  } catch {
    return null;
  }
}

function writePending(p: Pending | null) {
  try {
    if (p) localStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // storage unavailable: a failed send is just lost
  }
}

/** Marks the start of today's run (the first tile pick-up). */
export async function startDailyRun(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('start_daily');
  if (error && !FINAL_ERRORS.includes(error.message)) console.warn('[daily] start failed', error.message);
}

/** Records the finished run. If the connection fails it is kept and retried by retryPendingDailyRun. */
export async function finishDailyRun(seconds: number): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('finish_daily', { p_client_seconds: Math.round(seconds) });
  if (!error || FINAL_ERRORS.includes(error.message)) {
    writePending(null);
    return;
  }
  console.warn('[daily] finish failed, will retry', error.message);
  writePending({ date: utcDate(), seconds });
}

/** Sends a finish that never got through. Only same-day ones: after midnight it would no longer match. */
export async function retryPendingDailyRun(): Promise<void> {
  const pending = readPending();
  if (!pending) return;
  if (pending.date !== utcDate()) {
    writePending(null);
    return;
  }
  await finishDailyRun(pending.seconds);
}
