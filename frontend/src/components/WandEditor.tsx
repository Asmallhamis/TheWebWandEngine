import React from 'react';
import { Monitor, X } from 'lucide-react';
import { WandData, SpellInfo, AppSettings } from '../types';
import { PropInput } from './Common';

interface WandEditorProps {
  slot: string;
  data: WandData;
  spellDb: Record<string, SpellInfo>;
  selection: { wandSlot: string; indices: number[]; startIdx: number } | null;
  hoveredSlot: { wandSlot: string; idx: number; isRightHalf: boolean } | null;
  updateWand: (slot: string, partial: Partial<WandData>, actionName?: string, icons?: string[]) => void;
  handleSlotMouseDown: (slot: string, idx: number) => void;
  handleSlotMouseEnter: (slot: string, idx: number) => void;
  handleSlotMouseMove: (e: React.MouseEvent, slot: string, idx: number) => void;
  handleSlotMouseLeave: () => void;
  openPicker: (slot: string, idx: string, e: React.MouseEvent) => void;
  setSelection: (s: any) => void;
  settings: AppSettings;
}

export function WandEditor({
  slot,
  data,
  spellDb,
  selection,
  hoveredSlot,
  updateWand,
  handleSlotMouseDown,
  handleSlotMouseEnter,
  handleSlotMouseMove,
  handleSlotMouseLeave,
  openPicker,
  setSelection,
  settings
}: WandEditorProps) {
  return (
    <div className="p-4 bg-black/40 border-t border-white/5 space-y-4 select-none">
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <PropInput label="Mana Max" value={data.mana_max} onChange={v => updateWand(slot, { mana_max: v })} />
          <PropInput label="Recharge" value={data.mana_charge_speed} onChange={v => updateWand(slot, { mana_charge_speed: v })} />
          <PropInput 
            label={settings.showStatsInFrames ? "Reload (f)" : "Reload (s)"} 
            value={settings.showStatsInFrames ? data.reload_time : parseFloat((data.reload_time / 60).toFixed(3))} 
            onChange={v => updateWand(slot, { reload_time: settings.showStatsInFrames ? Math.round(v) : Math.round(v * 60) })} 
          />
          <PropInput 
            label={settings.showStatsInFrames ? "Wait (f)" : "Wait (s)"} 
            value={settings.showStatsInFrames ? data.fire_rate_wait : parseFloat((data.fire_rate_wait / 60).toFixed(3))} 
            onChange={v => updateWand(slot, { fire_rate_wait: settings.showStatsInFrames ? Math.round(v) : Math.round(v * 60) })} 
          />
          <PropInput label="Capacity" value={data.deck_capacity} onChange={v => updateWand(slot, { deck_capacity: v })} />
        </div>
        <div className="text-[10px] font-black text-zinc-500 bg-white/5 px-2 py-1 rounded tracking-widest flex items-center gap-2">
          <Monitor size={12} /> EDITOR VIEW
        </div>
      </div>

      <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-1 select-none">
        <div 
          className="grid gap-0"
          style={{ 
            gridTemplateColumns: `repeat(auto-fill, minmax(${48 + (settings.editorSpellGap || 0)}px, 1fr))` 
          }}
        >
          {Array.from({ length: Math.max(data.deck_capacity, 20) }).map((_, i) => {
            const idx = (i + 1).toString();
            const sid = data.spells[idx];
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
                    if (e.button === 0 && !isLocked) {
                      e.preventDefault();
                      handleSlotMouseDown(slot, i + 1);
                    }
                  }}
                  onMouseEnter={() => !isLocked && handleSlotMouseEnter(slot, i + 1)}
                  onClick={(e) => {
                    if (e.altKey && spell) {
                      e.preventDefault();
                      e.stopPropagation();
                      const newUses = uses === 0 ? (spell.max_uses ?? -1) : 0;
                      const newSpellUses = { ...(data.spell_uses || {}), [idx]: newUses };
                      updateWand(slot, { spell_uses: newSpellUses }, `修改法术次数: ${newUses === 0 ? '设为 0' : '还原默认'}`);
                      return;
                    }
                    if (selection && selection.indices.length > 1) {
                      setSelection(null);
                    } else {
                      !isLocked && openPicker(slot, idx, e);
                    }
                  }}
                  className={`
                      w-full h-full rounded border flex items-center justify-center relative group/cell transition-transform active:scale-95
                      ${isLocked ? 'bg-black/40 border-transparent opacity-20' : 'bg-zinc-800/80 border-white/5 hover:border-indigo-500/50 cursor-pointer shadow-inner hover:bg-zinc-700'}
                      ${isSelected ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-500/20 border-indigo-400/50 z-10' : ''}
                    `}
                >
                  {isHovered && (
                    <div 
                      className="absolute top-0 bottom-0 w-0.5 bg-indigo-400 z-50 animate-pulse" 
                      style={{ [hoveredSlot.isRightHalf ? 'right' : 'left']: `-${gap / 2}px` }}
                    />
                  )}
                  {spell ? (
                    <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
                      <img src={`/api/icon/${spell.icon}`} className={`w-10 h-10 image-pixelated transition-transform group-hover/cell:scale-110 ${uses === 0 ? 'grayscale opacity-50' : ''}`} alt="" draggable="false" />
                      
                      {uses !== undefined && (settings.showSpellCharges || uses === 0) && uses !== -1 && (
                        <div 
                          className={`absolute bottom-0 left-0 px-1 bg-black/80 text-[9px] font-mono font-bold border-tr border-white/10 rounded-tr pointer-events-auto cursor-ns-resize select-none z-20 ${uses === 0 ? 'text-red-500' : 'text-amber-400'}`}
                          title="点击或滚动修改次数 (Alt+点击设为0, -1 为无限)"
                          onWheel={(e) => {
                            e.stopPropagation();
                            const delta = e.deltaY > 0 ? -1 : 1;
                            const newUses = Math.max(-1, (uses ?? 0) + delta);
                            const newSpellUses = { ...(data.spell_uses || {}), [idx]: newUses };
                            updateWand(slot, { spell_uses: newSpellUses });
                          }}
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

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newSpells = { ...data.spells };
                          const newSpellUses = { ...(data.spell_uses || {}) };
                          delete newSpells[idx];
                          delete newSpellUses[idx];
                          updateWand(slot, { spells: newSpells, spell_uses: newSpellUses });
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity z-10 pointer-events-auto"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ) : !isLocked && (
                    <span className="text-zinc-800 text-lg font-thin">+</span>
                  )}
                  {!isLocked && <div className="absolute bottom-0.5 right-1 text-[7px] font-black text-white/5">{i + 1}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
