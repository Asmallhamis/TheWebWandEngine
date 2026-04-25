/**
 * SpellGridCanvas — Canvas 2D-based spell grid renderer.
 *
 * Replaces the DOM-heavy SpellCell grid with a single <canvas> element.
 * All cells (background, border, icon, selection highlight, hover,
 * pattern bar, index number, etc.) are painted with Canvas 2D.
 */
import React, {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { WandData, SpellInfo, AppSettings, SpellArea } from '../types';
import { getCachedIcon, preloadIcons } from '../hooks/useSpellIconCache';
import { useUIStore } from '../store/useUIStore';
import { getUnknownSpellInfo } from '../hooks/useSpellDb';
import { type PatternMatch } from '../lib/spellPatterns';

// ─── constants ──────────────────────────────────────────────────────
const BASE_CELL = 48;
const ICON_SIZE = 40;
const BORDER_RADIUS = 8;
const CANVAS_PADDING_TOP = 20;

// Colors
const C = {
  bgNormal:       '#27272a',
  bgHover:        '#3f3f46',
  bgSelected:     'rgba(99,102,241,0.4)',
  bgDragSwap:     'rgba(99,102,241,0.3)',
  bgUnknown:      'rgba(124,45,18,0.3)',
  borderNormal:   'rgba(255,255,255,0.05)',
  borderHover:    'rgba(99,102,241,0.5)',
  borderSelected: '#6366f1',
  borderDragSwap: '#6366f1',
  borderUnknown:  'rgba(249,115,22,0.3)',
  selectionGlow:  'rgba(99,102,241,0.3)',
  markedRing:     '#f59e0b',
  hoverLine:      '#818cf8',
  plus:           'rgba(39,39,42,0.5)',
  deleteCircle:   '#ef4444',
  usesZero:       '#ef4444',
  usesNormal:     '#fbbf24',
  usesBg:         'rgba(0,0,0,0.9)',
  triggerColor:   '#ef4444',
  indexVisible:   '#22d3ee',
  indexAlwaysCast: '#f59e0b',
  indexAlwaysCastBg: 'rgba(245,158,11,0.16)',
  indexHidden:    'rgba(255,255,255,0.02)',
  unknownPrimary: '#f97316',
  unknownMod:     'rgba(34,211,238,0.8)',
  unknownSec:     'rgba(249,115,22,0.7)',
};

// ─── Helpers ────────────────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// ─── Theme Resolver ──────────────────────────────────────────────────
const themePaletteCache = {
  themeName: '',
  palette: C,
};

function resolveThemePalette(themeName: string | undefined): typeof C {
  if (!themeName || themeName === 'none') {
    // User might have turned off cool UI or reset
    themePaletteCache.themeName = '';
    themePaletteCache.palette = C;
    return C;
  }
  if (themePaletteCache.themeName === themeName) {
    return themePaletteCache.palette;
  }

  const el = document.querySelector('.theme-cool-ui') as HTMLElement;
  if (!el) return C;

  const computed = window.getComputedStyle(el);
  const primary = computed.getPropertyValue('--cool-primary').trim();
  const bgRgb = computed.getPropertyValue('--cool-bg-rgb').trim();

  if (!primary || !bgRgb) return C;

  const hexToRgba = (hex: string, alpha: number) => {
    let h = hex.replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (h.length !== 6) return `rgba(99, 102, 241, ${alpha})`;
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    if (isNaN(r)) return `rgba(99, 102, 241, ${alpha})`;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const isDeepAbyssal = themeName === 'pureprism' || themeName === 'blacktooth';

  const palette = {
    ...C,
    bgNormal:       `rgba(${bgRgb}, ${isDeepAbyssal ? 0.3 : 0.5})`,
    bgHover:        `rgba(${bgRgb}, 0.8)`,
    bgSelected:     hexToRgba(primary, 0.4),
    bgDragSwap:     hexToRgba(primary, 0.3),
    borderNormal:   isDeepAbyssal ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.15)',
    borderHover:    hexToRgba(primary, 0.6),
    borderSelected: primary,
    borderDragSwap: primary,
    selectionGlow:  hexToRgba(primary, 0.4),
    hoverLine:      primary,
  };

  themePaletteCache.themeName = themeName;
  themePaletteCache.palette = palette;
  return palette;
}

// ─── Props ──────────────────────────────────────────────────────────
export interface SpellGridCanvasProps {
  slot: string;
  data: WandData;
  spellDb: Record<string, SpellInfo>;
  area?: SpellArea;
  alwaysCastSlots?: string[];
  title?: string;
  settings: AppSettings;
  isConnected: boolean;
  isAltPressed: boolean;
  absoluteToOrdinal: Record<number, number>;
  patternMatches: PatternMatch[];
  isCanvasMode?: boolean;

  handleSlotMouseDown: (slot: string, idx: number, isRightClick?: boolean, pointer?: { x: number; y: number }, area?: SpellArea) => void;
  handleSlotMouseUp: (slot: string, idx: number, area?: SpellArea) => void;
  handleSlotMouseEnter: (slot: string, idx: number, area?: SpellArea) => void;
  handleSlotMouseMove: (e: React.MouseEvent, slot: string, idx: number, area?: SpellArea) => void;
  handleSlotMouseLeave: () => void;
  openPicker: (slot: string, idx: string, e: React.MouseEvent | { x: number; y: number; initialSearch?: string; rowTop?: number; insertAnchor?: { wandSlot: string; idx: number; isRightHalf: boolean } | null }) => void;
  setSelection: (s: any) => void;
  updateWand: (slot: string, partial: Partial<WandData> | ((curr: WandData) => Partial<WandData>), actionName?: string, icons?: string[]) => void;
  openWiki: (sid: string) => void;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  t: (key: string, options?: any) => string;
}

// ─── Layout calculation ─────────────────────────────────────────────
function computeGridLayout(containerWidth: number, totalSlots: number, gap: number) {
  const cellOuter = BASE_CELL + gap;
  const cols = Math.max(1, Math.floor(containerWidth / cellOuter) || 1);
  const rows = Math.ceil(totalSlots / cols);
  return { cols, rows, cellOuter, cellInner: BASE_CELL };
}

// ─── Component ──────────────────────────────────────────────────────
export const SpellGridCanvas: React.FC<SpellGridCanvasProps> = React.memo(({
  slot, data, spellDb, area = 'main', alwaysCastSlots, title, settings, isConnected, isAltPressed,
  absoluteToOrdinal, patternMatches, isCanvasMode,
  handleSlotMouseDown, handleSlotMouseUp, handleSlotMouseEnter,
  handleSlotMouseMove, handleSlotMouseLeave,
  openPicker, setSelection, updateWand, openWiki, setSettings, t,
}) => {
  const areaSlots = area === 'always_cast'
    ? (alwaysCastSlots ?? data.always_cast ?? [])
    : null;
  const normalizedTitle = title ?? (area === 'always_cast' ? t('editor.always_cast_slots') : undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resolverId = React.useMemo(() => `canvas-${slot}-${area}`, [slot, area]);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const repaintVersionRef = useRef(0);
  const pendingIconUrlsRef = useRef<Set<string>>(new Set());
  const paintRef = useRef<() => void>(() => {});
  const baseDirtyRef = useRef(true);
  const lastHoveredIdxRef = useRef<number>(-1);
  const mouseDownIdxRef = useRef<number>(-1);
  const [containerWidth, setContainerWidth] = useState(0);
  const registerHoverResolver = useUIStore(s => s.registerHoverResolver);
  const unregisterHoverResolver = useUIStore(s => s.unregisterHoverResolver);
  const mobileModifiers = useUIStore(s => s.mobileModifiers);
  const consumeMobileModifiers = useUIStore(s => s.consumeMobileModifiers);
  const markModeActive = useUIStore(s => s.markModeActive);
  const wikiModeActive = useUIStore(s => s.wikiModeActive);
  const consumeWikiMode = useUIStore(s => s.consumeWikiMode);
  const consumeMarkMode = useUIStore(s => s.consumeMarkMode);

  // ─── Derived values ─────────────────────────────────────────
  const gap = settings.editorSpellGap || 0;
  const totalSlots = area === 'always_cast'
    ? Math.max(areaSlots?.length || 0, 1)
    : Math.max(data.deck_capacity, 24);
  const layout = useMemo(() => {
    if (isCanvasMode) {
      const cellOuter = BASE_CELL + gap;
      if (area === 'always_cast') {
        return { cols: Math.max(1, totalSlots), rows: 1, cellOuter, cellInner: BASE_CELL };
      }
      const cellsPerRow = data.canvas_cells_per_row ?? settings.defaultCanvasCellsPerRow ?? 26;
      const cols = Math.min(totalSlots, cellsPerRow);
      const rows = Math.ceil(totalSlots / Math.max(1, cols));
      return { cols, rows, cellOuter, cellInner: BASE_CELL };
    }
    return computeGridLayout(containerWidth || 800, totalSlots, gap);
  }, [area, areaSlots?.length, containerWidth, totalSlots, gap, isCanvasMode, data.canvas_cells_per_row, settings.defaultCanvasCellsPerRow]);

  // Pattern match lookup
  const slotMatchMap = useMemo(() => {
    const map: Record<number, PatternMatch> = {};
    for (const m of patternMatches) {
      for (const idx of m.indices) map[idx] = m;
    }
    return map;
  }, [patternMatches]);

  // ─── Stable scheduleRepaint (never changes, uses paintRef) ──
  const scheduleRepaint = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      paintRef.current();
    });
  }, []);

  // ─── Preload visible icons ─────────────────────────────────
  useEffect(() => {
    const paths: string[] = [];
    const nextPendingUrls = new Set<string>();
    const currentVersion = ++repaintVersionRef.current;
    for (let i = 1; i <= totalSlots; i++) {
      const sid = area === 'always_cast'
        ? areaSlots?.[i - 1]
        : data.spells?.[i.toString()];
      if (sid) {
        const sp = spellDb[sid];
        if (sp?.icon) {
          paths.push(sp.icon);
          const img = getCachedIcon(sp.icon, isConnected, () => {
            if (repaintVersionRef.current !== currentVersion) return;
            baseDirtyRef.current = true;
            scheduleRepaint();
          });
          if (!img) {
            const url = getCachedIcon(sp.icon, isConnected)
              ? null
              : undefined;
            if (url !== null) nextPendingUrls.add(sp.icon);
          }
        }
      }
    }
    pendingIconUrlsRef.current = nextPendingUrls;

    if (paths.length > 0) {
      preloadIcons(paths, isConnected, () => {
        if (repaintVersionRef.current !== currentVersion) return;
        pendingIconUrlsRef.current.clear();
        baseDirtyRef.current = true;
        scheduleRepaint();
      });
    } else {
      pendingIconUrlsRef.current.clear();
    }
  }, [area, areaSlots, data.spells, data.deck_capacity, spellDb, isConnected, scheduleRepaint, totalSlots]);

  // ─── Container width tracking ──────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setContainerWidth(w);
      }
    });
    ro.observe(el);
    // initial measurement
    if (el.clientWidth > 0) setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // ─── Helper: paint a single cell onto a given context ─────
  // skipOverlay=true means no hover/selection/delete button rendering
  const paintCell = (
    ctx: CanvasRenderingContext2D,
    i: number,
    _gap: number,
    cols: number,
    cellOuter: number,
    cellInner: number,
    skipOverlay: boolean,
    _selection: any,
    _hovered: any,
    _drag: any,
    palette: typeof C
  ) => {
    const slotIdx = i + 1;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellOuter + _gap / 2;
    const y = row * cellOuter + _gap / 2;
    const isLocked = area === 'main' && i >= data.deck_capacity;

    const sid = area === 'always_cast'
      ? areaSlots?.[slotIdx - 1] ?? null
      : data.spells?.[slotIdx.toString()] ?? null;
    const spell = sid ? spellDb[sid] : null;
    const uses = area === 'always_cast'
      ? undefined
      : (data.spell_uses || {})[slotIdx.toString()] ?? spell?.max_uses;

    const isSelected = !skipOverlay && _selection?.wandSlot === slot && _selection?.area === area && _selection.indices.includes(slotIdx);
    const isHovered = !skipOverlay && _hovered?.wandSlot === slot && _hovered?.area === area && _hovered.idx === slotIdx;
    const isDragSwap = isHovered && _drag && settings.dragSpellMode === 'noita_swap';
    const isMarked = Array.isArray(data.marked_slots) && data.marked_slots.includes(slotIdx);

    const isTriggered = (sid === 'IF_HP' && settings.simulateLowHp) ||
      (sid === 'IF_PROJECTILE' && settings.simulateManyProjectiles) ||
      (sid === 'IF_ENEMY' && settings.simulateManyEnemies);
    const isGrayscale = uses === 0 || isTriggered;

    // --- Dynamic Neon Spell Coloring based on Spell Types ---
    let spellThemeColor = palette.borderSelected;
    let spellGlowColor = palette.selectionGlow;
    let spellSecColor = themePaletteCache.themeName === 'pureprism' ? 'rgba(217, 70, 239, 0.9)' : 'rgba(255, 0, 0, 0.8)';
    
    if (spell && settings.spellTypes) {
      const tc = settings.spellTypes.find(t => t.id === spell.type);
      if (tc && tc.color) {
        // Boost dark Noita UI colors into highly emissive neon Canvas colors
        const getNeon = (hex: string, alpha: number, boost = 1.0) => {
          let h = hex.replace('#', '').trim();
          if (h.length === 3) h = h.split('').map(c => c + c).join('');
          if (h.length !== 6) return `rgba(255,255,255,${alpha})`;
          let r = parseInt(h.substring(0, 2), 16);
          let g = parseInt(h.substring(2, 4), 16);
          let b = parseInt(h.substring(4, 6), 16);
          const max = Math.max(r, g, b);
          if (max < 50) boost *= 3.5;
          else if (max < 150) boost *= 2.0;
          else boost *= 1.2;
          r = Math.min(255, Math.floor(r * boost));
          g = Math.min(255, Math.floor(g * boost));
          b = Math.min(255, Math.floor(b * boost));
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };
        
        spellThemeColor = getNeon(tc.color, 0.9);
        spellGlowColor = getNeon(tc.color, 0.4);
        spellSecColor = getNeon(tc.color, 0.7, 1.5);
      }
    }

    ctx.save();
    if (isLocked) {
      ctx.globalAlpha = 0.1;
      roundRect(ctx, x, y, cellInner, cellInner, BORDER_RADIUS);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fill();
      ctx.restore();
      return;
    }

    // Cell bg
    roundRect(ctx, x, y, cellInner, cellInner, BORDER_RADIUS);
    if (isSelected) {
      ctx.fillStyle = palette.bgSelected;
    } else if (isDragSwap) {
      ctx.fillStyle = palette.bgDragSwap;
    } else if (sid && !spell) {
      ctx.fillStyle = palette.bgUnknown;
    } else {
      ctx.fillStyle = palette.bgNormal;
    }
    ctx.fill();

    // Border
    roundRect(ctx, x + 0.5, y + 0.5, cellInner - 1, cellInner - 1, BORDER_RADIUS);
    ctx.strokeStyle = isSelected ? spellThemeColor
      : isDragSwap ? palette.borderDragSwap
      : isHovered ? spellThemeColor
      : sid && !spell ? palette.borderUnknown
      : palette.borderNormal;
    ctx.lineWidth = isSelected || isDragSwap ? 2 : 1;
    ctx.stroke();

    // Selection ring / Shards rendering
    const isSingleSelect = _selection?.indices.length === 1 && isSelected;
    const isFocalPoint = isSingleSelect || (isHovered && !isDragSwap);
    const isAbyssal = themePaletteCache.themeName === 'pureprism' || themePaletteCache.themeName === 'blacktooth';

    if (isSelected) {
      ctx.save();
      roundRect(ctx, x - 1, y - 1, cellInner + 2, cellInner + 2, BORDER_RADIUS + 1);
      ctx.strokeStyle = spellGlowColor; // Using the dynamic neon spell color glow
      ctx.lineWidth = isAbyssal ? 2 : 3;
      ctx.stroke();
      ctx.restore();
    }

    if (isFocalPoint && isAbyssal && !!sid) {
      const colorTert = 'rgba(255, 255, 255, 0.9)';

      ctx.save();
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 10;
      
      // Draw geometric shattered shards breaking out of the box using spell type colors
      ctx.translate(x + cellInner/2, y + cellInner/2); 
      
      const drawShard = (angle: number, color: string, length: number, width: number, offset: number) => {
         ctx.save();
         ctx.rotate(angle);
         ctx.translate(cellInner/2 + offset, 0); 
         ctx.beginPath();
         ctx.moveTo(0, -width/2);
         ctx.lineTo(length, 0); 
         ctx.lineTo(0, width/2);
         ctx.fillStyle = color;
         ctx.shadowColor = color;
         ctx.shadowBlur = 8;
         ctx.fill();
         ctx.restore();
      };

      // Top Left Cluster
      drawShard(-Math.PI * 0.75, spellThemeColor, 12, 6, -2);
      drawShard(-Math.PI * 0.85, colorTert, 18, 2, -1);
      drawShard(-Math.PI * 0.65, spellSecColor, 8, 4, 0);

      // Bottom Right Cluster
      drawShard(Math.PI * 0.25, spellThemeColor, 16, 8, -2);
      drawShard(Math.PI * 0.15, spellSecColor, 10, 3, -1);
      drawShard(Math.PI * 0.35, colorTert, 14, 2, 0);
      
      // Minor asymmetrical side shards
      drawShard(Math.PI * 0.8, spellThemeColor, 6, 3, -1); 
      drawShard(-Math.PI * 0.1, spellSecColor, 5, 2, 0); 

      ctx.restore();
    }

    // Marked ring
    if (isMarked) {
      ctx.save();
      roundRect(ctx, x - 1, y - 1, cellInner + 2, cellInner + 2, BORDER_RADIUS + 1);
      ctx.strokeStyle = palette.markedRing;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Hover indicator line
    if (isHovered && _hovered && !isDragSwap) {
      const lineX = _hovered.isRightHalf ? x + cellInner + _gap / 2 + 1 : x - _gap / 2 - 1;
      
      if (isAbyssal) {
        ctx.save();
        ctx.shadowColor = spellThemeColor;
        ctx.shadowBlur = 10;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        // Sharp glowing diamond thread instead of a blunt 4px block
        ctx.moveTo(lineX, y - 6);
        ctx.lineTo(lineX + 1.5, y + cellInner / 2);
        ctx.lineTo(lineX, y + cellInner + 6);
        ctx.lineTo(lineX - 1.5, y + cellInner / 2);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(lineX - 0.5, y, 1, cellInner);
        ctx.restore();
      } else {
        ctx.save();
        roundRect(ctx, lineX - 2, y, 4, cellInner, 2);
        ctx.fillStyle = palette.hoverLine;
        ctx.fill();
        ctx.restore();
      }
    }

    // Drag swap overlay
    if (isDragSwap) {
      ctx.save();
      roundRect(ctx, x, y, cellInner, cellInner, BORDER_RADIUS);
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Icon / Content
    const cx = x + cellInner / 2;
    const cy = y + cellInner / 2;

    if (spell) {
      const img = getCachedIcon(spell.icon, isConnected, () => {
        pendingIconUrlsRef.current.delete(spell.icon);
        baseDirtyRef.current = true;
        scheduleRepaint();
      });
      if (img) {
        if (pendingIconUrlsRef.current.has(spell.icon)) {
          pendingIconUrlsRef.current.delete(spell.icon);
          baseDirtyRef.current = true;
        }
        ctx.save();
        if (isGrayscale) {
          ctx.globalAlpha = 0.5;
          ctx.filter = 'grayscale(100%)';
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, cx - ICON_SIZE / 2, cy - ICON_SIZE / 2, ICON_SIZE, ICON_SIZE);
        ctx.restore();
      }
      else {
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(cx - ICON_SIZE / 2, cy - ICON_SIZE / 2, ICON_SIZE, ICON_SIZE);
        ctx.restore();
      }
    } else if (sid && !isLocked) {
      const info = getUnknownSpellInfo(sid);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (info?.mod_id) {
        ctx.fillStyle = palette.unknownMod;
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(`@${info.mod_id}`, cx, cy - 6, cellInner - 4);
      } else {
        ctx.fillStyle = palette.unknownPrimary;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('?', cx, cy - 4);
      }
      ctx.fillStyle = palette.unknownSec;
      ctx.font = '9px monospace';
      const displaySid = sid.length > 8 ? sid.substring(0, 7) + '…' : sid;
      ctx.fillText(displaySid, cx, cy + 8, cellInner - 4);
      ctx.restore();
    } else if (!isLocked) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = palette.plus;
      ctx.font = '300 24px sans-serif';
      ctx.fillText('+', cx, cy);
      ctx.restore();
    }

    // Pattern bar
    const pm = area === 'main' ? slotMatchMap[slotIdx] : undefined;
    if (pm) {
      const barH = 3;
      const barY = y + cellInner - barH;
      ctx.save();
      ctx.fillStyle = pm.color + '50';
      ctx.fillRect(x, barY - 1, cellInner, barH + 1);
      ctx.fillStyle = pm.color;
      ctx.fillRect(x, barY, cellInner, barH);
      ctx.restore();
    }

    // Trigger triangle
    if (isTriggered) {
      ctx.save();
      ctx.fillStyle = palette.triggerColor;
      ctx.beginPath();
      ctx.moveTo(x, y + cellInner);
      ctx.lineTo(x + 12, y + cellInner);
      ctx.lineTo(x, y + cellInner - 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Uses badge
    if (area === 'main' && spell && uses !== undefined && (settings.showSpellCharges || uses === 0) && uses !== -1 && !isTriggered) {
      const usesStr = String(uses);
      ctx.save();
      ctx.font = 'bold 10px monospace';
      const tw = ctx.measureText(usesStr).width;
      const bw = tw + 6;
      const bh = 14;
      const bx = x;
      const by = y + cellInner - bh;
      roundRect(ctx, bx, by, bw, bh, 2);
      ctx.fillStyle = palette.usesBg;
      ctx.fill();
      ctx.fillStyle = uses === 0 ? palette.usesZero : palette.usesNormal;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(usesStr, bx + 3, by + bh / 2);
      ctx.restore();
    }

    // Index number
    const ordinal = absoluteToOrdinal[slotIdx];
    const alwaysCastLabel = area === 'always_cast'
      ? -(areaSlots
        ?.slice(0, slotIdx)
        .filter(Boolean)
        .length ?? 0)
      : null;
    const showMainOrdinal = area === 'main' && !!ordinal;
    const showAlwaysCastIndex = area === 'always_cast' && !!sid && !!alwaysCastLabel;
    if (showMainOrdinal || showAlwaysCastIndex) {
      const showIdx = area === 'always_cast'
        ? true
        : (isAltPressed || settings.showIndices);
      const label = showMainOrdinal
        ? String(ordinal)
        : String(alwaysCastLabel);

      ctx.save();
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      const isAlwaysCastIndex = area === 'always_cast';
      ctx.fillStyle = showIdx
        ? (isAlwaysCastIndex ? palette.indexAlwaysCast : palette.indexVisible)
        : palette.indexHidden;
      if (showIdx && isAlwaysCastIndex) {
        const metrics = ctx.measureText(label);
        const badgeW = Math.max(12, metrics.width + 6);
        const badgeH = 12;
        const badgeX = x + cellInner - badgeW - 1;
        const badgeY = y + cellInner - badgeH - 1;
        roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
        ctx.fillStyle = palette.indexAlwaysCastBg;
        ctx.fill();
        ctx.fillStyle = palette.indexAlwaysCast;
      }
      if (showIdx) {
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.strokeText(label, x + cellInner - 2, y + cellInner - 2);
      }
      ctx.fillText(label, x + cellInner - 2, y + cellInner - 2);
      ctx.restore();
    }

    // Delete button (hover only)
    if (isHovered && spell && !isDragSwap) {
      const dbSize = 16;
      const dbX = x + cellInner;
      const dbY = y - 4;
      ctx.save();
      ctx.beginPath();
      ctx.arc(dbX, dbY, dbSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = palette.deleteCircle;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('×', dbX, dbY);
      ctx.restore();
    }

    ctx.restore();
  };

  // ─── Double-buffer paint ──────────────────────────────────
  const doPaint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { cols, rows, cellOuter, cellInner } = layout;
    const canvasW = cols * cellOuter;
    const canvasH = rows * cellOuter + CANVAS_PADDING_TOP;
    const _gap = settings.editorSpellGap || 0;

    // Resize visible canvas if needed
    const physW = Math.ceil(canvasW * dpr);
    const physH = Math.ceil(canvasH * dpr);
    if (canvas.width !== physW || canvas.height !== physH) {
      canvas.width = physW;
      canvas.height = physH;
      canvas.style.width = `${canvasW}px`;
      canvas.style.height = `${canvasH}px`;
      baseDirtyRef.current = true; // size changed, must repaint base
    }

    // Ensure offscreen canvas exists and matches size
    if (!baseCanvasRef.current) {
      baseCanvasRef.current = document.createElement('canvas');
      baseDirtyRef.current = true;
    }
    const baseCanvas = baseCanvasRef.current;
    if (baseCanvas.width !== physW || baseCanvas.height !== physH) {
      baseCanvas.width = physW;
      baseCanvas.height = physH;
      baseDirtyRef.current = true;
    }

    // ─── Repaint base layer if dirty ──────────────────────
    if (baseDirtyRef.current) {
      baseDirtyRef.current = false;
      const bctx = baseCanvas.getContext('2d')!;
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const palette = resolveThemePalette(settings.coolUITheme);
      bctx.clearRect(0, 0, canvasW, canvasH);
      // Paint all cells without hover/selection overlays
      for (let i = 0; i < totalSlots; i++) {
        bctx.save();
        bctx.translate(0, CANVAS_PADDING_TOP);
        paintCell(bctx, i, _gap, cols, cellOuter, cellInner, true, null, null, null, palette);
        bctx.restore();
      }
    }

    // ─── Composite: blit base → visible canvas ───────────
    ctx.setTransform(1, 0, 0, 1, 0, 0); // identity for drawImage
    ctx.clearRect(0, 0, physW, physH);
    ctx.drawImage(baseCanvas, 0, 0);

    // ─── Overlay: redraw only cells with hover/selection ──
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const _selection = useUIStore.getState().selection;
    const _hovered = useUIStore.getState().hoveredSlot;
    const _drag = useUIStore.getState().dragSource;

    // Collect overlay cell indices (typically 1-5 cells)
    const overlayCells = new Set<number>();

    // Hovered cell
    if (_hovered?.wandSlot === slot && _hovered?.area === area && _hovered.idx >= 1 && _hovered.idx <= totalSlots) {
      overlayCells.add(_hovered.idx - 1);
    }

    // Selected cells
    if (_selection?.wandSlot === slot && _selection?.area === area) {
      for (const idx of _selection.indices) {
        if (idx >= 1 && idx <= totalSlots) overlayCells.add(idx - 1);
      }
    }

    // redraw only overlay cells with full state
    for (const i of overlayCells) {
      // Clear this cell region first
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cellOuter;
      const y = row * cellOuter + CANVAS_PADDING_TOP;
      // Clear the cell area + padding for delete button overflow
      ctx.clearRect(x - 2, y - 20, cellOuter + 4, cellOuter + 22);
      // Blit base cell region from offscreen
      const sx = x * dpr;
      const sy = Math.max(0, (y - 20)) * dpr;
      const sw = (cellOuter + 4) * dpr;
      const sh = (cellOuter + 22) * dpr;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(baseCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
      ctx.restore();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Paint cell with overlays
      // NOTE: paintCell uses relative y, but bctx was translated by CANVAS_PADDING_TOP.
      // So we need to translate context here too to match.
      ctx.save();
      ctx.translate(0, CANVAS_PADDING_TOP);
      const palette = resolveThemePalette(settings.coolUITheme);
      paintCell(ctx, i, _gap, cols, cellOuter, cellInner, false, _selection, _hovered, _drag, palette);
      ctx.restore();
    }
  };

  // Keep paintRef always pointing to the latest paint closure
  paintRef.current = doPaint;

  // Repaint whenever relevant data changes — mark base dirty
  useEffect(() => {
    baseDirtyRef.current = true;
    scheduleRepaint();
  }, [
    area, areaSlots, data.spells, data.deck_capacity, data.spell_uses, data.marked_slots,
    isAltPressed, settings.showIndices, settings.showSpellCharges,
    settings.editorDragMode, settings.dragSpellMode,
    settings.simulateLowHp, settings.simulateManyProjectiles, settings.simulateManyEnemies,
    settings.coolUITheme,
    absoluteToOrdinal, patternMatches, slotMatchMap,
    layout, containerWidth, scheduleRepaint,
  ]);

  // Subscribe to zustand paint-relevant state only (no React re-renders)
  useEffect(() => {
    let prevHovered = useUIStore.getState().hoveredSlot;
    let prevSelection = useUIStore.getState().selection;
    let prevDrag = useUIStore.getState().dragSource;

    const unsub = useUIStore.subscribe((state) => {
      if (state.hoveredSlot !== prevHovered ||
          state.selection !== prevSelection ||
          state.dragSource !== prevDrag) {
        prevHovered = state.hoveredSlot;
        prevSelection = state.selection;
        prevDrag = state.dragSource;
        scheduleRepaint();
      }
    });
    return unsub;
  }, [scheduleRepaint]);

  // Cleanup — must reset rafRef so StrictMode re-mount can schedule new RAF
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, []);

  // ─── Hit-test: convert mouse coords to cell index ──────
  const hitTest = useCallback((clientX: number, clientY: number): { slotIdx: number; isRightHalf: boolean; isDelete: boolean } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    // Account for CSS transform scale (react-zoom-pan-pinch in canvas mode)
    const logicalW = parseFloat(canvas.style.width) || rect.width;
    const logicalH = parseFloat(canvas.style.height) || rect.height;
    const scaleX = rect.width / logicalW;
    const scaleY = rect.height / logicalH;
    const mx = (clientX - rect.left) / scaleX;
    const my = (clientY - rect.top) / scaleY - CANVAS_PADDING_TOP;

    const { cols, cellOuter, cellInner } = layout;
    const _gap = settings.editorSpellGap || 0;

    const col = Math.floor(mx / cellOuter);
    const row = Math.floor(my / cellOuter);
    if (col < 0 || col >= cols) return null;
    if (row < 0) return null;

    const i = row * cols + col;
    if (i < 0 || i >= totalSlots) return null;
    const slotIdx = i + 1;

    if (area === 'main' && i >= data.deck_capacity) return null;

    if (my < row * cellOuter || my > row * cellOuter + cellInner + _gap) return null;

    const cellLocalX = mx - col * cellOuter;
    const isRightHalf = cellLocalX > cellOuter / 2;

    // Check if click is on delete button
    const x = col * cellOuter + _gap / 2;
    const y = row * cellOuter + _gap / 2;
    const dbX = x + cellInner;
    const dbY = y - 4;
    const dist = Math.sqrt((mx - dbX) ** 2 + (my - dbY) ** 2);
    const isDelete = dist <= 10;

    return { slotIdx, isRightHalf, isDelete };
  }, [layout, totalSlots, data.deck_capacity, settings.editorSpellGap]);

  useEffect(() => {
    registerHoverResolver(resolverId, (clientX, clientY) => {
      const hit = hitTest(clientX, clientY);
      if (!hit) return null;
      return {
        wandSlot: slot,
        area,
        idx: hit.slotIdx,
        isRightHalf: hit.isRightHalf,
      };
    });
    return () => unregisterHoverResolver(resolverId);
  }, [registerHoverResolver, unregisterHoverResolver, resolverId, hitTest, slot]);

  // ─── Unified Event Handlers ─────────────────────────────────
  const setHoveredSlot = useUIStore(s => s.setHoveredSlot);

  const updateHoverFromClientPoint = useCallback((clientX: number, clientY: number) => {
    const hit = hitTest(clientX, clientY);
    if (hit) {
      setHoveredSlot({ wandSlot: slot, area, idx: hit.slotIdx, isRightHalf: hit.isRightHalf });
      if (lastHoveredIdxRef.current !== hit.slotIdx) {
        lastHoveredIdxRef.current = hit.slotIdx;
        handleSlotMouseEnter(slot, hit.slotIdx, area);
      }
    } else {
      if (lastHoveredIdxRef.current !== -1) {
        lastHoveredIdxRef.current = -1;
      }
      handleSlotMouseLeave();
    }
  }, [area, hitTest, slot, setHoveredSlot, handleSlotMouseEnter, handleSlotMouseLeave]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const isTouchPointer = e.pointerType === 'touch';
    const shouldUseTouchSelection = isTouchPointer && settings.editorDragMode === 'cursor';

    if (shouldUseTouchSelection) {
      updateHoverFromClientPoint(e.clientX, e.clientY);
      return;
    }

    const resolved = useUIStore.getState().resolveHoveredSlotAtPoint(e.clientX, e.clientY);
    if (resolved && resolved.wandSlot === slot && resolved.area !== area) {
      setHoveredSlot(resolved);
      handleSlotMouseEnter(slot, resolved.idx, resolved.area);
      return;
    }
    updateHoverFromClientPoint(e.clientX, e.clientY);
  }, [
    area,
    handleSlotMouseEnter,
    setHoveredSlot,
    settings.editorDragMode,
    slot,
    updateHoverFromClientPoint,
  ]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    // 允许通过 capture 进行拖拽，防止原生冲突
    const target = e.target as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const isTouchPointer = e.pointerType === 'touch';
    const shouldUseTouchSelection = isTouchPointer && settings.editorDragMode === 'cursor';

    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) {
      setHoveredSlot(null);
      return;
    }

    setHoveredSlot({ wandSlot: slot, area, idx: hit.slotIdx, isRightHalf: hit.isRightHalf });
    lastHoveredIdxRef.current = hit.slotIdx;

    if (shouldUseTouchSelection) {
      mouseDownIdxRef.current = hit.slotIdx;
      handleSlotMouseDown(slot, hit.slotIdx, false, { x: e.clientX, y: e.clientY }, area);
      return;
    }

    if (area === 'always_cast') {
      if (e.button === 0 || e.button === 2) {
        mouseDownIdxRef.current = hit.slotIdx;
        handleSlotMouseDown(slot, hit.slotIdx, e.button === 2, { x: e.clientX, y: e.clientY }, area);
      }
      return;
    }

    if (e.button === 1) { // Middle click
      const sid = data.spells?.[hit.slotIdx.toString()];
      const spell = sid ? spellDb[sid] : null;
      if (e.ctrlKey && sid) {
        openWiki(sid);
        return;
      }
      if (spell) {
        updateWand(slot, (curr) => {
          const marked = Array.isArray(curr.marked_slots) ? curr.marked_slots : [];
          const newMarked = marked.includes(hit.slotIdx)
            ? marked.filter(m => m !== hit.slotIdx)
            : [...marked, hit.slotIdx];
          return { marked_slots: newMarked };
        });
        return;
      }
    }

    if (e.button === 0 || e.button === 2) {
      mouseDownIdxRef.current = hit.slotIdx;
      handleSlotMouseDown(slot, hit.slotIdx, e.button === 2, { x: e.clientX, y: e.clientY }, area);
    }
  }, [area, hitTest, slot, data.spells, spellDb, handleSlotMouseDown, settings.editorDragMode, updateWand, openWiki]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const target = e.target as HTMLElement;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
    const hit = hitTest(e.clientX, e.clientY);
    if (hit) {
      handleSlotMouseUp(slot, hit.slotIdx, area);
    } else {
      const resolved = useUIStore.getState().resolveHoveredSlotAtPoint(e.clientX, e.clientY);
      if (resolved && resolved.wandSlot === slot && resolved.area !== area) {
        handleSlotMouseUp(slot, resolved.idx, resolved.area);
        return;
      }
      const attrBox = area === 'main' ? containerRef.current?.closest('[data-wand-editor-root]')?.querySelector('[data-wand-attributes-box]') as HTMLElement | null : null;
      const inlineAttrRect = attrBox?.getBoundingClientRect();
      const canvasAttrNode = document.getElementById(`canvas-attrs-${slot}`);
      const canvasAttrRect = canvasAttrNode?.getBoundingClientRect();
      const isWithinRect = (rect?: DOMRect | null) => !!rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      const isOverAttrBox = isWithinRect(inlineAttrRect) || isWithinRect(canvasAttrRect);

      if (isOverAttrBox) {
        handleSlotMouseUp(slot, -1000);
      } else {
        handleSlotMouseLeave();
        lastHoveredIdxRef.current = -1;
      }
    }
  }, [area, hitTest, slot, handleSlotMouseUp, handleSlotMouseLeave]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) return;

    const sid = area === 'always_cast'
      ? areaSlots?.[hit.slotIdx - 1] ?? null
      : data.spells?.[hit.slotIdx.toString()] ?? null;
    const spell = sid ? spellDb[sid] : null;
    const idx = hit.slotIdx.toString();
    const uses = area === 'main' ? (data.spell_uses || {})[idx] ?? spell?.max_uses : undefined;

    if (area === 'always_cast') {
      if (hit.isDelete && sid) {
        e.stopPropagation();
        updateWand(slot, (curr) => {
          const nextAlwaysCast = [...(curr.always_cast || [])];
          const idx = hit.slotIdx - 1;
          while (nextAlwaysCast.length <= idx) nextAlwaysCast.push('');
          nextAlwaysCast[idx] = '';
          return { always_cast: nextAlwaysCast };
        }, t('app.notification.delete_spell'));
        return;
      }

      const downIdx = mouseDownIdxRef.current;
      mouseDownIdxRef.current = -1;
      if (downIdx !== -1 && downIdx !== hit.slotIdx) {
        return;
      }

      openPicker(slot, `ac-${hit.slotIdx - 1}`, {
        x: e.clientX,
        y: e.clientY,
        insertAnchor: { wandSlot: slot, idx: hit.slotIdx, isRightHalf: hit.isRightHalf }
      });
      return;
    }

    // Check delete button
    if (hit.isDelete && spell) {
      e.stopPropagation();
      const newSpells = { ...(data.spells || {}) };
      const newSpellUses = { ...(data.spell_uses || {}) };
      delete newSpells[idx];
      delete newSpellUses[idx];
      updateWand(slot, { spells: newSpells, spell_uses: newSpellUses });
      return;
    }

    // Ctrl+click delete
    const ctrlActive = e.ctrlKey || mobileModifiers.ctrl;
    const altActive = e.altKey || mobileModifiers.alt;
    const shiftActive = e.shiftKey || mobileModifiers.shift;
    if (ctrlActive && settings.ctrlClickDelete && !altActive) {
      if (shiftActive) {
        e.preventDefault();
        e.stopPropagation();
        const newSpells: Record<string, string> = {};
        const newSpellUses: Record<string, number> = {};
        let nextIdx = 1;
        for (let j = 1; j <= data.deck_capacity; j++) {
          if (j === hit.slotIdx) continue;
          if (data.spells[j.toString()]) {
            newSpells[nextIdx.toString()] = data.spells[j.toString()];
            if (data.spell_uses?.[j.toString()] !== undefined) {
              newSpellUses[nextIdx.toString()] = data.spell_uses[j.toString()];
            }
          }
          nextIdx++;
        }
        const newCap = Math.max(1, data.deck_capacity - 1);
        updateWand(slot, {
          spells: newSpells,
          spell_uses: newSpellUses,
          deck_capacity: newCap
        }, t('app.notification.delete_wand_slot'));
        consumeMobileModifiers();
        return;
      } else if (sid) {
        e.preventDefault();
        e.stopPropagation();
        updateWand(slot, (curr) => {
          const newSpells = { ...curr.spells };
          const newSpellUses = { ...(curr.spell_uses || {}) };
          delete newSpells[idx];
          delete newSpellUses[idx];
          return { spells: newSpells, spell_uses: newSpellUses };
        }, t('app.notification.delete_spell'));
        consumeMobileModifiers();
        return;
      }
    }

    if (markModeActive && spell && sid && area === 'main') {
      e.preventDefault();
      e.stopPropagation();
      consumeMarkMode();
      updateWand(slot, (curr) => {
        const marked = Array.isArray(curr.marked_slots) ? curr.marked_slots : [];
        const newMarked = marked.includes(hit.slotIdx)
          ? marked.filter(m => m !== hit.slotIdx)
          : [...marked, hit.slotIdx];
        return { marked_slots: newMarked };
      });
      return;
    }

    if (wikiModeActive && spell && sid && area === 'main') {
      e.preventDefault();
      e.stopPropagation();
      consumeWikiMode();
      openWiki(sid);
      return;
    }

    // Alt+click: toggle uses/condition
    if (altActive && spell && sid) {
      e.preventDefault();
      e.stopPropagation();
      consumeMobileModifiers();
      if (sid === 'IF_HP' || sid === 'IF_PROJECTILE' || sid === 'IF_ENEMY') {
        setSettings(prev => {
          const next = { ...prev };
          if (sid === 'IF_HP') next.simulateLowHp = !prev.simulateLowHp;
          if (sid === 'IF_PROJECTILE') next.simulateManyProjectiles = !prev.simulateManyProjectiles;
          if (sid === 'IF_ENEMY') next.simulateManyEnemies = !prev.simulateManyEnemies;
          return next;
        });
        return;
      }
      const newUses = uses === 0 ? (spell.max_uses ?? -1) : 0;
      const actionName = newUses === 0 ? t('app.notification.set_charges_0') : t('app.notification.restore_charges');
      updateWand(slot, (curr) => ({
        spell_uses: { ...(curr.spell_uses || {}), [idx]: newUses }
      }), actionName);
      return;
    }

    // Normal click: open picker or clear selection
    // Skip if this was a drag-select (mouse moved to different cell)
    const downIdx = mouseDownIdxRef.current;
    mouseDownIdxRef.current = -1;
    if (downIdx !== -1 && downIdx !== hit.slotIdx) {
      // Was a drag-select, don't clear selection or open picker
      return;
    }

    const _selection = useUIStore.getState().selection;
    if (_selection && _selection.indices.length > 1) {
      setSelection(null);
    } else {
      // Compute cell screen coordinates from canvas rect + layout
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const logicalW = parseFloat(canvas.style.width) || rect.width;
        const logicalH = parseFloat(canvas.style.height) || rect.height;
        const scaleX = rect.width / logicalW;
        const scaleY = rect.height / logicalH;

        const cellIdx = hit.slotIdx - 1;
        const col = cellIdx % layout.cols;
        const row = Math.floor(cellIdx / layout.cols);
        const _gap = settings.editorSpellGap || 0;

        // Cell position in logical canvas coords
        const cellLogicalX = col * layout.cellOuter + _gap / 2;
        const cellLogicalY = row * layout.cellOuter + _gap / 2 + CANVAS_PADDING_TOP;

        // Row bottom in logical coords (bottom of any cell in this row)
        const rowBottomLogical = row * layout.cellOuter + _gap / 2 + layout.cellInner + CANVAS_PADDING_TOP;
        // Row top in logical coords
        const rowTopLogical = row * layout.cellOuter + _gap / 2 + CANVAS_PADDING_TOP;

        // Convert to screen coords
        const cellScreenCenterX = rect.left + (cellLogicalX + layout.cellInner / 2) * scaleX;
        const rowScreenBottom = rect.top + rowBottomLogical * scaleY;
        const rowScreenTop = rect.top + rowTopLogical * scaleY;

        openPicker(slot, idx, {
          x: cellScreenCenterX,
          y: rowScreenBottom + 4,
          rowTop: rowScreenTop,
          insertAnchor: {
            wandSlot: slot,
            idx: hit.slotIdx,
            isRightHalf: hit.isRightHalf,
          }
        });
      } else {
        openPicker(slot, idx, {
          x: e.clientX,
          y: e.clientY,
          insertAnchor: { wandSlot: slot, idx: hit.slotIdx, isRightHalf: hit.isRightHalf }
        });
      }
    }
  }, [area, areaSlots, hitTest, slot, data, spellDb, settings.ctrlClickDelete, updateWand, openPicker, setSelection, setSettings, t, mobileModifiers, consumeMobileModifiers, markModeActive, consumeMarkMode, wikiModeActive, consumeWikiMode, openWiki]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (hit) {
      const sid = area === 'always_cast'
        ? areaSlots?.[hit.slotIdx - 1]
        : data.spells?.[hit.slotIdx.toString()];
      if (sid) e.preventDefault();
    }
  }, [area, areaSlots, hitTest, data.spells]);

  const handleMouseLeave = useCallback(() => {
    handleSlotMouseLeave();
  }, [handleSlotMouseLeave]);

  // ─── Canvas cursor ─────────────────────────────────────────
  const cursor = settings.editorDragMode === 'hand' ? 'grab' : 'pointer';

  return (
    <div
      ref={containerRef}
      data-spell-grid-canvas-container
      className={isCanvasMode
        ? 'p-1 select-none'
        : 'max-h-[600px] overflow-y-auto custom-scrollbar p-1 select-none'
      }
    >
      <canvas
        ref={canvasRef}
        data-spell-grid-area={area}
        style={{ cursor, imageRendering: 'pixelated', touchAction: 'none' }} data-wand-slot-canvas={`${slot}-${area}`}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handleMouseLeave}
        onContextMenu={handleContextMenu}
        onPointerLeave={handleMouseLeave}
      />
    </div>
  );
});

SpellGridCanvas.displayName = 'SpellGridCanvas';
