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
import { SpellInfo, WandData, HistoryItem, Tab, AppSettings, EvalResponse, WarehouseWand, SmartTag, WarehouseFolder, AppNotification } from './types';
import { saveModBundle } from './lib/modStorage';
import { DEFAULT_WAND, DEFAULT_SPELL_TYPES, DEFAULT_SPELL_GROUPS } from './constants';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { WandCard } from './components/WandCard';
import { WandWorkspace } from './components/WandWorkspace';
import { HistoryPanel } from './components/HistoryPanel';
import { SettingsModal } from './components/SettingsModal';
import { ConflictModal } from './components/ConflictModal';
import { SpellPicker } from './components/SpellPicker';
import { CompactStat } from './components/Common';
import WandEvaluator from './components/WandEvaluator';
import { WandWarehouse } from './components/WandWarehouse';
import { FloatingDragModeToggle } from './components/FloatingDragModeToggle';
import { OverlayManager } from './components/OverlayManager';
import { useSettings } from './hooks/useSettings';
import { useGlobalEvents } from './hooks/useGlobalEvents';
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



function App() {
  const { t, i18n } = useTranslation();

  // --- Context Menus ---
  const { settings, setSettings } = useSettings();
  const [tabMenu, setTabMenu] = useState<{ x: number, y: number, tabId: string } | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [notification, setNotification] = useState<AppNotification | null>(null);
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
    warehouseFolders, setWarehouseFolders, smartTags, setSmartTags, saveToWarehouse,
    pullBones, pushBones
  } = useWarehouse(setNotification);

  // --- Conflict Resolution ---
  const [conflict, setConflict] = useState<{
    tabId: string;
    gameWands: Record<string, WandData>;
  } | null>(null);
  const { isConnected, syncWand, pullData, pushAllToGame, toggleSync, resolveConflict } = useGameSync({
    activeTab, activeTabId, settings, setTabs, performAction, setNotification, setConflict, t, lastLocalUpdateRef
  });
  const { spellDb, spellNameToId, syncGameSpells: syncSpells, fetchSpellDb } = useSpellDb(isConnected);
  const syncGameSpells = () => syncSpells(setNotification);

  const exportModBundle = async () => {
    if (!isConnected) return;
    setNotification({ msg: t('app.notification.exporting_mod_bundle'), type: 'info' });
    try {
      const res = await fetch('/api/export-mod-bundle');
      const data = await res.json();
      if (data.success) {
        const bundleName = prompt(t('app.notification.enter_bundle_name'), `ModBundle_${new Date().toLocaleDateString()}`);
        if (!bundleName) return;

        const bundle = {
          id: `mod_bundle_${Date.now()}`,
          name: bundleName,
          timestamp: Date.now(),
          spells: data.spells,
          appends: data.appends,
          active_mods: data.active_mods,
          vfs: data.vfs || {}
        };

        // Save to IndexedDB
        await saveModBundle(bundle);

        // Also download as file for sharing
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${bundleName}.twwe-env.json`;
        a.click();
        setNotification({ msg: t('app.notification.export_mod_bundle_success'), type: 'success' });
      }
    } catch (e) {
      setNotification({ msg: t('app.notification.export_mod_bundle_failed'), type: 'error' });
    }
  };

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

  const { importFromText, copyToClipboard, pasteFromClipboard, readMetadataFromPng } = useWandImport({
    activeTab, activeTabId, spellDb, spellNameToId, settings, t, performAction, updateWand, syncWand, setTabs, setActiveTabId, setNotification, hoveredSlotRef, selectionRef
  });

  useGlobalEvents({
    activeTab, activeTabId, tabs, settings, spellDb, dragSource, pickerConfig, notification,
    setTabs, setActiveTabId, setIsHistoryOpen, setIsWarehouseOpen, setSelection, setIsSelecting, setDragSource, setMousePos, setIsDraggingFile, setNotification, setTabMenu,
    selectionRef, hoveredSlotRef,
    importFromText, copyToClipboard, pasteFromClipboard, readMetadataFromPng,
    insertEmptySlot, updateWand
  });



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
        exportModBundle={exportModBundle}
      />

      <main className="flex-1 flex overflow-hidden relative">
        <WandWorkspace
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
          evalResults={evalResults}
          settings={settings}
          saveToWarehouse={saveToWarehouse}
        />

        <OverlayManager
          pickerConfig={pickerConfig}
          setPickerConfig={setPickerConfig}
          pickerSearch={pickerSearch}
          setPickerSearch={setPickerSearch}
          pickSpell={pickSpell}
          searchResults={searchResults}
          spellStats={spellStats}
          settings={settings}
          setSettings={setSettings}
          pickerExpandedGroups={pickerExpandedGroups}
          setPickerExpandedGroups={setPickerExpandedGroups}
          isConnected={isConnected}
          isSettingsOpen={isSettingsOpen}
          setIsSettingsOpen={setIsSettingsOpen}
          onReloadSpells={fetchSpellDb}
          importAllData={importAllData}
          exportAllData={exportAllData}
          tabMenu={tabMenu}
          setTabMenu={setTabMenu}
          tabs={tabs}
          setTabs={setTabs}
          toggleSync={toggleSync}
          exportWorkflow={exportWorkflow}
          conflict={conflict}
          activeTab={activeTab}
          resolveConflict={resolveConflict}
          isHistoryOpen={isHistoryOpen}
          setIsHistoryOpen={setIsHistoryOpen}
          spellDb={spellDb}
          jumpToPast={jumpToPast}
          jumpToFuture={jumpToFuture}
          undo={undo}
          redo={redo}
          isWarehouseOpen={isWarehouseOpen}
          setIsWarehouseOpen={setIsWarehouseOpen}
          warehouseWands={warehouseWands}
          setWarehouseWands={setWarehouseWands}
          warehouseFolders={warehouseFolders}
          setWarehouseFolders={setWarehouseFolders}
          smartTags={smartTags}
          setSmartTags={setSmartTags}
          saveToWarehouse={saveToWarehouse}
          performAction={performAction}
          activeTabId={activeTabId}
          syncWand={syncWand}
          setNotification={setNotification}
          dragSource={dragSource}
          mousePos={mousePos}
          isDraggingFile={isDraggingFile}
          setSelection={setSelection}
          pullBones={pullBones}
          pushBones={pushBones}
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
