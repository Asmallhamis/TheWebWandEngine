import React from 'react';
import { Cpu, Activity, Layers, X, Plus, RefreshCw, Lock, Unlock, Clipboard, Upload, Download, Settings, Library, Package } from 'lucide-react';
import { Tab, WandData, AppSettings } from '../types';
import { useTranslation } from 'react-i18next';

interface HeaderProps {
  tabs: Tab[];
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  setTabMenu: (menu: { x: number; y: number; tabId: string } | null) => void;
  addNewTab: () => void;
  deleteTab: (id: string, e: React.MouseEvent) => void;
  pullData: (force?: boolean) => void;
  pushData: () => void;
  toggleSync: (id: string) => void;
  addWand: () => void;
  clipboard: { type: 'wand'; data: WandData } | null;
  activeTab: Tab;
  performAction: (action: any, name: string) => void;
  importWorkflow: (e: React.ChangeEvent<HTMLInputElement>) => void;
  exportWorkflow: (id?: string) => void;
  setIsSettingsOpen: (open: boolean) => void;
  isConnected: boolean;
  setIsWarehouseOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  syncGameSpells: () => Promise<void>;
  exportModBundle?: () => Promise<void>;
  hasRealtimeControl?: boolean;
  realtimeOwnerExists?: boolean;
  realtimeWarning?: string | null;
  modBundleInfo: { active: number; total: number };
  onOpenModManager: () => void;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}

