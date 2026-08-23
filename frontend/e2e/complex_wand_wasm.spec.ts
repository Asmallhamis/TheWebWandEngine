import { expect, test } from '@playwright/test';

test.setTimeout(180_000);

const SPELLS_RAW = 'BURST_X,ADD_TRIGGER,LIGHT_BULLET,OMEGA,OMEGA,OMEGA,OMEGA,OMEGA,OMEGA,OMEGA,OMEGA,OMEGA,OMEGA,OMEGA,,,LIGHT_BULLET,DIVIDE_10,OMEGA,HEAL_BULLET{0},DIVIDE_4,DIVIDE_2,OMEGA,LIGHT_BULLET,LIGHT_BULLET,LIGHT_BULLET,LIGHT_BULLET,LIGHT_BULLET,';

function parseWandSpells() {
  const spells: Record<string, string> = {};
  const spellUses: Record<string, number> = {};
  SPELLS_RAW.split(',').forEach((raw, index) => {
    const id = raw.replace(/\{.*\}/, '').trim();
    if (!id) return;
    const slot = String(index + 1);
    spells[slot] = id;
    const uses = raw.match(/\{(-?\d+)\}/);
    if (uses) spellUses[slot] = Number(uses[1]);
  });
  return { spells, spellUses };
}

test('完整复杂 Wand2 应在网页版 WASM 中完成计算', async ({ page }) => {
  await page.goto('/__evaltest8.html');
  await page.waitForFunction(() => (window as any).__ready === true, { timeout: 30_000 });

  const input = parseWandSpells();
  const result = await page.evaluate(
    ({ spells, spellUses }) => (window as any).__runComplex(spells, spellUses, 120_000),
    input,
  );

  console.log('[COMPLEX-WAND]', JSON.stringify({
    ...result,
    timelineStorage: result.timelineStorage ? {
      ...result.timelineStorage,
      chunks: result.timelineStorage.chunks.length,
    } : undefined,
  }));
  expect(result.timedOut, 'WASM 计算 120 秒仍未返回').not.toBe(true);
  expect(result.ok, `WASM 评估失败: ${result.error || 'unknown error'}`).toBe(true);
  expect(result.counts).toEqual({
    ADD_TRIGGER: 188646,
    BURST_X: 188646,
    DIVIDE_10: 189336,
    DIVIDE_2: 200529,
    DIVIDE_4: 191580,
    HEAL_BULLET: 188574,
    LIGHT_BULLET: 1320486,
    OMEGA: 188643,
  });
  expect(result.treeNodes, '未返回完整折叠树').toBe(4489);
  expect(result.timelineEvents).toBeLessThanOrEqual(10_000);
  expect(result.timelineTruncated).not.toBe(true);
  expect(result.timelineComplete, 'timeline 没有无损保存').toBe(true);
  expect(result.timelineStorage?.kind).toBe('opfs-compact-v1');
  expect(result.timelineStorage?.chunks?.length).toBeGreaterThan(1);
  expect(result.timelineStorage?.chunks.reduce(
    (sum: number, chunk: { event_count: number }) => sum + chunk.event_count,
    0,
  )).toBe(5_690_456);
  expect(result.timelineStorage?.total_bytes).toBeLessThan(150_000_000);
  expect(result.timelineTotalEvents).toBe(5_690_456);

  const firstPage = await page.evaluate(() => (window as any).__inspectStoredTimelinePage(0));
  expect(firstPage.matchesInline, '紧凑存储解码后与原始前 10,000 条不一致').toBe(true);
  expect(firstPage.missingPiles).toBe(0);
  expect(firstPage.badActionEvents).toBe(0);

  const lastPageIndex = result.timelineStorage.chunks.length - 1;
  const lastPage = await page.evaluate(
    index => (window as any).__inspectStoredTimelinePage(index),
    lastPageIndex,
  );
  expect(lastPage.count).toBeGreaterThan(0);
  expect(lastPage.last).toBe(5_690_456);
  expect(lastPage.missingPiles).toBe(0);
  expect(lastPage.badActionEvents).toBe(0);
});

test('复杂 Wand2 关闭时间轴后应保留核心结果并显著减少工作量', async ({ page }) => {
  await page.goto('/__evaltest8.html');
  await page.waitForFunction(() => (window as any).__ready === true, { timeout: 30_000 });

  const input = parseWandSpells();
  const result = await page.evaluate(
    ({ spells, spellUses }) => (window as any).__runComplex(
      spells,
      spellUses,
      60_000,
      { timelineEnabled: false },
    ),
    input,
  );

  console.log('[COMPLEX-WAND-NO-TIMELINE]', JSON.stringify(result));
  expect(result.timedOut, '关闭时间轴后 WASM 计算 60 秒仍未返回').not.toBe(true);
  expect(result.ok, `WASM 评估失败: ${result.error || 'unknown error'}`).toBe(true);
  expect(result.counts).toEqual({
    ADD_TRIGGER: 188646,
    BURST_X: 188646,
    DIVIDE_10: 189336,
    DIVIDE_2: 200529,
    DIVIDE_4: 191580,
    HEAL_BULLET: 188574,
    LIGHT_BULLET: 1320486,
    OMEGA: 188643,
  });
  expect(result.treeNodes, '关闭时间轴后折叠树不完整').toBe(4489);
  expect(result.timelineDisabled).toBe(true);
  expect(result.timelineEvents).toBe(0);
  expect(result.timelineStorage).toBeUndefined();
});
