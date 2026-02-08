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
  Clipboard,
  Library
} from 'lucide-react';

// --- Internal ---
import { checkPinyinFuzzy } from './lib/searchUtils';
import { SpellInfo, WandData, HistoryItem, Tab, AppSettings, EvalResponse, WarehouseWand, SmartTag, WarehouseFolder } from './types';
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
import { WandWarehouse } from './components/WandWarehouse';
import { FloatingDragModeToggle } from './components/FloatingDragModeToggle';
import { useSettings } from './hooks/useSettings';
import { useSpellDb } from './hooks/useSpellDb';
import { useWandImport, readMetadataFromPng } from './hooks/useWandImport';
import { useGameSync } from './hooks/useGameSync';
import { useTabs } from './hooks/useTabs';
import { useInteraction } from './hooks/useInteraction';
import { useWandEvaluator } from './hooks/useWandEvaluator';
import { useSpellSearch } from './hooks/useSpellSearch';
import { useWarehouse } from './hooks/useWarehouse';
import { useWandActions } from './hooks/useWandActions';
import { useHistory } from './hooks/useHistory';
import { evaluateWand, getIconUrl } from './lib/evaluatorAdapter';
import { useTranslation } from 'react-i18next';

const cloneTabs = (tbs: any[]): any[] => {
  return tbs.map(t => ({
    ...t,
    wands: JSON.parse(JSON.stringify(t.wands)),
    expandedWands: new Set(t.expandedWands)
  }));
};

