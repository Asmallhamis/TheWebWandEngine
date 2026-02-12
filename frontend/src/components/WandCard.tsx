import React from 'react';
import { Wand2, Scissors, Clipboard, Trash2, ChevronUp, ChevronDown, Battery, Zap, Timer, RefreshCw, Activity, Monitor } from 'lucide-react';
import { WandData, Tab, SpellInfo, EvalResponse, AppSettings, WarehouseWand } from '../types';
import { CompactStat } from './Common';
import { WandEditor } from './WandEditor';
import WandEvaluator from './WandEvaluator';
import { getIconUrl, getWandSpriteUrl } from '../lib/evaluatorAdapter';
import { Library } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface WandCardProps {
  slot: string;
  data: WandData;
  activeTab: Tab;
  isConnected: boolean;
  spellDb: Record<string, SpellInfo>;
  selection: { wandSlot: string; indices: number[]; startIdx: number } | null;
  hoveredSlot: { wandSlot: string; idx: number; isRightHalf: boolean } | null;
  dragSource: { wandSlot: string; idx: number; sid: string } | null;
  clipboard: { type: 'wand'; data: WandData } | null;
  toggleExpand: (slot: string) => void;
  deleteWand: (slot: string) => void;
  copyWand: (slot: string) => void;
  copyLegacyWand: (slot: string) => void;
  pasteWand: (slot: string) => void;
  updateWand: (slot: string, updates: Partial<WandData>, actionName?: string, icons?: string[]) => void;
  handleSlotMouseDown: (slot: string, idx: number, isRightClick?: boolean) => void;
  handleSlotMouseUp: (slot: string, idx: number) => void;
  handleSlotMouseEnter: (slot: string, idx: number) => void;
  handleSlotMouseMove: (e: React.MouseEvent, slot: string, idx: number) => void;
  handleSlotMouseLeave: () => void;
  openPicker: (slot: string, idx: string, e: React.MouseEvent | { x: number, y: number, initialSearch?: string }) => void;
  setSelection: (s: any) => void;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  evalData?: { data: EvalResponse; id: number; loading?: boolean };
  requestEvaluation: (tabId: string, slot: string, wand: WandData, force?: boolean) => void;
  settings: any;
  onSaveToWarehouse: (wand: WandData) => void;
}

