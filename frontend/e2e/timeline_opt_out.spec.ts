import { expect, test } from '@playwright/test';

test.setTimeout(120_000);

const SIMPLE_SPELLS = { '1': 'LIGHT_BULLET', '2': 'LIGHT_BULLET' };

test('关闭自动时间轴时应完全跳过，手动启用后应正常生成', async ({ page }) => {
  await page.goto('/__evaltest8.html');
  await page.waitForFunction(() => (window as any).__ready === true, { timeout: 30_000 });

  const withoutTimeline = await page.evaluate(
    spells => (window as any).__runComplex(spells, {}, 60_000, { timelineEnabled: false }),
    SIMPLE_SPELLS,
  );
  const withTimeline = await page.evaluate(
    spells => (window as any).__runComplex(spells, {}, 60_000, { timelineEnabled: true }),
    SIMPLE_SPELLS,
  );

  expect(withoutTimeline.ok, withoutTimeline.error).toBe(true);
  expect(withoutTimeline.timelineDisabled).toBe(true);
  expect(withoutTimeline.timelineEvents).toBe(0);
  expect(withoutTimeline.timelineStorage).toBeUndefined();
  expect(withoutTimeline.counts).toEqual(withTimeline.counts);
  expect(withoutTimeline.castCounts).toEqual(withTimeline.castCounts);
  expect(withoutTimeline.treeNodes).toBe(withTimeline.treeNodes);

  expect(withTimeline.ok, withTimeline.error).toBe(true);
  expect(withTimeline.timelineDisabled).not.toBe(true);
  expect(withTimeline.timelineEvents).toBeGreaterThan(0);
});

test('单页不显示分页存储提示，多页才显示', async ({ page }) => {
  await page.goto('/__timelineuitest.html');
  await page.waitForFunction(() => (window as any).__ready === true);

  await page.evaluate(() => (window as any).__renderStoredTimeline(1));
  await expect(page.getByText(/stored losslessly|已无损保存/i)).toHaveCount(0);

  await page.evaluate(() => (window as any).__renderStoredTimeline(2));
  await expect(page.getByText(/stored losslessly|已无损保存/i)).toBeVisible();
});

test('禁用时间轴的结果区应提供一次性手动计算按钮', async ({ page }) => {
  await page.goto('/__timelineuitest.html');
  await page.waitForFunction(() => (window as any).__ready === true);
  await page.evaluate(() => (window as any).__renderTimelineDisabled());

  const button = page.getByRole('button', { name: /计算时间轴|Calculate Timeline/i });
  await expect(button).toBeVisible();
  await expect(page.locator('.wand-timeline-manual')).toHaveCSS('position', 'absolute');
  expect(await button.evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(28);
  await expect(page.getByText(/Automatic timeline recording was skipped|自动时间轴记录已跳过/i)).toHaveCount(0);
  await button.click();
  await expect.poll(() => page.evaluate(() => (window as any).__manualTimelineClicks)).toBe(1);
});
