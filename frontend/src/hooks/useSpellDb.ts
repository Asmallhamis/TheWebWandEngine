import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SpellInfo } from '../types';
import { getIconUrl } from '../lib/evaluatorAdapter';
import { getActiveModBundle } from '../lib/modStorage';

export const useSpellDb = (isConnected: boolean) => {
  const { t, i18n } = useTranslation();
  const [spellDb, setSpellDb] = useState<Record<string, SpellInfo>>({});
  const preloadedRef = (import.meta as any).env?.PROD ? { current: false } : { current: false };

  const fetchSpellDb = useCallback(async () => {
    // Load user imported mod bundles first (highest priority for mod spells)
    let modSpells: Record<string, SpellInfo> = {};
    try {
      const activeBundle = await getActiveModBundle();
      if (activeBundle && activeBundle.spells) {
        Object.entries(activeBundle.spells).forEach(([id, info]) => {
          // 如果有 base64 图标，直接将其设为 icon 路径，这样 getIconUrl 就能自动识别并返回它
          modSpells[id] = { ...info, id, is_mod: true, icon: info.icon_base64 || info.icon };
        });
      }
    } catch (e) {
      console.error("Failed to load mod bundle from IndexedDB:", e);
    }

    try {
      const res = await fetch('/api/fetch-spells');
      const data = await res.json();
      if (data.success && data.spells) {
        const enriched: Record<string, SpellInfo> = {};
        Object.entries(data.spells as Record<string, any>).forEach(([id, info]) => {
          enriched[id] = { ...info, id };
        });
        setSpellDb({ ...enriched, ...modSpells });
        return true;
      }
    } catch (e) {
      console.log("API fetch-spells failed, trying static...");
    }

    try {
      const res = await fetch('./static_data/spells.json');
      const data = await res.json();
      setSpellDb({ ...data, ...modSpells });
      return true;
    } catch (e) {
      console.error("Failed to fetch spells from anywhere:", e);
      return false;
    }
  }, []);

  const spellNameToId = useMemo(() => {
    const map: Record<string, string> = {};
    const normalize = (s: string) => s.toLowerCase()
      .replace(/\[\[|\]\]/g, '')
      .split('|')[0]
      .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
      .trim();

    Object.entries(spellDb).forEach(([id, info]) => {
      const idNorm = normalize(id);
      if (idNorm) map[idNorm] = id;

      if (id.includes('_')) {
        const idClean = id.toLowerCase().replace(/_/g, '');
        if (idClean) map[idClean] = id;
      }

      if (info.name) {
        const nameNorm = normalize(info.name);
        if (nameNorm) map[nameNorm] = id;
      }

      if (info.en_name) {
        const enNorm = normalize(info.en_name);
        if (enNorm) map[enNorm] = id;
      }

      info.aliases?.split(',').forEach(alias => {
        const aNorm = normalize(alias);
        if (aNorm) map[aNorm] = id;
      });
    });

    return map;
  }, [spellDb]);

  const syncGameSpells = useCallback(async (setNotification: (n: any) => void) => {
    if (!isConnected) return;
    setNotification({ msg: t('app.notification.syncing_mod_spells'), type: 'info' });
    try {
      const res = await fetch('/api/sync-game-spells');
      const data = await res.json();
      if (data.success) {
        await fetchSpellDb();
        setNotification({ msg: t('app.notification.sync_mod_spells_success', { count: data.count }), type: 'success' });
      } else {
        setNotification({ msg: t('app.notification.sync_failed_with_error', { error: data.error }), type: 'info' });
      }
    } catch (e) {
      setNotification({ msg: t('app.notification.sync_failed'), type: 'info' });
    }
  }, [isConnected, t, fetchSpellDb]);

  // Preload Images
  useEffect(() => {
    const spells = Object.values(spellDb);
    if (spells.length === 0) return;

    const timer = setTimeout(() => {
      spells.forEach(s => {
        const img = new Image();
        img.src = (s as any).icon_base64 || getIconUrl(s.icon, isConnected);
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [spellDb, isConnected]);

  useEffect(() => {
    fetchSpellDb();
  }, [fetchSpellDb]);

  return { spellDb, spellNameToId, fetchSpellDb, syncGameSpells };
};
