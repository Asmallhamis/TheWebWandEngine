import React, { useState } from 'react';
import { 
  Settings, X, Zap, Info, Download, Upload, 
  Search, Wand2, Activity, Layers, Database, Star
} from 'lucide-react';
import { AppSettings, WandData } from '../types';
import { SPELL_GROUPS } from '../constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
}

type Category = 'general' | 'appearance' | 'wand' | 'cast' | 'sync' | 'data';

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

  const categories = [
    { id: 'general', name: '常规', icon: <Settings size={16} /> },
    { id: 'appearance', name: '外观', icon: <Layers size={16} /> },
    { id: 'wand', name: '法杖', icon: <Wand2 size={16} /> },
    { id: 'cast', name: '施法参数', icon: <Zap size={16} /> },
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
              </div>
            )}

            {/* WAND SETTINGS */}
            {(searchQuery || activeCategory === 'wand') && (
              <div className="space-y-6">
                {isMatch('新增法杖默认属性') && (
                  <div className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-lg">
                    <h3 className="text-[11px] font-black text-indigo-400 uppercase mb-4 flex items-center gap-2">默认数值模板</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {(['mana_max', 'mana_charge_speed', 'deck_capacity', 'fire_rate_wait'] as const).map(key => (
                        <div key={key} className="space-y-1">
                          <label className="text-[9px] font-bold text-zinc-500 uppercase">{key.replace(/_/g, ' ')}</label>
                          <input 
                            type="number" 
                            value={(defaultWandStats[key] as number | undefined) ?? ''} 
                            onChange={e => updateDefaultWand(key, parseFloat(e.target.value) || 0)}
                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs font-mono text-indigo-300 outline-none focus:border-indigo-500/50" 
                          />
                        </div>
                      ))}
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
                        <div className="text-[10px] text-zinc-500">在编辑器中显示法术的剩余使用次数。设定为 0 的法术始终显示。</div>
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
