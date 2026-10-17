import { getSettings } from './settings';

// Tiny phone vibrations that back up the sounds. Does nothing where the device can't vibrate
// (desktop browsers, iPhones) or when the player has switched it off.

export const canVibrate = (): boolean => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function buzz(pattern: number | number[]): void {
  if (!canVibrate() || !getSettings().vibration) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // some browsers refuse outside a user gesture: not worth reporting
  }
}

export const buzzPlace = () => buzz(8);
export const buzzReturn = () => buzz(5);
export const buzzWrong = () => buzz([30, 40, 30]);
export const buzzSolved = () => buzz([20, 60, 20, 60, 50]);
