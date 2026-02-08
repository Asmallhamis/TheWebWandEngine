import React from 'react';
import { X, RefreshCw, Image as ImageIcon, Camera } from 'lucide-react';
import { toPng } from 'html-to-image';
import { WandData, SpellInfo, AppSettings } from '../types';
import { PropInput } from './Common';
import { getIconUrl } from '../lib/evaluatorAdapter';
import { useTranslation } from 'react-i18next';

interface WandEditorProps {
  slot: string;
  data: WandData;
  spellDb: Record<string, SpellInfo>;
  selection: { wandSlot: string; indices: number[]; startIdx: number } | null;
  hoveredSlot: { wandSlot: string; idx: number; isRightHalf: boolean } | null;
  dragSource: { wandSlot: string; idx: number; sid: string } | null;
  updateWand: (slot: string, partial: Partial<WandData>, actionName?: string, icons?: string[]) => void;
  handleSlotMouseDown: (slot: string, idx: number, isRightClick?: boolean) => void;
  handleSlotMouseUp: (slot: string, idx: number) => void;
  handleSlotMouseEnter: (slot: string, idx: number) => void;
  handleSlotMouseMove: (e: React.MouseEvent, slot: string, idx: number) => void;
  handleSlotMouseLeave: () => void;
  openPicker: (slot: string, idx: string, e: React.MouseEvent | { x: number, y: number, initialSearch?: string }) => void;
  setSelection: (s: any) => void;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  requestEvaluation: (wand: WandData, force?: boolean) => void;
  onMoveSelection?: (direction: 'next' | 'prev' | 'up' | 'down' | 'right' | 'left') => void;
  settings: AppSettings;
  isConnected: boolean;
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
  isConnected
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

  // 计算当前一行能放多少个格子
  const getCols = () => {
    if (!spellsRef.current) return 10;
    const grid = spellsRef.current.querySelector('.grid');
    if (!grid) return 10;
    const style = getComputedStyle(grid);
    return style.gridTemplateColumns.split(' ').filter(s => s !== '').length || 10;
  };

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 如果正在输入框里，不处理导航
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // 必须有选中项且选中了当前法杖
      if (!selection || selection.wandSlot !== slot || selection.indices.length !== 1) return;

      const currentIdx = selection.indices[0];
      const maxCap = data.deck_capacity;
      const cols = getCols();

      // 1. 方向键和 Tab 导航
      if (e.key === 'Tab') {
        e.preventDefault();
        const next = e.shiftKey 
          ? (currentIdx <= 1 ? maxCap : currentIdx - 1)
          : (currentIdx >= maxCap ? 1 : currentIdx + 1);
        setSelection({ ...selection, indices: [next], startIdx: next });
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = currentIdx >= maxCap ? 1 : currentIdx + 1;
        setSelection({ ...selection, indices: [next], startIdx: next });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const next = currentIdx <= 1 ? maxCap : currentIdx - 1;
        setSelection({ ...selection, indices: [next], startIdx: next });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(maxCap, currentIdx + cols);
        if (next !== currentIdx) setSelection({ ...selection, indices: [next], startIdx: next });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = Math.max(1, currentIdx - cols);
        if (next !== currentIdx) setSelection({ ...selection, indices: [next], startIdx: next });
      }

