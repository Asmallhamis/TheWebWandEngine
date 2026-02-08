import { useCallback } from 'react';
import { SpellInfo, WandData, Tab, AppSettings, HistoryItem, WarehouseWand } from '../types';
import { DEFAULT_WAND } from '../constants';

export const readMetadataFromPng = async (file: File): Promise<string | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (!buffer) return resolve(null);
      const view = new DataView(buffer);

      // Check PNG signature
      if (view.byteLength < 8 || view.getUint32(0) !== 0x89504E47 || view.getUint32(4) !== 0x0D0A1A0A) {
        return resolve(null);
      }

      let pos = 8;
      while (pos < view.byteLength) {
        if (pos + 8 > view.byteLength) break;
        const length = view.getUint32(pos);
        const type = String.fromCharCode(
          view.getUint8(pos + 4),
          view.getUint8(pos + 5),
          view.getUint8(pos + 6),
          view.getUint8(pos + 7)
        );

        if (type === 'tEXt') {
          const data = new Uint8Array(buffer, pos + 8, length);
          const content = new TextDecoder().decode(data);
          const [keyword, ...rest] = content.split('\0');
          const value = rest.join('\0');
          if (keyword === 'Wand2Data' || keyword === 'Wand2') {
            return resolve(value);
          }
        } else if (type === 'iTXt') {
          const data = new Uint8Array(buffer, pos + 8, length);
          const content = new TextDecoder().decode(data);
          if (content.includes('{{Wand2')) {
            const start = content.indexOf('{{Wand2');
            const end = content.lastIndexOf('}}') + 2;
            if (start !== -1 && end > start) {
              return resolve(content.substring(start, end));
            }
          }
        }
        pos += length + 12; // length + type + data + crc
      }
      resolve(null);
    };
    reader.readAsArrayBuffer(file);
  });
};

interface UseWandImportProps {
  activeTab: Tab;
  activeTabId: string;
  spellDb: Record<string, SpellInfo>;
  spellNameToId: Record<string, string>;
  settings: AppSettings;
  t: any;
  performAction: (action: (prevWands: Record<string, WandData>) => Record<string, WandData>, actionName?: string, icons?: string[], saveHistory?: boolean) => void;
  updateWand: (slot: string, updates: Partial<WandData>, actionName?: string, icons?: string[]) => void;
  syncWand: (slot: string, data: WandData | null, isDelete?: boolean) => Promise<void>;
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  setActiveTabId: (id: string) => void;
  setNotification: (n: { msg: string; type: 'info' | 'success' } | null) => void;
  hoveredSlotRef: React.MutableRefObject<{ wandSlot: string, idx: number, isRightHalf: boolean } | null>;
  selectionRef: React.MutableRefObject<{ wandSlot: string, indices: number[], startIdx: number } | null>;
}

