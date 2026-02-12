import { WandData, EvalResponse } from '../types';

import { getActiveModBundle } from './modStorage';
let worker: Worker | null = null;
let lastRequestId = 0;

/**
 * 获取图标路径
 */
export function getIconUrl(iconPath: string, isConnected: boolean): string {
  // 如果 iconPath 本身就是 base64 数据（以 data: 开头），直接返回
  if (iconPath && iconPath.startsWith('data:')) {
    return iconPath;
  }

  const isStaticMode = (import.meta as any).env?.VITE_STATIC_MODE === 'true';
  
  // 如果是静态模式（GitHub Pages），始终使用相对路径
  if (isStaticMode) {
    return `./static_data/icons/${iconPath}`;
  }
  // 否则（EXE/Dev模式），走后端 API
  return `/api/icon/${iconPath}`;
}

/**
 * 获取法杖外观的最佳显示图标 URL
 * 优先使用 item_sprite (PNG)，其次使用 sprite (可能是 XML，后端会自动解析)
 */
export function getWandSpriteUrl(appearance: { sprite?: string; item_sprite?: string } | undefined, isConnected: boolean): string | null {
  if (!appearance) return null;
  // 优先 PNG 路径
  let best = appearance.item_sprite || appearance.sprite;
  if (!best) return null;
  
  // 静态模式下无法解析 XML sprite，尝试将 .xml 替换为 .png
  const isStaticMode = (import.meta as any).env?.VITE_STATIC_MODE === 'true';
  if (isStaticMode && best.endsWith('.xml')) {
    best = best.replace(/\.xml$/, '.png');
  }
  
  return getIconUrl(best, isConnected);
}

// ============================================================================
// 法杖外观 wiki 名称映射 (兼容 Component Explorer 的 Wand2 模板格式)
// ============================================================================

/** 
 * 特殊法杖映射表 (来自 component-explorer/unique_wand_sprites.lua)
 * key: sprite_file (XML) 或 image_file (PNG) → value: wiki_file 名称
 */
const UNIQUE_WAND_SPRITES: { sprite_file?: string; image_file: string; wiki_file: string }[] = [
  { sprite_file: "data/items_gfx/flute.xml",                                             image_file: "data/items_gfx/flute.png",                                             wiki_file: "Huilu (Wand).png" },
  { sprite_file: "data/items_gfx/kantele.xml",                                           image_file: "data/items_gfx/kantele.png",                                           wiki_file: "Wand kantele.png" },
  { sprite_file: "data/items_gfx/bomb_wand.xml",                                         image_file: "data/items_gfx/bomb_wand.png",                                         wiki_file: "Wand bomb wand.png" },
  { sprite_file: "data/items_gfx/handgun.xml",                                           image_file: "data/items_gfx/handgun.png",                                           wiki_file: "Wand handgun.png" },
  { sprite_file: "data/items_gfx/wands/custom/scepter_01.xml",                           image_file: "data/items_gfx/wands/custom/scepter_01.png",                           wiki_file: "Wand scepter 01.png" },
  { sprite_file: "data/entities/items/wands/experimental/experimental_wand_1_sprite.xml", image_file: "data/entities/items/wands/experimental/experimental_wand_1.png",        wiki_file: "Wand experimental wand 1.png" },
  { sprite_file: "data/entities/items/wands/experimental/experimental_wand_2_sprite.xml", image_file: "data/entities/items/wands/experimental/experimental_wand_2.png",        wiki_file: "Wand experimental wand 2.png" },
  { sprite_file: "data/items_gfx/wands/custom/actual_wand.xml",                          image_file: "data/items_gfx/wands/custom/actual_wand_honest.png",                   wiki_file: "Actual wand honest.png" },
  { sprite_file: "data/items_gfx/wands/custom/good_01.xml",                              image_file: "data/items_gfx/wands/custom/good_01.png",                              wiki_file: "Wand wand good 1.png" },
  { sprite_file: "data/items_gfx/wands/custom/good_02.xml",                              image_file: "data/items_gfx/wands/custom/good_02.png",                              wiki_file: "Wand wand good 2.png" },
  { sprite_file: "data/items_gfx/wands/custom/good_03.xml",                              image_file: "data/items_gfx/wands/custom/good_03.png",                              wiki_file: "Wand wand good 3.png" },
  {                                                                                       image_file: "data/items_gfx/wands/custom/skull_01.png",                             wiki_file: "Wand skull 01.png" },
  {                                                                                       image_file: "data/items_gfx/wands/custom/wood_01.png",                              wiki_file: "Wand wood 01.png" },
  {                                                                                       image_file: "data/items_gfx/wands/custom/plant_01.png",                             wiki_file: "Wand plant 01.png" },
  {                                                                                       image_file: "data/items_gfx/wands/custom/plant_02.png",                             wiki_file: "Wand plant 02.png" },
  {                                                                                       image_file: "data/items_gfx/wands/custom/vasta.png",                                wiki_file: "Wand vasta.png" },
  {                                                                                       image_file: "data/items_gfx/wands/custom/vihta.png",                                wiki_file: "Wand vihta.png" },
];