      // 2. 字母/数字触发搜索 (IME 风格)
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && e.key !== ' ') {
        e.preventDefault();
        const el = spellsRef.current?.querySelector(`[data-slot-idx="${currentIdx}"]`) as HTMLElement;
        const rect = el?.getBoundingClientRect() || { left: 0, bottom: 0 };
        openPicker(slot, currentIdx.toString(), { 
          clientX: 0, clientY: 0, // 告知 App.tsx 这是一个非鼠标触发
          x: rect.left, 
          y: rect.bottom + 8, 
          initialSearch: e.key 
        } as any);
      }

      // 3. Enter/Space 触发空搜索
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const el = spellsRef.current?.querySelector(`[data-slot-idx="${currentIdx}"]`) as HTMLElement;
        const rect = el?.getBoundingClientRect() || { left: 0, bottom: 0 };
        openPicker(slot, currentIdx.toString(), { 
          clientX: 0, clientY: 0,
          x: rect.left, 
          y: rect.bottom + 8, 
          initialSearch: '' 
        } as any);
      }

      // 4. 删除键
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const sid = data.spells[currentIdx.toString()];
        if (sid) {
          const newSpells = { ...data.spells };
          const newSpellUses = { ...(data.spell_uses || {}) };
          delete newSpells[currentIdx.toString()];
          delete newSpellUses[currentIdx.toString()];
          updateWand(slot, { spells: newSpells, spell_uses: newSpellUses }, t('app.notification.delete_spell'));
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selection, slot, data.deck_capacity, data.spells, data.spell_uses]);

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

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', () => setIsAltPressed(false)); // Reset on loss of focus
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

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
      const rowCount = Math.floor((spellsRef.current?.offsetWidth || 600) / (56 + (settings.editorSpellGap || 0)));

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
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // 如果是数字且当前格子有法术，可能是想直接用数字选词，但在格子界面我们倾向于开启搜索
        // 除非是按了空格/回车（开启空的搜索框）
        e.preventDefault();
        openPicker(slot, currentIdx.toString(), { 
          clientX: 0, clientY: 0, // 坐标由 Picker 自己计算偏移
          initialSearch: e.key === ' ' ? '' : e.key 
        } as any);
      }
      
      if (e.key === 'Enter') {
        e.preventDefault();
        openPicker(slot, currentIdx.toString(), { clientX: 0, clientY: 0 } as any);
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const newSpells = { ...(data.spells || {}) };
        const newSpellUses = { ...(data.spell_uses || {}) };
        delete newSpells[currentIdx];
        delete newSpellUses[currentIdx];
        updateWand(slot, { spells: newSpells, spell_uses: newSpellUses });
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selection, slot, data.deck_capacity, settings.editorSpellGap, onMoveSelection, openPicker]);

  const renderTimeInput = (label: string, frames: number, updateKey: keyof WandData) => {
    const primaryValue = settings.showStatsInFrames ? frames : parseFloat((frames / 60).toFixed(3));
    const secondaryValue = settings.showStatsInFrames ? (frames / 60).toFixed(2) + 's' : frames + 'f';
    
    return (
      <PropInput 
        label={label}
        value={primaryValue}
        secondaryValue={secondaryValue}
        colorClass="text-amber-300"
        onChange={v => updateWand(slot, { [updateKey]: settings.showStatsInFrames ? Math.round(v) : Math.round(v * 60) })}
      />
    );
  };

  const getWand2Text = () => {
    const sequence = Array.from({ length: data.deck_capacity }).map((_, i) => data.spells[(i + 1).toString()] || "");
    return `{{Wand2
| wandCard     = Yes
| wandPic      = 
| spellsCast   = ${data.actions_per_round}
| shuffle      = ${data.shuffle_deck_when_empty ? 'Yes' : 'No'}
| castDelay    = ${(data.fire_rate_wait / 60).toFixed(2)}
| rechargeTime = ${(data.reload_time / 60).toFixed(2)}
| manaMax      = ${data.mana_max.toFixed(2)}
| manaCharge   = ${data.mana_charge_speed.toFixed(2)}
| capacity     = ${data.deck_capacity}
| spread       = ${data.spread_degrees}
| speed        = ${data.speed_multiplier.toFixed(2)}
| spells       = ${sequence.join(',')}
| alwaysCasts  = ${data.always_cast.join(',')}
}}`;
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
    <div ref={wandRef} className="px-6 py-6 bg-[#0c0c0e] border-t border-white/5 space-y-8 select-none">
      <div className="flex items-start gap-8 attributes-container">
        <div 
          className="flex flex-wrap items-center bg-zinc-900/50 border border-white/5 rounded-xl p-1 pr-6 shadow-2xl min-w-[600px] wand-attributes-box"
          onMouseUp={() => handleSlotMouseUp(slot, -1000)}
        >
          {/* Group 1: Shuffle */}
          <div className="px-6 py-2 border-r border-white/5 flex items-center h-16">
            <button 
              onClick={() => updateWand(slot, { shuffle_deck_when_empty: !data.shuffle_deck_when_empty })}
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
            <PropInput label={t('editor.spells_per_cast')} value={data.actions_per_round} onChange={v => updateWand(slot, { actions_per_round: Math.max(1, Math.round(v)) })} />
            <PropInput label={t('editor.speed')} value={data.speed_multiplier} colorClass="text-indigo-400" onChange={v => updateWand(slot, { speed_multiplier: v })} />
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 h-fit export-ignore">
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
            <button 
              onClick={() => requestEvaluation(data, true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
              title={t('evaluator.force_analyze_desc')}
            >
              <RefreshCw size={12} className="opacity-70" />
              {t('evaluator.force_analyze')}
            </button>
            <div className="flex items-center gap-2 px-2 py-1 bg-white/[0.02] border border-white/5 rounded-lg overflow-hidden focus-within:border-indigo-500/50 transition-colors" title={t('evaluator.evaluation_seed_desc')}>
              <span className="text-[9px] text-zinc-500 font-black uppercase shrink-0">Seed</span>
              <input 
                type="text"
                value={settings.evaluationSeed || ''}
                onChange={e => {
                  const val = e.target.value;
                  setSettings(s => ({ ...s, evaluationSeed: val }));
                }}
                className="bg-transparent border-none outline-none text-[10px] text-zinc-300 w-16 font-mono"
                placeholder="Auto"
              />
            </div>
          </div>
        </div>
      </div>

      <div ref={spellsRef} className="space-y-8">
        {Array.isArray(data.always_cast) && data.always_cast.length > 0 && (
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
                    handleSlotMouseDown(slot, acIdx, e.button === 2);
                  }}
                  onMouseUp={() => handleSlotMouseUp(slot, acIdx)}
                  onMouseMove={(e) => handleSlotMouseMove(e, slot, acIdx)}
                  onMouseLeave={handleSlotMouseLeave}
                  onClick={(e) => {
                    if (e.altKey) {
                      const newAC = [...data.always_cast];
                      newAC.splice(i, 1);
                      updateWand(slot, { always_cast: newAC }, "删除始终施放法术");
                      return;
                    }
                    openPicker(slot, `ac-${i}`, e);
                  }}
                >
                  <div className={`
                    w-12 h-12 rounded-lg border flex items-center justify-center relative shadow-[0_0_15px_rgba(245,158,11,0.1)] transition-transform hover:scale-105
                    ${isHovered ? 'border-indigo-500 bg-indigo-500/20' : 'border-amber-500/30 bg-amber-500/5'}
                  `}>
                    {isHovered && (
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

      <div className="max-h-[600px] overflow-y-auto custom-scrollbar p-1 select-none">
        <div 
          className="grid gap-0"
          style={{ 
            gridTemplateColumns: `repeat(auto-fill, minmax(${56 + (settings.editorSpellGap || 0)}px, 1fr))` 
          }}
        >
          {Array.from({ length: Math.max(data.deck_capacity, 24) }).map((_, i) => {
            const idx = (i + 1).toString();
            const sid = data.spells ? data.spells[idx] : null;
            const spell = sid ? spellDb[sid] : null;
            const uses = (data.spell_uses || {})[idx] ?? spell?.max_uses;
            const isLocked = i >= data.deck_capacity;
            const isSelected = selection?.wandSlot === slot && selection.indices.includes(i + 1);
            const isHovered = hoveredSlot?.wandSlot === slot && hoveredSlot?.idx === (i + 1);
            const gap = settings.editorSpellGap || 0;

            return (
              <div
                key={i}
                className="aspect-square relative"
                style={{ padding: `${gap / 2}px` }}
                onMouseMove={(e) => !isLocked && handleSlotMouseMove(e, slot, i + 1)}
                onMouseLeave={handleSlotMouseLeave}
              >
                <div
                  onMouseDown={(e) => {
                    if (!isLocked) {
                      if (e.ctrlKey && e.button === 1 && sid) {
                        e.preventDefault();
                        e.stopPropagation();
                        openWiki(sid);
                        return;
                      }
                      if (e.button === 1 && spell) {
                        e.preventDefault();
                        e.stopPropagation();
                        const marked = Array.isArray(data.marked_slots) ? data.marked_slots : [];
                        const slotIdx = i + 1; // Align with 1-based index used by simulator
                        const newMarked = marked.includes(slotIdx)
                          ? marked.filter(m => m !== slotIdx)
                          : [...marked, slotIdx];
                        updateWand(slot, { marked_slots: newMarked });
                        return;
                      }
                      e.preventDefault();
                      handleSlotMouseDown(slot, i + 1, e.button === 2);
                    }
                  }}
                  data-slot-idx={idx}
                  onMouseUp={(e) => {
                    if (!isLocked) {
                      handleSlotMouseUp(slot, i + 1);
                    }
                  }}
                  onContextMenu={(e) => {
                    // Prevent context menu on spells to allow right-click drag
                    if (spell) e.preventDefault();
                  }}
                  onMouseEnter={() => !isLocked && handleSlotMouseEnter(slot, i + 1)}
                  onClick={(e) => {
                    if (e.altKey && spell) {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      // Special handling for condition spells
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
                      const newSpellUses = { ...(data.spell_uses || {}), [idx]: newUses };
                      const actionName = newUses === 0 ? t('app.notification.set_charges_0') : t('app.notification.restore_charges');
                      updateWand(slot, { spell_uses: newSpellUses }, actionName);
                      return;
                    }
                    if (selection && selection.indices.length > 1) {
                      setSelection(null);
                    } else {
                      !isLocked && openPicker(slot, idx, e);
                    }
                  }}
                  className={`
                      w-full h-full rounded-lg border flex items-center justify-center relative group/cell transition-all active:scale-95
                      ${isLocked ? 'bg-black/40 border-transparent opacity-10' : `bg-zinc-800/80 border-white/5 shadow-inner hover:bg-zinc-700/80 ${settings.editorDragMode === 'hand' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                      ${isSelected ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-500/40 border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.3)] z-10 scale-[1.02]' : ''}
                      ${isHovered && dragSource && settings.useNoitaSwapLogic ? 'border-indigo-500 bg-indigo-500/30 scale-105 z-20' : 'hover:border-indigo-500/50'}
                    `}
                >
                  {isHovered && (
                    (dragSource && settings.useNoitaSwapLogic) ? (
                      <div className="absolute inset-0 border-2 border-indigo-400 rounded-lg animate-pulse pointer-events-none" />
                    ) : (
                      <div 
                        className="absolute top-0 bottom-0 w-1 bg-indigo-400 z-50 animate-pulse rounded-full" 
                        style={{ [hoveredSlot.isRightHalf ? 'right' : 'left']: `-${gap / 2 + 2}px` }}
                      />
                    )
                  )}
                  {spell ? (
                    <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
                      {/* Check if condition is active */}
                      {(() => {
                        const isTriggered = (sid === 'IF_HP' && settings.simulateLowHp) || 
                                           (sid === 'IF_PROJECTILE' && settings.simulateManyProjectiles) ||
                                           (sid === 'IF_ENEMY' && settings.simulateManyEnemies);
                        const isGrayscale = (uses === 0) || isTriggered;
                        const isMarked = Array.isArray(data.marked_slots) && data.marked_slots.includes(i + 1);
                        
                        return (
                          <>
                            <img src={getIconUrl(spell.icon, isConnected)} className={`w-11 h-11 image-pixelated transition-transform group-hover/cell:scale-110 ${isGrayscale ? 'grayscale opacity-50' : ''}`} alt="" draggable="false" />
                            
                            {isMarked && (
                              <div className="absolute inset-0 border-2 border-amber-500 rounded-lg shadow-[0_0_10px_rgba(245,158,11,0.5)] z-10 pointer-events-none" />
                            )}
                            
                            {isTriggered && (
                              <div className="absolute bottom-0 left-0">
                                <svg width="12" height="12" viewBox="0 0 12 12" className="drop-shadow-[0_0_2px_rgba(239,68,68,0.8)]">
                                  <path d="M0 12 L12 12 L0 0 Z" fill="rgb(239, 68, 68)" />
                                </svg>
                              </div>
                            )}

                            {uses !== undefined && (settings.showSpellCharges || uses === 0) && uses !== -1 && !isTriggered && (
                              <div 
                                className={`absolute bottom-0 left-0 px-1.5 py-0.5 bg-black/90 text-[10px] font-mono font-black border-tr border-white/10 rounded-tr pointer-events-auto cursor-pointer select-none z-20 shadow-lg ${uses === 0 ? 'text-red-500' : 'text-amber-400'}`}
                                title={t('editor.modify_uses_tip')}
                                onClick={(e) => {
                                   e.stopPropagation();
                                   const newUses = uses === 0 ? (spell.max_uses ?? 10) : 0;
                                   const newSpellUses = { ...(data.spell_uses || {}), [idx]: newUses };
                                   updateWand(slot, { spell_uses: newSpellUses });
                                }}
                              >
                                {uses}
                              </div>
                            )}
                          </>
                        );
                      })()}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newSpells = { ...(data.spells || {}) };
                          const newSpellUses = { ...(data.spell_uses || {}) };
                          delete newSpells[idx];
                          delete newSpellUses[idx];
                          updateWand(slot, { spells: newSpells, spell_uses: newSpellUses });
                        }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity z-10 pointer-events-auto shadow-lg"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : !isLocked && (
                    <span className="text-zinc-800 text-2xl font-thin opacity-50">+</span>
                  )}
                  {!isLocked && absoluteToOrdinal[i + 1] && (
                    <div className={`
                      absolute bottom-1 right-1 text-[10px] font-black transition-all duration-200 pointer-events-none
                      ${(isAltPressed || settings.showIndices) ? 'text-cyan-400 scale-110 drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]' : 'text-white/5'}
                    `}>
                      {absoluteToOrdinal[i + 1]}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </div>
);
}
