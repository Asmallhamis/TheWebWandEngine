import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, ChevronDown, ChevronUp, Package, Box, Filter, AlertCircle, CheckCircle2, LayoutGrid, List, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { checkPinyinFuzzy } from '../lib/searchUtils';
import { getActiveModBundle, saveModBundle, ModBundle } from '../lib/modStorage';
import { SpellInfo } from '../types';
import { getIconUrl } from '../lib/evaluatorAdapter';

interface ModManagerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  onReloadSpells?: () => Promise<void | boolean>;
  onModBundleChange?: () => void;
  onOpenSettings?: () => void;
}

type ViewMode = 'compact' | 'detailed';

type ModEntry = {
  id: string;
  added: SpellInfo[];
  modified: SpellInfo[];
  hasAppend: boolean;
};

const getModIdFromPath = (path: string) => {
  if (!path || !path.startsWith('mods/')) return null;
  const parts = path.split('/');
  return parts.length > 1 ? parts[1] : null;
};

const matchSpell = (spell: SpellInfo, query: string, isEnglish: boolean) => {
  if (!query) return true;
  const q = query.toLowerCase();
  const displayName = (isEnglish && spell.en_name ? spell.en_name : spell.name || '').toLowerCase();
  if (displayName.includes(q)) return true;
  if ((spell.id || '').toLowerCase().includes(q)) return true;
  if ((spell.aliases || '').toLowerCase().includes(q)) return true;
  if (!isEnglish) {
    if ((spell.pinyin || '').toLowerCase().includes(q)) return true;
    if (checkPinyinFuzzy(q, (spell.pinyin || '').toLowerCase(), (spell.pinyin_initials || '').toLowerCase())) return true;
    if (checkPinyinFuzzy(q, (spell.alias_pinyin || '').toLowerCase(), (spell.alias_initials || '').toLowerCase())) return true;
  }
  return false;
};

