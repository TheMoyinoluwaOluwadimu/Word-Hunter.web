/** Small seeded PRNG (mulberry32): the same seed always gives the same sequence in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher–Yates shuffle; returns a new array. Pass a `seed` to get the same order every
 * time (challenges: both players must see the identical board).
 */
export function shuffle<T>(input: readonly T[], seed?: number): T[] {
  const random = seed === undefined ? Math.random : seededRandom(seed);
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
