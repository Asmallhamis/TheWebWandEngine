import React from 'react';

/** Ray lengths are deliberately uneven so the mark reads as hand-set, not geometric. */
const RAYS = [13, 10, 12.5, 10.5, 13, 9.5, 12, 11];

/**
 * Original "wand spark" brand mark used by the paper theme family:
 * eight ink-weight rays radiating from a quiet center.
 */
export function PaperMark({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      {RAYS.map((length, i) => {
        const angle = (i * Math.PI) / 4 + 0.08;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return (
          <line
            key={i}
            x1={16 + cos * 3.2}
            y1={16 + sin * 3.2}
            x2={16 + cos * length}
            y2={16 + sin * length}
          />
        );
      })}
    </svg>
  );
}
