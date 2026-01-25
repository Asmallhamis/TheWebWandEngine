import React, { useState } from 'react';
import { 
  Settings, X, Zap, Info, Download, Upload, 
  Search, Wand2, Activity, Layers, Database, Star
} from 'lucide-react';
import { Plus, Trash2, Edit2, GripVertical } from 'lucide-react';
import { AppSettings, WandData, SpellTypeConfig, SpellGroupConfig } from '../types';
import { SPELL_GROUPS } from '../constants';

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
      spellGroups: [...prev.spellGroups, { name: '新分组', types: [] }]
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
    { id: 'general', name: '常规', icon: <Settings size={16} /> },
    { id: 'appearance', name: '外观', icon: <Layers size={16} /> },
    { id: 'wand', name: '法杖', icon: <Wand2 size={16} /> },
    { id: 'cast', name: '施法参数', icon: <Zap size={16} /> },
    { id: 'spell_types', name: '法术分类', icon: <Star size={16} /> },
    { id: 'sync', name: '同步', icon: <Activity size={16} /> },
    { id: 'data', name: '数据', icon: <Database size={16} /> },
  ];

  // --- Search Logic ---
  const isMatch = (text: string) => {
    if (!searchQuery) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
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
            <h2 className="text-[10px] font-black tracking-widest uppercase text-indigo-500">Settings</h2>
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
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 border-b border-white/5 flex items-center gap-4 bg-black/20">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
              <input 
                type="text"
                placeholder="搜索设置项..."
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
                {isMatch('常用统计数量') && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">常用统计数量</label>
                    <div className="flex items-center gap-4">
                      <input type="range" min="0" max="50" value={settings.commonLimit} onChange={e => setSettings(s => ({ ...s, commonLimit: parseInt(e.target.value) || 0 }))} className="flex-1 accent-indigo-500" />
                      <span className="text-xs font-mono font-bold text-indigo-400 w-8">{settings.commonLimit}</span>
                    </div>
                  </div>
                )}
                {isMatch('分类预览数量') && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">分类预览数量</label>
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
                {isMatch('显示上限') && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">每行显示数量上限 ({settings.wrapLimit})</label>
                    <input type="range" min="5" max="40" value={settings.wrapLimit} onChange={e => setSettings(s => ({ ...s, wrapLimit: parseInt(e.target.value) || 20 }))} className="w-full accent-indigo-500" />
                  </div>
                )}
                {isMatch('行高') && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">选择器行高 ({settings.pickerRowHeight}px)</label>
                    <input type="range" min="24" max="64" step="4" value={settings.pickerRowHeight} onChange={e => setSettings(s => ({ ...s, pickerRowHeight: parseInt(e.target.value) || 32 }))} className="w-full accent-amber-500" />
                  </div>
                )}
                {isMatch('法术位间距') && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">法术位间距 ({settings.editorSpellGap}px)</label>
                    <div className="flex items-center gap-4">
                      <input type="range" min="0" max="20" step="2" value={settings.editorSpellGap} onChange={e => setSettings(s => ({ ...s, editorSpellGap: parseInt(e.target.value) || 0 }))} className="flex-1 accent-indigo-500" />
                      <span className="text-xs font-mono font-bold text-indigo-400 w-8">{settings.editorSpellGap}</span>
                    </div>
                  </div>
                )}
                {isMatch('隐藏标签') && (
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-500/10 rounded-lg text-zinc-400">
                        <Layers size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">隐藏选择器分组标签</div>
                        <div className="text-[10px] text-zinc-500">隐藏法术选择器中的“常用统计”及各分类名称，使界面更紧凑。</div>
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
                {isMatch('以帧为单位显示时间') && (
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                        <Activity size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">以帧为单位显示时间 (Frames)</div>
                        <div className="text-[10px] text-zinc-500">在界面中以帧 (1/60s) 而非秒为单位显示射击延迟和装填时间。</div>
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
                {isMatch('显示Wand模板复制按钮') && (
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                        <Wand2 size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">显示Wand模板复制按钮 (Legacy)</div>
                        <div className="text-[10px] text-zinc-500">在法杖卡片上显示一个 “W” 按钮，用于复制为 Wiki 上的老版 {"{{Wand}}"} 模板格式。</div>
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
                {isMatch('新增法杖默认属性') && (
                  <div className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-lg">
                    <h3 className="text-[11px] font-black text-indigo-400 uppercase mb-4 flex items-center gap-2">默认数值模板</h3>
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
                {isMatch('无限法术天赋') && (
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                        <Star size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">无限法术天赋 (Unlimited Spells)</div>
                        <div className="text-[10px] text-zinc-500">模拟拥有“无限法术”天赋的情况。注意：黑洞、治疗弹等法术依然有限。</div>
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
                {isMatch('显示法术次数') && (
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                        <Database size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">显示法术次数 (Charges)</div>
                        <div className="text-[10px] text-zinc-500">在编辑器中显示法术无 无限法术 天赋时的使用次数。设定为 0 的法术始终显示。(这就只是个次数显示选项,实际上评估模拟并不会计算次数扣除,对模拟来说只有无限次和0次)</div>
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
                {isMatch('评估模拟轮数') && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">评估模拟轮数 (Casts)</label>
                    <div className="text-[10px] text-zinc-500 mb-2 italic">默认模拟多次按鼠标的行为，由于蓝量消耗，每一轮结果可能不同。</div>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="1" 
                        max="50" 
                        value={settings.numCasts || 10} 
                        onChange={e => setSettings(s => ({ ...s, numCasts: parseInt(e.target.value) || 10 }))} 
                        className="flex-1 accent-blue-500" 
                      />
                      <span className="text-xs font-mono font-bold text-blue-400 w-8">{settings.numCasts || 10}</span>
                    </div>
                  </div>
                )}
                {isMatch('自动隐藏大型树形图') && (
                  <div className="space-y-2 text-zinc-400">
                    <label className="text-[10px] font-black uppercase tracking-widest">大型树形图自动隐藏阈值</label>
                    <div className="text-[10px] text-zinc-500 mb-2 italic">如果第一轮 Cast 的复杂度超过此节点数，后续 Cast 将默认折叠。</div>
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
                {isMatch('合并重复施法') && (
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                        <Layers size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">合并重复施法 (Group Identical Casts)</div>
                        <div className="text-[10px] text-zinc-500">如果连续多轮施法的结果完全一致，则自动合并为一个分组显示。</div>
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
              </div>
            )}

            {/* SPELL TYPES & GROUPS */}
            {(searchQuery || activeCategory === 'spell_types') && (
              <div className="space-y-8">
                {/* Type Colors */}
                <div className="space-y-4">
                  <h3 className="text-[11px] font-black text-zinc-300 uppercase flex items-center gap-2">
                    <div className="w-1 h-3 rounded-full bg-amber-500" />
                    法术类型颜色
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
                      法术分组管理
                    </h3>
                    <button 
                      onClick={addGroup}
                      className="text-[9px] font-black bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded hover:bg-indigo-500/20 flex items-center gap-1"
                    >
                      <Plus size={10} /> 添加分组
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
                          <div className="text-[9px] font-black text-zinc-500 uppercase mb-2 tracking-widest">包含类型:</div>
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
                <h3 className="text-[11px] font-black text-zinc-300 uppercase">冲突处理策略</h3>
                {['ask', 'override_game', 'new_workflow'].map(id => (
                  <button
                    key={id}
                    onClick={() => setSettings(s => ({ ...s, conflictStrategy: id as any }))}
                    className={`w-full text-left px-4 py-3 rounded border transition-all ${settings.conflictStrategy === id ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-black/20 border-white/5'}`}
                  >
                    <div className="text-[11px] font-bold text-zinc-200">{id === 'ask' ? '询问我' : id === 'override_game' ? '网页优先' : '另存新工作流'}</div>
                  </button>
                ))}
              </div>
            )}

            {/* DATA */}
            {(searchQuery || activeCategory === 'data') && (
              <div className="space-y-4">
                <h3 className="text-[11px] font-black text-zinc-300 uppercase">数据备份</h3>
                {isMatch('导出工作流时包含历史记录') && (
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                        <Activity size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">导出包含历史记录</div>
                        <div className="text-[10px] text-zinc-500">导出数据时同时保存工作流的撤销/重做历史记录。</div>
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
                    导入 JSON <input type="file" className="hidden" onChange={onImport} />
                  </label>
                  <button onClick={onExport} className="neo-button bg-white/5 border border-white/10 text-xs py-3 justify-center">导出备份</button>
                </div>
              </div>
            )}

            {/* Empty Search Result */}
            {searchQuery && !isMatch('常用统计数量') && !isMatch('分类预览数量') && !isMatch('显示上限') && !isMatch('行高') && !isMatch('新增法杖默认属性') && !isMatch('无限法术天赋') && !isMatch('显示法术次数') && !isMatch('评估模拟轮数') && !isMatch('自动隐藏大型树形图') && (
              <div className="text-center py-20 text-zinc-600 text-xs font-black uppercase tracking-widest">
                未找到匹配的设置
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