export const useWandImport = ({
  activeTab,
  activeTabId,
  spellDb,
  spellNameToId,
  settings,
  t,
  performAction,
  updateWand,
  syncWand,
  setTabs,
  setActiveTabId,
  setNotification,
  hoveredSlotRef,
  selectionRef
}: UseWandImportProps) => {

  const importFromText = useCallback(async (text: string, forceTarget?: { slot: string, idx: number }) => {
    // 兼容外部模拟器 URL 粘贴
    if (text.includes('?spells=') || text.includes('&spells=')) {
      const url = new URL(text.startsWith('http') ? text : `http://x.com/${text}`);
      const spellsStr = url.searchParams.get('spells');
      if (spellsStr) {
        const ids = spellsStr.split(',').filter(s => !!s);
        const targetSlot = forceTarget?.slot || (hoveredSlotRef.current?.wandSlot) || (Math.max(0, ...Object.keys(activeTab.wands).map(Number)) + 1).toString();
        const nextWand = {
          ...DEFAULT_WAND,
          mana_max: parseFloat(url.searchParams.get('mana_max') || '400'),
          mana_charge_speed: parseFloat(url.searchParams.get('mana_charge_speed') || '10'),
          reload_time: parseInt(url.searchParams.get('reload_time') || '0'),
          fire_rate_wait: parseInt(url.searchParams.get('cast_delay') || '0'),
          deck_capacity: parseInt(url.searchParams.get('deck_capacity') || '10'),
          actions_per_round: parseInt(url.searchParams.get('actions_per_round') || '1'),
          shuffle_deck_when_empty: url.searchParams.get('shuffle_deck_when_empty') === 'true',
          spells: ids.reduce((acc, id, i) => ({ ...acc, [(i + 1).toString()]: id }), {})
        };
        performAction(prev => ({ ...prev, [targetSlot]: nextWand }), t('app.notification.import_from_url'));
        return true;
      }
    }

    const isWand2Data = text.includes('{{Wand2');
    const isWikiWand = text.includes('{{Wand') && !isWand2Data;
    const isWandData = isWand2Data || isWikiWand;
    const isSpellSeq = text.includes(',') || Object.keys(spellDb).some(id => text.includes(id));

    if (!isWandData && !isSpellSeq) return false;

    const normalize = (s: string) => s.toLowerCase()
      .replace(/\[\[|\]\]/g, '')
      .split('|')[0]
      .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
      .trim();

    // Determine where to paste
    let targetWandSlot = forceTarget?.slot;
    let startIdx = forceTarget?.idx;

    if (!targetWandSlot && hoveredSlotRef.current) {
      targetWandSlot = hoveredSlotRef.current.wandSlot;
      const hIdx = hoveredSlotRef.current.idx;
      if (hIdx < 0) {
        // Paste into Always Cast
        const acIdx = (-hIdx) - 1;
        const spellsList = text.split(',').map(s => s.trim()).filter(s => !!s).map(s => {
          const norm = normalize(s);
          return spellNameToId[norm] || s.toUpperCase();
        });
        if (spellsList.length > 0) {
          performAction(prev => {
            const next = { ...prev };
            const w = { ...next[targetWandSlot!] };
            const newAC = [...(w.always_cast || [])];
            const insertPos = acIdx + (hoveredSlotRef.current!.isRightHalf ? 1 : 0);
            newAC.splice(insertPos, 0, ...spellsList);
            w.always_cast = newAC;
            next[targetWandSlot!] = w;
            if (activeTab.isRealtime) syncWand(targetWandSlot!, w);
            return next;
          }, t('app.notification.paste_to_always_cast'));
          return true;
        }
        return false;
      }
      startIdx = hIdx + (hoveredSlotRef.current.isRightHalf ? 1 : 0);
    } else if (!targetWandSlot && selectionRef.current) {
      targetWandSlot = selectionRef.current.wandSlot;
      startIdx = Math.min(...selectionRef.current.indices);
    }

    if (!targetWandSlot || !startIdx) {
      // If no target slot but it's Wand data, create a new wand instead of failing
      if (isWandData) {
        const nextSlot = (Math.max(0, ...Object.keys(activeTab.wands).map(Number)) + 1).toString();

        const getVal = (key: string) => {
          const regex = new RegExp(`\\|\\s*${key}\\s*=\\s*([^|\\n}]+)`);
          const match = text.match(regex);
          if (!match) return null;
          return match[1].trim();
        };

        const newSpells: Record<string, string> = {};
        const alwaysCasts: string[] = [];
        let deckCapacity = 0;

        if (isWand2Data) {
          const spellsStr = getVal('spells');
          const spellsList = spellsStr ? spellsStr.split(',').map(s => s.trim()) : [];
          spellsList.forEach((sid, i) => {
            if (sid) {
              const norm = normalize(sid);
              newSpells[(i + 1).toString()] = spellNameToId[norm] || sid.toUpperCase();
            }
          });
          deckCapacity = parseInt(getVal('capacity') || '0') || DEFAULT_WAND.deck_capacity;

          const acStr = getVal('alwaysCasts') || getVal('always_cast');
          if (acStr) {
            acStr.split(',').forEach(s => {
              const sid = s.trim();
              if (sid) {
                const norm = normalize(sid);
                alwaysCasts.push(spellNameToId[norm] || sid.toUpperCase());
              }
            });
          }
        } else {
          // Wiki Wand (Legacy)
          deckCapacity = parseInt(getVal('capacity') || '0') || DEFAULT_WAND.deck_capacity;
          for (let i = 1; i <= Math.max(deckCapacity, 100); i++) {
            const name = getVal(`spell${i}`);
            if (name) {
              const norm = normalize(name);
              const id = spellNameToId[norm];
              if (id) newSpells[i.toString()] = id;
            }
          }
          const acName = getVal('alwaysCasts') || getVal('always_cast');
          if (acName) {
            acName.split(',').forEach(s => {
              const norm = normalize(s.trim());
              const id = spellNameToId[norm];
              if (id) alwaysCasts.push(id);
            });
          }
        }

        const newWand: WandData = {
          ...DEFAULT_WAND,
          shuffle_deck_when_empty: getVal('shuffle')?.toLowerCase() === 'yes' || getVal('shuffle') === 'true' || getVal('shuffle') === '是',
          actions_per_round: parseInt(getVal('spellsCast') || (isWand2Data ? '1' : '')) || parseInt(getVal('spellsPerCast') || '1') || DEFAULT_WAND.actions_per_round,
          mana_max: parseFloat(getVal('manaMax') || '0') || DEFAULT_WAND.mana_max,
          mana_charge_speed: parseFloat(getVal('manaCharge') || '0') || DEFAULT_WAND.mana_charge_speed,
          reload_time: Math.round(parseFloat(getVal('rechargeTime') || '0') * 60) || DEFAULT_WAND.reload_time,
          fire_rate_wait: Math.round(parseFloat(getVal('castDelay') || '0') * 60) || DEFAULT_WAND.fire_rate_wait,
          deck_capacity: deckCapacity,
          spread_degrees: parseFloat(getVal('spread') || '0') || DEFAULT_WAND.spread_degrees,
          speed_multiplier: parseFloat(getVal('speed') || '1') || DEFAULT_WAND.speed_multiplier,
          spells: newSpells,
          always_cast: alwaysCasts
        };

        performAction(prevWands => ({
          ...prevWands,
          [nextSlot]: newWand
        }), t('app.notification.create_new_wand_from_paste', { slot: nextSlot }));

        if (activeTab.isRealtime) {
          syncWand(nextSlot, newWand);
        }

        setTabs(prev => prev.map(t => t.id === activeTabId ? {
          ...t,
          expandedWands: new Set([...t.expandedWands, nextSlot])
        } : t));

        setNotification({ msg: t('app.notification.pasted_new_wand', { slot: nextSlot }), type: 'success' });
        return true;
      }
      return false;
    }

    const wand = activeTab.wands[targetWandSlot] || { ...DEFAULT_WAND };

    if (isWandData) {
      const getVal = (key: string) => {
        const regex = new RegExp(`\\|\\s*${key}\\s*=\\s*([^|\\n}]+)`);
        const match = text.match(regex);
        return match ? match[1].trim() : null;
      };

      const newSpells: Record<string, string> = {};
      const alwaysCasts: string[] = [];
      let deckCapacity = wand.deck_capacity;

      if (isWand2Data) {
        const spellsStr = getVal('spells');
        const spellsList = spellsStr ? spellsStr.split(',').map(s => s.trim()) : [];
        spellsList.forEach((sid, i) => {
          if (sid) {
            const norm = normalize(sid);
            newSpells[(i + 1).toString()] = spellNameToId[norm] || sid.toUpperCase();
          }
        });
        deckCapacity = parseInt(getVal('capacity') || '0') || deckCapacity;

        const acStr = getVal('alwaysCasts') || getVal('always_cast');
        if (acStr) {
          acStr.split(',').forEach(s => {
            const sid = s.trim();
            if (sid) {
              const norm = normalize(sid);
              alwaysCasts.push(spellNameToId[norm] || sid.toUpperCase());
            }
          });
        }
      } else {
        // Wiki Wand (Legacy)
        deckCapacity = parseInt(getVal('capacity') || '0') || deckCapacity;
        for (let i = 1; i <= Math.max(deckCapacity, 100); i++) {
          const val = getVal(`spell${i}`);
          if (val) {
            const norm = normalize(val);
            const id = spellNameToId[norm];
            if (id) newSpells[i.toString()] = id;
          }
        }
        const acName = getVal('alwaysCasts') || getVal('always_cast');
        if (acName) {
          acName.split(',').forEach(s => {
            const norm = normalize(s.trim());
            const id = spellNameToId[norm];
            if (id) alwaysCasts.push(id);
          });
        }
      }

      const updates: Partial<WandData> = {
        shuffle_deck_when_empty: getVal('shuffle')?.toLowerCase() === 'yes' || getVal('shuffle') === 'true' || getVal('shuffle') === '是',
        actions_per_round: parseInt(getVal('spellsCast') || (isWand2Data ? '1' : '')) || parseInt(getVal('spellsPerCast') || '1') || wand.actions_per_round,
        mana_max: parseFloat(getVal('manaMax') || '0') || wand.mana_max,
        mana_charge_speed: parseFloat(getVal('manaCharge') || '0') || wand.mana_charge_speed,
        reload_time: Math.round(parseFloat(getVal('rechargeTime') || '0') * 60) || wand.reload_time,
        fire_rate_wait: Math.round(parseFloat(getVal('castDelay') || '0') * 60) || wand.fire_rate_wait,
        deck_capacity: deckCapacity,
        spread_degrees: parseFloat(getVal('spread') || '0') || wand.spread_degrees,
        speed_multiplier: parseFloat(getVal('speed') || '1') || wand.speed_multiplier,
        always_cast: alwaysCasts
      };

      updateWand(targetWandSlot, { ...updates, spells: newSpells }, t('app.notification.paste_wand_data'), Object.values(newSpells));
      return true;
    } else {
      const newSpellsList = text.split(',').map(s => s.trim()).map(s => {
        const norm = normalize(s);
        return spellNameToId[norm] || s.toUpperCase();
      });
      const existingSpells: (string | null)[] = [];
      const maxIdx = Math.max(wand.deck_capacity, ...Object.keys(wand.spells).map(Number));
      for (let i = 1; i <= maxIdx; i++) {
        existingSpells.push(wand.spells[i.toString()] || null);
      }
      const headIdx = startIdx - 1;
      if (existingSpells[headIdx] === null) {
        existingSpells.splice(headIdx, 1);
      } else if (existingSpells[headIdx - 1] === null) {
        existingSpells.splice(headIdx - 1, 1);
        startIdx--;
      }
      const head = existingSpells.slice(0, startIdx - 1);
      const tail = existingSpells.slice(startIdx - 1);
      const combined = [...head, ...newSpellsList, ...tail];
      const finalSpellsObj: Record<string, string> = {};
      combined.forEach((sid, i) => {
        if (sid) finalSpellsObj[(i + 1).toString()] = sid;
      });
      let newCapacity = wand.deck_capacity;
      const lastSpellIdx = combined.reduce((acc, val, idx) => val !== null ? idx + 1 : acc, 0);
      if (lastSpellIdx > wand.deck_capacity) {
        if (settings.autoExpandOnPaste) {
          newCapacity = lastSpellIdx;
        } else {
          if (confirm(t('app.notification.insert_exceed_capacity_confirm', { lastIdx: lastSpellIdx, capacity: wand.deck_capacity }))) {
            newCapacity = lastSpellIdx;
          }
        }
      }
      updateWand(targetWandSlot, { spells: finalSpellsObj, deck_capacity: newCapacity }, t('app.notification.insert_spell_sequence'), newSpellsList.filter(s => s));
      return true;
    }
  }, [spellDb, settings, activeTabId, activeTab, spellNameToId, performAction, syncWand, t, updateWand, hoveredSlotRef, selectionRef]);

  const copyToClipboard = useCallback(async (isCut = false) => {
    let wandSlot: string;
    let indices: number[];

    const sel = selectionRef.current;
    const hovered = hoveredSlotRef.current;

    if (sel && hovered && hovered.wandSlot === sel.wandSlot && sel.indices.includes(hovered.idx)) {
      wandSlot = sel.wandSlot;
      indices = sel.indices;
    } else if (hovered && hovered.wandSlot) {
      wandSlot = hovered.wandSlot;
      indices = [hovered.idx];
    } else if (sel) {
      wandSlot = sel.wandSlot;
      indices = sel.indices;
    } else {
      return;
    }

    const wand = activeTab.wands[wandSlot];
    if (!wand) return;

    // Sort indices to get a clean sequence
    const sortedIndices = [...indices].sort((a, b) => a - b);

    let textToCopy = "";
    // Get sequence including empty slots (empty strings)
    const sequence = sortedIndices.map(i => {
      if (i < 0) return wand.always_cast[(-i) - 1] || "";
      return wand.spells[i.toString()] || "";
    });

    if (sequence.length === 1 && !sequence[0] && !isCut) return;

    if (sortedIndices.length >= wand.deck_capacity && sortedIndices.length > 1) {
      // Full wand format
      textToCopy = `{{Wand2
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
| spells       = ${sequence.join(',')}
}}`;
    } else {
      // Spell sequence format (Preserve empty slots as ,,)
      textToCopy = sequence.join(',');
    }

    if (textToCopy !== undefined) {
      await navigator.clipboard.writeText(textToCopy);
      setNotification({ msg: isCut ? t('app.notification.cut_to_clipboard') : t('app.notification.copied_to_clipboard'), type: 'success' });

      if (isCut) {
        const newSpells = { ...wand.spells };
        const newSpellUses = { ...(wand.spell_uses || {}) };
        indices.forEach(i => {
          delete newSpells[i.toString()];
          delete newSpellUses[i.toString()];
        });
        updateWand(wandSlot, { spells: newSpells, spell_uses: newSpellUses }, t('app.notification.cut_spell'), sequence.filter(s => s));
      }
    }
  }, [activeTab, selectionRef, hoveredSlotRef, t, setNotification, updateWand]);

  const pasteFromClipboard = useCallback(async (forceTarget?: { slot: string, idx: number }) => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes('image/png')) {
          const blob = await item.getType('image/png');
          const file = new File([blob], "pasted.png", { type: "image/png" });
          const metadata = await readMetadataFromPng(file);
          if (metadata && (metadata.includes('{{Wand2') || metadata.includes('{{Wand'))) {
            return await importFromText(metadata, forceTarget);
          }
        }
        if (item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain');
          const text = (await blob.text()).trim();
          if (text) {
            return await importFromText(text, forceTarget);
          }
        }
      }
    } catch (err) {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) return importFromText(text, forceTarget);
    }
    return false;
  }, [importFromText]);

  return { importFromText, copyToClipboard, pasteFromClipboard, readMetadataFromPng };
};
