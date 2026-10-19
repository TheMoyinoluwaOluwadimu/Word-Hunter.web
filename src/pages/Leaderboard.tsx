import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import AccountDialog from '../components/AccountDialog';
import { BackIcon, ClockIcon, StreakIcon, TrophyIcon } from '../components/icons';
import game from '../game/Game.module.css';
import { usePuzzle } from '../hooks/usePuzzle';
import { usePuzzleSchedule } from '../hooks/usePuzzleSchedule';
import { cx } from '../lib/cx';
import { formatTime } from '../lib/format';
import { getLeaderboard } from '../lib/leaderboard';
import type { Board, BoardEntry, BoardScope, BoardTab } from '../lib/leaderboard';
import { timeUntilReset } from '../lib/storage';
import challenge from './Challenge.module.css';
import styles from './Leaderboard.module.css';

type State = { status: 'loading' } | { status: 'ready'; board: Board } | { status: 'error'; message: string };

const TABS: { id: BoardTab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'streak', label: 'Streak' },
  { id: 'alltime', label: 'All time' },
];

const COLORS = ['c0', 'c1', 'c2', 'c3', 'c4'] as const;
const RANK_ICONS = ['rank-1.svg', 'rank-2.svg', 'rank-3.svg'];
/** Podium columns left to right: 2nd, 1st, 3rd. Index into the sorted entries. */
const PODIUM_ORDER = [1, 0, 2];
const PODIUM_HEIGHT = [88, 64, 50];

/** The same name always gets the same block colour. */
function colorOf(name: string): string {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return challenge[COLORS[sum % COLORS.length]];
}

/** Renders a board value the way its tab means it. */
function Value({ tab, value, big }: { tab: BoardTab; value: number; big?: boolean }) {
  if (tab === 'today') return <>{formatTime(value)}</>;
  if (tab === 'streak') {
    return (
      <span className={styles.valueWithIcon}>
        <StreakIcon size={big ? 22 : 17} />
        {value}
      </span>
    );
  }
  return (
    <>
      {value}
      <span className={styles.unit}> solved</span>
    </>
  );
}

const SUBTITLES: Record<BoardTab, string> = {
  today: "Fastest on today's puzzle",
  streak: 'Longest current daily streak',
  alltime: 'Most puzzles solved',
};

const EMPTY_HINTS: Record<BoardTab, string> = {
  today: "Solve today's puzzle to get ranked",
  streak: "Solve today's puzzle to start a streak",
  alltime: "Solve today's puzzle to get ranked",
};

