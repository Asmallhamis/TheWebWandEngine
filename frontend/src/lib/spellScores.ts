import { AppSettings, SpellInfo, SpellScorePreset, SpellStats, Tab, WarehouseWand } from '../types';

export interface SpellScoreDetail {
  spell: SpellInfo;
  total: number;
  auto: number;
  preset: number;
  manual: number;
  workflowScore: number;
  warehouseScore: number;
  liveWorkflowScore: number;
  liveWarehouseScore: number;
  workflowOccurrence: number;
  workflowWandPresence: number;
  warehouseWandPresence: number;
}

export const DEFAULT_SPELL_SCORE_WEIGHTS = {
  workflowOccurrence: 1,
  workflowWandPresence: 5,
  warehouseWandPresence: 2,
};

export const DEFAULT_SPELL_SCORE_PRESET_ID = 'default';

export const createDefaultSpellScorePreset = (scores: Record<string, number> = {}): SpellScorePreset => ({
  id: DEFAULT_SPELL_SCORE_PRESET_ID,
  name: '默认预设',
  scores,
  weights: DEFAULT_SPELL_SCORE_WEIGHTS,
  lockWorkflowScores: false,
  lockWarehouseScores: false,
  workflowScores: {},
  warehouseScores: {},
});

export const ensureSpellScorePresets = (settings: Partial<AppSettings>): SpellScorePreset[] => {
  const presets = Array.isArray(settings.spellScorePresets) ? settings.spellScorePresets : [];
  const defaultPreset = createDefaultSpellScorePreset(settings.spellManualScores || {});
  const hasDefault = presets.some(preset => preset.id === DEFAULT_SPELL_SCORE_PRESET_ID);
  return hasDefault
    ? presets.map(preset => preset.id === DEFAULT_SPELL_SCORE_PRESET_ID ? { ...defaultPreset, ...preset } : preset)
    : [defaultPreset, ...presets];
};

export const getActiveSpellScorePreset = (settings: AppSettings): SpellScorePreset => {
  const presets = ensureSpellScorePresets(settings);
  const presetId = settings.activeSpellScorePresetId || DEFAULT_SPELL_SCORE_PRESET_ID;
  return presets.find(preset => preset.id === presetId) || presets[0];
};

const forEachWandSpellSet = (
  wands: Array<{ spells?: Record<string, string> }>,
  visit: (spellId: string) => void
) => {
  wands.forEach(wand => {
    const unique = new Set(Object.values(wand.spells || {}).filter(Boolean));
    unique.forEach(visit);
  });
};

export const buildSpellScoreDetails = (
  tabs: Tab[],
  warehouseWands: WarehouseWand[],
  spellDb: Record<string, SpellInfo>,
  settings: AppSettings
): SpellScoreDetail[] => {
  const workflowOccurrences: Record<string, number> = {};
  const workflowWandPresence: Record<string, number> = {};
  const warehouseWandPresence: Record<string, number> = {};

  tabs.forEach(tab => {
    Object.values(tab.wands || {}).forEach(wand => {
      Object.values(wand.spells || {}).forEach(spellId => {
        if (!spellId) return;
        workflowOccurrences[spellId] = (workflowOccurrences[spellId] || 0) + 1;
      });
    });

    forEachWandSpellSet(Object.values(tab.wands || {}), spellId => {
      workflowWandPresence[spellId] = (workflowWandPresence[spellId] || 0) + 1;
    });
  });

  forEachWandSpellSet(warehouseWands || [], spellId => {
    warehouseWandPresence[spellId] = (warehouseWandPresence[spellId] || 0) + 1;
  });

  const weights = {
    ...DEFAULT_SPELL_SCORE_WEIGHTS,
    ...(settings.spellScoreWeights || {}),
    ...(getActiveSpellScorePreset(settings).weights || {}),
  };
  const activePreset = getActiveSpellScorePreset(settings);
  const presetScores = activePreset.scores || {};

  return Object.values(spellDb).map(spell => {
    const workflowOccurrence = workflowOccurrences[spell.id] || 0;
    const workflowWandCount = workflowWandPresence[spell.id] || 0;
    const warehouseWandCount = warehouseWandPresence[spell.id] || 0;
    const liveWorkflowScore =
      workflowOccurrence * weights.workflowOccurrence +
      workflowWandCount * weights.workflowWandPresence;
    const liveWarehouseScore = warehouseWandCount * weights.warehouseWandPresence;
    const workflowScore = activePreset.lockWorkflowScores
      ? (activePreset.workflowScores?.[spell.id] ?? 0)
      : liveWorkflowScore;
    const warehouseScore = activePreset.lockWarehouseScores
      ? (activePreset.warehouseScores?.[spell.id] ?? 0)
      : liveWarehouseScore;
    const auto = workflowScore + warehouseScore;
    const preset = presetScores[spell.id] || 0;
    const manual = 0;

    return {
      spell,
      total: auto + preset + manual,
      auto,
      preset,
      manual,
      workflowScore,
      warehouseScore,
      liveWorkflowScore,
      liveWarehouseScore,
      workflowOccurrence,
      workflowWandPresence: workflowWandCount,
      warehouseWandPresence: warehouseWandCount,
    };
  }).sort((a, b) => b.total - a.total || a.spell.id.localeCompare(b.spell.id));
};

export const buildSpellStatsFromScores = (
  scoreDetails: SpellScoreDetail[],
  settings: AppSettings,
  expandedGroups: Set<number>
): SpellStats => {
  const allSpells = scoreDetails.map(detail => detail.spell);
  const overall = settings.commonLimit > 0
    ? (expandedGroups.has(-1) ? allSpells : allSpells.slice(0, settings.commonLimit))
    : [];

  const categories = settings.spellGroups.map((group, idx) => {
    const spells = scoreDetails
      .filter(detail => group.types.includes(detail.spell.type))
      .map(detail => detail.spell);
    return expandedGroups.has(idx) ? spells : spells.slice(0, settings.categoryLimit);
  });

  return { overall, categories };
};
