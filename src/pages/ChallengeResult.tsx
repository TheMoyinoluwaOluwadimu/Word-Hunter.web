import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Confetti from '../components/Confetti';
import { TrophyIcon } from '../components/icons';
import { cx } from '../lib/cx';
import { createChallenge } from '../lib/challenge';
import type { Challenge, ChallengeEntry } from '../lib/challenge';
import { formatTime } from '../lib/format';
import game from '../game/Game.module.css';
import styles from './Challenge.module.css';

const RANK_ICONS = ['rank-1.svg', 'rank-2.svg', 'rank-3.svg'];

export function shareUrl(code: string): string {
  return `${window.location.origin}${window.location.pathname}#/c/${code}`;
}

const nameOf = (e: ChallengeEntry | undefined) => e?.name?.trim() || 'Player';

/** Digits of m:ss as painted blocks, like the countdown. */
function TimeBlocks({ seconds }: { seconds: number }) {
  const text = formatTime(seconds);
  const colors = ['c0', 'c1', 'c2', 'c3', 'c4'];
  return (
    <div className={styles.timeBlocks} role="img" aria-label={`Time ${text}`}>
      {text.split('').map((ch, i) =>
        ch === ':' ? (
          <span key={i} className={styles.timeColon} aria-hidden="true">
            :
          </span>
        ) : (
          <span
            key={i}
            className={cx(styles.timeDigit, styles[colors[i % colors.length]])}
            style={{ '--i': i } as CSSProperties}
            aria-hidden="true"
          >
            {ch}
          </span>
        ),
      )}
    </div>
  );
}

function Standings({ challenge }: { challenge: Challenge }) {
  const finished = challenge.entries.filter((e) => e.finished && e.seconds !== null);
  return (
    <section className={styles.standings}>
      <h2 className={styles.standingsTitle}>
        {challenge.code} · {finished.length} {finished.length === 1 ? 'player' : 'players'}
      </h2>
      <ol className={cx(styles.standingsList, 'stagger')}>
        {finished.map((e, i) => (
          <li key={i} className={cx(styles.standRow, e.isMe && styles.standMe)}>
            {i < RANK_ICONS.length ? (
              <img
                src={`${import.meta.env.BASE_URL}icons/${RANK_ICONS[i]}`}
                alt={`${i + 1}${['st', 'nd', 'rd'][i]} place`}
                width={34}
                height={34}
                className={styles.rankImg}
              />
            ) : (
              <span className={styles.rankNum}>{i + 1}</span>
            )}
            <span className={styles.standName}>
              {e.isMe ? 'You' : nameOf(e)}
              {e.isCreator && !e.isMe && <span className={styles.standTag}> · set it</span>}
            </span>
            <span className={styles.standTime}>{formatTime(e.seconds ?? 0)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function ChallengeResult({ challenge }: { challenge: Challenge }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const me = challenge.entries.find((e) => e.isMe);
  const creator = challenge.entries.find((e) => e.isCreator);
  const mine = me?.seconds ?? 0;
  const others = challenge.entries.filter((e) => !e.isMe && e.finished);
  const url = shareUrl(challenge.code);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy. Select the link and copy it by hand.');
    }
  }

  async function share() {
    setError(null);
    const text = `Beat my ${formatTime(mine)} on WordChunk!`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'WordChunk challenge', text, url });
      } catch {
        // dismissed the share sheet: nothing to do
      }
    } else {
      await copy();
    }
  }

  async function challengeBack() {
    setBusy(true);
    setError(null);
    try {
      const code = await createChallenge(challenge.puzzleFile);
      navigate(`/c/${code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  // ---- the creator: "time set", then the link to send ----
  if (challenge.isCreator) {
    const leader = others.length > 0 ? others[0] : undefined;
    return (
      <div className={styles.body}>
        {others.length === 0 && <Confetti />}
        <div className={styles.hero}>
          <p className={styles.eyebrowLine}>Challenge {challenge.code}</p>
          <h2 className={styles.heroTitle}>{others.length === 0 ? 'Time set!' : 'Your challenge'}</h2>
          {leader && leader.seconds !== null && (
            <p className={styles.heroSub}>
              {leader.seconds < mine
                ? `${nameOf(leader)} is ahead by ${mine - leader.seconds}s`
                : leader.seconds > mine
                  ? `You're ahead by ${leader.seconds - mine}s`
                  : `${nameOf(leader)} matched your time`}
            </p>
          )}
        </div>
        <TimeBlocks seconds={mine} />

        {others.length === 0 ? (
          <p className={styles.lead}>Now send it to a friend. They get the same board and one try to beat you.</p>
        ) : (
          <Standings challenge={challenge} />
        )}

        <section className={styles.shareBox}>
          <label htmlFor="share-link" className={styles.shareLabel}>
            Challenge link
          </label>
          <div className={styles.shareRow}>
            <input id="share-link" readOnly value={url} className={styles.shareInput} onFocus={(e) => e.target.select()} />
            <button type="button" className={styles.copyBtn} onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className={styles.shareNote}>
            Code <strong>{challenge.code}</strong> · {challenge.expired ? 'expired' : 'expires in 7 days'} · anyone with
            the link can play
          </p>
        </section>

        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.bigBtn} onClick={share}>
            Send to a friend
          </button>
          <Link to="/" className={styles.secBtn}>
            Main menu
          </Link>
        </div>
      </div>
    );
  }

  // ---- a friend: who won ----
  const theirs = creator?.seconds ?? null;
  const diff = theirs === null ? 0 : Math.abs(mine - theirs);
  const won = theirs !== null && mine < theirs;
  const tied = theirs !== null && mine === theirs;
  return (
    <div className={styles.body}>
      {won && <Confetti />}
      <div className={styles.hero}>
        <div className={styles.trophy}>
          <TrophyIcon size={96} />
        </div>
        <h2 className={styles.heroTitle}>{tied ? "It's a tie!" : won ? 'You win!' : `${nameOf(creator)} wins`}</h2>
        <p className={styles.heroSub}>
          {tied
            ? `Same time as ${nameOf(creator)}`
            : won
              ? `You beat ${nameOf(creator)} by ${diff} ${diff === 1 ? 'second' : 'seconds'}`
              : `${nameOf(creator)} beat you by ${diff} ${diff === 1 ? 'second' : 'seconds'}`}
        </p>
      </div>

      <div className={styles.vsRow}>
        <div className={styles.vsBox}>
          <p className={styles.vsLabel}>You</p>
          <p className={styles.vsTime}>{formatTime(mine)}</p>
        </div>
        <span className={styles.vsText}>vs</span>
        <div className={cx(styles.vsBox, styles.vsBoxDim)}>
          <p className={styles.vsLabel}>{nameOf(creator)}</p>
          <p className={styles.vsTime}>{theirs === null ? '--' : formatTime(theirs)}</p>
        </div>
      </div>

      <Standings challenge={challenge} />

      {error && <p className={styles.error}>{error}</p>}
      <div className={cx(styles.actions, styles.actionsRow)}>
        <Link to="/" className={styles.secBtn}>
          Main menu
        </Link>
        <button type="button" className={game.primaryBtn} onClick={challengeBack} disabled={busy}>
          {busy ? 'One moment...' : 'Challenge'}
        </button>
      </div>
    </div>
  );
}
