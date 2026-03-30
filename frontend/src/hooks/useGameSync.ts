import { useState, useEffect, useRef, useCallback } from 'react';
import { Tab, WandData, AppSettings } from '../types';

const LOCAL_EDIT_GRACE_MS = 3000;
interface UseGameSyncProps {
  activeTab: Tab;
  activeTabId: string;
  settings: AppSettings;
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  performAction: (action: (prevWands: Record<string, WandData>) => Record<string, WandData>, actionName?: string, icons?: string[], saveHistory?: boolean) => void;
  setNotification: (n: { msg: string; type: 'info' | 'success' | 'error' } | null) => void;
  setConflict: (c: { tabId: string; gameWands: Record<string, WandData> } | null) => void;
  t: any;
  lastLocalUpdateRef: React.MutableRefObject<number>;
}

const CLAIM_INTERVAL_MS = 2000;
const CONNECTION_RECOVERY_GRACE_MS = 6000;
const SUSPICIOUS_EMPTY_PULL_STREAK_THRESHOLD = 2;

const cloneWands = (wands: Record<string, WandData>) => JSON.parse(JSON.stringify(wands)) as Record<string, WandData>;
const compactAlwaysCast = (spells?: (string | null | undefined)[]) =>
  (spells || []).map(s => s || '').filter(Boolean);
