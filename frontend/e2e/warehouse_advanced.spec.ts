import { test, expect } from '@playwright/test';

test.describe('TWWE Warehouse Advanced (Batch 3)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('header', { timeout: 10000 });
        // 打开仓库 - 使用按钮更可靠
        const warehouseBtn = page.getByTestId('header-warehouse-btn');
        await warehouseBtn.click();
        await expect(page.getByTestId('warehouse-panel')).toBeVisible({ timeout: 10000 });
    });

    test('should create nested folders', async ({ page }) => {
        // 1. 设置 Dialog 处理器
        let folderCount = 0;
        page.on('dialog', async dialog => {
            folderCount++;
            if (folderCount === 1) {
                await dialog.accept('ParentFolder');
            } else {
                await dialog.accept('ChildFolder');
            }
        });

        // 创建父文件夹
        const addFolderBtn = page.getByTestId('warehouse-new-folder-top-btn');
        await addFolderBtn.click();

        // 验证父文件夹
        const parentFolder = page.locator('[data-testid="warehouse-folder-item"][data-folder-name="ParentFolder"]');
        await expect(parentFolder).toBeVisible({ timeout: 10000 });

        // 2. 创建子文件夹
        const addSubfolderBtn = parentFolder.getByTestId('warehouse-new-subfolder-btn');
        await parentFolder.hover();
        await expect(addSubfolderBtn).toBeVisible({ timeout: 5000 });
        await addSubfolderBtn.click();

        // 验证子文件夹
        const childFolder = page.locator('[data-testid="warehouse-folder-item"][data-folder-name="ChildFolder"]');
        await expect(childFolder).toBeVisible({ timeout: 10000 });
    });

    test('should create and verify Smart Tag', async ({ page }) => {
        // 1. 打开智能标签管理
        const manageTagsBtn = page.getByTestId('warehouse-manage-tags-btn');
        await expect(manageTagsBtn).toBeVisible();
        await manageTagsBtn.click();
        const manager = page.getByTestId('smart-tag-manager');
        await expect(manager).toBeVisible({ timeout: 10000 });

        // 2. 新建智能标签
        const newTagBtn = page.getByTestId('smart-tag-new-btn');
        await newTagBtn.click();

        // 3. 输入名称并添加法术
        const nameInput = page.getByTestId('smart-tag-name-input');
        await nameInput.fill('TriggerTag');

        const searchInput = page.getByTestId('smart-tag-spell-search-input');
        // 使用精确 ID 搜索
        await searchInput.fill('LIGHT_BULLET_TRIGGER');
        await page.waitForTimeout(1000);

        // 验证搜索结果出现
        const firstResult = page.getByTestId('smart-tag-spell-result-item-LIGHT_BULLET_TRIGGER');
        await expect(firstResult).toBeVisible({ timeout: 10000 });
        await firstResult.click();

        // 4. 保存标签
        const saveBtn = page.getByTestId('smart-tag-save-btn');
        await saveBtn.click();

        // 验证标签在管理列表中出现。使用 scoped 避免和 header 重合
        await expect(manager.getByText('TriggerTag')).toBeVisible({ timeout: 10000 });

        // 关闭管理界面 (通过点击右上角的 X)
        await manager.locator('button').filter({ has: page.locator('svg.lucide-x') }).first().click();

        // 5. 验证：创建一个包含该法术的法杖并保存到仓库，检查是否自动打标
        // 先关闭仓库以进行后续操作
        // 由于 Header 按钮可能被面板遮挡且设计上不鼓励通过 Header 切换关闭，我们点击面板内部的 X 按钮
        await page.getByTestId('warehouse-panel').locator('button').filter({ has: page.locator('svg.lucide-x') }).first().click();
        await expect(page.getByTestId('warehouse-panel')).not.toBeVisible({ timeout: 10000 });

        // 创建法杖
        await page.getByRole('button', { name: /新法杖|New Wand/ }).click();
        const lastWand = page.locator('.glass-card.group\\/wand').last();
        await lastWand.click();

        const slot1 = lastWand.locator('[data-slot-idx="1"]');
        await slot1.click();

        const picker = page.getByTestId('spell-picker');
        await expect(picker).toBeVisible();
        await page.getByTestId('spell-picker-input').fill('LIGHT_BULLET_TRIGGER');
        await page.waitForTimeout(1000);
        // 使用精确 ID 点击
        await page.locator('[data-testid="spell-picker-item"][data-spell-id="LIGHT_BULLET_TRIGGER"]').first().click({ force: true });
        await expect(slot1.locator('img')).toBeVisible({ timeout: 5000 });

        // 保存到仓库
        await lastWand.locator('button').filter({ has: page.locator('svg.lucide-archive') }).click();

        // 打开仓库检查标签
        await page.getByTestId('header-warehouse-btn').click();
        await expect(page.getByTestId('warehouse-panel')).toBeVisible({ timeout: 10000 });

        // 在仓库中找到刚存入的法杖
        const warehouseWand = page.locator('.group\\/wand-card').first();
        await expect(warehouseWand.getByText('TriggerTag')).toBeVisible({ timeout: 15000 });
    });
});
