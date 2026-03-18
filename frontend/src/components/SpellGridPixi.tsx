import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Application,
  BitmapFont,
  BitmapText,
  Container,
  Graphics,
  RenderTexture,
  SCALE_MODES,
  Sprite,
  Text,
  TextStyle,
  Texture
} from 'pixi.js';
import { WandData, SpellInfo, AppSettings } from '../types';
import { getIconUrl } from '../lib/evaluatorAdapter';
import { getUnknownSpellInfo } from '../hooks/useSpellDb';
import { useUIStore } from '../store/useUIStore';
import { useTranslation } from 'react-i18next';
import type { PatternMatch } from '../lib/spellPatterns';

const BASE_CELL_SIZE = 48;

const COLORS = {
  bg: 0x27272a,
  bgHover: 0x3f3f46,
  bgSelected: 0x6366f1,
  border: 0xffffff,
  borderHover: 0x6366f1,
  borderUnknown: 0xf97316,
  marked: 0xf59e0b,
  usesBg: 0x000000,
  usesText: 0xfbbf24,
  usesZero: 0xef4444,
  indexVisible: 0x22d3ee,
  unknownAccent: 0xf97316,
  unknownMod: 0x22d3ee,
  trigger: 0xef4444
};

type LayoutMetrics = {
  cols: number;
  rows: number;
  cellOuter: number;
  cellInner: number;
  gap: number;
  width: number;
  height: number;
  paddingLeft: number;
  paddingTop: number;
};

type Cell = {
  container: Container;
  bg: Sprite;
  border: Graphics;
  selectionRing: Graphics;
  hoverBorder: Graphics;
  hoverLine: Graphics;
  patternBar: Graphics;
  icon: Sprite;
  plusText: Text;
  unknownPrimary: Text;
  unknownSecondary: Text;
  deleteBadge: Graphics;
  deleteX: Text;
  usesBg: Graphics;
  usesText: BitmapText;
  indexText: BitmapText;
  markedRing: Graphics;
  triggerTriangle: Graphics;
  size: number;
  usesHitRect: { x: number; y: number; width: number; height: number } | null;
  deleteHitRect: { x: number; y: number; width: number; height: number } | null;
};

export interface SpellGridPixiHandle {
  getCellRect: (idx: number) => DOMRect | null;
  getLayout: () => LayoutMetrics | null;
  getCanvas: () => HTMLCanvasElement | null;
  exportImageBlob: (options: { pure: boolean }) => Promise<Blob | null>;
}

interface SpellGridPixiProps {
  slot: string;
  data: WandData;
  spellDb: Record<string, SpellInfo>;
  settings: AppSettings;
  isConnected: boolean;
  isAltPressed: boolean;
  absoluteToOrdinal: Record<number, number>;
  slotMatchMap: Record<number, PatternMatch>;
  handleSlotMouseDown: (slot: string, idx: number, isRightClick?: boolean) => void;
  handleSlotMouseUp: (slot: string, idx: number) => void;
  handleSlotMouseEnter: (slot: string, idx: number) => void;
  handleSlotMouseLeave: () => void;
  openPicker: (slot: string, idx: string, e: React.MouseEvent | { x: number; y: number; initialSearch?: string; rowTop?: number }) => void;
  setSelection: (s: any) => void;
  updateWand: (slot: string, partial: Partial<WandData> | ((prev: WandData) => Partial<WandData>), actionName?: string, icons?: string[]) => void;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  openWiki: (sid: string) => void;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
}

const ensureBitmapFonts = () => {
  if (!BitmapFont.available['WandGridSmall']) {
    BitmapFont.from('WandGridSmall', {
      fontFamily: 'monospace',
      fontSize: 10,
      fill: '#ffffff'
    });
  }
};

const colorFromCss = (value?: string) => {
  if (!value) return 0xffffff;
  const trimmed = value.trim();
  if (trimmed.startsWith('#')) {
    const hex = trimmed.replace('#', '');
    return parseInt(hex, 16);
  }
  return 0xffffff;
};

