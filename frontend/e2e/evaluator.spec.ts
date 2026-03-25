import { test, expect } from '@playwright/test';

test.describe('TWWE Simulator Logic (Batch 3)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('header', { timeout: 10000 });
    });

    test('should simulate Spark Bolt with Trigger + Spark Bolt', async ({ page }) => {
        // 1. 创建新法杖
        await page.getByRole('button', { name: /新法杖|New Wand/ }).click();
        const lastWand = page.locator('.glass-card.group\\/wand').last();
        await lastWand.click();

        // 2. 添加 "带有触发的火花弹" (LIGHT_BULLET_TRIGGER) 到 Slot 1
        const slot1 = lastWand.locator('[data-slot-idx="1"]');
        await slot1.click();

        const picker = page.getByTestId('spell-picker');
        await expect(picker).toBeVisible();

        const pickerInput = page.getByTestId('spell-picker-input');
        // 使用 ID 搜索最可靠
        await pickerInput.fill('LIGHT_BULLET_TRIGGER');
        await page.waitForTimeout(500);
        // 精确匹配 ID
        await page.locator('[data-testid="spell-picker-item"][data-spell-id="LIGHT_BULLET_TRIGGER"]').first().click({ force: true });
        await expect(slot1.locator('img')).toBeVisible({ timeout: 5000 });

        // 3. 添加 "火花弹" (LIGHT_BULLET) 到 Slot 2
        const slot2 = lastWand.locator('[data-slot-idx="2"]');
        await slot2.click();
        await pickerInput.fill('LIGHT_BULLET');
        await page.waitForTimeout(500);
        // 精确匹配 ID
        await page.locator('[data-testid="spell-picker-item"][data-spell-id="LIGHT_BULLET"]').first().click({ force: true });
        await expect(slot2.locator('img')).toBeVisible({ timeout: 5000 });

        // 4. 等待评估结果
        // 增加等待时间，确保模拟器完成
        await page.waitForTimeout(3000);

        await expect(page.getByTestId('eval-overall-counts')).toBeVisible({ timeout: 15000 });

        // 5. 验证特定法术的计数
        // Spark Bolt with Trigger 发射一次，内部核心 Projectile 又是 Spark Bolt，所以两者都应该有计数
        const triggerItem = page.getByTestId('eval-overall-count-item-LIGHT_BULLET_TRIGGER');
        await expect(triggerItem).toBeVisible({ timeout: 5000 });
        await expect(triggerItem.getByText('1')).toBeVisible();

        const bulletItem = page.getByTestId('eval-overall-count-item-LIGHT_BULLET');
        await expect(bulletItem).toBeVisible({ timeout: 5000 });
        await expect(bulletItem.getByText('1')).toBeVisible();
    });

    test('should handle Always Cast in simulation', async ({ page }) => {
        // 1. 创建新法杖并跳转
        await page.getByRole('button', { name: /新法杖|New Wand/ }).click();
        const lastWand = page.locator('.glass-card.group\\/wand').last();
        await lastWand.scrollIntoViewIfNeeded();
        await lastWand.click();

        // 2. 手动将 "炸弹" (BOMB) 拖入 Always Cast 区域
        // 先打开法术选择器搜索炸弹
        const slot1 = lastWand.locator('[data-slot-idx="1"]');
        await slot1.click();

        const pickerInput = page.getByTestId('spell-picker-input');
        await pickerInput.fill('BOMB');
        await page.waitForTimeout(500);

        const bombSource = page.locator('[data-testid="spell-picker-item"][data-spell-id="BOMB"]').first();
        const acTarget = lastWand.locator('.border-amber-500\\/20'); // Always Cast 目标区域

        // Playwright 的 dragTo 有时不稳定，使用手动模拟
        const sourceBox = await bombSource.boundingBox();
        const targetBox = await acTarget.boundingBox();

        if (sourceBox && targetBox) {
            await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
            await page.mouse.down();
            await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
            await page.mouse.up();
        }

        // 验证 AC 区域出现了炸弹
        await expect(acTarget.locator('img')).toBeVisible({ timeout: 5000 });

        // 3. 验证评估结果包含始终施放的法术 (炸弹)
        await page.waitForTimeout(3000);
        await expect(page.getByTestId('eval-overall-counts')).toBeVisible({ timeout: 15000 });

        const bombItem = page.getByTestId('eval-overall-count-item-BOMB');
        await expect(bombItem).toBeVisible({ timeout: 5000 });
        await expect(bombItem.getByText('1')).toBeVisible();
    });
});