/** /leaderboard: the top 20 for today's time, current streak and puzzles solved, plus your own row. */
export default function Leaderboard() {
  const { user, enabled, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<BoardTab>('today');
  const [scope, setScope] = useState<BoardScope>('global');
  const [state, setState] = useState<State>({ status: 'loading' });
  const [accountOpen, setAccountOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const userId = user?.id;
  const signedIn = userId !== undefined;

  const sched = usePuzzleSchedule();
  const daily = usePuzzle(sched.status === 'ready' ? sched.schedule.daily : null);
  const theme = daily.status === 'ready' ? daily.puzzle.theme : null;

  // signed-out visitors can look at the global boards, nothing more
  const activeScope: BoardScope = signedIn ? scope : 'global';

  useEffect(() => {
    if (authLoading || !enabled) return;
    let live = true;
    setState({ status: 'loading' });
    getLeaderboard(tab, activeScope, 20).then(
      (board) => live && setState({ status: 'ready', board }),
      (e: unknown) => live && setState({ status: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' }),
    );
    return () => {
      live = false;
    };
  }, [tab, activeScope, userId, authLoading, enabled, reloadKey]);

  const board = state.status === 'ready' ? state.board : null;
  const entries = board?.entries ?? [];
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  const me = board?.me ?? null;

  // who is just ahead of you, for "3s behind #11"
  const ahead = me ? [...entries].reverse().find((e) => e.rank < me.rank) : undefined;
  const gap = me && ahead ? Math.abs(me.value - ahead.value) : null;
  const gapText =
    gap === null || !ahead
      ? me && me.rank === 1
        ? "You're in front"
        : me && !entries.some((e) => e.isMe)
          ? 'Outside the top 20'
          : ''
      : tab === 'today'
        ? `${gap}s behind #${ahead.rank}`
        : `${gap} behind #${ahead.rank}`;

  const guest = !signedIn && !authLoading;

  function row(e: BoardEntry, key: string | number) {
    return (
      <li key={key} className={cx(styles.row, e.isMe && styles.rowMe)}>
        <span className={styles.rowRank}>{e.rank}</span>
        <span className={cx(styles.avatarSm, colorOf(e.name))}>{e.name.charAt(0).toUpperCase()}</span>
        <span className={styles.rowName}>{e.isMe ? 'You' : e.name}</span>
        <span className={styles.rowValue}>
          <Value tab={tab} value={e.value} />
        </span>
      </li>
    );
  }

  return (
    <div className={cx(game.stage, game.roomy, 'enter')}>
      <header className={game.header}>
        <Link to="/" className={game.backBtn} aria-label="Back to menu">
          <BackIcon />
        </Link>
        <div className={game.headings}>
          <p className={game.eyebrow}>Rankings</p>
          <h1 className={game.title}>Leaderboard</h1>
        </div>
        <TrophyIcon size={40} />
      </header>

      {!enabled ? (
        <div className={challenge.notice}>
          <h2 className={challenge.noticeTitle}>Leaderboard unavailable</h2>
          <p className={challenge.noticeText}>The leaderboard needs an account, and sign-in is not set up in this build.</p>
          <Link to="/" className={challenge.secBtn}>
            Main menu
          </Link>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Leaderboard type" className={styles.tabs}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={cx(styles.tab, tab === t.id && styles.tabOn)}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className={styles.subRow}>
            <span>
              {SUBTITLES[tab]}
              {tab === 'today' && theme ? (
                <>
                  {' '}
                  · <strong>{theme}</strong>
                </>
              ) : null}
            </span>
            {tab === 'today' ? (
              <span className={styles.reset}>
                <ClockIcon size={17} />
                {timeUntilReset()}
              </span>
            ) : (
              <span>{tab === 'streak' ? 'Days in a row' : 'Since the board began'}</span>
            )}
          </div>

          {signedIn && (
            <div className={styles.scope} role="group" aria-label="Who to rank">
              <button
                type="button"
                aria-pressed={scope === 'global'}
                className={cx(styles.scopeBtn, scope === 'global' && styles.scopeOn)}
                onClick={() => setScope('global')}
              >
                Everyone
              </button>
              <button
                type="button"
                aria-pressed={scope === 'friends'}
                className={cx(styles.scopeBtn, scope === 'friends' && styles.scopeOn)}
                onClick={() => setScope('friends')}
              >
                Friends
              </button>
            </div>
          )}

          {state.status === 'loading' || authLoading ? (
            <p className={challenge.loading}>Loading the board...</p>
          ) : state.status === 'error' ? (
            <div className={challenge.notice}>
              <h2 className={challenge.noticeTitle}>Couldn't load it</h2>
              <p className={challenge.noticeText}>{state.message}</p>
              <button type="button" className={challenge.secBtn} onClick={() => setReloadKey((k) => k + 1)}>
                Try again
              </button>
            </div>
          ) : entries.length === 0 ? (
            <div className={challenge.notice}>
              {activeScope === 'friends' ? (
                <>
                  <h2 className={challenge.noticeTitle}>No friends here yet</h2>
                  <p className={challenge.noticeText}>
                    Anyone you challenge, or who plays your challenge, shows up here. Send someone a challenge to get
                    started.
                  </p>
                  <Link to="/challenge" className={challenge.bigBtn}>
                    Start a challenge
                  </Link>
                </>
              ) : (
                <>
                  <h2 className={challenge.noticeTitle}>Nobody's on the board yet</h2>
                  <p className={challenge.noticeText}>Be the first. {EMPTY_HINTS[tab]}.</p>
                  <Link to="/play" className={challenge.bigBtn}>
                    Play today's puzzle
                  </Link>
                </>
              )}
            </div>
          ) : (
            <>
              <div className={cx(styles.podium, 'stagger')}>
                {PODIUM_ORDER.filter((i) => i < podium.length).map((i) => {
                  const e = podium[i];
                  return (
                    <div key={i} className={styles.podiumCol}>
                      <span className={cx(styles.avatar, i === 0 && styles.avatarFirst, colorOf(e.name), e.isMe && styles.avatarMe)}>
                        {e.name.charAt(0).toUpperCase()}
                      </span>
                      <p className={cx(styles.podiumName, i === 0 && styles.podiumNameFirst)}>{e.isMe ? 'You' : e.name}</p>
                      <p className={cx(styles.podiumValue, i === 0 && styles.podiumValueFirst)}>
                        <Value tab={tab} value={e.value} big={i === 0} />
                      </p>
                      <div className={cx(styles.pedestal, styles[`pedestal${i}`])} style={{ height: PODIUM_HEIGHT[i] }}>
                        <img
                          src={`${import.meta.env.BASE_URL}icons/${RANK_ICONS[i]}`}
                          alt={`${i + 1}${['st', 'nd', 'rd'][i]} place`}
                          width={i === 0 ? 52 : i === 1 ? 40 : 34}
                          height={i === 0 ? 52 : i === 1 ? 40 : 34}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {rest.length > 0 && (
                <div className={cx(styles.listWrap, guest && styles.listGuest)}>
                  <ol className={cx(styles.list, 'stagger')}>{(guest ? rest.slice(0, 3) : rest).map((e, i) => row(e, `${e.rank}-${i}`))}</ol>
                  {guest && <div className={styles.fade} aria-hidden="true" />}
                </div>
              )}
            </>
          )}

          {guest && state.status === 'ready' && entries.length > 0 && (
            <section className={styles.joinCard}>
              <TrophyIcon size={56} />
              <h2 className={styles.joinTitle}>Join the board</h2>
              <p className={styles.joinText}>Sign in and your times and streak get ranked against everyone playing.</p>
              <button type="button" className={challenge.bigBtn} onClick={() => setAccountOpen(true)}>
                Sign in to play
              </button>
              <p className={styles.joinFine}>Your progress on this device is kept</p>
            </section>
          )}

          {signedIn && state.status === 'ready' && (
            <div className={styles.pinned}>
              {me ? (
                <div className={styles.meRow}>
                  <span className={styles.meRank}>#{me.rank}</span>
                  <span className={styles.meText}>
                    <strong>You</strong>
                    {gapText && <span className={styles.meGap}>{gapText}</span>}
                  </span>
                  <span className={styles.meValue}>
                    <Value tab={tab} value={me.value} big />
                  </span>
                </div>
              ) : (
                <div className={styles.meRow}>
                  <span className={cx(styles.meRank, styles.meRankNone)}>#—</span>
                  <span className={styles.meText}>
                    <strong>You</strong>
                    <span className={styles.meGap}>{activeScope === 'friends' ? 'Not on this board yet' : EMPTY_HINTS[tab]}</span>
                  </span>
                  {tab === 'today' || activeScope === 'global' ? (
                    <Link to="/play" className={styles.meCta}>
                      Play
                    </Link>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}
