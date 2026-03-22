import { useEffect, useCallback } from 'react';
import { WandSelection, SpellPickerOpenOptions, SpellPickerTrigger, WandData } from '../types';

interface UseWandEditorKeyboardProps {
  slot: string;
  data: WandData;
  selection: WandSelection | null;
  setSelection: (s: WandSelection | null) => void;
  openPicker: (slot: string, idx: string, e: SpellPickerTrigger) => void;
  getCellRect?: (slot: string, idx: number) => DOMRect | null;
  updateWand: (slot: string, updates: Partial<WandData>, actionName?: string, icons?: string[]) => void;
  setIsAltPressed: (v: boolean) => void;
  t: (key: string, options?: any) => string;
}

export const useWandEditorKeyboard = ({
  slot,
  data,
  selection,
  setSelection,
  openPicker,
  getCellRect,
  updateWand,
  setIsAltPressed,
  t
}: UseWandEditorKeyboardProps) => {

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.key === 'Alt') {
      setIsAltPressed(true);
      return;
    }

    // Grid Navigation & Interaction (Tab, Arrows, Letters, Enter/Space)
    if (selection && selection.wandSlot === slot) {
      const { indices } = selection;
      const currentIdx = indices[0];

      // Tab / Arrow navigation
      if (e.key === 'Tab' || e.key.startsWith('Arrow')) {
        e.preventDefault();
        let nextIdx = currentIdx;
        const capacity = data.deck_capacity;

        if (e.key === 'Tab') {
          nextIdx = e.shiftKey ? currentIdx - 1 : currentIdx + 1;
        } else if (e.key === 'ArrowRight') {
          nextIdx = currentIdx + 1;
        } else if (e.key === 'ArrowLeft') {
          nextIdx = currentIdx - 1;
        } else if (e.key === 'ArrowDown') {
          nextIdx = currentIdx + 10;
        } else if (e.key === 'ArrowUp') {
          nextIdx = currentIdx - 10;
        }

        if (nextIdx >= 1 && nextIdx <= capacity) {
          setSelection({ wandSlot: slot, indices: [nextIdx], startIdx: nextIdx });
        }
        return;
      }

      // Letters / Enter / Space -> Open Picker
      const isLetter = /^[a-zA-Z]$/.test(e.key);
      const isSpecialTrigger = e.key === 'Enter' || e.key === ' ';
      
      if (isLetter || isSpecialTrigger) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        
        e.preventDefault();
        const rect = getCellRect?.(slot, currentIdx) ?? null;
        
        const openOptions: SpellPickerOpenOptions = {
          x: rect?.left || window.innerWidth / 2,
          y: (rect?.bottom || window.innerHeight / 2) + 8,
          initialSearch: isLetter ? e.key : '',
          rowTop: rect?.top
        };

        openPicker(slot, currentIdx.toString(), openOptions);
        return;
      }

      // Delete/Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const newSpells = { ...data.spells };
        const newSpellUses = { ...(data.spell_uses || {}) };
        
        let changed = false;
        indices.forEach(idx => {
          if (newSpells[idx.toString()]) {
            delete newSpells[idx.toString()];
            delete newSpellUses[idx.toString()];
            changed = true;
          }
        });

        if (changed) {
          updateWand(slot, { spells: newSpells, spell_uses: newSpellUses }, t('app.notification.delete_spell'));
        }
        return;
      }
    }
  }, [slot, data, selection, setSelection, openPicker, getCellRect, updateWand, setIsAltPressed, t]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Alt') {
      setIsAltPressed(false);
    }
  }, [setIsAltPressed]);

  useEffect(() => {
    const onBlur = () => setIsAltPressed(false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [handleKeyDown, handleKeyUp, setIsAltPressed]);
};