/**
 * Noita wiki 的页面名称标准化 (复刻 component-explorer/utils/wiki.lua 的 normalise_page_name)
 * 首字母大写 + 下划线转空格 + 合并连续空格
 */
function normalisePageName(name: string): string {
  if (!name) return name;
  name = name.charAt(0).toUpperCase() + name.slice(1);
  name = name.replace(/_/g, ' ');
  name = name.replace(/ {2,}/g, ' ');
  return name;
}

/**
 * 将法杖的 sprite_file/image_file 路径转换为 wiki 友好的文件名
 * 用于导出 {{Wand2}} 模板时的 wandPic 字段
 * 
 * 例如: "data/items_gfx/handgun.xml" → "Wand handgun.png"
 *       "data/items_gfx/wands/wand_0001.png" → "Wand 0001.png"
 */
export function spritePathToWikiName(appearance: { sprite?: string; item_sprite?: string } | undefined): string {
  if (!appearance) return '';
  
  const spritePath = appearance.sprite || '';
  const imagePath = appearance.item_sprite || '';
  
  // 1. 先在 unique wands 表中精确匹配
  for (const entry of UNIQUE_WAND_SPRITES) {
    if ((entry.sprite_file && entry.sprite_file === spritePath) || entry.image_file === imagePath || entry.image_file === spritePath) {
      return entry.wiki_file;
    }
  }
  
  // 2. 对于 procedural wands，取文件名然后 normalise
  // procedural wand 的 file 格式: data/items_gfx/wands/wand_0001.png
  const bestPath = imagePath || spritePath;
  if (!bestPath) return '';
  
  const filename = bestPath.split('/').pop() || '';
  if (!filename) return '';
  
  return normalisePageName(filename);
}

/**
 * 将 wiki 文件名解析回可用于显示/存储的路径
 * 用于导入 {{Wand2}} 模板时解析 wandPic 字段
 * 
 * 例如: "Wand handgun.png" → { sprite: "data/items_gfx/handgun.xml", image_file: "data/items_gfx/handgun.png" }
 *       "Wand 0001.png"    → { image_file: "data/items_gfx/wands/wand_0001.png" }
 */
export function wikiNameToSpritePath(wikiName: string): { sprite?: string; item_sprite?: string } | null {
  if (!wikiName) return null;
  
  const normalised = normalisePageName(wikiName.trim());
  
  // 1. 在 unique wands 表中匹配
  for (const entry of UNIQUE_WAND_SPRITES) {
    if (normalisePageName(entry.wiki_file) === normalised) {
      return { sprite: entry.sprite_file || entry.image_file, item_sprite: entry.image_file };
    }
  }
  
  // 2. 尝试作为 procedural wand 解析
  // wiki 格式 "Wand 0001.png" → 文件 "data/items_gfx/wands/wand_0001.png"
  // 反向: 空格转下划线, 首字母小写
  const asFilename = wikiName.trim().replace(/ /g, '_').replace(/^[A-Z]/, c => c.toLowerCase());
  const pngPath = `data/items_gfx/wands/${asFilename}`;
  
  // 3. 如果传入的本身就是一个文件路径 (data/... 开头)，直接返回
  if (wikiName.startsWith('data/') || wikiName.startsWith('mods/')) {
    return { sprite: wikiName, item_sprite: wikiName.replace(/\.xml$/, '.png') };
  }
  
  return { item_sprite: pngPath };
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

      const bundle = await getActiveModBundle();

      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab_id: tabId,
          mod_appends: bundle?.appends || null,
          active_mods: bundle?.active_mods || null,
          vfs: bundle?.vfs || null,
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
      // Get mod appends for WASM evaluation
      getActiveModBundle().then(bundle => {
        const appends = bundle?.appends || {};
        const activeMods = bundle?.active_mods || [];
        
        worker?.postMessage({ 
          type: 'EVALUATE', 
          data: wand, 
          options: settings, 
          id: requestId,
          mod_appends: appends,
          active_mods: activeMods,
          vfs: bundle?.vfs || null,
        });
      });

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
    } catch (err) {
      reject(err);
    }
  });
}
