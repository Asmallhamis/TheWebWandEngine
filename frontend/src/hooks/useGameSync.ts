import { useState, useEffect, useRef, useCallback } from 'react';
import { Tab, WandData, AppSettings } from '../types';

interface UseGameSyncProps {
  activeTab: Tab;
  activeTabId: string;
  settings: AppSettings;
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  performAction: (action: (prevWands: Record<string, WandData>) => Record<string, WandData>, actionName?: string, icons?: string[], saveHistory?: boolean) => void;
  setNotification: (n: { msg: string; type: 'info' | 'success' } | null) => void;
  setConflict: (c: { tabId: string; gameWands: Record<string, WandData> } | null) => void;
  t: any;
  lastLocalUpdateRef: React.MutableRefObject<number>;
}

export const useGameSync = ({
  activeTab,
  activeTabId,
  settings,
  setTabs,
  performAction,
  setNotification,
  setConflict,
  t,
  lastLocalUpdateRef
}: UseGameSyncProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const wasConnectedRef = useRef<boolean>(false);
  const lastKnownGameWandsRef = useRef<Record<string, Record<string, WandData>>>({});

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setIsConnected(data.connected);
    } catch {
      setIsConnected(false);
    }
  }, []);

  const syncWand = useCallback(async (slot: string, data: WandData | null, isDelete = false) => {
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
  }, [activeTab.isRealtime, isConnected]);

  const pullData = useCallback(async (force = false) => {
    if (!force && Date.now() - lastLocalUpdateRef.current < 3000) return;

    try {
      const res = await fetch('/api/pull');
      const data = await res.json();
      if (data.success) {
        const gameWands = data.wands || {};
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
          lastKnownGameWandsRef.current[activeTabId] = JSON.parse(JSON.stringify(gameWands));
          return;
        }

        if (force) {
          applyGameWands(activeTabId, gameWands, t('app.notification.force_pull_game_data'));
          return;
        }

        if (gameChanged && webChanged) {
          if (settings.conflictStrategy === 'override_game') {
            Object.entries(currentWeb).forEach(([slot, d]) => syncWand(slot, d));
            lastKnownGameWandsRef.current[activeTabId] = JSON.parse(JSON.stringify(currentWeb));
            setNotification({ msg: t('app.notification.auto_sync_web_over_game'), type: 'success' });
          } else if (settings.conflictStrategy === 'new_workflow') {
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
            setNotification({ msg: t('app.notification.auto_sync_game_to_new'), type: 'info' });
          } else {
            setConflict({ tabId: activeTabId, gameWands });
          }
        } else if (webChanged && !gameChanged) {
          if (activeTab.isRealtime) {
            Object.entries(currentWeb).forEach(([slot, d]) => syncWand(slot, d));
          }
          lastKnownGameWandsRef.current[activeTabId] = JSON.parse(JSON.stringify(currentWeb));
        } else if (gameChanged && !webChanged) {
          if (!force && Date.now() - lastLocalUpdateRef.current < 5000) return;
          applyGameWands(activeTabId, gameWands, t('app.notification.sync_from_game'));
        } else if (!lastKnown) {
          applyGameWands(activeTabId, gameWands, t('app.notification.initial_sync'));
        }
      }
    } catch { }
  }, [activeTabId, activeTab.wands, activeTab.isRealtime, activeTab.name, isConnected, settings, t, performAction, setNotification, setConflict, syncWand, lastLocalUpdateRef, setTabs]);

  const resolveConflict = useCallback((strategy: 'web' | 'game' | 'both', conflict: { tabId: string; gameWands: Record<string, WandData> }, currentActiveTab: Tab) => {
    if (strategy === 'web') {
      Object.entries(currentActiveTab.wands).forEach(([slot, d]) => syncWand(slot, d));
      lastKnownGameWandsRef.current[conflict.tabId] = JSON.parse(JSON.stringify(currentActiveTab.wands));
      setConflict(null);
    } else if (strategy === 'game') {
      performAction(() => conflict.gameWands, t('app.notification.force_pull_game_data'));
      lastKnownGameWandsRef.current[conflict.tabId] = JSON.parse(JSON.stringify(conflict.gameWands));
      setConflict(null);
    } else if (strategy === 'both') {
      const id = Date.now().toString();
      setTabs(prev => [...prev, {
        id,
        name: `[备份] ${currentActiveTab.name}`,
        isRealtime: false,
        wands: conflict.gameWands,
        expandedWands: new Set(Object.keys(conflict.gameWands)),
        past: [],
        future: []
      }]);
      lastKnownGameWandsRef.current[conflict.tabId] = JSON.parse(JSON.stringify(currentActiveTab.wands));
      setConflict(null);
    }
  }, [syncWand, performAction, setTabs, t, setConflict]);

  const pushAllToGame = useCallback(async () => {
    if (!isConnected) {
      setNotification({ msg: t('app.notification.not_connected_to_game'), type: 'info' });
      return;
    }
    const wands = activeTab.wands;
    const entries = Object.entries(wands);
    if (entries.length === 0) return;

    try {
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
      setNotification({ msg: t('app.notification.pushed_to_game', { count: entries.length }), type: 'success' });
    } catch (e) {
      setNotification({ msg: t('app.notification.push_failed'), type: 'info' });
    }
  }, [activeTab.wands, isConnected, t, setNotification]);

  const toggleSync = useCallback((id: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, isRealtime: !t.isRealtime } : t));
  }, [setTabs]);

  useEffect(() => {
    const isStaticMode = (import.meta as any).env?.VITE_STATIC_MODE === 'true';
    if (isStaticMode) {
      setIsConnected(false);
      return;
    }
    const statusTimer = setInterval(checkStatus, 3000);
    checkStatus();
    return () => clearInterval(statusTimer);
  }, [checkStatus]);

  useEffect(() => {
    let pullTimer: any;
    if (activeTab.isRealtime && isConnected) {
      pullTimer = setInterval(() => pullData(), 1000);
    }
    return () => clearInterval(pullTimer);
  }, [activeTab.isRealtime, isConnected, pullData]);

  useEffect(() => {
    if (isConnected && !wasConnectedRef.current) {
      lastKnownGameWandsRef.current = {};
      if (activeTab.isRealtime) {
        pullData(true);
      }
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected, activeTab.isRealtime, pullData]);

  return { isConnected, syncWand, pullData, pushAllToGame, toggleSync, resolveConflict };
};
