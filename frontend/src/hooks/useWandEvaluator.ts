import { useState, useEffect, useRef, useCallback } from 'react';
import { WandData, Tab, AppSettings, EvalResponse, EvaluationRequestOptions } from '../types';
import { evaluateWand } from '../lib/evaluatorAdapter';

export const useWandEvaluator = (
  activeTab: Tab,
  settings: AppSettings,
  isConnected: boolean,
  updateWand?: (slot: string, updates: Partial<WandData>) => void,
  /**
   * 当前仍存在的 tab id 列表。传入后，已关闭 tab 的评估结果会被回收。
   * 省略则保持旧行为（结果常驻），以兼容其它调用点。
   */
  liveTabIds?: string[]
) => {
  const [evalResults, setEvalResults] = useState<Record<string, { data: EvalResponse, id: number, loading?: boolean }>>({});
  const evalTimersRef = useRef<Record<string, any>>({});
  const latestRequestIdsRef = useRef<Record<string, number>>({});
  const lastEvaluatedWandsRef = useRef<Record<string, string>>({});

  const requestEvaluation = useCallback(async (
    tabId: string,
    slot: string,
    wand: WandData,
    force: boolean = false,
    overrides: EvaluationRequestOptions = {},
  ) => {
    const key = `${tabId}-${slot}`;
    try {
      setEvalResults(prev => ({
        ...prev,
        [key]: { ...(prev[key] || { data: null, id: 0 }), loading: true }
      }));

      const timelineEnabled = overrides.timelineEnabled ?? (settings.autoCalculateTimeline ?? true);
      const res = await evaluateWand(
        wand,
        { ...settings, timelineEnabled },
        isConnected,
        tabId,
        slot,
        force,
      );
      if (res) {
        if (res.id >= (latestRequestIdsRef.current[key] || 0)) {
          latestRequestIdsRef.current[key] = res.id;
          setEvalResults(prev => ({
            ...prev,
            [key]: { data: res.data, id: res.id, loading: false }
          }));

          if (res.data.seed !== undefined && !wand.evaluation_seed && updateWand) {
            const nextSeed = String(res.data.seed);
            const newWand = { ...wand, evaluation_seed: nextSeed };
            const { canvas_positions, appearance, marked_slots, canvas_cells_per_row, ...newLogicWand } = newWand;
            const nextStateString = JSON.stringify({
              wand: newLogicWand,
              numCasts: settings.numCasts,
              unlimited: settings.unlimitedSpells,
              ifHalf: settings.initialIfHalf,
              lowHp: settings.simulateLowHp,
              manyEnemies: settings.simulateManyEnemies,
              manyProjectiles: settings.simulateManyProjectiles,
              seed: nextSeed,
              fold: settings.foldNodes,
              timelineEnabled: settings.autoCalculateTimeline ?? true,
              stopAtRecharge: settings.stopAtRecharge,
              perks: settings.perks
            });
            lastEvaluatedWandsRef.current[key] = nextStateString;
            requestAnimationFrame(() => updateWand(slot, { evaluation_seed: nextSeed }));
          }
        }
      }
    } catch (e) {
      console.error("Evaluation failed:", e);
      setEvalResults(prev => ({
        ...prev,
        [key]: { ...(prev[key] || { data: null, id: 0 }), loading: false }
      }));
    }
  }, [
    settings.numCasts,
    settings.unlimitedSpells,
    settings.initialIfHalf,
    settings.simulateLowHp,
    settings.simulateManyEnemies,
    settings.simulateManyProjectiles,
    settings.evaluationSeed,
    settings.foldNodes,
    settings.autoCalculateTimeline,
    settings.stopAtRecharge,
    settings.perks,
    isConnected,
    updateWand
  ]);

  useEffect(() => {
    if (!activeTab || !activeTab.expandedWands) return;

    activeTab.expandedWands.forEach(slot => {
      const wand = activeTab.wands[slot];
      if (!wand) return;

      const key = `${activeTab.id}-${slot}`;
      // Exclude non-logic fields that don't affect evaluation results
      const { canvas_positions, appearance, marked_slots, canvas_cells_per_row, ...logicWand } = wand;

      const wandStateString = JSON.stringify({
        wand: logicWand,
        numCasts: settings.numCasts,
        unlimited: settings.unlimitedSpells,
        ifHalf: settings.initialIfHalf,
        lowHp: settings.simulateLowHp,
        manyEnemies: settings.simulateManyEnemies,
        manyProjectiles: settings.simulateManyProjectiles,
        seed: logicWand.evaluation_seed !== undefined ? logicWand.evaluation_seed : settings.evaluationSeed,
        fold: settings.foldNodes,
        timelineEnabled: settings.autoCalculateTimeline ?? true,
        stopAtRecharge: settings.stopAtRecharge,
        perks: settings.perks
      });

      if (lastEvaluatedWandsRef.current[key] === wandStateString) return;

      if (evalTimersRef.current[key]) clearTimeout(evalTimersRef.current[key]);

      evalTimersRef.current[key] = setTimeout(() => {
        lastEvaluatedWandsRef.current[key] = wandStateString;
        requestEvaluation(activeTab.id, slot, wand);
      }, 500);
    });
  }, [activeTab.wands, activeTab.expandedWands, activeTab.id, requestEvaluation, settings]);

  // 回收已关闭 tab 的评估结果。
  // 法术树（EvalNode 递归结构 + states + timeline）可达数 MB/条，
  // 原先关闭 tab 只移除 tabs 数组，缓存条目永久留驻造成单调增长。
  useEffect(() => {
    if (!liveTabIds) return;
    const live = new Set(liveTabIds);
    const isStale = (key: string) => {
      // key 形如 `${tabId}-${slot}`，slot 不含 '-'，故从末尾切分最稳妥
      const sep = key.lastIndexOf('-');
      return sep > 0 && !live.has(key.slice(0, sep));
    };

    setEvalResults(prev => {
      const staleKeys = Object.keys(prev).filter(isStale);
      if (staleKeys.length === 0) return prev;
      const next = { ...prev };
      staleKeys.forEach(k => delete next[k]);
      return next;
    });

    // 同步清理辅助 ref，避免它们成为第二处泄漏
    Object.keys(evalTimersRef.current).filter(isStale).forEach(k => {
      clearTimeout(evalTimersRef.current[k]);
      delete evalTimersRef.current[k];
    });
    Object.keys(latestRequestIdsRef.current).filter(isStale)
      .forEach(k => delete latestRequestIdsRef.current[k]);
    Object.keys(lastEvaluatedWandsRef.current).filter(isStale)
      .forEach(k => delete lastEvaluatedWandsRef.current[k]);
  }, [liveTabIds]);

  return { evalResults, requestEvaluation };
};
