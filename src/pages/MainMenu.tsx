import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import AccountDialog from '../components/AccountDialog';
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
import { hasSolvedToday, timeUntilReset } from '../lib/storage';
// @ts-ignore CSS modules are handled by the app bundler.
import styles from './MainMenu.module.css';

export default function MainMenu() {
  const now = useNow(30_000);
  const sched = usePuzzleSchedule(now);
  const puzzleState = usePuzzle(sched.status === 'ready' ? sched.schedule.daily : null);
  const { stats } = usePlayerStats();
  const solvedToday = hasSolvedToday(stats, now);
  const { enabled, user, displayName } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  // Today's rank, once you've solved today's puzzle (null until then, or while signed out)
  const [rank, setRank] = useState<number | null>(null);
  const userId = user?.id;

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
    puzzleState.status === 'ready' ? (puzzleState.puzzle.theme ?? 'Daily Puzzle') : puzzleState.status === 'error' ? 'Daily Puzzle' : 'Loading';

  return (
    <div className={styles.stage}>
      <header className={styles.header}>
        <div className={styles.sign}>
          <h1 className={styles.title}>WordChunk</h1>
          <button type="button" className={styles.settingsBtn} title="Settings" aria-label="Settings">
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
              <span className={styles.profileName}>{user ? displayName : 'Guest · Sign in'}</span>
            </button>
          ) : (
            <>
              <div className={styles.avatar}>G</div>
              <span className={styles.profileName}>Guest</span>
            </>
          )}
          <span className={styles.streakChip}>
            <StreakIcon />
            <span data-testid="header-streak">{stats.streak}</span>
          </span>
        </div>
      </header>

      <div className={styles.body}>
        {/* today's puzzle */}
        <Link to="/play" className={cx(styles.today, solvedToday && styles.alreadySolved)}>
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
            {solvedToday
              ? "You already solved today's puzzle. Tap to review or practice again."
              : 'One puzzle a day. Solve it before the clock resets.'}
          </p>
          {solvedToday ? (
            <div className={styles.badge}>
              <CheckIcon />
              Solved today
            </div>
          ) : (
            <div className={styles.badge}>
              <TrophyIcon />
              WordChunk yesterday
            </div>
          )}
          <div className={styles.todayMeta}>
            <span className={styles.countdown}>
              <ClockIcon />
              Resets in {timeUntilReset(now)}
            </span>
            <span className={styles.cta}>{solvedToday ? 'Review' : 'Play'}</span>
          </div>
        </Link>

        {/* secondary pair */}
        <div className={styles.duo}>
          <Link to="/challenge" className={styles.card}>
            <span className={styles.cardIcon}>
              <ChallengeIcon />
            </span>
            <p className={styles.label}>Versus</p>
            <h3 className={styles.cardTitle}>Challenge</h3>
            <p className={styles.cardSub}>Spin a theme, race a friend.</p>
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
        <Link to="/leaderboard" className={`${styles.card} ${styles.wide}`}>
          <span className={styles.cardIcon}>
            <TrophyIcon size={46} />
          </span>
          <div className={styles.wideText}>
            <p className={styles.label}>Rankings</p>
            <h3 className={styles.cardTitle}>Leaderboard</h3>
            <p className={styles.cardSub}>{rank !== null ? "Today's fastest times" : "Solve today's puzzle to get ranked"}</p>
          </div>
          <span className={styles.rankNumber}>{rank !== null ? `#${rank}` : '#—'}</span>
        </Link>
      </div>

      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />

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
