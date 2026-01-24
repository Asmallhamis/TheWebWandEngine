import React from 'react';
import { Zap, Info } from 'lucide-react';
import { Tab } from '../types';

interface FooterProps {
  isConnected: boolean;
  activeTab: Tab;
  tabsCount: number;
  notification: { msg: string; type: 'info' | 'success' } | null;
}

export function Footer({ isConnected, activeTab, tabsCount, notification }: FooterProps) {
  return (
    <>
      <footer className="px-3 py-1.5 bg-zinc-900 border-t border-white/10 flex justify-between items-center text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 animate-pulse'}`} />
            {isConnected ? 'Sync: Connected' : 'Sync: Offline'}
          </div>
          <div className="w-px h-3 bg-white/10" />
          <span>Active: {activeTab.name}</span>
        </div>
        <div className="flex gap-4">
          <span>Tabs: {tabsCount}</span>
          <span>TheWebWandEngine • Professional Refactored v0.4.0</span>
        </div>
      </footer>

      {/* Floating Notification */}
      {notification && (
        <div className="fixed bottom-12 right-6 z-[500] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className={`px-4 py-3 rounded-lg shadow-2xl border flex items-center gap-3 ${
            notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
          }`}>
            {notification.type === 'success' ? <Zap size={16} /> : <Info size={16} />}
            <span className="text-xs font-black uppercase tracking-wider">{notification.msg}</span>
          </div>
        </div>
      )}
    </>
  );
}
