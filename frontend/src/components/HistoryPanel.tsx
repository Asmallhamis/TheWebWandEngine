import React from 'react';
import { History, X, Undo2, Redo2, Clock } from 'lucide-react';
import { Tab, SpellInfo } from '../types';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: Tab;
  spellDb: Record<string, SpellInfo>;
  onJumpPast: (idx: number) => void;
  onJumpFuture: (idx: number) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function HistoryPanel({
  isOpen,
  onClose,
  activeTab,
  spellDb,
  onJumpPast,
  onJumpFuture,
  onUndo,
  onRedo
}: HistoryPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-zinc-900/95 backdrop-blur-xl border-l border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] z-[300] flex flex-col animate-in slide-in-from-right duration-300">
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
        <div className="flex items-center gap-2">
          <History size={18} className="text-indigo-400" />
          <h2 className="text-sm font-black uppercase tracking-widest">历史记录</h2>
        </div>
        <button 
          onClick={onClose} 
          className="p-2 hover:bg-white/10 rounded-full text-zinc-500 hover:text-white transition-colors"
          title="关闭面板"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="flex flex-col">
          {(!activeTab.past || activeTab.past.length === 0) && (!activeTab.future || activeTab.future.length === 0) && (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-600 gap-2">
              <Clock size={32} className="opacity-10" />
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">暂无操作记录</p>
            </div>
          )}

          {/* Past Actions (Undoable) */}
          <div className="flex flex-col">
            {activeTab.past && activeTab.past.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => onJumpPast(idx)}
                className="flex flex-col px-4 py-3 text-left border-b border-white/5 transition-all hover:bg-indigo-500/5 group/hitem relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500/0 group-hover/hitem:bg-indigo-500 transition-all" />
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-zinc-300 group-hover/hitem:text-white">
                    {item.name}
                  </span>
                  <span className="text-[9px] font-mono text-zinc-600 group-hover/hitem:text-indigo-300/50">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                {item.icons && item.icons.length > 0 && (
                  <div className="flex flex-wrap gap-1 max-h-12 overflow-hidden group-hover/hitem:max-h-none transition-all duration-300">
                    {item.icons.slice(0, 15).map((sid, i) => {
                      const spell = spellDb[sid];
                      return spell ? (
                        <img key={i} src={`/api/icon/${spell.icon}`} className="w-5 h-5 image-pixelated border border-white/5 rounded-sm bg-black/40 shadow-sm" alt="" />
                      ) : null;
                    })}
                    {item.icons.length > 15 && (
                      <span className="text-[8px] text-zinc-500 flex items-center px-1 font-black">+{item.icons.length - 15}</span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
          
          {/* Current State Indicator */}
          {(activeTab.past?.length > 0 || activeTab.future?.length > 0) && (
            <div className="px-4 py-4 bg-indigo-600/20 border-l-4 border-l-indigo-500 border-y border-white/10 sticky top-0 z-10 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                <span className="text-xs font-black text-white uppercase tracking-wider">当前状态</span>
              </div>
              <div className="text-[9px] text-indigo-400/70 uppercase font-black tracking-widest mt-1">Latest Working Version</div>
            </div>
          )}

          {/* Future Actions (Redoable) */}
          <div className="flex flex-col">
            {activeTab.future && activeTab.future.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => onJumpFuture(idx)}
                className="flex flex-col px-4 py-3 text-left border-b border-white/5 group/fitem relative overflow-hidden transition-all hover:bg-emerald-500/10"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500/0 group-hover/fitem:bg-emerald-500 transition-all" />
                <div className="flex justify-between items-start mb-2 opacity-50 group-hover/fitem:opacity-100 transition-opacity">
                  <span className="text-xs font-bold text-zinc-400 group-hover/fitem:text-emerald-400">
                    {item.name}
                  </span>
                  <span className="text-[9px] font-mono text-zinc-700">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                {item.icons && item.icons.length > 0 && (
                  <div className="flex flex-wrap gap-1 opacity-30 group-hover/fitem:opacity-100 transition-all">
                    {item.icons.slice(0, 15).map((sid, i) => {
                      const spell = spellDb[sid];
                      return spell ? (
                        <img key={i} src={`/api/icon/${spell.icon}`} className="w-4 h-4 image-pixelated border border-white/5 rounded-sm bg-black/40 grayscale group-hover/fitem:grayscale-0" alt="" />
                      ) : null;
                    })}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 bg-black/40 border-t border-white/10 space-y-3 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
        <div className="flex gap-2">
          <button
            onClick={onUndo}
            disabled={!activeTab.past || activeTab.past.length === 0}
            className="flex-1 py-2.5 bg-zinc-800 hover:bg-indigo-600 disabled:bg-zinc-900 disabled:opacity-20 disabled:cursor-not-allowed rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group shadow-lg active:scale-95"
          >
            <Undo2 size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            后退 (Ctrl+Z)
          </button>
          <button
            onClick={onRedo}
            disabled={!activeTab.future || activeTab.future.length === 0}
            className="flex-1 py-2.5 bg-zinc-800 hover:bg-emerald-600 disabled:bg-zinc-900 disabled:opacity-20 disabled:cursor-not-allowed rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group shadow-lg active:scale-95"
          >
            前进 (Ctrl+Y)
            <Redo2 size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
        <p className="text-[9px] text-zinc-600 text-center uppercase font-black tracking-[0.2em] opacity-50">
          操作记录仅针对当前工作流
        </p>
      </div>
    </div>
  );
}
