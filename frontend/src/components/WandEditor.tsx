import React from 'react';
import { X, RefreshCw, Image as ImageIcon, Camera } from 'lucide-react';
import { toPng } from 'html-to-image';
import { WandData, SpellInfo, AppSettings } from '../types';
import { PropInput } from './Common';
import { getIconUrl, getWandSpriteUrl, spritePathToWikiName } from '../lib/evaluatorAdapter';
import { getUnknownSpellInfo } from '../hooks/useSpellDb';
import { useTranslation } from 'react-i18next';
import { detectPatterns, getMergedRules, type PatternMatch } from '../lib/spellPatterns';
import { SpellCell } from './SpellCell';
import { SpellGridCanvas } from './SpellGridCanvas';

interface WandEditorProps {
  slot: string;
  data: WandData;
  spellDb: Record<string, SpellInfo>;
  selection: { wandSlot: string; indices: number[]; startIdx: number } | null;
  hoveredSlot: { wandSlot: string; idx: number; isRightHalf: boolean } | null;
  dragSource: { wandSlot: string; idx: number; sid: string } | null;
  updateWand: (slot: string, partial: Partial<WandData> | ((curr: WandData) => Partial<WandData>), actionName?: string, icons?: string[]) => void;
  handleSlotMouseDown: (slot: string, idx: number, isRightClick?: boolean, pointer?: { x: number; y: number }) => void;
  handleSlotMouseUp: (slot: string, idx: number) => void;
  handleSlotMouseEnter: (slot: string, idx: number) => void;
  handleSlotMouseMove: (e: React.MouseEvent, slot: string, idx: number) => void;
  handleSlotMouseLeave: () => void;
  openPicker: (slot: string, idx: string, e: React.MouseEvent | { x: number, y: number, initialSearch?: string, rowTop?: number, insertAnchor?: { wandSlot: string; idx: number; isRightHalf: boolean } | null }) => void;
  setSelection: (s: any) => void;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  requestEvaluation: (wand: WandData, force?: boolean) => void;
  onMoveSelection?: (direction: 'next' | 'prev' | 'up' | 'down' | 'right' | 'left') => void;
  settings: AppSettings;
  isConnected: boolean;
  /** 隐藏法杖属性面板、导出按钮等 (用于智能标签编辑) */
  hideAttributes?: boolean;
  /** 隐藏始终施放区域 (用于智能标签编辑) */
  hideAlwaysCast?: boolean;
  /** 画布模式下不限制高度 */
  isCanvasMode?: boolean;
  hideSpells?: boolean;
}

