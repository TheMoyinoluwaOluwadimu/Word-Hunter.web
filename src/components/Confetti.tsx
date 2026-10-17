import { useState } from 'react';
import type { CSSProperties } from 'react';
import styles from './Confetti.module.css';

const COLORS = ['#e34a33', '#2e6fd8', '#f5b91e', '#f08a24', '#2f9d6a', '#fff4dc'];

/**
 * A one-off burst of painted bits. Drop it inside a positioned container; it fires on mount from
 * the upper middle and fades out by itself. Hidden for players who prefer reduced motion.
 */
export default function Confetti({ count = 28 }: { count?: number }) {
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 120 + Math.random() * 190;
      return {
        id: i,
        dx: Math.cos(angle) * dist,
        // pieces drift outward, then gravity pulls them down
        dy: Math.sin(angle) * dist * 0.7 + 170,
        rot: (Math.random() - 0.5) * 900,
        size: 7 + Math.random() * 8,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 0.15,
      };
    }),
  );

  return (
    <div className={styles.confetti} aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={
            {
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--rot': `${p.rot}deg`,
              '--s': `${p.size}px`,
              '--c': p.color,
              '--d': `${p.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
