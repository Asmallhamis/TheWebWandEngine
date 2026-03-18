import { test, expect } from '@playwright/test';

test.describe('Pin To Canvas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header', { timeout: 10000 });
  });

  test('should pin wand editor to canvas and render pixi grid', async ({ page }) => {
    const canvasToggle = page.getByTitle('Switch to Canvas View');
    if (await canvasToggle.count()) {
      await canvasToggle.click();
    }

    const newWandBtn = page.getByRole('button', { name: /新法杖|New Wand/ });
    await newWandBtn.click();

    const pinBtn = page.getByTitle('Pin to Canvas');
    await expect(pinBtn).toBeVisible();
    await pinBtn.click();

    const pinnedEditor = page.locator('[id^="canvas-editor-"]').first();
    await expect(pinnedEditor).toBeVisible({ timeout: 10000 });

    const canvas = pinnedEditor.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    const size = await canvas.evaluate((el) => ({ width: el.width, height: el.height }));
    expect(size.width).toBeGreaterThan(1);
    expect(size.height).toBeGreaterThan(1);
  });
});
