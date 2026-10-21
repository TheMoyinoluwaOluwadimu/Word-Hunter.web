// What this player has already been shown, per theme file, so Challenge and Practice can lean on
// words they have not met yet. Only lives on this device; nothing here is ever sent anywhere.

export type SeenKind = 'challenge' | 'practice';

const KEY = 'wordchunk_seen_words';
/** Per theme, the most words remembered. Banks are far smaller than this, it is just a safety cap. */
const CAP = 200;

type Store = Record<SeenKind, Record<string, string[]>>;

function load(): Store {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Store>;
    return { challenge: parsed.challenge ?? {}, practice: parsed.practice ?? {} };
  } catch {
    return { challenge: {}, practice: {} };
  }
}

function save(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // storage unavailable: words may repeat sooner, nothing breaks
  }
}

export function getSeen(kind: SeenKind, file: string): Set<string> {
  return new Set(load()[kind][file] ?? []);
}

export function markSeen(kind: SeenKind, file: string, ids: string[]) {
  const store = load();
  const list = store[kind][file] ?? [];
  const merged = [...list.filter((id) => !ids.includes(id)), ...ids].slice(-CAP);
  store[kind][file] = merged;
  save(store);
}

/** Starts the theme over once the player has been through (nearly) everything in it. */
export function resetSeen(kind: SeenKind, file: string) {
  const store = load();
  delete store[kind][file];
  save(store);
}
