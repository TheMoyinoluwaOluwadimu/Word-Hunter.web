import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import styles from './AccountDialog.module.css';
import DialogClose from './DialogClose';

const COOLDOWN_SECONDS = 60;

/** Turns Supabase's raw auth errors into something a player can act on. */
function explain(message: string): { text: string; wait?: number } {
  // Per-address cooldown: "...you can only request this after 52 seconds."
  const secs = message.match(/after (\d+) seconds?/i);
  if (secs) return { text: `Please wait ${secs[1]} seconds before asking for another link.`, wait: Number(secs[1]) };
  if (/rate limit|too many/i.test(message)) {
    return {
      text: 'Too many sign-in emails right now. Try Google, or wait a bit and try again.',
      wait: COOLDOWN_SECONDS,
    };
  }
  return { text: message };
}

interface AccountDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Guests see sign-in options; signed-in players see their account with sign-out and delete. */
export default function AccountDialog({ open, onClose }: AccountDialogProps) {
  const { user, displayName, signInWithGoogle, signInWithEmail, signOut, updateUsername, deleteAccount } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  // Deliberately not reset when the dialog reopens, so closing it can't dodge the cooldown.
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  function startCooldown(seconds: number) {
    const t = Date.now();
    setNow(t);
    setCooldownUntil(t + seconds * 1000);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // The field starts on the current name (and follows it after a save).
  useEffect(() => {
    if (open) setNameDraft(displayName);
  }, [open, displayName]);

  // Start clean each time the dialog is reopened.
  useEffect(() => {
    if (open) {
      setError(null);
      setSent(false);
      setConfirmDelete(false);
      setNameSaved(false);
    }
  }, [open]);

  if (!open) return null;

  async function run(action: () => Promise<string | null | void>) {
    setBusy(true);
    setError(null);
    const message = await action();
    setBusy(false);
    if (message) {
      const { text, wait } = explain(message);
      setError(text);
      if (wait) startCooldown(wait);
    }
    return !message;
  }

  async function onEmailSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!email.trim() || secondsLeft > 0) return;
    if (await run(() => signInWithEmail(email.trim()))) {
      setSent(true);
      startCooldown(COOLDOWN_SECONDS);
    }
  }

  async function onNameSubmit(e: FormEvent) {
    e.preventDefault();
    setNameSaved(false);
    if (await run(() => updateUsername(nameDraft))) setNameSaved(true);
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogClose onClick={onClose} />
        <h2 id="account-title" className={styles.title}>
          {user ? 'Account' : 'Sign in'}
        </h2>

        <div className={styles.panel}>
          {user ? (
            <>
              <p className={styles.name}>{displayName}</p>
              {user.email && <p className={styles.dim}>{user.email}</p>}
              <form onSubmit={onNameSubmit} className={styles.form}>
                <label htmlFor="display-name" className={styles.fieldLabel}>
                  Display name <span className={styles.fieldHint}>· shown to players you challenge</span>
                </label>
                <input
                  id="display-name"
                  type="text"
                  value={nameDraft}
                  maxLength={24}
                  autoComplete="nickname"
                  onChange={(e) => {
                    setNameDraft(e.target.value);
                    setNameSaved(false);
                  }}
                  className={styles.input}
                />
                <button
                  type="submit"
                  className={styles.emailBtn}
                  disabled={busy || nameDraft.trim() === displayName || nameDraft.trim().length < 2}
                >
                  Save name
                </button>
                {nameSaved && <p className={styles.ok}>Saved</p>}
              </form>
              <p className={styles.dim}>Your streak and best times are saved to your account.</p>
              {confirmDelete && (
                <p className={styles.warn}>This permanently deletes your account and all saved progress.</p>
              )}
            </>
          ) : sent ? (
            <>
              <p className={styles.text}>
                Check <strong>{email}</strong> for a sign-in link. You can close this window.
              </p>
              <p className={styles.dim}>Nothing yet? Look in spam, or wait a minute for a new link.</p>
              <button type="button" className={styles.emailBtn} disabled={busy || secondsLeft > 0} onClick={onEmailSubmit}>
                {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend link'}
              </button>
              <button type="button" className={styles.linkBtn} onClick={() => setSent(false)}>
                Use a different email
              </button>
            </>
          ) : (
            <>
              <p className={styles.text}>Save your streak and play on any device. Your progress so far is kept.</p>
              <button type="button" className={styles.google} disabled={busy} onClick={() => run(signInWithGoogle)}>
                Continue with Google
              </button>
              <form onSubmit={onEmailSubmit} className={styles.form}>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  aria-label="Email address"
                />
                <button type="submit" className={styles.emailBtn} disabled={busy || secondsLeft > 0}>
                  {secondsLeft > 0 ? `Wait ${secondsLeft}s` : 'Email me a link'}
                </button>
              </form>
            </>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>

        {user && (
        <div className={styles.actions}>
          {user && !confirmDelete && (
            <>
              <button
                type="button"
                className={styles.secondary}
                disabled={busy}
                onClick={async () => {
                  if (await run(signOut)) onClose();
                }}
              >
                Sign out
              </button>
              <button type="button" className={styles.danger} onClick={() => setConfirmDelete(true)}>
                Delete account
              </button>
            </>
          )}
          {user && confirmDelete && (
            <>
              <button type="button" className={styles.secondary} onClick={() => setConfirmDelete(false)} autoFocus>
                Keep it
              </button>
              <button
                type="button"
                className={styles.danger}
                disabled={busy}
                onClick={async () => {
                  if (await run(deleteAccount)) onClose();
                }}
              >
                Delete forever
              </button>
            </>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
