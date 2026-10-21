import { useSyncExternalStore } from 'react';
import { utcDate } from './storage';

// How hard the app nudges a guest to sign in. Three places, each with its own memory so it never nags:
//   the sheet that opens when a guest taps Play   once per day ("Play as guest" hides it for that day)
//   the card on the main menu                     comes back a week after it is dismissed
//   the card on the win screen                    hidden for the rest of the day after "Maybe later"

const GUEST_DAY_KEY = 'wordchunk_guest_day';
const CARD_DISMISSED_KEY = 'wordchunk_signin_card_dismissed';
const LATER_DAY_KEY = 'wordchunk_signin_later_day';
const CARD_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable: we may ask a little more often, nothing breaks
  }
}

/** True until the player picks "Play as guest" today. */
export const shouldAskBeforePlay = () => get(GUEST_DAY_KEY) !== utcDate();
export const markGuestToday = () => set(GUEST_DAY_KEY, utcDate());

export const menuCardHidden = () => Date.now() - Number(get(CARD_DISMISSED_KEY) ?? 0) < CARD_SNOOZE_MS;
export const dismissMenuCard = () => set(CARD_DISMISSED_KEY, String(Date.now()));

export const winCardHidden = () => get(LATER_DAY_KEY) === utcDate();
export const hideWinCardToday = () => set(LATER_DAY_KEY, utcDate());

/* ---------- the sheet's open/closed state ---------- */

export interface SheetRequest {
  /** Where the app should land after sign-in (a hash route such as '#/play'). */
  returnTo: string;
  /** What "Play as guest" does. Null when the sheet was not opened from Play (the link then reads "Not now"). */
  onGuest: (() => void) | null;
}

let current: SheetRequest | null = null;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const emit = () => listeners.forEach((l) => l());

export function openSignInSheet(request: SheetRequest) {
  current = request;
  emit();
}
export function closeSignInSheet() {
  current = null;
  emit();
}
export const useSignInSheet = () => useSyncExternalStore(subscribe, () => current, () => null);
