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
    const query = pickerSearch.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!query) return null;

    const allSpells = Object.values(spellDb);
    const isEnglish = i18n.language.startsWith('en');

    // Score-based search
    const scored = allSpells.map(s => {
      let score = 0;
      const id = s.id.toLowerCase();
      const name = s.name.toLowerCase();
      const en = (s.en_name || "").toLowerCase();
      const py = (s.pinyin || "").toLowerCase();
      const init = (s.pinyin_initials || "").toLowerCase();
      const aliases = (s.aliases || "").toLowerCase();
      const apy = (s.alias_pinyin || "").toLowerCase();
      const ainit = (s.alias_initials || "").toLowerCase();

      // Exact matches
      if (id === query) score += 100;
      else if (name === query) score += 90;
      else if (en === query) score += 85;
      else if (aliases.includes(query)) score += 80;

      // Starts with
      else if (id.startsWith(query)) score += 70;
      else if (name.startsWith(query)) score += 65;
      else if (en.startsWith(query)) score += 60;
      else if (!isEnglish && init.startsWith(query)) score += 55;
      else if (!isEnglish && py.startsWith(query)) score += 50;
      else if (!isEnglish && checkPinyinFuzzy(query, py, init)) score += 48;
      else if (!isEnglish && ainit.startsWith(query)) score += 45;
      else if (!isEnglish && apy.startsWith(query)) score += 40;
      else if (!isEnglish && checkPinyinFuzzy(query, apy, ainit)) score += 38;

      // Includes
      else if (id.includes(query)) score += 30;
      else if (name.includes(query)) score += 25;
      else if (en.includes(query)) score += 20;
      else if (!isEnglish && init.includes(query)) score += 15;
      else if (!isEnglish && py.includes(query)) score += 10;
      else if (!isEnglish && ainit.includes(query)) score += 8;
      else if (!isEnglish && apy.includes(query)) score += 5;

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