const sanitizeWandForSync = (data: WandData) => ({
  ...data,
  always_cast: compactAlwaysCast(data.always_cast)
});
const hasAnyWands = (wands: Record<string, WandData> | undefined | null) => Boolean(wands && Object.keys(wands).length > 0);

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
  const [hasRealtimeControl, setHasRealtimeControl] = useState(false);
  const [realtimeOwnerExists, setRealtimeOwnerExists] = useState(false);
  const [realtimeWarning, setRealtimeWarning] = useState<string | null>(null);
  const wasConnectedRef = useRef<boolean>(false);
  const lastKnownGameWandsRef = useRef<Record<string, Record<string, WandData>>>({});
  const warnedOtherRealtimeRef = useRef<boolean>(false);
  const clientIdRef = useRef<string>('');
  const reconnectGuardUntilRef = useRef<number>(0);
  const pendingForcePullRef = useRef(false);
  const previousConnectionRef = useRef<boolean>(false);
  const suspiciousEmptyPullStreakRef = useRef<number>(0);
  const lastSuspiciousPullSignatureRef = useRef<string | null>(null);

  if (!clientIdRef.current && typeof window !== 'undefined') {
    const existing = window.sessionStorage.getItem('twwe_sync_client_id');
    if (existing) {
      clientIdRef.current = existing;
    } else {
      const next = `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem('twwe_sync_client_id', next);
      clientIdRef.current = next;
    }
  }

  const updateOwnerState = useCallback((data: any) => {
    const owned = Boolean(data?.owned);
    const hasOwner = Boolean(data?.has_owner);
    const ownerClientId = data?.owner_client_id || null;
    setHasRealtimeControl(owned);
    setRealtimeOwnerExists(hasOwner);

    if (hasOwner && !owned && ownerClientId && activeTab.isRealtime) {
      setRealtimeWarning(t('app.notification.multi_realtime_sync_detected'));
      if (!warnedOtherRealtimeRef.current) {
        setNotification({ msg: t('app.notification.multi_realtime_sync_detected'), type: 'info' });
        warnedOtherRealtimeRef.current = true;
      }
    } else {
      setRealtimeWarning(null);
      warnedOtherRealtimeRef.current = false;
    }
  }, [activeTab.isRealtime, setNotification, t]);

  const heartbeatRealtimeControl = useCallback(async () => {
    if (!activeTab.isRealtime || !isConnected || !clientIdRef.current) {
      setHasRealtimeControl(false);
      return false;
    }

    try {
      const res = await fetch('/api/sync/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientIdRef.current,
        })
      });
      const data = await res.json();
      updateOwnerState(data);
      return Boolean(data?.owned);
    } catch {
      setHasRealtimeControl(false);
      return false;
    }
  }, [activeTab.isRealtime, isConnected, updateOwnerState]);

  const claimRealtimeControl = useCallback(async () => {
    if (!activeTab.isRealtime || !isConnected || !clientIdRef.current) {
      setHasRealtimeControl(false);
      return false;
    }

    try {
      const res = await fetch('/api/sync/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientIdRef.current,
          tab_id: activeTabId,
        })
      });
      const data = await res.json();
      updateOwnerState(data);
      return Boolean(data?.owned);
    } catch {
      setHasRealtimeControl(false);
      return false;
    }
  }, [activeTab.isRealtime, activeTabId, isConnected, updateOwnerState]);

  const releaseRealtimeControl = useCallback(async () => {
    if (!clientIdRef.current) return;
    try {
      await fetch('/api/sync/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientIdRef.current })
      });
    } catch { }
    setHasRealtimeControl(false);
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const clientId = clientIdRef.current;
      const qs = clientId ? `?client_id=${encodeURIComponent(clientId)}` : '';
      const res = await fetch(`/api/status${qs}`);
      const data = await res.json();
      setIsConnected(data.connected);
      updateOwnerState(data);
    } catch {
      setIsConnected(false);
      setHasRealtimeControl(false);
    }
  }, [updateOwnerState]);

  const syncWand = useCallback(async (slot: string, data: WandData | null, isDelete = false) => {
    if (!activeTab.isRealtime || !isConnected) return;
    try {
      const payload = data ? sanitizeWandForSync(data) : null;
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot: parseInt(slot),
          delete: isDelete,
          client_id: clientIdRef.current,
          ...(payload || {})
        })
      });
    } catch { }
  }, [activeTab.isRealtime, isConnected]);

  const pullData = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force) {
      if (!hasRealtimeControl) {
        console.debug('[useGameSync] pull skipped: no realtime control');
        return;
      }
      if (now - lastLocalUpdateRef.current < LOCAL_EDIT_GRACE_MS) {
        console.debug('[useGameSync] pull skipped: local edit grace', { elapsed: now - lastLocalUpdateRef.current });
        return;
      }
      if (now < reconnectGuardUntilRef.current) {
        console.debug('[useGameSync] pull skipped: reconnect guard active', { now, reconnectGuardUntil: reconnectGuardUntilRef.current });
        return;
      }
    }

    try {
      const clientId = !force && clientIdRef.current ? `?client_id=${encodeURIComponent(clientIdRef.current)}` : '';
      console.debug('[useGameSync] pull request', { force, clientId: clientIdRef.current || null });
      const res = await fetch(`/api/pull${clientId}`);
      const data = await res.json();
      if (res.status === 409) {
        updateOwnerState(data);
        return;
      }
      if (data.success) {
        const gameWands = data.wands || {};
        const isStablePull = data.stable !== false;
        const isPausedPull = Boolean(data.paused);
        console.debug('[useGameSync] pull response', {
          force,
          stable: isStablePull,
          paused: isPausedPull,
          wandCount: Object.keys(gameWands).length,
          frame: data.frame,
          warmupUntil: data.warmup_until,
          source: data.debug_source,
        });

        if (!isStablePull) {
          if (isPausedPull || !force) {
            suspiciousEmptyPullStreakRef.current = 0;
            lastSuspiciousPullSignatureRef.current = null;
            console.debug('[useGameSync] pull ignored: unstable game state', { force, paused: isPausedPull });
            return;
          }
        } else {
          suspiciousEmptyPullStreakRef.current = 0;
          lastSuspiciousPullSignatureRef.current = null;
        }

        const gameWandsSignature = JSON.stringify(gameWands);
        const lastKnown = lastKnownGameWandsRef.current[activeTabId];
        const currentWeb = activeTab.wands;

        const lastKnownSignature = lastKnown ? JSON.stringify(lastKnown) : null;
        const currentWebSignature = JSON.stringify(currentWeb);
        const gameChanged = lastKnown && gameWandsSignature !== lastKnownSignature;
        const webChanged = lastKnown && currentWebSignature !== lastKnownSignature;
        const inSync = gameWandsSignature === currentWebSignature;
        const isEmptyGamePull = !hasAnyWands(gameWands);
        const hadKnownWands = hasAnyWands(lastKnown) || hasAnyWands(currentWeb);
        const withinRecoveryWindow = !force && Date.now() < reconnectGuardUntilRef.current;
        const shouldTreatAsSuspiciousEmptyPull = isEmptyGamePull && hadKnownWands && (withinRecoveryWindow || Boolean(lastKnown));

        const applyGameWands = (tabId: string, wands: Record<string, WandData>, name: string) => {
          performAction(() => wands, name, [], force);
          lastKnownGameWandsRef.current[tabId] = cloneWands(wands);
          suspiciousEmptyPullStreakRef.current = 0;
          lastSuspiciousPullSignatureRef.current = null;
        };

        if (inSync) {
          lastKnownGameWandsRef.current[activeTabId] = cloneWands(gameWands);
          suspiciousEmptyPullStreakRef.current = 0;
          lastSuspiciousPullSignatureRef.current = null;
          return;
        }

        if (shouldTreatAsSuspiciousEmptyPull) {
          if (lastSuspiciousPullSignatureRef.current === gameWandsSignature) {
            suspiciousEmptyPullStreakRef.current += 1;
          } else {
            suspiciousEmptyPullStreakRef.current = 1;
            lastSuspiciousPullSignatureRef.current = gameWandsSignature;
          }

          if (suspiciousEmptyPullStreakRef.current < SUSPICIOUS_EMPTY_PULL_STREAK_THRESHOLD) {
            console.debug('[useGameSync] pull ignored: suspicious empty pull', { streak: suspiciousEmptyPullStreakRef.current, force });
            return;
          }
        } else {
          suspiciousEmptyPullStreakRef.current = 0;
          lastSuspiciousPullSignatureRef.current = null;
        }

        if (force) {
          console.debug('[useGameSync] applying force-pulled game wands');
          applyGameWands(activeTabId, gameWands, t('app.notification.force_pull_game_data'));
          return;
        }

        if (gameChanged && webChanged) {
          if (settings.conflictStrategy === 'override_game') {
            Object.entries(currentWeb).forEach(([slot, d]) => syncWand(slot, d));
            lastKnownGameWandsRef.current[activeTabId] = cloneWands(currentWeb);
            console.debug('[useGameSync] conflict resolved automatically: override_game');
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
            lastKnownGameWandsRef.current[activeTabId] = cloneWands(currentWeb);
            console.debug('[useGameSync] conflict resolved automatically: new_workflow');
            setNotification({ msg: t('app.notification.auto_sync_game_to_new'), type: 'info' });
          } else {
            console.debug('[useGameSync] conflict detected: waiting for user resolution');
            setConflict({ tabId: activeTabId, gameWands });
          }
        } else if (webChanged && !gameChanged) {
          if (activeTab.isRealtime) {
            Object.entries(currentWeb).forEach(([slot, d]) => syncWand(slot, d));
          }
          console.debug('[useGameSync] web changed only: pushed current web state back to game');
          lastKnownGameWandsRef.current[activeTabId] = cloneWands(currentWeb);
        } else if (gameChanged && !webChanged) {
          if (!force && Date.now() - lastLocalUpdateRef.current < LOCAL_EDIT_GRACE_MS + 2000) return;
          console.debug('[useGameSync] game changed only: applying game wands');
          applyGameWands(activeTabId, gameWands, t('app.notification.sync_from_game'));
        } else if (!lastKnown) {
          console.debug('[useGameSync] initial sync from game');
          applyGameWands(activeTabId, gameWands, t('app.notification.initial_sync'));
        }
      }
    } catch { }
  }, [activeTabId, activeTab.wands, activeTab.isRealtime, activeTab.name, hasRealtimeControl, isConnected, settings, t, performAction, setNotification, setConflict, syncWand, lastLocalUpdateRef, setTabs, updateOwnerState]);

  const resolveConflict = useCallback((strategy: 'web' | 'game' | 'both', conflict: { tabId: string; gameWands: Record<string, WandData> }, currentActiveTab: Tab) => {
    if (strategy === 'web') {
      Object.entries(currentActiveTab.wands).forEach(([slot, d]) => syncWand(slot, d));
      lastKnownGameWandsRef.current[conflict.tabId] = cloneWands(currentActiveTab.wands);
      setConflict(null);
    } else if (strategy === 'game') {
      performAction(() => conflict.gameWands, t('app.notification.force_pull_game_data'));
      lastKnownGameWandsRef.current[conflict.tabId] = cloneWands(conflict.gameWands);
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
      lastKnownGameWandsRef.current[conflict.tabId] = cloneWands(currentActiveTab.wands);
      setConflict(null);
    }
  }, [syncWand, performAction, setTabs, t, setConflict]);

  const pushAllToGame = useCallback(async () => {
    if (!isConnected) {
      setNotification({ msg: t('app.notification.not_connected_to_game'), type: 'info' });
      return;
    }
    if (activeTab.isRealtime && !hasRealtimeControl) {
      setNotification({ msg: t('app.notification.multi_realtime_sync_detected'), type: 'info' });
    }
    const wands = activeTab.wands;
    const entries = Object.entries(wands);
    if (entries.length === 0) return;

    try {
      for (const [slot, data] of entries) {
        const payload = sanitizeWandForSync(data);
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slot: parseInt(slot),
            delete: false,
            client_id: clientIdRef.current,
            ...payload
          })
        });
      }
      setNotification({ msg: t('app.notification.pushed_to_game', { count: entries.length }), type: 'success' });
    } catch (e) {
      setNotification({ msg: t('app.notification.push_failed'), type: 'info' });
    }
  }, [activeTab.wands, activeTab.isRealtime, hasRealtimeControl, isConnected, t, setNotification]);

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
    if (activeTab.isRealtime && isConnected && hasRealtimeControl) {
      pullTimer = setInterval(() => pullData(), 1000);
    }
    return () => clearInterval(pullTimer);
  }, [activeTab.isRealtime, isConnected, hasRealtimeControl, pullData]);

  useEffect(() => {
    let heartbeatTimer: any;
    let retryClaimTimer: any;
    let cancelled = false;
    if (activeTab.isRealtime && isConnected) {
      claimRealtimeControl().then((owned) => {
        if (cancelled || !owned) return;
        heartbeatTimer = setInterval(() => {
          heartbeatRealtimeControl();
        }, CLAIM_INTERVAL_MS);
      });

      retryClaimTimer = setInterval(() => {
        if (!hasRealtimeControl) {
          claimRealtimeControl();
        }
      }, CLAIM_INTERVAL_MS);
    } else {
      setHasRealtimeControl(false);
      setRealtimeWarning(null);
    }

    return () => {
      cancelled = true;
      clearInterval(heartbeatTimer);
      clearInterval(retryClaimTimer);
    };
  }, [activeTab.isRealtime, isConnected, activeTabId, claimRealtimeControl, heartbeatRealtimeControl, hasRealtimeControl]);

  useEffect(() => {
    if (isConnected && !previousConnectionRef.current) {
      lastKnownGameWandsRef.current = {};
      suspiciousEmptyPullStreakRef.current = 0;
      lastSuspiciousPullSignatureRef.current = null;
      if (activeTab.isRealtime) {
        reconnectGuardUntilRef.current = Date.now() + CONNECTION_RECOVERY_GRACE_MS;
        pendingForcePullRef.current = hasRealtimeControl;
        console.debug('[useGameSync] connection recovered: enabling reconnect guard', { reconnectGuardUntil: reconnectGuardUntilRef.current, pendingForcePull: pendingForcePullRef.current });
      }
    }
    if (!isConnected) {
      pendingForcePullRef.current = false;
      reconnectGuardUntilRef.current = 0;
      suspiciousEmptyPullStreakRef.current = 0;
      lastSuspiciousPullSignatureRef.current = null;
      console.debug('[useGameSync] connection lost: cleared pull guards');
    }
    wasConnectedRef.current = isConnected;
    previousConnectionRef.current = isConnected;
  }, [isConnected, activeTab.isRealtime, hasRealtimeControl]);

  useEffect(() => {
    if (!activeTab.isRealtime || !isConnected || !hasRealtimeControl || !pendingForcePullRef.current) return;
    if (Date.now() < reconnectGuardUntilRef.current) return;
    pendingForcePullRef.current = false;
    console.debug('[useGameSync] reconnect guard expired: performing deferred force pull');
    pullData(true);
  }, [activeTab.isRealtime, isConnected, hasRealtimeControl, pullData]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!clientIdRef.current) return;
      navigator.sendBeacon('/api/sync/release', new Blob([
        JSON.stringify({ client_id: clientIdRef.current })
      ], { type: 'application/json' }));
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (!activeTab.isRealtime) {
      releaseRealtimeControl();
    }
  }, [activeTab.isRealtime, releaseRealtimeControl]);

  return {
    isConnected,
    hasRealtimeControl,
    realtimeOwnerExists,
    realtimeWarning,
    syncWand,
    pullData,
    pushAllToGame,
    toggleSync,
    resolveConflict,
  };
};
