import { test, expect } from '@playwright/test';

test.describe('TWWE Base Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // 等待应用完全加载
        await page.waitForSelector('header', { timeout: 10000 });
    });

    test('should load the application and show the header', async ({ page }) => {
        await expect(page.locator('header')).toBeVisible();
        await expect(page.getByText('TWWE')).toBeVisible();
    });

    test('should open and close the settings modal', async ({ page }) => {
        const settingsBtn = page.getByTestId('header-settings-btn');
        await settingsBtn.click();

        const settingsModal = page.getByTestId('settings-modal');
        await expect(settingsModal).toBeVisible();

        // Settings 通过点击遮罩背景关闭 (modal 外部区域)
        await page.mouse.click(10, 10);
        await expect(settingsModal).not.toBeVisible();
    });

    test('should open and close the warehouse panel', async ({ page }) => {
        const warehouseBtn = page.getByTestId('header-warehouse-btn');
        await warehouseBtn.click();

        const warehousePanel = page.getByTestId('warehouse-panel');
        await expect(warehousePanel).toBeVisible();

        // Warehouse 面板覆盖了 Header 按钮，用快捷键 Ctrl+B 关闭
        await page.keyboard.press('Control+b');
        await expect(warehousePanel).not.toBeVisible();
    });

    test('should have working tab bar', async ({ page }) => {
        const tabs = page.locator('header button');
        await expect(tabs.first()).toBeVisible();
    });
});
