import React, { memo } from 'react';
import { X } from 'lucide-react';
import { SpellInfo, WandData, AppSettings } from '../types';
import { getIconUrl } from '../lib/evaluatorAdapter';
import { getUnknownSpellInfo } from '../hooks/useSpellDb';
import { useUIStore } from '../store/useUIStore';

interface SpellCellProps {
  i: number;
  slot: string;
  idx: string;
  data: WandData;
  spell?: SpellInfo | null;
  sid: string | null;
  uses?: number;
  isLocked: boolean;
  isAltPressed: boolean;
  absoluteToOrdinal: Record<number, number>;
  slotMatchMap: Record<number, any>;
  gap: number;
  
  settings: AppSettings;
  isConnected: boolean;

  handleSlotMouseMove: (e: React.MouseEvent, slot: string, idx: number) => void;
  handleSlotMouseLeave: () => void;
  handleSlotMouseDown: (slot: string, idx: number, isRightClick?: boolean, pointer?: { x: number; y: number }) => void;
  handleSlotMouseUp: (slot: string, idx: number) => void;
  handleSlotMouseEnter: (slot: string, idx: number) => void;
  openPicker: (slot: string, idx: string, e: React.MouseEvent | { x: number; y: number; initialSearch?: string; rowTop?: number; insertAnchor?: { wandSlot: string; idx: number; isRightHalf: boolean } | null }) => void;
  setSelection: (s: any) => void;
  updateWand: (slot: string, partial: Partial<WandData> | ((prev: WandData) => Partial<WandData>), actionName?: string, icons?: string[]) => void;
  openWiki: (sid: string) => void;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  t: (key: string, options?: any) => string;
}

