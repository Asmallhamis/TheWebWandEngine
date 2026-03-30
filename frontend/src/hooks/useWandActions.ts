import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Tab, WandData, AppSettings, SpellInfo, AppNotification, WandSelection, SpellPickerTrigger, PickerInsertAnchor, SpellPickerOpenOptions } from '../types';

import { DEFAULT_WAND } from '../constants';
import { serializeWandToWand2Text, buildWandShareUrl } from '../lib/wand/share';

const compactAlwaysCast = (spells?: (string | null | undefined)[]) =>
  (spells || []).map(s => s || '').filter(Boolean);

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
  updateWand: (slot: string, data: Partial<WandData> | ((prev: WandData) => Partial<WandData>), actionName?: string, icons?: string[]) => void
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
      const wikiText = serializeWandToWand2Text(wand);
      try {
        await navigator.clipboard.writeText(wikiText);
        setNotification({ msg: t('app.notification.copied_to_clipboard'), type: 'success' });
      } catch (err) {
        console.error('Clipboard error:', err);
      }
    }
  }, [activeTab.wands, setClipboard, t, setNotification]);

  const copyWandShareLink = useCallback(async (slot: string) => {
    const wand = activeTab.wands[slot];
    if (!wand) return;
    const shareUrl = buildWandShareUrl(wand, window.location.href);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotification({ msg: t('app.notification.copied_share_link'), type: 'success' });
    } catch (err) {
      console.error('Clipboard error:', err);
    }
  }, [activeTab.wands, t, setNotification]);

  const copyLegacyWand = useCallback(async (slot: string) => {
    const wand = activeTab.wands[slot];
    if (wand) {
      const alwaysCasts = compactAlwaysCast(wand.always_cast).map(id => spellDb[id]?.en_name || id).join(',');
      let wikiText = `{{Wand
| wandPic =
| capacity = ${wand.deck_capacity}
| shuffle = ${wand.shuffle_deck_when_empty ? 'Yes' : 'No'}
| spellsCast = ${wand.actions_per_round}
| alwaysCasts = ${alwaysCasts}
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

  const openPicker = useCallback((wandSlot: string, spellIdx: string, e: SpellPickerTrigger) => {
    let x: number, y: number, initialSearch = '';
    let rowTop: number | undefined;
    let insertAnchor: PickerInsertAnchor | null | undefined;

    if (e && 'currentTarget' in e && e.currentTarget) {
      const cellRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      x = cellRect.left;

      // 尝试找到所在 grid 行的底部，使 Picker 不遮挡当前行的法术
      const cell = e.currentTarget as HTMLElement;
      // cell 是内部 div，它的 parent (.aspect-square) 才是实际的 grid item
      const gridItem = cell.parentElement;
      const gridParent = cell.closest('.grid');
      if (gridParent && gridItem) {
        const gridItemRect = gridItem.getBoundingClientRect();
        // 找到与当前格子在同一行（top 值相同）的所有格子，取最大 bottom
        const siblings = Array.from(gridParent.children);
        const myTop = gridItemRect.top;
        let rowBottom = gridItemRect.bottom;
        for (const sib of siblings) {
          const sibRect = (sib as HTMLElement).getBoundingClientRect();
          // 视为同一行：top 差值在 2px 以内
          if (Math.abs(sibRect.top - myTop) < 2) {
            rowBottom = Math.max(rowBottom, sibRect.bottom);
          }
        }
        y = rowBottom + 4;
        rowTop = myTop;
      } else {
        y = cellRect.bottom + 8;
      }
    } else {
      const manual = e as { x: number, y: number, initialSearch?: string, rowTop?: number, insertAnchor?: { wandSlot: string; idx: number; isRightHalf: boolean } | null };
      x = manual.x;
      y = manual.y;
      initialSearch = manual.initialSearch || '';
      rowTop = manual.rowTop;
      insertAnchor = manual.insertAnchor;
    }

    setPickerConfig({
      wandSlot,
      spellIdx,
      x,
      y,
      ...(insertAnchor !== undefined ? { insertAnchor } : {}),
      ...(rowTop !== undefined ? { rowTop } : {})
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
    copyWandShareLink,
    copyLegacyWand,
    cutWand,
    pasteWand,
    openPicker
  };
};
