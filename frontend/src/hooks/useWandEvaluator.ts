import { useState, useEffect, useRef, useCallback } from 'react';
import { WandData, Tab, AppSettings, EvalResponse } from '../types';
import { evaluateWand } from '../lib/evaluatorAdapter';

export const useWandEvaluator = (
  activeTab: Tab,
  settings: AppSettings,
  isConnected: boolean,
  updateWand?: (slot: string, updates: Partial<WandData>) => void
) => {
  const [evalResults, setEvalResults] = useState<Record<string, { data: EvalResponse, id: number, loading?: boolean }>>({});
  const evalTimersRef = useRef<Record<string, any>>({});
  const latestRequestIdsRef = useRef<Record<string, number>>({});
  const lastEvaluatedWandsRef = useRef<Record<string, string>>({});

  const requestEvaluation = useCallback(async (tabId: string, slot: string, wand: WandData, force: boolean = false) => {
    const key = `${tabId}-${slot}`;
    try {
      setEvalResults(prev => ({
        ...prev,
        [key]: { ...(prev[key] || { data: null, id: 0 }), loading: true }
      }));

      const res = await evaluateWand(wand, settings, isConnected, tabId, slot, force);
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

  return { evalResults, requestEvaluation };
};
