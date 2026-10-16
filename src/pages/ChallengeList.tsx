import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import AccountDialog from '../components/AccountDialog';
import { BackIcon } from '../components/icons';
import game from '../game/Game.module.css';
import { cx } from '../lib/cx';
import { ChallengeError, listMyChallenges } from '../lib/challenge';
import type { ChallengeSummary } from '../lib/challenge';
import { formatTime } from '../lib/format';
import { fetchPuzzle } from '../lib/puzzle';
import styles from './Challenge.module.css';

type State =
  | { status: 'loading' }
  | { status: 'ready'; items: ChallengeSummary[] }
  | { status: 'error'; message: string };

const COLOR_CLASSES = ['c0', 'c1', 'c2', 'c3', 'c4'] as const;

function fallbackTheme(file: string): string {
  return file.replace(/\.json$/i, '');
}

function when(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

/** What the row says about where this challenge stands, and what tapping it will do. */
function describe(c: ChallengeSummary): { line: string; cta: string; waiting: boolean } {
  const them = c.creatorName?.trim() || 'a friend';
  const mine = c.mySeconds;
  const best = c.bestSeconds;

  if (!c.myFinished) {
    if (c.expired) return { line: 'Ended before you finished', cta: 'Ended', waiting: false };
    return {
      line: c.isCreator ? 'Set your time to start it' : `Challenged by ${them}`,
      cta: 'Play',
      waiting: true,
    };
  }

  const time = mine !== null ? formatTime(mine) : '';
  if (c.players <= 1) {
    return { line: `You: ${time} · waiting for a friend`, cta: c.expired ? 'Ended' : 'Share', waiting: false };
  }
  if (mine !== null && best !== null && mine <= best) {
    return { line: `You: ${time} · fastest of ${c.players}`, cta: 'Results', waiting: false };
  }
  return {
    line: `You: ${time} · best is ${best !== null ? formatTime(best) : '--'}`,
    cta: 'Results',
    waiting: false,
  };
}

/** /challenges: every challenge the player made or joined in the last 30 days. */
export default function ChallengeList() {
  const { user, enabled, loading: authLoading } = useAuth();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [themes, setThemes] = useState<Record<string, string>>({});
  const [accountOpen, setAccountOpen] = useState(false);
  const userId = user?.id;

  useEffect(() => {
    if (authLoading || !userId) return;
    let live = true;
    setState({ status: 'loading' });
    listMyChallenges().then(
      (items) => {
        if (!live) return;
        // ones waiting on you first, then newest first (the server already sorts by date)
        const sorted = [...items].sort((a, b) => Number(describe(b).waiting) - Number(describe(a).waiting));
        setState({ status: 'ready', items: sorted });
      },
      (e: unknown) => {
        if (live) setState({ status: 'error', message: e instanceof ChallengeError ? e.message : 'Could not load your challenges.' });
      },
    );
    return () => {
      live = false;
    };
  }, [authLoading, userId]);

  // theme names, read once per puzzle file
  useEffect(() => {
    if (state.status !== 'ready') return;
    const ctrl = new AbortController();
    for (const file of new Set(state.items.map((c) => c.puzzleFile))) {
      fetchPuzzle(file, ctrl.signal, 'challenges')
        .then((p) => setThemes((t) => ({ ...t, [file]: p.theme ?? fallbackTheme(file) })))
        .catch(() => {
          // unreadable file: the row falls back to the file name
        });
    }
    return () => ctrl.abort();
  }, [state]);

  const signedOut = !authLoading && !userId;

  return (
    <div className={cx(game.stage, game.roomy)}>
      <header className={game.header}>
        <Link to="/challenge" className={game.backBtn} aria-label="Back to challenge">
          <BackIcon />
        </Link>
        <div className={game.headings}>
          <p className={game.eyebrow}>Versus</p>
          <h1 className={game.title}>My challenges</h1>
        </div>
      </header>

      {!enabled ? (
        <div className={styles.notice}>
          <h2 className={styles.noticeTitle}>Challenges aren't available</h2>
          <p className={styles.noticeText}>Challenges need an account, and sign-in is not set up in this build.</p>
          <Link to="/" className={styles.secBtn}>
            Main menu
          </Link>
        </div>
      ) : signedOut ? (
        <div className={styles.notice}>
          <h2 className={styles.noticeTitle}>Sign in to see your challenges</h2>
          <p className={styles.noticeText}>Your challenges are saved to your account.</p>
          <button type="button" className={styles.bigBtn} onClick={() => setAccountOpen(true)}>
            Sign in
          </button>
          <Link to="/" className={styles.linkBtn}>
            Main menu
          </Link>
        </div>
      ) : state.status === 'loading' ? (
        <p className={styles.loading}>Loading your challenges...</p>
      ) : state.status === 'error' ? (
        <div className={styles.notice}>
          <h2 className={styles.noticeTitle}>Something went wrong</h2>
          <p className={styles.noticeText}>{state.message}</p>
          <Link to="/challenge" className={styles.secBtn}>
            Back
          </Link>
        </div>
      ) : state.items.length === 0 ? (
        <div className={styles.notice}>
          <h2 className={styles.noticeTitle}>No challenges yet</h2>
          <p className={styles.noticeText}>Spin a theme, set a time, then send it to a friend.</p>
          <Link to="/challenge" className={styles.bigBtn}>
            Spin a theme
          </Link>
        </div>
      ) : (
        <div className={styles.body}>
          <ul className={styles.list}>
            {state.items.map((c, i) => {
              const theme = themes[c.puzzleFile] ?? fallbackTheme(c.puzzleFile);
              const d = describe(c);
              return (
                <li key={c.code}>
                  <Link to={`/c/${c.code}`} className={cx(styles.listRow, d.waiting && styles.listRowWaiting)}>
                    <span className={cx(styles.listBlock, styles[COLOR_CLASSES[i % 5]])} aria-hidden="true">
                      {theme.charAt(0).toUpperCase()}
                    </span>
                    <span className={styles.listText}>
                      <span className={styles.listName}>{theme}</span>
                      <span className={styles.listSub}>{d.line}</span>
                      <span className={styles.listMeta}>
                        {when(c.createdAt)} · {c.isCreator ? 'you made it' : 'you joined'} · {c.code}
                      </span>
                    </span>
                    <span className={cx(styles.listCta, d.waiting && styles.listCtaHot)}>{d.cta}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className={styles.actions}>
            <Link to="/challenge" className={styles.bigBtn}>
              New challenge
            </Link>
          </div>
        </div>
      )}

      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}
