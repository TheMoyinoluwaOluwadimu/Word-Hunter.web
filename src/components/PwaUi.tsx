import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { buzz } from '../lib/haptics';
import { cx } from '../lib/cx';
import {
  applyUpdate,
  closeInstallSheet,
  dismissUpdate,
  runNativeInstall,
  useInstallSheet,
  useJustReconnected,
  useJustUpdated,
  useOnline,
  useUpdateReady,
} from '../lib/pwa';
import styles from './PwaUi.module.css';

/* ---------- icons (stroke style, same family as the canvas) ---------- */

function Svg({ size, color, children, className }: { size: number; color: string; children: React.ReactNode; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function WifiOffIcon({ size = 18, color = 'currentColor', className }: { size?: number; color?: string; className?: string }) {
  return (
    <Svg size={size} color={color} className={className}>
      <path d="M2 8.8a15 15 0 0 1 4.2-2.6" />
      <path d="M10 5.2a15 15 0 0 1 12 3.6" />
      <path d="M5 12.5a10 10 0 0 1 3.1-2" />
      <path d="M13.2 10.2a10 10 0 0 1 5.8 2.3" />
      <path d="M8.5 16.2a5 5 0 0 1 5.4-.9" />
      <path d="M12 20h.01" />
      <path d="M3 3l18 18" />
    </Svg>
  );
}

export function DownloadIcon({ size = 24, color = 'currentColor', className }: { size?: number; color?: string; className?: string }) {
  return (
    <Svg size={size} color={color} className={className}>
      <path d="M12 4v12" />
      <path d="M6 11l6 6 6-6" />
      <path d="M5 20h14" />
    </Svg>
  );
}

function ShareIcon({ size = 22, color = '#2e6fd8' }: { size?: number; color?: string }) {
  return (
    <Svg size={size} color={color}>
      <path d="M12 15V3" />
      <path d="M8 7l4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </Svg>
  );
}

/** Pages where a reload would throw away a puzzle in progress: no update toast there. */
function onPuzzleRoute(pathname: string): boolean {
  return pathname === '/play' || pathname.startsWith('/practice/') || pathname.startsWith('/c/');
}

/* ---------- offline / back online strip ---------- */

export function ConnectionStrip() {
  const online = useOnline();
  const back = useJustReconnected();
  const variant: 'off' | 'ok' | null = !online ? 'off' : back ? 'ok' : null;
  const { pathname } = useLocation();

  // keep the last variant on screen while it slides away
  const [shown, setShown] = useState<'off' | 'ok' | null>(variant);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (variant) {
      setShown(variant);
      setLeaving(false);
      return;
    }
    setLeaving(true);
    const t = window.setTimeout(() => setShown(null), 280);
    return () => window.clearTimeout(t);
  }, [variant]);

  // pages other than the menu start right at the top, so while the strip is up they make room for it
  useEffect(() => {
    document.documentElement.classList.toggle('with-strip', shown !== null && pathname !== '/');
    return () => document.documentElement.classList.remove('with-strip');
  }, [shown, pathname]);

  // a tiny buzz when the signal drops
  const wasOnline = useRef(online);
  useEffect(() => {
    if (wasOnline.current && !online) buzz(25);
    wasOnline.current = online;
  }, [online]);

  if (!shown) return null;
  return (
    <div
      key={shown}
      role="status"
      className={cx(styles.strip, shown === 'ok' && styles.stripOk, leaving && styles.stripLeaving)}
    >
      {shown === 'off' ? (
        <>
          <WifiOffIcon className={styles.wifi} />
          You're offline. Practice still works
        </>
      ) : (
        <>
          <span className={styles.tick}>&#10003;</span>
          Back online
        </>
      )}
    </div>
  );
}

/* ---------- update toast ---------- */

