import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Wand2,
  Zap,
  Settings,
  Play,
  Share2,
  Download,
  Upload,
  Plus,
  X,
  Monitor,
  MonitorOff,
  ChevronRight,
  Layers,
  Maximize2,
  Minimize2,
  Cpu,
  Trash2,
  Activity,
  Timer,
  Battery,
  ChevronDown,
  ChevronUp,
  Search,
  Star,
  Info,
  RefreshCw,
  Lock,
  Unlock,
  History,
  Copy,
  Scissors,
  Clipboard
} from 'lucide-react';

// --- Internal ---
import { SpellInfo, WandData, HistoryItem, Tab, AppSettings, EvalResponse } from './types';
import { DEFAULT_WAND, DEFAULT_SPELL_TYPES, DEFAULT_SPELL_GROUPS } from './constants';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { WandCard } from './components/WandCard';
import { HistoryPanel } from './components/HistoryPanel';
import { SettingsModal } from './components/SettingsModal';
import { ConflictModal } from './components/ConflictModal';
import { SpellPicker } from './components/SpellPicker';
import { CompactStat } from './components/Common';
import WandEvaluator from './components/WandEvaluator';

const cloneTabs = (tbs: any[]): any[] => {
  return tbs.map(t => ({
    ...t,
    wands: JSON.parse(JSON.stringify(t.wands)),
    expandedWands: new Set(t.expandedWands)
  }));
};

