import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SpellInfo } from '../types';
import { getIconUrl } from '../lib/evaluatorAdapter';
import { getActiveModBundle } from '../lib/modStorage';

// 模块级缓存：所有 bundle 法术（无论是否启用），供组件直接查询
let _allKnownSpellsRef: Record<string, SpellInfo> = {};

/** 查询未知法术的信息（主要用于获取 mod_id），不经过 props 传递 */
export function getUnknownSpellInfo(sid: string): SpellInfo | null {
  return _allKnownSpellsRef[sid] || null;
}

export const useSpellDb = (isConnected: boolean) => {
  const { t, i18n } = useTranslation();
  const [spellDb, setSpellDb] = useState<Record<string, SpellInfo>>({});
  // 包含 ModBundle 中所有法术（无论是否启用），用于未知法术回退查询
  const [allKnownSpells, setAllKnownSpells] = useState<Record<string, SpellInfo>>({});
  const preloadedRef = (import.meta as any).env?.PROD ? { current: false } : { current: false };

  const fetchSpellDb = useCallback(async () => {
    let modSpells: Record<string, SpellInfo> = {};
    let allBundleSpells: Record<string, SpellInfo> = {};
    let bundleExists = false;

    try {
      const activeBundle = await getActiveModBundle();
      bundleExists = !!activeBundle;
      const hasActiveMods = !!(activeBundle && Array.isArray(activeBundle.active_mods) && activeBundle.active_mods.length > 0);
      if (activeBundle && activeBundle.spells) {
        const activeSet = new Set(activeBundle.active_mods || []);
        Object.entries(activeBundle.spells).forEach(([id, info]) => {
          // 记录所有 bundle 法术（用于未知法术回退）
          allBundleSpells[id] = { ...info, id };
          const modId = (info as SpellInfo).mod_id;
          if (hasActiveMods && modId && !activeSet.has(modId)) return;
          modSpells[id] = { ...info, id, is_mod: true, icon: info.icon_base64 || info.icon };
        });
      }
    } catch (e) {
      console.error("Failed to load mod bundle from IndexedDB:", e);
    }

    setAllKnownSpells(allBundleSpells);
    _allKnownSpellsRef = allBundleSpells;

    const loadBaseFromStatic = async () => {
      const res = await fetch('./static_data/spells.json');
      return res.json();
    };

    if (bundleExists) {
      try {
        if (isConnected) {
          const res = await fetch('/api/fetch-spells-base');
          const data = await res.json();
          if (data.success && data.spells) {
            const enriched: Record<string, SpellInfo> = {};
            Object.entries(data.spells as Record<string, any>).forEach(([id, info]) => {
              enriched[id] = { ...info, id };
            });
            setSpellDb({ ...enriched, ...modSpells });
            return true;
          }
        }
      } catch (e) {
        console.log("API fetch-spells-base failed, trying static...");
      }

      try {
        const data = await loadBaseFromStatic();
        setSpellDb({ ...data, ...modSpells });
        return true;
      } catch (e) {
        console.error("Failed to fetch base spells for bundle:", e);
        return false;
      }
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
      const data = await loadBaseFromStatic();
      setSpellDb({ ...data, ...modSpells });
      return true;
    } catch (e) {
      console.error("Failed to fetch spells from anywhere:", e);
      return false;
    }
  }, [isConnected]);

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

  return { spellDb, allKnownSpells, spellNameToId, fetchSpellDb, syncGameSpells };
};
