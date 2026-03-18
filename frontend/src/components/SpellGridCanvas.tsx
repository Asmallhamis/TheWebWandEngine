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
import { WandData, SpellInfo, AppSettings } from '../types';
import { getCachedIcon, preloadIcons } from '../hooks/useSpellIconCache';
import { useUIStore } from '../store/useUIStore';
import { getUnknownSpellInfo } from '../hooks/useSpellDb';
import { type PatternMatch } from '../lib/spellPatterns';

// ─── constants ──────────────────────────────────────────────────────
const BASE_CELL = 48;
const ICON_SIZE = 40;
const BORDER_RADIUS = 8;

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

// ─── Props ──────────────────────────────────────────────────────────
export interface SpellGridCanvasProps {
  slot: string;
  data: WandData;
  spellDb: Record<string, SpellInfo>;
  settings: AppSettings;
  isConnected: boolean;
  isAltPressed: boolean;
  absoluteToOrdinal: Record<number, number>;
  patternMatches: PatternMatch[];
  isCanvasMode?: boolean;

  handleSlotMouseDown: (slot: string, idx: number, isRightClick?: boolean) => void;
  handleSlotMouseUp: (slot: string, idx: number) => void;
  handleSlotMouseEnter: (slot: string, idx: number) => void;
  handleSlotMouseMove: (e: React.MouseEvent, slot: string, idx: number) => void;
  handleSlotMouseLeave: () => void;
  openPicker: (slot: string, idx: string, e: React.MouseEvent | { x: number; y: number; initialSearch?: string; rowTop?: number }) => void;
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
  slot, data, spellDb, settings, isConnected, isAltPressed,
  absoluteToOrdinal, patternMatches, isCanvasMode,
  handleSlotMouseDown, handleSlotMouseUp, handleSlotMouseEnter,
  handleSlotMouseMove, handleSlotMouseLeave,
  openPicker, setSelection, updateWand, openWiki, setSettings, t,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const paintRef = useRef<() => void>(() => {});
  const baseDirtyRef = useRef(true);
  const lastHoveredIdxRef = useRef<number>(-1);
  const mouseDownIdxRef = useRef<number>(-1);
  const [containerWidth, setContainerWidth] = useState(0);