export function WandEditor({
  slot,
  data,
  spellDb,
  selection,
  hoveredSlot,
  dragSource,
  updateWand,
  handleSlotMouseDown,
  handleSlotMouseUp,
  handleSlotMouseEnter,
  handleSlotMouseMove,
  handleSlotMouseLeave,
  openPicker,
  setSelection,
  setSettings,
  requestEvaluation,
  onMoveSelection,
  settings,
  isConnected,
  hideAttributes,
  hideAlwaysCast,
  isCanvasMode,
  hideSpells
}: WandEditorProps) {
  const { t, i18n } = useTranslation();
  const [isAltPressed, setIsAltPressed] = React.useState(false);
  const wandRef = React.useRef<HTMLDivElement>(null);
  const spellsRef = React.useRef<HTMLDivElement>(null);

  const openWiki = (sid: string) => {
    const spell = spellDb[sid];
    if (!spell) return;
    const lang = settings.wikiLanguage || 'en';
    const baseUrl = lang === 'zh' ? 'https://noita.wiki.gg/zh/wiki/' : 'https://noita.wiki.gg/wiki/';
    window.open(`${baseUrl}${sid.toUpperCase()}`, '_blank');
  };

  const absoluteToOrdinal = React.useMemo(() => {
    const map: Record<number, number> = {};
    let ordinal = 1;
    for (let i = 1; i <= data.deck_capacity; i++) {
      if (data.spells && data.spells[i.toString()]) {
        map[i] = ordinal++;
      }
    }
    return map;
  }, [data.spells, data.deck_capacity]);

  // 法术模式检测 (一分链等)
  const patternMatches = React.useMemo(() => {
    if (!data.spells) return [] as PatternMatch[];
    const rules = getMergedRules(settings.userMarkingRules).filter(r => r.enabled);
    return detectPatterns(data.spells, data.deck_capacity, rules);
  }, [data.spells, data.deck_capacity, settings.userMarkingRules]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltPressed(false);
    };
    const handleBlur = () => setIsAltPressed(false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur); // Reset on loss of focus
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const getPickerAnchor = React.useCallback((currentIdx: number) => {
    const el = spellsRef.current?.querySelector(`[data-slot-idx="${currentIdx}"]`) as HTMLElement | null;
    const rect = el?.getBoundingClientRect();
    if (rect) {
      return {
        clientX: 0,
        clientY: 0,
        x: rect.left,
        y: rect.bottom + 8,
        rowTop: rect.top,
        insertAnchor: { wandSlot: slot, idx: currentIdx, isRightHalf: false }
      };
    }

    const canvasEl = spellsRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
    if (canvasEl) {
      const rect = canvasEl.getBoundingClientRect();
      const logicalW = parseFloat(canvasEl.style.width) || rect.width;
      const gap = settings.editorSpellGap || 0;
      const baseCell = 48;
      const cellOuter = baseCell + gap;
      const totalSlots = Math.max(data.deck_capacity, 24);
      const cols = isCanvasMode
        ? Math.min(totalSlots, data.canvas_cells_per_row ?? settings.defaultCanvasCellsPerRow ?? 26)
        : Math.max(1, Math.floor((logicalW || 800) / cellOuter) || 1);
      const cellIdx = currentIdx - 1;
      const col = cellIdx % cols;
      const row = Math.floor(cellIdx / cols);
      const x = rect.left + col * cellOuter + gap / 2;
      const y = rect.top + row * cellOuter + gap / 2 + 20 + baseCell;
      const rowTop = rect.top + row * cellOuter + gap / 2 + 20;
      return { clientX: 0, clientY: 0, x, y, rowTop, insertAnchor: { wandSlot: slot, idx: currentIdx, isRightHalf: false } };
    }

    return { clientX: 0, clientY: 0, x: window.innerWidth / 2, y: window.innerHeight / 2 + 8, insertAnchor: { wandSlot: slot, idx: currentIdx, isRightHalf: false } };
  }, [slot, settings.editorDragMode, settings.editorSpellGap, settings.defaultCanvasCellsPerRow, data.deck_capacity, data.canvas_cells_per_row, isCanvasMode]);

  // 处理格子的键盘导航和输入触发
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 如果正在输入框里（比如搜索框），不触发格子导航
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isSelected = selection?.wandSlot === slot;
      if (!isSelected || selection.indices.length !== 1) return;

      const currentIdx = selection.indices[0];
      const maxCap = data.deck_capacity;

      // 1. 方向键和 Tab 导航
      if (e.key === 'Tab') {
        e.preventDefault();
        onMoveSelection?.(e.shiftKey ? 'prev' : 'next');
        return;
      }

      if (e.key === 'ArrowRight') {
        onMoveSelection?.('right');
        return;
      }
      if (e.key === 'ArrowLeft') {
        onMoveSelection?.('left');
        return;
      }
      if (e.key === 'ArrowDown') {
        onMoveSelection?.('down');
        return;
      }
      if (e.key === 'ArrowUp') {
        onMoveSelection?.('up');
        return;
      }

      // 2. 字母/数字触发搜索 (IME 风格)
      // 排除掉控制键
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && e.key !== ' ') {
        // 如果是数字且当前格子有法术，可能是想直接用数字选词，但在格子界面我们倾向于开启搜索
        e.preventDefault();
        openPicker(slot, currentIdx.toString(), {
          ...getPickerAnchor(currentIdx),
          initialSearch: e.key
        } as any);
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPicker(slot, currentIdx.toString(), {
          ...getPickerAnchor(currentIdx),
          insertAnchor: { wandSlot: slot, idx: currentIdx, isRightHalf: false },
          initialSearch: ''
        } as any);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        updateWand(slot, (curr) => {
          const sid = curr.spells[currentIdx.toString()];
          if (!sid) return {};
          const newSpells = { ...curr.spells };
          const newSpellUses = { ...(curr.spell_uses || {}) };
          delete newSpells[currentIdx.toString()];
          delete newSpellUses[currentIdx.toString()];
          return { spells: newSpells, spell_uses: newSpellUses };
        }, t('app.notification.delete_spell'));
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selection, slot, data.deck_capacity, data.canvas_cells_per_row, isCanvasMode, settings.editorSpellGap, settings.defaultCanvasCellsPerRow, onMoveSelection, openPicker, updateWand, t, getPickerAnchor]);

  const renderTimeInput = (label: string, frames: number, updateKey: keyof WandData) => {
    const primaryValue = settings.showStatsInFrames ? frames : parseFloat((frames / 60).toFixed(3));
    const secondaryValue = settings.showStatsInFrames ? (frames / 60).toFixed(2) + 's' : frames + 'f';
    const colorClass = frames <= 0 ? 'text-emerald-400' : 'text-amber-300';

    return (
      <PropInput
        label={label}
        value={primaryValue}
        secondaryValue={secondaryValue}
        colorClass={colorClass}
        onChange={v => updateWand(slot, { [updateKey]: settings.showStatsInFrames ? Math.round(v) : Math.round(v * 60) })}
      />
    );
  };

  const getWand2Text = () => {
    const sequence = Array.from({ length: data.deck_capacity }).map((_, i) => data.spells[(i + 1).toString()] || "");
    const wikiPic = spritePathToWikiName(data.appearance);

    // 构建参数列表，兼容 CE 风格：只输出有意义的字段
    let lines = ['{{Wand2'];
    lines.push('| wandCard     = Yes');
    if (wikiPic) lines.push(`| wandPic      = ${wikiPic}`);
    if (data.shuffle_deck_when_empty) lines.push('| shuffle      = Yes');
    if (data.actions_per_round !== 1) lines.push(`| spellsCast   = ${data.actions_per_round}`);
    lines.push(`| castDelay    = ${(data.fire_rate_wait / 60).toFixed(2)}`);
    lines.push(`| rechargeTime = ${(data.reload_time / 60).toFixed(2)}`);
    lines.push(`| manaMax      = ${data.mana_max.toFixed(2)}`);
    lines.push(`| manaCharge   = ${data.mana_charge_speed.toFixed(2)}`);
    lines.push(`| capacity     = ${data.deck_capacity}`);
    lines.push(`| spread       = ${data.spread_degrees}`);
    lines.push(`| speed        = ${data.speed_multiplier.toFixed(2)}`);
    if (data.always_cast && data.always_cast.length > 0) {
      lines.push(`| alwaysCasts  = ${data.always_cast.join(',')}`);
    }
    lines.push(`| spells       = ${sequence.join(',')}`);
    lines.push('}}');
    return lines.join('\n');
  };

  const embedMetadata = async (blob: Blob, text: string): Promise<Blob> => {
    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);

    // Check PNG signature
    if (view.getUint32(0) !== 0x89504E47 || view.getUint32(4) !== 0x0D0A1A0A) {
      return blob;
    }

    const chunks: { type: string; data: Uint8Array }[] = [];
    let pos = 8;
    while (pos < buffer.byteLength) {
      const length = view.getUint32(pos);
      const type = String.fromCharCode(...new Uint8Array(buffer.slice(pos + 4, pos + 8)));
      const data = new Uint8Array(buffer.slice(pos + 8, pos + 8 + length));
      chunks.push({ type, data });
      pos += 12 + length;
    }

    // Insert tEXt chunk before IDAT or at the end
    const keyword = "Wand2Data";
    const encoder = new TextEncoder();
    const textData = encoder.encode(keyword + "\0" + text);
    const newChunk = { type: 'tEXt', data: textData };

    // Find first IDAT
    const idatIdx = chunks.findIndex(c => c.type === 'IDAT');
    if (idatIdx !== -1) {
      chunks.splice(idatIdx, 0, newChunk);
    } else {
      chunks.splice(chunks.length - 1, 0, newChunk);
    }

    // Rebuild PNG
    let totalSize = 8;
    chunks.forEach(c => totalSize += 12 + c.data.length);
    const newBuffer = new ArrayBuffer(totalSize);
    const newView = new DataView(newBuffer);

    // Signature
    newView.setUint32(0, 0x89504E47);
    newView.setUint32(4, 0x0D0A1A0A);

    let currentPos = 8;
    const crcTable = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crcTable[i] = c;
    }

    const calculateCrc = (type: string, data: Uint8Array) => {
      let crc = -1;
      const typeBytes = encoder.encode(type);
      for (let i = 0; i < 4; i++) {
        crc = crcTable[(crc ^ typeBytes[i]) & 0xFF] ^ (crc >>> 8);
      }
      for (let i = 0; i < data.length; i++) {
        crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
      }
      return crc ^ -1;
    };

    chunks.forEach(c => {
      newView.setUint32(currentPos, c.data.length);
      const typeBytes = encoder.encode(c.type);
      new Uint8Array(newBuffer, currentPos + 4, 4).set(typeBytes);
      new Uint8Array(newBuffer, currentPos + 8, c.data.length).set(c.data);
      const crc = calculateCrc(c.type, c.data);
      newView.setUint32(currentPos + 8 + c.data.length, crc);
      currentPos += 12 + c.data.length;
    });

    return new Blob([newBuffer], { type: 'image/png' });
  };

  const handleExportImage = async (mode: 'only_spells' | 'full') => {
    const ref = mode === 'only_spells' ? spellsRef : wandRef;
    if (!ref.current) return;

    const isPure = mode === 'only_spells' && settings.pureSpellsExport;
    const container = ref.current;

    // 保存原始容器样式，用于导出后恢复
    const originalContainerStyles = {
      width: container.style.width,
      display: container.style.display,
      maxWidth: container.style.maxWidth,
      minWidth: container.style.minWidth,
      backgroundColor: container.style.backgroundColor,
      boxShadow: container.style.boxShadow
    };

    // 查找所有的 grid、flex 容器及其直接父级
    const grids = Array.from(container.querySelectorAll('.grid')) as HTMLElement[];
    const flexWrappers = Array.from(container.querySelectorAll('.flex-wrap')) as HTMLElement[];
    const scrollables = container.querySelectorAll('.overflow-y-auto, .custom-scrollbar');

    const originalGridStyles = grids.map(g => ({
      el: g,
      gridTemplateColumns: g.style.gridTemplateColumns,
      computedCols: getComputedStyle(g).gridTemplateColumns.split(' ').filter(s => s !== '').length,
      width: g.style.width,
      parentWidth: (g.parentElement as HTMLElement)?.style.width
    }));

    const originalFlexStyles = flexWrappers.map(f => ({
      el: f,
      width: f.style.width
    }));

    const originalScrollStyles = Array.from(scrollables).map(s => ({
      el: s as HTMLElement,
      width: (s as HTMLElement).style.width
    }));

    // 设置容器为紧凑布局并去除背景（如果是 Pure 模式）
    container.style.width = 'fit-content';
    container.style.display = 'inline-block';
    container.style.maxWidth = 'none';
    container.style.minWidth = '0';
    if (isPure) {
      container.style.backgroundColor = 'transparent';
      container.style.boxShadow = 'none';
    }

    // 目标元素的临时样式更改
    const attributesContainer = container.querySelector('.attributes-container');

    // 仅法术模式：隐藏前面的空格子和背景
    const allSlots = Array.from(container.querySelectorAll('.group\\/cell, .group\\/ac'));
    let firstNonEmptyIdx = -1;

    if (isPure) {
      for (let i = 0; i < allSlots.length; i++) {
        if (allSlots[i].querySelector('img')) {
          firstNonEmptyIdx = i;
          break;
        }
      }
    }

    const originalStyles = Array.from(scrollables).map(el => {
      const hEl = el as HTMLElement;
      const original = {
        el: hEl,
        maxHeight: hEl.style.maxHeight,
        overflow: hEl.style.overflow,
        height: hEl.style.height
      };
      hEl.style.maxHeight = 'none';
      hEl.style.overflow = 'visible';
      hEl.style.height = 'auto';
      hEl.style.width = 'fit-content'; // 强制滚动容器收缩
      return original;
    });

    // Save and apply styles for pure mode
    const slotModifications: { el: HTMLElement, display: string, bg: string, border: string, shadow: string }[] = [];
    if (isPure) {
      allSlots.forEach((slot, i) => {
        const el = slot as HTMLElement;
        const inner = el.querySelector('div') as HTMLElement;
        if (!inner) return;

        // 获取该格子在 Grid 中的实际容器
        const isAC = el.classList.contains('group/ac');
        const gridItem = isAC ? el : el.parentElement;

        const mod = {
          el: gridItem as HTMLElement,
          display: (gridItem as HTMLElement).style.display,
          bg: inner.style.backgroundColor,
          border: inner.style.borderColor,
          shadow: inner.style.boxShadow
        };

        // 隐藏不需要的格子
        if (i < firstNonEmptyIdx || !el.querySelector('img')) {
          if (gridItem) (gridItem as HTMLElement).style.display = 'none';
        } else {
          // 使背景和边框透明
          inner.style.backgroundColor = 'transparent';
          inner.style.borderColor = 'transparent';
          inner.style.boxShadow = 'none';

          if (el.classList.contains('group/ac')) {
            const wrapper = el.querySelector('div') as HTMLElement;
            if (wrapper) {
              wrapper.style.backgroundColor = 'transparent';
              wrapper.style.borderColor = 'transparent';
              wrapper.style.boxShadow = 'none';
            }
          }
        }
        slotModifications.push(mod);
      });

      // Hide the "Always Cast Slots" header if it's there
      const acHeader = ref.current.querySelector('.text-amber-500')?.parentElement?.parentElement as HTMLElement;
      if (acHeader) {
        acHeader.style.display = 'none';
      }
    }

    // 在隐藏完格子后，调整栅格列数以消除右侧空白
    const gap = settings.editorSpellGap || 0;
    const cellWidth = 56 + gap;
    grids.forEach((g, idx) => {
      const original = originalGridStyles[idx];
      // 只统计当前可见（未被隐藏）的格子
      const visibleChildren = Array.from(g.children).filter(c => {
        return (c as HTMLElement).style.display !== 'none' && !c.classList.contains('export-ignore');
      });

      if (visibleChildren.length > 0) {
        // 如果可见格子数少于当前列数，则缩小列数；否则保持当前列数以维持换行
        const actualCols = Math.min(visibleChildren.length, original.computedCols || 1);
        g.style.gridTemplateColumns = `repeat(${actualCols}, ${cellWidth}px)`;
        g.style.width = 'fit-content';
        if (g.parentElement) g.parentElement.style.width = 'fit-content';
      }
    });

    flexWrappers.forEach(f => {
      f.style.width = 'fit-content';
    });

    // 强制同步渲染并获取精确尺寸
    const rect = container.getBoundingClientRect();
    const finalWidth = Math.ceil(rect.width);
    const finalHeight = Math.ceil(rect.height);

    // Ensure attributes container is visible and stable
    let originalAttrStyle = '';
    if (attributesContainer) {
      const hEl = attributesContainer as HTMLElement;
      originalAttrStyle = hEl.style.display;
      hEl.style.display = 'flex';
    }

    try {
      const dataUrl = await toPng(container, {
        pixelRatio: 3,
        width: finalWidth,
        height: finalHeight,
        backgroundColor: isPure ? 'transparent' : '#0c0c0e',
        cacheBust: true,
        style: {
          borderRadius: '0',
          margin: '0',
          width: `${finalWidth}px`,
          height: `${finalHeight}px`,
        },
        filter: (node: Node) => {
          if (node instanceof HTMLElement) {
            if (node.classList.contains('export-ignore')) return false;
            // Hide delete buttons, + placeholders, and slot indices in pure mode
            if (isPure) {
              if (node.classList.contains('lucide-x') ||
                node.innerText === '+' ||
                (node.classList.contains('absolute') && !node.querySelector('img'))) {
                return false;
              }
            }
          }
          return true;
        }
      });

      let blob = await (await fetch(dataUrl)).blob();

      if (settings.embedMetadataInImage) {
        blob = await embedMetadata(blob, getWand2Text());
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `wand_${new Date().getTime()}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export image:', err);
    } finally {
      // 恢复原始样式
      originalStyles.forEach(s => {
        s.el.style.maxHeight = s.maxHeight;
        s.el.style.overflow = s.overflow;
        s.el.style.height = s.height;
        s.el.style.width = '';
      });

      if (container) {
        container.style.width = originalContainerStyles.width;
        container.style.display = originalContainerStyles.display;
        container.style.maxWidth = originalContainerStyles.maxWidth;
        container.style.minWidth = originalContainerStyles.minWidth;
        container.style.backgroundColor = originalContainerStyles.backgroundColor;
        container.style.boxShadow = originalContainerStyles.boxShadow;
      }

      originalGridStyles.forEach(s => {
        s.el.style.gridTemplateColumns = s.gridTemplateColumns;
        s.el.style.width = s.width;
        if (s.el.parentElement) s.el.parentElement.style.width = s.parentWidth || '';
      });

      originalFlexStyles.forEach(s => {
        s.el.style.width = s.width;
      });

      originalScrollStyles.forEach(s => {
        s.el.style.width = s.width;
      });

      if (attributesContainer) {
        (attributesContainer as HTMLElement).style.display = originalAttrStyle;
      }

      // 恢复 Pure 模式修改
      slotModifications.forEach(m => {
        m.el.style.display = m.display;
        const inner = m.el.classList.contains('group/ac') ? m.el.querySelector('div') : m.el.querySelector('.group\\/cell');
        if (inner instanceof HTMLElement) {
          inner.style.backgroundColor = m.bg;
          inner.style.borderColor = m.border;
          inner.style.boxShadow = m.shadow;
        }
      });
      const acHeader = ref.current.querySelector('.text-amber-500')?.parentElement?.parentElement as HTMLElement;
      if (acHeader) acHeader.style.display = '';
    }
  };

  return (
    <div ref={wandRef} className={`px-4 bg-transparent select-none ${hideAttributes ? 'py-2 space-y-3' : 'py-6 border-t border-white/5 space-y-8'}`}>
      {!hideAttributes && <div className="flex items-start gap-8 attributes-container">
        <div
          className={`flex flex-wrap items-center glass rounded-xl p-1 pr-6 shadow-2xl wand-attributes-box ${settings.compactAttributes ? 'min-w-0' : 'min-w-[600px]'}`}
          style={settings.wandAttributesScale && settings.wandAttributesScale !== 100 ? {
            zoom: `${settings.wandAttributesScale}%`
          } as React.CSSProperties : undefined}
          onMouseUp={() => handleSlotMouseUp(slot, -1000)}
        >
          {/* Wand Appearance Section */}
          <div className="px-6 py-2 border-r border-white/5 flex flex-col items-center justify-center gap-2 h-16 min-w-[80px]">
            {(() => {
              const wandSpriteUrl = getWandSpriteUrl(data.appearance, isConnected);
              return wandSpriteUrl ? (
                <div className="relative group/wand-sprite">
                  <img
                    src={wandSpriteUrl}
                    className="w-12 h-10 object-contain image-pixelated cursor-pointer hover:scale-110 transition-transform"
                    alt="Wand Sprite"
                    onClick={() => {
                      const currentPath = data.appearance?.item_sprite || data.appearance?.sprite || '';
                      const newSprite = prompt(t('editor.enter_sprite_path') || 'Enter sprite path:', currentPath);
                      if (newSprite !== null) updateWand(slot, { appearance: { ...data.appearance, sprite: newSprite } });
                    }}
                  />
                </div>
              ) : (
                <button
                  onClick={() => {
                    const newSprite = prompt(t('editor.enter_sprite_path') || 'Enter sprite path:');
                    if (newSprite) updateWand(slot, { appearance: { sprite: newSprite } });
                  }}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <ImageIcon size={20} />
                </button>
              );
            })()}
          </div>

          {/* Group 1: Shuffle */}
          <div className="px-6 py-2 border-r border-white/5 flex items-center h-16">
            <button
              onClick={() => updateWand(slot, (curr) => ({ shuffle_deck_when_empty: !curr.shuffle_deck_when_empty }))}
              className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-all ${data.shuffle_deck_when_empty ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${data.shuffle_deck_when_empty ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest">{data.shuffle_deck_when_empty ? t('editor.shuffle') : t('editor.no_shuffle')}</span>
            </button>
          </div>

          {/* Group 2: Mana */}
          <div className="px-8 py-2 border-r border-white/5 flex gap-10">
            <PropInput label={t('editor.mana_max')} value={data.mana_max} colorClass="text-cyan-400" onChange={v => updateWand(slot, { mana_max: v })} />
            <PropInput label={t('editor.recharge')} value={data.mana_charge_speed} colorClass="text-cyan-400" onChange={v => updateWand(slot, { mana_charge_speed: v })} />
          </div>

          {/* Group 3: Timing */}
          <div className="px-8 py-2 border-r border-white/5 flex gap-10">
            {renderTimeInput(t('editor.cast_delay'), data.fire_rate_wait, "fire_rate_wait")}
            {renderTimeInput(t('editor.recharge_time'), data.reload_time, "reload_time")}
          </div>

          {/* Group 4: Specs */}
          <div className="px-8 py-2 flex gap-10">
            <PropInput label={t('editor.capacity')} value={data.deck_capacity} onChange={v => updateWand(slot, { deck_capacity: v })} />
            <PropInput label={t('editor.spread')} value={data.spread_degrees} colorClass={data.spread_degrees <= 0 ? 'text-emerald-400' : 'text-red-400'} onChange={v => updateWand(slot, { spread_degrees: v })} />
            <PropInput label={t('editor.spells_per_cast')} value={data.actions_per_round} colorClass={data.actions_per_round > 1 ? 'text-purple-400' : ''} onChange={v => updateWand(slot, { actions_per_round: Math.max(1, Math.round(v)) })} />
            <PropInput label={t('editor.speed')} value={data.speed_multiplier} colorClass="text-indigo-400" onChange={v => updateWand(slot, { speed_multiplier: v })} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 shrink-0 h-fit export-ignore">
          <div className="flex items-center bg-white/[0.02] border border-white/5 rounded-lg overflow-hidden">
            <button
              onClick={() => handleExportImage('only_spells')}
              className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-zinc-400 border-r border-white/5 text-[10px] font-black uppercase tracking-widest transition-all"
              title={t('settings.export_only_spells')}
            >
              <ImageIcon size={14} className="opacity-70" />
              <span className="hidden sm:inline">{t('settings.export_only_spells')}</span>
            </button>
            <button
              onClick={() => handleExportImage('full')}
              className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-zinc-400 text-[10px] font-black uppercase tracking-widest transition-all"
              title={t('settings.export_wand_and_spells')}
            >
              <Camera size={14} className="opacity-70" />
              <span className="hidden sm:inline">{t('settings.export_wand_and_spells')}</span>
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 px-2 py-1 bg-white/[0.02] border border-white/5 rounded-lg overflow-hidden focus-within:border-indigo-500/50 transition-colors" title={t('evaluator.evaluation_seed_desc')}>
              <button 
              onClick={() => {
                if (!data.evaluation_seed) {
                  // 本地生成随机种子，无需触发完整评估往返
                  const randomSeed = String(Math.floor(Math.random() * 2147483647));
                  updateWand(slot, { evaluation_seed: randomSeed });
                } else {
                  updateWand(slot, { evaluation_seed: '' });
                }
              }}
              className="text-zinc-500 hover:text-indigo-400 transition-colors"
              title={t('canvas.randomize_seed')}
            >
                 <span className="text-[12px]">🎲</span>
              </button>
              <div className="w-px h-3 bg-white/10 mx-0.5"></div>
              <span className="text-[9px] text-zinc-500 font-black uppercase shrink-0">Seed</span>
              <input
                type="text"
                value={data.evaluation_seed !== undefined ? data.evaluation_seed : (settings.evaluationSeed || '')}
                onChange={e => {
                  const val = e.target.value;
                  updateWand(slot, { evaluation_seed: val });
                }}
                className="bg-transparent border-none outline-none text-[10px] text-zinc-300 w-16 font-mono"
              />
              <button 
                onClick={() => requestEvaluation(data, true)}
                className="text-zinc-500 hover:text-emerald-400 transition-colors ml-1"
                title={t('evaluator.force_analyze_desc')}
              >
                 <RefreshCw size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>}

      {hideSpells ? null : <div ref={spellsRef} className={hideAttributes ? "space-y-3" : "space-y-8"}>
        {!hideAlwaysCast && Array.isArray(data.always_cast) && data.always_cast.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-amber-500/30 to-transparent" />
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em]">{t('editor.always_cast_slots')}</span>
              <div className="h-px flex-1 bg-gradient-to-l from-amber-500/30 to-transparent" />
            </div>
            <div className="flex flex-wrap gap-3">
              {data.always_cast.map((sid, i) => {
                const spell = spellDb[sid];
                const displayName = spell ? (i18n.language.startsWith('en') && spell.en_name ? spell.en_name : spell.name) : sid;
                const acIdx = -(i + 1);
                const isHovered = hoveredSlot?.wandSlot === slot && hoveredSlot?.idx === acIdx;

                return (
                  <div
                    key={i}
                    className="group/ac relative"
                    onMouseDown={(e) => {
                      if (e.ctrlKey && e.button === 1 && sid) {
                        e.preventDefault();
                        e.stopPropagation();
                        openWiki(sid);
                        return;
                      }
                      handleSlotMouseDown(slot, acIdx, e.button === 2, { x: e.clientX, y: e.clientY });
                    }}
                    onMouseUp={() => handleSlotMouseUp(slot, acIdx)}
                    onMouseMove={(e) => handleSlotMouseMove(e, slot, acIdx)}
                    onMouseLeave={handleSlotMouseLeave}
                    onClick={(e) => {
                      if (e.altKey) {
                        updateWand(slot, (curr) => {
                          const newAC = [...(curr.always_cast || [])];
                          newAC.splice(i, 1);
                          return { always_cast: newAC };
                        }, "删除始终施放法术");
                        return;
                      }
                      openPicker(slot, `ac-${i}`, {
                        x: e.clientX,
                        y: e.clientY,
                        insertAnchor: {
                          wandSlot: slot,
                          idx: acIdx,
                          isRightHalf: e.clientX > (e.currentTarget as HTMLElement).getBoundingClientRect().left + (e.currentTarget as HTMLElement).getBoundingClientRect().width / 2,
                        }
                      });
                    }}
                  >
                    <div className={`
                    w-12 h-12 rounded-lg border flex items-center justify-center relative shadow-[0_0_15px_rgba(245,158,11,0.1)] transition-transform hover:scale-105
                    ${selection?.wandSlot === slot && selection.indices.includes(acIdx)
                        ? 'border-indigo-500 bg-indigo-500/20 scale-105 z-10'
                        : isHovered && settings.dragSpellMode === 'noita_swap' && dragSource
                          ? 'border-amber-500 bg-amber-500/20 scale-105 z-10'
                          : isHovered
                            ? 'border-white/20 bg-white/5'
                            : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'}
                  `}>
                      {isHovered && settings.dragSpellMode !== 'noita_swap' && dragSource && (
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-indigo-400 z-50 animate-pulse rounded-full"
                          style={{ [hoveredSlot.isRightHalf ? 'right' : 'left']: `-6px` }}
                        />
                      )}
                      {spell ? (
                        <img
                          src={getIconUrl(spell.icon, isConnected)}
                          className="w-10 h-10 image-pixelated"
                          alt=""
                          title={`Always Cast: ${displayName}\nID: ${sid}\n(Alt+Click to remove)`}
                        />
                      ) : sid ? (
                        <div className="w-10 h-10 flex flex-col items-center justify-center overflow-hidden px-0.5" title={(() => {
                          const info = getUnknownSpellInfo(sid);
                          return info?.mod_id
                            ? t('editor.unknown_spell_tip_with_mod', { id: sid, mod: info.mod_id })
                            : t('editor.unknown_spell_tip', { id: sid });
                        })()}>
                          {(() => {
                            const info = getUnknownSpellInfo(sid);
                            return info?.mod_id
                              ? <span className="text-cyan-400/80 text-[8px] font-bold leading-none truncate max-w-full">@{info.mod_id}</span>
                              : <span className="text-orange-400 text-xs font-black leading-none">?</span>;
                          })()}
                          <span className="text-orange-400/70 text-[8px] font-mono leading-tight text-center break-all line-clamp-2 max-w-full">{sid}</span>
                        </div>
                      ) : (
                        <span className="text-amber-500/20 text-xs">?</span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newAC = [...data.always_cast];
                          newAC.splice(i, 1);
                          updateWand(slot, { always_cast: newAC });
                        }}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/ac:opacity-100 transition-opacity z-10 shadow-lg"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <SpellGridCanvas
          slot={slot}
          data={data}
          spellDb={spellDb}
          settings={settings}
          isConnected={isConnected}
          isAltPressed={isAltPressed}
          absoluteToOrdinal={absoluteToOrdinal}
          patternMatches={patternMatches}
          isCanvasMode={isCanvasMode}
          handleSlotMouseMove={handleSlotMouseMove}
          handleSlotMouseLeave={handleSlotMouseLeave}
          handleSlotMouseDown={handleSlotMouseDown}
          handleSlotMouseUp={handleSlotMouseUp}
          handleSlotMouseEnter={handleSlotMouseEnter}
          openPicker={openPicker}
          setSelection={setSelection}
          updateWand={updateWand}
          openWiki={openWiki}
          setSettings={setSettings}
          t={t}
        />
      </div>}
    </div>
  );
}
