import React, { useState } from 'react';
import { 
  Settings, X, Zap, Info, Download, Upload, 
  Search, Wand2, Activity, Layers, Database, Star,
  HelpCircle
} from 'lucide-react';
import { Plus, Trash2, Edit2, GripVertical } from 'lucide-react';
import { AppSettings, WandData, SpellTypeConfig, SpellGroupConfig } from '../types';
import { SPELL_GROUPS } from '../constants';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
}

type Category = 'general' | 'appearance' | 'wand' | 'cast' | 'sync' | 'spell_types' | 'data';

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  setSettings,
  onImport,
  onExport
}: SettingsModalProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const { t } = useTranslation();

  if (!isOpen || !settings) return null;

  // --- Safe Accessors ---
  const themeColors = settings.themeColors || ['','','',''];
  const defaultWandStats = settings.defaultWandStats || {};

  const updateDefaultWand = (key: keyof WandData, value: any) => {
    setSettings(prev => ({
      ...prev,
      defaultWandStats: {
        ...(prev.defaultWandStats || {}),
        [key]: value
      }
    }));
  };

  const updateSpellTypeColor = (id: number, color: string) => {
    setSettings(prev => ({
      ...prev,
      spellTypes: prev.spellTypes.map(t => t.id === id ? { ...t, color } : t)
    }));
  };

  const updateGroupColor = (idx: number, color: string) => {
    setSettings(prev => ({
      ...prev,
      spellGroups: prev.spellGroups.map((g, i) => i === idx ? { ...g, color } : g)
    }));
  };

  const updateGroupName = (idx: number, name: string) => {
    setSettings(prev => ({
      ...prev,
      spellGroups: prev.spellGroups.map((g, i) => i === idx ? { ...g, name } : g)
    }));
  };

  const GROUP_COLOR_PRESETS = [
    'from-blue-500/10 to-blue-600/20',
    'from-green-500/10 to-green-600/20',
    'from-purple-500/10 to-purple-600/20',
    'from-orange-500/10 to-orange-600/20',
    'from-red-500/10 to-red-600/20',
    'from-zinc-500/10 to-zinc-600/20'
  ];

  const addGroup = () => {
    setSettings(prev => ({
      ...prev,
      spellGroups: [...prev.spellGroups, { name: t('settings.new_group_default_name'), types: [] }]
    }));
  };

  const deleteGroup = (idx: number) => {
    if (settings.spellGroups.length <= 1) return;
    setSettings(prev => ({
      ...prev,
      spellGroups: prev.spellGroups.filter((_, i) => i !== idx)
    }));
  };

  const toggleTypeInGroup = (groupIdx: number, typeId: number) => {
    setSettings(prev => ({
      ...prev,
      spellGroups: prev.spellGroups.map((g, i) => {
        if (i === groupIdx) {
          const exists = g.types.includes(typeId);
          return {
            ...g,
            types: exists ? g.types.filter(id => id !== typeId) : [...g.types, typeId]
          };
        }
        return g;
      })
    }));
  };

  const categories = [
    { id: 'general', name: t('settings.categories.general'), icon: <Settings size={16} /> },
    { id: 'appearance', name: t('settings.categories.appearance'), icon: <Layers size={16} /> },
    { id: 'wand', name: t('settings.categories.wand'), icon: <Wand2 size={16} /> },
    { id: 'cast', name: t('settings.categories.cast'), icon: <Zap size={16} /> },
    { id: 'spell_types', name: t('settings.categories.spell_types'), icon: <Star size={16} /> },
    { id: 'sync', name: t('settings.categories.sync'), icon: <Activity size={16} /> },
    { id: 'data', name: t('settings.categories.data'), icon: <Database size={16} /> },
  ];

  // --- Search Logic ---
  let matchedAny = false;
  const isMatch = (text: string) => {
    if (!searchQuery) return true;
    const m = text.toLowerCase().includes(searchQuery.toLowerCase());
    if (m) matchedAny = true;
    return m;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md px-4 py-8" onClick={onClose}>
      <div 
        className="glass-card bg-[#0c0c0e] border-white/10 w-full max-w-3xl h-full max-h-[600px] flex overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200" 
        onClick={e => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="w-40 bg-black/40 border-r border-white/5 flex flex-col shrink-0">
          <div className="p-4 border-b border-white/5">
            <h2 className="text-[10px] font-black tracking-widest uppercase text-indigo-500">{t('settings.title')}</h2>
          </div>
          <nav className="p-2 space-y-1 flex-1">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setActiveCategory(cat.id as Category); setSearchQuery(''); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded text-[11px] font-bold transition-all ${activeCategory === cat.id && !searchQuery ? 'bg-indigo-500/10 text-white' : 'text-zinc-500 hover:bg-white/5'}`}
              >
                {cat.icon}
                <span className="hidden sm:inline">{cat.name}</span>
              </button>
            ))}
          </nav>

          <div className="p-2 mt-auto border-t border-white/5">
            <button
              onClick={() => setShowHelp(true)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded text-[11px] font-bold text-zinc-500 hover:bg-white/5 transition-all"
            >
              <HelpCircle size={14} className="text-amber-500" />
              <span className="hidden sm:inline">{t('guide.button')}</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 border-b border-white/5 flex items-center gap-4 bg-black/20">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
              <input 
                type="text"
                placeholder={t('settings.search_placeholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-full pl-9 pr-4 py-1.5 text-[11px] outline-none focus:border-indigo-500/30 text-white"
              />
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-zinc-500 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
            
            {/* GENERAL */}
            {(searchQuery || activeCategory === 'general') && (
              <div className="space-y-6">
                {isMatch(t('settings.language')) && (
                  <LanguageSwitcher />
                )}
                {isMatch(t('settings.common_limit')) && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('settings.common_limit')}</label>
                    <div className="flex items-center gap-4">
                      <input type="range" min="0" max="50" value={settings.commonLimit} onChange={e => setSettings(s => ({ ...s, commonLimit: parseInt(e.target.value) || 0 }))} className="flex-1 accent-indigo-500" />
                      <span className="text-xs font-mono font-bold text-indigo-400 w-8">{settings.commonLimit}</span>
                    </div>
                  </div>
                )}
                {isMatch(t('settings.category_limit')) && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('settings.category_limit')}</label>
                    <div className="flex items-center gap-4">
                      <input type="range" min="1" max="50" value={settings.categoryLimit} onChange={e => setSettings(s => ({ ...s, categoryLimit: parseInt(e.target.value) || 1 }))} className="flex-1 accent-emerald-500" />
                      <span className="text-xs font-mono font-bold text-emerald-400 w-8">{settings.categoryLimit}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* APPEARANCE */}
            {(searchQuery || activeCategory === 'appearance') && (
              <div className="space-y-6">
                {isMatch(t('settings.wrap_limit')) && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('settings.wrap_limit')} ({settings.wrapLimit})</label>
                    <input type="range" min="5" max="40" value={settings.wrapLimit} onChange={e => setSettings(s => ({ ...s, wrapLimit: parseInt(e.target.value) || 20 }))} className="w-full accent-indigo-500" />
                  </div>
                )}
                {isMatch(t('settings.picker_row_height')) && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('settings.picker_row_height')} ({settings.pickerRowHeight}px)</label>
                    <input type="range" min="24" max="64" step="4" value={settings.pickerRowHeight} onChange={e => setSettings(s => ({ ...s, pickerRowHeight: parseInt(e.target.value) || 32 }))} className="w-full accent-amber-500" />
                  </div>
                )}
                {isMatch(t('settings.warehouse_folder_height')) && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('settings.warehouse_folder_height')} ({settings.warehouseFolderHeight}px)</label>
                    <div className="flex items-center gap-4">
                      <input type="range" min="0" max="800" step="50" value={settings.warehouseFolderHeight} onChange={e => setSettings(s => ({ ...s, warehouseFolderHeight: parseInt(e.target.value) || 0 }))} className="flex-1 accent-indigo-500" />
                      <span className="text-xs font-mono font-bold text-indigo-400 w-12">{settings.warehouseFolderHeight || t('settings.unlimit')}</span>
                    </div>
                    <div className="text-[9px] text-zinc-600 italic">{t('settings.warehouse_folder_height_desc')}</div>
                  </div>
                )}
                {isMatch(t('settings.editor_spell_gap')) && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('settings.editor_spell_gap')} ({settings.editorSpellGap}px)</label>
                    <div className="flex items-center gap-4">
                      <input type="range" min="0" max="20" step="2" value={settings.editorSpellGap} onChange={e => setSettings(s => ({ ...s, editorSpellGap: parseInt(e.target.value) || 0 }))} className="flex-1 accent-indigo-500" />
                      <span className="text-xs font-mono font-bold text-indigo-400 w-8">{settings.editorSpellGap}</span>
                    </div>
                  </div>
                )}
                {isMatch(t('settings.hide_labels')) && (
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-500/10 rounded-lg text-zinc-400">
                        <Layers size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">{t('settings.hide_labels')}</div>
                        <div className="text-[10px] text-zinc-500">{t('settings.hide_labels_desc')}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, hideLabels: !s.hideLabels }))}
                      className={`w-10 h-5 rounded-full relative transition-colors ${settings.hideLabels ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.hideLabels ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* WAND SETTINGS */}
            {(searchQuery || activeCategory === 'wand') && (
              <div className="space-y-6">
                {isMatch(t('settings.show_stats_in_frames')) && (
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                        <Activity size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">{t('settings.show_stats_in_frames')}</div>
                        <div className="text-[10px] text-zinc-500">{t('settings.show_stats_in_frames_desc')}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, showStatsInFrames: !s.showStatsInFrames }))}
                      className={`w-10 h-5 rounded-full relative transition-colors ${settings.showStatsInFrames ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.showStatsInFrames ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                )}
                {isMatch(t('settings.show_legacy_wand_button')) && (
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                        <Wand2 size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">{t('settings.show_legacy_wand_button')}</div>
                        <div className="text-[10px] text-zinc-500">{t('settings.show_legacy_wand_button_desc')}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, showLegacyWandButton: !s.showLegacyWandButton }))}
                      className={`w-10 h-5 rounded-full relative transition-colors ${settings.showLegacyWandButton ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.showLegacyWandButton ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                )}
                {isMatch(t('settings.delete_empty_slots')) && (
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-500/10 rounded-lg text-red-400">
                        <Trash2 size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">{t('settings.delete_empty_slots')}</div>
                        <div className="text-[10px] text-zinc-500">{t('settings.delete_empty_slots_desc')}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, deleteEmptySlots: !s.deleteEmptySlots }))}
                      className={`w-10 h-5 rounded-full relative transition-colors ${settings.deleteEmptySlots ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.deleteEmptySlots ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                )}
                {isMatch(t('settings.default_wand_stats')) && (
                  <div className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-lg">
                    <h3 className="text-[11px] font-black text-indigo-400 uppercase mb-4 flex items-center gap-2">{t('settings.default_wand_stats')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {(['mana_max', 'mana_charge_speed', 'deck_capacity', 'fire_rate_wait', 'reload_time'] as const).map(key => {
                        const isTime = key === 'fire_rate_wait' || key === 'reload_time';
                        const displayValue = (isTime && !settings.showStatsInFrames) 
                          ? parseFloat(((defaultWandStats[key] as number || 0) / 60).toFixed(3))
                          : (defaultWandStats[key] as number | undefined) ?? '';
                        
                        const label = isTime 
                          ? `${key.replace(/_/g, ' ')} (${settings.showStatsInFrames ? 'f' : 's'})`
                          : key.replace(/_/g, ' ');

                        return (
                          <div key={key} className="space-y-1">
                            <label className="text-[9px] font-bold text-zinc-500 uppercase">{label}</label>
                            <input 
                              type="number" 
                              value={displayValue} 
                              onChange={e => {
                                let val = parseFloat(e.target.value) || 0;
                                if (isTime && !settings.showStatsInFrames) val = Math.round(val * 60);
                                updateDefaultWand(key, val);
                              }}
                              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs font-mono text-indigo-300 outline-none focus:border-indigo-500/50" 
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CAST PARAMETERS */}
            {(searchQuery || activeCategory === 'cast') && (
              <div className="space-y-6">
                {isMatch(t('settings.unlimited_spells')) && (
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                        <Star size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">{t('settings.unlimited_spells')}</div>
                        <div className="text-[10px] text-zinc-500">{t('settings.unlimited_spells_desc')}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, unlimitedSpells: !s.unlimitedSpells }))}
                      className={`w-10 h-5 rounded-full relative transition-colors ${settings.unlimitedSpells ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.unlimitedSpells ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                )}
                {isMatch(t('settings.initial_if_half')) && (
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                        <Activity size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">{t('settings.initial_if_half')}</div>
                        <div className="text-[10px] text-zinc-500">{t('settings.initial_if_half_desc')}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, initialIfHalf: !s.initialIfHalf }))}
                      className={`w-10 h-5 rounded-full relative transition-colors ${settings.initialIfHalf ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.initialIfHalf ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isMatch(t('settings.simulate_low_hp')) && (
                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                      <div className="flex flex-col">
                        <div className="text-xs font-bold text-zinc-200">{t('settings.simulate_low_hp')}</div>
                        <div className="text-[10px] text-zinc-500">{t('settings.simulate_low_hp_desc')}</div>
                      </div>
                      <button
                        onClick={() => setSettings(s => ({ ...s, simulateLowHp: !s.simulateLowHp }))}
                        className={`w-8 h-4 rounded-full relative transition-colors shrink-0 ${settings.simulateLowHp ? 'bg-red-600' : 'bg-zinc-700'}`}
                      >
                        <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${settings.simulateLowHp ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>
                  )}
                  {isMatch(t('settings.simulate_many_enemies')) && (
                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                      <div className="flex flex-col">
                        <div className="text-xs font-bold text-zinc-200">{t('settings.simulate_many_enemies')}</div>
                        <div className="text-[10px] text-zinc-500">{t('settings.simulate_many_enemies_desc')}</div>
                      </div>
                      <button
                        onClick={() => setSettings(s => ({ ...s, simulateManyEnemies: !s.simulateManyEnemies }))}
                        className={`w-8 h-4 rounded-full relative transition-colors shrink-0 ${settings.simulateManyEnemies ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                      >
                        <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${settings.simulateManyEnemies ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>
                  )}
                  {isMatch(t('settings.simulate_many_projectiles')) && (
                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                      <div className="flex flex-col">
                        <div className="text-xs font-bold text-zinc-200">{t('settings.simulate_many_projectiles')}</div>
                        <div className="text-[10px] text-zinc-500">{t('settings.simulate_many_projectiles_desc')}</div>
                      </div>
                      <button
                        onClick={() => setSettings(s => ({ ...s, simulateManyProjectiles: !s.simulateManyProjectiles }))}
                        className={`w-8 h-4 rounded-full relative transition-colors shrink-0 ${settings.simulateManyProjectiles ? 'bg-blue-600' : 'bg-zinc-700'}`}
                      >
                        <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${settings.simulateManyProjectiles ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>
                  )}
                </div>
                {isMatch(t('settings.show_spell_charges')) && (
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                        <Database size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">{t('settings.show_spell_charges')}</div>
                        <div className="text-[10px] text-zinc-500">{t('settings.show_spell_charges_desc')}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, showSpellCharges: !s.showSpellCharges }))}
                      className={`w-10 h-5 rounded-full transition-colors relative ${settings.showSpellCharges ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.showSpellCharges ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                )}
                {isMatch(t('settings.num_casts')) && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('settings.num_casts')} ({settings.numCasts || 3})</label>
                    <div className="text-[10px] text-zinc-500 mb-2 italic">{t('settings.num_casts_desc')}</div>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="1" 
                        max="50" 
                        value={settings.numCasts || 3} 
                        onChange={e => setSettings(s => ({ ...s, numCasts: parseInt(e.target.value) || 3 }))} 
                        className="flex-1 accent-blue-500" 
                      />
                      <span className="text-xs font-mono font-bold text-blue-400 w-8">{settings.numCasts || 3}</span>
                    </div>
                  </div>
                )}
                {isMatch(t('settings.auto_hide_threshold')) && (
                  <div className="space-y-2 text-zinc-400">
                    <label className="text-[10px] font-black uppercase tracking-widest">{t('settings.auto_hide_threshold')}</label>
                    <div className="text-[10px] text-zinc-500 mb-2 italic">{t('settings.auto_hide_threshold_desc')}</div>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="5" 
                        max="100" 
                        value={settings.autoHideThreshold || 20} 
                        onChange={e => setSettings(s => ({ ...s, autoHideThreshold: parseInt(e.target.value) || 20 }))} 
                        className="flex-1 accent-indigo-500" 
                      />
                      <span className="text-xs font-mono font-bold text-indigo-400 w-8">{settings.autoHideThreshold || 20}</span>
                    </div>
                  </div>
                )}
                {isMatch(t('settings.group_identical_casts')) && (
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                        <Layers size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">{t('settings.group_identical_casts')}</div>
                        <div className="text-[10px] text-zinc-500">{t('settings.group_identical_casts_desc')}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, groupIdenticalCasts: !s.groupIdenticalCasts }))}
                      className={`w-10 h-5 rounded-full relative transition-colors ${settings.groupIdenticalCasts ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.groupIdenticalCasts ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                )}
                {isMatch(t('settings.fold_nodes')) && (
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                        <Layers size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">{t('settings.fold_nodes')}</div>
                        <div className="text-[10px] text-zinc-500">{t('settings.fold_nodes_desc')}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, foldNodes: !s.foldNodes }))}
                      className={`w-10 h-5 rounded-full relative transition-colors ${settings.foldNodes ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.foldNodes ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                )}
                {isMatch(t('settings.show_indices')) && (
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                        <Database size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">{t('settings.show_indices')}</div>
                        <div className="text-[10px] text-zinc-500">{t('settings.show_indices_desc')}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, showIndices: !s.showIndices }))}
                      className={`w-10 h-5 rounded-full relative transition-colors ${settings.showIndices ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.showIndices ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* SPELL TYPES & GROUPS */}
            {(searchQuery || activeCategory === 'spell_types') && (
              <div className="space-y-8">
                {/* Type Colors */}
                <div className="space-y-4">
                  <h3 className="text-[11px] font-black text-zinc-300 uppercase flex items-center gap-2">
                    <div className="w-1 h-3 rounded-full bg-amber-500" />
                    {t('settings.spell_type_colors')}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {settings.spellTypes.map(type => (
                      <div key={type.id} className="flex items-center gap-3 bg-white/5 p-2 rounded border border-white/5">
                        <input 
                          type="color" 
                          value={type.color} 
                          onChange={e => updateSpellTypeColor(type.id, e.target.value)}
                          className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer overflow-hidden p-0"
                        />
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-zinc-300">{type.name}</span>
                          <span className="text-[8px] font-mono text-zinc-500 uppercase">{type.color}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Groups Management */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-black text-zinc-300 uppercase flex items-center gap-2">
                      <div className="w-1 h-3 rounded-full bg-indigo-500" />
                      {t('settings.spell_group_management')}
                    </h3>
                    <button 
                      onClick={addGroup}
                      className="text-[9px] font-black bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded hover:bg-indigo-500/20 flex items-center gap-1"
                    >
                      <Plus size={10} /> {t('settings.add_group')}
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {settings.spellGroups.map((group, gIdx) => (
                      <div key={gIdx} className="bg-white/5 border border-white/5 rounded-lg overflow-hidden">
                        <div className="p-3 border-b border-white/5 bg-black/20 flex items-center gap-3">
                          <input 
                            value={group.name} 
                            onChange={e => updateGroupName(gIdx, e.target.value)}
                            className="bg-transparent text-xs font-bold text-zinc-200 outline-none focus:text-white flex-1"
                          />
                          <div className="flex gap-1">
                            {GROUP_COLOR_PRESETS.map(c => (
                              <button
                                key={c}
                                onClick={() => updateGroupColor(gIdx, c)}
                                className={`w-3 h-3 rounded-full bg-gradient-to-r ${c} border ${group.color === c ? 'border-white' : 'border-white/10'}`}
                              />
                            ))}
                          </div>
                          <button 
                            onClick={() => deleteGroup(gIdx)}
                            className="text-zinc-600 hover:text-red-400 transition-colors ml-1"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="p-3">
                          <div className="text-[9px] font-black text-zinc-500 uppercase mb-2 tracking-widest">{t('settings.contains_types')}:</div>
                          <div className="flex flex-wrap gap-2">
                            {settings.spellTypes.map(type => (
                              <button
                                key={type.id}
                                onClick={() => toggleTypeInGroup(gIdx, type.id)}
                                className={`
                                  px-2 py-1 rounded text-[10px] font-bold border transition-all
                                  ${group.types.includes(type.id) 
                                    ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' 
                                    : 'bg-black/20 border-white/5 text-zinc-600 hover:text-zinc-400'}
                                `}
                              >
                                {type.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SYNC */}
            {(searchQuery || activeCategory === 'sync') && (
              <div className="space-y-4">
                <h3 className="text-[11px] font-black text-zinc-300 uppercase">{t('settings.conflict_strategy')}</h3>
{['ask', 'override_game', 'new_workflow'].map(id => (
                  <button
                    key={id}
                    onClick={() => setSettings(s => ({ ...s, conflictStrategy: id as any }))}
                    className={`w-full text-left px-4 py-3 rounded border transition-all ${settings.conflictStrategy === id ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-black/20 border-white/5'}`}
                  >
                    <div className="text-[11px] font-bold text-zinc-200">
                      {id === 'ask' ? t('settings.conflict_ask') : id === 'override_game' ? t('settings.conflict_override') : t('settings.conflict_new')}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* DATA */}
            {(searchQuery || activeCategory === 'data') && (
              <div className="space-y-4">
                <h3 className="text-[11px] font-black text-zinc-300 uppercase">{t('settings.data_backup')}</h3>
                {isMatch(t('settings.export_history')) && (
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                        <Activity size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">{t('settings.export_history')}</div>
                        <div className="text-[10px] text-zinc-500">{t('settings.export_history_desc')}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, exportHistory: !s.exportHistory }))}
                      className={`w-10 h-5 rounded-full relative transition-all ${settings.exportHistory ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.exportHistory ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <label className="neo-button bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 cursor-pointer text-xs py-3 justify-center">
                    {t('settings.import_json')} <input type="file" className="hidden" onChange={onImport} />
                  </label>
                  <button onClick={onExport} className="neo-button bg-white/5 border border-white/10 text-xs py-3 justify-center">{t('settings.export_backup')}</button>
                </div>
              </div>
            )}

            {/* Empty Search Result */}
            {searchQuery && !matchedAny && (
              <div className="text-center py-20 text-zinc-600 text-xs font-black uppercase tracking-widest">
                {t('settings.no_results')}
              </div>
            )}
          </div>
        </div>
      </div>

      {showHelp && (
        <div 
          className="absolute inset-0 z-[200] bg-black/90 backdrop-blur-xl flex flex-col p-8 animate-in fade-in zoom-in-95 duration-200"
          onClick={() => setShowHelp(false)}
        >
          <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
                <HelpCircle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-widest text-white">{t('guide.title')}</h3>
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">{t('guide.subtitle')}</p>
              </div>
            </div>
            <button 
              onClick={() => setShowHelp(false)}
              className="p-2 hover:bg-white/10 rounded-full text-zinc-500 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div 
            className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-8"
            onClick={e => e.stopPropagation()}
          >
            <section className="space-y-4">
              <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                <Layers size={14} /> {t('guide.categories.basic')}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ShortcutItem keys={['Ctrl', 'C / V / X']} label={t('guide.shortcuts.copy_paste')} />
                <ShortcutItem keys={['Ctrl', 'A']} label={t('guide.shortcuts.select_all')} />
                <ShortcutItem keys={['Ctrl', 'Z / Y']} label={t('guide.shortcuts.undo_redo')} />
                <ShortcutItem keys={['Delete', 'Backspace']} label={t('guide.shortcuts.delete')} />
                <ShortcutItem keys={['Space']} label={t('guide.shortcuts.insert_slot')} />
                <ShortcutItem keys={['Delete']} label={t('guide.shortcuts.remove_slot')} />
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                <Zap size={14} /> {t('guide.categories.mouse')}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ShortcutItem keys={['L-Click']} label={t('guide.shortcuts.select_toggle')} />
                <ShortcutItem keys={['L-Drag']} label={t('guide.shortcuts.box_select')} />
                <ShortcutItem keys={['R-Drag']} label={t('guide.shortcuts.move_spells')} />
                <ShortcutItem keys={['Right Half', 'AC Zone']} label={t('guide.shortcuts.to_always_cast')} />
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                <Star size={14} /> {t('guide.categories.advanced')}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ShortcutItem keys={['Alt', 'L-Click']} label={t('guide.shortcuts.modify_uses')} />
                <ShortcutItem keys={['Hold Alt']} label={t('guide.shortcuts.show_indices')} />
                <ShortcutItem keys={['Ctrl', 'B']} label={t('guide.shortcuts.toggle_warehouse')} />
                <ShortcutItem keys={['Ctrl', 'H']} label={t('guide.shortcuts.toggle_history')} />
              </div>
            </section>

            <section className="mt-8 p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
              <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Info size={14} /> {t('guide.categories.tips')}
              </h4>
              <ul className="text-xs text-zinc-400 space-y-2 list-disc list-inside leading-relaxed">
                <li>{t('guide.tips.triggered')}</li>
                <li>{t('guide.tips.skipped')}</li>
                <li>{t('guide.tips.rounds')}</li>
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function ShortcutItem({ keys, label }: { keys: string[], label: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/5 rounded-xl hover:bg-white/[0.05] transition-colors group">
      <span className="text-xs text-zinc-400 group-hover:text-zinc-300 transition-colors">{label}</span>
      <div className="flex gap-1">
        {keys.map((k, i) => (
          <React.Fragment key={i}>
            <kbd className="px-2 py-1 bg-zinc-800 border-b-2 border-zinc-950 rounded text-[10px] font-mono font-bold text-zinc-200">
              {k}
            </kbd>
            {i < keys.length - 1 && <span className="text-zinc-600 text-[10px] self-center">+</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