export function Header({
  tabs,
  activeTabId,
  setActiveTabId,
  setTabs,
  setTabMenu,
  addNewTab,
  deleteTab,
  pullData,
  pushData,
  toggleSync,
  addWand,
  clipboard,
  activeTab,
  performAction,
  importWorkflow,
  exportWorkflow,
  setIsSettingsOpen,
  isConnected,
  setIsWarehouseOpen,
  syncGameSpells,
  exportModBundle,
  hasRealtimeControl,
  realtimeOwnerExists,
  realtimeWarning,
  modBundleInfo,
  onOpenModManager,
  settings,
  setSettings
}: HeaderProps) {
  const { t } = useTranslation();
  const isStaticMode = (import.meta as any).env?.VITE_STATIC_MODE === 'true';
  return (
    <header className="flex items-center px-4 pt-2 bg-zinc-900/50 border-b border-white/5 space-x-0.5 flex-wrap">
      <div className="flex items-center gap-2.5 px-3 py-2 mr-4">
        <button
          onClick={() => setIsWarehouseOpen(prev => !prev)}
          className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all group"
          title={t('nav.warehouse') + ' (Ctrl+B)'}
          data-testid="header-warehouse-btn"
        >
          <Library size={16} className="text-white group-hover:rotate-12 transition-transform" />
        </button>
        <span className="font-extrabold text-[13px] tracking-tight">TWWE</span>
      </div>

      <div className="flex items-center gap-0.5 max-w-[70vw] overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <div key={tab.id} className="group relative">
            <button
              onClick={() => setActiveTabId(tab.id)}
              onDoubleClick={() => {
                const newName = prompt(t('app.notification.renamed_workflow'), tab.name);
                if (newName) {
                  setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, name: newName } : t));
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTabMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
              }}
              className={`
                relative px-5 py-2.5 text-[10px] font-black tracking-wider uppercase transition-all flex items-center gap-2
                ${activeTabId === tab.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}
              `}
            >
              {tab.isRealtime ? (
                <Activity size={12} className={isConnected ? 'text-green-500' : 'text-zinc-600'} />
              ) : <Layers size={12} />}
              {tab.name}
              {!tab.isRealtime && tabs.length > 1 && (
                <X
                  size={10}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity ml-1"
                  onClick={(e) => deleteTab(tab.id, e)}
                />
              )}
              {activeTabId === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500" />
              )}
            </button>
          </div>
        ))}
        <button
          onClick={addNewTab}
          className="p-2 text-zinc-600 hover:text-zinc-300 transition-colors"
          title={t('tabs.new_workflow')}
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1" />

      {activeTab.isRealtime && realtimeOwnerExists && !hasRealtimeControl && realtimeWarning && (
        <div className="mr-3 mb-1 px-3 py-1.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-200 text-[10px] font-bold tracking-wide">
          <div>{t('app.notification.realtime_waiting_short')}</div>
          <div className="opacity-80 font-medium normal-case tracking-normal mt-0.5">{realtimeWarning || t('app.notification.realtime_control_held_elsewhere')}</div>
        </div>
      )}

      <div className="flex items-center gap-1.5 pr-4 pb-1">
        {!settings.hideSyncButton && !isStaticMode && (<>
        <button
          onClick={() => pullData(true)}
          onContextMenu={(e) => { e.preventDefault(); pushData(); }}
          title={t('header.sync_button_title')}
          className={`
            neo-button text-[10px] w-32 justify-between px-3
            ${activeTab.isRealtime
              ? hasRealtimeControl
                ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                : 'bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20'
              : 'bg-zinc-800 text-zinc-400 border border-white/5 hover:bg-zinc-700'
            }
          `}
        >
          <div className="flex items-center gap-2">
            {activeTab.isRealtime ? (
              <Activity size={14} className="animate-pulse" />
            ) : (
              <RefreshCw size={14} />
            )}
            <div className="flex flex-col items-start leading-none">
              <span className="text-[8px] opacity-70 mb-0.5">{activeTab.isRealtime ? (hasRealtimeControl ? t('tabs.realtime') : t('tabs.realtime_waiting_subtitle')) : t('tabs.manual')}</span>
              <span className="font-black">{activeTab.isRealtime ? (hasRealtimeControl ? 'ON' : 'WAIT') : 'OFF'}</span>
            </div>
          </div>
          {activeTab.isRealtime && hasRealtimeControl ? <Unlock size={10} className="opacity-50" /> : <Lock size={10} className="opacity-50" />}
        </button>

        <div className="h-4 w-[1px] bg-white/10 mx-2" />
        </>)}

        <button onClick={addWand} className="neo-button bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20">
          <Plus size={14} /> {t('nav.new_wand')}
        </button>

        <label className="neo-button bg-white/5 hover:bg-white/10 cursor-pointer text-[10px]">
          <Upload size={14} /> {t('nav.import')}
          <input type="file" className="hidden" onChange={importWorkflow} />
        </label>
        <button onClick={() => exportWorkflow()} className="neo-button bg-white/5 hover:bg-white/10 text-[10px]">
          <Download size={14} /> {t('nav.export')}
        </button>
        <button
          onClick={onOpenModManager}
          className="px-2 py-1 text-[10px] font-black tracking-widest rounded border border-amber-500/30 text-amber-300/90 hover:text-amber-200 hover:bg-amber-500/10"
          title={t('settings.manage_mods')}
          data-testid="header-mod-manager-btn"
        >
          {modBundleInfo.active}/{modBundleInfo.total}
        </button>
        <button
          onClick={() => {
            setSettings(prev => ({ ...prev, isCanvasMode: !prev.isCanvasMode }));
          }}
          className={`p-2 transition-colors ${settings.isCanvasMode ? 'text-emerald-400 hover:text-emerald-300' : 'text-zinc-500 hover:text-white'}`}
          title={settings.isCanvasMode ? t('header.switch_to_list_view') : t('header.switch_to_canvas_view')}
        >
          <Layers size={18} />
        </button>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 text-zinc-500 hover:text-white transition-colors"
          data-testid="header-settings-btn"
        >
          <Settings size={18} />
        </button>
        {isConnected && (
          <button
            onClick={syncGameSpells}
            className="p-2 text-indigo-400 hover:text-indigo-300 transition-colors"
            title={t('header.sync_mod_spells')}
          >
            <Cpu size={18} />
          </button>
        )}
        {isConnected && exportModBundle && (
          <button
            onClick={exportModBundle}
            className="p-2 text-amber-400 hover:text-amber-300 transition-colors"
            title={t('header.export_mod_bundle')}
          >
            <Package size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
