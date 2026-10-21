import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { setNextReturn, useAuth } from '../auth/AuthProvider';
import { COOLDOWN_SECONDS, explainAuthError } from '../lib/authErrors';
import { cx } from '../lib/cx';
import {
  closeSignInSheet,
  dismissMenuCard,
  hideWinCardToday,
  markGuestToday,
  menuCardHidden,
  openSignInSheet,
  useSignInSheet,
  winCardHidden,
} from '../lib/guest';
import { buzz } from '../lib/haptics';
import { TrophyIcon } from './icons';
import styles from './GuestPrompts.module.css';

/** The Google "G" on a white disc, as on the canvas. */
function GoogleMark() {
  return (
    <span className={styles.gMark}>
      <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#EA4335"
          d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"
        />
        <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
        <path
          fill="#34A853"
          d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
        />
      </svg>
    </span>
  );
}

/** Whether the app can offer sign-in at all right now (configured, signed out, finished loading). */
function useGuestState() {
  const { enabled, user, loading } = useAuth();
  return enabled && !user && !loading;
}

// The email cooldown lives outside the component on purpose, so closing the sheet cannot dodge it.
let emailCooldownUntil = 0;

type Mode = 'options' | 'email' | 'sent';

/** The sheet a guest sees when they tap Play (or "Sign in" on the menu card): Google, email, or carry on as a guest. */
export function SignInSheet() {
  const req = useSignInSheet();
  const { user, signInWithGoogle, signInWithEmail } = useAuth();
  const [mode, setMode] = useState<Mode>('options');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = Math.max(0, Math.ceil((emailCooldownUntil - now) / 1000));

  useEffect(() => {
    if (req) {
      setMode('options');
      setError(null);
      setBusy(false);
      setClosing(false);
    }
  }, [req]);

  // signed in (e.g. in another tab): nothing left to ask
  useEffect(() => {
    if (req && user) closeSignInSheet();
  }, [req, user]);

  useEffect(() => {
    if (emailCooldownUntil <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [mode, busy]);

  const close = (after?: () => void) => {
    setClosing(true);
    window.setTimeout(() => {
      closeSignInSheet();
      after?.();
    }, 230);
  };

  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  if (!req) return null;

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    setNextReturn(req!.returnTo);
    const message = await action();
    setBusy(false);
    if (message) {
      const { text, wait } = explainAuthError(message);
      setError(text);
      if (wait) {
        emailCooldownUntil = Date.now() + wait * 1000;
        setNow(Date.now());
      }
      buzz([30, 40, 30]);
      return false;
    }
    return true;
  }

  async function sendLink(e?: FormEvent) {
    e?.preventDefault();
    if (!email.trim() || secondsLeft > 0 || busy) return;
    if (await run(() => signInWithEmail(email.trim()))) {
      emailCooldownUntil = Date.now() + COOLDOWN_SECONDS * 1000;
      setNow(Date.now());
      setMode('sent');
      buzz([20, 40, 20]);
    }
  }

  const onGuest = req.onGuest;
  const title =
    mode === 'email' ? 'Email me a link' : mode === 'sent' ? 'Check your email' : "Get on today's leaderboard";
  const sub =
    mode === 'email'
      ? "We'll send a one-tap sign-in link. No password."
      : mode === 'sent'
        ? `We sent a sign-in link to ${email.trim()}. Open it on this phone.`
        : 'Guests can play, but only signed-in players are ranked.';

  return (
    <>
      <div className={cx(styles.backdrop, closing && styles.backdropOut)} onClick={() => close()} />
      <div
        className={cx(styles.sheet, closing && styles.sheetOut)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-sheet-title"
      >
        <div className={styles.grab} />
        <div className={styles.head}>
          {mode === 'sent' ? (
            <span className={styles.sentMark} aria-hidden="true">
              &#10003;
            </span>
          ) : (
            <span className={styles.trophy}>
              <TrophyIcon size={56} />
            </span>
          )}
          <div className={styles.headText}>
            <h2 id="guest-sheet-title" className={styles.title}>
              {title}
            </h2>
            <p className={styles.sub}>{sub}</p>
          </div>
        </div>

        {mode === 'options' && (
          <>
            <div className={styles.stack}>
              <button type="button" className={styles.btnYellow} disabled={busy} onClick={() => void run(signInWithGoogle)}>
                {busy ? <span className={styles.spinner} /> : <GoogleMark />}
                Continue with Google
              </button>
              <button type="button" className={styles.btnCream} disabled={busy} onClick={() => setMode('email')}>
                Email me a link
              </button>
            </div>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => {
                if (onGuest) markGuestToday();
                close(onGuest ?? undefined);
              }}
            >
              {onGuest ? 'Play as guest' : 'Not now'}
            </button>
            <p className={styles.fine}>Your streak and progress on this device are kept either way</p>
          </>
        )}

        {mode === 'email' && (
          <form onSubmit={sendLink}>
            <div className={styles.stack}>
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                placeholder="you@example.com"
                aria-label="Email address"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit" className={styles.btnYellow} disabled={busy || secondsLeft > 0}>
                {busy && <span className={styles.spinner} />}
                {secondsLeft > 0 ? `Wait ${secondsLeft}s` : 'Send link'}
              </button>
            </div>
            <button type="button" className={styles.linkBtn} onClick={() => setMode('options')}>
              Back
            </button>
          </form>
        )}

        {mode === 'sent' && (
          <>
            <div className={styles.stack}>
              <button type="button" className={styles.btnCream} disabled={busy || secondsLeft > 0} onClick={() => void sendLink()}>
                {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend link'}
              </button>
            </div>
            <button type="button" className={styles.linkBtn} onClick={() => setMode('email')}>
              Use a different email
            </button>
          </>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </>
  );
}

/** A dismissible card at the top of the menu for guests. Comes back a week after it is dismissed. */
export function MenuSignInCard() {
  const guest = useGuestState();
  const [hidden, setHidden] = useState(menuCardHidden);
  const [leaving, setLeaving] = useState(false);
  if (!guest || hidden) return null;

  return (
    <div role="note" className={cx(styles.menuCard, leaving && styles.menuCardOut)}>
      <span className={styles.menuTrophy}>
        <TrophyIcon size={40} />
      </span>
      <div className={styles.menuText}>
        <p className={styles.menuTitle}>You're not on the leaderboard</p>
        <p className={styles.menuSub}>Sign in to get ranked</p>
      </div>
      <button type="button" className={styles.menuBtn} onClick={() => openSignInSheet({ returnTo: '#/', onGuest: null })}>
        Sign in
      </button>
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Dismiss"
        onClick={() => {
          dismissMenuCard();
          setLeaving(true);
          window.setTimeout(() => setHidden(true), 300);
        }}
      >
        &#10005;
      </button>
    </div>
  );
}

/** Shown on the win screen after a guest solves the daily: ask while they are proud of the time. */
export function WinSignInCard({ time }: { time: string }) {
  const guest = useGuestState();
  const { signInWithGoogle } = useAuth();
  const [hidden, setHidden] = useState(winCardHidden);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!guest || hidden) return null;

  async function google() {
    setBusy(true);
    setError(null);
    setNextReturn('#/');
    const message = await signInWithGoogle();
    setBusy(false);
    if (message) setError(explainAuthError(message).text);
  }

  return (
    <section className={styles.winCard} aria-label="Sign in to save your progress">
      <p className={styles.winTitle}>Save your streak and join the board</p>
      <p className={styles.winText}>You finished in {time}. Sign in so your times and streak get ranked from now on.</p>
      <button type="button" className={styles.btnYellow} disabled={busy} onClick={() => void google()}>
        {busy ? <span className={styles.spinner} /> : <GoogleMark />}
        Continue with Google
      </button>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className={cx(styles.linkBtn, styles.winLater)}
        onClick={() => {
          hideWinCardToday();
          setHidden(true);
        }}
      >
        Maybe later
      </button>
    </section>
  );
}
