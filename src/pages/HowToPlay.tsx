import { Link } from 'react-router-dom';
import { BackIcon, ChallengeIcon, StreakIcon, TrophyIcon } from '../components/icons';
import game from '../game/Game.module.css';
import { cx } from '../lib/cx';
import challenge from './Challenge.module.css';
import styles from './HowToPlay.module.css';

const BASICS = [
  {
    color: 'blue',
    title: 'Read the clue',
    text: 'Every row has a clue. The answer is a word built from smaller chunks.',
  },
  {
    color: 'red',
    title: 'Drag the chunks into the slots',
    text: 'The tiles in the tray are shuffled. Drop each one into a slot, and tap a placed tile to send it back.',
  },
  {
    color: 'yellow',
    title: 'It checks itself',
    text: 'When every slot is filled, the board is checked. Right tiles lock in green. Wrong ones pop back out so you can try again.',
  },
] as const;

const MORE = [
  {
    icon: <StreakIcon size={34} />,
    title: 'One puzzle a day',
    text: 'A new puzzle arrives every day at midnight UTC. Solve it daily to grow your streak.',
  },
  {
    icon: <ChallengeIcon size={36} />,
    title: 'Race a friend',
    text: 'Spin a theme in Challenge, set your time and send the link. Same board, fastest time wins.',
  },
  {
    icon: <TrophyIcon size={34} />,
    title: 'Climb the leaderboard',
    text: 'Your time on the daily puzzle, your streak and your solves are ranked against everyone.',
  },
] as const;

/** /how-to-play: a looping demo of a row being solved, then the rules in plain words. */
export default function HowToPlay() {
  return (
    <div className={cx(game.stage, game.roomy, 'enter')}>
      <header className={game.header}>
        <Link to="/" className={game.backBtn} aria-label="Back to menu">
          <BackIcon />
        </Link>
        <div className={game.headings}>
          <p className={game.eyebrow}>Guide</p>
          <h1 className={game.title}>How to play</h1>
        </div>
        <span className={styles.mark} aria-hidden="true">
          ?
        </span>
      </header>

      <section className={styles.demo} aria-label="Example of solving one row">
        <p className={styles.clue}>A strong coffee brewed by forcing steam through grounds</p>
        <div className={styles.slots} aria-hidden="true">
          <div className={styles.slot}>
            <div className={cx(styles.tile, styles.t0)}>ES</div>
          </div>
          <div className={styles.slot}>
            <div className={cx(styles.tile, styles.t1)}>PRE</div>
          </div>
          <div className={styles.slot}>
            <div className={cx(styles.tile, styles.t2)}>SSO</div>
          </div>
        </div>
        <p className={styles.win}>Espresso!</p>
      </section>

      <h2 className={styles.heading}>The basics</h2>
      <ol className={cx(styles.steps, 'stagger')}>
        {BASICS.map((s, i) => (
          <li key={s.title} className={styles.step}>
            <span className={cx(styles.num, challenge[s.color === 'blue' ? 'c1' : s.color === 'red' ? 'c0' : 'c2'])}>{i + 1}</span>
            <span className={styles.stepText}>
              <span className={styles.stepTitle}>{s.title}</span>
              <span className={styles.stepBody}>{s.text}</span>
            </span>
          </li>
        ))}
      </ol>

      <h2 className={styles.heading}>More ways to play</h2>
      <ul className={cx(styles.steps, 'stagger')}>
        {MORE.map((s) => (
          <li key={s.title} className={styles.step}>
            <span className={styles.iconSlot}>{s.icon}</span>
            <span className={styles.stepText}>
              <span className={styles.stepTitle}>{s.title}</span>
              <span className={styles.stepBody}>{s.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className={styles.actions}>
        <Link to="/play" className={challenge.bigBtn}>
          Play today's puzzle
        </Link>
        <Link to="/" className={challenge.linkBtn}>
          Main menu
        </Link>
      </div>
    </div>
  );
}
