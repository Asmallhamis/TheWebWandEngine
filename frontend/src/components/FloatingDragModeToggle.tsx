import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MousePointer2, Hand, GripVertical } from 'lucide-react';
import { AppSettings } from '../types';
import { useTranslation } from 'react-i18next';

interface FloatingDragModeToggleProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}

export function FloatingDragModeToggle({ settings, setSettings }: FloatingDragModeToggleProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const windowPos = useRef(settings.dragModeTogglePos || { x: window.innerWidth - 180, y: window.innerHeight - 100 });
  const containerRef = useRef<HTMLDivElement>(null);
  const uiScale = (settings.uiScale || 100) / 100;

  const toUnscaledPoint = useCallback((clientX: number, clientY: number) => ({
    x: clientX / uiScale,
    y: clientY / uiScale,
  }), [uiScale]);

  const updatePosition = useCallback((clientX: number, clientY: number) => {
    const point = toUnscaledPoint(clientX, clientY);
    const newX = point.x - dragStartPos.current.x;
    const newY = point.y - dragStartPos.current.y;

    const boundedX = Math.max(10, Math.min(window.innerWidth / uiScale - 150, newX));
    const boundedY = Math.max(10, Math.min(window.innerHeight / uiScale - 60, newY));

    windowPos.current = { x: boundedX, y: boundedY };
    if (containerRef.current) {
      containerRef.current.style.left = `${boundedX}px`;
      containerRef.current.style.top = `${boundedY}px`;
      containerRef.current.style.bottom = 'auto';
      containerRef.current.style.right = 'auto';
    }
  }, [toUnscaledPoint, uiScale]);

  useEffect(() => {
    if (!settings.showDragModeToggle) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      updatePosition(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      if (!touch) return;
      e.preventDefault();
      updatePosition(touch.clientX, touch.clientY);
    };

    const stopDragging = () => {
      if (isDragging) {
        setIsDragging(false);
        setSettings(prev => ({ ...prev, dragModeTogglePos: windowPos.current }));
      }
    };

    const handleMouseUp = () => stopDragging();
    const handleTouchEnd = () => stopDragging();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isDragging, settings.showDragModeToggle, setSettings, updatePosition]);

  if (!settings.showDragModeToggle) return null;

  const startDragging = (clientX: number, clientY: number) => {
    setIsDragging(true);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const point = toUnscaledPoint(clientX, clientY);
      dragStartPos.current = {
        x: point.x - rect.left / uiScale,
        y: point.y - rect.top / uiScale
      };
    }
  };

  const handleDragStart = (e: React.MouseEvent) => {
    startDragging(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault();
    startDragging(touch.clientX, touch.clientY);
  };

  const initialStyle: React.CSSProperties = settings.dragModeTogglePos 
    ? { left: settings.dragModeTogglePos.x, top: settings.dragModeTogglePos.y }
    : { bottom: '100px', right: '40px' };

  return (
    <div 
      ref={containerRef}
      className="fixed z-[5000] flex items-center bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl p-1 shadow-2xl select-none"
      style={initialStyle}
    >
      <div 
        className="px-1.5 py-3 cursor-grab active:cursor-grabbing touch-none text-zinc-500 hover:text-zinc-300 transition-colors"
        onMouseDown={handleDragStart}
        onTouchStart={handleTouchStart}
      >
        <GripVertical size={16} />
      </div>

      <div className="flex bg-black/40 rounded-lg p-1 gap-1">
        <button
          onClick={() => setSettings(prev => ({ ...prev, editorDragMode: 'cursor' }))}
          className={`
            flex items-center justify-center w-10 h-10 rounded-md transition-all
            ${settings.editorDragMode === 'cursor' 
              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}
          `}
          title={t('settings.drag_mode_cursor')}
        >
          <MousePointer2 size={18} />
        </button>
        <button
          onClick={() => setSettings(prev => ({ ...prev, editorDragMode: 'hand' }))}
          className={`
            flex items-center justify-center w-10 h-10 rounded-md transition-all
            ${settings.editorDragMode === 'hand' 
              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}
          `}
          title={t('settings.drag_mode_hand')}
        >
          <Hand size={18} />
        </button>
      </div>
    </div>
  );
}
