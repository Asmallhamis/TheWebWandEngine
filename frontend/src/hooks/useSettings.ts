import { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { DEFAULT_SPELL_TYPES, DEFAULT_SPELL_GROUPS } from '../constants';

const SETTINGS_KEY = 'twwe_settings';
const LEGACY_SETTINGS_KEY = 'wand2h_settings';

export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(SETTINGS_KEY) || localStorage.getItem(LEGACY_SETTINGS_KEY);
    const isMobileDevice = typeof window !== 'undefined' && (window.innerWidth < 768 || ('ontouchstart' in window && window.innerWidth < 1024));
    const defaults: AppSettings = {
      commonLimit: 20,
      categoryLimit: 20,
      allowCompactEdit: false,
      pickerRowHeight: 32,
      themeColors: [
        'from-blue-500/10 to-blue-600/20',
        'from-green-500/10 to-green-600/20',
        'from-purple-500/10 to-purple-600/20',
        'from-orange-500/10 to-orange-600/20'
      ],
      wrapLimit: 21,
      hideLabels: false,
      conflictStrategy: 'ask',
      autoExpandOnPaste: true,
      defaultWandStats: {},
      numCasts: 3,
      autoHideThreshold: 20,
      showSpellCharges: false,
      unlimitedSpells: true,
      initialIfHalf: true,
      simulateLowHp: false,
      simulateManyEnemies: false,
      simulateManyProjectiles: false,
      evaluationSeed: '',
      groupIdenticalCasts: true,
      foldNodes: true,
      showIndices: true,
      editorSpellGap: 6,
      showStatsInFrames: true,
      showLegacyWandButton: false,
      deleteEmptySlots: true,
      ctrlClickDelete: false,
      exportHistory: true,
      embedMetadataInImage: true,
      pureSpellsExport: false,
      showDragModeToggle: true,
      editorDragMode: 'cursor',
      dragSpellMode: '20260222',
      spellTypes: DEFAULT_SPELL_TYPES,
      spellGroups: DEFAULT_SPELL_GROUPS,
      warehouseFolderHeight: 200,
      wikiLanguage: 'en',
      stopAtRecharge: true,
      perks: {},
      recursionIterationDisplay: 'labeled',
      mobilePickerMode: isMobileDevice,
      disablePickerAutoFocus: isMobileDevice,
      uiScale: isMobileDevice ? 60 : 100,
      wandAttributesScale: 100,
      hideSyncButton: isMobileDevice,
      compactAttributes: isMobileDevice,
      triggerVisualizationMode: 'standard',
      userMarkingRules: []
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...defaults,
          ...parsed,
          defaultWandStats: parsed.defaultWandStats || {},
          dragSpellMode: parsed.dragSpellMode || (parsed.useNoitaSwapLogic ? 'noita_swap' : '20260222')
        };
      } catch (e) {
        console.error("Failed to load settings from localStorage:", e);
      }
    }
    return defaults;
  });

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  return { settings, setSettings };
};
