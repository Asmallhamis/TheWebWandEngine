import React from 'react';
import { useTilt } from '../hooks/useTilt';
import { useSettings } from '../hooks/useSettings';

interface TiltContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  disabled?: boolean;
  maxAngle?: number;
  scale?: number;
  glareClassName?: string;
  isDragging?: boolean;
}

export const TiltContainer = React.forwardRef<HTMLDivElement, TiltContainerProps>(({
  children,
  disabled = false,
  maxAngle = 12,
  scale = 1.05,
  className = '',
  glareClassName = '',
  isDragging = false,
  style: propStyle,
  ...props
}, externalRef) => {
  const { settings } = useSettings();
  
  // Only enable tilt if Cool UI is active and explicitly not dragging.
  const isTiltEnabled = settings.coolUIMode && !disabled && !isDragging;
  
  const { ref: tiltRef, style: tiltStyle, glareStyle } = useTilt<HTMLDivElement>({
    disabled: !isTiltEnabled,
    maxAngle,
    scale
  });

  // Merge external ref with internal hook ref
  const setRefs = React.useCallback(
    (node: HTMLDivElement) => {
      // @ts-ignore
      tiltRef.current = node;
      if (typeof externalRef === 'function') {
        externalRef(node);
      } else if (externalRef) {
        externalRef.current = node;
      }
    },
    [tiltRef, externalRef]
  );

  if (!settings.coolUIMode) {
    return (
      <div ref={externalRef} className={className} style={propStyle} {...props}>
        {children}
      </div>
    );
  }

  return (
    <div
      ref={setRefs}
      className={`relative will-change-transform transform-gpu ${className}`}
      style={{ ...propStyle, ...tiltStyle }}
      {...props}
    >
      {children}
      

    </div>
  );
});

TiltContainer.displayName = 'TiltContainer';
