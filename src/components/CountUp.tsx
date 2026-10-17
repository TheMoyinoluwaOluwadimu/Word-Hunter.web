import { useEffect, useState } from 'react';

/** Counts a whole number up (or down) from `from` to `to`, easing out. Jumps straight there for reduced motion. */
export default function CountUp({ from, to, ms = 800 }: { from: number; to: number; ms?: number }) {
  const [value, setValue] = useState(from);

  useEffect(() => {
    if (from === to || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(to);
      return;
    }
    setValue(from);
    let frame = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setValue(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    // let the surrounding pop-in finish first, so the number visibly ticks up
    const start = window.setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, 700);
    return () => {
      window.clearTimeout(start);
      cancelAnimationFrame(frame);
    };
  }, [from, to, ms]);

  return <>{value}</>;
}
