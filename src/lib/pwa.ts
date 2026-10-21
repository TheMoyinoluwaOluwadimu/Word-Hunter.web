import { useSyncExternalStore } from 'react';

// Everything "app-like" lives here: the service worker and its update flow, the install prompt,
// and whether the phone is online. Components read it through the hooks below.

/* ---------- tiny store ---------- */

function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      if (Object.is(next, value)) return;
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable: we just ask again next time
  }
}

/* ---------- online / offline ---------- */

const online = createStore(typeof navigator === 'undefined' ? true : navigator.onLine);
/** Set for a couple of seconds after the connection comes back, so the UI can say "Back online". */
const justReconnected = createStore(false);
let reconnectTimer: number | undefined;

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    window.clearTimeout(reconnectTimer);
    justReconnected.set(false);
    online.set(false);
  });
  window.addEventListener('online', () => {
    online.set(true);
    justReconnected.set(true);
    window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(() => justReconnected.set(false), 2600);
  });
}

export const useOnline = () => useSyncExternalStore(online.subscribe, online.get, () => true);
export const useJustReconnected = () => useSyncExternalStore(justReconnected.subscribe, justReconnected.get, () => false);

/* ---------- service worker + updates ---------- */

const UPDATED_FLAG = 'wordchunk_just_updated';
/** A waiting service worker means a newer version is downloaded and ready. */
const waitingWorker = createStore<ServiceWorker | null>(null);
/** True for a moment after a refresh that applied an update, for the "latest version" toast. */
const justUpdated = createStore(false);

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  try {
    if (sessionStorage.getItem(UPDATED_FLAG)) {
      sessionStorage.removeItem(UPDATED_FLAG);
      justUpdated.set(true);
      window.setTimeout(() => justUpdated.set(false), 3200);
    }
  } catch {
    // no session storage: skip the confirmation toast
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        const watch = (worker: ServiceWorker | null) => {
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            // installed while an older version is running = an update is ready
            if (worker.state === 'installed' && navigator.serviceWorker.controller) waitingWorker.set(reg.waiting ?? worker);
          });
        };
        if (reg.waiting && navigator.serviceWorker.controller) waitingWorker.set(reg.waiting);
        watch(reg.installing);
        reg.addEventListener('updatefound', () => watch(reg.installing));

        // look for a new version when the app comes back to the front, and once an hour
        const check = () => void reg.update().catch(() => undefined);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
        window.setInterval(check, 60 * 60 * 1000);
      })
      .catch(() => undefined);

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      try {
        sessionStorage.setItem(UPDATED_FLAG, '1');
      } catch {
        // fine
      }
      window.location.reload();
    });
  });
}

/** Tells the waiting version to take over; the page reloads itself when it does. */
export function applyUpdate() {
  waitingWorker.get()?.postMessage('SKIP_WAITING');
}

/** Hides the update toast until the next visit (the update stays downloaded). */
const updateDismissed = createStore(false);
export const dismissUpdate = () => updateDismissed.set(true);

export const useUpdateReady = () => {
  const waiting = useSyncExternalStore(waitingWorker.subscribe, waitingWorker.get, () => null);
  const dismissed = useSyncExternalStore(updateDismissed.subscribe, updateDismissed.get, () => false);
  return waiting !== null && !dismissed;
};
export const useJustUpdated = () => useSyncExternalStore(justUpdated.subscribe, justUpdated.get, () => false);

/* ---------- install ---------- */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'wordchunk_install_dismissed';
const IOS_SEEN_KEY = 'wordchunk_install_ios_seen';
const SNOOZE_MS = 21 * 24 * 60 * 60 * 1000; // "Not now" hides the prompt for three weeks

const installEvent = createStore<BeforeInstallPromptEvent | null>(null);
const installed = createStore(false);
/** Which install sheet is on screen, if any. */
export type InstallSheetMode = 'native' | 'ios' | null;
const sheet = createStore<InstallSheetMode>(null);

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone / iPad Safari, where there is no install button and people must use Share. */
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && safari;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep it for our own button
    installEvent.set(e as BeforeInstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => {
    installed.set(true);
    installEvent.set(null);
  });
}

/** Can the app be installed from here right now (and is it not installed already)? */
export function useCanInstall(): boolean {
  const ev = useSyncExternalStore(installEvent.subscribe, installEvent.get, () => null);
  const done = useSyncExternalStore(installed.subscribe, installed.get, () => false);
  return !done && !isStandalone() && (ev !== null || isIosSafari());
}

export const useInstallSheet = () => useSyncExternalStore(sheet.subscribe, sheet.get, () => null);

/** Opens whichever install sheet fits this phone. Returns false if installing is not possible. */
export function openInstallSheet(): boolean {
  if (isStandalone() || installed.get()) return false;
  if (installEvent.get()) sheet.set('native');
  else if (isIosSafari()) sheet.set('ios');
  else return false;
  return true;
}

export function closeInstallSheet(snooze: boolean) {
  const mode = sheet.get();
  sheet.set(null);
  if (!snooze) return;
  safeSet(mode === 'ios' ? IOS_SEEN_KEY : DISMISSED_KEY, String(Date.now()));
}

/** Runs the browser's own install dialog. Resolves true if the player accepted. */
export async function runNativeInstall(): Promise<boolean> {
  const ev = installEvent.get();
  if (!ev) return false;
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  installEvent.set(null); // the event can only be used once
  if (outcome === 'accepted') {
    installed.set(true);
    return true;
  }
  safeSet(DISMISSED_KEY, String(Date.now()));
  return false;
}

/** Shows the install sheet by itself, at most once per snooze period, and only to people who have played a bit. */
export function maybeOfferInstall(puzzlesSolved: number) {
  if (puzzlesSolved < 2 || sheet.get() || isStandalone() || installed.get()) return;
  const key = installEvent.get() ? DISMISSED_KEY : isIosSafari() ? IOS_SEEN_KEY : null;
  if (!key) return;
  const last = Number(safeGet(key) ?? 0);
  if (last && Date.now() - last < SNOOZE_MS) return;
  openInstallSheet();
}
