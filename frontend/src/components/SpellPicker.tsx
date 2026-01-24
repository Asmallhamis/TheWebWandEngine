import React from 'react';
import { Search, Star, Minimize2, Plus } from 'lucide-react';
import { SpellInfo, AppSettings } from '../types';
import { SPELL_GROUPS } from '../constants';

interface SpellPickerProps {
  pickerConfig: { x: number; y: number; wandSlot: string; spellIdx: string; isAlwaysCast?: boolean } | null;
  onClose: () => void;
  pickerSearch: string;
  setPickerSearch: (s: string) => void;
  pickSpell: (spellId: string | null) => void;
  searchResults: SpellInfo[][] | null;
  spellStats: { overall: SpellInfo[]; categories: SpellInfo[][] };
  settings: AppSettings;
  pickerExpandedGroups: Set<number>;
  setPickerExpandedGroups: React.Dispatch<React.SetStateAction<Set<number>>>;
}

export function SpellPicker({
  pickerConfig,
  onClose,
  pickerSearch,
  setPickerSearch,
  pickSpell,
  searchResults,
  spellStats,
  settings,
  pickerExpandedGroups,
  setPickerExpandedGroups
}: SpellPickerProps) {
  if (!pickerConfig) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" onClick={onClose}>
      <div
        className="absolute glass-card bg-zinc-900/95 border-white/10 shadow-2xl flex flex-col max-h-[600px] animate-in slide-in-from-top-4 duration-200 overflow-hidden"
        style={{
          top: Math.min(pickerConfig.y, window.innerHeight - 520),
          left: Math.min(pickerConfig.x, window.innerWidth - 620),
          width: Math.max(400, Math.min(window.innerWidth - 40, settings.wrapLimit * (settings.pickerRowHeight + 6) + 24))
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-3 border-b border-white/5 flex items-center gap-2 bg-black/20">
          <Search size={14} className="text-zinc-500" />
          <input
            autoFocus
            placeholder="搜索法术..."
            className="bg-transparent flex-1 text-sm outline-none placeholder:text-zinc-600"
            value={pickerSearch}
            onChange={e => setPickerSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && pickerSearch === '') pickSpell(null);
            }}
          />
          <button onClick={() => pickSpell(null)} className="text-[10px] font-black text-red-400 bg-red-400/10 px-2 py-1 rounded hover:bg-red-400/20">
            清除槽位
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-4">
          {pickerSearch ? (
            searchResults?.map((group, gIdx) => (
              <div key={gIdx} className={group.length === 0 ? 'hidden' : ''}>
                <div className="flex items-center gap-2 px-2 mb-2">
                  <div className="w-1 h-3 rounded-full bg-zinc-700" />
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{SPELL_GROUPS[gIdx].name}</span>
                </div>
                <div className="grid grid-cols-6 gap-1.5 px-1">
                  {group.map((s: SpellInfo) => (
                    <button
                      key={s.id}
                      onClick={() => pickSpell(s.id)}
                      className="aspect-square bg-white/5 hover:bg-white/10 border border-white/5 rounded flex items-center justify-center transition-all group"
                    >
                      <img src={`/api/icon/${s.icon}`} className="w-7 h-7 image-pixelated group-hover:scale-110" alt="" />
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <>
              {spellStats.overall.length > 0 && (
                <div className="rounded-lg overflow-hidden mb-2">
                  <div className="p-2 bg-gradient-to-r from-indigo-500/10 to-zinc-800/20">
                    <div className={`flex items-center justify-between ${settings.hideLabels ? 'mb-0' : 'mb-2'}`}>
                      {!settings.hideLabels && (
                        <div className="flex items-center gap-2">
                          <Star size={12} className="text-amber-500" />
                          <span className="text-[9px] font-black text-white/70 uppercase tracking-widest">常用统计 (Global)</span>
                        </div>
                      )}
                      <button
                        onClick={() => setPickerExpandedGroups(prev => {
                          const next = new Set(prev);
                          if (next.has(-1)) next.delete(-1);
                          else next.add(-1);
                          return next;
                        })}
                        className="w-5 h-5 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded transition-colors group/plus ml-auto"
                      >
                        {pickerExpandedGroups.has(-1) ? (
                          <Minimize2 size={12} className="text-white/50 group-hover/plus:text-white" />
                        ) : (
                          <Plus size={12} className="text-white/50 group-hover/plus:text-white" />
                        )}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-0.5">
                      {spellStats.overall.map((s: SpellInfo) => (
                        <button
                          key={s.id}
                          onClick={() => pickSpell(s.id)}
                          style={{ height: settings.pickerRowHeight, width: settings.pickerRowHeight }}
                          className="aspect-square bg-black/20 hover:bg-black/40 border border-white/5 rounded flex items-center justify-center transition-all group overflow-hidden"
                          title={s.name}
                        >
                          <img src={`/api/icon/${s.icon}`} className="w-7 h-7 image-pixelated group-hover:scale-110" alt="" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {SPELL_GROUPS.map((group, gIdx) => (
                <div key={group.name} className={`rounded-lg overflow-hidden ${spellStats.categories[gIdx].length === 0 ? 'hidden' : ''}`}>
                  <div className={`p-2 bg-gradient-to-r ${settings.themeColors[gIdx]}`}>
                    <div className={`flex items-center justify-between ${settings.hideLabels ? 'mb-0' : 'mb-2'}`}>
                      {!settings.hideLabels && (
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-3 rounded-full bg-white/20" />
                          <span className="text-[9px] font-black text-white/70 uppercase tracking-widest">{group.name} {!pickerExpandedGroups.has(gIdx) && `(Top ${settings.categoryLimit})`}</span>
                        </div>
                      )}
                      <button
                        onClick={() => setPickerExpandedGroups(prev => {
                          const next = new Set(prev);
                          if (next.has(gIdx)) next.delete(gIdx);
                          else next.add(gIdx);
                          return next;
                        })}
                        className="w-5 h-5 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded transition-colors group/plus ml-auto"
                      >
                        {pickerExpandedGroups.has(gIdx) ? (
                          <Minimize2 size={12} className="text-white/50 group-hover/plus:text-white" />
                        ) : (
                          <Plus size={12} className="text-white/50 group-hover/plus:text-white" />
                        )}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-0.5">
                      {spellStats.categories[gIdx].map((s: SpellInfo) => (
                        <button
                          key={s.id}
                          onClick={() => pickSpell(s.id)}
                          style={{ height: settings.pickerRowHeight, width: settings.pickerRowHeight }}
                          className="aspect-square bg-black/20 hover:bg-black/40 border border-white/5 rounded flex items-center justify-center transition-all group overflow-hidden"
                          title={s.name}
                        >
                          <img src={`/api/icon/${s.icon}`} className="w-7 h-7 image-pixelated group-hover:scale-110" alt="" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {(pickerSearch && searchResults?.every(g => g.length === 0)) && (
            <div className="py-10 text-center text-zinc-600 text-xs">
              无匹配结果
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