const SpellCellComponent = ({
  i, slot, idx, data, spell, sid, uses, isLocked, isAltPressed,
  absoluteToOrdinal, slotMatchMap, gap, settings, isConnected,
  handleSlotMouseMove, handleSlotMouseLeave, handleSlotMouseDown,
  handleSlotMouseUp, handleSlotMouseEnter, openPicker, setSelection,
  updateWand, openWiki, setSettings, t
}: SpellCellProps) => {

  const isSelected = useUIStore(s => s.selection?.wandSlot === slot && s.selection.indices.includes(i + 1));
  const hoveredSlot = useUIStore(s => s.hoveredSlot);
  const isHovered = hoveredSlot?.wandSlot === slot && hoveredSlot?.idx === (i + 1);
  const dragSource = useUIStore(s => s.dragSource);
  const selection = useUIStore(s => s.selection);

  return (
    <div
      className="aspect-square relative"
      style={{ padding: `${gap / 2}px` }}
      onMouseMove={(e) => !isLocked && handleSlotMouseMove(e, slot, i + 1)}
      onMouseLeave={handleSlotMouseLeave}
    >
      <div
        onMouseDown={(e) => {
          if (!isLocked) {
            if (e.ctrlKey && e.button === 1 && sid) {
              e.preventDefault();
              e.stopPropagation();
              openWiki(sid);
              return;
            }
            if (e.button === 1 && spell) {
              e.preventDefault();
              e.stopPropagation();
              const slotIdx = i + 1;
              updateWand(slot, (curr) => {
                const marked = Array.isArray(curr.marked_slots) ? curr.marked_slots : [];
                const newMarked = marked.includes(slotIdx)
                  ? marked.filter(m => m !== slotIdx)
                  : [...marked, slotIdx];
                return { marked_slots: newMarked };
              });
              return;
            }
            e.preventDefault();
            handleSlotMouseDown(slot, i + 1, e.button === 2, { x: e.clientX, y: e.clientY });
          }
        }}
        data-slot-idx={idx}
        onMouseUp={(e) => {
          if (!isLocked) {
            handleSlotMouseUp(slot, i + 1);
          }
        }}
        onContextMenu={(e) => {
          if (spell) e.preventDefault();
        }}
        onMouseEnter={() => !isLocked && handleSlotMouseEnter(slot, i + 1)}
        onClick={(e) => {
          if (e.ctrlKey && settings.ctrlClickDelete && !e.altKey) {
            if (e.shiftKey) {
              e.preventDefault();
              e.stopPropagation();
              const slotIdx = i + 1;
              const newSpells: Record<string, string> = {};
              const newSpellUses: Record<string, number> = {};
              let nextIdx = 1;
              for (let j = 1; j <= data.deck_capacity; j++) {
                if (j === slotIdx) continue;
                if (data.spells[j.toString()]) {
                  newSpells[nextIdx.toString()] = data.spells[j.toString()];
                  if (data.spell_uses?.[j.toString()] !== undefined) {
                    newSpellUses[nextIdx.toString()] = data.spell_uses[j.toString()];
                  }
                }
                nextIdx++;
              }
              const newCap = Math.max(1, data.deck_capacity - 1);
              updateWand(slot, {
                spells: newSpells,
                spell_uses: newSpellUses,
                deck_capacity: newCap
              }, t('app.notification.delete_wand_slot'));
              return;
            } else if (sid) {
              e.preventDefault();
              e.stopPropagation();
              updateWand(slot, (curr) => {
                const newSpells = { ...curr.spells };
                const newSpellUses = { ...(curr.spell_uses || {}) };
                delete newSpells[idx];
                delete newSpellUses[idx];
                return { spells: newSpells, spell_uses: newSpellUses };
              }, t('app.notification.delete_spell'));
              return;
            }
          }
          if (e.altKey && spell && sid) {
            e.preventDefault();
            e.stopPropagation();

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
            const actionName = newUses === 0 ? t('app.notification.set_charges_0') : t('app.notification.restore_charges');
            updateWand(slot, (curr) => ({
              spell_uses: { ...(curr.spell_uses || {}), [idx]: newUses }
            }), actionName);
            return;
          }
          if (selection && selection.indices.length > 1) {
            setSelection(null);
          } else {
            !isLocked && openPicker(slot, idx, {
              x: e.clientX,
              y: e.clientY,
              insertAnchor: {
                wandSlot: slot,
                idx: i + 1,
                isRightHalf: hoveredSlot?.wandSlot === slot && hoveredSlot?.idx === (i + 1) ? hoveredSlot.isRightHalf : (e.clientX > (e.currentTarget as HTMLElement).getBoundingClientRect().left + (e.currentTarget as HTMLElement).getBoundingClientRect().width / 2)
              }
            });
          }
        }}
        className={`
          w-full h-full rounded-lg border flex items-center justify-center relative group/cell transition-all active:scale-95
          ${isLocked ? 'bg-black/40 border-transparent opacity-10' : `${sid && !spell ? 'bg-orange-950/30 border-orange-500/30 shadow-inner hover:bg-orange-900/30' : 'bg-zinc-800/80 border-white/5 shadow-inner hover:bg-zinc-700/80'} ${settings.editorDragMode === 'hand' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
          ${isSelected ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-500/40 border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.3)] z-10 scale-[1.02]' : ''}
          ${isHovered && dragSource && settings.dragSpellMode === 'noita_swap' ? 'border-indigo-500 bg-indigo-500/30 scale-105 z-20' : 'hover:border-indigo-500/50'}
        `}
      >
        {isHovered && hoveredSlot && (
          (dragSource && settings.dragSpellMode === 'noita_swap') ? (
            <div className="absolute inset-0 border-2 border-indigo-400 rounded-lg animate-pulse pointer-events-none" />
          ) : (
            <div
              className="absolute top-0 bottom-0 w-1 bg-indigo-400 z-50 animate-pulse rounded-full"
              style={{ [hoveredSlot.isRightHalf ? 'right' : 'left']: `-${gap / 2 + 2}px` }}
            />
          )
        )}
        {spell ? (
          <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
            {(() => {
              const isTriggered = (sid === 'IF_HP' && settings.simulateLowHp) ||
                (sid === 'IF_PROJECTILE' && settings.simulateManyProjectiles) ||
                (sid === 'IF_ENEMY' && settings.simulateManyEnemies);
              const isGrayscale = (uses === 0) || isTriggered;
              const isMarked = Array.isArray(data.marked_slots) && data.marked_slots.includes(i + 1);

              return (
                <>
                  <img src={getIconUrl(spell.icon, isConnected)} className={`w-10 h-10 image-pixelated transition-transform group-hover/cell:scale-110 ${isGrayscale ? 'grayscale opacity-50' : ''}`} alt="" draggable="false" />

                  {isMarked && (
                    <div className="absolute inset-0 border-2 border-amber-500 rounded-lg shadow-[0_0_10px_rgba(245,158,11,0.5)] z-10 pointer-events-none" />
                  )}

                  {slotMatchMap[i + 1] && (() => {
                    const pm = slotMatchMap[i + 1];
                    const isStart = i + 1 === pm.startIdx;
                    const isEnd = i + 1 === pm.endIdx;
                    return (
                      <div
                        className="absolute bottom-0 left-0 right-0 h-[3px] z-20 pointer-events-none"
                        style={{
                          backgroundColor: pm.color,
                          borderRadius: `${isStart ? '0 0 0 4px' : '0'} ${isEnd ? '0 0 4px 0' : '0'}`,
                          boxShadow: `0 0 6px ${pm.color}80`,
                        }}
                        title={pm.label}
                      />
                    );
                  })()}

                  {isTriggered && (
                    <div className="absolute bottom-0 left-0">
                      <svg width="12" height="12" viewBox="0 0 12 12" className="drop-shadow-[0_0_2px_rgba(239,68,68,0.8)]">
                        <path d="M0 12 L12 12 L0 0 Z" fill="rgb(239, 68, 68)" />
                      </svg>
                    </div>
                  )}

                  {uses !== undefined && (settings.showSpellCharges || uses === 0) && uses !== -1 && !isTriggered && (
                    <div
                      className={`absolute bottom-0 left-0 px-1.5 py-0.5 bg-black/90 text-[10px] font-mono font-black border-tr border-white/10 rounded-tr pointer-events-auto cursor-pointer select-none z-20 shadow-lg ${uses === 0 ? 'text-red-500' : 'text-amber-400'}`}
                      title={t('editor.modify_uses_tip')}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newUses = uses === 0 ? (spell.max_uses ?? 10) : 0;
                        updateWand(slot, (curr) => ({
                          spell_uses: { ...(curr.spell_uses || {}), [idx]: newUses }
                        }));
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
                e.preventDefault();
                e.stopPropagation();
                const newSpells = { ...(data.spells || {}) };
                const newSpellUses = { ...(data.spell_uses || {}) };
                delete newSpells[idx];
                delete newSpellUses[idx];
                updateWand(slot, { spells: newSpells, spell_uses: newSpellUses });
              }}
              className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-red-500/95 text-white flex items-center justify-center opacity-0 group-hover/cell:opacity-100 hover:opacity-100 transition-opacity z-20 pointer-events-auto shadow-lg"
              aria-label={t('app.notification.delete_spell')}
            >
              <X size={12} />
            </button>
          </div>
        ) : sid && !isLocked ? (
          <div className="relative w-full h-full flex flex-col items-center justify-center pointer-events-none overflow-hidden p-0.5" title={(() => {
            const info = getUnknownSpellInfo(sid);
            return info?.mod_id
              ? t('editor.unknown_spell_tip_with_mod', { id: sid, mod: info.mod_id })
              : t('editor.unknown_spell_tip', { id: sid });
          })()}>
            {(() => {
              const info = getUnknownSpellInfo(sid);
              return info?.mod_id
                ? <span className="text-cyan-400/80 text-[9px] font-bold leading-none truncate max-w-full">@{info.mod_id}</span>
                : <span className="text-orange-400 text-sm font-black leading-none">?</span>;
            })()}
            <span className="text-orange-400/70 text-[9px] font-mono leading-tight text-center break-all line-clamp-2 max-w-full">{sid}</span>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const newSpells = { ...(data.spells || {}) };
                const newSpellUses = { ...(data.spell_uses || {}) };
                delete newSpells[idx];
                delete newSpellUses[idx];
                updateWand(slot, { spells: newSpells, spell_uses: newSpellUses });
              }}
              className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-red-500/95 text-white flex items-center justify-center opacity-0 group-hover/cell:opacity-100 hover:opacity-100 transition-opacity z-20 pointer-events-auto shadow-lg"
              aria-label={t('app.notification.delete_spell')}
            >
              <X size={12} />
            </button>
          </div>
        ) : !isLocked && (
          <span className="text-zinc-800 text-2xl font-thin opacity-50">+</span>
        )}
        {!isLocked && absoluteToOrdinal[i + 1] && (
          <div className={`
          absolute bottom-1 right-1 text-[10px] font-black transition-all duration-200 pointer-events-none
          ${(isAltPressed || settings.showIndices) ? 'text-cyan-400 scale-110 drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]' : 'text-white/5'}
        `}>
            {absoluteToOrdinal[i + 1]}
          </div>
        )}
      </div>
    </div>
  );
};

export const SpellCell = memo(SpellCellComponent, (prevProps, nextProps) => {
  if (prevProps.sid !== nextProps.sid) return false;
  if (prevProps.uses !== nextProps.uses) return false;
  if (prevProps.isLocked !== nextProps.isLocked) return false;
  if (prevProps.isAltPressed !== nextProps.isAltPressed) return false;
  if (prevProps.absoluteToOrdinal[prevProps.i + 1] !== nextProps.absoluteToOrdinal[nextProps.i + 1]) return false;
  if (prevProps.slotMatchMap[prevProps.i + 1] !== nextProps.slotMatchMap[nextProps.i + 1]) return false;
  
  const wasMarked = Array.isArray(prevProps.data.marked_slots) && prevProps.data.marked_slots.includes(prevProps.i + 1);
  const isMarked = Array.isArray(nextProps.data.marked_slots) && nextProps.data.marked_slots.includes(nextProps.i + 1);
  if (wasMarked !== isMarked) return false;
  
  if (prevProps.data.deck_capacity !== nextProps.data.deck_capacity) return false;
  if (prevProps.settings.editorDragMode !== nextProps.settings.editorDragMode) return false;
  if (prevProps.settings.showSpellCharges !== nextProps.settings.showSpellCharges) return false;
  if (prevProps.settings.showIndices !== nextProps.settings.showIndices) return false;
  
  return true; 
});
