import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import AccountDialog from '../components/AccountDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { BackIcon, StopwatchIcon, TrophyIcon } from '../components/icons';
import Board from '../game/Board';
import game from '../game/Game.module.css';
import { usePuzzle } from '../hooks/usePuzzle';
import { useTimer } from '../hooks/useTimer';
import { cx } from '../lib/cx';
import { ChallengeError, finishChallenge, getChallenge, startChallenge } from '../lib/challenge';
import type { Challenge, ChallengeStart } from '../lib/challenge';
import { formatTime } from '../lib/format';
import { playSolvedSound } from '../lib/sound';
import ChallengeResult from './ChallengeResult';
import styles from './Challenge.module.css';

// A finished run is remembered here until the server has it, so a dropped connection
// (or a closed tab) never costs the player their time.
const PENDING_KEY = 'wordchunk_pending_finish';
interface Pending {
  code: string;
  seconds: number;
}
function readPending(): Pending | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as Pending | null;
    return p && typeof p.code === 'string' && typeof p.seconds === 'number' ? p : null;
  } catch {
    return null;
  }
}
function writePending(p: Pending | null) {
  try {
    if (p) localStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // storage unavailable: the retry button still works for this session
  }
}

type View =
  | { kind: 'loading' }
  | { kind: 'error'; title: string; message: string }
  | { kind: 'signin'; challenge: Challenge }
  | { kind: 'locked'; challenge: Challenge }
  | { kind: 'ready'; challenge: Challenge; resume: boolean }
  | { kind: 'countdown'; challenge: Challenge; n: number }
  | { kind: 'playing'; challenge: Challenge; start: ChallengeStart; offset: number }
  | { kind: 'saving'; challenge: Challenge; seconds: number }
  | { kind: 'saveFailed'; challenge: Challenge; seconds: number; message: string }
  | { kind: 'result'; challenge: Challenge };

function errorView(e: unknown): View {
  if (e instanceof ChallengeError) {
    const title = e.code === 'expired' ? 'This challenge has ended' : e.code === 'not_found' ? 'No such challenge' : 'Something went wrong';
    return { kind: 'error', title, message: e.message };
  }
  return { kind: 'error', title: 'Something went wrong', message: e instanceof Error ? e.message : String(e) };
}

const nameOf = (c: Challenge) => c.creatorName?.trim() || 'Someone';

