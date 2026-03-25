import { test, expect } from '@playwright/test';

test.describe('TWWE Interactions & Shortcuts', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('header', { timeout: 10000 });
    });

    test('should toggle warehouse panel with Ctrl+B', async ({ page }) => {
        const warehousePanel = page.getByTestId('warehouse-panel');

        // 1. 初始状态应该是关闭的
        await expect(warehousePanel).not.toBeVisible();

        // 2. 按 Ctrl+B 打开
        await page.keyboard.press('Control+b');
        await expect(warehousePanel).toBeVisible();

        // 3. 再按 Ctrl+B 关闭
        await page.keyboard.press('Control+b');
        await expect(warehousePanel).not.toBeVisible();
    });

    test('should toggle history panel with Ctrl+H', async ({ page }) => {
        const historyPanel = page.getByTestId('history-panel');

        // 1. 初始状态
        await expect(historyPanel).not.toBeVisible();

        // 2. 按 Ctrl+H 打开
        await page.keyboard.press('Control+h');
        await expect(historyPanel).toBeVisible();

        // 3. 再按 Ctrl+H 关闭
        await page.keyboard.press('Control+h');
        await expect(historyPanel).not.toBeVisible();
    });

    test('should undo and redo wand property changes', async ({ page }) => {
        // 1. 创建并展开法杖
        const newWandBtn = page.getByRole('button', { name: /新法杖|New Wand/ });
        await newWandBtn.click();
        const lastWand = page.locator('.glass-card.group\\/wand').last();
        await lastWand.click();

        // 2. 修改法力上限
        const manaInput = lastWand.locator('.group\\/prop').first().locator('input');
        await manaInput.click({ force: true });
        await manaInput.fill('5000');
        await page.keyboard.press('Enter');

        // 验证修改生效 (StatItem 中显示)
        await expect(lastWand.locator('.text-cyan-400').filter({ hasText: '5000' })).toBeVisible();

        // 3. Ctrl+Z 撤销
        await page.keyboard.press('Control+z');
        await expect(lastWand.locator('.text-cyan-400').filter({ hasText: '5000' })).not.toBeVisible();

        // 4. Ctrl+Y 重做
        await page.keyboard.press('Control+y');
        await expect(lastWand.locator('.text-cyan-400').filter({ hasText: '5000' })).toBeVisible();
    });

    test('should drag and drop spells into wand', async ({ page }) => {
        // 该测试需要具体的法术 ID 或选择器。
        // 目前先实现一个占位符或基础逻辑。
        // 交互逻辑：点击法术格子弹出选择器，选中一个法术。

        const newWandBtn = page.getByRole('button', { name: /新法杖|New Wand/ });
        await newWandBtn.click();
        const lastWand = page.locator('.glass-card.group\\/wand').last();
        await lastWand.click();

        // 点击第一个法术格子 (+)
        const firstSlot = lastWand.locator('[data-slot-idx="1"]');
        await firstSlot.click();

        // 弹出 SpellPicker
        const picker = page.getByTestId('spell-picker');
        await expect(picker).toBeVisible();

        // 直接点击第一个法术 (通常是常用的第一个)
        // 搜索结果列表或分类列表中的第一个按钮
        const firstResult = picker.locator('button').filter({ has: page.locator('img') }).first();
        await expect(firstResult).toBeVisible({ timeout: 10000 });
        await firstResult.click({ force: true });

        // 验证法术已放入格子
        await expect(firstSlot.locator('img')).toBeVisible({ timeout: 10000 });
    });
});
