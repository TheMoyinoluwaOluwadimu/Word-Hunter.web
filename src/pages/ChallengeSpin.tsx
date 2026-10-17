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

// Reel geometry. Must match .reelItem / .strip in Challenge.module.css.
const ROW_HEIGHT = 70;
const ROW_GAP = 10;
const PITCH = ROW_HEIGHT + ROW_GAP;
/** The themes are repeated this many times so the strip is always long enough to scroll through. */
const REPS = 15;
/** Matches the transition on .stripSpin. */
const SPIN_MS = 5000;

/** /challenge: spin a theme from the challenge pool, then play it to set the time to beat. */
export default function ChallengeSpin() {
  const { enabled, user } = useAuth();
  const navigate = useNavigate();
  const [themes, setThemes] = useState<Theme[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  // Which row of the long strip sits in the centre slot. It always rests in the second copy of
  // the list, so there are rows above and below to show. Spinning moves it forward a few laps.
  const [idx, setIdx] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spinning = useRef(false);
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
        setIdx(ok.length);
      } catch (e) {
        if (!ctrl.signal.aborted) setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => ctrl.abort();
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const n = themes?.length ?? 0;
  const pos = n > 0 ? idx % n : 0;

  // The reel has stopped on its target. Jump (no animation) to the same theme in the middle copy
  // of the strip, which looks identical but leaves room to spin again.
  const land = useCallback(() => {
    if (!spinning.current || n === 0) return;
    spinning.current = false;
    window.clearTimeout(timer.current);
    setAnimate(false);
    setIdx((i) => (i % n) + n);
    setPhase('landed');
  }, [n]);

  const spin = useCallback(() => {
    if (!themes || spinning.current) return;
    const target = Math.floor(Math.random() * n);
    setError(null);

    // Nothing to scroll through, or the player asked for less motion: land straight away.
    if (n === 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAnimate(false);
      setIdx(n + target);
      setPhase('landed');
      return;
    }

    // three or four full laps, then the distance to the target theme
    const delta = (target - (idx % n) + n) % n;
    const end = idx + (5 + Math.floor(Math.random() * 4)) * n + delta;
    spinning.current = true;
    setAnimate(true);
    setIdx(end);
    setPhase('spinning');
    // transitionend is the normal trigger; this covers the cases where it never fires
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(land, SPIN_MS + 200);
  }, [themes, n, idx, land]);

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

  const landed = phase === 'landed';

  return (
    <div className={cx(game.stage, game.roomy, 'enter')}>
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

          <div className={styles.reel} role="img" aria-label={landed && themes ? `Your theme: ${themes[pos].theme}` : 'Theme reel'}>
            <div className={styles.reelWindow}>
              <div className={styles.viewport}>
                {themes && (
                  <div
                    className={cx(styles.strip, animate && styles.stripSpin)}
                    // the centre slot is the second visible row, so show the row above it first
                    style={{ transform: `translateY(${-(idx - 1) * PITCH}px)` }}
                    onTransitionEnd={(e) => {
                      if (e.target === e.currentTarget && e.propertyName === 'transform') land();
                    }}
                  >
                    {Array.from({ length: n * REPS }, (_, i) => {
                      const t = themes[i % n];
                      return (
                        <div key={i} className={cx(styles.reelItem, styles[COLOR_CLASSES[(i % n) % 5]])}>
                          <span className={styles.reelName}>{t.theme}</span>
                          <span className={styles.reelSub}>{t.words} words</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className={styles.shadeTop} aria-hidden="true" />
                <div className={styles.shadeBottom} aria-hidden="true" />
                <div className={cx(styles.mystery, phase !== 'idle' && styles.mysteryGone)} aria-hidden="true">
                  ?
                </div>
                <div className={cx(styles.frame, landed && styles.frameLanded)} aria-hidden="true" />
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
            <Link to="/challenges" className={styles.linkBtn}>
              My challenges
            </Link>
          </div>
        </div>
      )}

      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}