  // ─── Derived values ─────────────────────────────────────────
  const gap = settings.editorSpellGap || 0;
  const totalSlots = Math.max(data.deck_capacity, 24);
  const layout = useMemo(() => {
    if (isCanvasMode) {
      const cellOuter = BASE_CELL + gap;
      const cellsPerRow = data.canvas_cells_per_row ?? settings.defaultCanvasCellsPerRow ?? 26;
      const cols = Math.min(totalSlots, cellsPerRow);
      const rows = Math.ceil(totalSlots / Math.max(1, cols));
      return { cols, rows, cellOuter, cellInner: BASE_CELL };
    }
    return computeGridLayout(containerWidth || 800, totalSlots, gap);
  }, [containerWidth, totalSlots, gap, isCanvasMode, data.canvas_cells_per_row, settings.defaultCanvasCellsPerRow]);

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
    for (let i = 1; i <= data.deck_capacity; i++) {
      const sid = data.spells?.[i.toString()];
      if (sid) {
        const sp = spellDb[sid];
        if (sp?.icon) paths.push(sp.icon);
      }
    }
    if (paths.length > 0) {
      preloadIcons(paths, isConnected, () => {
        baseDirtyRef.current = true;
        scheduleRepaint();
      });
    }
  }, [data.spells, data.deck_capacity, spellDb, isConnected, scheduleRepaint]);

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
    _drag: any
  ) => {
    const slotIdx = i + 1;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellOuter + _gap / 2;
    const y = row * cellOuter + _gap / 2;
    const isLocked = i >= data.deck_capacity;

    const sid = data.spells?.[slotIdx.toString()] ?? null;
    const spell = sid ? spellDb[sid] : null;
    const uses = (data.spell_uses || {})[slotIdx.toString()] ?? spell?.max_uses;

    const isSelected = !skipOverlay && _selection?.wandSlot === slot && _selection.indices.includes(slotIdx);
    const isHovered = !skipOverlay && _hovered?.wandSlot === slot && _hovered.idx === slotIdx;
    const isDragSwap = isHovered && _drag && settings.dragSpellMode === 'noita_swap';
    const isMarked = Array.isArray(data.marked_slots) && data.marked_slots.includes(slotIdx);

    const isTriggered = (sid === 'IF_HP' && settings.simulateLowHp) ||
      (sid === 'IF_PROJECTILE' && settings.simulateManyProjectiles) ||
      (sid === 'IF_ENEMY' && settings.simulateManyEnemies);
    const isGrayscale = uses === 0 || isTriggered;

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
      ctx.fillStyle = C.bgSelected;
    } else if (isDragSwap) {
      ctx.fillStyle = C.bgDragSwap;
    } else if (sid && !spell) {
      ctx.fillStyle = C.bgUnknown;
    } else {
      ctx.fillStyle = C.bgNormal;
    }
    ctx.fill();

    // Border
    roundRect(ctx, x + 0.5, y + 0.5, cellInner - 1, cellInner - 1, BORDER_RADIUS);
    ctx.strokeStyle = isSelected ? C.borderSelected
      : isDragSwap ? C.borderDragSwap
      : isHovered ? C.borderHover
      : sid && !spell ? C.borderUnknown
      : C.borderNormal;
    ctx.lineWidth = isSelected || isDragSwap ? 2 : 1;
    ctx.stroke();

    // Selection ring
    if (isSelected) {
      ctx.save();
      roundRect(ctx, x - 1, y - 1, cellInner + 2, cellInner + 2, BORDER_RADIUS + 1);
      ctx.strokeStyle = C.selectionGlow;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // Marked ring
    if (isMarked) {
      ctx.save();
      roundRect(ctx, x - 1, y - 1, cellInner + 2, cellInner + 2, BORDER_RADIUS + 1);
      ctx.strokeStyle = C.markedRing;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Hover indicator line
    if (isHovered && _hovered && !isDragSwap) {
      const lineX = _hovered.isRightHalf ? x + cellInner + _gap / 2 + 1 : x - _gap / 2 - 1;
      ctx.save();
      roundRect(ctx, lineX - 2, y, 4, cellInner, 2);
      ctx.fillStyle = C.hoverLine;
      ctx.fill();
      ctx.restore();
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
        baseDirtyRef.current = true;
        scheduleRepaint();
      });
      if (img) {
        ctx.save();
        if (isGrayscale) {
          ctx.globalAlpha = 0.5;
          ctx.filter = 'grayscale(100%)';
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, cx - ICON_SIZE / 2, cy - ICON_SIZE / 2, ICON_SIZE, ICON_SIZE);
        ctx.restore();
      }
    } else if (sid && !isLocked) {
      const info = getUnknownSpellInfo(sid);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (info?.mod_id) {
        ctx.fillStyle = C.unknownMod;
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(`@${info.mod_id}`, cx, cy - 6, cellInner - 4);
      } else {
        ctx.fillStyle = C.unknownPrimary;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('?', cx, cy - 4);
      }
      ctx.fillStyle = C.unknownSec;
      ctx.font = '9px monospace';
      const displaySid = sid.length > 8 ? sid.substring(0, 7) + '…' : sid;
      ctx.fillText(displaySid, cx, cy + 8, cellInner - 4);
      ctx.restore();
    } else if (!isLocked) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.plus;
      ctx.font = '300 24px sans-serif';
      ctx.fillText('+', cx, cy);
      ctx.restore();
    }

    // Pattern bar
    const pm = slotMatchMap[slotIdx];
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
      ctx.fillStyle = C.triggerColor;
      ctx.beginPath();
      ctx.moveTo(x, y + cellInner);
      ctx.lineTo(x + 12, y + cellInner);
      ctx.lineTo(x, y + cellInner - 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Uses badge
    if (spell && uses !== undefined && (settings.showSpellCharges || uses === 0) && uses !== -1 && !isTriggered) {
      const usesStr = String(uses);
      ctx.save();
      ctx.font = 'bold 10px monospace';
      const tw = ctx.measureText(usesStr).width;
      const bw = tw + 6;
      const bh = 14;
      const bx = x;
      const by = y + cellInner - bh;
      roundRect(ctx, bx, by, bw, bh, 2);
      ctx.fillStyle = C.usesBg;
      ctx.fill();
      ctx.fillStyle = uses === 0 ? C.usesZero : C.usesNormal;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(usesStr, bx + 3, by + bh / 2);
      ctx.restore();
    }

    // Index number
    const ordinal = absoluteToOrdinal[slotIdx];
    if (ordinal) {
      const showIdx = isAltPressed || settings.showIndices;
      ctx.save();
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = showIdx ? C.indexVisible : C.indexHidden;
      if (showIdx) {
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.strokeText(String(ordinal), x + cellInner - 2, y + cellInner - 2);
      }
      ctx.fillText(String(ordinal), x + cellInner - 2, y + cellInner - 2);
      ctx.restore();
    }

    // Delete button (hover only)
    if (isHovered && spell && !isDragSwap) {
      const dbSize = 16;
      const dbX = x + cellInner - dbSize / 2 + 2;
      const dbY = y - dbSize / 2 + 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(dbX, dbY, dbSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = C.deleteCircle;
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
    const canvasH = rows * cellOuter;
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
      bctx.clearRect(0, 0, canvasW, canvasH);
      // Paint all cells without hover/selection overlays
      for (let i = 0; i < totalSlots; i++) {
        paintCell(bctx, i, _gap, cols, cellOuter, cellInner, true, null, null, null);
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
    if (_hovered?.wandSlot === slot && _hovered.idx >= 1 && _hovered.idx <= totalSlots) {
      overlayCells.add(_hovered.idx - 1);
    }

    // Selected cells
    if (_selection?.wandSlot === slot) {
      for (const idx of _selection.indices) {
        if (idx >= 1 && idx <= totalSlots) overlayCells.add(idx - 1);
      }
    }

    // Redraw only overlay cells with full state
    for (const i of overlayCells) {
      // Clear this cell region first
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cellOuter;
      const y = row * cellOuter;
      // Clear the cell area + padding for delete button overflow
      ctx.clearRect(x - 2, y - 10, cellOuter + 4, cellOuter + 12);
      // Blit base cell region from offscreen
      const sx = x * dpr;
      const sy = Math.max(0, (y - 10)) * dpr;
      const sw = (cellOuter + 4) * dpr;
      const sh = (cellOuter + 12) * dpr;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(baseCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
      ctx.restore();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Paint cell with overlays
      paintCell(ctx, i, _gap, cols, cellOuter, cellInner, false, _selection, _hovered, _drag);
    }
  };

  // Keep paintRef always pointing to the latest paint closure
  paintRef.current = doPaint;

  // Repaint whenever relevant data changes — mark base dirty
  useEffect(() => {
    baseDirtyRef.current = true;
    scheduleRepaint();
  }, [
    data.spells, data.deck_capacity, data.spell_uses, data.marked_slots,
    isAltPressed, settings.showIndices, settings.showSpellCharges,
    settings.editorDragMode, settings.dragSpellMode,
    settings.simulateLowHp, settings.simulateManyProjectiles, settings.simulateManyEnemies,
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
    const my = (clientY - rect.top) / scaleY;

    const { cols, cellOuter, cellInner } = layout;
    const _gap = settings.editorSpellGap || 0;

    const col = Math.floor(mx / cellOuter);
    const row = Math.floor(my / cellOuter);
    if (col < 0 || col >= cols) return null;

    const i = row * cols + col;
    if (i < 0 || i >= totalSlots) return null;
    const slotIdx = i + 1;

    if (i >= data.deck_capacity) return null;

    const cellLocalX = mx - col * cellOuter;
    const isRightHalf = cellLocalX > cellOuter / 2;

    // Check if click is on delete button
    const x = col * cellOuter + _gap / 2;
    const y = row * cellOuter + _gap / 2;
    const dbX = x + cellInner - 16 / 2 + 2;
    const dbY = y - 16 / 2 + 2;
    const dist = Math.sqrt((mx - dbX) ** 2 + (my - dbY) ** 2);
    const isDelete = dist <= 10;

    return { slotIdx, isRightHalf, isDelete };
  }, [layout, totalSlots, data.deck_capacity, settings.editorSpellGap]);

  // ─── Mouse event handlers ─────────────────────────────────
  const setHoveredSlot = useUIStore(s => s.setHoveredSlot);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (hit) {
      // Set hovered slot directly with correct isRightHalf from canvas hit-test
      // (bypasses handleSlotMouseMove which uses e.currentTarget — wrong for canvas)
      setHoveredSlot({ wandSlot: slot, idx: hit.slotIdx, isRightHalf: hit.isRightHalf });

      // Simulate mouseEnter: call handleSlotMouseEnter when cell changes
      // (drives drag-to-select in useInteraction)
      if (lastHoveredIdxRef.current !== hit.slotIdx) {
        lastHoveredIdxRef.current = hit.slotIdx;
        handleSlotMouseEnter(slot, hit.slotIdx);
      }
    } else {
      if (lastHoveredIdxRef.current !== -1) {
        lastHoveredIdxRef.current = -1;
      }
      handleSlotMouseLeave();
    }
  }, [hitTest, slot, setHoveredSlot, handleSlotMouseEnter, handleSlotMouseLeave]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) return;

    if (e.button === 1) {
      const sid = data.spells?.[hit.slotIdx.toString()];
      const spell = sid ? spellDb[sid] : null;
      if (e.ctrlKey && sid) {
        e.preventDefault();
        e.stopPropagation();
        openWiki(sid);
        return;
      }
      if (spell) {
        e.preventDefault();
        e.stopPropagation();
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
      e.preventDefault();
      mouseDownIdxRef.current = hit.slotIdx;
      handleSlotMouseDown(slot, hit.slotIdx, e.button === 2);
    }
  }, [hitTest, slot, data.spells, spellDb, handleSlotMouseDown, updateWand, openWiki]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (hit) {
      handleSlotMouseUp(slot, hit.slotIdx);
    }
  }, [hitTest, slot, handleSlotMouseUp]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) return;

    const sid = data.spells?.[hit.slotIdx.toString()] ?? null;
    const spell = sid ? spellDb[sid] : null;
    const idx = hit.slotIdx.toString();
    const uses = (data.spell_uses || {})[idx] ?? spell?.max_uses;

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
    if (e.ctrlKey && settings.ctrlClickDelete && !e.altKey) {
      if (e.shiftKey) {
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
        return;
      }
    }

    // Alt+click: toggle uses/condition
    if (e.altKey && spell && sid) {
      e.preventDefault();
      e.stopPropagation();
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
        const cellLogicalY = row * layout.cellOuter + _gap / 2;

        // Row bottom in logical coords (bottom of any cell in this row)
        const rowBottomLogical = row * layout.cellOuter + _gap / 2 + layout.cellInner;
        // Row top in logical coords
        const rowTopLogical = row * layout.cellOuter + _gap / 2;

        // Convert to screen coords
        const cellScreenCenterX = rect.left + (cellLogicalX + layout.cellInner / 2) * scaleX;
        const rowScreenBottom = rect.top + rowBottomLogical * scaleY;
        const rowScreenTop = rect.top + rowTopLogical * scaleY;

        openPicker(slot, idx, {
          x: cellScreenCenterX,
          y: rowScreenBottom + 4,
          rowTop: rowScreenTop,
        });
      } else {
        openPicker(slot, idx, e);
      }
    }
  }, [hitTest, slot, data, spellDb, settings.ctrlClickDelete, updateWand, openPicker, setSelection, setSettings, t]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (hit) {
      const sid = data.spells?.[hit.slotIdx.toString()];
      if (sid) e.preventDefault();
    }
  }, [hitTest, data.spells]);

  const handleMouseLeave = useCallback(() => {
    handleSlotMouseLeave();
  }, [handleSlotMouseLeave]);

  // ─── Canvas cursor ─────────────────────────────────────────
  const cursor = settings.editorDragMode === 'hand' ? 'grab' : 'pointer';

  return (
    <div
      ref={containerRef}
      className={isCanvasMode
        ? 'p-1 select-none'
        : 'max-h-[600px] overflow-y-auto custom-scrollbar p-1 select-none'
      }
    >
      <canvas
        ref={canvasRef}
        style={{ cursor, imageRendering: 'pixelated' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
});

SpellGridCanvas.displayName = 'SpellGridCanvas';
