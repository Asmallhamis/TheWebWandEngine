import React from 'react';
import { Activity, RefreshCw, Download, Library, History, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SpellPicker } from './SpellPicker';
import { SettingsModal } from './SettingsModal';
import { ConflictModal } from './ConflictModal';
import { HistoryPanel } from './HistoryPanel';
import { WandWarehouse } from './WandWarehouse';
import { FloatingDragModeToggle } from './FloatingDragModeToggle';
import { 
  SpellInfo,
  PickerConfig, 
  SpellDb, 
  WandData,
  SpellStats, 
  AppSettings, 
  Tab, 
  Conflict, 
  WarehouseWand, 
  WarehouseFolder, 
  SmartTag, 
  AppNotification,
  DragSource,
  MousePos
} from '../types';
import { getIconUrl } from '../lib/evaluatorAdapter';

interface OverlayManagerProps {
  // Spell Picker
  pickerConfig: PickerConfig | null;
  setPickerConfig: (config: PickerConfig | null) => void;
  pickerSearch: string;
  setPickerSearch: (search: string | ((prev: string) => string)) => void;
  pickSpell: (spellId: string | null, isKeyboard?: boolean) => void;
  searchResults: SpellInfo[][] | null;
  spellStats: SpellStats;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  pickerExpandedGroups: Set<number>;
  setPickerExpandedGroups: React.Dispatch<React.SetStateAction<Set<number>>>;
  isConnected: boolean;

  // Settings
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  importAllData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  exportAllData: () => void;

  // Tab Menu
  tabMenu: { x: number; y: number; tabId: string } | null;
  setTabMenu: (menu: { x: number; y: number; tabId: string } | null) => void;
  tabs: Tab[];
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  toggleSync: (tabId: string) => void;
  exportWorkflow: (tabId: string) => void;

  // Conflict
  conflict: Conflict | null;
  activeTab: Tab;
  resolveConflict: (strategy: 'web' | 'game' | 'both', conflict: Conflict, tab: Tab) => void;

  // History
  isHistoryOpen: boolean;
  setIsHistoryOpen: (open: boolean) => void;
  spellDb: SpellDb;
  jumpToPast: (index: number) => void;
  jumpToFuture: (index: number) => void;
  undo: () => void;
  redo: () => void;

  // Warehouse
  isWarehouseOpen: boolean;
  setIsWarehouseOpen: (open: boolean) => void;
  warehouseWands: WarehouseWand[];
  setWarehouseWands: React.Dispatch<React.SetStateAction<WarehouseWand[]>>;
  warehouseFolders: WarehouseFolder[];
  setWarehouseFolders: React.Dispatch<React.SetStateAction<WarehouseFolder[]>>;
  smartTags: SmartTag[];
  setSmartTags: React.Dispatch<React.SetStateAction<SmartTag[]>>;
  saveToWarehouse: (wand: any) => void;
  performAction: (updater: any, description: string) => void;
  activeTabId: string;
  syncWand: (slot: string, data: WandData | null, isDelete?: boolean) => void;
  setNotification: (notif: AppNotification | null) => void;
  setSelection: (selection: { wandSlot: string, indices: number[], startIdx: number } | null) => void;

  // Interaction
  dragSource: DragSource | null;
  mousePos: MousePos;
  isDraggingFile: boolean;
}

export function OverlayManager({
  pickerConfig,
  setPickerConfig,
  pickerSearch,
  setPickerSearch,
  pickSpell,
  searchResults,
  spellStats,
  settings,
  setSettings,
  pickerExpandedGroups,
  setPickerExpandedGroups,
  isConnected,
  isSettingsOpen,
  setIsSettingsOpen,
  importAllData,
  exportAllData,
  tabMenu,
  setTabMenu,
  tabs,
  setTabs,
  toggleSync,
  exportWorkflow,
  conflict,
  activeTab,
  resolveConflict,
  isHistoryOpen,
  setIsHistoryOpen,
  spellDb,
  jumpToPast,
  jumpToFuture,
  undo,
  redo,
  isWarehouseOpen,
  setIsWarehouseOpen,
  warehouseWands,
  setWarehouseWands,
  warehouseFolders,
  setWarehouseFolders,
  smartTags,
  setSmartTags,
  performAction,
  activeTabId,
  syncWand,
  setNotification,
  dragSource,
  mousePos,
  isDraggingFile,
  setSelection,
}: OverlayManagerProps) {
  const { t } = useTranslation();

  return (
    <>
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
          performAction((prevWands: any) => ({
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
    </>
  );
}

export default OverlayManager;
