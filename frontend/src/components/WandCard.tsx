import React from 'react';
import { Wand2, Scissors, Clipboard, Trash2, ChevronUp, ChevronDown, Battery, Zap, Timer } from 'lucide-react';
import { WandData, Tab, SpellInfo, EvalResponse } from '../types';
import { CompactStat } from './Common';
import { WandEditor } from './WandEditor';
import WandEvaluator from './WandEvaluator';

interface WandCardProps {
  slot: string;
  data: WandData;
  activeTab: Tab;
  isConnected: boolean;
  spellDb: Record<string, SpellInfo>;
  selection: { wandSlot: string; indices: number[]; startIdx: number } | null;
  hoveredSlot: { wandSlot: string; idx: number; isRightHalf: boolean } | null;
  clipboard: { type: 'wand'; data: WandData } | null;
  toggleExpand: (slot: string) => void;
  deleteWand: (slot: string) => void;
  copyWand: (slot: string) => void;
  copyLegacyWand: (slot: string) => void;
  pasteWand: (slot: string) => void;
  updateWand: (slot: string, partial: Partial<WandData>) => void;
  handleSlotMouseDown: (slot: string, idx: number) => void;
  handleSlotMouseEnter: (slot: string, idx: number) => void;
  handleSlotMouseMove: (e: React.MouseEvent, slot: string, idx: number) => void;
  handleSlotMouseLeave: () => void;
  openPicker: (slot: string, idx: string, e: React.MouseEvent) => void;
  setSelection: (s: any) => void;
  evalData?: EvalResponse;
  settings: any;
}

export function WandCard({
  slot,
  data,
  activeTab,
  isConnected,
  spellDb,
  selection,
  hoveredSlot,
  clipboard,
  toggleExpand,
  deleteWand,
  copyWand,
  copyLegacyWand,
  pasteWand,
  updateWand,
  handleSlotMouseDown,
  handleSlotMouseEnter,
  handleSlotMouseMove,
  handleSlotMouseLeave,
  openPicker,
  setSelection,
  evalData,
  settings
}: WandCardProps) {
  return (
    <div className={`glass-card group/wand overflow-hidden border-white/5 ${activeTab.expandedWands.has(slot) ? 'bg-zinc-900/40' : 'hover:bg-zinc-900/20'}`}>
      <div
        className="flex items-center px-4 py-2 cursor-pointer gap-4"
        onClick={() => toggleExpand(slot)}
      >
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center border border-white/5">
            <Wand2 size={16} className={`${activeTab.isRealtime ? 'text-indigo-400' : 'text-amber-400'}`} />
          </div>
          <div className="text-[10px] font-black w-6 text-center">{slot}</div>
        </div>

        <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {Object.entries(data.spells)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([idx, sid]) => {
              const spell = spellDb[sid];
              const uses = (data.spell_uses || {})[idx] ?? (spell as any)?.max_uses;
              const shouldShowCharge = uses === 0 || settings.showSpellCharges;
              return spell ? (
                <div key={idx} className="relative shrink-0">
                  <img
                    src={`/api/icon/${spell.icon}`}
                    className={`w-7 h-7 image-pixelated border border-white/10 rounded bg-black/20 ${uses === 0 ? 'grayscale opacity-50' : ''}`}
                    alt={spell.name}
                    title={`${idx}: ${spell.name}${uses !== undefined ? ` (次数: ${uses})` : ''}`}
                  />
                  {uses !== undefined && uses !== -1 && shouldShowCharge && (
                    <div className={`absolute bottom-0 left-0 px-0.5 bg-black/80 text-[6px] font-mono leading-none border-tr border-white/10 rounded-tr ${uses === 0 ? 'text-red-500' : 'text-amber-400'}`}>
                      {uses}
                    </div>
                  )}
                </div>
              ) : null;
            })}
          {Object.keys(data.spells).length === 0 && (
            <span className="text-[10px] text-zinc-700 italic font-medium ml-2">空法杖</span>
          )}
        </div>

        <div className="flex items-center gap-4 border-l border-white/5 pl-4 shrink-0">
          <CompactStat icon={<Battery size={10} />} value={data.mana_max.toString()} label="Max" />
          <CompactStat icon={<Zap size={10} />} value={data.mana_charge_speed.toString()} label="Chg" />
          <CompactStat 
            icon={<Timer size={10} />} 
            value={settings.showStatsInFrames ? data.reload_time.toString() : (data.reload_time / 60).toFixed(2) + 's'} 
            label="Rel" 
          />
          
          <div className="flex items-center bg-black/40 rounded-md p-0.5 opacity-0 group-hover/wand:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); copyWand(slot); }}
              className="p-1.5 hover:bg-white/10 text-zinc-500 hover:text-indigo-400 rounded transition-colors"
              title="复制 (Ctrl+C)"
            >
              <Scissors size={14} />
            </button>
            {settings.showLegacyWandButton && (
              <button
                onClick={(e) => { e.stopPropagation(); copyLegacyWand(slot); }}
                className="p-1.5 hover:bg-white/10 text-zinc-500 hover:text-amber-400 rounded transition-colors text-[10px] font-black"
                title="复制为老版Wand模板"
              >
                W
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); pasteWand(slot); }}
              disabled={!clipboard}
              className={`p-1.5 rounded transition-colors ${clipboard ? 'hover:bg-white/10 text-zinc-500 hover:text-emerald-400' : 'text-zinc-800 cursor-not-allowed'}`}
              title="粘贴 (覆盖)"
            >
              <Clipboard size={14} />
            </button>
            <div className="w-px h-3 bg-white/10 mx-1" />
            <button
              onClick={(e) => { e.stopPropagation(); deleteWand(slot); }}
              className="p-1.5 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded transition-colors"
            >
              <Trash2 size={14} />
            </button>
            <div className="p-1.5 text-zinc-600">
              {activeTab.expandedWands.has(slot) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>
        </div>
      </div>

      {activeTab.expandedWands.has(slot) && (
        <>
          <WandEditor
            slot={slot}
            data={data}
            spellDb={spellDb}
            selection={selection}
            hoveredSlot={hoveredSlot}
            updateWand={updateWand}
            handleSlotMouseDown={handleSlotMouseDown}
            handleSlotMouseEnter={handleSlotMouseEnter}
            handleSlotMouseMove={handleSlotMouseMove}
            handleSlotMouseLeave={handleSlotMouseLeave}
            openPicker={openPicker}
            setSelection={setSelection}
            settings={settings}
          />
          {evalData && (
            <div className="px-4 pb-4">
               <WandEvaluator data={evalData} spellDb={spellDb} settings={settings} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
