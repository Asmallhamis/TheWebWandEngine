import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SpellInfo, Tab, AppSettings, SpellStats, WarehouseWand } from '../types';
import { checkPinyinFuzzy } from '../lib/searchUtils';
import { buildSpellScoreDetails, buildSpellStatsFromScores } from '../lib/spellScores';

export const searchSpells = (
  spellDb: Record<string, SpellInfo>,
  rawQuery: string,
  language: string
) => {
  const query = rawQuery.toLowerCase().trim();
  if (!query) return [];

  const hasWordChars = /[a-z0-9\u4e00-\u9fa5]/.test(query);
  const isNumericQuery = /^[0-9]+$/.test(query);
  const allSpells = Object.values(spellDb);
  const isEnglish = language.startsWith('en');

  const scored = allSpells.map(s => {
    const pyVariants = (s.pinyin_variants || []).map(v => v.toLowerCase());
    const pyInitVariants = (s.pinyin_initials_variants || []).map(v => v.toLowerCase());
    const aliasPyVariants = (s.alias_pinyin_variants || []).map(v => v.toLowerCase());
    const aliasInitVariants = (s.alias_initials_variants || []).map(v => v.toLowerCase());
    let score = 0;
    const id = s.id.toLowerCase();
    const name = s.name.toLowerCase();
    const en = (s.en_name || "").toLowerCase();
    const py = (s.pinyin || "").toLowerCase();
    const init = (s.pinyin_initials || "").toLowerCase();
    const aliases = (s.aliases || "").toLowerCase();
    const aliasParts = aliases.split(/\s+/).filter(Boolean);
    const hasAliasExact = aliasParts.includes(query);
    const apy = (s.alias_pinyin || "").toLowerCase();
    const ainit = (s.alias_initials || "").toLowerCase();

    if (id === query) score += 100;
    else if (name === query) score += 90;
    else if (en === query) score += 85;
    else if (hasAliasExact) score += 80;
    else if (id.startsWith(query)) score += 70;
    else if (name.startsWith(query)) score += 65;
    else if (en.startsWith(query)) score += 60;
    else if (!isEnglish && hasWordChars && !isNumericQuery && init.startsWith(query)) score += 55;
    else if (!isEnglish && hasWordChars && !isNumericQuery && py.startsWith(query)) score += 50;
    else if (!isEnglish && hasWordChars && !isNumericQuery && checkPinyinFuzzy(query, py, init)) score += 48;
    else if (!isEnglish && hasWordChars && !isNumericQuery && pyInitVariants.some(v => v.startsWith(query))) score += 47;
    else if (!isEnglish && hasWordChars && !isNumericQuery && pyVariants.some(v => v.startsWith(query))) score += 46;
    else if (!isEnglish && hasWordChars && !isNumericQuery && pyVariants.some(v => pyInitVariants.some(initVariant => checkPinyinFuzzy(query, v, initVariant)))) score += 44;
    else if (!isEnglish && hasWordChars && !isNumericQuery && ainit.startsWith(query)) score += 45;
    else if (!isEnglish && hasWordChars && !isNumericQuery && apy.startsWith(query)) score += 40;
    else if (!isEnglish && hasWordChars && !isNumericQuery && checkPinyinFuzzy(query, apy, ainit)) score += 38;
    else if (!isEnglish && hasWordChars && !isNumericQuery && aliasInitVariants.some(v => v.startsWith(query))) score += 37;
    else if (!isEnglish && hasWordChars && !isNumericQuery && aliasPyVariants.some(v => v.startsWith(query))) score += 36;
    else if (!isEnglish && hasWordChars && !isNumericQuery && aliasPyVariants.some(v => aliasInitVariants.some(initVariant => checkPinyinFuzzy(query, v, initVariant)))) score += 34;
    else if (aliases.includes(query)) score += 32;
    else if (id.includes(query)) score += 30;
    else if (name.includes(query)) score += 25;
    else if (en.includes(query)) score += 20;
    else if (!isEnglish && hasWordChars && !isNumericQuery && init.includes(query)) score += 15;
    else if (!isEnglish && hasWordChars && !isNumericQuery && py.includes(query)) score += 10;
    else if (!isEnglish && hasWordChars && !isNumericQuery && pyInitVariants.some(v => v.includes(query))) score += 9;
    else if (!isEnglish && hasWordChars && !isNumericQuery && pyVariants.some(v => v.includes(query))) score += 8;
    else if (!isEnglish && hasWordChars && !isNumericQuery && ainit.includes(query)) score += 8;
    else if (!isEnglish && hasWordChars && !isNumericQuery && aliasInitVariants.some(v => v.includes(query))) score += 7;
    else if (!isEnglish && hasWordChars && !isNumericQuery && apy.includes(query)) score += 5;
    else if (!isEnglish && hasWordChars && !isNumericQuery && aliasPyVariants.some(v => v.includes(query))) score += 4;
    else if (!isEnglish && hasWordChars && !isNumericQuery && aliasPyVariants.some(v => aliasInitVariants.some(initVariant => checkPinyinFuzzy(query, v, initVariant)))) score += 3;

    if (id.startsWith('divide_')) {
      if (query === 'd') {
        score += 20;
      } else if (query.startsWith('d')) {
        const num = query.slice(1);
        if (num === '1' && id === 'divide_10') score += 100;
        else if (id === `divide_${num}`) score += 100;
      }
    }

    return { spell: s, score };
  }).filter(x => x.score > 0);

  scored.sort((a, b) => b.score - a.score || a.spell.id.localeCompare(b.spell.id));
  return scored.map(x => x.spell);
};

export const buildSpellStats = (
  tabs: Tab[],
  warehouseWands: WarehouseWand[],
  spellDb: Record<string, SpellInfo>,
  settings: AppSettings,
  expandedGroups: Set<number>
): SpellStats => {
  return buildSpellStatsFromScores(
    buildSpellScoreDetails(tabs, warehouseWands, spellDb, settings),
    settings,
    expandedGroups
  );
};

export const useSpellSearch = (
  tabs: Tab[],
  warehouseWands: WarehouseWand[],
  spellDb: Record<string, SpellInfo>,
  settings: AppSettings
) => {
  const { i18n } = useTranslation();
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerExpandedGroups, setPickerExpandedGroups] = useState<Set<number>>(new Set());

  // --- Frequency Analysis (Common Spells) ---
  const spellStats = useMemo(() => {
    return buildSpellStats(tabs, warehouseWands, spellDb, settings, pickerExpandedGroups);
  }, [tabs, warehouseWands, spellDb, settings, pickerExpandedGroups]);

  const searchResults = useMemo(() => {
    if (!pickerSearch) return null;
    return [searchSpells(spellDb, pickerSearch, i18n.language)];
  }, [pickerSearch, spellDb, i18n.language]);

  return {
    pickerSearch,
    setPickerSearch,
    pickerExpandedGroups,
    setPickerExpandedGroups,
    spellStats,
    searchResults,
  };
};
