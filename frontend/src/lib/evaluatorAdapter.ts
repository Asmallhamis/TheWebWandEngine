import { WandData, EvalResponse } from '../types';

let worker: Worker | null = null;
let lastRequestId = 0;

/**
 * 获取图标路径
 */
export function getIconUrl(iconPath: string, isConnected: boolean): string {
  const isStaticMode = (import.meta as any).env?.VITE_STATIC_MODE === 'true';
  
  // 如果是静态模式（GitHub Pages），始终使用相对路径
  if (isStaticMode) {
    return `./static_data/icons/${iconPath}`;
  }
  // 否则（EXE/Dev模式），走后端 API
  return `/api/icon/${iconPath}`;
}

/**
 * 魔杖评估适配器
 * 自动在 后端API 和 本地WASM引擎 之间切换
 */
export async function evaluateWand(
  wand: WandData, 
  settings: any, 
  isConnected: boolean,
  tabId: string = 'default',
  slotId: string = '1',
  force: boolean = false
): Promise<{ data: EvalResponse, id: number } | null> {
  
  const isStaticMode = (import.meta as any).env?.VITE_STATIC_MODE === 'true';
  const requestId = ++lastRequestId;

  // --- 路径 A: 桌面/EXE/Dev 模式 ---
  if (!isStaticMode) {
    console.log(`[Evaluator] Using Backend API (${requestId})`);
    try {
      const spells: string[] = [];
      for (let i = 1; i <= wand.deck_capacity; i++) {
        spells.push(wand.spells[i.toString()] || "");
      }

      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab_id: tabId,
          slot_id: slotId,
          mana_max: wand.mana_max,
          mana_charge_speed: wand.mana_charge_speed,
          reload_time: wand.reload_time,
          fire_rate_wait: wand.fire_rate_wait,
          deck_capacity: wand.deck_capacity,
          shuffle_deck_when_empty: wand.shuffle_deck_when_empty,
          spread_degrees: wand.spread_degrees,
          speed_multiplier: wand.speed_multiplier,
          actions_per_round: wand.actions_per_round,
          spells: spells,
          spell_uses: wand.spell_uses || {},
          always_cast: wand.always_cast || [],
          number_of_casts: settings.numCasts || 3,
          unlimited_spells: settings.unlimitedSpells,
          initial_if_half: settings.initialIfHalf,
          simulate_low_hp: settings.simulateLowHp,
          simulate_many_enemies: settings.simulateManyEnemies,
          simulate_many_projectiles: settings.simulateManyProjectiles,
          fold_nodes: settings.foldNodes,
          evaluation_seed: settings.evaluationSeed,
          stop_at_recharge: settings.stopAtRecharge
        })
      });
      
      if (!res.ok) {
        const errText = await res.text();
        console.error(`Backend Error: ${errText}`);
        return null;
      }

      const data = await res.json();
      if (data.success) return { data: data.data, id: requestId };
      return null;
    } catch (e) {
      console.error("API Fetch failed:", e);
      return null;
    }
  }

  // --- 路径 B: GitHub Pages 模式 (纯 WASM) ---
  console.log(`[Evaluator] Using WASM Engine (${requestId})`);
  // 只有在 Static 模式下才初始化 Worker
  return new Promise((resolve, reject) => {
    try {
      if (!worker) {
        worker = new Worker(new URL('./evaluator.worker.ts', import.meta.url), {
          type: 'module'
        });
      }

      const handler = (e: MessageEvent) => {
        if (e.data.id !== requestId) return;
        if (e.data.type === 'RESULT') {
          worker?.removeEventListener('message', handler);
          resolve({ data: e.data.data, id: requestId });
        } else if (e.data.type === 'ERROR') {
          worker?.removeEventListener('message', handler);
          reject(e.data.error);
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'EVALUATE', data: wand, options: settings, id: requestId });
    } catch (err) {
      reject(err);
    }
  });
}
