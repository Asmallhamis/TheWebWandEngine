import React, { useState, useEffect } from 'react';
import { Search, Star, Minimize2, Plus, Pin } from 'lucide-react';
import { SpellInfo, AppSettings, SpellTypeConfig } from '../types';
import { SPELL_GROUPS } from '../constants';
import { getIconUrl } from '../lib/evaluatorAdapter';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../store/useUIStore';

const splitAliases = (aliases?: string) => (aliases || '').split(/\s+/).filter(Boolean);

const getTooltipAliases = (spell: SpellInfo, isEnglish: boolean) => {
  const parts = splitAliases(spell.aliases);
  if (!parts.length) return '';
  if (!isEnglish) return parts.join(' ');

  const visible = parts.filter(alias => !/[\u4e00-\u9fff]/.test(alias));
  return visible.join(' ');
};

const buildSpellTooltip = (spell: SpellInfo, isEnglish: boolean) => {
  const displayName = isEnglish && spell.en_name ? spell.en_name : spell.name;
  const aliasesText = getTooltipAliases(spell, isEnglish);
  return `${displayName}${aliasesText ? ` (${aliasesText})` : ''}\nID: ${spell.id}`;
};

interface SpellPickerProps {
  pickerConfig: { x: number; y: number; rowTop?: number; wandSlot: string; spellIdx: string; isAlwaysCast?: boolean; insertAnchor?: { wandSlot: string; idx: number; isRightHalf: boolean } | null } | null;
  onClose: () => void;
  pickerSearch: string;
  setPickerSearch: (s: string) => void;
  pickSpell: (spellId: string | null, isKeyboard?: boolean) => void;
  searchResults: SpellInfo[][] | null;
  spellStats: { overall: SpellInfo[]; categories: SpellInfo[][] };
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  pickerExpandedGroups: Set<number>;
  setPickerExpandedGroups: React.Dispatch<React.SetStateAction<Set<number>>>;
  isConnected: boolean;
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
  setSettings,
  pickerExpandedGroups,
  setPickerExpandedGroups,
  isConnected
}: SpellPickerProps) {
  const { t, i18n } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hasNavigatedSelection, setHasNavigatedSelection] = useState(false);
  const setHoveredSlot = useUIStore(s => s.setHoveredSlot);
  const resolveHoveredSlotAtPoint = useUIStore(s => s.resolveHoveredSlotAtPoint);
  const pickerAutoFillRows = settings.pickerAutoFillRows || 0;
  const pickerIconInnerSize = Math.max(18, (settings.pickerRowHeight || 32) - 8);
  
  // Track mount time to prevent ghost clicks from closing/triggering the picker instantly on mobile
  const mountTimeRef = React.useRef(Date.now());

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (Date.now() - mountTimeRef.current < 300) return;
    onClose();
  };

  const handlePickSpell = (id: string | null, isKeyboard?: boolean) => {
    if (!isKeyboard && Date.now() - mountTimeRef.current < 300) return;
    pickSpell(id, isKeyboard);
  };

  const flatSpells = React.useMemo(() => {
    if (pickerSearch) {
      return searchResults?.[0] || [];
    }
    const all: SpellInfo[] = [...spellStats.overall];
    settings.spellGroups.forEach((_, gIdx) => {
      all.push(...spellStats.categories[gIdx]);
    });
    return all;
  }, [pickerSearch, searchResults, spellStats, settings.spellGroups]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
    setHasNavigatedSelection(false);
  }, [pickerSearch]);

  useEffect(() => {
    if (!pickerConfig || settings.pickerFirstSpaceBehavior !== 'insert_at_current_hover') return;

    const updateHoverFromPoint = (clientX: number, clientY: number) => {
      const hit = resolveHoveredSlotAtPoint(clientX, clientY);
      setHoveredSlot(hit);
    };

    const handlePointerMove = (e: PointerEvent) => {
      updateHoverFromPoint(e.clientX, e.clientY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      updateHoverFromPoint(e.clientX, e.clientY);
    };

    window.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('mousemove', handleMouseMove, true);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('mousemove', handleMouseMove, true);
    };
  }, [pickerConfig, settings.pickerFirstSpaceBehavior, resolveHoveredSlotAtPoint, setHoveredSlot]);

  useEffect(() => {
    if (pickerConfig) setHasNavigatedSelection(false);
  }, [pickerConfig]);

  const translateSpellType = (name: string) => {
    const mapping: Record<string, string> = {
      [t('settings.spell_types_list.projectile')]: t('settings.spell_types_list.projectile'),
      [t('settings.spell_types_list.static_projectile')]: t('settings.spell_types_list.static_projectile'),
      [t('settings.spell_types_list.modifier')]: t('settings.spell_types_list.modifier'),
      [t('settings.spell_types_list.multicast')]: t('settings.spell_types_list.multicast'),
      [t('settings.spell_types_list.material')]: t('settings.spell_types_list.material'),
      [t('settings.spell_types_list.other')]: t('settings.spell_types_list.other'),
      [t('settings.spell_types_list.utility')]: t('settings.spell_types_list.utility'),
      [t('settings.spell_types_list.passive')]: t('settings.spell_types_list.passive'),
      '投射物': t('settings.spell_types_list.projectile'),
      '静态投射物': t('settings.spell_types_list.static_projectile'),
      '修正': t('settings.spell_types_list.modifier'),
      '多重': t('settings.spell_types_list.multicast'),
      '材料': t('settings.spell_types_list.material'),
      '其他': t('settings.spell_types_list.other'),
      '实用': t('settings.spell_types_list.utility'),
      '被动': t('settings.spell_types_list.passive'),
    };
    return mapping[name] || name;
  };

  const translateSpellGroup = (name: string) => {
    const mapping: Record<string, string> = {
      [t('settings.spell_groups_list.projectile')]: t('settings.spell_groups_list.projectile'),
      [t('settings.spell_groups_list.modifier')]: t('settings.spell_groups_list.modifier'),
      [t('settings.spell_groups_list.utility_multicast_other')]: t('settings.spell_groups_list.utility_multicast_other'),
      [t('settings.spell_groups_list.static_material_passive')]: t('settings.spell_groups_list.static_material_passive'),
      '投射物': t('settings.spell_groups_list.projectile'),
      '修正': t('settings.spell_groups_list.modifier'),
      '实用+多重+其他': t('settings.spell_groups_list.utility_multicast_other'),
      '静态+材料+被动': t('settings.spell_groups_list.static_material_passive'),
    };
    return mapping[name] || name;
  };

  const getFloatingFillCols = React.useCallback((iconSize = settings.pickerRowHeight) => {
    const scale = (settings.uiScale || 100) / 100;
    const vpW = window.innerWidth / scale;
    const availableWidth = Math.max(400, vpW - 40);
    const iconGap = 6;
    return Math.max(5, Math.min(500, Math.floor((availableWidth - 24 + iconGap) / (iconSize + iconGap))));
  }, [settings.pickerRowHeight, settings.uiScale]);

  const applyFloatingFill = React.useCallback((rows: number, iconSize = settings.pickerRowHeight) => {
    const cols = getFloatingFillCols(iconSize);
    const previewLimit = Math.max(1, cols * Math.max(1, rows));
    setSettings(prev => ({
      ...prev,
      pickerAutoFillRows: rows,
      pickerRowHeight: iconSize,
      wrapLimit: cols,
      commonLimit: previewLimit,
      categoryLimit: previewLimit,
    }));
  }, [getFloatingFillCols, setSettings, settings.pickerRowHeight]);

  useEffect(() => {
    if (!pickerConfig || pickerAutoFillRows <= 0) return;
    applyFloatingFill(pickerAutoFillRows);
  }, [applyFloatingFill, pickerAutoFillRows, pickerConfig]);

  if (!pickerConfig) return null;

  return (
    <div className="fixed inset-0 z-[700] overflow-hidden" onClick={handleBackdropClick}>
      <div
        data-testid="spell-picker"
        className={`glass-card bg-zinc-900/95 border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-top-4 duration-200 overflow-hidden ${settings.mobilePickerMode
            ? 'absolute rounded-xl'
            : 'absolute max-h-[600px]'
          }`}
        style={(() => {
          const scale = (settings.uiScale || 100) / 100;
          const adjX = pickerConfig.x / scale;
          const adjY = pickerConfig.y / scale;

          if (settings.mobilePickerMode) {
            return {
              top: adjY,
              left: 4 / scale,
              right: 4 / scale,
              maxHeight: `calc(100% - ${adjY + (8 / scale)}px)`
            };
          }

          const vpW = window.innerWidth / scale;
          const vpH = window.innerHeight / scale;
          const pickerW = Math.max(400, Math.min(vpW - 40, settings.wrapLimit * (settings.pickerRowHeight + 6) + 24));
          const pickerMaxH = 520;

          // Center horizontally on the cell, clamp to viewport
          let left = adjX - pickerW / 2;
          left = Math.max(4, Math.min(left, vpW - pickerW - 4));

          // Try below the row first
          let top = adjY;
          const rowTopAdj = pickerConfig.rowTop !== undefined ? pickerConfig.rowTop / scale : undefined;

          // If placing below would overflow viewport, flip above
          if (top + pickerMaxH > vpH && rowTopAdj !== undefined) {
            // Place picker so its bottom aligns just above the row top
            return {
              left,
              width: pickerW,
              top: 'auto' as any,
              bottom: vpH - rowTopAdj + 4,
              maxHeight: Math.max(200, rowTopAdj - 8),
            };
          }

          return {
            top,
            left,
            width: pickerW,
            maxHeight: Math.max(200, vpH - top - 8),
          };
        })()}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-3 border-b border-white/5 flex items-center gap-2 bg-black/20">
          <Search size={14} className="text-zinc-500" />
          <input
            autoFocus={!settings.disablePickerAutoFocus}
            placeholder={t('spell_picker.search_placeholder')}
            className="bg-transparent flex-1 text-sm outline-none placeholder:text-zinc-600"
            data-testid="spell-picker-input"
            value={pickerSearch}
            onChange={e => setPickerSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') onClose();

              if (e.key === ' ' && pickerSearch === '' && !hasNavigatedSelection) {
                const behavior = settings.pickerFirstSpaceBehavior;
                if (behavior === 'ignore') {
                  e.preventDefault();
                  return;
                }

                if (behavior === 'insert_at_current_hover' || behavior === 'insert_at_open_anchor') {
                  e.preventDefault();
                  handlePickSpell('__TWWE_INSERT_EMPTY_SLOT__', true);
                  return;
                }
              }

              // 空格和回车选词
              if (e.key === 'Enter' || (e.key === ' ' && (pickerSearch !== '' || hasNavigatedSelection))) {
                if (pickerSearch === '' && flatSpells.length === 0) {
                  handlePickSpell(null, true);
                } else if (flatSpells[selectedIndex]) {
                  e.preventDefault();
                  handlePickSpell(flatSpells[selectedIndex].id, true);
                }

                return;
              }

              if (flatSpells.length > 0) {
                const itemEl = document.querySelector('[data-testid="spell-picker-item"]') as HTMLElement | null;
                const colCount = Math.max(1, itemEl?.parentElement ? Array.from(itemEl.parentElement.children).filter(el => Math.abs((el as HTMLElement).offsetTop - itemEl.offsetTop) < 2).length : (settings.wrapLimit || 10));

                // 处理 Shift + 数字：输入数字本身而不是符号 (例如 Shift+2 输入 2 而不是 @)
                if (e.shiftKey && e.code.startsWith('Digit')) {
                  const digit = e.code.replace('Digit', '');
                  if (digit >= '1' && digit <= '9') {
                    e.preventDefault();
                    setPickerSearch(pickerSearch + digit);
                    return;
                  }
                }

                // 处理 1-9 数字键：直接选词
                if (e.code.startsWith('Digit') && e.key >= '1' && e.key <= '9' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                  const idx = parseInt(e.key) - 1;
                  if (flatSpells[idx]) {
                    e.preventDefault();
                    handlePickSpell(flatSpells[idx].id, true);
                  }
                  return;
                }

                if (e.key === 'ArrowRight') {
                  setSelectedIndex(prev => Math.min(flatSpells.length - 1, prev + 1));
                  setHasNavigatedSelection(true);
                  e.preventDefault();
                } else if (e.key === 'ArrowLeft') {
                  setSelectedIndex(prev => Math.max(0, prev - 1));
                  setHasNavigatedSelection(true);
                  e.preventDefault();
                } else if (e.key === 'ArrowDown') {
                  setSelectedIndex(prev => {
                    const currentCol = prev % colCount;
                    const currentRow = Math.floor(prev / colCount);
                    const nextIdx = (currentRow + 1) * colCount + currentCol;
                    return Math.min(flatSpells.length - 1, nextIdx);
                  });
                  setHasNavigatedSelection(true);
                  e.preventDefault();
                } else if (e.key === 'ArrowUp') {
                  setSelectedIndex(prev => {
                    const currentCol = prev % colCount;
                    const currentRow = Math.floor(prev / colCount);
                    const nextIdx = (currentRow - 1) * colCount + currentCol;
                    return Math.max(0, nextIdx);
                  });
                  setHasNavigatedSelection(true);
                  e.preventDefault();
                }
              }
            }}
          />
          <button onClick={() => handlePickSpell(null, false)} className="text-[10px] font-black text-red-400 bg-red-400/10 px-2 py-1 rounded hover:bg-red-400/20">
            {t('spell_picker.clear_slot')}
          </button>
          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
            <span>{t('spell_picker.fixed_palette.size')}</span>
            <input
              type="number"
              min={24}
              max={64}
              step={4}
              value={settings.pickerRowHeight}
              onChange={e => {
                const nextSize = Math.max(24, Math.min(64, parseInt(e.target.value, 10) || 32));
                if (pickerAutoFillRows > 0) {
                  applyFloatingFill(pickerAutoFillRows, nextSize);
                } else {
                  setSettings(prev => ({ ...prev, pickerRowHeight: nextSize }));
                }
              }}
              className="h-7 w-12 rounded border border-white/10 bg-black/20 px-1 text-center text-xs text-zinc-200 outline-none"
            />
            <span>{t('spell_picker.fixed_palette.cols')}</span>
            <input
              type="number"
              min={5}
              max={500}
              value={settings.wrapLimit}
              onChange={e => setSettings(prev => ({
                ...prev,
                pickerAutoFillRows: 0,
                wrapLimit: Math.max(5, Math.min(500, parseInt(e.target.value, 10) || 20)),
              }))}
              className="h-7 w-12 rounded border border-white/10 bg-black/20 px-1 text-center text-xs text-zinc-200 outline-none"
            />
            <span>{t('settings.common_limit')}</span>
            <input
              type="number"
              min={0}
              max={5000}
              value={settings.commonLimit}
              onChange={e => setSettings(prev => ({
                ...prev,
                pickerAutoFillRows: 0,
                commonLimit: Math.max(0, Math.min(5000, parseInt(e.target.value, 10) || 0)),
              }))}
              className="h-7 w-14 rounded border border-white/10 bg-black/20 px-1 text-center text-xs text-zinc-200 outline-none"
            />
            <span>{t('settings.category_limit')}</span>
            <input
              type="number"
              min={1}
              max={5000}
              value={settings.categoryLimit}
              onChange={e => setSettings(prev => ({
                ...prev,
                pickerAutoFillRows: 0,
                categoryLimit: Math.max(1, Math.min(5000, parseInt(e.target.value, 10) || 1)),
              }))}
              className="h-7 w-14 rounded border border-white/10 bg-black/20 px-1 text-center text-xs text-zinc-200 outline-none"
            />
            <button
              type="button"
              className={`h-7 rounded border px-2 transition-colors ${pickerAutoFillRows > 0 ? 'border-sky-500/50 bg-sky-500/20 text-sky-200' : 'border-white/10 bg-black/20 text-zinc-500 hover:bg-white/5 hover:text-zinc-200'}`}
              onClick={() => {
                if (pickerAutoFillRows > 0) {
                  setSettings(prev => ({ ...prev, pickerAutoFillRows: 0 }));
                } else {
                  applyFloatingFill(1);
                }
              }}
              title={t('spell_picker.fixed_palette.auto_fill_title')}
            >
              {t('spell_picker.fixed_palette.auto_fill')}
            </button>
            <input
              type="number"
              min={1}
              max={20}
              value={pickerAutoFillRows || 1}
              onChange={e => applyFloatingFill(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
              className={`h-7 w-10 rounded border px-1 text-center text-xs outline-none ${pickerAutoFillRows > 0 ? 'border-sky-500/30 bg-sky-500/10 text-sky-100' : 'border-white/10 bg-black/20 text-zinc-500'}`}
              title={t('spell_picker.fixed_palette.auto_fill_rows')}
            />
          </div>
          <button
            type="button"
            onClick={() => setSettings(prev => ({
              ...prev,
              pinnedSpellPaletteOpen: !prev.pinnedSpellPaletteOpen || prev.pinnedSpellPaletteWandSlot !== pickerConfig.wandSlot,
              pinnedSpellPaletteWandSlot: pickerConfig.wandSlot,
            }))}
            className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${settings.pinnedSpellPaletteOpen ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-white'}`}
            title={settings.pinnedSpellPaletteOpen ? t('spell_picker.fixed_palette.close') : t('spell_picker.fixed_palette.settings_title')}
          >
            <Pin size={13} />
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto custom-scrollbar p-2 ${settings.hideLabels ? 'space-y-2' : 'space-y-4'}`}>
          {pickerSearch ? (
            searchResults?.[0]?.length ? (
              <div>
                {!settings.hideLabels && (
                  <div className="flex items-center gap-2 px-2 mb-2">
                    <Search size={12} className="text-indigo-400" />
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{t('spell_picker.search_results_sorted')}</span>
                  </div>
                )}
                <div className={`flex flex-wrap gap-1 px-1 ${settings.hideLabels ? 'mb-4' : ''}`}>
                  {searchResults[0].map((s: SpellInfo, idx: number) => {
                    const typeConfig = settings.spellTypes.find(t => t.id === s.type);
                    const isEnglish = i18n.language.startsWith('en');
                    const tooltip = buildSpellTooltip(s, isEnglish);
                    const isSelected = selectedIndex === idx;
                    return (
                      <button
                        key={s.id}
                        onClick={() => handlePickSpell(s.id, false)}
                        style={{
                          height: settings.pickerRowHeight,
                          width: settings.pickerRowHeight,
                          backgroundColor: typeConfig?.color || 'rgba(255,255,255,0.05)'
                        }}
                        className={`aspect-square hover:bg-white/10 border rounded flex items-center justify-center transition-all group overflow-hidden ${isSelected ? 'ring-2 ring-white border-transparent scale-110 z-10 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'border-white/5'
                          }`}
                        data-testid="spell-picker-item"
                        data-spell-id={s.id}
                        title={tooltip}
                      >
                        <div className="relative w-full h-full flex items-center justify-center">
                          <img src={getIconUrl(s.icon, isConnected)} className="image-pixelated transition-transform group-hover:scale-110" style={{ width: pickerIconInnerSize, height: pickerIconInnerSize }} alt="" />
                          {idx < 9 && (
                            <div className="absolute top-0 left-0 bg-black/60 text-[8px] text-white/50 px-0.5 rounded-br pointer-events-none">
                              {idx + 1}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null
          ) : (
            <>
              {spellStats.overall.length > 0 && (
                <div className={`rounded-lg overflow-hidden ${settings.hideLabels ? 'bg-white/5 border border-white/5 shadow-inner' : ''}`}>
                  <div className={`p-2 relative group/header ${settings.hideLabels ? 'pt-1.5 pb-1.5' : `bg-gradient-to-r from-indigo-500/10 to-zinc-800/20 ${settings.hideLabels ? '' : 'mb-2'}`}`}>
                    <div className={`flex items-center justify-between ${settings.hideLabels ? 'absolute -top-1 -right-1 z-10' : 'mb-2'}`}>
                      {!settings.hideLabels && (
                        <div className="flex items-center gap-2">
                          <Star size={12} className="text-amber-500" />
                          <span className="text-[9px] font-black text-white/70 uppercase tracking-widest">{t('spell_picker.common_spells_global')}</span>
                        </div>
                      )}
                      <button
                        onClick={() => setPickerExpandedGroups(prev => {
                          const next = new Set(prev);
                          if (next.has(-1)) next.delete(-1);
                          else next.add(-1);
                          return next;
                        })}
                        className={`w-5 h-5 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded transition-all group/plus ${settings.hideLabels ? 'opacity-0 group-hover/header:opacity-100 shadow-lg' : 'ml-auto'}`}
                      >
                        {pickerExpandedGroups.has(-1) ? (
                          <Minimize2 size={12} className="text-white/50 group-hover/plus:text-white" />
                        ) : (
                          <Plus size={12} className="text-white/50 group-hover/plus:text-white" />
                        )}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 px-0.5">
                      {spellStats.overall.map((s: SpellInfo, idx: number) => {
                        const typeConfig = settings.spellTypes.find(t => t.id === s.type);
                        const isEnglish = i18n.language.startsWith('en');
                        const tooltip = buildSpellTooltip(s, isEnglish);
                        const isSelected = !pickerSearch && selectedIndex === idx;
                        return (
                          <button
                            key={s.id}
                            onClick={() => handlePickSpell(s.id, false)}
                            style={{
                              height: settings.pickerRowHeight,
                              width: settings.pickerRowHeight,
                              backgroundColor: typeConfig?.color || 'rgba(0,0,0,0.2)'
                            }}
                            className={`aspect-square hover:bg-black/40 border rounded flex items-center justify-center transition-all group overflow-hidden ${isSelected ? 'ring-2 ring-white border-transparent scale-110 z-10 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'border-white/5'
                              }`}
                            title={tooltip}
                            data-testid="spell-picker-item"
                            data-spell-id={s.id}
                          >
                            <div className="relative w-full h-full flex items-center justify-center">
                              <img src={getIconUrl(s.icon, isConnected)} className="image-pixelated transition-transform group-hover:scale-110" style={{ width: pickerIconInnerSize, height: pickerIconInnerSize }} alt="" />
                              {!pickerSearch && idx < 9 && (
                                <div className="absolute top-0 left-0 bg-black/60 text-[8px] text-white/50 px-0.5 rounded-br pointer-events-none">
                                  {idx + 1}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {settings.spellGroups.map((group, gIdx) => (
                <div key={group.name} className={`rounded-lg overflow-hidden ${spellStats.categories[gIdx].length === 0 ? 'hidden' : ''} ${settings.hideLabels ? 'bg-white/5 border border-white/5 shadow-inner' : ''}`}>
                  <div className={`p-2 relative group/header ${settings.hideLabels ? 'pt-1.5 pb-1.5' : `bg-gradient-to-r ${group.color || 'from-zinc-800/20 to-zinc-800/20'} ${settings.hideLabels ? '' : 'mb-2'}`}`}>
                    <div className={`flex items-center justify-between ${settings.hideLabels ? 'absolute -top-1 -right-1 z-10' : 'mb-2'}`}>
                      {!settings.hideLabels && (
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-3 rounded-full bg-white/20" />
                          <span className="text-[9px] font-black text-white/70 uppercase tracking-widest">{translateSpellGroup(group.name)} {!pickerExpandedGroups.has(gIdx) && `(Top ${settings.categoryLimit})`}</span>
                        </div>
                      )}
                      <button
                        onClick={() => setPickerExpandedGroups(prev => {
                          const next = new Set(prev);
                          if (next.has(gIdx)) next.delete(gIdx);
                          else next.add(gIdx);
                          return next;
                        })}
                        className={`w-5 h-5 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded transition-all group/plus ${settings.hideLabels ? 'opacity-0 group-hover/header:opacity-100 shadow-lg' : 'ml-auto'}`}
                      >
                        {pickerExpandedGroups.has(gIdx) ? (
                          <Minimize2 size={12} className="text-white/50 group-hover/plus:text-white" />
                        ) : (
                          <Plus size={12} className="text-white/50 group-hover/plus:text-white" />
                        )}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 px-0.5">
                      {spellStats.categories[gIdx].map((s: SpellInfo, idx: number) => {
                        const typeConfig = settings.spellTypes.find(t => t.id === s.type);
                        const isEnglish = i18n.language.startsWith('en');
                        const tooltip = buildSpellTooltip(s, isEnglish);

                        // Calculate global index for this spell in non-search mode
                        let globalIdx = spellStats.overall.length;
                        for (let i = 0; i < gIdx; i++) {
                          globalIdx += spellStats.categories[i].length;
                        }
                        globalIdx += idx;
                        const isSelected = !pickerSearch && selectedIndex === globalIdx;

                        return (
                          <button
                            key={s.id}
                            onClick={() => handlePickSpell(s.id, false)}
                            style={{
                              height: settings.pickerRowHeight,
                              width: settings.pickerRowHeight,
                              backgroundColor: typeConfig?.color || 'rgba(0,0,0,0.2)'
                            }}
                            className={`aspect-square hover:bg-black/40 border rounded flex items-center justify-center transition-all group overflow-hidden ${isSelected ? 'ring-2 ring-white border-transparent scale-110 z-10' : 'border-white/5'
                              }`}
                            title={tooltip}
                            data-testid="spell-picker-item"
                            data-spell-id={s.id}
                          >
                            <img src={getIconUrl(s.icon, isConnected)} className="image-pixelated transition-transform group-hover:scale-110" style={{ width: pickerIconInnerSize, height: pickerIconInnerSize }} alt="" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {(pickerSearch && searchResults?.every(g => g.length === 0)) && (
            <div className="py-10 text-center text-zinc-600 text-xs">
              {t('spell_picker.no_results')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
