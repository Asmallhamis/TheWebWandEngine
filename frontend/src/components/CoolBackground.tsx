import React from 'react';

interface CoolBackgroundProps {
  theme: string;
  type: string;
}

export function CoolBackground({ theme, type }: CoolBackgroundProps) {
  if (type === 'blank') {
    return <div className="fixed inset-0 -z-[100] bg-[rgba(var(--cool-bg-rgb),1)] transition-colors duration-500 pointer-events-none" />;
  }

  return (
    <div className="fixed inset-0 -z-[100] overflow-hidden bg-[rgba(var(--cool-bg-rgb),1)] transition-colors duration-500 pointer-events-none">
      {type === 'aurora' && (
        <>
          <div
            className="absolute inset-x-0 -top-[20vh] h-[80vh] mix-blend-screen overflow-hidden"
            style={{
              background: `radial-gradient(ellipse at 50% 0%, var(--cool-primary) 0%, transparent 60%),
                           radial-gradient(ellipse at 20% 40%, var(--cool-secondary) 0%, transparent 50%)`,
              filter: 'blur(80px)',
              animation: 'aurora-breathe 12s ease-in-out infinite alternate',
              opacity: 0.5
            }}
          />
          <div
            className="absolute inset-x-0 -bottom-[10vh] h-[60vh] mix-blend-screen overflow-hidden"
            style={{
              background: `radial-gradient(ellipse at 80% 100%, var(--cool-secondary) 0%, transparent 60%)`,
              filter: 'blur(100px)',
              animation: 'aurora-breathe 15s ease-in-out infinite alternate-reverse',
              opacity: 0.3
            }}
          />
        </>
      )}

      {type === 'neon' && (
        <div
          className="absolute inset-0 opacity-30 mix-blend-screen"
          style={{
            background: `linear-gradient(45deg, var(--cool-primary) 0%, transparent 40%, var(--cool-secondary) 100%)`,
            backgroundSize: '400% 400%',
            animation: 'neon-shimmer 15s ease infinite',
            filter: 'blur(40px)'
          }}
        />
      )}

      {type === 'matrix' && (
        <div className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `linear-gradient(0deg, var(--cool-bg-rgb) 0%, transparent 100%), repeating-linear-gradient(0deg, var(--cool-primary) 0, var(--cool-primary) 1px, transparent 1px, transparent 4px)`,
            backgroundSize: '100% 100%, 100% 4px',
            animation: 'neon-shimmer 20s linear infinite'
          }}
        />
      )}
      
      {/* Dynamic Cyber Grid overlay for all except blank */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(to right, var(--cool-primary) 1px, transparent 1px), linear-gradient(to bottom, var(--cool-primary) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />
    </div>
  );
}