export function WandCard({
  slot,
  data,
  activeTab,
  isConnected,
  spellDb,
  selection,
  hoveredSlot,
  dragSource,
  clipboard,
  toggleExpand,
  deleteWand,
  copyWand,
  copyLegacyWand,
  pasteWand,
  updateWand,
  handleSlotMouseDown,
  handleSlotMouseUp,
  handleSlotMouseEnter,
  handleSlotMouseMove,
  handleSlotMouseLeave,
  openPicker,
  setSelection,
  setSettings,
  evalData,
  requestEvaluation,
  settings,
  onSaveToWarehouse,
}: WandCardProps) {
  const { t, i18n } = useTranslation();
  const renderTimeStat = (label: string, frames: number, colorClass: string) => {
    const primary = settings.showStatsInFrames ? frames : (frames / 60).toFixed(2) + 's';
    const secondary = settings.showStatsInFrames ? (frames / 60).toFixed(2) + 's' : frames;
    return (
      <div className="flex flex-col">
        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider leading-none mb-1">{label}</span>
        <div className="flex items-baseline gap-1">
          <span className={`text-[13px] font-mono font-bold leading-none ${colorClass}`}>{primary}</span>
          <span className="text-[10px] font-mono text-zinc-600 leading-none">{secondary}</span>
        </div>
      </div>
    );
  };

  const StatItem = ({ label, value, colorClass }: { label: string, value: string | number, colorClass?: string }) => (
    <div className="flex flex-col">
      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider leading-none mb-1">{label}</span>
      <span className={`text-[13px] font-mono font-bold leading-none ${colorClass || 'text-zinc-200'}`}>{value}</span>
    </div>
  );

  return (
    <div className={`glass-card group/wand border-white/5 ${activeTab.expandedWands.has(slot) ? 'bg-zinc-900/40' : 'hover:bg-zinc-900/20 overflow-hidden'}`}>
      <div
        className="flex items-center px-4 py-2 cursor-pointer gap-4"
        onClick={() => toggleExpand(slot)}
      >
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-12 h-10 rounded bg-zinc-800 flex items-center justify-center border border-white/5 relative overflow-hidden">
            {(() => {
              const spriteUrl = getWandSpriteUrl(data.appearance, isConnected);
              return spriteUrl ? (
                <img src={spriteUrl} className="w-full h-full object-contain image-pixelated p-1" alt="" />
              ) : (
                <Wand2 size={16} className={`${activeTab.isRealtime ? 'text-indigo-400' : 'text-amber-400'}`} />
              );
            })()}
          </div>
          <div className="text-[10px] font-black w-6 text-center">{slot}</div>
        </div>

        <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {Object.entries(data.spells || {})
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([idx, sid]) => {
              const spell = spellDb[sid];
              const uses = (data.spell_uses || {})[idx] ?? (spell as any)?.max_uses;
              const isTriggered = (sid === 'IF_HP' && settings.simulateLowHp) ||
                (sid === 'IF_PROJECTILE' && settings.simulateManyProjectiles) ||
                (sid === 'IF_ENEMY' && settings.simulateManyEnemies);
              const isMarked = (data.marked_slots || []).includes(parseInt(idx));
              const isGrayscale = (uses === 0) || isTriggered;
              const shouldShowCharge = (uses === 0 || settings.showSpellCharges) && !isTriggered;

              if (!spell) return null;
              const displayName = i18n.language.startsWith('en') && spell.en_name ? spell.en_name : spell.name;

              return (
                <div key={idx} className="relative shrink-0">
                  <img
                    src={getIconUrl(spell.icon, isConnected)}
                    className={`w-7 h-7 image-pixelated border rounded bg-black/20 transition-all ${isMarked ? 'border-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)] scale-110 z-10' : 'border-white/10'} ${isGrayscale ? 'grayscale opacity-50' : ''}`}
                    alt={displayName}
                    title={`${idx}: ${displayName}${uses !== undefined ? ` (${t('evaluator.cast_stats')} x${uses})` : ''}`}
                  />
                  {isTriggered && (
                    <div className="absolute bottom-0 left-0">
                      <svg width="8" height="8" viewBox="0 0 12 12">
                        <path d="M0 12 L12 12 L0 0 Z" fill="rgb(239, 68, 68)" />
                      </svg>
                    </div>
                  )}
                  {uses !== undefined && uses !== -1 && shouldShowCharge && (
                    <div className={`absolute bottom-0 left-0 px-0.5 bg-black/80 text-[6px] font-mono leading-none border-tr border-white/10 rounded-tr ${uses === 0 ? 'text-red-500' : 'text-amber-400'}`}>
                      {uses}
                    </div>
                  )}
                </div>
              );
            })}
          {Object.keys(data.spells || {}).length === 0 && (
            <span className="text-[10px] text-zinc-700 italic font-medium ml-2">{t('tabs.empty_wand')}</span>
          )}
        </div>

        <div className="flex items-center gap-0 border-l border-white/5 shrink-0 h-10">
          {/* Group 1: Shuffle */}
          <div className="px-3 h-full flex items-center border-r border-white/5">
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${data.shuffle_deck_when_empty ? 'bg-red-500/5 border-red-500/20 text-red-400' : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'}`}>
              <div className={`w-1 h-1 rounded-full ${data.shuffle_deck_when_empty ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <span className="text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
                {data.shuffle_deck_when_empty ? t('editor.shuffle') : t('editor.no_shuffle')}
              </span>
            </div>
          </div>

          {/* Group 2: Mana */}
          <div className="px-3 h-full flex items-center gap-4 border-r border-white/5">
            <StatItem label={t('editor.mana_max')} value={data.mana_max || 0} colorClass="text-cyan-400" />
            <StatItem label={t('editor.recharge')} value={data.mana_charge_speed || 0} colorClass="text-cyan-400" />
          </div>

          {/* Group 3: Timing */}
          <div className="px-3 h-full flex items-center gap-4 border-r border-white/5">
            {renderTimeStat(t('editor.cast_delay'), data.fire_rate_wait, "text-amber-300")}
            {renderTimeStat(t('editor.recharge_time'), data.reload_time, "text-amber-300")}
          </div>

          {/* Group 4: Capacity & Other */}
          <div className="px-3 h-full flex items-center gap-4 border-r border-white/5">
            <StatItem label={t('editor.capacity')} value={data.deck_capacity} />
            <StatItem label={t('editor.spread')} value={(data.spread_degrees > 0 ? '+' : '') + data.spread_degrees + '°'} colorClass={data.spread_degrees <= 0 ? 'text-emerald-400' : 'text-red-400'} />
            <StatItem label={t('editor.spells_per_cast')} value={data.actions_per_round} />
            <StatItem label={t('editor.speed')} value={(data.speed_multiplier || 1).toFixed(2) + 'x'} colorClass="text-indigo-400" />
          </div>

          <div className="flex items-center bg-black/40 rounded-md p-0.5 ml-2 opacity-0 group-hover/wand:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); copyWand(slot); }}
              className="p-1.5 hover:bg-white/10 text-zinc-500 hover:text-indigo-400 rounded transition-colors"
              title={t('wand_card.copy')}
            >
              <Scissors size={14} />
            </button>
            {settings.showLegacyWandButton && (
              <button
                onClick={(e) => { e.stopPropagation(); copyLegacyWand(slot); }}
                className="p-1.5 hover:bg-white/10 text-zinc-500 hover:text-amber-400 rounded transition-colors text-[10px] font-black"
                title={t('wand_card.copy_legacy')}
              >
                W
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); pasteWand(slot); }}
              disabled={!clipboard}
              className={`p-1.5 rounded transition-colors ${clipboard ? 'hover:bg-white/10 text-zinc-500 hover:text-emerald-400' : 'text-zinc-800 cursor-not-allowed'}`}
              title={t('wand_card.paste_overwrite')}
            >
              <Clipboard size={14} />
            </button>
            <div className="w-px h-3 bg-white/10 mx-1" />
            <button
              onClick={(e) => { e.stopPropagation(); if (onSaveToWarehouse) onSaveToWarehouse(data); }}
              className="p-1.5 hover:bg-purple-500/20 text-zinc-500 hover:text-purple-400 rounded transition-colors"
              title={t('wand_card.save_to_warehouse')}
            >
              <Library size={14} />
            </button>
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
            dragSource={dragSource}
            updateWand={updateWand}
            handleSlotMouseDown={handleSlotMouseDown}
            handleSlotMouseUp={handleSlotMouseUp}
            handleSlotMouseEnter={handleSlotMouseEnter}
            handleSlotMouseMove={handleSlotMouseMove}
            handleSlotMouseLeave={handleSlotMouseLeave}
            openPicker={openPicker}
            setSelection={setSelection}
            setSettings={setSettings}
            settings={settings}
            isConnected={isConnected}
            requestEvaluation={(wand, force) => requestEvaluation(activeTab.id, slot, wand, force)}
          />
          {evalData && evalData.data && (
            <div className={`px-4 pb-4 transition-opacity duration-300 ${evalData.loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              {evalData.loading && (
                <div className="flex items-center gap-2 mb-2 text-amber-500 animate-pulse">
                  <Activity size={12} />
                  <span className="text-[10px] font-black uppercase tracking-widest italic">{t('evaluator.analyzing')}</span>
                </div>
              )}
              <WandEvaluator
                data={evalData.data}
                spellDb={spellDb}
                settings={settings}
                markedSlots={data.marked_slots}
                wandSpells={data.spells}
                deckCapacity={data.deck_capacity}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
