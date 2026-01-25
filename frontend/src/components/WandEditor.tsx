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
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
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
  setSettings,
  settings
}: WandEditorProps) {
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

  return (
    <div className="p-6 bg-zinc-950/50 border-t border-white/5 space-y-8 select-none">
      <div className="flex items-start justify-between gap-8">
        <div className="flex flex-wrap items-center bg-zinc-900/50 border border-white/5 rounded-xl p-1 pr-6 shadow-2xl">
          {/* Group 1: Shuffle */}
          <div className="px-6 py-2 border-r border-white/5 flex items-center h-16">
            <button 
              onClick={() => updateWand(slot, { shuffle_deck_when_empty: !data.shuffle_deck_when_empty })}
              className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-all ${data.shuffle_deck_when_empty ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${data.shuffle_deck_when_empty ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest">{data.shuffle_deck_when_empty ? 'Shuffle' : 'No Shuffle'}</span>
            </button>
          </div>

          {/* Group 2: Mana */}
          <div className="px-8 py-2 border-r border-white/5 flex gap-10">
            <PropInput label="Mana Max" value={data.mana_max} colorClass="text-cyan-400" onChange={v => updateWand(slot, { mana_max: v })} />
            <PropInput label="Recharge" value={data.mana_charge_speed} colorClass="text-cyan-400" onChange={v => updateWand(slot, { mana_charge_speed: v })} />
          </div>

          {/* Group 3: Timing */}
          <div className="px-8 py-2 border-r border-white/5 flex gap-10">
            {renderTimeInput("Cast Delay", data.fire_rate_wait, "fire_rate_wait")}
            {renderTimeInput("Rechg. Time", data.reload_time, "reload_time")}
          </div>

          {/* Group 4: Specs */}
          <div className="px-8 py-2 flex gap-10">
            <PropInput label="Capacity" value={data.deck_capacity} onChange={v => updateWand(slot, { deck_capacity: v })} />
            <PropInput label="Spread" value={data.spread_degrees} colorClass={data.spread_degrees <= 0 ? 'text-emerald-400' : 'text-red-400'} onChange={v => updateWand(slot, { spread_degrees: v })} />
            <PropInput label="Spells/Cast" value={data.actions_per_round} onChange={v => updateWand(slot, { actions_per_round: Math.max(1, Math.round(v)) })} />
            <PropInput label="Speed" value={data.speed_multiplier} colorClass="text-indigo-400" onChange={v => updateWand(slot, { speed_multiplier: v })} />
          </div>
        </div>

        <div className="text-[10px] font-black text-zinc-600 bg-white/[0.02] border border-white/5 px-3 py-2 rounded-lg tracking-[0.2em] flex items-center gap-2 shrink-0 h-fit">
          <Monitor size={14} className="opacity-50" /> EDITOR VIEW
        </div>
      </div>

      {/* Always Cast Section */}
      {data.always_cast && data.always_cast.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-amber-500/30 to-transparent" />
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em]">Always Cast Slots</span>
            <div className="h-px flex-1 bg-gradient-to-l from-amber-500/30 to-transparent" />
          </div>
          <div className="flex flex-wrap gap-3">
            {data.always_cast.map((sid, i) => {
              const spell = spellDb[sid];
              return (
                <div key={i} className="group/ac relative">
                  <div className="w-12 h-12 rounded-lg border border-amber-500/30 bg-amber-500/5 flex items-center justify-center relative shadow-[0_0_15px_rgba(245,158,11,0.1)] transition-transform hover:scale-105">
                    {spell ? (
                      <img 
                        src={`/api/icon/${spell.icon}`} 
                        className="w-10 h-10 image-pixelated" 
                        alt="" 
                        title={`Always Cast: ${spell.name}`}
                      />
                    ) : (
                      <span className="text-amber-500/20 text-xs">?</span>
                    )}
                    <button
                      onClick={() => {
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
                      w-full h-full rounded-lg border flex items-center justify-center relative group/cell transition-all active:scale-95
                      ${isLocked ? 'bg-black/40 border-transparent opacity-10' : 'bg-zinc-800/80 border-white/5 hover:border-indigo-500/50 cursor-pointer shadow-inner hover:bg-zinc-700/80'}
                      ${isSelected ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-500/20 border-indigo-400/50 z-10' : ''}
                    `}
                >
                  {isHovered && (
                    <div 
                      className="absolute top-0 bottom-0 w-1 bg-indigo-400 z-50 animate-pulse rounded-full" 
                      style={{ [hoveredSlot.isRightHalf ? 'right' : 'left']: `-${gap / 2 + 2}px` }}
                    />
                  )}
                  {spell ? (
                    <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
                      {/* Check if condition is active */}
                      {(() => {
                        const isTriggered = (sid === 'IF_HP' && settings.simulateLowHp) || 
                                           (sid === 'IF_PROJECTILE' && settings.simulateManyProjectiles) ||
                                           (sid === 'IF_ENEMY' && settings.simulateManyEnemies);
                        const isGrayscale = (uses === 0) || isTriggered;
                        
                        return (
                          <>
                            <img src={`/api/icon/${spell.icon}`} className={`w-11 h-11 image-pixelated transition-transform group-hover/cell:scale-110 ${isGrayscale ? 'grayscale opacity-50' : ''}`} alt="" draggable="false" />
                            
                            {isTriggered && (
                              <div className="absolute bottom-0 left-0">
                                <svg width="12" height="12" viewBox="0 0 12 12" className="drop-shadow-[0_0_2px_rgba(239,68,68,0.8)]">
                                  <path d="M0 12 L12 12 L0 0 Z" fill="rgb(239, 68, 68)" />
                                </svg>
                              </div>
                            )}

                            {uses !== undefined && (settings.showSpellCharges || uses === 0) && uses !== -1 && !isTriggered && (
                              <div 
                                className={`absolute bottom-0 left-0 px-1.5 py-0.5 bg-black/90 text-[10px] font-mono font-black border-tr border-white/10 rounded-tr pointer-events-auto cursor-ns-resize select-none z-20 shadow-lg ${uses === 0 ? 'text-red-500' : 'text-amber-400'}`}
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
                          </>
                        );
                      })()}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newSpells = { ...data.spells };
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
                  {!isLocked && <div className="absolute bottom-1 right-1.5 text-[8px] font-black text-white/5">{i + 1}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
