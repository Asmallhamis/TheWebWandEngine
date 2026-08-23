/**
 * 验证「每次评估后 close Lua state」没有破坏评估正确性。
 *
 * 为什么需要这个测试：现有 evaluator.spec.ts 依赖 UI 选择器，且在修改前后
 * 都因超时而失败，无法用来验证 worker 行为。这里绕过 UI，直接驱动
 * evaluator.worker，既检验结果正确性，也检验连续多次评估的稳定性
 * （close 之后引擎能否被反复重建）。
 */
import { test, expect } from '@playwright/test';

test.setTimeout(240000);

test('close 引擎后连续评估仍应返回一致且正确的结果', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/__evaltest.html');
  await page.waitForFunction(() => (window as any).__evalTestReady === true, { timeout: 30000 });

  // 连续评估 4 次：同一根法杖、同一 seed，结果必须完全一致。
  // 若 close 破坏了引擎复用，第 2 次及以后会报错或返回不同结果。
  const results = await page.evaluate(() => (window as any).__runEval(4));

  console.log('[EVAL] 每轮结果摘要:', JSON.stringify(results.map((r: any) => ({
    ok: r.ok,
    err: r.error,
    casts: r.castCount,
    first: r.firstSpell,
  })), null, 1));

  // 1) 每轮都必须成功
  results.forEach((r: any, i: number) => {
    expect(r.ok, `第 ${i + 1} 轮评估失败: ${r.error}`).toBe(true);
  });

  // 2) 必须真的算出了东西（不是空结果蒙混过关）
  expect(results[0].castCount, '评估未产生任何施法').toBeGreaterThan(0);
  expect(results[0].firstSpell, '评估结果缺少法术信息').toBeTruthy();

  // 3) 关键：多轮结果必须一致 —— 证明 close 后重建的引擎行为等价
  const signatures = results.map((r: any) => `${r.castCount}|${r.firstSpell}`);
  expect(new Set(signatures).size, `多轮评估结果不一致: ${signatures.join(' vs ')}`).toBe(1);

  expect(errors, `页面出现异常: ${errors.join('; ')}`).toHaveLength(0);
});

/**
 * 强化验证：确认评估结果确实包含了投入的法术，
 * 而不是一个「结构完整但内容为空」的壳（防止上一个用例假通过）。
 */
test('评估结果应真实反映投入的法术', async ({ page }) => {
  await page.goto('/__evaltest.html');
  await page.waitForFunction(() => (window as any).__evalTestReady === true, { timeout: 30000 });

  const raw = await page.evaluate(() => (window as any).__runEvalRaw());

  console.log('[EVAL] 结果顶层字段:', JSON.stringify(raw.topKeys));
  console.log('[EVAL] 结果体积:', raw.size, 'bytes; 含 LIGHT_BULLET:', raw.mentionsLightBullet);
  console.log('[EVAL] 片段:', raw.excerpt);

  expect(raw.type, `评估未返回结果: ${raw.error}`).toBe('RESULT');
  expect(raw.size, '评估结果过小，疑似空壳').toBeGreaterThan(200);
  expect(raw.mentionsLightBullet, '评估结果中找不到投入的 LIGHT_BULLET 法术').toBe(true);
});
