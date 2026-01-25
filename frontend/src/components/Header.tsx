import React from 'react';
import { Cpu, Activity, Layers, X, Plus, RefreshCw, Lock, Unlock, Clipboard, Upload, Download, Settings } from 'lucide-react';
import { Tab, WandData } from '../types';

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
  isConnected
}: HeaderProps) {
  return (
    <header className="flex items-center px-4 pt-2 bg-zinc-900/50 border-b border-white/5 space-x-0.5">
      <div className="flex items-center gap-2.5 px-3 py-2 mr-6">
        <div className="w-7 h-7 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Cpu size={16} className="text-white" />
        </div>
        <span className="font-extrabold text-[13px] tracking-tight">TWWE</span>
      </div>

      <div className="flex items-center gap-0.5 max-w-[70vw] overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <div key={tab.id} className="group relative">
            <button
              onClick={() => setActiveTabId(tab.id)}
              onDoubleClick={() => {
                const newName = prompt('重命名工作流:', tab.name);
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
          title="添加新工作流"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5 pr-4 pb-1">
        <button
          onClick={() => pullData(true)}
          onContextMenu={(e) => { e.preventDefault(); pushData(); }}
          title="左键: 拉取一次 / 右键: 推送当前到游戏"
          className={`
            neo-button text-[10px] w-32 justify-between px-3
            ${activeTab.isRealtime
              ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
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
              <span className="text-[8px] opacity-70 mb-0.5">{activeTab.isRealtime ? '自动同步' : '同步模式'}</span>
              <span className="font-black">{activeTab.isRealtime ? 'ON' : '手动'}</span>
            </div>
          </div>
          {activeTab.isRealtime ? <Unlock size={10} className="opacity-50" /> : <Lock size={10} className="opacity-50" />}
        </button>

        <div className="h-4 w-[1px] bg-white/10 mx-2" />

        <button onClick={addWand} className="neo-button bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20">
          <Plus size={14} /> 新法杖
        </button>

        <label className="neo-button bg-white/5 hover:bg-white/10 cursor-pointer text-[10px]">
          <Upload size={14} /> 导入
          <input type="file" className="hidden" onChange={importWorkflow} />
        </label>
        <button onClick={() => exportWorkflow()} className="neo-button bg-white/5 hover:bg-white/10 text-[10px]">
          <Download size={14} /> 导出
        </button>
        <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-zinc-500 hover:text-white transition-colors">
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