export function UpdateToast() {
  const ready = useUpdateReady();
  const justUpdated = useJustUpdated();
  const { pathname } = useLocation();
  const [updating, setUpdating] = useState(false);
  const [gone, setGone] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [offsetY, setOffsetY] = useState(0);

  if (justUpdated && !ready) {
    return (
      <div role="status" className={cx(styles.toast, styles.toastOk)}>
        <span className={styles.tick}>&#10003;</span>
        <span className={styles.toastTitle}>You're on the latest version</span>
      </div>
    );
  }

  if (!ready || onPuzzleRoute(pathname)) return null;

  const dismiss = () => {
    setGone(true);
    window.setTimeout(dismissUpdate, 220);
  };

  return (
    <div
      role="status"
      className={cx(styles.toast, gone && styles.toastGone)}
      style={offsetY ? { transform: `translateY(${offsetY}px)`, transition: 'none' } : undefined}
      // slide it down to put it away for now
      onTouchStart={(e) => {
        drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchMove={(e) => {
        if (!drag.current) return;
        setOffsetY(Math.max(0, e.touches[0].clientY - drag.current.y));
      }}
      onTouchEnd={() => {
        const far = offsetY > 50;
        drag.current = null;
        setOffsetY(0);
        if (far) dismiss();
      }}
    >
      <span className={styles.toastIcon}>
        <DownloadIcon color="#fff4dc" className={updating ? undefined : styles.bob} />
      </span>
      <span className={styles.toastText}>
        <span className={styles.toastTitle}>New version ready</span>
        <span className={styles.toastSub}>Refresh to get the latest puzzles and fixes</span>
      </span>
      <button
        type="button"
        className={styles.refresh}
        disabled={updating}
        onClick={() => {
          buzz(20);
          setUpdating(true);
          applyUpdate();
        }}
      >
        {updating ? <span className={styles.spinner} /> : null}
        {updating ? 'Updating' : 'Refresh'}
      </button>
    </div>
  );
}

/* ---------- install sheet ---------- */

const BENEFITS: { text: string; bg: string; fg: string }[] = [
  { text: 'Opens full screen, like a real app', bg: '#2f9d6a', fg: '#fff4dc' },
  { text: 'Loads instantly, even on a slow connection', bg: '#2e6fd8', fg: '#fff4dc' },
  { text: 'One tap from your home screen every day', bg: '#f08a24', fg: '#4a2a12' },
];

export function InstallSheet() {
  const mode = useInstallSheet();
  const [closing, setClosing] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'working' | 'done'>('idle');

  useEffect(() => {
    if (mode) {
      setClosing(false);
      setPhase('idle');
    }
  }, [mode]);

  const close = (snooze: boolean) => {
    setClosing(true);
    window.setTimeout(() => closeInstallSheet(snooze), 230);
  };

  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (!mode) return null;

  const host = window.location.host;

  return (
    <>
      <div className={cx(styles.backdrop, closing && styles.backdropOut)} onClick={() => close(true)} />
      {mode === 'ios' && !closing && (
        <span className={styles.pointer} aria-hidden="true">
          &#9660;
        </span>
      )}
      <div
        className={cx(styles.sheet, mode === 'ios' && styles.sheetIos, closing && styles.sheetOut)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
      >
        <div className={styles.grab} />
        <div className={styles.head}>
          <img
            className={styles.appIcon}
            src={`${import.meta.env.BASE_URL}icon-192.png`}
            alt=""
            width={mode === 'ios' ? 56 : 64}
            height={mode === 'ios' ? 56 : 64}
          />
          <div className={styles.headText}>
            <h2 id="install-title" className={styles.title}>
              {mode === 'ios' ? 'Add to Home Screen' : 'Install WordChunk'}
            </h2>
            {mode === 'native' && <p className={styles.host}>{host}</p>}
          </div>
        </div>

        {mode === 'native' ? (
          <>
            <ul className={styles.list}>
              {BENEFITS.map((b, i) => (
                <li key={b.text} style={{ ['--i' as string]: i }}>
                  <span className={styles.badge} style={{ background: b.bg, color: b.fg }}>
                    {i + 1}
                  </span>
                  {b.text}
                </li>
              ))}
            </ul>
            <div className={styles.actions}>
              <button type="button" className={styles.btnCream} onClick={() => close(true)}>
                Not now
              </button>
              <button
                type="button"
                className={cx(styles.btnYellow, phase === 'idle' && styles.pulse, phase === 'done' && styles.done)}
                disabled={phase !== 'idle'}
                onClick={async () => {
                  buzz(20);
                  setPhase('working');
                  const accepted = await runNativeInstall();
                  if (accepted) {
                    setPhase('done');
                    buzz([20, 40, 20]);
                    window.setTimeout(() => close(false), 900);
                  } else {
                    close(false);
                  }
                }}
              >
                {phase === 'working' && <span className={styles.spinner} />}
                {phase === 'done' ? <>&#10003; Installed</> : 'Install'}
              </button>
            </div>
          </>
        ) : (
          <>
            <ol className={styles.steps}>
              <li style={{ ['--i' as string]: 0 }}>
                <span className={styles.stepNum} style={{ background: '#2e6fd8', ['--i' as string]: 0 }}>
                  1
                </span>
                <span className={styles.stepText}>
                  Tap <strong>Share</strong>{' '}
                  <span className={styles.inlineIcon}>
                    <ShareIcon />
                  </span>{' '}
                  or <strong>&#8943;</strong> below
                </span>
              </li>
              <li style={{ ['--i' as string]: 1 }}>
                <span className={styles.stepNum} style={{ background: '#f5b91e', color: '#4a2a12', ['--i' as string]: 1 }}>
                  2
                </span>
                <span className={styles.stepText}>
                  Scroll down and tap <strong>Add to Home Screen</strong>
                </span>
              </li>
              <li style={{ ['--i' as string]: 2 }}>
                <span className={styles.stepNum} style={{ background: '#2f9d6a', ['--i' as string]: 2 }}>
                  3
                </span>
                <span className={styles.stepText}>
                  Tap <strong>Add</strong> to finish
                </span>
              </li>
            </ol>
            <button type="button" className={cx(styles.btnYellow, styles.full, styles.pulse)} onClick={() => close(true)}>
              Got it
            </button>
          </>
        )}
      </div>
    </>
  );
}

/* ---------- "No connection" card for the puzzle screen ---------- */

export function OfflineCard() {
  const online = useOnline();
  const [tries, setTries] = useState(0);
  const [checking, setChecking] = useState(false);
  const [hint, setHint] = useState(false);

  const tryAgain = () => {
    if (checking) return;
    buzz(15);
    setChecking(true);
    setHint(false);
    // give the "checking" state a beat so the tap visibly does something
    window.setTimeout(() => {
      if (navigator.onLine) {
        window.location.reload();
      } else {
        setChecking(false);
        setHint(true);
        setTries((n) => n + 1);
        buzz([30, 40, 30]);
      }
    }, 650);
  };

  // the moment the connection returns, just go
  useEffect(() => {
    if (online) {
      const t = window.setTimeout(() => window.location.reload(), 600);
      return () => window.clearTimeout(t);
    }
  }, [online]);

  return (
    <div className={styles.offlineWrap}>
      <div className={styles.offlineCard} role="alert">
        <div className={styles.offlineMark}>
          <WifiOffIcon size={44} color="#fff4dc" className={styles.wifi} />
        </div>
        <h2 className={styles.offlineTitle}>No connection</h2>
        <p className={styles.offlineText}>
          Today's puzzle needs the internet.
          <br />
          Your streak is safe.
        </p>
        {hint && (
          <p key={tries} className={styles.hint}>
            Still offline. Check your signal and try again
          </p>
        )}
        <div className={styles.offlineActions}>
          <button
            key={`btn${tries}`}
            type="button"
            className={cx(styles.btnYellow, tries > 0 && !checking && styles.shake)}
            onClick={tryAgain}
            disabled={checking}
          >
            {checking && <span className={styles.spinner} />}
            {checking ? 'Checking' : 'Try again'}
          </button>
          <Link to="/" className={styles.btnCream}>
            Main menu
          </Link>
        </div>
      </div>
    </div>
  );
}
