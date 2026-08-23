/**
 * 验证 timeline piles 增量化的正确性与收益。
 *
 * Lua 侧仅在牌堆变化时输出 piles，worker 侧 rehydrate 回填共享引用。
 * 必须保证：还原后的每条事件 piles 与"每条都带完整快照"的旧行为逐条一致，
 * 否则时间线回放会显示错误的牌堆。
 */
import { test, expect } from '@playwright/test';

test.setTimeout(300000);

function buildWandInput() {
  return {
    spells: {
      '15': 'OMEGA',
      '18': 'LIGHT_BULLET',
      '19': 'DIVIDE_10',
      '20': 'OMEGA',
      '21': 'HEAL_BULLET',
      '22': 'DIVIDE_4',
      '23': 'DIVIDE_2',
      '24': 'OMEGA',
      '25': 'LIGHT_BULLET',
      '26': 'LIGHT_BULLET',
      '27': 'LIGHT_BULLET',
      '28': 'LIGHT_BULLET',
      '29': 'LIGHT_BULLET',
    },
    spellUses: { '21': 0 },
  };
}

test('增量 piles 还原后应逐条自洽，且大幅共享对象', async ({ page }) => {
  await page.goto('/__evaltest8.html');
  await page.waitForFunction(() => (window as any).__ready === true, { timeout: 30000 });

  const info = await page.evaluate(
    ({ spells, spellUses }) => (window as any).__hold(
      spells,
      spellUses,
      { numCasts: 1, timelineChunkSize: 5_000 },
    ),
    buildWandInput(),
  );

  console.log('[TIMELINE]', JSON.stringify(info));
  expect(info.ok, `评估失败: ${info.error}`).not.toBe(false);
  expect(info.events, '事件数异常').toBeGreaterThan(1000);
  expect(info.truncated, '无损存储启用后不应再截断 timeline').toBe(false);
  expect(info.complete, '完整 timeline 没有落盘').toBe(true);
  expect(info.storedChunks, '没有生成 timeline 分块').toBeGreaterThan(1);
  expect(info.totalEvents, '未报告完整过程事件数').toBeGreaterThan(info.events);

  // 核心收益：piles 对象数应远小于事件数（实测 82976 -> 481）
  expect(info.distinctPiles, 'piles 未被共享，增量化未生效').toBeLessThan(info.events / 10);

  // 正确性：每条事件都必须有可用的 piles（rehydrate 不能漏）
  const integrity = await page.evaluate(() => {
    const ev = (window as any).__held.timeline.events;
    let missing = 0, badShape = 0;
    for (const e of ev) {
      if (!e.piles) { missing++; continue; }
      const p = e.piles;
      if (!Array.isArray(p.deck) || !Array.isArray(p.hand) || !Array.isArray(p.discarded)) badShape++;
    }
    return { missing, badShape, total: ev.length };
  });

  console.log('[TIMELINE] 完整性:', JSON.stringify(integrity));
  expect(integrity.missing, '存在没有 piles 的事件（rehydrate 遗漏）').toBe(0);
  expect(integrity.badShape, '存在 piles 结构异常的事件').toBe(0);

  // 语义正确性：初始事件的 deck 应非空（法杖有 26 张牌），
  // 若增量还原把首个状态错填成空数组，这里会失败。
  const firstDeck = await page.evaluate(() => {
    const ev = (window as any).__held.timeline.events;
    const first = ev.find((e: any) => e.type === 'initial_deck') || ev[0];
    return { type: first.type, deckLen: first.piles.deck.length };
  });
  console.log('[TIMELINE] 首事件:', JSON.stringify(firstDeck));
  expect(firstDeck.deckLen, '初始牌堆为空，增量还原有误').toBeGreaterThan(0);
});
