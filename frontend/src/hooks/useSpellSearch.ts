import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SpellInfo, Tab, AppSettings } from '../types';
import { checkPinyinFuzzy } from '../lib/searchUtils';

export const useSpellSearch = (
  tabs: Tab[],
  spellDb: Record<string, SpellInfo>,
  settings: AppSettings
) => {
  const { i18n } = useTranslation();
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerExpandedGroups, setPickerExpandedGroups] = useState<Set<number>>(new Set());

  // --- Frequency Analysis (Common Spells) ---
  const spellStats = useMemo(() => {
    const counts: Record<string, number> = {};
    tabs.forEach(tab => {
      if (!tab.wands) return;
      Object.values(tab.wands).forEach(wand => {
        if (!wand || !wand.spells) return;
        Object.values(wand.spells).forEach(sid => {
          counts[sid] = (counts[sid] || 0) + 1;
        });
      });
    });

    const getTopN = (list: SpellInfo[], n: number, forceAll = false) => {
      const sorted = [...list].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
      return forceAll ? sorted : sorted.slice(0, n);
    };

    const allSpells = Object.values(spellDb);
    const overall = getTopN(allSpells, settings.commonLimit, pickerExpandedGroups.has(-1));

    const categories = settings.spellGroups.map((group, idx) => {
      const filtered = allSpells.filter(s => group.types.includes(s.type));
      return getTopN(filtered, settings.categoryLimit, pickerExpandedGroups.has(idx));
    });

    return { overall, categories };
  }, [tabs, spellDb, settings.commonLimit, settings.categoryLimit, settings.spellGroups, pickerExpandedGroups]);

  const searchResults = useMemo(() => {
    if (!pickerSearch) return null;
    const query = pickerSearch.toLowerCase().trim();
    if (!query) return null;
    const hasWordChars = /[a-z0-9\u4e00-\u9fa5]/.test(query);
    const isNumericQuery = /^[0-9]+$/.test(query);

    const allSpells = Object.values(spellDb);
    const isEnglish = i18n.language.startsWith('en');

    // Score-based search
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

      // Exact matches
      if (id === query) score += 100;
      else if (name === query) score += 90;
      else if (en === query) score += 85;
      else if (hasAliasExact) score += 80;

      // Starts with
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

      // Includes
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

      // Special Boost for DIVIDE spells based on query
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

    // Sort by score descending, then by original order/id
    scored.sort((a, b) => b.score - a.score || a.spell.id.localeCompare(b.spell.id));

    return [scored.map(x => x.spell)];
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