export function ModManagerPanel({
  isOpen,
  onClose,
  isConnected,
  onReloadSpells,
  onModBundleChange,
  onOpenSettings
}: ModManagerPanelProps) {
  const { t, i18n } = useTranslation();
  const [bundle, setBundle] = useState<ModBundle | null>(null);
  const [baseDb, setBaseDb] = useState<Record<string, SpellInfo>>({});
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('detailed');
  const [expandedMods, setExpandedMods] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    const loadBundle = async () => {
      const activeBundle = await getActiveModBundle();
      setBundle(activeBundle);
    };
    loadBundle();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const loadBase = async () => {
      try {
        if (isConnected) {
          const res = await fetch('/api/fetch-spells-base');
          const data = await res.json();
          if (data.success && data.spells) {
            const enriched: Record<string, SpellInfo> = {};
            Object.entries(data.spells as Record<string, any>).forEach(([id, info]) => {
              enriched[id] = { ...info, id };
            });
            setBaseDb(enriched);
            return;
          }
        }
      } catch (e) {
        console.log('API fetch-spells-base failed, trying static...');
      }

      try {
        const res = await fetch('./static_data/spells.json');
        const data = await res.json();
        setBaseDb(data || {});
      } catch (e) {
        setBaseDb({});
      }
    };
    loadBase();
  }, [isOpen, isConnected]);

  const updateActiveMods = async (nextActive: string[]) => {
    if (!bundle) return;
    const updated: ModBundle = {
      ...bundle,
      active_mods: nextActive,
      all_mods: bundle.all_mods || bundle.active_mods,
      vfs_meta: bundle.vfs_meta || {}
    };
    await saveModBundle(updated);
    setBundle(updated);
    onReloadSpells?.();
    onModBundleChange?.();
  };

  const toggleMod = async (modId: string) => {
    if (!bundle) return;
    const activeSet = new Set(bundle.active_mods || []);
    if (activeSet.has(modId)) activeSet.delete(modId);
    else activeSet.add(modId);
    await updateActiveMods(Array.from(activeSet));
  };

  const enableAll = async (mods: string[]) => updateActiveMods(mods);
  const disableAll = async () => updateActiveMods([]);

  const modEntries = useMemo(() => {
    if (!bundle) return { visible: [] as ModEntry[], hidden: [] as string[] };
    const modList = (bundle.all_mods && bundle.all_mods.length > 0)
      ? bundle.all_mods
      : (bundle.active_mods || []);

    const modSpells = Object.entries(bundle.spells || {}).reduce((acc, [id, info]) => {
      const modId = (info as SpellInfo).mod_id;
      if (!modId) return acc;
      if (!acc[modId]) acc[modId] = [];
      // 预处理：确保 icon 优先使用 base64，提高在环境包模式下的显示成功率
      const spellWithIcon = {
        ...(info as SpellInfo),
        id,
        icon: (info as any).icon_base64 || (info as SpellInfo).icon
      };
      acc[modId].push(spellWithIcon);
      return acc;
    }, {} as Record<string, SpellInfo[]>);

    const modsWithAppends = new Set<string>();
    Object.keys(bundle.appends || {}).forEach(path => {
      const modId = getModIdFromPath(path);
      if (modId) modsWithAppends.add(modId);
    });

    const entries: ModEntry[] = [];
    const hidden: string[] = [];

    modList.forEach(modId => {
      const spells = modSpells[modId] || [];
      const added: SpellInfo[] = [];
      const modified: SpellInfo[] = [];
      spells.forEach(spell => {
        if (baseDb && baseDb[spell.id]) modified.push(spell);
        else added.push(spell);
      });
      const hasAppend = modsWithAppends.has(modId);
      if (added.length === 0 && modified.length === 0 && !hasAppend) {
        hidden.push(modId);
        return;
      }
      entries.push({ id: modId, added, modified, hasAppend });
    });

    return { visible: entries, hidden };
  }, [bundle, baseDb]);

  const filteredEntries = useMemo(() => {
    if (!bundle) return [] as (ModEntry & { _hasSearchMatch: boolean })[];
    const q = query.trim().toLowerCase();
    const isEnglish = i18n.language.startsWith('en');

    const results = modEntries.visible
      .map(entry => {
        const modMatch = !q || entry.id.toLowerCase().includes(q);
        const addedMatches = q && !modMatch
          ? entry.added.filter(spell => matchSpell(spell, q, isEnglish))
          : entry.added;
        const modifiedMatches = q && !modMatch
          ? entry.modified.filter(spell => matchSpell(spell, q, isEnglish))
          : entry.modified;

        const hasMatch = modMatch || addedMatches.length > 0 || modifiedMatches.length > 0;
        if (!hasMatch) return null;

        return {
          ...entry,
          added: addedMatches,
          modified: modifiedMatches,
          _hasSearchMatch: !!q && (addedMatches.length > 0 || modifiedMatches.length > 0)
        } as ModEntry & { _hasSearchMatch: boolean };
      })
      .filter(Boolean) as (ModEntry & { _hasSearchMatch: boolean })[];

    // Auto-expand mods with search matches
    if (q) {
      const matches = results.filter(r => r._hasSearchMatch).map(r => r.id);
      if (matches.length > 0) {
        setExpandedMods(prev => {
          const next = new Set(prev);
          matches.forEach(m => next.add(m));
          return next;
        });
      }
    }

    return results;
  }, [bundle, modEntries, query, i18n.language]);

  const activeSet = new Set(bundle?.active_mods || []);
  const visibleMods = modEntries.visible;
  const activeImpactfulCount = visibleMods.filter(m => activeSet.has(m.id)).length;

  if (!isOpen) return null;

  const SpellGrid = ({ spells, type }: { spells: SpellInfo[], type: 'added' | 'modified' }) => {
    if (spells.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${type === 'added' ? 'text-emerald-400' : 'text-amber-400'}`}>
          <div className={`w-1 h-1 rounded-full ${type === 'added' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {type === 'added' ? t('mod_manager.added_spells') : t('mod_manager.modified_spells')}
          <span className="opacity-40 font-normal ml-auto">{spells.length}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {spells.map(spell => (
            <div
              key={spell.id}
              className="relative group/spell"
              title={`${spell.name || spell.id}\nID: ${spell.id}${spell.en_name ? `\nEN: ${spell.en_name}` : ''}`}
            >
              <div className={`w-8 h-8 rounded border border-white/5 bg-black/40 flex items-center justify-center p-0.5 group-hover/spell:border-white/20 transition-colors`}>
                <img
                  src={getIconUrl(spell.icon, isConnected)}
                  className="w-full h-full image-pixelated"
                  alt={spell.name}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8" onClick={onClose}>
      <div
        className="glass-card bg-[#0a0a0c] border-white/10 w-full max-w-5xl h-full flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Package size={20} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-zinc-100 uppercase">{t('mod_manager.title')}</h2>
              <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">
                {visibleMods.length
                  ? t('mod_manager.impactful_enabled', { active: activeImpactfulCount, total: visibleMods.length })
                  : t('mod_manager.no_impactful_mods')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex p-1 bg-white/5 rounded-lg border border-white/5">
              <button
                onClick={() => setViewMode('compact')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'compact' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                title={t('mod_manager.view_compact')}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode('detailed')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'detailed' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                title={t('mod_manager.view_detailed')}
              >
                <List size={16} />
              </button>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 text-zinc-500 hover:text-white transition-all">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-white/5 flex flex-wrap items-center gap-4 bg-black/20">
          <div className="relative flex-1 min-w-[300px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('mod_manager.search_placeholder')}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.08] transition-all placeholder:text-zinc-600 font-medium"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => enableAll(visibleMods.map(m => m.id))}
              className="px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all text-xs font-black tracking-widest uppercase"
            >
              {t('mod_manager.enable_all')}
            </button>
            <button
              onClick={disableAll}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-400 border border-white/5 hover:bg-zinc-700 transition-all text-xs font-black tracking-widest uppercase"
            >
              {t('mod_manager.disable_all')}
            </button>
          </div>
        </div>

        {/* Mod List */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 custom-scrollbar bg-black/40">
          {!bundle && (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-600 gap-4">
              <Box size={48} strokeWidth={1} />
              <p className="text-sm font-medium tracking-wide">{t('mod_manager.no_bundle')}</p>
            </div>
          )}

          {bundle && filteredEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-600 gap-4">
              <Filter size={48} strokeWidth={1} />
              <p className="text-sm font-medium tracking-wide">{t('mod_manager.no_results')}</p>
            </div>
          )}

          {bundle && filteredEntries.map(entry => {
            const isActive = activeSet.has(entry.id);
            const isExpanded = expandedMods.has(entry.id) || viewMode === 'detailed';

            return (
              <div
                key={entry.id}
                className={`group border transition-all duration-300 rounded-2xl overflow-hidden ${isActive
                  ? 'bg-amber-500/[0.03] border-amber-500/20 shadow-[0_4px_20px_rgba(245,158,11,0.05)]'
                  : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                  }`}
              >
                {/* Mod Header */}
                <div
                  className={`px-5 py-4 flex items-center gap-4 cursor-pointer transition-colors ${isExpanded ? 'bg-white/[0.02]' : 'hover:bg-white/[0.04]'}`}
                  onClick={() => {
                    setExpandedMods(prev => {
                      const next = new Set(prev);
                      if (next.has(entry.id)) next.delete(entry.id);
                      else next.add(entry.id);
                      return next;
                    });
                  }}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 transition-all ${isActive ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/5 border-white/5'
                    }`}>
                    {/* Placeholder for Mod Icon */}
                    <Box size={24} className={isActive ? 'text-amber-400' : 'text-zinc-600'} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-black text-sm truncate uppercase tracking-tight ${isActive ? 'text-amber-100' : 'text-zinc-300'}`}>
                        {entry.id}
                      </h3>
                      {entry.hasAppend && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[8px] font-black uppercase tracking-widest border border-purple-500/20">
                          {t('mod_manager.logic_tag')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${entry.added.length > 0 ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
                          {t('mod_manager.added_count', { count: entry.added.length })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${entry.modified.length > 0 ? 'bg-amber-500' : 'bg-zinc-700'}`} />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
                          {t('mod_manager.modified_count', { count: entry.modified.length })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Compact Preview of Icons */}
                  {!isExpanded && viewMode === 'compact' && (
                    <div className="hidden md:flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity pr-4">
                      {[...entry.added, ...entry.modified].slice(0, 8).map((s, i) => (
                        <img
                          key={i}
                          src={getIconUrl(s.icon, isConnected)}
                          className="w-5 h-5 image-pixelated grayscale"
                          alt=""
                        />
                      ))}
                      {(entry.added.length + entry.modified.length) > 8 && (
                        <span className="text-[9px] text-zinc-600 font-black ml-1">+{(entry.added.length + entry.modified.length) - 8}</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMod(entry.id);
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isActive
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-white/5 text-zinc-500 border border-white/10 hover:border-white/20 hover:text-zinc-300'
                        }`}
                    >
                      {isActive ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                      {isActive ? t('mod_manager.status_enabled') : t('mod_manager.status_disabled')}
                    </button>
                    {viewMode === 'compact' && (
                      <ChevronDown size={18} className={`text-zinc-600 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                </div>

                {/* Mod Details */}
                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 border-t border-white/[0.03] bg-black/20 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <SpellGrid spells={entry.added} type="added" />
                      <SpellGrid spells={entry.modified} type="modified" />
                    </div>

                    {entry.added.length === 0 && entry.modified.length === 0 && entry.hasAppend && (
                      <div className="py-4 text-center">
                        <p className="text-[10px] text-zinc-600 italic">{t('mod_manager.only_appends')}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {modEntries.hidden.length > 0 && (
            <div className="pt-4 pb-8 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/5">
                <Info size={12} className="text-zinc-500" />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  {t('mod_manager.hidden_count', { count: modEntries.hidden.length })}
                </span>
                <button
                  onClick={onOpenSettings}
                  className="text-amber-500/80 hover:text-amber-400 ml-1 underline decoration-amber-500/20 underline-offset-4"
                >
                  {t('mod_manager.open_settings')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 border-t border-white/5 bg-white/[0.01] flex justify-between items-center">
          <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.2em]">
            {t('mod_manager.tip_reload')}
          </p>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{t('mod_manager.added_label')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{t('mod_manager.modified_label')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{t('mod_manager.logic_label')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
