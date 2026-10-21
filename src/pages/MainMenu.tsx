import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import AccountDialog from '../components/AccountDialog';
import SettingsDialog from '../components/SettingsDialog';
import {
  ArchiveIcon,
  ChallengeIcon,
  CheckIcon,
  ClockIcon,
  SettingsIcon,
  StreakIcon,
  TrophyIcon,
} from '../components/icons';
import { useNow } from '../hooks/useNow';
import { usePlayerStats } from '../hooks//usePlayerStats';
import { usePuzzle } from '../hooks/usePuzzle';
import { usePuzzleSchedule } from '../hooks/usePuzzleSchedule';
import { cx } from '../lib/cx';
import { getLeaderboard } from '../lib/leaderboard';
import { MenuSignInCard } from '../components/GuestPrompts';
import { openSignInSheet, shouldAskBeforePlay } from '../lib/guest';
import { maybeOfferInstall, useOnline } from '../lib/pwa';
import { hasSolvedToday, timeUntilReset } from '../lib/storage';
// @ts-ignore CSS modules are handled by the app bundler.
import styles from './MainMenu.module.css';

export default function MainMenu() {
  const now = useNow(30_000);
  const sched = usePuzzleSchedule(now);
  const puzzleState = usePuzzle(
    sched.status === 'ready' ? sched.schedule.daily : null,
    sched.status === 'ready' ? { mode: 'daily', appearance: sched.schedule.dailyAppearance } : null,
  );
  const { stats } = usePlayerStats();
  const solvedToday = hasSolvedToday(stats, now);
  const { enabled, user, displayName, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Today's rank, once you've solved today's puzzle (null until then, or while signed out)
  const [rank, setRank] = useState<number | null>(null);
  const userId = user?.id;
  const online = useOnline();
  const offlineNoPuzzle = !online && puzzleState.status === 'error';
  // tapping a card that needs the internet gives it a little shake instead of opening a dead screen
  const [shaking, setShaking] = useState<'challenge' | 'rank' | null>(null);
  const blockOffline = (which: 'challenge' | 'rank') => (e: React.MouseEvent) => {
    if (online) return;
    e.preventDefault();
    setShaking(null);
    window.requestAnimationFrame(() => setShaking(which));
  };

  // after a couple of solves, offer to install the app (once in a while, never while offline)
  useEffect(() => {
    if (!online) return;
    const t = window.setTimeout(() => maybeOfferInstall(stats.totalSolved), 1800);
    return () => window.clearTimeout(t);
  }, [online, stats.totalSolved]);

  useEffect(() => {
    if (!userId || !solvedToday) {
      setRank(null);
      return;
    }
    let live = true;
    getLeaderboard('today', 'global', 0).then(
      (b) => live && setRank(b.me?.rank ?? null),
      () => {
        // the card just keeps its placeholder
      },
    );
    return () => {
      live = false;
    };
  }, [userId, solvedToday]);

  const themeText =
    puzzleState.status === 'ready'
      ? (puzzleState.puzzle.theme ?? 'Daily Puzzle')
      : puzzleState.status === 'error'
        ? offlineNoPuzzle
          ? 'Puzzle of the day'
          : 'Daily Puzzle'
        : 'Loading';

  return (
    <div className={`${styles.stage} enter`}>
      <header className={styles.header}>
        <div className={styles.sign}>
          <h1 className={styles.title}>WordChunk</h1>
          <button
            type="button"
            className={styles.settingsBtn}
            title="Settings"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon />
          </button>
        </div>
        <div className={styles.profileRow}>
          {enabled ? (
            <button
              type="button"
              className={styles.profileBtn}
              onClick={() => setAccountOpen(true)}
              aria-label={user ? 'Account' : 'Sign in'}
            >
              <span className={styles.avatar}>{displayName.charAt(0).toUpperCase()}</span>
              <span className={styles.profileName}>{user ? displayName : <>Guest · <span className={styles.signLink}>Sign in?</span></>}</span>
            </button>
          ) : (
            <>
              <div className={styles.avatar}>G</div>
              <span className={styles.profileName}>Guest</span>
            </>
          )}
          <span key={stats.streak} className={cx(styles.streakChip, stats.streak > 0 && styles.streakPop)}>
            <StreakIcon />
            <span data-testid="header-streak">{stats.streak}</span>
          </span>
        </div>
      </header>

      <MenuSignInCard />

      <div className={`${styles.body} stagger`}>
        {/* today's puzzle */}
        <Link
          to="/play"
          className={cx(styles.today, solvedToday && styles.alreadySolved)}
          onClick={(e) => {
            if (offlineNoPuzzle) {
              e.preventDefault();
              window.location.reload(); // Retry
              return;
            }
            // a guest who has not picked "Play as guest" today gets the sign-in sheet first
            if (enabled && !user && !authLoading && !solvedToday && shouldAskBeforePlay()) {
              e.preventDefault();
              openSignInSheet({ returnTo: '#/play', onGuest: () => navigate('/play') });
            }
          }}
        >
          <p className={styles.label}>Today's puzzle</p>
          {/* hidden (not swapped) until the real theme arrives, so no placeholder ever flashes */}
          <h2
            className={styles.todayTitle}
            data-testid="daily-theme"
            style={{ visibility: puzzleState.status === 'loading' ? 'hidden' : 'visible' }}
          >
            {themeText}
          </h2>
          <p className={styles.todaySub}>
            {offlineNoPuzzle
              ? "Today's puzzle needs a connection to load."
              : solvedToday
                ? "You already solved today's puzzle. Tap to review or practice again."
                : 'One puzzle a day. Solve it before the clock resets.'}
          </p>
          {solvedToday ? (
            <div className={styles.badge}>
              <CheckIcon />
              Solved today
            </div>
          ) : null}
          <div className={styles.todayMeta}>
            <span className={styles.countdown}>
              <ClockIcon />
              {offlineNoPuzzle ? 'Waiting for a connection' : `Resets in ${timeUntilReset(now)}`}
            </span>
            <span className={cx(styles.cta, !solvedToday && !offlineNoPuzzle && styles.ctaPulse)}>
              {offlineNoPuzzle ? 'Retry' : solvedToday ? 'Review' : 'Play'}
            </span>
          </div>
        </Link>

        {/* secondary pair */}
        <div className={styles.duo}>
          <Link
            to="/challenge"
            className={cx(styles.card, !online && styles.cardOffline, shaking === 'challenge' && styles.cardShake)}
            onClick={blockOffline('challenge')}
          >
            <span className={styles.cardIcon}>
              <ChallengeIcon />
            </span>
            <p className={styles.label}>Versus</p>
            <h3 className={styles.cardTitle}>Challenge</h3>
            <p className={styles.cardSub}>{online ? 'Spin a theme, race a friend.' : 'Needs a connection'}</p>
          </Link>
          <Link to="/practice" className={styles.card}>
            <span className={styles.cardIcon}>
              <ArchiveIcon />
            </span>
            <p className={styles.label}>Archive</p>
            <h3 className={styles.cardTitle}>Practice</h3>
            <p className={styles.cardSub}>Past puzzles, any time.</p>
          </Link>
        </div>

        {/* rankings */}
        <Link
          to="/leaderboard"
          className={cx(styles.card, styles.wide, !online && styles.cardOffline, shaking === 'rank' && styles.cardShake)}
          onClick={blockOffline('rank')}
        >
          <span className={styles.cardIcon}>
            <TrophyIcon size={46} />
          </span>
          <div className={styles.wideText}>
            <p className={styles.label}>Rankings</p>
            <h3 className={styles.cardTitle}>Leaderboard</h3>
            <p className={styles.cardSub}>
              {!online ? 'Back online to see rankings' : rank !== null ? "Today's fastest times" : "Solve today's puzzle to get ranked"}
            </p>
          </div>
          <span className={styles.rankNumber}>{rank !== null ? `#${rank}` : '#—'}</span>
        </Link>
      </div>

      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <footer className={styles.footer}>
        <div className={styles.stat}>
          <div className={styles.statValue} data-testid="footer-streak">
            {stats.streak}
          </div>
          <div className={styles.statLabel}>Streak</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue} data-testid="footer-solved">
            {stats.totalSolved}
          </div>
          <div className={styles.statLabel}>Solved</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{rank !== null ? `#${rank}` : '#—'}</div>
          <div className={styles.statLabel}>Rank</div>
        </div>
      </footer>
    </div>
  );
}
