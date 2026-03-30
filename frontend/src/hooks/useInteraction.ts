import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { WandData, Tab, AppSettings, SpellArea } from '../types';
import { DEFAULT_WAND } from '../constants';
import { useUIStore } from '../store/useUIStore';

const normalizeAlwaysCast = (spells: (string | null | undefined)[]) =>
  spells.map(s => s ?? '');

export const useInteraction = (params: {
  activeTab: Tab;
  settings: AppSettings;
  performAction: any;
  syncWand: any;
}) => {
  const { activeTab, settings, performAction, syncWand } = params;
  const { t } = useTranslation();

  const setSelection = useUIStore(state => state.setSelection);
  const setDragSource = useUIStore(state => state.setDragSource);
  const setHoveredSlot = useUIStore(state => state.setHoveredSlot);

  const isSelectingRef = useRef(false);
  const setIsSelecting = useCallback((val: boolean) => {
    isSelectingRef.current = val;
  }, []);

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // --- Mouse Handlers ---
  const handleSlotMouseDown = useCallback((wandSlot: string, idx: number, isRightClick: boolean = false, pointer?: { x: number; y: number }, area: SpellArea = 'main') => {
    const isHandMode = settings.editorDragMode === 'hand';

    // 允许正常格子的拖拽
    if (idx >= 0 && (isRightClick || (isHandMode && !isRightClick))) {
      const wand = activeTab.wands[wandSlot];
      const sid = area === 'always_cast' ? wand?.always_cast[idx - 1] : wand?.spells[idx.toString()];
      if (sid) {
        if (pointer) setMousePos(pointer);
        setHoveredSlot({ wandSlot, area, idx, isRightHalf: !!isRightClick });
        setDragSource({ wandSlot, area, idx, sid });
      }
    }

    if (idx < 0 || isRightClick || isHandMode) return;
    setIsSelecting(true);
    setSelection({ wandSlot, area, indices: [idx], startIdx: idx });


  }, [activeTab.wands, settings.editorDragMode, setDragSource, setSelection, setHoveredSlot]);

  const insertIntoAlwaysCast = useCallback((wand: WandData, targetIdx: number, sid: string, hoveredRightHalf: boolean) => {
    const nextWand = { ...wand };
    const targetPos = Math.max(1, targetIdx + (hoveredRightHalf ? 1 : 0));
    const acSlots = [...(nextWand.always_cast || [])];
    while (acSlots.length < targetPos - 1) acSlots.push('');
    acSlots.splice(Math.max(0, targetPos - 1), 0, sid);
    nextWand.always_cast = normalizeAlwaysCast(acSlots);
    return nextWand;
  }, []);

  const moveIntoAlwaysCast = useCallback((wand: WandData, sourceArea: SpellArea, sourceIdx: number, targetIdx: number, sid: string, hoveredRightHalf: boolean) => {
    const nextWand = { ...wand };
    const targetPos = Math.max(1, targetIdx + (hoveredRightHalf ? 1 : 0));
    const acSlots = [...(nextWand.always_cast || [])];

    if (sourceArea === 'main') {
      const nextSpells = { ...nextWand.spells };
      const nextUses = { ...(nextWand.spell_uses || {}) };
      delete nextSpells[sourceIdx.toString()];
      delete nextUses[sourceIdx.toString()];
      nextWand.spells = nextSpells;
      nextWand.spell_uses = nextUses;
    } else {
      acSlots.splice(sourceIdx - 1, 1);
    }

    const insertPos = sourceArea === 'always_cast' && sourceIdx < targetPos ? targetPos - 1 : targetPos;
    while (acSlots.length < insertPos - 1) acSlots.push('');
    acSlots.splice(Math.max(0, insertPos - 1), 0, sid);
    nextWand.always_cast = normalizeAlwaysCast(acSlots);
    return nextWand;
  }, []);

  const moveFromAlwaysCastToMain = useCallback((wand: WandData, sourceIdx: number, targetIdx: number, sid: string, hoveredRightHalf: boolean) => {
    const nextWand = { ...wand };
    nextWand.always_cast = normalizeAlwaysCast((nextWand.always_cast || []).filter((_, i) => i !== sourceIdx - 1));
    const insertIdx = Math.max(1, targetIdx + (hoveredRightHalf ? 1 : 0));
    const maxIdx = Math.max(nextWand.deck_capacity, ...Object.keys(nextWand.spells).map(Number));
    const slots: { sid: string, uses?: number }[] = [];
    for (let i = 1; i <= maxIdx; i++) slots.push({ sid: nextWand.spells[i.toString()] || '', uses: nextWand.spell_uses?.[i.toString()] });
    slots.splice(Math.max(0, insertIdx - 1), 0, { sid });
    nextWand.spells = Object.fromEntries(slots.map((item, i) => item.sid ? [[(i + 1).toString(), item.sid]] : []).flat());
    nextWand.spell_uses = Object.fromEntries(slots.map((item, i) => item.sid && item.uses !== undefined ? [[(i + 1).toString(), item.uses]] : []).flat());
    nextWand.deck_capacity = Math.max(nextWand.deck_capacity, slots.length);
    return nextWand;
  }, []);

  const handleSlotMouseUp = useCallback((wandSlot: string, idx: number, area: SpellArea = 'main') => {
    const dragSource = useUIStore.getState().dragSource;
    if (dragSource) {
      const sourceWandSlot = dragSource.wandSlot;
      const sourceArea = dragSource.area;
      const sourceIdx = dragSource.idx;
      const targetWandSlot = wandSlot;
      const targetIdx = idx;

      if (targetIdx < 0) {
        performAction((prevWands: Record<string, WandData>) => {
          const sourceWand = prevWands[sourceWandSlot];
          const sid = sourceArea === 'always_cast' ? sourceWand?.always_cast[sourceIdx - 1] : sourceWand?.spells[sourceIdx.toString()];
          if (!sid) return prevWands;
          const nextWands = { ...prevWands };
          const hovered = useUIStore.getState().hoveredSlot;
          const nextSourceWand = moveIntoAlwaysCast(sourceWand, sourceArea, sourceIdx, Math.max(1, (sourceWand.always_cast || []).length + 1), sid, !!hovered?.isRightHalf);

          nextWands[sourceWandSlot] = nextSourceWand;
          if (activeTab.isRealtime) {
            syncWand(sourceWandSlot, nextSourceWand);
          }
          return nextWands;
        }, t('app.notification.move_spell'), [dragSource.sid]);

        setHoveredSlot(null);
        setDragSource(null);
        setIsSelecting(false);
        return;
      }

      performAction((prevWands: Record<string, WandData>) => {
        const nextWands = { ...prevWands };
        const hovered = useUIStore.getState().hoveredSlot;

        if (sourceArea === 'always_cast' || area === 'always_cast') {
          const sourceWand = prevWands[sourceWandSlot];
          const targetWand = sourceWandSlot === targetWandSlot ? sourceWand : prevWands[targetWandSlot];
          const sid = sourceArea === 'always_cast'
            ? sourceWand?.always_cast[sourceIdx - 1]
            : sourceWand?.spells[sourceIdx.toString()];

          if (!sid || !sourceWand || !targetWand) return prevWands;

          if (sourceArea === 'always_cast' && area === 'always_cast') {
            if (sourceWandSlot === targetWandSlot) {
              const nextTargetWand = moveIntoAlwaysCast(targetWand, 'always_cast', sourceIdx, targetIdx, sid, !!hovered?.isRightHalf);
              nextWands[targetWandSlot] = nextTargetWand;
              if (activeTab.isRealtime) syncWand(targetWandSlot, nextTargetWand);
            } else {
              const nextSourceWand = {
                ...sourceWand,
                always_cast: normalizeAlwaysCast((sourceWand.always_cast || []).filter((_, i) => i !== sourceIdx - 1))
              };
              const nextTargetWand = insertIntoAlwaysCast(targetWand, targetIdx, sid, !!hovered?.isRightHalf);
              nextWands[sourceWandSlot] = nextSourceWand;
              nextWands[targetWandSlot] = nextTargetWand;
              if (activeTab.isRealtime) {
                syncWand(sourceWandSlot, nextSourceWand);
                syncWand(targetWandSlot, nextTargetWand);
              }
            }
            return nextWands;
          }

          if (sourceArea === 'main' && area === 'always_cast') {
            const nextSourceWand = moveIntoAlwaysCast(sourceWand, 'main', sourceIdx, targetIdx, sid, !!hovered?.isRightHalf);
            nextWands[sourceWandSlot] = nextSourceWand;
            if (activeTab.isRealtime) syncWand(sourceWandSlot, nextSourceWand);
            return nextWands;
          }

          if (sourceArea === 'always_cast' && area === 'main') {
            const nextTargetWand = moveFromAlwaysCastToMain(targetWand, sourceIdx, targetIdx, sid, !!hovered?.isRightHalf);
            if (sourceWandSlot !== targetWandSlot) {
              const nextSourceWand = { ...sourceWand, always_cast: normalizeAlwaysCast(sourceWand.always_cast.filter((_, i) => i !== sourceIdx - 1)) };
              nextWands[sourceWandSlot] = nextSourceWand;
              nextWands[targetWandSlot] = nextTargetWand;
              if (activeTab.isRealtime) { syncWand(sourceWandSlot, nextSourceWand); syncWand(targetWandSlot, nextTargetWand); }
            } else {
              nextWands[targetWandSlot] = nextTargetWand;
              if (activeTab.isRealtime) syncWand(targetWandSlot, nextTargetWand);
            }
            return nextWands;
          }
        }

        if (sourceArea !== 'main' || area !== 'main') return prevWands;
        const sourceWand = { ...nextWands[sourceWandSlot] };

        const sid = sourceWand.spells[sourceIdx.toString()];
        const uses = sourceWand.spell_uses?.[sourceIdx.toString()];

       const newSourceSpells = { ...sourceWand.spells };
        const newSourceUses = { ...(sourceWand.spell_uses || {}) };
        delete newSourceSpells[sourceIdx.toString()];
        delete newSourceUses[sourceIdx.toString()];
        sourceWand.spells = newSourceSpells;
        sourceWand.spell_uses = newSourceUses;

        const targetWand = sourceWandSlot === targetWandSlot ? sourceWand : { ...nextWands[targetWandSlot] };

        if (settings.dragSpellMode === 'noita_swap') {

          const targetSid = targetWand.spells[targetIdx.toString()];
          const targetUses = targetWand.spell_uses?.[targetIdx.toString()];

          const nextTargetSpells = { ...targetWand.spells };
          const nextTargetUses = { ...(targetWand.spell_uses || {}) };

          nextTargetSpells[targetIdx.toString()] = sid;
          if (uses !== undefined) nextTargetUses[targetIdx.toString()] = uses;
          else delete nextTargetUses[targetIdx.toString()];

          targetWand.spells = nextTargetSpells;
          targetWand.spell_uses = nextTargetUses;

          if (sourceIdx >= 0 && (sourceWandSlot !== targetWandSlot || sourceIdx !== targetIdx)) {
            const sourceWandToUpdate = sourceWandSlot === targetWandSlot ? targetWand : sourceWand;
            const nextSourceSpells = { ...sourceWandToUpdate.spells };
            const nextSourceUses = { ...(sourceWandToUpdate.spell_uses || {}) };

            if (targetSid) {
              nextSourceSpells[sourceIdx.toString()] = targetSid;
              if (targetUses !== undefined) nextSourceUses[sourceIdx.toString()] = targetUses;
              else delete nextSourceUses[sourceIdx.toString()];
            } else {
              delete nextSourceSpells[sourceIdx.toString()];
              delete nextSourceUses[sourceIdx.toString()];
            }
            sourceWandToUpdate.spells = nextSourceSpells;
            sourceWandToUpdate.spell_uses = nextSourceUses;
          }


          if (targetIdx > targetWand.deck_capacity) {
            targetWand.deck_capacity = targetIdx;
          }
        } else if (settings.dragSpellMode === '20260222') {
          const stateHoveredSlot = useUIStore.getState().hoveredSlot;
          const isRightHalf = stateHoveredSlot?.wandSlot === targetWandSlot &&
            stateHoveredSlot?.idx === targetIdx &&
            stateHoveredSlot?.isRightHalf;

          const bIdx = isRightHalf ? targetIdx : targetIdx - 1;
          const cIdx = isRightHalf ? targetIdx + 1 : targetIdx;

          if (sourceWandSlot === targetWandSlot && targetIdx === sourceIdx) {
            // Restore original position
            const finalSpells = { ...targetWand.spells };
            const finalUses = { ...(targetWand.spell_uses || {}) };
            finalSpells[sourceIdx.toString()] = sid;
            if (uses !== undefined) finalUses[sourceIdx.toString()] = uses;
            targetWand.spells = finalSpells;
            targetWand.spell_uses = finalUses;
          } else {
            const bSid = targetWand.spells[bIdx.toString()];
            const cSid = targetWand.spells[cIdx.toString()];
            const isBEmpty = bIdx >= 1 ? !bSid : false; // Index 0 or less is the wall, not empty
            const isCEmpty = !cSid;

            if (!isCEmpty && !isBEmpty) {
              // Rule 2: Both filled -> Insert at C
              const maxIdx = Math.max(targetWand.deck_capacity, ...Object.keys(targetWand.spells).map(Number));
              const slots: { sid: string, uses?: number }[] = [];
              for (let i = 1; i <= maxIdx; i++) {
                slots.push({
                  sid: targetWand.spells[i.toString()] || "",
                  uses: targetWand.spell_uses?.[i.toString()]
                });
              }
              slots.splice(cIdx - 1, 0, { sid, uses });
              const finalSpells: Record<string, string> = {};
              const finalUses: Record<string, number> = {};
              slots.forEach((item, i) => {
                if (item.sid) {
                  finalSpells[(i + 1).toString()] = item.sid;
                  if (item.uses !== undefined) finalUses[(i + 1).toString()] = item.uses;
                }
              });
              targetWand.spells = finalSpells;
              targetWand.spell_uses = finalUses;
              if (slots.length > targetWand.deck_capacity) targetWand.deck_capacity = slots.length;
            } else if (isBEmpty && isCEmpty) {
              // Rule 4: Both empty -> proximity (drop on targetIdx)
              const finalSpells = { ...targetWand.spells };
              const finalUses = { ...(targetWand.spell_uses || {}) };
              finalSpells[targetIdx.toString()] = sid;
              if (uses !== undefined) finalUses[targetIdx.toString()] = uses;
              targetWand.spells = finalSpells;
              targetWand.spell_uses = finalUses;
              if (targetIdx > targetWand.deck_capacity) targetWand.deck_capacity = targetIdx;
            } else if (isCEmpty) {
              // Rule 1: C empty -> C
              const finalSpells = { ...targetWand.spells };
              const finalUses = { ...(targetWand.spell_uses || {}) };
              finalSpells[cIdx.toString()] = sid;
              if (uses !== undefined) finalUses[cIdx.toString()] = uses;
              targetWand.spells = finalSpells;
              targetWand.spell_uses = finalUses;
              if (cIdx > targetWand.deck_capacity) targetWand.deck_capacity = cIdx;
            } else {
              // Rule 3: B empty -> B
              const finalSpells = { ...targetWand.spells };
              const finalUses = { ...(targetWand.spell_uses || {}) };
              finalSpells[bIdx.toString()] = sid;
              if (uses !== undefined) finalUses[bIdx.toString()] = uses;
              targetWand.spells = finalSpells;
              targetWand.spell_uses = finalUses;
            }
          }
        } else {
          const stateHoveredSlot = useUIStore.getState().hoveredSlot;
          const isRightHalf = stateHoveredSlot?.wandSlot === targetWandSlot &&
            stateHoveredSlot?.idx === targetIdx &&
            stateHoveredSlot?.isRightHalf;
          const insertIdx = targetIdx + (isRightHalf ? 1 : 0);

          const maxIdx = Math.max(targetWand.deck_capacity, ...Object.keys(targetWand.spells).map(Number), sourceWandSlot === targetWandSlot ? sourceIdx : 0);
          const slots: { sid: string, uses?: number }[] = [];
          for (let i = 1; i <= maxIdx; i++) {
            if (sourceWandSlot === targetWandSlot && i === sourceIdx) continue;
            slots.push({
              sid: targetWand.spells[i.toString()] || "",
              uses: targetWand.spell_uses?.[i.toString()]
            });
          }

          let adjustedInsertIdx = insertIdx;
          if (sourceWandSlot === targetWandSlot && sourceIdx >= 0 && sourceIdx < insertIdx) {
            adjustedInsertIdx--;
          }

          slots.splice(Math.max(0, adjustedInsertIdx - 1), 0, { sid, uses });

          const finalSpells: Record<string, string> = {};
          const finalUses: Record<string, number> = {};
          slots.forEach((item, i) => {
            if (item.sid) {
              finalSpells[(i + 1).toString()] = item.sid;
              if (item.uses !== undefined) finalUses[(i + 1).toString()] = item.uses;
            }
          });

          targetWand.spells = finalSpells;
          targetWand.spell_uses = finalUses;

          const lastSpellIdx = slots.reduce((acc, val, idx) => val.sid !== "" ? idx + 1 : acc, 0);
          if (lastSpellIdx > targetWand.deck_capacity) {
            targetWand.deck_capacity = lastSpellIdx;
          }
        }

        nextWands[sourceWandSlot] = sourceWand;
        if (sourceWandSlot !== targetWandSlot) nextWands[targetWandSlot] = targetWand;

        if (activeTab.isRealtime) {
          syncWand(sourceWandSlot, sourceWand);
          if (sourceWandSlot !== targetWandSlot) syncWand(targetWandSlot, targetWand);
        }

        return nextWands;
      }, t('app.notification.move_spell'), [dragSource.sid]);

      setDragSource(null);
      setHoveredSlot(null);
    }
    setIsSelecting(false);
  }, [activeTab.isRealtime, settings.dragSpellMode, performAction, syncWand, t, setDragSource, setHoveredSlot, insertIntoAlwaysCast, moveIntoAlwaysCast, moveFromAlwaysCastToMain]);


  const handleSlotMouseEnter = useCallback((wandSlot: string, idx: number, area: SpellArea = 'main') => {
    const selection = useUIStore.getState().selection;
    if (isSelectingRef.current && selection && selection.wandSlot === wandSlot && selection.area === area) {
      const start = selection.startIdx;
      const end = idx;
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      const newIndices = [];
      for (let i = min; i <= max; i++) newIndices.push(i);
      setSelection({ ...selection, indices: newIndices });
    }
  }, [setSelection]);

  const handleSlotMouseMove = useCallback((e: React.MouseEvent, wandSlot: string, idx: number, area: SpellArea = 'main') => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isRightHalf = e.clientX > rect.left + rect.width / 2;
    setHoveredSlot({ wandSlot, area, idx, isRightHalf });
  }, [setHoveredSlot]);

  const handleSlotMouseLeave = useCallback(() => {
    setHoveredSlot(null);
  }, [setHoveredSlot]);

  const insertEmptySlot = useCallback((updateWand: any, mode: 'current_hover' | 'selection' | 'open_anchor' = 'current_hover', openAnchor?: { wandSlot: string; idx: number; isRightHalf: boolean } | null) => {
    const stateHoveredSlot = useUIStore.getState().hoveredSlot;
    const stateSelection = useUIStore.getState().selection;

    let targetWandSlot: string | undefined;
    let startIdx: number | null = null;
    let targetArea: SpellArea = 'main';

    if (mode === 'open_anchor' && openAnchor) {
      targetWandSlot = openAnchor.wandSlot;
      targetArea = 'main';
      startIdx = openAnchor.idx > 0
        ? (openAnchor.idx + (openAnchor.isRightHalf ? 1 : 0))
        : null;
    }

    if (startIdx === null && mode !== 'selection' && stateHoveredSlot) {
      targetWandSlot = stateHoveredSlot.wandSlot;
      targetArea = stateHoveredSlot.area;
      startIdx = stateHoveredSlot.idx > 0
        ? (stateHoveredSlot.idx + (stateHoveredSlot.isRightHalf ? 1 : 0))
        : null;
    }

    if ((startIdx === null || !targetWandSlot) && stateSelection) {
      targetWandSlot = stateSelection.wandSlot;
      targetArea = stateSelection.area;
      startIdx = Math.min(...stateSelection.indices.filter(i => i > 0));
    }

    if (!targetWandSlot) {
      return;
    }

    const wand = activeTab.wands[targetWandSlot];
    if (!wand) return;

    if (targetArea === 'always_cast') {
      const insertAt = startIdx === null || startIdx <= 0
        ? Math.max(1, (wand.always_cast || []).length + 1)
        : startIdx;

      const nextAlwaysCast = [...(wand.always_cast || [])];
      while (nextAlwaysCast.length < insertAt - 1) nextAlwaysCast.push('');
      nextAlwaysCast.splice(Math.max(0, insertAt - 1), 0, '');

      updateWand(targetWandSlot, {
        always_cast: nextAlwaysCast,
      }, t('app.notification.insert_empty_slot'));
      return;
    }

    if (startIdx === null || startIdx <= 0) {
      startIdx = Math.max(1, wand.deck_capacity + 1);
    }

    const existingSpells: (string | null)[] = [];
    const maxIdx = Math.max(wand.deck_capacity, ...Object.keys(wand.spells).map(Number));
    for (let i = 1; i <= maxIdx; i++) {
      existingSpells.push(wand.spells[i.toString()] || null);
    }

    const head = existingSpells.slice(0, startIdx - 1);
    const tail = existingSpells.slice(startIdx - 1);
    const combined = [...head, null, ...tail];

    const finalSpellsObj: Record<string, string> = {};
    combined.forEach((sid, i) => {
      if (sid) finalSpellsObj[(i + 1).toString()] = sid;
    });

    let newCapacity = Math.max(wand.deck_capacity + 1, startIdx);
    const lastSpellIdx = combined.reduce((acc, val, idx) => val !== null ? idx + 1 : acc, 0);
    if (lastSpellIdx > newCapacity) {
      newCapacity = lastSpellIdx;
    }

    updateWand(targetWandSlot, { spells: finalSpellsObj, deck_capacity: newCapacity }, t('app.notification.insert_empty_slot'));
  }, [activeTab.wands, t]);

  return {
    isSelecting: isSelectingRef.current,
    setIsSelecting,
    isDraggingFile,
    setIsDraggingFile,
    mousePos,
    setMousePos,
    handleSlotMouseDown,
    handleSlotMouseUp,
    handleSlotMouseEnter,
    handleSlotMouseMove,
    handleSlotMouseLeave,
    insertEmptySlot,
  };
};
