import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Tab, WandData, HistoryItem } from '../types';

export const useHistory = (
  tabs: Tab[],
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>,
  activeTabId: string
) => {
  const { t } = useTranslation();

  const performAction = useCallback((
    action: (prevWands: Record<string, WandData>) => Record<string, WandData>, 
    actionName = t('app.notification.unknown_action'), 
    icons?: string[], 
    saveHistory = true
  ) => {
    setTabs(prevTabs => prevTabs.map(t => {
      if (t.id === activeTabId) {
        const nextWands = action(t.wands);

        if (!saveHistory) return { ...t, wands: nextWands };

        const newItem: HistoryItem = {
          id: Math.random().toString(36).substr(2, 9),
          wands: JSON.parse(JSON.stringify(t.wands)), // 记录旧状态以便回退
          name: actionName,
          icons,
          timestamp: Date.now()
        };

        return {
          ...t,
          wands: nextWands,
          past: [...t.past.slice(-49), newItem],
          future: [] // 执行新操作，清空未来
        };
      }
      return t;
    }));
  }, [activeTabId, setTabs, t]);

  const undo = useCallback(() => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId && t.past && t.past.length > 0) {
        const lastAction = t.past[t.past.length - 1];
        const currentStateItem: HistoryItem = {
          id: 'redo-' + Date.now(),
          wands: JSON.parse(JSON.stringify(t.wands)),
          name: lastAction.name,
          icons: lastAction.icons,
          timestamp: Date.now()
        };
        return {
          ...t,
          wands: lastAction.wands,
          past: t.past.slice(0, -1),
          future: [currentStateItem, ...(t.future || [])]
        };
      }
      return t;
    }));
  }, [activeTabId, setTabs]);

  const redo = useCallback(() => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId && t.future && t.future.length > 0) {
        const nextAction = t.future[0];
        const currentStateItem: HistoryItem = {
          id: 'undo-' + Date.now(),
          wands: JSON.parse(JSON.stringify(t.wands)),
          name: nextAction.name,
          icons: nextAction.icons,
          timestamp: Date.now()
        };
        return {
          ...t,
          wands: nextAction.wands,
          past: [...(t.past || []), currentStateItem],
          future: t.future.slice(1)
        };
      }
      return t;
    }));
  }, [activeTabId, setTabs]);

  const jumpToPast = useCallback((targetPastIndex: number) => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId && t.past && t.past[targetPastIndex]) {
        const targetItem = t.past[targetPastIndex];
        const newFuture = [...t.past.slice(targetPastIndex + 1), ...(t.future || [])];
        const currentAsItem: HistoryItem = {
          id: 'jump-p-' + Date.now(),
          wands: JSON.parse(JSON.stringify(t.wands)),
          name: t.past[t.past.length - 1].name,
          icons: t.past[t.past.length - 1].icons,
          timestamp: Date.now()
        };

        return {
          ...t,
          wands: targetItem.wands,
          past: t.past.slice(0, targetPastIndex),
          future: [currentAsItem, ...newFuture]
        };
      }
      return t;
    }));
  }, [activeTabId, setTabs]);

  const jumpToFuture = useCallback((targetFutureIndex: number) => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId && t.future && t.future[targetFutureIndex]) {
        const targetItem = t.future[targetFutureIndex];
        const transitionItems = t.future.slice(0, targetFutureIndex);
        const currentAsItem: HistoryItem = {
          id: 'jump-f-' + Date.now(),
          wands: JSON.parse(JSON.stringify(t.wands)),
          name: targetItem.name,
          icons: targetItem.icons,
          timestamp: Date.now()
        };

        return {
          ...t,
          wands: targetItem.wands,
          past: [...(t.past || []), currentAsItem, ...transitionItems],
          future: t.future.slice(targetFutureIndex + 1)
        };
      }
      return t;
    }));
  }, [activeTabId, setTabs]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'y')) {
        if (e.key === 'z') {
          if (e.shiftKey) redo();
          else undo();
          e.preventDefault();
        } else if (e.key === 'y') {
          redo();
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    performAction,
    undo,
    redo,
    jumpToPast,
    jumpToFuture
  };
};
