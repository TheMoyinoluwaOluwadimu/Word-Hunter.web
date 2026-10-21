import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import ConfirmDialog from '../components/ConfirmDialog';
import Confetti from '../components/Confetti';
import CountUp from '../components/CountUp';
import { BackIcon, StarIcon, StopwatchIcon, StreakIcon, TrophyIcon } from '../components/icons';
import Board from '../game/Board';
import styles from '../game/Game.module.css';
import { usePlayerStats } from '../hooks/usePlayerStats';
import { usePracticeProgress } from '../hooks/usePracticeProgress';
import { usePuzzle } from '../hooks/usePuzzle';
import type { PuzzleState } from '../hooks/usePuzzle';
import { usePuzzleSchedule } from '../hooks/usePuzzleSchedule';
import type { PuzzleSpec } from '../lib/puzzle';
import { markSeen } from '../lib/seen';
import { OfflineCard } from '../components/PwaUi';
import { useOnline } from '../lib/pwa';
import { useTimer } from '../hooks/useTimer';
import { finishDailyRun, startDailyRun } from '../lib/dailyRun';
import { buzzSolved } from '../lib/haptics';
import { formatTime } from '../lib/format';
import { playSolvedSound } from '../lib/sound';
import { hasSolvedToday, loadStats, timeUntilReset } from '../lib/storage';

interface GameProps {
  /** 'daily' is today's puzzle and feeds the streak. 'practice' is an archive puzzle and never does. */
  mode?: 'daily' | 'practice';
  /** Practice only: the archive puzzle file inside public/puzzles/. The daily puzzle is picked by date. */
  file?: string;
}

interface SolveResult {
  replay: boolean;
  newBest: boolean;
  best: number | null;
}

