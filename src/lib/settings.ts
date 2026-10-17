import { useSyncExternalStore } from 'react';

// Player preferences, kept on the device. Read anywhere with getSettings(); components use
// useSettings() so a change in the dialog is felt immediately everywhere.

const KEY = 'wordchunk_settings';

export interface Settings {
  /** Tile clicks and the win jingle. */
  sound: boolean;
  /** Short phone vibrations on place, wrong and solved. */
  vibration: boolean;
}

function load(): Settings {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null;
    // anything not explicitly switched off stays on
    return { sound: p?.sound !== false, vibration: p?.vibration !== false };
  } catch {
    return { sound: true, vibration: true };
  }
}

let current: Settings = load();
const listeners = new Set<() => void>();

export const getSettings = (): Settings => current;

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  current = { ...current, [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // storage unavailable: the choice lasts for this visit only
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}
