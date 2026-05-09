import React from 'react';
import { SpellInfo } from '../types';
import { getIconUrl } from '../lib/evaluatorAdapter';
import { registerDragPreviewElement } from '../lib/dragPreviewMotion';

interface DragPreviewProps {
  spell: SpellInfo;
  isConnected: boolean;
}

export const DragPreview = ({ spell, isConnected }: DragPreviewProps) => {
  const previewRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    return registerDragPreviewElement(previewRef.current);
  }, []);

  return (
    <div
      ref={previewRef}
      className="fixed left-0 top-0 pointer-events-none z-[1000] h-12 w-12"
      style={{
        willChange: 'transform',
        contain: 'layout paint style',
      }}
    >
      <img
        src={getIconUrl(spell.icon, isConnected)}
        className="h-full w-full image-pixelated rounded border-2 border-indigo-500 bg-zinc-900/80 shadow-2xl"
        alt=""
        draggable={false}
      />
    </div>
  );
};

