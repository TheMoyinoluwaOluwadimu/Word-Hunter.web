import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import AccountDialog from '../components/AccountDialog';
import { BackIcon, ChallengeIcon } from '../components/icons';
import game from '../game/Game.module.css';
import { cx } from '../lib/cx';
import { createChallenge } from '../lib/challenge';
import { fetchPuzzle } from '../lib/puzzle';
import { fetchChallengePool } from '../lib/schedule';
import styles from './Challenge.module.css';

interface Theme {
  file: string;
  theme: string;
  words: number;
}

type Phase = 'idle' | 'spinning' | 'landed';

const COLOR_CLASSES = ['c0', 'c1', 'c2', 'c3', 'c4'] as const;

/** /challenge: spin a theme from the challenge pool, then play it to set the time to beat. */
export default function ChallengeSpin() {
  const { enabled, user } = useAuth();
  const navigate = useNavigate();
  const [themes, setThemes] = useState<Theme[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [pos, setPos] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  // Read each pool puzzle once, only for its theme name and word count.
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const files = await fetchChallengePool();
        const list = await Promise.all(
          files.map(async (file): Promise<Theme | null> => {
            try {
              const p = await fetchPuzzle(file, ctrl.signal, 'challenges');
              return { file, theme: p.theme ?? file.replace(/\.json$/i, ''), words: p.items.length };
            } catch {
              return null; // one bad file shouldn't take the spinner down
            }
          }),
        );
        if (ctrl.signal.aborted) return;
        const ok = list.filter((t): t is Theme => t !== null);
        if (ok.length === 0) throw new Error('No challenge puzzles could be loaded.');
        setThemes(ok);
      } catch (e) {
        if (!ctrl.signal.aborted) setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => ctrl.abort();
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const spin = useCallback(() => {
    if (!themes || phase === 'spinning') return;
    const n = themes.length;
    const target = Math.floor(Math.random() * n);
    setError(null);

    // Nothing to shuffle through, or the player asked for less motion: land straight away.
    if (n === 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPos(target);
      setPhase('landed');
      return;
    }

    setPhase('spinning');
    // two or three full laps, ending exactly on the target; the reel slows as it goes
    const steps = (2 + Math.floor(Math.random() * 2)) * n + ((target - pos + n) % n);
    let i = 0;
    const tick = () => {
      i++;
      setPos((p) => (p + 1) % n);
      if (i >= steps) {
        setPhase('landed');
        return;
      }
      timer.current = window.setTimeout(tick, 55 + Math.pow(i / steps, 3) * 280);
    };
    timer.current = window.setTimeout(tick, 55);
  }, [themes, phase, pos]);

  async function play() {
    if (!themes) return;
    if (!user) {
      setAccountOpen(true);
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const code = await createChallenge(themes[pos].file);
      navigate(`/c/${code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setCreating(false);
    }
  }

  const n = themes?.length ?? 0;
  const at = (i: number) => (themes ? themes[((i % n) + n) % n] : undefined);
  const classOf = (i: number) => styles[COLOR_CLASSES[((i % 5) + 5) % 5]];
  const current = at(pos);
  const landed = phase === 'landed';

  return (
    <div className={cx(game.stage, game.roomy)}>
      <header className={game.header}>
        <Link to="/" className={game.backBtn} aria-label="Back to menu">
          <BackIcon />
        </Link>
        <div className={game.headings}>
          <p className={game.eyebrow}>Versus</p>
          <h1 className={game.title}>Challenge</h1>
        </div>
        <div className={game.stamp}>NEW</div>
      </header>

      {landed && (
        <div className={styles.confetti} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}

      {!enabled || loadError ? (
        <div className={styles.notice}>
          <h2 className={styles.noticeTitle}>Challenges aren't available</h2>
          <p className={styles.noticeText}>
            {loadError ?? 'Challenges need an account, and sign-in is not set up in this build.'}
          </p>
          <Link to="/" className={styles.secBtn}>
            Main menu
          </Link>
        </div>
      ) : (
        <div className={styles.body}>
          <div className={styles.hero}>
            <div className={styles.heroIcon}>
              <ChallengeIcon size={92} />
            </div>
            <h2 className={styles.heroTitle}>{landed ? 'Your theme!' : phase === 'spinning' ? 'Spinning...' : 'Spin a theme'}</h2>
            <p className={styles.heroSub}>
              {landed
                ? 'You go first. Beat the clock, then send it on.'
                : 'You play first and set the time. Then send it to a friend to beat.'}
            </p>
          </div>

          <div className={styles.reel} aria-live="polite">
            <div className={styles.reelWindow}>
              <div className={cx(styles.reelRow, styles.reelDim, themes && classOf(pos - 1))}>
                {at(pos - 1)?.theme ?? ''}
              </div>
              <div
                className={cx(
                  styles.reelRow,
                  styles.reelMain,
                  landed && current ? classOf(pos) : styles.reelQ,
                  landed && styles.reelLanded,
                )}
              >
                {landed && current ? (
                  <>
                    <span className={styles.reelName}>{current.theme}</span>
                    <span className={styles.reelSub}>{current.words} words</span>
                  </>
                ) : phase === 'spinning' && current ? (
                  <span className={styles.reelBlur}>{current.theme}</span>
                ) : (
                  <span className={styles.reelName}>?</span>
                )}
              </div>
              <div className={cx(styles.reelRow, styles.reelDim, themes && classOf(pos + 1))}>
                {at(pos + 1)?.theme ?? ''}
              </div>
              <span className={styles.arrowL} aria-hidden="true" />
              <span className={styles.arrowR} aria-hidden="true" />
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            {landed ? (
              <>
                <button type="button" className={styles.bigBtn} onClick={play} disabled={creating}>
                  {creating ? 'Setting up...' : user ? 'Play it' : 'Sign in to play'}
                </button>
                <button type="button" className={styles.secBtn} onClick={spin} disabled={creating}>
                  Spin again
                </button>
              </>
            ) : (
              <>
                <button type="button" className={styles.bigBtn} onClick={spin} disabled={!themes || phase === 'spinning'}>
                  {phase === 'spinning' ? 'Spinning...' : themes ? 'SPIN!' : 'Loading...'}
                </button>
                <p className={styles.fine}>Your friend gets the exact same puzzle</p>
              </>
            )}
          </div>
        </div>
      )}

      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}