function App() {
  const { t, i18n } = useTranslation();

  // --- Context Menus ---
  const { settings, setSettings } = useSettings();
  const [tabMenu, setTabMenu] = useState<{ x: number, y: number, tabId: string } | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'info' | 'success' } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const lastLocalUpdateRef = useRef<number>(0);

  const { 
    tabs, setTabs, activeTabId, setActiveTabId, activeTab, 
    addNewTab, deleteTab, exportAllData, importAllData, 
    importWorkflow, exportWorkflow 
  } = useTabs(settings, setSettings);

  const { performAction, undo, redo, jumpToPast, jumpToFuture } = useHistory(tabs, setTabs, activeTabId);

  const { 
    isWarehouseOpen, setIsWarehouseOpen, warehouseWands, setWarehouseWands, 
    warehouseFolders, setWarehouseFolders, smartTags, setSmartTags, saveToWarehouse 
  } = useWarehouse(setNotification);

  // --- Conflict Resolution ---
  const [conflict, setConflict] = useState<{
    tabId: string;
    gameWands: Record<string, WandData>;
  } | null>(null);
  const { isConnected, syncWand, pullData, pushAllToGame, toggleSync, resolveConflict } = useGameSync({
    activeTab, activeTabId, settings, setTabs, performAction, setNotification, setConflict, t, lastLocalUpdateRef
  });
  const { spellDb, spellNameToId, syncGameSpells: syncSpells } = useSpellDb(isConnected);
  const syncGameSpells = () => syncSpells(setNotification);

  // Picker State
  const [pickerConfig, setPickerConfig] = useState<{
    wandSlot: string;
    spellIdx: string;
    x: number;
    y: number;
  } | null>(null);

  const { 
    pickerSearch, setPickerSearch, 
    pickerExpandedGroups, setPickerExpandedGroups,
    spellStats, searchResults 
  } = useSpellSearch(tabs, spellDb, settings);

  const { evalResults, requestEvaluation } = useWandEvaluator(activeTab, settings, isConnected);

  const updateWand = useCallback((slot: string, updates: Partial<WandData>, actionName = t('app.notification.modify_wand'), icons?: string[]) => {
    lastLocalUpdateRef.current = Date.now();
    performAction(prevWands => {
      const currentWand = (prevWands as Record<string, WandData>)[slot] || { ...DEFAULT_WAND };
      const newWand = { ...currentWand, ...updates };
      if (activeTab.isRealtime) syncWand(slot, newWand);
      return { ...prevWands, [slot]: newWand };
    }, actionName, icons);
  }, [activeTab.isRealtime, performAction, syncWand, t]);

  const {
    selection, setSelection, selectionRef,
    isSelecting, setIsSelecting,
    dragSource, setDragSource,
    isDraggingFile, setIsDraggingFile,
    mousePos, setMousePos,
    hoveredSlot, setHoveredSlot, hoveredSlotRef,
    handleSlotMouseDown, handleSlotMouseUp, handleSlotMouseEnter, handleSlotMouseMove, handleSlotMouseLeave,
    insertEmptySlot: _insertEmptySlot
  } = useInteraction({ activeTab, settings, performAction, syncWand });

  const [clipboard, setClipboard] = useState<{ type: 'wand', data: WandData } | null>(null);

  const { addWand, deleteWand, toggleExpand, copyWand, copyLegacyWand, cutWand, pasteWand, openPicker } = useWandActions({
    tabs, activeTab, activeTabId, settings, spellDb, clipboard, setClipboard, performAction, syncWand, setTabs, setNotification, lastLocalUpdateRef, setSelection, setPickerConfig, setPickerSearch, setPickerExpandedGroups, updateWand
  });

  const insertEmptySlot = () => _insertEmptySlot(updateWand);

  useEffect(() => {
    const handleClose = (e: MouseEvent) => {
      setTabMenu(null);
      // Clear selection only if clicking outside the wand area
      if (!(e.target as HTMLElement).closest('.glass-card')) {
        setSelection(null);
      }
    };
    const handleContextMenu = (e: MouseEvent) => {
      // Disable default context menu globally to allow right-click drag
      if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
      }
      setTabMenu(null);
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  const { importFromText, copyToClipboard, pasteFromClipboard } = useWandImport({
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
  });

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (dragSource) {
        setMousePos({ x: e.clientX, y: e.clientY });
      }
    };
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [dragSource]);

  useEffect(() => {
    const handleMouseUp = () => {
      setIsSelecting(false);
      if (dragSource) setDragSource(null);
    };
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey)) {
        if (e.key === 'h') {
          e.preventDefault();
          setIsHistoryOpen(prev => !prev);
        } else if (e.key === 'b') {
          e.preventDefault();
          setIsWarehouseOpen(prev => !prev);
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
            if (settings.deleteEmptySlots && e.key === 'Delete') {
              const indicesToRem = new Set(targetIndices.filter(i => i <= wand.deck_capacity));
              if (indicesToRem.size > 0) {
                const newSpells: Record<string, string> = {};
                const newSpellUses: Record<string, number> = {};
                let nextIdx = 1;
                for (let i = 1; i <= wand.deck_capacity; i++) {
                  if (indicesToRem.has(i)) continue;
                  if (wand.spells[i.toString()]) {
                    newSpells[nextIdx.toString()] = wand.spells[i.toString()];
                    if (wand.spell_uses?.[i.toString()] !== undefined) {
                      newSpellUses[nextIdx.toString()] = wand.spell_uses[i.toString()];
                    }
                  }
                  nextIdx++;
                }
                const newCap = Math.max(1, wand.deck_capacity - indicesToRem.size);
                updateWand(targetSlot, {
                  spells: newSpells,
                  spell_uses: newSpellUses,
                  deck_capacity: newCap
                }, t('app.notification.delete_wand_slot'));
                setSelection(null);
              }
            } else {
              const newSpells = { ...wand.spells };
              const newSpellUses = { ...(wand.spell_uses || {}) };
              targetIndices.forEach(idx => {
                delete newSpells[idx];
                delete newSpellUses[idx];
              });
              updateWand(targetSlot, { spells: newSpells, spell_uses: newSpellUses }, t('app.notification.delete_spell'));
            }
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

    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      const items = Array.from(e.clipboardData?.items || []);
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const metadata = await readMetadataFromPng(file);
            if (metadata && (metadata.includes('{{Wand2') || metadata.includes('{{Wand'))) {
              e.preventDefault();
              await importFromText(metadata);
              return;
            }
          }
        }
      }

      if (!isInput) {
        const text = e.clipboardData?.getData('text/plain').trim();
        if (text) {
          const success = await importFromText(text);
          if (success) e.preventDefault();
        }
      }
    };

    const handleGlobalDropEvent = async (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(false);

      console.log("[Import] File dropped");

      // 1. Handle Files
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) {
        for (const file of files) {
          if (file.type.startsWith('image/')) {
            console.log("[Import] Reading image metadata...");
            const metadata = await readMetadataFromPng(file);
            if (metadata && (metadata.includes('{{Wand2') || metadata.includes('{{Wand'))) {
              await importFromText(metadata);
              setNotification({ msg: t('app.notification.imported_from_image'), type: "success" });
              continue;
            }
          }

          if (file.name.endsWith('.json')) {
            console.log("[Import] Reading JSON workflow...");
            const reader = new FileReader();
            reader.onload = (ev) => {
              try {
                const data = JSON.parse(ev.target?.result as string);
                const newTabId = Date.now().toString();
                const fileName = file.name.replace('.json', '');
                const isFullWorkflow = data && data.type === 'twwe_workflow' && data.wands;
                const wands = isFullWorkflow ? data.wands : data;

                setTabs(prev => [
                  ...prev,
                  {
                    id: newTabId,
                    name: isFullWorkflow ? (data.name || fileName) : fileName,
                    isRealtime: false,
                    wands: wands,
                    expandedWands: new Set(Object.keys(wands)),
                    past: isFullWorkflow ? (data.past || []) : [],
                    future: isFullWorkflow ? (data.future || []) : []
                  }
                ]);
                setActiveTabId(newTabId);
                setNotification({ msg: t('app.notification.imported_workflow_name', { name: fileName }), type: "success" });
              } catch (err) { console.error("Drop import failed:", err); }
            };
            reader.readAsText(file);
          }
        }
        return;
      }

      // 2. Handle dragging from other websites (URLs/Items)
      const items = Array.from(e.dataTransfer?.items || []);
      for (const item of items) {
        if (item.kind === 'string' && item.type === 'text/plain') {
          item.getAsString(async (text) => {
            const success = await importFromText(text);
            if (success) setNotification({ msg: t('app.notification.imported_from_text'), type: "success" });
          });
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      // Only set to false if we're actually leaving the window
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setIsDraggingFile(false);
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handleGlobalPaste);
    window.addEventListener('drop', handleGlobalDropEvent);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handleGlobalPaste);
      window.removeEventListener('drop', handleGlobalDropEvent);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
    };
  }, [activeTab, settings, spellDb, readMetadataFromPng, importFromText]);

  useEffect(() => {
    const toSave = tabs.map(t => ({ ...t, expandedWands: Array.from(t.expandedWands) }));
    localStorage.setItem('twwe_tabs', JSON.stringify(toSave));
  }, [tabs]);

  useEffect(() => {
    // Handle URL parameters
    const params = new URLSearchParams(window.location.search);
    let wandData = params.get('wand') || params.get('data');
    if (wandData) {
      if (!wandData.startsWith('{{') && !wandData.includes(',')) {
        try { wandData = atob(wandData); } catch (e) {}
      }
      setTimeout(() => {
        importFromText(wandData!);
      }, 100);
    }
  }, [importFromText]);

  const pickSpell = (spellId: string | null, isKeyboard: boolean = false) => {
    if (!pickerConfig) return;
    const { wandSlot, spellIdx } = pickerConfig;

    lastLocalUpdateRef.current = Date.now();
    performAction(prevWands => {
      const wand = prevWands[wandSlot] || { ...DEFAULT_WAND };

      if (spellIdx.startsWith('ac-')) {
        const acIdx = parseInt(spellIdx.split('-')[1]);
        const newAC = [...(wand.always_cast || [])];
        if (spellId) {
          if (acIdx >= newAC.length) newAC.push(spellId);
          else newAC[acIdx] = spellId;
        } else {
          newAC.splice(acIdx, 1);
        }
        const newWand = { ...wand, always_cast: newAC };
        if (activeTab.isRealtime) syncWand(wandSlot, newWand);
        return { ...prevWands, [wandSlot]: newWand };
      } else {
        const newSpells = { ...wand.spells };
        if (spellId) newSpells[spellIdx] = spellId;
        else delete newSpells[spellIdx];

        const newWand = { ...wand, spells: newSpells };
        if (activeTab.isRealtime) syncWand(wandSlot, newWand);
        return { ...prevWands, [wandSlot]: newWand };
      }
    }, spellId ? t('app.notification.change_spell') : t('app.notification.clear_slot', { idx: spellIdx }), spellId ? [spellId] : []);
    
    setPickerConfig(null);

    if (isKeyboard && spellId && !spellIdx.startsWith('ac-')) {
      // 键盘选词成功：自动跳到下一格
      const currentIdx = parseInt(spellIdx);
      const wand = activeTab.wands[wandSlot];
      if (wand && currentIdx < wand.deck_capacity) {
        setSelection({ wandSlot, indices: [currentIdx + 1], startIdx: currentIdx + 1 });
      } else {
        setSelection(null);
      }
    } else if (!isKeyboard) {
      // 鼠标点击或取消：直接清空焦点，避免干扰后续全局按键
      setSelection(null);
    }
  };
  return (
    <div
      className="flex flex-col h-screen bg-zinc-950 overflow-hidden text-zinc-100 selection:bg-purple-500/30"
    >
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
        setIsWarehouseOpen={setIsWarehouseOpen}
        syncGameSpells={syncGameSpells}
      />

      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-black/40">
          {activeTab.wands && Object.entries(activeTab.wands).map(([slot, data]) => (
            <WandCard
              key={slot}
              slot={slot}
              data={data}
              activeTab={activeTab}
              isConnected={isConnected}
              spellDb={spellDb}
              selection={selection}
              hoveredSlot={hoveredSlot}
              dragSource={dragSource}
              clipboard={clipboard}
              toggleExpand={toggleExpand}
              deleteWand={deleteWand}
              copyWand={copyWand}
              copyLegacyWand={copyLegacyWand}
              pasteWand={pasteWand}
              updateWand={updateWand}
              requestEvaluation={requestEvaluation}
              handleSlotMouseDown={handleSlotMouseDown}
              handleSlotMouseUp={handleSlotMouseUp}
              handleSlotMouseEnter={handleSlotMouseEnter}
              handleSlotMouseMove={handleSlotMouseMove}
              handleSlotMouseLeave={handleSlotMouseLeave}
              openPicker={openPicker}
              setSelection={setSelection}
              setSettings={setSettings}
              evalData={evalResults[`${activeTab.id}-${slot}`]}
              settings={settings}
              onSaveToWarehouse={saveToWarehouse}
            />
          ))}

          {(!activeTab.wands || Object.keys(activeTab.wands).length === 0) && (
            <div className="h-64 flex flex-col items-center justify-center text-zinc-700 gap-4">
              <Activity size={32} className="opacity-20 animate-pulse" />
              <p className="font-black text-[10px] uppercase tracking-widest">{t('tabs.waiting_data')}</p>
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
          isConnected={isConnected}
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
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('tabs.workflow_options')}</span>
            </div>

            <button
              onClick={() => {
                toggleSync(tabMenu.tabId);
                setTabMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/5 flex items-center gap-2"
            >
              <Activity size={12} className={tabs.find(t => t.id === tabMenu.tabId)?.isRealtime ? "text-green-500" : "text-zinc-500"} />
              {tabs.find(t => t.id === tabMenu.tabId)?.isRealtime ? t('tabs.off_sync') : t('tabs.on_sync')}
            </button>

            <button
              onClick={() => {
                const tab = tabs.find(t => t.id === tabMenu.tabId);
                const newName = prompt(t('app.notification.renamed_workflow'), tab?.name);
                if (newName) {
                  setTabs(prev => prev.map(t => t.id === tabMenu.tabId ? { ...t, name: newName } : t));
                }
                setTabMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/5 flex items-center gap-2"
            >
              <RefreshCw size={12} className="text-zinc-500" /> {t('tabs.rename')}
            </button>

            <button
              onClick={() => {
                exportWorkflow(tabMenu.tabId);
                setTabMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/5 flex items-center gap-2"
            >
              <Download size={12} className="text-zinc-500" /> {t('tabs.export_json')}
            </button>

            <div className="h-px bg-white/5 my-1" />

            <button
              onClick={() => {
                setIsWarehouseOpen(true);
                setTabMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/5 flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <Library size={12} className="text-indigo-400" /> {t('tabs.open_warehouse')}
              </div>
              <span className="text-[9px] text-zinc-500 font-mono group-hover:text-zinc-400">Ctrl+B</span>
            </button>

            <button
              onClick={() => {
                setIsHistoryOpen(true);
                setTabMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/5 flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <History size={12} className="text-indigo-400" /> {t('tabs.open_history')}
              </div>
              <span className="text-[9px] text-zinc-500 font-mono group-hover:text-zinc-400">Ctrl+H</span>
            </button>

            <button
              onClick={() => {
                if (confirm(t('tabs.clear_history_confirm'))) {
                  setTabs(prev => prev.map(t => t.id === tabMenu.tabId ? { ...t, past: [], future: [] } : t));
                }
                setTabMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-400/10 flex items-center gap-2"
            >
              <Trash2 size={12} /> {t('tabs.clear_history')}
            </button>
          </div>
        )}

        <ConflictModal
          conflict={conflict}
          activeTab={activeTab}
          onResolve={(strategy) => resolveConflict(strategy, conflict!, activeTab)}
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
          isConnected={isConnected}
        />

        <WandWarehouse
          isOpen={isWarehouseOpen}
          onClose={() => setIsWarehouseOpen(false)}
          spellDb={spellDb}
          wands={warehouseWands}
          setWands={setWarehouseWands}
          folders={warehouseFolders}
          setFolders={setWarehouseFolders}
          smartTags={smartTags}
          setSmartTags={setSmartTags}
          settings={settings}
          isConnected={isConnected}
          onImportWand={(w: WarehouseWand) => {
            const nextSlot = (Math.max(0, ...Object.keys(activeTab.wands).map(Number)) + 1).toString();
            performAction(prevWands => ({
              ...prevWands,
              [nextSlot]: { ...w }
            }), t('app.notification.imported_from_warehouse', { name: w.name }));

            setTabs(prev => prev.map(t => t.id === activeTabId ? {
              ...t,
              expandedWands: new Set([...t.expandedWands, nextSlot])
            } : t));

            if (activeTab.isRealtime) {
              syncWand(nextSlot, w as any);
            }
            setNotification({ msg: t('app.notification.imported_wand_success', { name: w.name }), type: 'success' });
          }}
        />

        <FloatingDragModeToggle settings={settings} setSettings={setSettings} />
      </main>

      <Footer
        isConnected={isConnected}
        activeTab={activeTab}
        tabsCount={tabs.length}
        notification={notification}
      />

      {dragSource && spellDb[dragSource.sid] && (
        <div
          className="fixed pointer-events-none z-[1000] w-12 h-12"
          style={{ left: mousePos.x + 5, top: mousePos.y + 5 }}
        >
          <img
            src={getIconUrl(spellDb[dragSource.sid].icon, isConnected)}
            className="w-full h-full image-pixelated border-2 border-indigo-500 rounded bg-zinc-900/80 shadow-2xl animate-pulse"
            alt=""
          />
        </div>
      )}

      {isDraggingFile && (
        <div className="fixed inset-0 z-[2000] bg-indigo-500/20 backdrop-blur-sm border-4 border-dashed border-indigo-500 flex items-center justify-center pointer-events-none animate-in fade-in duration-200">
          <div className="bg-zinc-900 px-8 py-4 rounded-2xl shadow-2xl border border-white/10 flex flex-col items-center gap-4">
            <Download size={48} className="text-indigo-400 animate-bounce" />
            <p className="text-xl font-black uppercase tracking-widest text-indigo-100">{t('app.notification.drop_to_import')}</p>
            <p className="text-zinc-400 text-sm">{t('app.notification.import_formats')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
