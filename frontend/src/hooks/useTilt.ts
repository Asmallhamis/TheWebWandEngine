import { useState, useRef, useCallback, useEffect } from 'react';

interface TiltOptions {
  disabled?: boolean;
  maxAngle?: number;
  scale?: number;
}

export function useTilt<T extends HTMLElement = HTMLDivElement>({ 
  disabled = false, 
  maxAngle = 12, 
  scale = 1.05 
}: TiltOptions = {}) {
  const ref = useRef<T>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    transition: 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
  });
  const [glareStyle, setGlareStyle] = useState<React.CSSProperties>({
    opacity: 0,
    transition: 'opacity 0.4s ease'
  });
  const rafId = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (disabled || !ref.current) return;
    
    if (rafId.current) cancelAnimationFrame(rafId.current);
    
    rafId.current = requestAnimationFrame(() => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      
      // Calculate offset -1 to 1
      const x = (e.clientX - cx) / (rect.width / 2);
      const y = (e.clientY - cy) / (rect.height / 2);
      
      const rotateX = -y * maxAngle;
      const rotateY = x * maxAngle;

      const glareX = (x * -50) + 50; 
      const glareY = (y * -50) + 50;
      
      setStyle({
        transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, 1)`,
        transition: 'none',
        zIndex: 50,
        '--mouse-x': x,
        '--mouse-y': y,
      } as React.CSSProperties);

      setGlareStyle({
        background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.4) 0%, transparent 60%)`,
        opacity: 1,
        transition: 'none'
      });
    });
  }, [disabled, maxAngle, scale]);

  const handleMouseLeave = useCallback(() => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    setStyle({
      transform: 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)',
      transition: 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
      zIndex: 1,
      '--mouse-x': 0,
      '--mouse-y': 0,
    } as React.CSSProperties);
    setGlareStyle({
      opacity: 0,
      transition: 'opacity 0.4s ease'
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) {
      if (disabled) handleMouseLeave();
      return;
    }

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [disabled, handleMouseMove, handleMouseLeave]);

  return { ref, style, glareStyle };
}
