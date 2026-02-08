import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Tab, AppSettings, WandData } from '../types';
import { DEFAULT_WAND } from '../constants';

export const useTabs = (settings: AppSettings, setSettings: (s: AppSettings) => void) => {
  const { t } = useTranslation();
  
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const saved = localStorage.getItem('twwe_tabs') || localStorage.getItem('wand2h_tabs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((t: any) => ({
            ...t,
            expandedWands: new Set(t.expandedWands || []),
            past: Array.isArray(t.past) ? t.past : [],
            future: Array.isArray(t.future) ? t.future : []
          }));
        }
      } catch (e) {
        console.error("Failed to load tabs from localStorage:", e);
      }
    }
    return [
      { id: '1', name: t('tabs.realtime'), isRealtime: true, wands: { '1': { ...DEFAULT_WAND } }, expandedWands: new Set(['1']), past: [], future: [] },
      { id: '2', name: t('tabs.sandbox'), isRealtime: false, wands: { '1': { ...DEFAULT_WAND } }, expandedWands: new Set(['1']), past: [], future: [] }
    ];
  });

  const [activeTabId, setActiveTabId] = useState('1');

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);

  // Persistence
  useEffect(() => {
    const dataToSave = tabs.map(t => ({
      ...t,
      expandedWands: Array.from(t.expandedWands)
    }));
    localStorage.setItem('twwe_tabs', JSON.stringify(dataToSave));
  }, [tabs]);

  const addNewTab = useCallback(() => {
    const id = Date.now().toString();
    const defaultWand = { ...DEFAULT_WAND, ...settings.defaultWandStats };
    const newTab: Tab = {
      id,
      name: t('app.notification.new_workflow_default', { id: tabs.length + 1 }),
      isRealtime: false,
      wands: { '1': defaultWand },
      expandedWands: new Set(['1']),
      past: [],
      future: []
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(id);
  }, [tabs, settings.defaultWandStats, t]);

  const deleteTab = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (tabs.length <= 1) return;
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) setActiveTabId(newTabs[0].id);
  }, [tabs, activeTabId]);

  const exportAllData = useCallback(() => {
    const data = {
      version: '1.0',
      timestamp: Date.now(),
      settings: settings,
      tabs: tabs.map(t => {
        const tabData = { ...t, expandedWands: Array.from(t.expandedWands) };
        if (!settings.exportHistory) {
          tabData.past = [];
          tabData.future = [];
        }
        return tabData;
      })
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `twwe_full_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  }, [tabs, settings]);

  const importAllData = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm(t('app.notification.import_backup_confirm'))) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.settings) setSettings(data.settings);
        if (data.tabs) {
          const processedTabs = data.tabs.map((t: any) => ({
            ...t,
            expandedWands: new Set(t.expandedWands)
          }));
          setTabs(processedTabs);
          if (processedTabs.length > 0) setActiveTabId(processedTabs[0].id);
        }
        alert(t('app.notification.import_all_success'));
      } catch (err) { alert(t('app.notification.import_failed_format')); }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  }, [t, setSettings]);

  const importWorkflow = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const newTabId = Date.now().toString();
        const fileName = file.name.replace('.json', '');

        const isFullWorkflow = data && data.type === 'twwe_workflow' && data.wands;
        const wands = isFullWorkflow ? data.wands : data;
        const past = isFullWorkflow ? (data.past || []) : [];
        const future = isFullWorkflow ? (data.future || []) : [];

        setTabs(prev => [
          ...prev,
          {
            id: newTabId,
            name: isFullWorkflow ? (data.name || fileName) : fileName,
            isRealtime: false,
            wands: wands,
            expandedWands: new Set(Object.keys(wands)),
            past: past,
            future: future
          }
        ]);
        setActiveTabId(newTabId);
      } catch (err) { alert(t('app.notification.import_failed_generic')); }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  }, []);

  const exportWorkflow = useCallback((tabId?: string) => {
    const targetTab = tabId ? tabs.find(t => t.id === tabId) : activeTab;
    if (!targetTab) return;

    let exportData: any = targetTab.wands;
    if (settings.exportHistory) {
      exportData = {
        type: 'twwe_workflow',
        name: targetTab.name,
        wands: targetTab.wands,
        past: targetTab.past,
        future: targetTab.future
      };
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wand_workflow_${targetTab.name}.json`;
    a.click();
  }, [tabs, activeTab, settings.exportHistory]);

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    activeTab,
    addNewTab,
    deleteTab,
    exportAllData,
    importAllData,
    importWorkflow,
    exportWorkflow
  };
};
