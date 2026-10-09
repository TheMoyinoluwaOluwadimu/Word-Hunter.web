import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import FireIcon from '../components/FireIcon';
import { BackIcon } from '../components/icons';
import { DAILY_PUZZLE_FILE } from '../config';
import Board from '../game/Board';
import styles from '../game/Game.module.css';
import { usePlayerStats } from '../hooks/usePlayerStats';
import { usePuzzle } from '../hooks/usePuzzle';
import { useTimer } from '../hooks/useTimer';
import { formatTime } from '../lib/format';
import { playSolvedSound } from '../lib/sound';
import { hasSolvedToday, loadStats, timeUntilReset } from '../lib/storage';

export default function Game() {
  const puzzleState = usePuzzle(DAILY_PUZZLE_FILE);
  const { stats, registerSolve } = usePlayerStats();
  const timer = useTimer();
  const { start, stop, reset } = timer;
  const navigate = useNavigate();

  // Decided once on entry. If it were derived live, finishing today's puzzle would
  // flip the page to the "case closed" screen underneath the solved overlay.
  const [showClosed, setShowClosed] = useState(() => hasSolvedToday(loadStats()));
  const [boardKey, setBoardKey] = useState(0);
  const [result, setResult] = useState<{ replay: boolean } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const inProgress = timer.status === 'running' && result === null;

  const handleSolved = useCallback(() => {
    stop();
    const { counted } = registerSolve();
    playSolvedSound();
    setResult({ replay: !counted });
  }, [stop, registerSolve]);

  function playAgain() {
    setResult(null);
    reset();
    setBoardKey((k) => k + 1);
  }

  function handleBackClick(e: React.MouseEvent) {
    // Leaving mid-puzzle loses this attempt, so ask first (only once a tile has been touched).
    if (inProgress) {
      e.preventDefault();
      setConfirmLeave(true);
    }
  }

  const themeText =
    puzzleState.status === 'ready'
      ? puzzleState.puzzle.theme
        ? `Theme: ${puzzleState.puzzle.theme}`
        : "Today's puzzle"
      : puzzleState.status === 'error'
        ? 'Theme unavailable'
        : 'Theme';

  return (
    <div className={styles.stage}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <Link to="/" className={styles.backBtn} aria-label="Back to menu" onClick={handleBackClick}>
            <BackIcon />
          </Link>
          <div className={styles.stamp}>LIVE DEMO</div>
        </div>
        <p className={styles.eyebrow}>Puzzle of the Day</p>
        <h1 className={styles.title}>Wordhunter</h1>
      </header>

      <div className={styles.metaRow}>
        <div className={styles.metaItem}>
          <span className={styles.dot} />
          <span data-testid="timer">{formatTime(timer.elapsed)}</span>
        </div>
        <div className={styles.streak}>
          <FireIcon />
          <span data-testid="streak">{stats.streak}</span>
        </div>
      </div>

      <div className={styles.themeBanner}>
        {/* hidden (not swapped) while loading, so no placeholder theme ever flashes */}
        <span data-testid="theme" style={{ visibility: puzzleState.status === 'loading' ? 'hidden' : 'visible' }}>
          {themeText}
        </span>
        <span className={styles.themeCount}>
          {puzzleState.status === 'ready' ? `${puzzleState.puzzle.items.length} words` : ''}
        </span>
      </div>

      {puzzleState.status === 'loading' && (
        <div className={styles.words}>
          <p className={styles.loading}>Loading puzzle...</p>
        </div>
      )}

      {puzzleState.status === 'error' && (
        <div className={styles.words}>
          <div className={styles.error}>
            {puzzleState.message}
            <br />
            <br />
            Check that <code>public/puzzles/{DAILY_PUZZLE_FILE}</code> exists and that <code>DAILY_PUZZLE_FILE</code> in{' '}
            <code>src/config.ts</code> matches its name.
          </div>
        </div>
      )}

      {puzzleState.status === 'ready' && showClosed && (
        <div className={styles.words}>
          <div className={styles.notice}>
            <p className={styles.noticeEyebrow}>Case closed</p>
            <p className={styles.noticeText}>
              You already solved today's {puzzleState.puzzle.theme ?? 'puzzle'}.
            </p>
            <p className={styles.noticeDim}>Next case in {timeUntilReset()}</p>
            <p className={styles.noticeStreak}>
              <FireIcon /> Streak: {stats.streak}
            </p>
            <div className={styles.noticeActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setShowClosed(false)}>
                Practice again (won't count)
              </button>
              <Link to="/" className={styles.secondaryBtn}>
                Main menu
              </Link>
            </div>
          </div>
        </div>
      )}

      {puzzleState.status === 'ready' && !showClosed && (
        <Board key={boardKey} puzzle={puzzleState.puzzle} onStart={start} onSolved={handleSolved} />
      )}

      {result && (
        <div className={styles.overlay} role="dialog" aria-label="Puzzle solved">
          <p className={styles.overlayBig}>{result.replay ? 'Nice replay!' : 'Solved!'}</p>
          <div className={styles.overlayTime} data-testid="final-time">
            {formatTime(timer.elapsed)}
          </div>
          <div className={styles.overlayFire}>
            <FireIcon size={22} />
            <span data-testid="final-streak">{stats.streak}</span>
          </div>
          <div className={styles.overlayActions}>
            <button type="button" className={styles.primaryBtn} onClick={playAgain}>
              Play again
            </button>
            <Link to="/" className={styles.secondaryBtn}>
              Main menu
            </Link>
          </div>
        </div>
      )}

      <p className={styles.apiNote}>
        Fill every slot. Correctness is only checked once the whole board is full · tap a filled tile to send it back to
        the pool
      </p>

      <ConfirmDialog
        open={confirmLeave}
        title="Leave this puzzle?"
        message="Your progress on this attempt won't be saved."
        confirmLabel="Leave"
        cancelLabel="Keep playing"
        onConfirm={() => {
          setConfirmLeave(false);
          navigate('/');
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
