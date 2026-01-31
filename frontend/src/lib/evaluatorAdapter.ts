import { WandData, EvalResponse } from '../types';

let worker: Worker | null = null;

/**
 * 获取图标路径
 */
export function getIconUrl(iconPath: string, isConnected: boolean): string {
  const isStaticMode = (import.meta as any).env?.VITE_STATIC_MODE === 'true';
  // 如果是离线静态模式，或者后端没连接（且没开启 API），使用本地静态资源
  if (isStaticMode) {
    return `./static_data/icons/${iconPath}`;
  }
  // 否则尝试调用后端 API
  return `/api/icon/${iconPath}`;
}

/**
 * 魔杖评估适配器
 * 自动在 后端API 和 本地WASM引擎 之间切换
 */
export async function evaluateWand(
  wand: WandData, 
  settings: any, 
  isConnected: boolean
): Promise<EvalResponse | null> {
  
  // 模式 A: 只有在非静态模式时尝试使用 API
  // 不再依赖 isConnected (那是游戏连接状态)，只要后端 alive 就能用 API 评估
  const isStaticMode = (import.meta as any).env?.VITE_STATIC_MODE === 'true';
  
  if (!isStaticMode) {
    try {
      const spells: string[] = [];
      for (let i = 1; i <= wand.deck_capacity; i++) {
        spells.push(wand.spells[i.toString()] || "");
      }

      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // 显式列出所有字段，确保 spells 始终是数组且不会被 ...wand 覆盖
          mana_max: wand.mana_max,
          mana_charge_speed: wand.mana_charge_speed,
          reload_time: wand.reload_time,
          fire_rate_wait: wand.fire_rate_wait,
          deck_capacity: wand.deck_capacity,
          shuffle_deck_when_empty: wand.shuffle_deck_when_empty,
          spread_degrees: wand.spread_degrees,
          speed_multiplier: wand.speed_multiplier,
          actions_per_round: wand.actions_per_round,
          spells: spells, // 这里是 array
          spell_uses: wand.spell_uses || {},
          always_cast: wand.always_cast || [],
          number_of_casts: settings.numCasts || 3,
          unlimited_spells: settings.unlimitedSpells,
          initial_if_half: settings.initialIfHalf,
          simulate_low_hp: settings.simulateLowHp,
          simulate_many_enemies: settings.simulateManyEnemies,
          simulate_many_projectiles: settings.simulateManyProjectiles,
          fold_nodes: settings.foldNodes
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) return data.data;
      }
      console.warn("API Evaluation returned error, falling back to local...");
    } catch (e) {
      console.error("API Evaluation failed, falling back to local...", e);
    }
  }

  // 模式 B: 使用 Web Worker + Lua WASM (GitHub Pages 或 后端未开启)
  return new Promise((resolve, reject) => {
    if (!worker) {
      worker = new Worker(new URL('./evaluator.worker.ts', import.meta.url), {
        type: 'module'
      });
    }

    const handler = (e: MessageEvent) => {
      if (e.data.type === 'RESULT') {
        worker?.removeEventListener('message', handler);
        resolve(e.data.data);
      } else if (e.data.type === 'ERROR') {
        worker?.removeEventListener('message', handler);
        console.error("Worker Error:", e.data.error);
        // 如果是静态模式且报错，可能需要提示用户
        if (isStaticMode) {
          alert("本地评估引擎报错: " + e.data.error);
        }
        reject(e.data.error);
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({ type: 'EVALUATE', data: wand, options: settings });
  });
}
