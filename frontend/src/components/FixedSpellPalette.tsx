import React from 'react';
import { Grip, Minus, Plus, Search, X } from 'lucide-react';
import { AppSettings, SpellArea, SpellInfo, SpellStats, WandData } from '../types';
import { getIconUrl } from '../lib/evaluatorAdapter';
import { useUIStore } from '../store/useUIStore';
import { useTranslation } from 'react-i18next';
import { searchSpells } from '../hooks/useSpellSearch';
import { moveDragPreview } from '../lib/dragPreviewMotion';
import { DEFAULT_SPELL_GROUPS } from '../constants';

interface FixedSpellPaletteProps {
  spellDb: Record<string, SpellInfo>;
  spellStats: SpellStats;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  setMousePos: (pos: { x: number; y: number }) => void;
  handleSlotMouseUp: (slot: string, idx: number, area?: SpellArea) => void;
  updateWand: (slot: string, updates: Partial<WandData> | ((curr: WandData) => Partial<WandData>), actionName?: string, icons?: string[]) => void;
  isConnected: boolean;
}

export function FixedSpellPalette({
  spellDb,
  spellStats,
  settings,
  setSettings,
  setMousePos,
  handleSlotMouseUp,
  updateWand,
  isConnected,
}: FixedSpellPaletteProps) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = React.useState('');
  const contentRef = React.useRef<HTMLDivElement>(null);
  const paletteRef = React.useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = React.useState(0);
  const setDragSource = useUIStore(s => s.setDragSource);
  const setHoveredSlot = useUIStore(s => s.setHoveredSlot);
  const resolveHoveredSlotAtPoint = useUIStore(s => s.resolveHoveredSlotAtPoint);

  const iconSize = settings.pinnedSpellPaletteIconSize || 32;
  const manualWrapLimit = settings.pinnedSpellPaletteWrapLimit || 24;
  const autoFillRows = settings.pinnedSpellPaletteAutoFillRows || 0;
  const iconGap = 6;
  const cellStep = iconSize + iconGap;
  const autoFillAvailableWidth = Math.max(0, (contentWidth || manualWrapLimit * cellStep) - 24);
  const autoFillCols = Math.max(1, Math.min(500, Math.floor((autoFillAvailableWidth + iconGap) / cellStep)));
  const wrapLimit = autoFillRows > 0 ? autoFillCols : manualWrapLimit;
  const collapsedSpellLimit = autoFillRows > 0 ? autoFillCols * autoFillRows : manualWrapLimit;
  const hideLabels = !!settings.pinnedSpellPaletteHideLabels;
  const expandedGroups = React.useMemo(
    () => new Set(settings.pinnedSpellPaletteExpandedGroups ?? [-1]),
    [settings.pinnedSpellPaletteExpandedGroups]
  );
  const isEnglish = i18n.language.startsWith('en');

  const translateSpellGroup = (name: string) => {
    const defaultIdx = DEFAULT_SPELL_GROUPS.findIndex(group => group.name === name);
    if (defaultIdx === -1) return name;
    const keys = [
      'settings.spell_groups_list.projectile',
      'settings.spell_groups_list.modifier',
      'settings.spell_groups_list.utility_multicast_other',
      'settings.spell_groups_list.static_material_passive',
    ];
    return t(keys[defaultIdx]);
  };

  const searchResults = React.useMemo(() => {
    return search ? searchSpells(spellDb, search, i18n.language) : [];
  }, [i18n.language, search, spellDb]);

  React.useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const updateWidth = () => setContentWidth(el.clientWidth);
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    if (!settings.pinnedSpellPaletteDeleteOnDrop) return;

    const isWithinPalette = (clientX: number, clientY: number) => {
      const rect = paletteRef.current?.getBoundingClientRect();
      return !!rect && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    };

    const handlePointerUp = (event: PointerEvent) => {
      const dragSource = useUIStore.getState().dragSource;
      if (!dragSource || dragSource.source !== 'wand_slot') return;
      if (!isWithinPalette(event.clientX, event.clientY)) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }

      if (dragSource.area === 'always_cast') {
        updateWand(dragSource.wandSlot, (curr) => {
          const nextAlwaysCast = [...(curr.always_cast || [])];
          while (nextAlwaysCast.length < dragSource.idx) nextAlwaysCast.push('');
          nextAlwaysCast[dragSource.idx - 1] = '';
          return { always_cast: nextAlwaysCast };
        }, t('app.notification.delete_spell'), [dragSource.sid]);
      } else {
        updateWand(dragSource.wandSlot, (curr) => {
          const nextSpells = { ...(curr.spells || {}) };
          const nextUses = { ...(curr.spell_uses || {}) };
          delete nextSpells[dragSource.idx.toString()];
          delete nextUses[dragSource.idx.toString()];
          return { spells: nextSpells, spell_uses: nextUses };
        }, t('app.notification.delete_spell'), [dragSource.sid]);
      }

      setHoveredSlot(null);
      setDragSource(null);
    };

    window.addEventListener('pointerup', handlePointerUp, true);
    return () => window.removeEventListener('pointerup', handlePointerUp, true);
  }, [settings.pinnedSpellPaletteDeleteOnDrop, setDragSource, setHoveredSlot, t, updateWand]);

  const setNumberSetting = (key: 'pinnedSpellPaletteIconSize' | 'pinnedSpellPaletteRows' | 'pinnedSpellPaletteWrapLimit', value: number, min: number, max: number) => {
    setSettings(prev => ({
      ...prev,
      [key]: Math.max(min, Math.min(max, value)),
    }));
  };

  const startDrag = (spellId: string, e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const scale = (settings.uiScale || 100) / 100;
    const point = { x: e.clientX / scale, y: e.clientY / scale };
    setMousePos(point);
    moveDragPreview(point);
    setHoveredSlot(null);
    setDragSource({
      source: 'palette',
      wandSlot: '',
      area: 'main',
      idx: -1,
      sid: spellId,
    });
  };

  const updatePaletteDragPoint = (e: React.PointerEvent<HTMLButtonElement>) => {
    const dragSource = useUIStore.getState().dragSource;
    if (!dragSource || dragSource.source !== 'palette') return;
    const scale = (settings.uiScale || 100) / 100;
    moveDragPreview({ x: e.clientX / scale, y: e.clientY / scale });
    setHoveredSlot(resolveHoveredSlotAtPoint(e.clientX, e.clientY));
  };

  const finishPaletteDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const dragSource = useUIStore.getState().dragSource;
    if (!dragSource || dragSource.source !== 'palette') return;
    e.preventDefault();
    e.stopPropagation();

    const hit = resolveHoveredSlotAtPoint(e.clientX, e.clientY);
    if (hit) {
      setHoveredSlot(hit);
      handleSlotMouseUp(hit.wandSlot, hit.idx, hit.area);
    } else {
      setHoveredSlot(null);
      setDragSource(null);
    }
  };

  const renderSpellButton = (spell: SpellInfo) => {
    const typeConfig = settings.spellTypes.find(type => type.id === spell.type);
    const displayName = isEnglish && spell.en_name ? spell.en_name : spell.name;
    const aliases = spell.aliases ? ` (${spell.aliases})` : '';
    return (
      <button
        key={spell.id}
        type="button"
        title={`${displayName}${aliases}\nID: ${spell.id}`}
        data-spell-id={spell.id}
        className="group/palette-spell flex shrink-0 items-center justify-center rounded border border-white/5 transition-all hover:border-indigo-400/50 hover:brightness-125 active:scale-95 cursor-grab active:cursor-grabbing"
        style={{
          width: iconSize,
          height: iconSize,
          backgroundColor: typeConfig?.color || 'rgba(255,255,255,0.06)',
          touchAction: 'none',
        }}
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerDown={e => {
          if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
          startDrag(spell.id, e);
        }}
        onPointerMove={e => {
          updatePaletteDragPoint(e);
        }}
        onPointerUp={finishPaletteDrag}
        onPointerCancel={finishPaletteDrag}
        onContextMenu={e => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <img
          src={getIconUrl(spell.icon, isConnected)}
          className="image-pixelated transition-transform group-hover/palette-spell:scale-110"
          style={{ width: Math.max(18, iconSize - 8), height: Math.max(18, iconSize - 8) }}
          alt=""
          draggable={false}
        />
      </button>
    );
  };

  const renderGroup = (label: string, spells: SpellInfo[], groupIdx: number) => {
    if (!spells.length) return null;
    const isExpanded = autoFillRows <= 0 && expandedGroups.has(groupIdx);
    const visibleSpells = spells.slice(0, isExpanded ? spells.length : Math.max(1, collapsedSpellLimit));
    return (
      <section key={groupIdx} className="space-y-2">
        <div className={`flex items-center justify-between gap-3 ${hideLabels ? 'h-6 justify-end' : ''}`}>
          {!hideLabels && (
            <div className="flex min-w-0 items-center gap-2">
              <div className="h-px w-8 bg-white/10" />
              <span className="truncate text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</span>
            </div>
          )}
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            onClick={() => {
              setSettings(prev => {
                const next = new Set(prev.pinnedSpellPaletteExpandedGroups ?? [-1]);
                if (next.has(groupIdx)) next.delete(groupIdx);
                else next.add(groupIdx);
                return { ...prev, pinnedSpellPaletteExpandedGroups: Array.from(next).sort((a, b) => a - b) };
              });
            }}
          >
            {isExpanded ? <Minus size={13} /> : <Plus size={13} />}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5" style={{ maxWidth: wrapLimit * (iconSize + 6) }}>
          {visibleSpells.map(renderSpellButton)}
        </div>
      </section>
    );
  };

  return (
    <div ref={paletteRef} className={`export-ignore rounded-lg border bg-zinc-950/70 shadow-inner backdrop-blur transition-colors ${settings.pinnedSpellPaletteDeleteOnDrop ? 'border-emerald-500/20' : 'border-white/10'}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-black/20 p-2">
        <Grip size={14} className="text-indigo-400" />
        <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded border border-white/5 bg-black/20 px-2 py-1.5 focus-within:border-indigo-500/50">
          <Search size={13} className="text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('spell_picker.search_placeholder')}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-zinc-600"
          />
          {search && (
            <button type="button" className="text-zinc-500 hover:text-white" onClick={() => setSearch('')}>
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
          <span>{t('spell_picker.fixed_palette.size')}</span>
          <input
            type="number"
            min={24}
            max={64}
            step={4}
            value={iconSize}
            onChange={e => setNumberSetting('pinnedSpellPaletteIconSize', parseInt(e.target.value, 10) || 32, 24, 64)}
            className="h-7 w-12 rounded border border-white/10 bg-black/20 px-1 text-center text-xs text-zinc-200 outline-none"
          />
          <span>{t('spell_picker.fixed_palette.cols')}</span>
          <input
            type="number"
            min={6}
            max={500}
            value={manualWrapLimit}
            onChange={e => setSettings(prev => ({
              ...prev,
              pinnedSpellPaletteAutoFillRows: 0,
              pinnedSpellPaletteWrapLimit: Math.max(6, Math.min(500, parseInt(e.target.value, 10) || 24)),
            }))}
            className="h-7 w-12 rounded border border-white/10 bg-black/20 px-1 text-center text-xs text-zinc-200 outline-none"
          />
          <button
            type="button"
            className={`h-7 rounded border px-2 transition-colors ${autoFillRows > 0 ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200' : 'border-white/10 bg-black/20 text-zinc-500 hover:bg-white/5 hover:text-zinc-200'}`}
            onClick={() => setSettings(prev => ({ ...prev, pinnedSpellPaletteAutoFillRows: prev.pinnedSpellPaletteAutoFillRows ? 0 : 1 }))}
            title={t('spell_picker.fixed_palette.auto_fill_title')}
          >
            {t('spell_picker.fixed_palette.auto_fill')}
          </button>
          <input
            type="number"
            min={1}
            max={20}
            value={autoFillRows || 1}
            onChange={e => setSettings(prev => ({
              ...prev,
              pinnedSpellPaletteAutoFillRows: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)),
            }))}
            className={`h-7 w-10 rounded border px-1 text-center text-xs outline-none ${autoFillRows > 0 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-black/20 text-zinc-500'}`}
            title={t('spell_picker.fixed_palette.auto_fill_rows')}
          />
        </div>

        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded bg-white/5 text-zinc-400 hover:bg-red-500/20 hover:text-red-300"
          onClick={() => setSettings(prev => ({ ...prev, pinnedSpellPaletteOpen: false, pinnedSpellPaletteWandSlot: '' }))}
          title={t('spell_picker.fixed_palette.close')}
        >
          <X size={14} />
        </button>
      </div>

      <div ref={contentRef} className="p-3">
        {search ? (
          searchResults.length ? (
            <div className="flex flex-wrap gap-1.5" style={{ maxWidth: wrapLimit * (iconSize + 6) }}>
              {searchResults.map(renderSpellButton)}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-zinc-600">{t('spell_picker.no_results')}</div>
          )
        ) : (
          <div className="space-y-4">
            {renderGroup(t('spell_picker.common_spells_global'), spellStats.overall, -1)}
            {settings.spellGroups.map((group, idx) =>
              renderGroup(translateSpellGroup(group.name), spellStats.categories[idx] || [], idx)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
