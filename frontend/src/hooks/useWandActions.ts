import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Tab, WandData, AppSettings, SpellInfo, AppNotification } from '../types';
import { DEFAULT_WAND } from '../constants';

export const useWandActions = (params: {
  tabs: Tab[],
  activeTab: Tab,
  activeTabId: string,
  settings: AppSettings,
  spellDb: Record<string, SpellInfo>,
  clipboard: any,
  setClipboard: (c: any) => void,
  performAction: any,
  syncWand: any,
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>,
  setNotification: (n: AppNotification | null) => void,
  lastLocalUpdateRef: React.MutableRefObject<number>,
  setSelection: (s: any) => void,
  setPickerConfig: (c: any) => void,
  setPickerSearch: (s: string) => void,
  setPickerExpandedGroups: (s: Set<number>) => void,
  updateWand: (slot: string, data: Partial<WandData>, actionName?: string, icons?: string[]) => void
}) => {
  const { 
    tabs, activeTab, activeTabId, settings, spellDb, clipboard, setClipboard,
    performAction, syncWand, setTabs, setNotification, lastLocalUpdateRef,
    setSelection, setPickerConfig, setPickerSearch, setPickerExpandedGroups, updateWand
  } = params;
  
  const { t } = useTranslation();

  const addWand = useCallback(() => {
    const nextSlot = (Math.max(0, ...Object.keys(activeTab.wands).map(Number)) + 1).toString();
    const newWand = { ...DEFAULT_WAND, ...settings.defaultWandStats };
    lastLocalUpdateRef.current = Date.now();

    performAction((prevWands: any) => ({
      ...prevWands,
      [nextSlot]: newWand
    }), t('app.notification.add_new_wand', { slot: nextSlot }));

    if (activeTab.isRealtime) {
      syncWand(nextSlot, newWand);
    }

    setTabs(prev => prev.map(t => t.id === activeTabId ? {
      ...t,
      expandedWands: new Set([...t.expandedWands, nextSlot])
    } : t));
  }, [activeTab, settings.defaultWandStats, lastLocalUpdateRef, performAction, t, syncWand, setTabs, activeTabId]);

  const deleteWand = useCallback((slot: string) => {
    lastLocalUpdateRef.current = Date.now();
    performAction((prevWands: any) => {
      const next = { ...prevWands };
      delete next[slot];
      return next;
    }, t('app.notification.delete_wand', { slot: slot }));

    if (activeTab.isRealtime) {
      syncWand(slot, null, true);
    }
  }, [lastLocalUpdateRef, performAction, t, activeTab.isRealtime, syncWand]);

  const toggleExpand = useCallback((slot: string) => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        const next = new Set(t.expandedWands);
        if (next.has(slot)) next.delete(slot);
        else next.add(slot);
        return { ...t, expandedWands: next };
      }
      return t;
    }));
  }, [setTabs, activeTabId]);

  const copyWand = useCallback(async (slot: string) => {
    const wand = activeTab.wands[slot];
    if (wand) {
      const data = JSON.parse(JSON.stringify(wand));
      setClipboard({ type: 'wand', data });

      // Generate Wand2 wiki text for system clipboard
      const wikiText = `{{Wand2
| wandCard     = Yes
| wandPic      = 
| spellsCast   = ${wand.actions_per_round}
| shuffle      = ${wand.shuffle_deck_when_empty ? 'Yes' : 'No'}
| castDelay    = ${(wand.fire_rate_wait / 60).toFixed(2)}
| rechargeTime = ${(wand.reload_time / 60).toFixed(2)}
| manaMax      = ${wand.mana_max.toFixed(2)}
| manaCharge   = ${wand.mana_charge_speed.toFixed(2)}
| capacity     = ${wand.deck_capacity}
| spread       = ${wand.spread_degrees}
| speed        = ${wand.speed_multiplier.toFixed(2)}
| spells       = ${Array.from({ length: wand.deck_capacity }).map((_, i) => wand.spells[(i + 1).toString()] || "").join(',')}
}}`;
      try {
        await navigator.clipboard.writeText(wikiText);
        setNotification({ msg: t('app.notification.copied_to_clipboard'), type: 'success' });
      } catch (err) {
        console.error('Clipboard error:', err);
      }
    }
  }, [activeTab.wands, setClipboard, t, setNotification]);

  const copyLegacyWand = useCallback(async (slot: string) => {
    const wand = activeTab.wands[slot];
    if (wand) {
      let wikiText = `{{Wand
| wandPic =
| capacity = ${wand.deck_capacity}
| shuffle = ${wand.shuffle_deck_when_empty ? 'Yes' : 'No'}
| spellsCast = ${wand.actions_per_round}
| alwaysCasts = ${wand.always_cast ? wand.always_cast.map(id => spellDb[id]?.en_name || id).join(',') : ''}
`;
      for (let i = 1; i <= wand.deck_capacity; i++) {
        const sid = wand.spells[i.toString()];
        const name = sid ? (spellDb[sid]?.en_name || sid) : '';
        wikiText += `| spell${i} = ${name}\n`;
      }
      wikiText += `}}`;
      try {
        await navigator.clipboard.writeText(wikiText);
        setNotification({ msg: t('app.notification.copied_legacy_template'), type: 'success' });
      } catch (err) {
        console.error('Clipboard error:', err);
      }
    }
  }, [activeTab.wands, spellDb, t, setNotification]);

  const cutWand = useCallback((slot: string) => {
    copyWand(slot);
    deleteWand(slot);
  }, [copyWand, deleteWand]);

  const pasteWand = useCallback((slot: string) => {
    if (clipboard?.type === 'wand') {
      updateWand(slot, clipboard.data);
    }
  }, [clipboard, updateWand]);

  const openPicker = useCallback((wandSlot: string, spellIdx: string, e: React.MouseEvent | { x: number, y: number, initialSearch?: string }) => {
    let x, y, initialSearch = '';
    
    if (e && 'currentTarget' in e && e.currentTarget) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      x = rect.left;
      y = rect.bottom + 8;
    } else {
      const manual = e as { x: number, y: number, initialSearch?: string };
      x = manual.x;
      y = manual.y;
      initialSearch = manual.initialSearch || '';
    }

    setPickerConfig({
      wandSlot,
      spellIdx,
      x,
      y
    });
    setPickerSearch(initialSearch);
    setPickerExpandedGroups(new Set());
  }, [setPickerConfig, setPickerSearch, setPickerExpandedGroups]);

  const pickSpell = useCallback((spellId: string | null, isKeyboard: boolean = false) => {
    // We need pickerConfig here, but it's state from App.tsx. 
    // This is getting complicated. Maybe pickerConfig should be moved too?
    // For now, let's assume we pass pickerConfig as a parameter or it's accessible.
  }, []);

  // Actually, I'll just return these functions and let App.tsx handle the picker logic for now 
  // because pickSpell depends on pickerConfig which is still in App.tsx.

  return {
    addWand,
    deleteWand,
    toggleExpand,
    copyWand,
    copyLegacyWand,
    cutWand,
    pasteWand,
    openPicker
  };
};
