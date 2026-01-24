import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Tab, WandData } from '../types';

interface ConflictModalProps {
  conflict: { tabId: string; gameWands: Record<string, WandData> } | null;
  activeTab: Tab;
  onResolve: (strategy: 'web' | 'game' | 'both') => void;
}

export function ConflictModal({ conflict, activeTab, onResolve }: ConflictModalProps) {
  if (!conflict) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
      <div className="glass-card bg-zinc-900 border-indigo-500/30 w-full max-w-md p-6 shadow-2xl animate-in zoom-in duration-200">
        <div className="flex items-center gap-3 mb-4 text-amber-400">
          <RefreshCw className="animate-spin-slow" />
          <h2 className="text-sm font-black tracking-widest uppercase">检测到同步冲突</h2>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed mb-6">
          您在离线期间修改了网页上的法杖，同时游戏内的数据也发生了变化（或已恢复连接）。请选择如何处理：
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => onResolve('web')}
            className="w-full flex flex-col items-start px-4 py-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 transition-all group"
          >
            <span className="text-xs font-bold text-indigo-400 group-hover:text-indigo-300">使用网页修改 (覆盖游戏)</span>
            <span className="text-[10px] text-zinc-500">将您当前的编辑结果强行同步到游戏中</span>
          </button>

          <button
            onClick={() => onResolve('game')}
            className="w-full flex flex-col items-start px-4 py-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
          >
            <span className="text-xs font-bold text-zinc-300 group-hover:text-white">使用游戏数据 (放弃网页修改)</span>
            <span className="text-[10px] text-zinc-500">丢弃您刚才在网页上的修改，拉取游戏最新状态</span>
          </button>

          <button
            onClick={() => onResolve('both')}
            className="w-full flex flex-col items-start px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all group"
          >
            <span className="text-xs font-bold text-emerald-400 group-hover:text-emerald-300">两者都要 (另存为新工作流)</span>
            <span className="text-[10px] text-zinc-500">保留网页修改，并将游戏内数据存为一个新标签页</span>
          </button>
        </div>
      </div>
    </div>
  );
}
