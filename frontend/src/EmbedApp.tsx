import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SpellInfo, WandData, EvalResponse, AppSettings } from './types';
import { DEFAULT_WAND } from './constants';
import { DEFAULT_SPELL_TYPES, DEFAULT_SPELL_GROUPS } from './constants';
import { evaluateWand } from './lib/evaluatorAdapter';
import WandEvaluator from './components/WandEvaluator';
import { wikiNameToSpritePath } from './lib/evaluatorAdapter';
import './index.css';

/**
 * Embed 模式入口 —— 轻量版，只做评估+显示结果
 * 通过 URL 参数 ?embed=true&wand=<base64> 触发
 */

const DEFAULT_EMBED_SETTINGS: AppSettings = {
  commonLimit: 20,
  categoryLimit: 20,
  allowCompactEdit: false,
  pickerRowHeight: 32,
  themeColors: [],
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
  showIndices: false,
  editorSpellGap: 6,
  showStatsInFrames: true,
  showLegacyWandButton: false,
  deleteEmptySlots: true,
  ctrlClickDelete: false,
  exportHistory: true,
  embedMetadataInImage: true,
  pureSpellsExport: false,
  showDragModeToggle: false,
  editorDragMode: 'cursor',
  dragSpellMode: '20260222',
  spellTypes: DEFAULT_SPELL_TYPES,
  spellGroups: DEFAULT_SPELL_GROUPS,
  warehouseFolderHeight: 200,
  wikiLanguage: 'en',
  stopAtRecharge: true,
  perks: {},
  recursionIterationDisplay: 'labeled',
  mobilePickerMode: false,
  disablePickerAutoFocus: false,
  uiScale: 100,
  wandAttributesScale: 100,
  hideSyncButton: true,
  compactAttributes: false,
  triggerVisualizationMode: 'standard',
  userMarkingRules: [],
  showSpellId: false,
  defaultCanvasCellsPerRow: 26,
  maxCanvasCellsPerRow: 100,
  enableCanvasEditorLock: false,
  pickerFirstSpaceBehavior: 'ignore',
  moveExistingWandToTopOnDuplicatePaste: false,
  coolUIMode: false,
  coolUITheme: 'gentleisland',
  coolUIBackground: 'aurora'
};

function parseWandFromText(text: string, spellNameToId: Record<string, string>): WandData | null {
  const normalize = (s: string) => s.toLowerCase()
    .replace(/\[\[|\]\]/g, '')
    .split('|')[0]
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
    .trim();

  // 兼容外部模拟器 URL
  if (text.includes('?spells=') || text.includes('&spells=')) {
    try {
      const url = new URL(text.startsWith('http') ? text : `http://x.com/${text}`);
      const spellsStr = url.searchParams.get('spells');
      if (spellsStr) {
        const ids = spellsStr.split(',').filter(s => !!s);
        return {
          ...DEFAULT_WAND,
          mana_max: parseFloat(url.searchParams.get('mana_max') || '400'),
          mana_charge_speed: parseFloat(url.searchParams.get('mana_charge_speed') || '10'),
          reload_time: parseInt(url.searchParams.get('reload_time') || '0'),
          fire_rate_wait: parseInt(url.searchParams.get('cast_delay') || '0'),
          deck_capacity: parseInt(url.searchParams.get('deck_capacity') || String(ids.length)),
          actions_per_round: parseInt(url.searchParams.get('actions_per_round') || '1'),
          shuffle_deck_when_empty: url.searchParams.get('shuffle_deck_when_empty') === 'true',
          spells: ids.reduce((acc, id, i) => ({ ...acc, [(i + 1).toString()]: id }), {}),
        };
      }
    } catch (e) { /* ignore */ }
  }

  const isWand2Data = text.includes('{{Wand2');
  const isWikiWand = text.includes('{{Wand') && !isWand2Data;
  if (!isWand2Data && !isWikiWand) return null;

  const getVal = (key: string) => {
    const regex = new RegExp(`\\|\\s*${key}\\s*=\\s*([^|\\n}]+)`);
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  };

  const newSpells: Record<string, string> = {};
  const alwaysCasts: string[] = [];
  let deckCapacity = 0;

  if (isWand2Data) {
    const spellsStr = getVal('spells');
    const spellsList = spellsStr ? spellsStr.split(',').map(s => s.trim()) : [];
    spellsList.forEach((sid, i) => {
      if (sid) {
        const norm = normalize(sid);
        newSpells[(i + 1).toString()] = spellNameToId[norm] || sid.toUpperCase();
      }
    });
    deckCapacity = parseInt(getVal('capacity') || '0') || spellsList.length || DEFAULT_WAND.deck_capacity;

    const acStr = getVal('alwaysCasts') || getVal('always_cast');
    if (acStr) {
      acStr.split(',').forEach(s => {
        const sid = s.trim();
        if (sid) {
          const norm = normalize(sid);
          alwaysCasts.push(spellNameToId[norm] || sid.toUpperCase());
        }
      });
    }
  } else {
    deckCapacity = parseInt(getVal('capacity') || '0') || DEFAULT_WAND.deck_capacity;
    for (let i = 1; i <= Math.max(deckCapacity, 100); i++) {
      const name = getVal(`spell${i}`);
      if (name) {
        const norm = normalize(name);
        const id = spellNameToId[norm];
        if (id) newSpells[i.toString()] = id;
      }
    }
    const acName = getVal('alwaysCasts') || getVal('always_cast');
    if (acName) {
      acName.split(',').forEach(s => {
        const norm = normalize(s.trim());
        const id = spellNameToId[norm];
        if (id) alwaysCasts.push(id);
      });
    }
  }

  return {
    ...DEFAULT_WAND,
    shuffle_deck_when_empty: getVal('shuffle')?.toLowerCase() === 'yes' || getVal('shuffle') === 'true' || getVal('shuffle') === '是',
    actions_per_round: parseInt(getVal('spellsCast') || (isWand2Data ? '1' : '')) || parseInt(getVal('spellsPerCast') || '1') || DEFAULT_WAND.actions_per_round,
    mana_max: parseFloat(getVal('manaMax') || '0') || DEFAULT_WAND.mana_max,
    mana_charge_speed: parseFloat(getVal('manaCharge') || '0') || DEFAULT_WAND.mana_charge_speed,
    reload_time: Math.round(parseFloat(getVal('rechargeTime') || '0') * 60) || DEFAULT_WAND.reload_time,
    fire_rate_wait: Math.round(parseFloat(getVal('castDelay') || '0') * 60) || DEFAULT_WAND.fire_rate_wait,
    deck_capacity: deckCapacity,
    spread_degrees: parseFloat(getVal('spread') || '0') || DEFAULT_WAND.spread_degrees,
    speed_multiplier: parseFloat(getVal('speed') || '1') || DEFAULT_WAND.speed_multiplier,
    spells: newSpells,
    always_cast: alwaysCasts,
    appearance: (() => {
      const pic = getVal('wandPic') || getVal('wand_file');
      if (!pic) return undefined;
      const resolved = wikiNameToSpritePath(pic);
      return resolved || { sprite: pic };
    })()
  };
}