/** /c/:code. One screen that walks a challenge through ready, countdown, play, saving and results. */
export default function ChallengePlay() {
  const { code = '' } = useParams();
  const { user, loading: authLoading, enabled } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const timer = useTimer();
  const { startFrom, stop } = timer;

  const userId = user?.id;
  const signedIn = userId !== undefined;
  const challenge = 'challenge' in view ? view.challenge : null;
  const puzzleState = usePuzzle(challenge?.puzzleFile ?? null, 'challenges', challenge?.code);

  const submit = useCallback((ch: Challenge, seconds: number) => {
    writePending({ code: ch.code, seconds });
    finishChallenge(ch.code, seconds).then(
      (done) => {
        writePending(null);
        setView({ kind: 'result', challenge: done });
      },
      (e: unknown) => {
        if (e instanceof ChallengeError && e.code === 'already_played') {
          writePending(null);
          setReloadKey((k) => k + 1);
          return;
        }
        setView({
          kind: 'saveFailed',
          challenge: ch,
          seconds,
          message: e instanceof Error ? e.message : 'Something went wrong.',
        });
      },
    );
  }, []);

  // Work out which screen this player should see.
  useEffect(() => {
    if (authLoading) return;
    let live = true;
    setView({ kind: 'loading' });
    if (!enabled) {
      setView(errorView(new ChallengeError('not_configured')));
      return;
    }
    getChallenge(code).then(
      (ch) => {
        if (!live) return;
        if (!ch) return setView(errorView(new ChallengeError('not_found')));
        const me = ch.entries.find((e) => e.isMe);
        if (me?.finished) return setView({ kind: 'result', challenge: ch });
        if (ch.expired && !me) return setView(errorView(new ChallengeError('expired')));
        if (!signedIn) return setView({ kind: 'signin', challenge: ch });
        if (!ch.isCreator && !me && !ch.creatorFinished) return setView({ kind: 'locked', challenge: ch });

        // a finished run that never reached the server: send it now
        const pending = readPending();
        if (me && pending && pending.code === ch.code) {
          setView({ kind: 'saving', challenge: ch, seconds: pending.seconds });
          submit(ch, pending.seconds);
          return;
        }
        setView({ kind: 'ready', challenge: ch, resume: Boolean(me) });
      },
      (e: unknown) => live && setView(errorView(e)),
    );
    return () => {
      live = false;
    };
  }, [code, signedIn, authLoading, enabled, reloadKey, submit]);

  // The server stamps the start time. A returning player's clock picks up where it would be now.
  const go = useCallback(async (ch: Challenge) => {
    try {
      const s = await startChallenge(ch.code);
      const offset = Math.max(0, Math.floor((Date.parse(s.serverNow) - Date.parse(s.startedAt)) / 1000));
      setView({ kind: 'playing', challenge: ch, start: s, offset });
    } catch (e) {
      if (e instanceof ChallengeError && e.code === 'already_played') setReloadKey((k) => k + 1);
      else setView(errorView(e));
    }
  }, []);

  // 3, 2, 1, GO!
  useEffect(() => {
    if (view.kind !== 'countdown') return;
    if (view.n === 0) {
      void go(view.challenge);
      return;
    }
    const t = window.setTimeout(() => setView({ ...view, n: view.n - 1 }), 1000);
    return () => window.clearTimeout(t);
  }, [view, go]);

  useEffect(() => {
    if (view.kind === 'playing') startFrom(view.offset);
  }, [view, startFrom]);

  // Back online after a failed save: try again on our own.
  useEffect(() => {
    if (view.kind !== 'saveFailed') return;
    const retry = () => {
      setView({ kind: 'saving', challenge: view.challenge, seconds: view.seconds });
      submit(view.challenge, view.seconds);
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [view, submit]);

  const handleSolved = useCallback(() => {
    if (view.kind !== 'playing') return;
    playSolvedSound();
    const seconds = stop() ?? view.offset;
    setView({ kind: 'saving', challenge: view.challenge, seconds });
    submit(view.challenge, seconds);
  }, [view, stop, submit]);

  function begin(ch: Challenge, resume: boolean) {
    if (resume) void go(ch);
    else setView({ kind: 'countdown', challenge: ch, n: 3 });
  }

  const playing = view.kind === 'playing';
  // The creator's time is the one to beat; the creator themselves has nothing to chase.
  const target = challenge && !challenge.isCreator ? (challenge.entries.find((e) => e.isCreator)?.seconds ?? null) : null;
  const over = target !== null && timer.elapsed > target;
  const theme = puzzleState.status === 'ready' ? (puzzleState.puzzle.theme ?? 'Challenge puzzle') : null;
  const words = puzzleState.status === 'ready' ? puzzleState.puzzle.items.length : null;

  const eyebrow = challenge && !challenge.isCreator ? `Challenge vs ${nameOf(challenge)}` : 'Challenge';

  function handleBack(e: React.MouseEvent) {
    // Leaving mid-run doesn't pause anything, so say so before going.
    if (playing) {
      e.preventDefault();
      setConfirmLeave(true);
    }
  }

  function body() {
    switch (view.kind) {
      case 'loading':
        return <p className={styles.loading}>Loading challenge...</p>;

      case 'error':
        return (
          <div className={styles.notice}>
            <h2 className={styles.noticeTitle}>{view.title}</h2>
            <p className={styles.noticeText}>{view.message}</p>
            <Link to="/challenge" className={styles.bigBtn}>
              New challenge
            </Link>
            <Link to="/" className={styles.secBtn}>
              Main menu
            </Link>
          </div>
        );

      case 'signin':
        return (
          <div className={styles.notice}>
            <div className={styles.inviteRow}>
              <span className={styles.avatar}>{nameOf(view.challenge).charAt(0).toUpperCase()}</span>
              <p className={styles.inviteText}>
                {nameOf(view.challenge)} challenged you
              </p>
            </div>
            {view.challenge.entries.find((e) => e.isCreator)?.seconds != null && (
              <div className={styles.beat}>
                <TrophyIcon size={34} />
                <div>
                  <p className={styles.beatLabel}>Time to beat</p>
                  <p className={styles.beatTime}>{formatTime(view.challenge.entries.find((e) => e.isCreator)?.seconds ?? 0)}</p>
                </div>
              </div>
            )}
            <p className={styles.noticeText}>Sign in so your time counts and {nameOf(view.challenge)} can see who won.</p>
            <button type="button" className={styles.bigBtn} onClick={() => setAccountOpen(true)}>
              Sign in to play
            </button>
            <Link to="/" className={styles.linkBtn}>
              Not now
            </Link>
          </div>
        );

      case 'locked':
        return (
          <div className={styles.notice}>
            <h2 className={styles.noticeTitle}>{nameOf(view.challenge)} is still playing</h2>
            <p className={styles.noticeText}>You can play once they've set a time to beat.</p>
            <button type="button" className={styles.secBtn} onClick={() => setReloadKey((k) => k + 1)}>
              Check again
            </button>
            <Link to="/" className={styles.linkBtn}>
              Main menu
            </Link>
          </div>
        );

      case 'ready': {
        const ch = view.challenge;
        const beat = ch.isCreator ? null : (ch.entries.find((e) => e.isCreator)?.seconds ?? null);
        return (
          <div className={styles.body}>
            <section className={styles.card}>
              {ch.isCreator ? (
                <p className={styles.cardLead}>Your challenge</p>
              ) : (
                <div className={styles.inviteRow}>
                  <span className={styles.avatar}>{nameOf(ch).charAt(0).toUpperCase()}</span>
                  <p className={styles.inviteText}>{nameOf(ch)} challenged you!</p>
                </div>
              )}
              <div>
                <p className={styles.label}>Theme</p>
                <h2 className={styles.themeBig}>{theme ?? '...'}</h2>
                <p className={styles.cardSub}>{words !== null ? `${words} words` : ''}</p>
              </div>
              {beat !== null ? (
                <div className={styles.beat}>
                  <TrophyIcon size={36} />
                  <div>
                    <p className={styles.beatLabel}>Time to beat</p>
                    <p className={styles.beatTime}>{formatTime(beat)}</p>
                  </div>
                </div>
              ) : (
                <p className={styles.cardSub}>Set the time your friends will try to beat.</p>
              )}
            </section>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.bigBtn}
                disabled={puzzleState.status !== 'ready'}
                onClick={() => begin(ch, view.resume)}
              >
                {puzzleState.status === 'error' ? "Can't load puzzle" : view.resume ? 'Resume' : "I'm ready"}
              </button>
            </div>
          </div>
        );
      }

      case 'countdown':
        return (
          <div className={styles.countdown}>
            <p className={styles.eyebrowLine}>{theme} · {words} words</p>
            <div className={styles.countSlots} aria-hidden="true">
              {[3, 2, 1].map((n) => (
                <span key={n} className={cx(styles.countSlot, view.n <= n && styles.countSlotDone)}>
                  {n}
                </span>
              ))}
            </div>
            {/* remounted every second so each number drops in */}
            <div key={view.n} className={cx(styles.countBlock, view.n === 0 && styles.countGo)} role="timer" aria-live="assertive">
              {view.n === 0 ? 'GO!' : view.n}
            </div>
            <p className={styles.countCaption}>{view.n === 0 ? 'Go go go!' : 'Get set...'}</p>
          </div>
        );

      case 'playing':
        if (puzzleState.status !== 'ready') {
          return <p className={styles.loading}>Loading puzzle...</p>;
        }
        return (
          <>
            <div className={game.metaRow}>
              <div className={game.metaItem}>
                <StopwatchIcon />
                <span data-testid="timer">{formatTime(timer.elapsed)}</span>
              </div>
              {target !== null && (
                <div className={cx(game.streak, over && styles.chipOver)} title="The time you're chasing">
                  <TrophyIcon />
                  <span>To beat {formatTime(target)}</span>
                </div>
              )}
            </div>
            <Board puzzle={puzzleState.puzzle} seed={view.start.seed} onStart={() => {}} onSolved={handleSolved} />
          </>
        );

      case 'saving':
      case 'saveFailed':
        return <p className={styles.loading}>Saving your time...</p>;

      case 'result':
        return <ChallengeResult challenge={view.challenge} />;
    }
  }

  return (
    <div className={cx(game.stage, game.roomy, 'enter')}>
      <header className={game.header}>
        <Link to="/" className={game.backBtn} aria-label="Back to menu" onClick={handleBack}>
          <BackIcon />
        </Link>
        <div className={game.headings}>
          <p className={game.eyebrow}>{eyebrow}</p>
          <h1 className={game.title}>
            {view.kind === 'playing' && puzzleState.status === 'ready'
              ? `Theme: ${puzzleState.puzzle.theme ?? 'Challenge'}`
              : 'WordChunk'}
          </h1>
        </div>
      </header>

      {body()}

      {(view.kind === 'saving' || view.kind === 'saveFailed') && (
        <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Saving your time">
          <div className={cx(styles.panel, view.kind === 'saveFailed' && styles.panelRed)}>
            <h2 className={styles.ribbon}>{view.kind === 'saveFailed' ? 'No connection' : 'Board complete!'}</h2>
            <div className={styles.panelInner}>
              <p className={styles.panelLabel}>Your time</p>
              <p className={styles.panelTime}>{formatTime(view.seconds)}</p>
              {view.kind === 'saving' ? (
                <>
                  <p className={styles.panelStrong}>Saving your time...</p>
                  {!challenge?.isCreator && challenge && (
                    <p className={styles.panelNote}>Checking it against {nameOf(challenge)}</p>
                  )}
                </>
              ) : (
                <>
                  <p className={styles.panelNote}>Your time is safe on this phone. We couldn't send it yet.</p>
                  <p className={styles.panelNote}>{view.message}</p>
                </>
              )}
            </div>
            {view.kind === 'saveFailed' && (
              <div className={styles.panelActions}>
                <button
                  type="button"
                  className={game.primaryBtn}
                  onClick={() => {
                    setView({ kind: 'saving', challenge: view.challenge, seconds: view.seconds });
                    submit(view.challenge, view.seconds);
                  }}
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmLeave}
        title="Leave the challenge?"
        message="Your clock keeps running while you're away. Come back through the same link to finish."
        confirmLabel="Leave"
        cancelLabel="Keep playing"
        onConfirm={() => {
          setConfirmLeave(false);
          navigate('/');
        }}
        onCancel={() => setConfirmLeave(false)}
      />
      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}
