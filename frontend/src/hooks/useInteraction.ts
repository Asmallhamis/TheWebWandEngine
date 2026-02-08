import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { WandData, Tab, AppSettings } from '../types';
import { DEFAULT_WAND } from '../constants';

export const useInteraction = (params: {
  activeTab: Tab;
  settings: AppSettings;
  performAction: any;
  syncWand: any;
}) => {
  const { activeTab, settings, performAction, syncWand } = params;
  const { t } = useTranslation();

  // --- Interaction State ---
  const [selection, setSelection] = useState<{ wandSlot: string, indices: number[], startIdx: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [dragSource, setDragSource] = useState<{ wandSlot: string, idx: number, sid: string } | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredSlot, setHoveredSlot] = useState<{ wandSlot: string, idx: number, isRightHalf: boolean } | null>(null);

  const hoveredSlotRef = useRef(hoveredSlot);
  useEffect(() => { hoveredSlotRef.current = hoveredSlot; }, [hoveredSlot]);

  const selectionRef = useRef(selection);
  useEffect(() => { selectionRef.current = selection; }, [selection]);

  // --- Mouse Handlers ---
  const handleSlotMouseDown = useCallback((wandSlot: string, idx: number, isRightClick: boolean = false) => {
    const isHandMode = settings.editorDragMode === 'hand';
    
    if (isRightClick || (isHandMode && !isRightClick)) {
      const wand = activeTab.wands[wandSlot];
      const sid = idx < 0 ? wand?.always_cast[(-idx) - 1] : wand?.spells[idx.toString()];
      if (sid) {
        setDragSource({ wandSlot, idx, sid });
      }
    }

    if (isRightClick || isHandMode) return;

    if (idx < 0) return; 
    setIsSelecting(true);
    setSelection({ wandSlot, indices: [idx], startIdx: idx });
  }, [activeTab.wands, settings.editorDragMode]);

  const handleSlotMouseUp = useCallback((wandSlot: string, idx: number) => {
    if (dragSource) {
      const sourceWandSlot = dragSource.wandSlot;
      const sourceIdx = dragSource.idx;
      const targetWandSlot = wandSlot;
      const targetIdx = idx;

      performAction((prevWands: Record<string, WandData>) => {
        const nextWands = { ...prevWands };
        const sourceWand = { ...nextWands[sourceWandSlot] };

        const sid = sourceIdx < 0 ? sourceWand.always_cast[(-sourceIdx) - 1] : sourceWand.spells[sourceIdx.toString()];
        const uses = sourceIdx < 0 ? undefined : sourceWand.spell_uses?.[sourceIdx.toString()];

        if (sourceIdx < 0) {
          const newAC = [...(sourceWand.always_cast || [])];
          newAC.splice((-sourceIdx) - 1, 1);
          sourceWand.always_cast = newAC;
        } else {
          const newSourceSpells = { ...sourceWand.spells };
          const newSourceUses = { ...(sourceWand.spell_uses || {}) };
          delete newSourceSpells[sourceIdx.toString()];
          delete newSourceUses[sourceIdx.toString()];
          sourceWand.spells = newSourceSpells;
          sourceWand.spell_uses = newSourceUses;
        }

        const targetWand = sourceWandSlot === targetWandSlot ? sourceWand : { ...nextWands[targetWandSlot] };

        if (targetIdx === -1000 || targetIdx < 0) {
          const newAC = [...(targetWand.always_cast || [])];
          if (targetIdx === -1000) {
            newAC.push(sid);
          } else {
            const acIdx = (-targetIdx) - 1;
            const isRightHalf = hoveredSlotRef.current?.wandSlot === targetWandSlot &&
              hoveredSlotRef.current?.idx === targetIdx &&
              hoveredSlotRef.current?.isRightHalf;
            newAC.splice(acIdx + (isRightHalf ? 1 : 0), 0, sid);
          }
          targetWand.always_cast = newAC;
        } else if (settings.useNoitaSwapLogic) {
          const targetSid = targetWand.spells[targetIdx.toString()];
          const targetUses = targetWand.spell_uses?.[targetIdx.toString()];

          const nextTargetSpells = { ...targetWand.spells };
          const nextTargetUses = { ...(targetWand.spell_uses || {}) };

          nextTargetSpells[targetIdx.toString()] = sid;
          if (uses !== undefined) nextTargetUses[targetIdx.toString()] = uses;
          else delete nextTargetUses[targetIdx.toString()];

          targetWand.spells = nextTargetSpells;
          targetWand.spell_uses = nextTargetUses;

          if (sourceIdx >= 0) {
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
          } else if (targetSid) {
            targetWand.always_cast = [...targetWand.always_cast, targetSid];
          }

          if (targetIdx > targetWand.deck_capacity) {
            targetWand.deck_capacity = targetIdx;
          }
        } else {
          const isRightHalf = hoveredSlotRef.current?.wandSlot === targetWandSlot &&
            hoveredSlotRef.current?.idx === targetIdx &&
            hoveredSlotRef.current?.isRightHalf;
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
    }
    setIsSelecting(false);
  }, [dragSource, activeTab.isRealtime, settings.useNoitaSwapLogic, performAction, syncWand, t]);

  const handleSlotMouseEnter = useCallback((wandSlot: string, idx: number) => {
    if (isSelecting && selection && selection.wandSlot === wandSlot) {
      const start = selection.startIdx;
      const end = idx;
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      const newIndices = [];
      for (let i = min; i <= max; i++) newIndices.push(i);
      setSelection({ ...selection, indices: newIndices });
    }
  }, [isSelecting, selection]);

  const handleSlotMouseMove = useCallback((e: React.MouseEvent, wandSlot: string, idx: number) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isRightHalf = e.clientX > rect.left + rect.width / 2;
    setHoveredSlot({ wandSlot, idx, isRightHalf });
  }, []);

  const handleSlotMouseLeave = useCallback(() => {
    setHoveredSlot(null);
  }, []);

  const insertEmptySlot = useCallback((updateWand: any) => {
    let targetWandSlot = hoveredSlotRef.current?.wandSlot;
    let startIdx = (hoveredSlotRef.current && hoveredSlotRef.current.idx > 0)
      ? (hoveredSlotRef.current.idx + (hoveredSlotRef.current.isRightHalf ? 1 : 0))
      : null;

    if (!targetWandSlot && selectionRef.current) {
      targetWandSlot = selectionRef.current.wandSlot;
      startIdx = Math.min(...selectionRef.current.indices.filter(i => i > 0));
    }

    if (!targetWandSlot || startIdx === null || startIdx <= 0) return;

    const wand = activeTab.wands[targetWandSlot];
    if (!wand) return;

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

    let newCapacity = wand.deck_capacity;
    const lastSpellIdx = combined.reduce((acc, val, idx) => val !== null ? idx + 1 : acc, 0);
    if (lastSpellIdx > wand.deck_capacity) {
      newCapacity = lastSpellIdx;
    }

    updateWand(targetWandSlot, { spells: finalSpellsObj, deck_capacity: newCapacity }, t('app.notification.insert_empty_slot'));
  }, [activeTab.wands, t]);

  return {
    selection, setSelection, selectionRef,
    isSelecting, setIsSelecting,
    dragSource, setDragSource,
    isDraggingFile, setIsDraggingFile,
    mousePos, setMousePos,
    hoveredSlot, setHoveredSlot, hoveredSlotRef,
    handleSlotMouseDown, handleSlotMouseUp, handleSlotMouseEnter, handleSlotMouseMove, handleSlotMouseLeave,
    insertEmptySlot
  };
};