const createCell = (): Cell => {
  const container = new Container();
  container.sortableChildren = true;

  const bg = new Sprite(Texture.WHITE);
  bg.zIndex = 1;
  container.addChild(bg);

  const border = new Graphics();
  border.zIndex = 2;
  container.addChild(border);

  const patternBar = new Graphics();
  patternBar.zIndex = 3;
  container.addChild(patternBar);

  const icon = new Sprite(Texture.WHITE);
  icon.zIndex = 4;
  icon.anchor.set(0.5);
  container.addChild(icon);

  const plusText = new Text('+', new TextStyle({ fontFamily: 'sans-serif', fontSize: 24, fill: '#3f3f46' }));
  plusText.anchor.set(0.5);
  plusText.zIndex = 4;
  container.addChild(plusText);

  const unknownPrimary = new Text('', new TextStyle({ fontFamily: 'sans-serif', fontSize: 10, fill: '#f97316', fontWeight: '700' }));
  unknownPrimary.anchor.set(0.5);
  unknownPrimary.zIndex = 4;
  container.addChild(unknownPrimary);

  const unknownSecondary = new Text('', new TextStyle({ fontFamily: 'monospace', fontSize: 9, fill: '#f97316' }));
  unknownSecondary.anchor.set(0.5);
  unknownSecondary.zIndex = 4;
  container.addChild(unknownSecondary);

  const deleteBadge = new Graphics();
  deleteBadge.zIndex = 10;
  container.addChild(deleteBadge);

  const deleteX = new Text('×', new TextStyle({ fontFamily: 'sans-serif', fontSize: 12, fill: '#ffffff', fontWeight: '700' }));
  deleteX.anchor.set(0.5);
  deleteX.zIndex = 11;
  container.addChild(deleteX);

  const usesBg = new Graphics();
  usesBg.zIndex = 6;
  container.addChild(usesBg);

  const usesText = new BitmapText('', { fontName: 'WandGridSmall', fontSize: 10 });
  usesText.zIndex = 7;
  container.addChild(usesText);

  const indexText = new BitmapText('', { fontName: 'WandGridSmall', fontSize: 10 });
  indexText.zIndex = 7;
  container.addChild(indexText);

  const selectionRing = new Graphics();
  selectionRing.zIndex = 8;
  container.addChild(selectionRing);

  const markedRing = new Graphics();
  markedRing.zIndex = 8;
  container.addChild(markedRing);

  const triggerTriangle = new Graphics();
  triggerTriangle.zIndex = 8;
  container.addChild(triggerTriangle);

  const hoverBorder = new Graphics();
  hoverBorder.zIndex = 9;
  container.addChild(hoverBorder);

  const hoverLine = new Graphics();
  hoverLine.zIndex = 9;
  container.addChild(hoverLine);

  return {
    container,
    bg,
    border,
    selectionRing,
    hoverBorder,
    hoverLine,
    patternBar,
    icon,
    plusText,
    unknownPrimary,
    unknownSecondary,
    deleteBadge,
    deleteX,
    usesBg,
    usesText,
    indexText,
    markedRing,
    triggerTriangle,
    size: BASE_CELL_SIZE,
    usesHitRect: null,
    deleteHitRect: null
  };
};

const layoutCell = (cell: Cell) => {
  const size = cell.size;

  cell.bg.width = size;
  cell.bg.height = size;

  cell.icon.position.set(size / 2, size / 2);
  cell.plusText.position.set(size / 2, size / 2);

  cell.unknownPrimary.position.set(size / 2, size / 2 - 4);
  cell.unknownSecondary.position.set(size / 2, size / 2 + 6);

  const deleteSize = 16;
  cell.deleteX.position.set(size - deleteSize / 2 + 2, deleteSize / 2 - 2);

  cell.usesText.position.set(4, size - 12);
  cell.indexText.position.set(size - cell.indexText.width - 4, size - 12);
};

const computeLayout = (options: {
  contentWidth: number;
  totalSlots: number;
  gap: number;
  paddingLeft: number;
  paddingTop: number;
  cellOuterOverride?: number;
  colsOverride?: number;
}): LayoutMetrics => {
  const {
    contentWidth,
    totalSlots,
    gap,
    paddingLeft,
    paddingTop,
    cellOuterOverride,
    colsOverride
  } = options;

  const minCellOuter = BASE_CELL_SIZE + gap;
  const availableWidth = Math.max(1, contentWidth || minCellOuter);
  const cols = Math.max(1, colsOverride ?? Math.floor(availableWidth / minCellOuter) || 1);
  const cellOuter = cellOuterOverride ?? (availableWidth / cols);
  const cellInner = Math.max(1, cellOuter - gap);
  const rows = Math.max(1, Math.ceil(totalSlots / cols));
  const width = cols * cellOuter;
  const height = rows * cellOuter;

  return {
    cols,
    rows,
    cellOuter,
    cellInner,
    gap,
    width,
    height,
    paddingLeft,
    paddingTop
  };
};