function App() {
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const saved = localStorage.getItem('twwe_tabs') || localStorage.getItem('wand2h_tabs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((t: any) => ({
            ...t,
            expandedWands: new Set(t.expandedWands || []),
            past: Array.isArray(t.past) ? t.past : [],
            future: Array.isArray(t.future) ? t.future : []
          }));
        }
      } catch (e) {
        console.error("Failed to load tabs from localStorage:", e);
      }
    }
    return [
      { id: '1', name: '游戏同步', isRealtime: true, wands: { '1': { ...DEFAULT_WAND } }, expandedWands: new Set(['1']), past: [], future: [] },
      { id: '2', name: '自由沙盒', isRealtime: false, wands: { '1': { ...DEFAULT_WAND } }, expandedWands: new Set(['1']), past: [], future: [] }
    ];
  });

  const [activeTabId, setActiveTabId] = useState('1');
  const [spellDb, setSpellDb] = useState<Record<string, SpellInfo>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [evalResults, setEvalResults] = useState<Record<string, EvalResponse>>({});
  const evalTimersRef = useRef<Record<string, any>>({});

  // Settings with Persistence
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('twwe_settings') || localStorage.getItem('wand2h_settings');
    const defaults: AppSettings = {
      commonLimit: 10,
      categoryLimit: 10,
      allowCompactEdit: false,
      pickerRowHeight: 32,
      themeColors: [
        'from-blue-500/10 to-blue-600/20',
        'from-green-500/10 to-green-600/20',
        'from-purple-500/10 to-purple-600/20',
        'from-orange-500/10 to-orange-600/20'
      ],
      wrapLimit: 20,
      hideLabels: false,
      conflictStrategy: 'ask',
      autoExpandOnPaste: true,
      defaultWandStats: {},
      numCasts: 10,
      autoHideThreshold: 20,
      showSpellCharges: false,
      unlimitedSpells: true,
      groupIdenticalCasts: true,
      editorSpellGap: 6,
      showStatsInFrames: true,
      showLegacyWandButton: false,
      exportHistory: true,
      spellTypes: DEFAULT_SPELL_TYPES,
      spellGroups: DEFAULT_SPELL_GROUPS
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { 
          ...defaults, 
          ...parsed,
          // Ensure nested objects exist
          defaultWandStats: parsed.defaultWandStats || {}
        };
      } catch (e) {
        console.error("Failed to load settings from localStorage:", e);
      }
    }
    return defaults;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const lastLocalUpdateRef = useRef<number>(0);
  const preloadedRef = useRef<boolean>(false);
  const wasConnectedRef = useRef<boolean>(false); // Track connection state change

  // --- Context Menus ---
  const [tabMenu, setTabMenu] = useState<{ x: number, y: number, tabId: string } | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'info' | 'success' } | null>(null);

  const spellNameToId = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(spellDb).forEach(([id, info]) => {
      // 1. Normalize ID (e.g. "LIGHT_BULLET" -> "lightbullet")
      const idNorm = id.toLowerCase().replace(/[^a-z0-9]/g, '');
      map[idNorm] = id;
      
      // 2. Normalize Localized Name (e.g. "二重咒语" -> "二重咒语")
      if (info.name) {
        const nameNorm = info.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (nameNorm) map[nameNorm] = id;
      }

      // 3. Normalize English Name (e.g. "Double Spell" -> "doublespell")
      if (info.en_name) {
        const enNorm = info.en_name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (enNorm) map[enNorm] = id;
      }

      // 4. Heuristics for internal IDs with underscores
      if (id.includes('_')) {
        const idSimple = id.toLowerCase().replace(/_/g, '');
        map[idSimple] = id;
      }
    });

    return map;
  }, [spellDb]);

  // --- Conflict Resolution ---
  const lastKnownGameWandsRef = useRef<Record<string, Record<string, WandData>>>({});
  const [conflict, setConflict] = useState<{
    tabId: string;
    gameWands: Record<string, WandData>;
  } | null>(null);

  // --- History (Undo/Redo) ---
  const performAction = (action: (prevWands: Record<string, WandData>) => Record<string, WandData>, actionName = '未知操作', icons?: string[], saveHistory = true) => {
    setTabs(prevTabs => prevTabs.map(t => {
      if (t.id === activeTabId) {
        const nextWands = action(t.wands);
        
        if (!saveHistory) return { ...t, wands: nextWands };

        const newItem: HistoryItem = {
          id: Math.random().toString(36).substr(2, 9),
          wands: JSON.parse(JSON.stringify(t.wands)), // 记录旧状态以便回退
          name: actionName,
          icons,
          timestamp: Date.now()
        };

        return {
          ...t,
          wands: nextWands,
          past: [...t.past.slice(-49), newItem],
          future: [] // 执行新操作，清空未来
        };
      }
      return t;
    }));
  };

  const undo = useCallback(() => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId && t.past && t.past.length > 0) {
        const lastAction = t.past[t.past.length - 1];
        const currentStateItem: HistoryItem = {
          id: 'redo-' + Date.now(),
          wands: JSON.parse(JSON.stringify(t.wands)),
          name: lastAction.name,
          icons: lastAction.icons,
          timestamp: Date.now()
        };
        return {
          ...t,
          wands: lastAction.wands,
          past: t.past.slice(0, -1),
          future: [currentStateItem, ...(t.future || [])]
        };
      }
      return t;
    }));
  }, [activeTabId]);

  const redo = useCallback(() => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId && t.future && t.future.length > 0) {
        const nextAction = t.future[0];
        const currentStateItem: HistoryItem = {
          id: 'undo-' + Date.now(),
          wands: JSON.parse(JSON.stringify(t.wands)),
          name: nextAction.name,
          icons: nextAction.icons,
          timestamp: Date.now()
        };
        return {
          ...t,
          wands: nextAction.wands,
          past: [...(t.past || []), currentStateItem],
          future: t.future.slice(1)
        };
      }
      return t;
    }));
  }, [activeTabId]);

  const jumpToPast = (targetPastIndex: number) => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId && t.past && t.past[targetPastIndex]) {
        const targetItem = t.past[targetPastIndex];
        const newFuture = [...t.past.slice(targetPastIndex + 1), ...(t.future || [])];
        const currentAsItem: HistoryItem = {
          id: 'jump-p-' + Date.now(),
          wands: JSON.parse(JSON.stringify(t.wands)),
          name: t.past[t.past.length - 1].name,
          icons: t.past[t.past.length - 1].icons,
          timestamp: Date.now()
        };

        return {
          ...t,
          wands: targetItem.wands,
          past: t.past.slice(0, targetPastIndex),
          future: [currentAsItem, ...newFuture]
        };
      }
      return t;
    }));
  };

  const jumpToFuture = (targetFutureIndex: number) => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId && t.future && t.future[targetFutureIndex]) {
        const targetItem = t.future[targetFutureIndex];
        const transitionItems = t.future.slice(0, targetFutureIndex);
        const currentAsItem: HistoryItem = {
          id: 'jump-f-' + Date.now(),
          wands: JSON.parse(JSON.stringify(t.wands)),
          name: targetItem.name,
          icons: targetItem.icons,
          timestamp: Date.now()
        };

        return {
          ...t,
          wands: targetItem.wands,
          past: [...(t.past || []), currentAsItem, ...transitionItems],
          future: t.future.slice(targetFutureIndex + 1)
        };
      }
      return t;
    }));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'y')) {
        if (e.key === 'z') {
          if (e.shiftKey) redo();
          else undo();
          e.preventDefault();
        } else if (e.key === 'y') {
          redo();
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  useEffect(() => {
    const handleClose = (e: MouseEvent) => {
      setTabMenu(null);
      // Clear selection only if clicking outside the wand area
      if (!(e.target as HTMLElement).closest('.glass-card')) {
        setSelection(null);
      }
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
    };
  }, []);

  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  // Picker State
  const [pickerConfig, setPickerConfig] = useState<{
    wandSlot: string;
    spellIdx: string;
    x: number;
    y: number;
  } | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerExpandedGroups, setPickerExpandedGroups] = useState<Set<number>>(new Set());

  // Clipboard State
  const [clipboard, setClipboard] = useState<{ type: 'wand', data: WandData } | null>(null);
  const [selection, setSelection] = useState<{ wandSlot: string, indices: number[], startIdx: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState<{ wandSlot: string, idx: number, isRightHalf: boolean } | null>(null);
  const hoveredSlotRef = useRef(hoveredSlot);
  useEffect(() => { hoveredSlotRef.current = hoveredSlot; }, [hoveredSlot]);

  const selectionRef = useRef(selection);
  useEffect(() => { selectionRef.current = selection; }, [selection]);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);

  const requestEvaluation = useCallback(async (tabId: string, slot: string, wand: WandData) => {
    const spells: string[] = [];
    // wand_eval_tree expects an array of spell IDs, including empty strings for slots
    for (let i = 1; i <= wand.deck_capacity; i++) {
      spells.push(wand.spells[i.toString()] || "");
    }

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...wand,
          spells,
          spell_uses: wand.spell_uses || {},
          number_of_casts: settings.numCasts || 10,
          unlimited_spells: settings.unlimitedSpells
        })
      });
      const data = await res.json();
      if (data.success) {
        setEvalResults(prev => ({ ...prev, [`${tabId}-${slot}`]: data.data }));
      }
    } catch (e) {
      console.error("Evaluation failed:", e);
    }
  }, [settings.numCasts, settings.unlimitedSpells]);

  useEffect(() => {
    if (!activeTab || !activeTab.expandedWands) return;
    
    activeTab.expandedWands.forEach(slot => {
      const wand = activeTab.wands[slot];
      if (!wand) return;

      const key = `${activeTab.id}-${slot}`;
      if (evalTimersRef.current[key]) clearTimeout(evalTimersRef.current[key]);

      evalTimersRef.current[key] = setTimeout(() => {
        requestEvaluation(activeTab.id, slot, wand);
      }, 500);
    });
  }, [activeTab.wands, activeTab.expandedWands, activeTab.id, requestEvaluation, settings.numCasts, settings.unlimitedSpells]);

  // --- Frequency Analysis (Common Spells) ---
  const spellStats = useMemo(() => {
    const counts: Record<string, number> = {};
    tabs.forEach(tab => {
      Object.values(tab.wands).forEach(wand => {
        Object.values(wand.spells).forEach(sid => {
          counts[sid] = (counts[sid] || 0) + 1;
        });
      });
    });

    const getTopN = (list: SpellInfo[], n: number, forceAll = false) => {
      const sorted = [...list].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
      return forceAll ? sorted : sorted.slice(0, n);
    };

    const allSpells = Object.values(spellDb);
    const overall = getTopN(allSpells, settings.commonLimit, pickerExpandedGroups.has(-1));

    const categories = settings.spellGroups.map((group, idx) => {
      const filtered = allSpells.filter(s => group.types.includes(s.type));
      return getTopN(filtered, settings.categoryLimit, pickerExpandedGroups.has(idx));
    });

    return { overall, categories };
  }, [tabs, spellDb, settings.commonLimit, settings.categoryLimit, settings.spellGroups, pickerExpandedGroups]);

  const searchResults = useMemo(() => {
    if (!pickerSearch) return null;
    const query = pickerSearch.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!query) return null;

    const allSpells = Object.values(spellDb);
    
    // Score-based search
    const scored = allSpells.map(s => {
      let score = 0;
      const id = s.id.toLowerCase();
      const name = s.name.toLowerCase();
      const en = (s.en_name || "").toLowerCase();
      const py = (s.pinyin || "").toLowerCase();
      const init = (s.pinyin_initials || "").toLowerCase();

      // Exact matches
      if (id === query) score += 100;
      else if (name === query) score += 90;
      else if (en === query) score += 85;
      
      // Starts with
      else if (id.startsWith(query)) score += 70;
      else if (name.startsWith(query)) score += 65;
      else if (en.startsWith(query)) score += 60;
      else if (init.startsWith(query)) score += 55;
      else if (py.startsWith(query)) score += 50;

      // Includes
      else if (id.includes(query)) score += 30;
      else if (name.includes(query)) score += 25;
      else if (en.includes(query)) score += 20;
      else if (init.includes(query)) score += 15;
      else if (py.includes(query)) score += 10;

      return { spell: s, score };
    }).filter(x => x.score > 0);

    // Sort by score descending, then by original order/id
    scored.sort((a, b) => b.score - a.score || a.spell.id.localeCompare(b.spell.id));

    return [scored.map(x => x.spell)];
  }, [pickerSearch, spellDb]);

  // --- Selection & Clipboard Logic ---
  const handleSlotMouseDown = (wandSlot: string, idx: number) => {
    setIsSelecting(true);
    setSelection({ wandSlot, indices: [idx], startIdx: idx });
  };

  const handleSlotMouseEnter = (wandSlot: string, idx: number) => {
    if (isSelecting && selection && selection.wandSlot === wandSlot) {
      const start = selection.startIdx;
      const end = idx;
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      const newIndices = [];
      for (let i = min; i <= max; i++) newIndices.push(i);
      setSelection({ ...selection, indices: newIndices });
    }
  };

  const handleSlotMouseMove = (e: React.MouseEvent, wandSlot: string, idx: number) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isRightHalf = e.clientX > rect.left + rect.width / 2;
    setHoveredSlot({ wandSlot, idx, isRightHalf });
  };

  const handleSlotMouseLeave = () => {
    setHoveredSlot(null);
  };

  const copyToClipboard = async (isCut = false) => {
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
    const sequence = sortedIndices.map(i => wand.spells[i.toString()] || "");

    // If it's a single empty slot being copied, don't do anything unless it's a cut operation?
    // Actually, copying an empty slot might be useful to "paste" an empty space.
    // But usually people want to copy a spell.
    if (sequence.length === 1 && !sequence[0] && !isCut) return;

    if (sortedIndices.length >= wand.deck_capacity && sortedIndices.length > 1) {
      // Full wand format
      textToCopy = `{{Wand2
| wandCard     = Yes
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
      setNotification({ msg: isCut ? '已剪切到剪贴板' : '已复制到剪贴板', type: 'success' });
      
      if (isCut) {
        const newSpells = { ...wand.spells };
        const newSpellUses = { ...(wand.spell_uses || {}) };
        indices.forEach(i => {
          delete newSpells[i.toString()];
          delete newSpellUses[i.toString()];
        });
        updateWand(wandSlot, { spells: newSpells, spell_uses: newSpellUses }, '剪切法术', sequence.filter(s => s));
      }
    }
  };

  const pasteFromClipboard = async (forceTarget?: { slot: string, idx: number }) => {
    const text = (await navigator.clipboard.readText()).trim();
    if (!text) return false;

    const isWand2Data = text.includes('{{Wand2');
    const isWikiWand = text.includes('{{Wand') && !isWand2Data;
    const isWandData = isWand2Data || isWikiWand;
    const isSpellSeq = text.includes(',') || Object.keys(spellDb).some(id => text.includes(id));

    if (!isWandData && !isSpellSeq) return false;

    // Determine where to paste
    let targetWandSlot = forceTarget?.slot;
    let startIdx = forceTarget?.idx;

    if (!targetWandSlot && hoveredSlotRef.current) {
      targetWandSlot = hoveredSlotRef.current.wandSlot;
      startIdx = hoveredSlotRef.current.idx + (hoveredSlotRef.current.isRightHalf ? 1 : 0);
    } else if (!targetWandSlot && selectionRef.current) {
      targetWandSlot = selectionRef.current.wandSlot;
      startIdx = Math.min(...selectionRef.current.indices);
    }

    if (!targetWandSlot || !startIdx) {
      // If no target slot but it's Wand data, create a new wand instead of failing
      if (isWandData) {
        const nextSlot = (Math.max(0, ...Object.keys(activeTab.wands).map(Number)) + 1).toString();
        
        const getVal = (key: string) => {
          // Use boundary logic to avoid spell1 matching spell10
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
            if (sid) newSpells[(i + 1).toString()] = sid;
          });
          deckCapacity = parseInt(getVal('capacity') || '0') || DEFAULT_WAND.deck_capacity;

          const acStr = getVal('alwaysCasts');
          if (acStr) {
            acStr.split(',').forEach(s => {
              const sid = s.trim();
              if (sid) alwaysCasts.push(sid);
            });
          }
        } else {
          // Wiki Wand
          deckCapacity = parseInt(getVal('capacity') || '0') || DEFAULT_WAND.deck_capacity;
          for (let i = 1; i <= Math.max(deckCapacity, 100); i++) {
            const name = getVal(`spell${i}`);
            if (name) {
              const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
              const id = spellNameToId[norm];
              if (id) newSpells[i.toString()] = id;
            }
          }
          const acName = getVal('alwaysCasts');
          if (acName) {
            const norm = acName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const id = spellNameToId[norm];
            if (id) alwaysCasts.push(id);
          }
        }

        const newWand: WandData = {
          ...DEFAULT_WAND,
          shuffle_deck_when_empty: isWand2Data ? (getVal('shuffle') === 'true') : (getVal('shuffle')?.toLowerCase() === 'yes'),
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
        }), `从粘贴创建新法杖 (槽位 ${nextSlot})`);

        if (activeTab.isRealtime) {
          syncWand(nextSlot, newWand);
        }

        setTabs(prev => prev.map(t => t.id === activeTabId ? {
          ...t,
          expandedWands: new Set([...t.expandedWands, nextSlot])
        } : t));

        setNotification({ msg: `已从剪贴板粘贴为新法杖 (槽位 ${nextSlot})`, type: 'success' });
        return true;
      }
      return false;
    }

    const wand = activeTab.wands[targetWandSlot] || { ...DEFAULT_WAND };

    if (isWandData) {
      // --- Template Parsing (Overwrite style) ---
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
          if (sid) newSpells[(i + 1).toString()] = sid;
        });
        deckCapacity = parseInt(getVal('capacity') || '0') || deckCapacity;

        const acStr = getVal('alwaysCasts');
        if (acStr) {
          acStr.split(',').forEach(s => {
            const sid = s.trim();
            if (sid) alwaysCasts.push(sid);
          });
        }
      } else {
        // Wiki Wand
        deckCapacity = parseInt(getVal('capacity') || '0') || deckCapacity;
        for (let i = 1; i <= Math.max(deckCapacity, 100); i++) {
          const val = getVal(`spell${i}`);
          if (val) {
            const norm = val.toLowerCase().replace(/[^a-z0-9]/g, '');
            const id = spellNameToId[norm];
            if (id) newSpells[i.toString()] = id;
          }
        }
        const acName = getVal('alwaysCasts');
        if (acName) {
          const norm = acName.toLowerCase().replace(/[^a-z0-9]/g, '');
          const id = spellNameToId[norm];
          if (id) alwaysCasts.push(id);
        }
      }
      
      const updates: Partial<WandData> = {
        shuffle_deck_when_empty: isWand2Data ? (getVal('shuffle') === 'true') : (getVal('shuffle')?.toLowerCase() === 'yes'),
        mana_max: parseFloat(getVal('manaMax') || '0') || wand.mana_max,
        mana_charge_speed: parseFloat(getVal('manaCharge') || '0') || wand.mana_charge_speed,
        reload_time: Math.round(parseFloat(getVal('rechargeTime') || '0') * 60) || wand.reload_time,
        fire_rate_wait: Math.round(parseFloat(getVal('castDelay') || '0') * 60) || wand.fire_rate_wait,
        deck_capacity: deckCapacity,
        spread_degrees: parseFloat(getVal('spread') || '0') || wand.spread_degrees,
        speed_multiplier: parseFloat(getVal('speed') || '1') || wand.speed_multiplier,
        always_cast: alwaysCasts
      };

      updateWand(targetWandSlot, { ...updates, spells: newSpells }, '粘贴法杖数据', Object.values(newSpells));
      return true;
    } else {
      // --- Spell Sequence Parsing (Insertion style) ---
      const newSpellsList = text.split(',').map(s => s.trim());
      
      // Get all existing spells as a sequence
      const existingSpells: (string | null)[] = [];
      const maxIdx = Math.max(wand.deck_capacity, ...Object.keys(wand.spells).map(Number));
      for (let i = 1; i <= maxIdx; i++) {
        existingSpells.push(wand.spells[i.toString()] || null);
      }

      // Perform insertion
      // Splice in the new spells at startIdx - 1
      const head = existingSpells.slice(0, startIdx - 1);
      const tail = existingSpells.slice(startIdx - 1);
      const combined = [...head, ...newSpellsList, ...tail];

      // Re-map to object
      const finalSpellsObj: Record<string, string> = {};
      combined.forEach((sid, i) => {
        if (sid) finalSpellsObj[(i + 1).toString()] = sid;
      });

      // Handle capacity
      let newCapacity = wand.deck_capacity;
      const lastSpellIdx = combined.reduce((acc, val, idx) => val !== null ? idx + 1 : acc, 0);
      
      if (lastSpellIdx > wand.deck_capacity) {
        if (settings.autoExpandOnPaste) {
          newCapacity = lastSpellIdx;
        } else {
          if (confirm(`插入法术后超出了当前容量 (${lastSpellIdx} > ${wand.deck_capacity})，是否自动扩容？`)) {
            newCapacity = lastSpellIdx;
          } else {
            // Keep capacity, but the re-mapping already shifted things, so we just clip
          }
        }
      }

      updateWand(targetWandSlot, { spells: finalSpellsObj, deck_capacity: newCapacity }, '插入法术序列', newSpellsList.filter(s => s));
      return true;
    }
  };

  const insertEmptySlot = () => {
    let targetWandSlot = hoveredSlotRef.current?.wandSlot;
    let startIdx = hoveredSlotRef.current ? (hoveredSlotRef.current.idx + (hoveredSlotRef.current.isRightHalf ? 1 : 0)) : null;

    if (!targetWandSlot && selectionRef.current) {
      targetWandSlot = selectionRef.current.wandSlot;
      startIdx = Math.min(...selectionRef.current.indices);
    }

    if (!targetWandSlot || startIdx === null) return;

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

    updateWand(targetWandSlot, { spells: finalSpellsObj, deck_capacity: newCapacity }, '插入空法术位');
  };

  useEffect(() => {
    const handleMouseUp = () => setIsSelecting(false);
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Intercept paste globally if it's wand data
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const success = await pasteFromClipboard();
        if (success) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if ((e.ctrlKey || e.metaKey)) {
        if (e.key === 'h') {
          e.preventDefault();
          setIsHistoryOpen(prev => !prev);
        } else if (e.key === 'a') {
          const targetSlot = selectionRef.current?.wandSlot || Object.keys(activeTab.wands).find(slot => activeTab.expandedWands.has(slot));
          if (targetSlot) {
            e.preventDefault();
            const wand = activeTab.wands[targetSlot];
            if (wand) {
              const allIndices = [];
              for (let i = 1; i <= wand.deck_capacity; i++) allIndices.push(i);
              setSelection({ wandSlot: targetSlot, indices: allIndices, startIdx: 1 });
            }
          }
        } else if (e.key === 'c') {
          e.preventDefault();
          copyToClipboard();
        } else if (e.key === 'x') {
          e.preventDefault();
          copyToClipboard(true);
        } else if (e.key === 'v') {
          e.preventDefault();
          pasteFromClipboard();
        } else if (e.key === 'z') {
          // Handled by undo/redo useEffect
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = selectionRef.current;
        const hovered = hoveredSlotRef.current;
        
        let targetSlot: string | null = null;
        let targetIndices: number[] = [];

        if (sel && hovered && hovered.wandSlot === sel.wandSlot && sel.indices.includes(hovered.idx)) {
          targetSlot = sel.wandSlot;
          targetIndices = sel.indices;
        } else if (hovered && hovered.wandSlot) {
          targetSlot = hovered.wandSlot;
          targetIndices = [hovered.idx];
        } else if (sel && sel.indices.length > 0) {
          targetSlot = sel.wandSlot;
          targetIndices = sel.indices;
        }

        if (targetSlot) {
          e.preventDefault();
          const wand = activeTab.wands[targetSlot];
          if (wand) {
            const newSpells = { ...wand.spells };
            const newSpellUses = { ...(wand.spell_uses || {}) };
            targetIndices.forEach(idx => {
              delete newSpells[idx];
              delete newSpellUses[idx];
            });
            updateWand(targetSlot, { spells: newSpells, spell_uses: newSpellUses }, '删除法术');
          }
        }
      } else if (e.key === ' ') {
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          insertEmptySlot();
        }
      }

      if (e.key === 'Escape') {
        setSelection(null);
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab, settings, spellDb]);

  // --- Effects ---
  useEffect(() => {
    fetchSpellDb();
    const statusTimer = setInterval(checkStatus, 3000);
    return () => clearInterval(statusTimer);
  }, []);

  // Preload Images to solve the flickering issue
  useEffect(() => {
    const spells = Object.values(spellDb);
    if (spells.length === 0 || preloadedRef.current) return;

    console.log(`[Performance] Preloading ${spells.length} spell icons...`);

    // Use a small timeout to let the UI settle before heavy preloading
    const timer = setTimeout(() => {
      let loaded = 0;
      spells.forEach(s => {
        const img = new Image();
        img.onload = () => {
          loaded++;
          if (loaded === spells.length) {
            console.log(`[Performance] All ${spells.length} icons preloaded and cached.`);
          }
        };
        img.src = `/api/icon/${s.icon}`;
      });
      preloadedRef.current = true;
    }, 1000);

    return () => clearTimeout(timer);
  }, [spellDb]);

  useEffect(() => {
    localStorage.setItem('twwe_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const toSave = tabs.map(t => ({ ...t, expandedWands: Array.from(t.expandedWands) }));
    localStorage.setItem('twwe_tabs', JSON.stringify(toSave));
  }, [tabs]);

  useEffect(() => {
    let pullTimer: any;
    if (activeTab.isRealtime && isConnected) {
      pullTimer = setInterval(pullData, 1000);
    }
    return () => clearInterval(pullTimer);
  }, [activeTabId, activeTab.isRealtime, isConnected]);

  useEffect(() => {
    if (isConnected && !wasConnectedRef.current) {
      console.log('[Sync] Game connected/restarted. Clearing session cache and forcing pull...');
      lastKnownGameWandsRef.current = {};
      pullData(true);
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected]);

  // --- Actions ---
  const fetchSpellDb = async () => {
    try {
      const res = await fetch('/api/fetch-spells');
      const data = await res.json();
      if (data.success && data.spells) {
        // Fix: Ensure the spell objects have the ID inside them
        const enriched: Record<string, SpellInfo> = {};
        Object.entries(data.spells as Record<string, any>).forEach(([id, info]) => {
          enriched[id] = { ...info, id };
        });
        setSpellDb(enriched);
      }
    } catch (e) {
      console.error("Failed to fetch spells:", e);
    }
  };

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setIsConnected(data.connected);
    } catch { setIsConnected(false); }
  };

  const pullData = async (force = false) => {
    // Skip pull if we just updated locally (avoid race condition), unless forced
    if (!force && Date.now() - lastLocalUpdateRef.current < 3000) return;

    try {
      const res = await fetch('/api/pull');
      const data = await res.json();
      if (data.success) {
        const gameWands = data.wands;
        const lastKnown = lastKnownGameWandsRef.current[activeTabId];
        const currentWeb = activeTab.wands;

        const gameChanged = lastKnown && JSON.stringify(gameWands) !== JSON.stringify(lastKnown);
        const webChanged = lastKnown && JSON.stringify(currentWeb) !== JSON.stringify(lastKnown);
        const inSync = JSON.stringify(gameWands) === JSON.stringify(currentWeb);

        const applyGameWands = (tabId: string, wands: Record<string, WandData>, name: string) => {
          performAction(() => wands, name, [], force);
          lastKnownGameWandsRef.current[tabId] = JSON.parse(JSON.stringify(wands));
        };

        if (inSync) {
          // Both sides are identical, just update the reference point
          lastKnownGameWandsRef.current[activeTabId] = JSON.parse(JSON.stringify(gameWands));
          return;
        }

        if (gameChanged && webChanged) {
          // Double change -> Respect setting or ask
          if (settings.conflictStrategy === 'override_game') {
            // Web wins, push to game
            Object.entries(currentWeb).forEach(([slot, d]) => syncWand(slot, d));
            lastKnownGameWandsRef.current[activeTabId] = JSON.parse(JSON.stringify(currentWeb));
            setNotification({ msg: '已自动同步：网页修改已覆盖游戏', type: 'success' });
          } else if (settings.conflictStrategy === 'new_workflow') {
            // Game wins but as new workflow
            const id = Date.now().toString();
            setTabs(prev => [...prev, {
              id,
              name: `[同步保存] ${activeTab.name}`,
              isRealtime: false,
              wands: gameWands,
              expandedWands: new Set(Object.keys(gameWands)),
              past: [],
              future: []
            }]);
            lastKnownGameWandsRef.current[activeTabId] = JSON.parse(JSON.stringify(currentWeb));
            setNotification({ msg: '已自动同步：游戏状态已另存为新工作流', type: 'info' });
          } else {
            // Ask
            setConflict({ tabId: activeTabId, gameWands });
          }
        } else if (webChanged && !gameChanged) {
          // Only web changed -> If realtime, game should have been updated by syncWand
          // but if we were offline, we might need to push now
          if (activeTab.isRealtime) {
            Object.entries(currentWeb).forEach(([slot, d]) => syncWand(slot, d));
          }
          lastKnownGameWandsRef.current[activeTabId] = JSON.parse(JSON.stringify(currentWeb));
        } else if (gameChanged && !webChanged) {
          // Only game changed -> Pull normally
          // Optimization: If we recently updated locally, ignore game "changes" that might be stale data
          if (Date.now() - lastLocalUpdateRef.current < 5000) return;
          applyGameWands(activeTabId, gameWands, '从游戏同步数据');
        } else if (!lastKnown) {
          // First time seeing the game
          applyGameWands(activeTabId, gameWands, '初始同步');
        }
      }
    } catch { }
  };

  const toggleSync = (id: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, isRealtime: !t.isRealtime } : t));
  };

  const pushAllToGame = async () => {
    if (!isConnected) {
      setNotification({ msg: '未连接到游戏，无法推送', type: 'info' });
      return;
    }
    const wands = activeTab.wands;
    const entries = Object.entries(wands);
    if (entries.length === 0) return;

    try {
      // Use Promise.all for faster sync if many wands, but sequential is safer for Noita
      for (const [slot, data] of entries) {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            slot: parseInt(slot), 
            delete: false,
            ...data 
          })
        });
      }
      setNotification({ msg: `已将当前工作流的 ${entries.length} 根法杖推送到游戏`, type: 'success' });
    } catch (e) {
      setNotification({ msg: '推送失败', type: 'info' });
    }
  };

  const syncWand = async (slot: string, data: WandData | null, isDelete = false) => {
    if (!activeTab.isRealtime || !isConnected) return;
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          slot: parseInt(slot), 
          delete: isDelete,
          ...(data || {}) 
        })
      });
    } catch { }
  };

  const updateWand = (slot: string, updates: Partial<WandData>, actionName = '修改法杖', icons?: string[]) => {
    lastLocalUpdateRef.current = Date.now();
    performAction(prevWands => {
      const currentWand = prevWands[slot] || { ...DEFAULT_WAND };
      const newWand = { ...currentWand, ...updates };

      if (activeTab.isRealtime) {
        syncWand(slot, newWand);
      }

      return { ...prevWands, [slot]: newWand };
    }, actionName, icons);
  };

  const addNewTab = () => {
    const id = Date.now().toString();
    const defaultWand = { ...DEFAULT_WAND, ...settings.defaultWandStats };
    const newTab: Tab = {
      id,
      name: `新工作流 ${tabs.length + 1}`,
      isRealtime: false,
      wands: { '1': defaultWand },
      expandedWands: new Set(['1']),
      past: [],
      future: []
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(id);
  };

  const deleteTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;
    setTabs(prev => prev.filter(t => t.id !== id));
    if (activeTabId === id) setActiveTabId(tabs.find(t => t.id !== id)?.id || tabs[0].id);
  };

  const addWand = () => {
    const nextSlot = (Math.max(0, ...Object.keys(activeTab.wands).map(Number)) + 1).toString();
    const newWand = { ...DEFAULT_WAND, ...settings.defaultWandStats };
    lastLocalUpdateRef.current = Date.now();
    
    performAction(prevWands => ({
      ...prevWands,
      [nextSlot]: newWand
    }), `添加新法杖 (槽位 ${nextSlot})`);
    
    if (activeTab.isRealtime) {
      syncWand(nextSlot, newWand);
    }
    
    setTabs(prev => prev.map(t => t.id === activeTabId ? {
      ...t,
      expandedWands: new Set([...t.expandedWands, nextSlot])
    } : t));
  };

  const deleteWand = (slot: string) => {
    lastLocalUpdateRef.current = Date.now();
    performAction(prevWands => {
      const next = { ...prevWands };
      delete next[slot];
      return next;
    }, `删除法杖 (槽位 ${slot})`);

    if (activeTab.isRealtime) {
      syncWand(slot, null, true);
    }
  };

  const toggleExpand = (slot: string) => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        const next = new Set(t.expandedWands);
        if (next.has(slot)) next.delete(slot);
        else next.add(slot);
        return { ...t, expandedWands: next };
      }
      return t;
    }));
  };

  const copyWand = async (slot: string) => {
    const wand = activeTab.wands[slot];
    if (wand) {
      const data = JSON.parse(JSON.stringify(wand));
      setClipboard({ type: 'wand', data });

      // Generate Wand2 wiki text for system clipboard
      const wikiText = `{{Wand2
| wandCard     = Yes
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
        setNotification({ msg: '法杖数据已同步至系统剪贴板', type: 'success' });
      } catch (err) {
        console.error('Clipboard error:', err);
      }
    }
  };

  const copyLegacyWand = async (slot: string) => {
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
        setNotification({ msg: '已复制为老版Wand模板', type: 'success' });
      } catch (err) {
        console.error('Clipboard error:', err);
      }
    }
  };

  const cutWand = (slot: string) => {
    copyWand(slot);
    deleteWand(slot);
  };

  const pasteWand = (slot: string) => {
    if (clipboard?.type === 'wand') {
      updateWand(slot, clipboard.data);
    }
  };

  const openPicker = (wandSlot: string, spellIdx: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPickerConfig({
      wandSlot,
      spellIdx,
      x: rect.left,
      y: rect.bottom + 8
    });
    setPickerSearch('');
    setPickerExpandedGroups(new Set());
  };

  const pickSpell = (spellId: string | null) => {
    if (!pickerConfig) return;
    const { wandSlot, spellIdx } = pickerConfig;
    console.log(`[Picker] Picking ${spellId} for wand ${wandSlot} index ${spellIdx}`);

    lastLocalUpdateRef.current = Date.now();
    performAction(prevWands => {
      const wand = prevWands[wandSlot] || { ...DEFAULT_WAND };
      const newSpells = { ...wand.spells };
      if (spellId) newSpells[spellIdx] = spellId;
      else delete newSpells[spellIdx];

      const newWand = { ...wand, spells: newSpells };
      if (activeTab.isRealtime) syncWand(wandSlot, newWand);

      return { ...prevWands, [wandSlot]: newWand };
    }, spellId ? `更改法术` : `清除槽位 ${spellIdx}`, spellId ? [spellId] : []);
    setPickerConfig(null);
  };

  const exportAllData = () => {
    const data = {
      version: '1.0',
      timestamp: Date.now(),
      settings: settings,
      tabs: tabs.map(t => {
        const tabData = { ...t, expandedWands: Array.from(t.expandedWands) };
        if (!settings.exportHistory) {
          tabData.past = [];
          tabData.future = [];
        }
        return tabData;
      })
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `twwe_full_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const importAllData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('导入备份将覆盖当前所有工作流和设置，确定继续吗？')) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.settings) setSettings(data.settings);
        if (data.tabs) {
          const processedTabs = data.tabs.map((t: any) => ({
            ...t,
            expandedWands: new Set(t.expandedWands)
          }));
          setTabs(processedTabs);
          if (processedTabs.length > 0) setActiveTabId(processedTabs[0].id);
        }
        alert('全部数据导入成功！');
      } catch (err) { alert('导入失败: 文件格式不正确'); }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const importWorkflow = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const newTabId = Date.now().toString();
        const fileName = file.name.replace('.json', '');

        // Detect if it's a full workflow object or just a wands record
        const isFullWorkflow = data && data.type === 'twwe_workflow' && data.wands;
        const wands = isFullWorkflow ? data.wands : data;
        const past = (isFullWorkflow && settings.exportHistory) ? (data.past || []) : [];
        const future = (isFullWorkflow && settings.exportHistory) ? (data.future || []) : [];

        setTabs(prev => [
          ...prev,
          {
            id: newTabId,
            name: isFullWorkflow ? (data.name || fileName) : fileName,
            isRealtime: false,
            wands: wands,
            expandedWands: new Set(Object.keys(wands)),
            past: past,
            future: future
          }
        ]);
        setActiveTabId(newTabId);
      } catch (err) { alert('导入失败: 格式错误'); }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const exportWorkflow = (tabId?: string) => {
    const targetTab = tabId ? tabs.find(t => t.id === tabId) : activeTab;
    if (!targetTab) return;

    let exportData: any = targetTab.wands;
    if (settings.exportHistory) {
      exportData = {
        type: 'twwe_workflow',
        name: targetTab.name,
        wands: targetTab.wands,
        past: targetTab.past,
        future: targetTab.future
      };
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wand_workflow_${targetTab.name}.json`;
    a.click();
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden text-zinc-100 selection:bg-purple-500/30">
      <Header
        tabs={tabs}
        activeTabId={activeTabId}
        setActiveTabId={setActiveTabId}
        setTabs={setTabs}
        setTabMenu={setTabMenu}
        addNewTab={addNewTab}
        deleteTab={deleteTab}
        pullData={pullData}
        pushData={pushAllToGame}
        toggleSync={toggleSync}
        addWand={addWand}
        clipboard={clipboard}
        activeTab={activeTab}
        performAction={performAction}
        importWorkflow={importWorkflow}
        exportWorkflow={exportWorkflow}
        setIsSettingsOpen={setIsSettingsOpen}
        isConnected={isConnected}
      />

      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-black/40">
          {Object.entries(activeTab.wands).map(([slot, data]) => (
            <WandCard
              key={slot}
              slot={slot}
              data={data}
              activeTab={activeTab}
              isConnected={isConnected}
              spellDb={spellDb}
              selection={selection}
              hoveredSlot={hoveredSlot}
              clipboard={clipboard}
              toggleExpand={toggleExpand}
              deleteWand={deleteWand}
              copyWand={copyWand}
              copyLegacyWand={copyLegacyWand}
              pasteWand={pasteWand}
              updateWand={updateWand}
              handleSlotMouseDown={handleSlotMouseDown}
              handleSlotMouseEnter={handleSlotMouseEnter}
              handleSlotMouseMove={handleSlotMouseMove}
              handleSlotMouseLeave={handleSlotMouseLeave}
              openPicker={openPicker}
              setSelection={setSelection}
              evalData={evalResults[`${activeTab.id}-${slot}`]}
              settings={settings}
            />
          ))}

          {Object.keys(activeTab.wands).length === 0 && (
            <div className="h-64 flex flex-col items-center justify-center text-zinc-700 gap-4">
              <Activity size={32} className="opacity-20 animate-pulse" />
              <p className="font-black text-[10px] uppercase tracking-widest">等待数据同步或在该工作流添加法杖...</p>
            </div>
          )}
        </div>

        <SpellPicker
          pickerConfig={pickerConfig}
          onClose={() => setPickerConfig(null)}
          pickerSearch={pickerSearch}
          setPickerSearch={setPickerSearch}
          pickSpell={pickSpell}
          searchResults={searchResults}
          spellStats={spellStats}
          settings={settings}
          pickerExpandedGroups={pickerExpandedGroups}
          setPickerExpandedGroups={setPickerExpandedGroups}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          setSettings={setSettings}
          onImport={importAllData}
          onExport={exportAllData}
        />

        {tabMenu && (
          <div
            className="fixed z-[200] w-48 bg-zinc-900 border border-white/10 rounded-lg shadow-2xl py-1 animate-in fade-in zoom-in duration-100"
            style={{ top: tabMenu.y, left: tabMenu.x }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 border-b border-white/5 mb-1">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">工作流选项</span>
            </div>
            
            <button
              onClick={() => {
                toggleSync(tabMenu.tabId);
                setTabMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/5 flex items-center gap-2"
            >
              <Activity size={12} className={tabs.find(t => t.id === tabMenu.tabId)?.isRealtime ? "text-green-500" : "text-zinc-500"} />
              {tabs.find(t => t.id === tabMenu.tabId)?.isRealtime ? '关闭自动同步' : '开启自动同步'}
            </button>

            <button
              onClick={() => {
                const tab = tabs.find(t => t.id === tabMenu.tabId);
                const newName = prompt('重命名工作流:', tab?.name);
                if (newName) {
                  setTabs(prev => prev.map(t => t.id === tabMenu.tabId ? { ...t, name: newName } : t));
                }
                setTabMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/5 flex items-center gap-2"
            >
              <RefreshCw size={12} className="text-zinc-500" /> 重命名
            </button>

            <button
              onClick={() => {
                exportWorkflow(tabMenu.tabId);
                setTabMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/5 flex items-center gap-2"
            >
              <Download size={12} className="text-zinc-500" /> 导出此工作流 (.json)
            </button>

            <div className="h-px bg-white/5 my-1" />

            <button
              onClick={() => {
                setIsHistoryOpen(true);
                setTabMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/5 flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <History size={12} className="text-indigo-400" /> 打开历史记录面板
              </div>
              <span className="text-[9px] text-zinc-500 font-mono group-hover:text-zinc-400">Ctrl+H</span>
            </button>

            <button
              onClick={() => {
                if (confirm('确定要清除所有历史记录吗？(无法撤销)')) {
                  setTabs(prev => prev.map(t => t.id === tabMenu.tabId ? { ...t, past: [], future: [] } : t));
                }
                setTabMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-400/10 flex items-center gap-2"
            >
              <Trash2 size={12} /> 清除历史
            </button>
          </div>
        )}

        <ConflictModal
          conflict={conflict}
          activeTab={activeTab}
          onResolve={(strategy) => {
            if (strategy === 'web') {
              Object.entries(activeTab.wands).forEach(([slot, d]) => syncWand(slot, d));
              lastKnownGameWandsRef.current[conflict!.tabId] = JSON.parse(JSON.stringify(activeTab.wands));
              setConflict(null);
            } else if (strategy === 'game') {
              performAction(() => conflict!.gameWands, '冲突解决: 使用游戏数据覆盖');
              lastKnownGameWandsRef.current[conflict!.tabId] = JSON.parse(JSON.stringify(conflict!.gameWands));
              setConflict(null);
            } else if (strategy === 'both') {
              const id = Date.now().toString();
              setTabs(prev => [...prev, {
                id,
                name: `[备份] ${activeTab.name}`,
                isRealtime: false,
                wands: conflict!.gameWands,
                expandedWands: new Set(Object.keys(conflict!.gameWands)),
                past: [],
                future: []
              }]);
              lastKnownGameWandsRef.current[conflict!.tabId] = JSON.parse(JSON.stringify(activeTab.wands));
              setConflict(null);
            }
          }}
        />

        <HistoryPanel
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          activeTab={activeTab}
          spellDb={spellDb}
          onJumpPast={jumpToPast}
          onJumpFuture={jumpToFuture}
          onUndo={undo}
          onRedo={redo}
        />
      </main>

      <Footer
        isConnected={isConnected}
        activeTab={activeTab}
        tabsCount={tabs.length}
        notification={notification}
      />
    </div>
  );
}

export default App;
