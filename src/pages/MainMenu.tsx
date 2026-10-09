import { Link } from 'react-router-dom';
import FireIcon from '../components/FireIcon';
import { ArchiveIcon, BarsIcon, CheckIcon, ClockIcon, SettingsIcon, TrophyIcon } from '../components/icons';
import { DAILY_PUZZLE_FILE } from '../config';
import { useNow } from '../hooks/useNow';
import { usePlayerStats } from '../hooks/usePlayerStats';
import { usePuzzle } from '../hooks/usePuzzle';
import { cx } from '../lib/cx';
import { hasSolvedToday, timeUntilReset } from '../lib/storage';
import styles from './MainMenu.module.css';

export default function MainMenu() {
  const puzzleState = usePuzzle(DAILY_PUZZLE_FILE);
  const { stats } = usePlayerStats();
  const now = useNow(30_000);
  const solvedToday = hasSolvedToday(stats, now);

  const themeText =
    puzzleState.status === 'ready' ? (puzzleState.puzzle.theme ?? 'Daily Puzzle') : puzzleState.status === 'error' ? 'Daily Puzzle' : 'Loading';

  return (
    <div className={styles.stage}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Case File · Home</p>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Wordhunter</h1>
          <button type="button" className={styles.settingsBtn} title="Settings" aria-label="Settings">
            <SettingsIcon />
          </button>
        </div>
        <div className={styles.profileRow}>
          <div className={styles.avatar}>G</div>
          <span>Guest</span>
          <span className={styles.streakChip}>
            <FireIcon />
            <span data-testid="header-streak">{stats.streak}</span>
          </span>
        </div>
      </header>

      <div className={styles.body}>
        {/* today's case */}
        <Link to="/play" className={cx(styles.folder, styles.primary, solvedToday && styles.alreadySolved)}>
          <p className={styles.folderLabel}>Today's Case</p>
          {/* hidden (not swapped) until the real theme arrives, so no placeholder ever flashes */}
          <h2
            className={styles.folderTitle}
            data-testid="daily-theme"
            style={{ visibility: puzzleState.status === 'loading' ? 'hidden' : 'visible' }}
          >
            {themeText}
          </h2>
          <p className={styles.folderSub}>
            {solvedToday
              ? "You already solved today's case — tap to review or practice again."
              : 'One case a day. Solve it before the clock resets.'}
          </p>
          {solvedToday ? (
            <div className={styles.solvedBadge}>
              <CheckIcon />
              Solved today
            </div>
          ) : (
            <div className={styles.wordhunterBadge}>
              <TrophyIcon />
              Wordhunter yesterday
            </div>
          )}
          <div className={styles.folderMeta}>
            <span className={styles.countdown}>
              <ClockIcon />
              Resets in {timeUntilReset(now)}
            </span>
            <span className={styles.cta}>{solvedToday ? 'Review' : 'Open Case'}</span>
          </div>
        </Link>

        {/* secondary pair */}
        <div className={styles.row2}>
          <div className={styles.folder} tabIndex={0}>
            <p className={styles.folderLabel}>
              <img src="https://img.icons8.com/emoji/48/crossed-swards.png" alt="" width={14} height={14} style={{ display: 'block' }} />
              Versus
            </p>
            <h3 className={styles.folderTitle}>Challenge</h3>
            <p className={styles.folderSub}>Spin a theme, race a friend.</p>
          </div>
          <div className={styles.folder} tabIndex={0}>
            <p className={styles.folderLabel}>
              <ArchiveIcon />
              Archive
            </p>
            <h3 className={styles.folderTitle}>Practice</h3>
            <p className={styles.folderSub}>Past cases, any time.</p>
          </div>
        </div>

        {/* rankings */}
        <div className={styles.folder} tabIndex={0}>
          <p className={styles.folderLabel}>
            <BarsIcon />
            Rankings
          </p>
          <h3 className={styles.folderTitle}>Leaderboard</h3>
          <div className={styles.rankLine}>
            <p className={styles.folderSub} style={{ margin: 0 }}>
              Global standing this week
            </p>
            <span className={styles.rankNumber}>#—</span>
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <div className={cx(styles.stat, styles.statStreak)}>
          <div className={styles.statValue} data-testid="footer-streak">
            {stats.streak}
          </div>
          <div className={styles.statLabel}>Streak</div>
        </div>
        <div className={styles.divider} />
        <div className={styles.stat}>
          <div className={styles.statValue} data-testid="footer-solved">
            {stats.totalSolved}
          </div>
          <div className={styles.statLabel}>Solved</div>
        </div>
        <div className={styles.divider} />
        <div className={styles.stat}>
          <div className={styles.statValue}>#—</div>
          <div className={styles.statLabel}>Rank</div>
        </div>
      </footer>
    </div>
  );
}