const EmbedApp: React.FC = () => {
  const [spellDb, setSpellDb] = useState<Record<string, SpellInfo>>({});
  const [evalData, setEvalData] = useState<EvalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const evaluatedRef = useRef(false);

  const spellNameToId = useMemo(() => {
    const map: Record<string, string> = {};
    const normalize = (s: string) => s.toLowerCase()
      .replace(/\[\[|\]\]/g, '')
      .split('|')[0]
      .replace(/[^a-z0-9\u4e00-\u9fa5]|_/g, '')
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
      info.aliases?.split(/\s+/).forEach(alias => {
        const aNorm = normalize(alias);
        if (aNorm) map[aNorm] = id;
      });
    });
    return map;
  }, [spellDb]);

  // 通知父页面高度变化
  const sendHeight = useCallback(() => {
    const h = document.documentElement.scrollHeight;
    window.parent.postMessage({ type: 'TWWE_EMBED_RESIZE', height: h }, '*');
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(() => sendHeight());
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [sendHeight]);

  // 加载 spellDb
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('./static_data/spells.json');
        const data = await res.json();
        setSpellDb(data);
      } catch (e) {
        console.error('[Embed] Failed to load spells.json', e);
        setError('Failed to load spell database');
      }
    })();
  }, []);

  // spellDb 加载完成后解析法杖并评估
  useEffect(() => {
    if (Object.keys(spellDb).length === 0 || evaluatedRef.current) return;
    evaluatedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    let wandRaw = params.get('wand') || params.get('data');
    if (!wandRaw) {
      setError('No wand data provided');
      setLoading(false);
      return;
    }

    // base64 decode
    if (!wandRaw.startsWith('{{') && !wandRaw.includes(',') && !wandRaw.includes('?')) {
      try { wandRaw = decodeURIComponent(escape(atob(wandRaw))); } catch (e) {
        try { wandRaw = atob(wandRaw); } catch (e2) { /* use raw */ }
      }
    }

    const wand = parseWandFromText(wandRaw, spellNameToId);
    if (!wand) {
      setError('Could not parse wand data');
      setLoading(false);
      return;
    }

    // 执行评估
    (async () => {
      try {
        const result = await evaluateWand(wand, DEFAULT_EMBED_SETTINGS, false, 'embed', '1', true);
        if (result) {
          setEvalData(result.data);
        } else {
          setError('Evaluation returned no result');
        }
      } catch (e: any) {
        console.error('[Embed] Evaluation failed:', e);
        setError(`Evaluation error: ${e.message}`);
      } finally {
        setLoading(false);
        // 评估完成后再发送一次高度
        setTimeout(() => sendHeight(), 100);
      }
    })();
  }, [spellDb, spellNameToId, sendHeight]);

  if (error) {
    return (
      <div className="embed-root" style={{ padding: '12px', color: '#ef4444', fontFamily: 'monospace', fontSize: '12px', background: 'transparent' }}>
        ⚠ {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="embed-root" style={{
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: '#a1a1aa',
        fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        fontSize: '12px',
        background: 'transparent'
      }}>
        <div style={{
          width: '14px', height: '14px',
          border: '2px solid #3f3f46',
          borderTopColor: '#a78bfa',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        Evaluating wand...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!evalData) return null;

  return (
    <div className="embed-root" style={{ background: 'transparent', minHeight: '50px' }}>
      <WandEvaluator
        data={{
          tree: evalData.tree,
          states: evalData.states,
          counts: evalData.counts,
          cast_counts: evalData.cast_counts
        }}
        spellDb={spellDb}
        settings={DEFAULT_EMBED_SETTINGS}
        renderMode="all"
        isCanvas={false}
      />
    </div>
  );
};

export default EmbedApp;
