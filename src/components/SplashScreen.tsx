import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { cx } from '../lib/cx';
import styles from './SplashScreen.module.css';

/** Long enough for the blocks to snap together; short enough not to nag. */
const MIN_MS = 2300;
/** Never hold the player hostage if the sign-in check hangs. */
const MAX_MS = 6000;
const FADE_MS = 450;

type Color = 'red' | 'blue' | 'yellow' | 'green' | 'orange';

interface Block {
  text: string;
  color: Color;
  /** Where the block starts before flying in, and how far it is tilted. */
  dx: number;
  dy: number;
  rot: number;
}

// "WORD" over "CHUNK", each split into chunks like the puzzles themselves.
const ROWS: Block[][] = [
  [
    { text: 'WOR', color: 'red', dx: -150, dy: -220, rot: -40 },
    { text: 'D', color: 'yellow', dx: 140, dy: -180, rot: 35 },
  ],
  [
    { text: 'CH', color: 'blue', dx: -160, dy: 200, rot: 30 },
    { text: 'UN', color: 'green', dx: 30, dy: 260, rot: -25 },
    { text: 'K', color: 'orange', dx: 170, dy: 170, rot: 45 },
  ],
];

const CONFETTI: { left: number; delay: number; color: Color; size: number }[] = [
  { left: 8, delay: 0.1, color: 'yellow', size: 12 },
  { left: 22, delay: 1.1, color: 'blue', size: 9 },
  { left: 36, delay: 0.5, color: 'orange', size: 14 },
  { left: 52, delay: 1.6, color: 'green', size: 10 },
  { left: 66, delay: 0.3, color: 'red', size: 13 },
  { left: 80, delay: 1.3, color: 'yellow', size: 9 },
  { left: 92, delay: 0.8, color: 'blue', size: 12 },
];

const TIPS = [
  'Every word is built from chunks.',
  'Tap a placed tile to send it back.',
  'Solve once a day to grow your streak.',
  'Practice puzzles never touch your streak.',
  'Short chunks hide in long words.',
];

type Phase = 'show' | 'leaving' | 'gone';

/**
 * Splash shown once when the app opens. It stays until the blocks have finished
 * their animation AND the sign-in check is done, so the menu never pops in with
 * a stale "Guest" label. Tap anywhere to skip.
 */
export default function SplashScreen() {
  const { loading } = useAuth();
  const [phase, setPhase] = useState<Phase>('show');
  const [minElapsed, setMinElapsed] = useState(false);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  useEffect(() => {
    const min = window.setTimeout(() => setMinElapsed(true), MIN_MS);
    const max = window.setTimeout(() => setPhase((p) => (p === 'show' ? 'leaving' : p)), MAX_MS);
    return () => {
      window.clearTimeout(min);
      window.clearTimeout(max);
    };
  }, []);

  useEffect(() => {
    if (phase === 'show' && minElapsed && !loading) setPhase('leaving');
  }, [phase, minElapsed, loading]);

  // Unmount on a timer, not transitionend, so it also works with reduced motion.
  useEffect(() => {
    if (phase !== 'leaving') return;
    const t = window.setTimeout(() => setPhase('gone'), FADE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === 'gone') return null;

  const skip = () => setPhase((p) => (p === 'show' ? 'leaving' : p));
  let n = 0;

  return (
    <div
      className={cx(styles.splash, phase === 'leaving' && styles.leaving)}
      role="status"
      aria-label="Loading WordChunk"
      onClick={skip}
    >
      <div className={styles.confetti} aria-hidden="true">
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className={cx(styles.bit, styles[c.color])}
            style={{ left: `${c.left}%`, width: c.size, height: c.size, animationDelay: `${c.delay}s` }}
          />
        ))}
      </div>

      <div className={styles.logo} aria-hidden="true">
        {ROWS.map((row, r) => (
          <div key={r} className={styles.row}>
            {row.map((b) => {
              const i = n++;
              return (
                <span
                  key={b.text}
                  className={styles.tile}
                  style={
                    {
                      '--dx': `${b.dx}px`,
                      '--dy': `${b.dy}px`,
                      '--rot': `${b.rot}deg`,
                      '--delay': `${0.15 + i * 0.16}s`,
                    } as CSSProperties
                  }
                >
                  <span className={cx(styles.face, styles[b.color])}>{b.text}</span>
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <p className={styles.tagline}>Build words from chunks</p>

      <div className={styles.loader} aria-hidden="true">
        <div className={styles.track}>
          <div className={styles.fill} />
        </div>
        <p className={styles.tip}>{tip}</p>
      </div>
      <p className={styles.skip} aria-hidden="true">
        Tap to skip
      </p>
    </div>
  );
}
