import { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { DEFAULT_SPELL_TYPES, DEFAULT_SPELL_GROUPS } from '../constants';

const SETTINGS_KEY = 'twwe_settings';
const LEGACY_SETTINGS_KEY = 'wand2h_settings';

export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(SETTINGS_KEY) || localStorage.getItem(LEGACY_SETTINGS_KEY);
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
      wrapLimit: 20,
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
      exportHistory: true,
      embedMetadataInImage: true,
      pureSpellsExport: false,
      showDragModeToggle: true,
      editorDragMode: 'cursor',
      useNoitaSwapLogic: false,
      spellTypes: DEFAULT_SPELL_TYPES,
      spellGroups: DEFAULT_SPELL_GROUPS,
      warehouseFolderHeight: 200,
      wikiLanguage: 'en'
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...defaults,
          ...parsed,
          defaultWandStats: parsed.defaultWandStats || {}
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
