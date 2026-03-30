import React from 'react';

export const ThemeFilters: React.FC = () => {
  return (
    <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <defs>
        {/* Orion Fire Plasma Streams: Shreds the graphic into highly stretched, sharp vertical glowing lines */}
        <filter id="orion-plasma-streams" x="0%" y="0%" width="100%" height="100%">
          {/* Extremely low Y frequency = long vertical lines. High X frequency = many horizontal lines */}
          <feTurbulence type="fractalNoise" baseFrequency="0.08 0.002" numOctaves="4" result="noise" seed="0">
            <animate attributeName="seed" values="0;100" dur="20s" repeatCount="indefinite" />
          </feTurbulence>
          {/* Map the noise to Alpha and steeply boost contrast to create sharp gaps */}
          <feColorMatrix type="matrix" values="
            1 0 0 0 0
            0 1 0 0 0
            0 0 1 0 0
            3.5 0 0 0 -1.5" in="noise" result="alphaNoise" />
          {/* Mask the original element (SourceGraphic) against our sharp vertical alpha channels */}
          <feComposite operator="in" in="SourceGraphic" in2="alphaNoise" />
        </filter>
      </defs>
    </svg>
  );
};
