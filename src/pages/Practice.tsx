import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BackIcon, CheckIcon, StopwatchIcon } from '../components/icons';
import { usePracticeProgress } from '../hooks/usePracticeProgress';
import { usePuzzleSchedule } from '../hooks/usePuzzleSchedule';
import { cx } from '../lib/cx';
import { formatTime } from '../lib/format';
import { fetchPuzzle } from '../lib/puzzle';
// @ts-ignore CSS modules are handled by the app bundler.
import styles from './Practice.module.css';

type Summary =
  | { status: 'loading' }
  | { status: 'ready'; theme: string; words: number }
  | { status: 'error' };

const BLOCK_COLORS = ['red', 'blue', 'yellow', 'orange', 'green'] as const;

const EMPTY: string[] = [];

function fallbackTheme(file: string): string {
  return file.replace(/\.json$/i, '');
}

export default function Practice() {
  const { progress } = usePracticeProgress();
  const sched = usePuzzleSchedule();
  const archiveFiles = sched.status === 'ready' ? sched.schedule.archive : EMPTY;
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});

  // Each file is read once, only for its theme and word count.
  useEffect(() => {
    const ctrl = new AbortController();
    for (const file of archiveFiles) {
      fetchPuzzle(file, ctrl.signal)
        .then((p) =>
          setSummaries((s) => ({
            ...s,
            [file]: { status: 'ready', theme: p.theme ?? fallbackTheme(file), words: p.items.length },
          })),
        )
        .catch(() => {
          if (!ctrl.signal.aborted) setSummaries((s) => ({ ...s, [file]: { status: 'error' } }));
        });
    }
    return () => ctrl.abort();
  }, [archiveFiles]);

  const solvedCount = archiveFiles.filter((f) => progress[f] !== undefined).length;
  const total = archiveFiles.length;

  return (
    <div className={styles.stage}>
      <header className={styles.sign}>
        <Link to="/" className={styles.backBtn} aria-label="Back to menu">
          <BackIcon />
        </Link>
        <div className={styles.headings}>
          <p className={styles.eyebrow}>Archive</p>
          <h1 className={styles.title}>Practice</h1>
        </div>
        <div className={styles.count} data-testid="practice-count">
          {solvedCount} / {total} solved
        </div>
      </header>

      <p className={styles.intro}>Pick any past puzzle and play it as often as you like. Practice never counts toward your streak.</p>

      {sched.status === 'loading' ? (
        <p className={styles.intro}>Loading...</p>
      ) : sched.status === 'error' ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Couldn't load the archive</p>
          <p className={styles.emptyText}>{sched.message}</p>
        </div>
      ) : total === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No past puzzles yet</p>
          <p className={styles.emptyText}>Yesterday's puzzle will show up here tomorrow.</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {archiveFiles.map((file, i) => {
            const summary: Summary = summaries[file] ?? { status: 'loading' };
            const entry = progress[file];
            const theme = summary.status === 'ready' ? summary.theme : fallbackTheme(file);
            const color = BLOCK_COLORS[i % BLOCK_COLORS.length];

            const inner = (
              <>
                <span className={cx(styles.block, styles[color])} aria-hidden="true">
                  {theme.charAt(0).toUpperCase()}
                </span>
                <span className={styles.text}>
                  <span className={styles.name}>{theme}</span>
                  <span className={styles.sub}>
                    {summary.status === 'ready' && `${summary.words} words`}
                    {summary.status === 'loading' && 'Loading...'}
                    {summary.status === 'error' && "Couldn't load this puzzle"}
                  </span>
                  {entry && (
                    <span className={styles.best}>
                      <StopwatchIcon size={16} />
                      Best {formatTime(entry.best)}
                    </span>
                  )}
                </span>
                {summary.status !== 'error' &&
                  (entry ? (
                    <span className={styles.done}>
                      <CheckIcon size={26} />
                      <span className={styles.again}>Replay</span>
                    </span>
                  ) : (
                    <span className={styles.play}>Play</span>
                  ))}
              </>
            );

            return (
              <li key={file}>
                {summary.status === 'error' ? (
                  <div className={cx(styles.row, styles.disabled)}>{inner}</div>
                ) : (
                  <Link to={`/practice/${file}`} className={styles.row}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