export default function Game({ mode = 'daily', file: practiceFile }: GameProps) {
  const practice = mode === 'practice';
  const sched = usePuzzleSchedule();
  const file = practice ? (practiceFile ?? null) : sched.status === 'ready' ? sched.schedule.daily : null;
  // Practice draws fresh words each time it starts or restarts; the daily is the same for everyone that day.
  const [practiceKey, setPracticeKey] = useState(() => Math.random().toString(36).slice(2));
  const spec = useMemo<PuzzleSpec | null>(() => {
    if (sched.status !== 'ready') return null;
    if (!practice) return { mode: 'daily', appearance: sched.schedule.dailyAppearance };
    return file ? { mode: 'practice', key: practiceKey, pastAppearances: sched.schedule.pastAppearances(file) } : null;
  }, [sched, practice, file, practiceKey]);
  const loaded = usePuzzle(file, spec);
  const puzzleState: PuzzleState =
    sched.status === 'error' && !practice ? { status: 'error', message: sched.message } : loaded;
  const online = useOnline();
  // remember which practice words were shown, so the next round leans on ones this player has not met
  useEffect(() => {
    if (practice && file && puzzleState.status === 'ready') {
      markSeen('practice', file, puzzleState.puzzle.items.map((i) => i.id));
    }
  }, [practice, file, puzzleState]);
  const archive = sched.status === 'ready' ? sched.schedule.archive : [];
  const { stats, registerSolve } = usePlayerStats();
  const { progress, registerPracticeSolve } = usePracticeProgress();
  const timer = useTimer();
  const { start, stop, reset } = timer;
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;
  // the server starts its own clock on the first tile pick-up, once per visit
  const dailyRunStarted = useRef(false);

  const exitPath = practice ? '/practice' : '/';

  // Decided once on entry. If it were derived live, finishing today's puzzle would
  // flip the page to the "all done" screen underneath the solved overlay.
  const [showClosed, setShowClosed] = useState(() => !practice && hasSolvedToday(loadStats()));
  const [boardKey, setBoardKey] = useState(0);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const inProgress = timer.status === 'running' && result === null;
  const bestSoFar = (file && progress[file]?.best) || null;

  const nextFile =
    practice && file && archive.length > 0 ? archive[(archive.indexOf(file) + 1) % archive.length] : null;
  const hasNext = nextFile !== null && nextFile !== file;

  const handleStart = useCallback(() => {
    start();
    if (practice || !userId || dailyRunStarted.current || hasSolvedToday(loadStats())) return;
    dailyRunStarted.current = true;
    void startDailyRun();
  }, [start, practice, userId]);

  const handleSolved = useCallback(() => {
    const secs = stop();
    playSolvedSound();
    buzzSolved();
    if (practice) {
      const rec = secs === null || !file ? null : registerPracticeSolve(file, secs);
      setResult({ replay: false, newBest: rec?.newBest ?? false, best: rec?.best ?? null });
    } else {
      const { counted } = registerSolve();
      // only the first solve of the day is ranked
      if (counted && userId && secs !== null) void finishDailyRun(secs);
      setResult({ replay: !counted, newBest: false, best: null });
    }
  }, [stop, practice, file, registerPracticeSolve, registerSolve, userId]);

  function playAgain() {
    if (practice) setPracticeKey(Math.random().toString(36).slice(2));
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
        : practice
          ? 'Practice puzzle'
          : "Today's puzzle"
      : puzzleState.status === 'error'
        ? online
          ? 'Theme unavailable'
          : 'WordChunk'
        : 'Theme';

  const overlayTitle = result?.newBest ? 'New best!' : result?.replay ? 'Nice replay!' : 'Well built!';

  return (
    <div className={`${styles.stage} enter`}>
      <header className={styles.header}>
        <Link
          to={exitPath}
          className={styles.backBtn}
          aria-label={practice ? 'Back to archive' : 'Back to menu'}
          onClick={handleBackClick}
        >
          <BackIcon />
        </Link>
        <div className={styles.headings}>
          <p className={styles.eyebrow}>{practice ? 'Practice' : 'Puzzle of the Day'}</p>
          {/* hidden (not swapped) while loading, so no placeholder theme ever flashes */}
          <h1
            className={styles.title}
            data-testid="theme"
            style={{ visibility: puzzleState.status === 'loading' ? 'hidden' : 'visible' }}
          >
            {themeText}
          </h1>
        </div>
      </header>

      <div className={styles.metaRow}>
        <div className={styles.metaItem}>
          <StopwatchIcon />
          <span data-testid="timer">{formatTime(timer.elapsed)}</span>
        </div>
        {practice ? (
          bestSoFar !== null && (
            <div className={styles.streak} title="Your fastest time on this puzzle">
              <TrophyIcon />
              <span data-testid="best">{formatTime(bestSoFar)}</span>
            </div>
          )
        ) : (
          <div className={styles.streak}>
            <StreakIcon />
            <span data-testid="streak">{stats.streak}</span>
          </div>
        )}
      </div>

      {puzzleState.status === 'loading' && (
        <div className={styles.words}>
          <p className={styles.loading}>Loading puzzle...</p>
        </div>
      )}

      {puzzleState.status === 'error' && !online && <OfflineCard />}

      {puzzleState.status === 'error' && online && (
        <div className={styles.words}>
          <div className={styles.error}>
            {puzzleState.message}
            <br />
            <br />
            Check that the puzzle files in <code>public/puzzles/</code> are valid JSON and that{' '}
            <code>npm run puzzles:index</code> has been run.
            {practice && (
              <div className={styles.noticeActions} style={{ marginTop: 14 }}>
                <Link to="/practice" className={styles.secondaryBtn}>
                  Back to archive
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {puzzleState.status === 'ready' && showClosed && (
        <div className={styles.words}>
          <div className={styles.notice}>
            <p className={styles.noticeEyebrow}>All done</p>
            <p className={styles.noticeText}>
              You already solved today's {puzzleState.puzzle.theme ?? 'puzzle'}.
            </p>
            <p className={styles.noticeDim}>Next puzzle in {timeUntilReset()}</p>
            <p className={styles.noticeStreak}>
              <StreakIcon /> Streak: {stats.streak}
            </p>
            <div className={styles.noticeActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setShowClosed(false)}>
                Replay
              </button>
              <Link to="/" className={styles.secondaryBtn}>
                Main menu
              </Link>
            </div>
          </div>
        </div>
      )}

      {puzzleState.status === 'ready' && !showClosed && (
        <Board key={boardKey} puzzle={puzzleState.puzzle} onStart={handleStart} onSolved={handleSolved} />
      )}

      {result && (
        <div className={styles.overlay} role="dialog" aria-label="Puzzle solved">
          <Confetti />
          <div className={styles.stars} aria-hidden="true">
            <StarIcon />
            <StarIcon />
            <StarIcon />
          </div>
          <p className={styles.overlayBig}>{overlayTitle}</p>
          <div className={styles.overlayTime} data-testid="final-time">
            {formatTime(timer.elapsed)}
          </div>
          {practice ? (
            result.best !== null && (
              <div className={styles.overlayFire}>
                <TrophyIcon size={24} />
                <span data-testid="final-best">Best {formatTime(result.best)}</span>
              </div>
            )
          ) : (
            <div className={styles.overlayFire}>
              <StreakIcon size={26} />
              <span data-testid="final-streak">
                <CountUp from={result.replay ? stats.streak : Math.max(0, stats.streak - 1)} to={stats.streak} />
              </span>
            </div>
          )}
          {practice && <p className={styles.overlayNote}>Practice doesn't count toward your streak.</p>}
          <div className={styles.overlayActions}>
            <button type="button" className={styles.primaryBtn} onClick={playAgain}>
              Play again
            </button>
            {hasNext && nextFile && (
              <Link to={`/practice/${nextFile}`} className={styles.secondaryBtn} replace>
                Next puzzle
              </Link>
            )}
            <Link to={exitPath} className={styles.secondaryBtn}>
              {practice ? 'Back to archive' : 'Main menu'}
            </Link>
          </div>
        </div>
      )}

      <p className={styles.apiNote}>
        Drag a tile into a slot, or tap a tile and then tap a slot. Correctness is only checked once the whole board
        is full · tap a placed tile to send it back
      </p>

      <ConfirmDialog
        open={confirmLeave}
        title="Leave this puzzle?"
        message="Your progress on this attempt won't be saved."
        confirmLabel="Leave"
        cancelLabel="Keep playing"
        onConfirm={() => {
          setConfirmLeave(false);
          navigate(exitPath);
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
