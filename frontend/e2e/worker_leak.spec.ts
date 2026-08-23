/**
 * Lua 引擎泄漏的直接验证。
 *
 * 关键点：wasmoon 的 Lua state 分配在 WASM 线性内存里，
 * 既不在 JS 堆中，也无法被 GC 回收，且 WASM 内存只能增长、无法归还 OS。
 * 因此必须直接测量 WASM buffer.byteLength ——
 * 用 JS 堆指标测这件事等于什么都没测。
 *
 * 夹具 public/__memtest.html 在页面上下文中对比
 * 「不 close」与「每次 close」两种行为的内存曲线。
 */
import { test, expect } from '@playwright/test';

test.setTimeout(300000);

const toMB = (b: number) => b / 1048576;
const fmt = (arr: number[]) => arr.map(v => toMB(v).toFixed(1) + 'MB').join(' -> ');

test('wasmoon: 不 close 导致 WASM 内存单调增长；close 后保持平稳', async ({ page }) => {
  page.on('pageerror', e => console.log('[fixture error]', e.message));
  await page.goto('/__memtest.html');
  await page.waitForFunction(() => (window as any).__memTestReady === true, { timeout: 30000 });

  const { leaky, fixed } = await page.evaluate(() => (window as any).__runMemTest(6));
  console.log('[WASM] raw leaky bytes:', JSON.stringify(leaky));
  console.log('[WASM] raw fixed bytes:', JSON.stringify(fixed));

  const leakGrowth = toMB(leaky[leaky.length - 1] - leaky[0]);
  const fixedGrowth = toMB(fixed[fixed.length - 1] - fixed[0]);

  console.log('[WASM] 不 close :', fmt(leaky));
  console.log('[WASM] 每次close:', fmt(fixed));
  console.log(`[WASM] 10 轮净增长 —— 不close: +${leakGrowth.toFixed(1)}MB / close: +${fixedGrowth.toFixed(1)}MB`);

  // 核心断言：close 之后的增长必须显著小于不 close
  expect(fixedGrowth, `close 后仍增长 ${fixedGrowth.toFixed(1)}MB，不比泄漏版本好`)
    .toBeLessThan(leakGrowth);

  // close 版本应基本平稳（复用已释放的 Lua 内存）
  expect(fixedGrowth, `close 后增长 ${fixedGrowth.toFixed(1)}MB，未达到平稳预期`).toBeLessThan(8);
});
