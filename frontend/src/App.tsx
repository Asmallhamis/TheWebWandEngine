import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// --- Internal ---
import { SpellInfo, WandData, Tab } from './types';
import { getActiveModBundle, saveModBundle } from './lib/modStorage';
import { DEFAULT_WAND } from './constants';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { WandWorkspace } from './components/WandWorkspace';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { OverlayManager } from './components/OverlayManager';
import { useSettings } from './hooks/useSettings';
import { useGlobalEvents } from './hooks/useGlobalEvents';
import { useSpellDb } from './hooks/useSpellDb';
import { useWandImport } from './hooks/useWandImport';
import { useGameSync } from './hooks/useGameSync';
import { useTabs } from './hooks/useTabs';
import { useInteraction } from './hooks/useInteraction';
import { useUIStore } from './store/useUIStore';
import { useWandEvaluator } from './hooks/useWandEvaluator';
import { useSpellSearch } from './hooks/useSpellSearch';
import { useWarehouse } from './hooks/useWarehouse';
import { useWandActions } from './hooks/useWandActions';
import { useHistory } from './hooks/useHistory';

function App() {
  const { t } = useTranslation();

  // --- Context Menus ---
  const { settings, setSettings } = useSettings();
  const [tabMenu, setTabMenu] = useState<{ x: number, y: number, tabId: string } | null>(null);

  const {
    setIsSettingsOpen,
    setIsHistoryOpen,
    setIsWarehouseOpen,
    setIsModManagerOpen,
    notification, showNotification,
    settingsCategoryOverride, setSettingsCategoryOverride,
    settingsExpandedBundleId, setSettingsExpandedBundleId,
    modBundleInfo, setModBundleInfo
  } = useUIStore();

  const lastLocalUpdateRef = useRef<number>(0);

  const {
    tabs, setTabs, activeTabId, setActiveTabId, activeTab,
    addNewTab, deleteTab, exportAllData, importAllData,
    importWorkflow, exportWorkflow
  } = useTabs(settings, setSettings);

  const { performAction, undo, redo, jumpToPast, jumpToFuture } = useHistory(tabs, setTabs, activeTabId);

  const {
    warehouseWands, setWarehouseWands,
    warehouseFolders, setWarehouseFolders, smartTags, setSmartTags, saveToWarehouse,
    pullBones, pushBones
  } = useWarehouse((n) => showNotification(n?.msg || '', n?.type));

  // --- Conflict Resolution ---
  const [conflict, setConflict] = useState<{
    tabId: string;
    gameWands: Record<string, WandData>;
  } | null>(null);

  const { isConnected, syncWand, pullData, pushAllToGame, toggleSync, resolveConflict } = useGameSync({
    activeTab, activeTabId, settings, setTabs, performAction, setNotification: (n) => showNotification(n?.msg || '', n?.type), setConflict, t, lastLocalUpdateRef
  });

  const { spellDb, spellNameToId, syncGameSpells: syncSpells, fetchSpellDb } = useSpellDb(isConnected);
  const syncGameSpells = () => syncSpells((n) => showNotification(n?.msg || '', n?.type));

  const exportModBundle = async () => {
    if (!isConnected) return;
    showNotification(t('app.notification.exporting_mod_bundle'), 'info');
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
          all_mods: data.active_mods,
          vfs: data.vfs || {},
          vfs_meta: data.vfs_meta || {}
        };

        await saveModBundle(bundle);
        await refreshModBundleInfo();

        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${bundleName}.twwe-env.json`;
        a.click();
        showNotification(t('app.notification.export_mod_bundle_success'), 'success');
      }
    } catch (e) {
      showNotification(t('app.notification.export_mod_bundle_failed'), 'error');
    }
  };

  const refreshModBundleInfo = useCallback(async () => {
    try {
      const bundle = await getActiveModBundle();
      if (!bundle || !bundle.active_mods) {
        setModBundleInfo({ active: 0, total: 0, bundleId: null });
        return;
      }

      let baseSpells: Record<string, any> = {};
      try {
        const res = await fetch('./static_data/spells.json');
        baseSpells = await res.json();
      } catch (e) {
        console.error("Failed to load base spells for bundle info", e);
      }

      const modSpells = Object.values(bundle.spells || {}).reduce((acc: any, spell: any) => {
        const modId = spell.mod_id;
        if (modId) {
          if (!acc[modId]) acc[modId] = { added: 0, modified: 0 };
          if (baseSpells[spell.id || '']) acc[modId].modified++;
          else acc[modId].added++;
        }
        return acc;
      }, {});

      const modsWithAppends = new Set<string>();
      Object.keys(bundle.appends || {}).forEach(path => {
        if (path.startsWith('mods/')) {
          const parts = path.split('/');
          if (parts.length > 1) modsWithAppends.add(parts[1]);
        }
      });

      const isImpactful = (modId: string) => {
        const s = modSpells[modId];
        return (s && (s.added > 0 || s.modified > 0)) || modsWithAppends.has(modId);
      };

      const allMods = (bundle.all_mods && bundle.all_mods.length > 0) ? bundle.all_mods : bundle.active_mods;
      const impactfulMods = allMods.filter(isImpactful);
      const activeSet = new Set(bundle.active_mods);
      const activeImpactfulCount = impactfulMods.filter(id => activeSet.has(id)).length;

      setModBundleInfo({
        active: activeImpactfulCount,
        total: impactfulMods.length,
        bundleId: bundle.id || null
      });
    } catch (e) {
      setModBundleInfo({ active: 0, total: 0, bundleId: null });
    }
  }, [setModBundleInfo]);

  useEffect(() => {
    refreshModBundleInfo();
  }, [refreshModBundleInfo]);

  useEffect(() => {
    if (!useUIStore.getState().isSettingsOpen) {
      setSettingsCategoryOverride(null);
      setSettingsExpandedBundleId(null);
    }
  }, [setSettingsCategoryOverride, setSettingsExpandedBundleId]);

  // Picker State
  const [pickerConfig, setPickerConfig] = useState<{ wandSlot: string; spellIdx: string; x: number; y: number; rowTop?: number; } | null>(null);

  const {
    pickerSearch, setPickerSearch,
    pickerExpandedGroups, setPickerExpandedGroups,
    spellStats, searchResults
  } = useSpellSearch(tabs, spellDb, settings);

  const { evalResults, requestEvaluation } = useWandEvaluator(activeTab, settings, isConnected);

  const updateWand = useCallback((slot: string, updates: Partial<WandData> | ((prev: WandData) => Partial<WandData>), actionName = t('app.notification.modify_wand'), icons?: string[]) => {
    lastLocalUpdateRef.current = Date.now();
    performAction(prevWands => {
      const currentWand = (prevWands as Record<string, WandData>)[slot] || { ...DEFAULT_WAND };
      const resolvedUpdates = typeof updates === 'function' ? updates(currentWand) : updates;
      const newWand = { ...currentWand, ...resolvedUpdates };
      if (activeTab.isRealtime) syncWand(slot, newWand);
      return { ...prevWands, [slot]: newWand };
    }, actionName, icons);
  }, [activeTab.isRealtime, performAction, syncWand, t]);

  const setSelection = useUIStore(s => s.setSelection);
  const selection = useUIStore(s => s.selection);
  const dragSource = useUIStore(s => s.dragSource);
  const setDragSource = useUIStore(s => s.setDragSource);
  const hoveredSlot = useUIStore(s => s.hoveredSlot);

  const {
    isSelecting, setIsSelecting,
    isDraggingFile, setIsDraggingFile,
    mousePos, setMousePos,
    handleSlotMouseDown, handleSlotMouseUp, handleSlotMouseEnter, handleSlotMouseMove, handleSlotMouseLeave,
    insertEmptySlot: _insertEmptySlot
  } = useInteraction({ activeTab, settings, performAction, syncWand });

  const [clipboard, setClipboard] = useState<{ type: 'wand', data: WandData } | null>(null);

  const { addWand, deleteWand, toggleExpand, copyWand, copyLegacyWand, cutWand, pasteWand, openPicker } = useWandActions({
    tabs, activeTab, activeTabId, settings, spellDb, clipboard, setClipboard, performAction, syncWand, setTabs, setNotification: (n) => showNotification(n?.msg || '', n?.type), lastLocalUpdateRef, setSelection, setPickerConfig, setPickerSearch, setPickerExpandedGroups, updateWand
  });

  const insertEmptySlot = () => _insertEmptySlot(updateWand);

  const { importFromText, copyToClipboard, pasteFromClipboard, readMetadataFromPng } = useWandImport({
    activeTab, activeTabId, spellDb, spellNameToId, settings, t, performAction, updateWand, syncWand, setTabs, setActiveTabId, setNotification: (n) => showNotification(n?.msg || '', n?.type)
  });

  useGlobalEvents({
    activeTab, activeTabId, tabs, settings, spellDb, dragSource, pickerConfig, notification,
    setTabs, setActiveTabId, setIsHistoryOpen, setIsWarehouseOpen, setSelection, setIsSelecting, setDragSource, setMousePos, setIsDraggingFile, setNotification: (n) => showNotification(n?.msg || '', n?.type), setTabMenu,
    importFromText, copyToClipboard, pasteFromClipboard, readMetadataFromPng,
    insertEmptySlot, updateWand
  });

  const pickSpell = (spellId: string | null, isKeyboard: boolean = false) => {
    if (!pickerConfig) return;
    const { wandSlot, spellIdx } = pickerConfig;

    // 处理智能标签编辑器的法术选择
    if (wandSlot.startsWith('smart-tag-req-') || wandSlot.startsWith('smart-tag-exc-')) {
      setPickerConfig(null);
      // WandEditor 的 updateWand 已经把 spells 转换回 SmartTag 格式了,
      // 但 pickSpell 需要在这里手动 apply, 因为 Picker 是全局的
      const isExcluded = wandSlot.startsWith('smart-tag-exc-');
      setSmartTags(prev => {
        // 这里不需要做什么，因为 WandEditor 的 updateWand handler 会处理
        // 但我们其实需要直接更新 editingSmartTag 的临时状态
        return prev;
      });
      // 我们需要通过 useWarehouse 提供的 setter 更新，但 editingSmartTag 是 WandWarehouse 内部状态。
      // 解决办法：让 WandWarehouse 的 updateWand handler 处理通过 openPicker 触发的更新。
      // 因为 WandEditor 内部的 click handler 最终调用 openPicker，然后 pickSpell 被调用。
      // 不过 pickSpell 这里并不知道 editingSmartTag。
      // 最佳方案：pickSpell 不走 performAction，而是手动构造 spells dict 传给一个自定义 callback。

      // 但更简洁的方案是，让 WandWarehouse 的 updateWand 在调用 openPicker 后被 picker 正确回调，
      // 因此我们只需让 pickSpell 当作正常的 slot 来处理 - 但需要将结果传给仓库的临时状态。
      // 由于目前逻辑较复杂，我使用事件广播机制来解耦。

      // 简化方案：直接通过 CustomEvent 将法术选择传递给 WandWarehouse
      window.dispatchEvent(new CustomEvent('twwe-smart-tag-pick', {
        detail: { wandSlot, spellIdx, spellId }
      }));

      if (isKeyboard && spellId) {
        const currentIdx = parseInt(spellIdx);
        setSelection({ wandSlot, indices: [currentIdx + 1], startIdx: currentIdx + 1 });
      } else if (!isKeyboard) {
        setSelection(null);
      }
      return;
    }

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
      const currentIdx = parseInt(spellIdx);
      const wand = activeTab.wands[wandSlot];
      if (wand && currentIdx < wand.deck_capacity) {
        setSelection({ wandSlot, indices: [currentIdx + 1], startIdx: currentIdx + 1 });
      } else {
        setSelection(null);
      }
    } else if (!isKeyboard) {
      setSelection(null);
    }
  };

  const uiScale = settings.uiScale || 100;

  return (
    <div
      className="flex flex-col bg-zinc-950 overflow-hidden text-zinc-100 selection:bg-purple-500/30"
      style={uiScale !== 100 ? {
        zoom: `${uiScale}%`,
        height: `${100 / (uiScale / 100)}vh`
      } : { height: '100vh' }}
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
        modBundleInfo={modBundleInfo}
        onOpenModManager={() => setIsModManagerOpen(true)}
        settings={settings}
        setSettings={setSettings}
      />

      <main className="flex-1 flex overflow-hidden relative">
        {settings.isCanvasMode ? (
          <CanvasWorkspace
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
        ) : (
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
        )}

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
          onReloadSpells={fetchSpellDb}
          onModBundleChange={refreshModBundleInfo}
          onOpenSettings={() => setIsSettingsOpen(true)}
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
          spellDb={spellDb}
          jumpToPast={jumpToPast}
          jumpToFuture={jumpToFuture}
          undo={undo}
          redo={redo}
          performAction={performAction}
          warehouseWands={warehouseWands}
          setWarehouseWands={setWarehouseWands}
          warehouseFolders={warehouseFolders}
          setWarehouseFolders={setWarehouseFolders}
          smartTags={smartTags}
          setSmartTags={setSmartTags}
          pullBones={pullBones}
          pushBones={pushBones}
          activeTabId={activeTabId}
          syncWand={syncWand}
          dragSource={dragSource}
          mousePos={mousePos}
          isDraggingFile={isDraggingFile}
          setSelection={setSelection}
          selection={selection}
          hoveredSlot={hoveredSlot}
          handleSlotMouseDown={handleSlotMouseDown}
          handleSlotMouseUp={handleSlotMouseUp}
          handleSlotMouseEnter={handleSlotMouseEnter}
          handleSlotMouseMove={handleSlotMouseMove}
          handleSlotMouseLeave={handleSlotMouseLeave}
          openPicker={openPicker}
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