export const SpellGridPixi = React.forwardRef<SpellGridPixiHandle, SpellGridPixiProps>((props, ref) => {
  const {
    slot,
    data,
    spellDb,
    settings,
    isConnected,
    isAltPressed,
    absoluteToOrdinal,
    slotMatchMap,
    handleSlotMouseDown,
    handleSlotMouseUp,
    handleSlotMouseEnter,
    handleSlotMouseLeave,
    openPicker,
    setSelection,
    updateWand,
    setSettings,
    openWiki,
    canvasRef
  } = props;

  const { t } = useTranslation();
  const selection = useUIStore(s => s.selection);
  const hoveredSlot = useUIStore(s => s.hoveredSlot);
  const dragSource = useUIStore(s => s.dragSource);

  const scrollRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const cellPoolRef = useRef<Cell[]>([]);
  const gridContainerRef = useRef<Container | null>(null);
  const layoutRef = useRef<LayoutMetrics | null>(null);
  const scrollTopRef = useRef(0);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const totalSlots = useMemo(() => Math.max(data.deck_capacity, 24), [data.deck_capacity]);
  const gap = settings.editorSpellGap || 0;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const updateSize = () => {
      setViewportSize({ width: el.clientWidth, height: el.clientHeight });
    };

    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    ensureBitmapFonts();
    if (!canvasHostRef.current) return;

    const app = new Application({
      backgroundAlpha: 0,
      antialias: false,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1
    });

    app.renderer.roundPixels = true;
    appRef.current = app;
    const view = (app.view ?? (app as any).canvas) as HTMLCanvasElement;
    canvasHostRef.current.appendChild(view);

    if (canvasRef) {
      canvasRef.current = view;
    }

    const gridContainer = new Container();
    gridContainer.sortableChildren = true;
    gridContainerRef.current = gridContainer;
    app.stage.addChild(gridContainer);

    return () => {
      if (canvasRef) {
        canvasRef.current = null;
      }
      app.destroy(true, { children: true, texture: true });
      appRef.current = null;
      gridContainerRef.current = null;
    };
  }, [canvasRef]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;

    const onScroll = () => {
      scrollTopRef.current = el.scrollTop;
      if (gridContainerRef.current) {
        gridContainerRef.current.y = -el.scrollTop;
      }
    };

    onScroll();
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!appRef.current) return;
    appRef.current.renderer.resize(viewportSize.width || 1, viewportSize.height || 1);
  }, [viewportSize]);

  const ensurePool = (count: number) => {
    const pool = cellPoolRef.current;
    const container = gridContainerRef.current;
    if (!container) return;
    while (pool.length < count) {
      const cell = createCell();
      pool.push(cell);
      container.addChild(cell.container);
    }
  };

  const applyLayout = (layout: LayoutMetrics, orderMap?: Map<number, number>) => {
    layoutRef.current = layout;
    const pool = cellPoolRef.current;
    const total = pool.length;

    for (let i = 0; i < total; i++) {
      const cell = pool[i];
      const displayIndex = orderMap ? orderMap.get(i) : i;
      if (displayIndex === undefined || displayIndex === null) {
        cell.container.visible = false;
        continue;
      }

      cell.container.visible = true;
      const row = Math.floor(displayIndex / layout.cols);
      const col = displayIndex % layout.cols;
      cell.container.x = col * layout.cellOuter + layout.gap / 2;
      cell.container.y = row * layout.cellOuter + layout.gap / 2;
      cell.size = layout.cellInner;
      layoutCell(cell);
    }

    if (spacerRef.current) {
      spacerRef.current.style.width = `${layout.width}px`;
      spacerRef.current.style.height = `${layout.height}px`;
    }
  };

  const updateCells = (options?: { exportMode?: 'normal' | 'pure' }) => {
    const pool = cellPoolRef.current;
    const layout = layoutRef.current;
    if (!layout) return;

    const exportMode = options?.exportMode ?? 'normal';
    const selectionState = selection;
    const hoveredState = hoveredSlot;
    const dragState = dragSource;

    for (let i = 0; i < pool.length; i++) {
      const cell = pool[i];
      if (!cell.container.visible) continue;
      if (i >= totalSlots) {
        cell.container.visible = false;
        continue;
      }

      const idx = i + 1;
      const idxStr = idx.toString();
      const sid = data.spells ? data.spells[idxStr] : null;
      const spell = sid ? spellDb[sid] : null;
      const uses = (data.spell_uses || {})[idxStr] ?? spell?.max_uses;
      const isLocked = i >= data.deck_capacity;
      const isSelected = selectionState?.wandSlot === slot && selectionState.indices.includes(idx);
      const isHovered = hoveredState?.wandSlot === slot && hoveredState.idx === idx;
      const isDragSwap = isHovered && dragState && settings.dragSpellMode === 'noita_swap';
      const isInsertLine = isHovered && dragState && settings.dragSpellMode !== 'noita_swap';
      const isMarked = Array.isArray(data.marked_slots) && data.marked_slots.includes(idx);
      const isTriggered = (sid === 'IF_HP' && settings.simulateLowHp) ||
        (sid === 'IF_PROJECTILE' && settings.simulateManyProjectiles) ||
        (sid === 'IF_ENEMY' && settings.simulateManyEnemies);
      const isGrayscale = (uses === 0) || isTriggered;
      const showUses = uses !== undefined && (settings.showSpellCharges || uses === 0) && uses !== -1 && !isTriggered;
      const showIndex = !isLocked && absoluteToOrdinal[idx] && (isAltPressed || settings.showIndices);
      const pattern = slotMatchMap[idx];

      if (exportMode === 'pure' && !sid) {
        cell.container.visible = false;
        continue;
      }

      cell.container.alpha = isLocked ? 0.1 : 1;

      const baseBg = isLocked ? 0x000000 : (sid && !spell ? 0x3b0b0b : COLORS.bg);
      const hoverBg = sid && !spell ? 0x4c1111 : COLORS.bgHover;
      cell.bg.tint = isSelected ? COLORS.bgSelected : (isHovered ? hoverBg : baseBg);
      cell.bg.alpha = exportMode === 'pure' ? 0 : (isSelected ? 0.4 : 0.8);

      cell.border.clear();
      if (!isLocked) {
        const borderColor = sid && !spell ? COLORS.borderUnknown : (isHovered ? COLORS.borderHover : COLORS.border);
        const borderAlpha = exportMode === 'pure' ? 0 : (sid && !spell ? 0.6 : 0.2);
        cell.border.lineStyle({ width: 1, color: borderColor, alpha: borderAlpha });
        cell.border.drawRoundedRect(0, 0, cell.size, cell.size, 6);
      }

      cell.selectionRing.clear();
      if (isSelected && exportMode === 'normal') {
        cell.selectionRing.lineStyle({ width: 2, color: COLORS.bgSelected, alpha: 1 });
        cell.selectionRing.drawRoundedRect(1, 1, cell.size - 2, cell.size - 2, 6);
      }

      cell.markedRing.clear();
      if (isMarked && exportMode === 'normal') {
        cell.markedRing.lineStyle({ width: 2, color: COLORS.marked, alpha: 1 });
        cell.markedRing.drawRoundedRect(1, 1, cell.size - 2, cell.size - 2, 6);
      }

      cell.hoverBorder.clear();
      if (isDragSwap && exportMode === 'normal') {
        cell.hoverBorder.lineStyle({ width: 2, color: COLORS.borderHover, alpha: 1 });
        cell.hoverBorder.drawRoundedRect(1, 1, cell.size - 2, cell.size - 2, 6);
      }

      cell.hoverLine.clear();
      if (isInsertLine && exportMode === 'normal' && hoveredState) {
        const offset = gap / 2 + 2;
        const lineX = hoveredState.isRightHalf ? cell.size + offset : -offset;
        cell.hoverLine.beginFill(COLORS.borderHover, 1);
        cell.hoverLine.drawRoundedRect(lineX, 0, 4, cell.size, 3);
        cell.hoverLine.endFill();
      }

      cell.patternBar.clear();
      if (pattern && exportMode === 'normal') {
        cell.patternBar.beginFill(colorFromCss(pattern.color), 1);
        cell.patternBar.drawRect(0, cell.size - 3, cell.size, 3);
        cell.patternBar.endFill();
      }

      cell.triggerTriangle.clear();
      if (isTriggered && exportMode === 'normal') {
        cell.triggerTriangle.beginFill(COLORS.trigger, 1);
        cell.triggerTriangle.drawPolygon([0, cell.size, 12, cell.size, 0, cell.size - 12]);
        cell.triggerTriangle.endFill();
      }

      cell.deleteBadge.clear();
      cell.deleteX.visible = false;
      cell.deleteHitRect = null;
      if (isHovered && sid && exportMode === 'normal' && !isLocked) {
        const deleteSize = 16;
        const centerX = cell.size - deleteSize / 2 + 2;
        const centerY = deleteSize / 2 - 2;
        cell.deleteBadge.beginFill(0xef4444, 1);
        cell.deleteBadge.drawCircle(centerX, centerY, deleteSize / 2);
        cell.deleteBadge.endFill();
        cell.deleteX.visible = true;
        cell.deleteHitRect = {
          x: centerX - deleteSize / 2,
          y: centerY - deleteSize / 2,
          width: deleteSize,
          height: deleteSize
        };
      }

      cell.icon.visible = !!spell;
      cell.plusText.visible = !isLocked && !sid;
      cell.unknownPrimary.visible = !!sid && !spell && !isLocked;
      cell.unknownSecondary.visible = !!sid && !spell && !isLocked;

      if (spell) {
        const url = getIconUrl(spell.icon, isConnected);
        const texture = Texture.from(url);
        texture.baseTexture.scaleMode = SCALE_MODES.NEAREST;
        cell.icon.texture = texture;
        cell.icon.width = 40;
        cell.icon.height = 40;
        cell.icon.alpha = isGrayscale ? 0.5 : 1;
        cell.icon.tint = isGrayscale ? 0x888888 : 0xffffff;
      }

      if (sid && !spell) {
        const info = getUnknownSpellInfo(sid);
        if (info?.mod_id) {
          cell.unknownPrimary.text = `@${info.mod_id}`;
          cell.unknownPrimary.style = new TextStyle({ fontFamily: 'sans-serif', fontSize: 8, fill: COLORS.unknownMod });
          cell.unknownSecondary.text = sid;
        } else {
          cell.unknownPrimary.text = '?';
          cell.unknownPrimary.style = new TextStyle({ fontFamily: 'sans-serif', fontSize: 12, fill: COLORS.unknownAccent, fontWeight: '700' });
          cell.unknownSecondary.text = sid;
        }
      }

      if (showUses && spell && exportMode === 'normal') {
        cell.usesText.text = uses.toString();
        cell.usesText.tint = uses === 0 ? COLORS.usesZero : COLORS.usesText;
        cell.usesText.visible = true;
        cell.usesBg.clear();
        const padX = 3;
        const padY = 1;
        const bgWidth = cell.usesText.width + padX * 2;
        const bgHeight = cell.usesText.height + padY * 2;
        cell.usesBg.beginFill(COLORS.usesBg, 0.9);
        cell.usesBg.drawRoundedRect(2, cell.size - bgHeight - 2, bgWidth, bgHeight, 2);
        cell.usesBg.endFill();
        cell.usesText.position.set(2 + padX, cell.size - bgHeight - 2 + padY);
        cell.usesHitRect = { x: 2, y: cell.size - bgHeight - 2, width: bgWidth, height: bgHeight };
      } else {
        cell.usesText.visible = false;
        cell.usesBg.clear();
        cell.usesHitRect = null;
      }

      if (showIndex && exportMode === 'normal') {
        cell.indexText.text = absoluteToOrdinal[idx].toString();
        cell.indexText.tint = COLORS.indexVisible;
        cell.indexText.visible = true;
        cell.indexText.position.set(cell.size - cell.indexText.width - 4, cell.size - 12);
      } else {
        cell.indexText.visible = false;
      }
    }
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const style = getComputedStyle(container);
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingRight = parseFloat(style.paddingRight) || 0;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const contentWidth = Math.max(1, (viewportSize.width || 1) - paddingLeft - paddingRight);

    ensurePool(totalSlots);
    const layout = computeLayout({
      contentWidth,
      totalSlots,
      gap,
      paddingLeft,
      paddingTop
    });
    applyLayout(layout);
    updateCells();
  }, [viewportSize.width, viewportSize.height, totalSlots, gap]);

  useEffect(() => {
    updateCells();
  }, [
    data.spells,
    data.spell_uses,
    data.deck_capacity,
    data.marked_slots,
    selection,
    hoveredSlot,
    dragSource,
    settings.dragSpellMode,
    settings.editorDragMode,
    settings.showSpellCharges,
    settings.showIndices,
    settings.simulateLowHp,
    settings.simulateManyEnemies,
    settings.simulateManyProjectiles,
    spellDb,
    isConnected,
    isAltPressed,
    absoluteToOrdinal,
    slotMatchMap
  ]);

  const getCellFromEvent = (event: PointerEvent | MouseEvent) => {
    const layout = layoutRef.current;
    const container = scrollRef.current;
    if (!layout || !container) return null;

    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left - layout.paddingLeft;
    const y = event.clientY - rect.top - layout.paddingTop + scrollTopRef.current;
    if (x < 0 || y < 0) return null;

    const col = Math.floor(x / layout.cellOuter);
    const row = Math.floor(y / layout.cellOuter);
    const idx = row * layout.cols + col + 1;
    if (idx < 1 || idx > totalSlots) return null;
    return { idx, col, row, localX: x, localY: y };
  };

  const openPickerAt = (idx: number, col: number, row: number) => {
    const layout = layoutRef.current;
    const container = scrollRef.current;
    if (!layout || !container) return;

    const rect = container.getBoundingClientRect();
    const x = rect.left + layout.paddingLeft + col * layout.cellOuter + layout.gap / 2;
    const rowTop = rect.top + layout.paddingTop + row * layout.cellOuter - scrollTopRef.current;
    const y = rowTop + layout.cellOuter + 4;
    openPicker(slot, idx.toString(), { x, y, rowTop });
  };

  const handlePointerDown = (event: PointerEvent) => {
    const cellInfo = getCellFromEvent(event);
    if (!cellInfo) return;
    const { idx } = cellInfo;
    const i = idx - 1;

    const sid = data.spells ? data.spells[idx.toString()] : null;
    const spell = sid ? spellDb[sid] : null;
    const isLocked = i >= data.deck_capacity;
    if (isLocked) return;

    if (event.ctrlKey && event.button === 1 && sid) {
      event.preventDefault();
      openWiki(sid);
      return;
    }

    if (event.button === 1 && spell) {
      event.preventDefault();
      updateWand(slot, (curr) => {
        const marked = Array.isArray(curr.marked_slots) ? curr.marked_slots : [];
        const newMarked = marked.includes(idx)
          ? marked.filter(m => m !== idx)
          : [...marked, idx];
        return { marked_slots: newMarked };
      });
      return;
    }

    if (event.button === 0 || event.button === 2) {
      event.preventDefault();
      handleSlotMouseDown(slot, idx, event.button === 2);
    }
  };

  const handlePointerUp = (event: PointerEvent) => {
    const cellInfo = getCellFromEvent(event);
    if (!cellInfo) return;
    const { idx } = cellInfo;
    const i = idx - 1;
    const isLocked = i >= data.deck_capacity;
    if (isLocked) return;

    handleSlotMouseUp(slot, idx);

    if (event.button !== 0) return;

    const sid = data.spells ? data.spells[idx.toString()] : null;
    const spell = sid ? spellDb[sid] : null;
    const uses = (data.spell_uses || {})[idx.toString()] ?? spell?.max_uses;

    const layout = layoutRef.current;
    if (layout) {
      const localX = cellInfo.localX - cellInfo.col * layout.cellOuter - layout.gap / 2;
      const localY = cellInfo.localY - cellInfo.row * layout.cellOuter - layout.gap / 2;
      const cell = cellPoolRef.current[i];
      if (cell?.deleteHitRect && localX >= cell.deleteHitRect.x && localX <= cell.deleteHitRect.x + cell.deleteHitRect.width &&
        localY >= cell.deleteHitRect.y && localY <= cell.deleteHitRect.y + cell.deleteHitRect.height && sid) {
        event.preventDefault();
        updateWand(slot, (curr) => {
          const newSpells = { ...curr.spells };
          const newSpellUses = { ...(curr.spell_uses || {}) };
          delete newSpells[idx.toString()];
          delete newSpellUses[idx.toString()];
          return { spells: newSpells, spell_uses: newSpellUses };
        });
        return;
      }
      if (cell?.usesHitRect && localX >= cell.usesHitRect.x && localX <= cell.usesHitRect.x + cell.usesHitRect.width &&
        localY >= cell.usesHitRect.y && localY <= cell.usesHitRect.y + cell.usesHitRect.height && spell && uses !== undefined) {
        const newUses = uses === 0 ? (spell.max_uses ?? 10) : 0;
        updateWand(slot, (curr) => ({
          spell_uses: { ...(curr.spell_uses || {}), [idx.toString()]: newUses }
        }));
        return;
      }
    }

    if (event.ctrlKey && settings.ctrlClickDelete && !event.altKey) {
      if (event.shiftKey) {
        event.preventDefault();
        const slotIdx = idx;
        const newSpells: Record<string, string> = {};
        const newSpellUses: Record<string, number> = {};
        let nextIdx = 1;
        for (let j = 1; j <= data.deck_capacity; j++) {
          if (j === slotIdx) continue;
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
        event.preventDefault();
        updateWand(slot, (curr) => {
          const newSpells = { ...curr.spells };
          const newSpellUses = { ...(curr.spell_uses || {}) };
          delete newSpells[idx.toString()];
          delete newSpellUses[idx.toString()];
          return { spells: newSpells, spell_uses: newSpellUses };
        }, t('app.notification.delete_spell'));
        return;
      }
    }

    if (event.altKey && spell && sid) {
      event.preventDefault();
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
        spell_uses: { ...(curr.spell_uses || {}), [idx.toString()]: newUses }
      }), actionName);
      return;
    }

    if (selection && selection.indices.length > 1) {
      setSelection(null);
      return;
    }

    openPickerAt(idx, cellInfo.col, cellInfo.row);
  };

  const handlePointerMove = (event: PointerEvent) => {
    const cellInfo = getCellFromEvent(event);
    if (!cellInfo) {
      handleSlotMouseLeave();
      if (appRef.current) {
        const view = (appRef.current.view ?? (appRef.current as any).canvas) as HTMLCanvasElement;
        view.title = '';
        view.style.cursor = 'default';
      }
      return;
    }

    const idx = cellInfo.idx;
    const i = idx - 1;
    const isLocked = i >= data.deck_capacity;
    const view = appRef.current ? ((appRef.current.view ?? (appRef.current as any).canvas) as HTMLCanvasElement) : null;
    if (isLocked) {
      handleSlotMouseLeave();
      if (view) view.style.cursor = 'default';
      return;
    }

    if (!isLocked) {
      handleSlotMouseEnter(slot, idx);
      const layout = layoutRef.current;
      if (layout) {
        const cellLeft = cellInfo.col * layout.cellOuter;
        const isRightHalf = (cellInfo.localX - cellLeft) > layout.cellOuter / 2;
        useUIStore.getState().setHoveredSlot({ wandSlot: slot, idx, isRightHalf });
      }
      if (view) {
        view.style.cursor = settings.editorDragMode === 'hand' ? 'grab' : 'pointer';
      }
    }

    const sid = data.spells ? data.spells[idx.toString()] : null;
    if (appRef.current) {
      if (sid && !spellDb[sid]) {
        const info = getUnknownSpellInfo(sid);
        const tooltip = info?.mod_id
          ? t('editor.unknown_spell_tip_with_mod', { id: sid, mod: info.mod_id })
          : t('editor.unknown_spell_tip', { id: sid });
        const canvas = (appRef.current.view ?? (appRef.current as any).canvas) as HTMLCanvasElement;
        canvas.title = tooltip;
      } else if (slotMatchMap[idx] && slotMatchMap[idx].label) {
        const canvas = (appRef.current.view ?? (appRef.current as any).canvas) as HTMLCanvasElement;
        canvas.title = slotMatchMap[idx].label;
      } else {
        const canvas = (appRef.current.view ?? (appRef.current as any).canvas) as HTMLCanvasElement;
        canvas.title = '';
      }
    }
  };

  const handlePointerLeave = () => {
    handleSlotMouseLeave();
    if (appRef.current) {
      const canvas = (appRef.current.view ?? (appRef.current as any).canvas) as HTMLCanvasElement;
      canvas.title = '';
    }
  };

  const handleContextMenu = (event: MouseEvent) => {
    const cellInfo = getCellFromEvent(event);
    if (!cellInfo) return;
    const sid = data.spells ? data.spells[cellInfo.idx.toString()] : null;
    if (sid) {
      event.preventDefault();
    }
  };

  useEffect(() => {
    const canvas = appRef.current ? ((appRef.current.view ?? (appRef.current as any).canvas) as HTMLCanvasElement) : undefined;
    if (!canvas) return;

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerleave', handlePointerLeave);
    canvas.addEventListener('contextmenu', handleContextMenu);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  });

  React.useImperativeHandle(ref, () => ({
    getCellRect: (idx: number) => {
      const layout = layoutRef.current;
      const container = scrollRef.current;
      if (!layout || !container) return null;
      const rect = container.getBoundingClientRect();
      const col = (idx - 1) % layout.cols;
      const row = Math.floor((idx - 1) / layout.cols);
      const left = rect.left + layout.paddingLeft + col * layout.cellOuter + layout.gap / 2;
      const top = rect.top + layout.paddingTop + row * layout.cellOuter - scrollTopRef.current + layout.gap / 2;
      return new DOMRect(left, top, layout.cellInner, layout.cellInner);
    },
    getLayout: () => layoutRef.current,
    getCanvas: () => (appRef.current?.view as HTMLCanvasElement) || null,
    exportImageBlob: async ({ pure }) => {
      const app = appRef.current;
      const layout = layoutRef.current;
      if (!app || !layout) return null;

      const style = scrollRef.current ? getComputedStyle(scrollRef.current) : null;
      const paddingLeft = style ? parseFloat(style.paddingLeft) || 0 : 0;
      const paddingTop = style ? parseFloat(style.paddingTop) || 0 : 0;

      const maxIdx = Math.max(data.deck_capacity, ...Object.keys(data.spells || {}).map(Number), 24);
      const exportGap = settings.editorSpellGap || 0;
      const exportCellOuter = BASE_CELL_SIZE + exportGap;

      let exportOrderMap: Map<number, number> | undefined;
      let exportSlots = maxIdx;
      let exportCols = layout.cols;
      if (pure) {
        const nonEmpty: number[] = [];
        for (let i = 1; i <= maxIdx; i++) {
          if (data.spells[i.toString()]) nonEmpty.push(i);
        }
        exportSlots = Math.max(1, nonEmpty.length);
        exportCols = Math.min(layout.cols, exportSlots);
        exportOrderMap = new Map<number, number>();
        nonEmpty.forEach((idx, displayIndex) => exportOrderMap!.set(idx - 1, displayIndex));
      }

      const exportLayout = computeLayout({
        contentWidth: exportCols * exportCellOuter,
        totalSlots: exportSlots,
        gap: exportGap,
        paddingLeft,
        paddingTop,
        cellOuterOverride: exportCellOuter,
        colsOverride: exportCols
      });

      applyLayout(exportLayout, exportOrderMap);
      updateCells({ exportMode: pure ? 'pure' : 'normal' });

      const renderTexture = RenderTexture.create({ width: exportLayout.width, height: exportLayout.height, resolution: app.renderer.resolution });
      const prevGridY = gridContainerRef.current ? gridContainerRef.current.y : 0;
      if (gridContainerRef.current) gridContainerRef.current.y = 0;
      app.renderer.render(app.stage, { renderTexture });
      const canvas = app.renderer.extract.canvas(renderTexture);
      renderTexture.destroy(true);
      if (gridContainerRef.current) gridContainerRef.current.y = prevGridY;

      applyLayout(layout);
      updateCells({ exportMode: 'normal' });

      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      });
    }
  }), [
    data.deck_capacity,
    data.spells,
    gap,
    layoutRef,
    settings.editorSpellGap
  ]);

  return (
    <div ref={scrollRef} className="max-h-[600px] overflow-y-auto custom-scrollbar p-1 select-none spell-grid-pixi">
      <div ref={spacerRef} className="relative">
        <div
          ref={canvasHostRef}
          className="sticky top-0 left-0"
          style={{
            width: `${viewportSize.width || 1}px`,
            height: `${viewportSize.height || 1}px`
          }}
        >
          <div className="absolute inset-0 pointer-events-none" />
        </div>
      </div>
    </div>
  );
});

SpellGridPixi.displayName = 'SpellGridPixi';
