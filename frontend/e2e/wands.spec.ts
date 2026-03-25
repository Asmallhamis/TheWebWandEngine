import { test, expect } from '@playwright/test';

test.describe('TWWE Wand Operations', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // 等待应用完全加载
        await page.waitForSelector('header', { timeout: 10000 });
    });

    test('should create and delete a wand', async ({ page }) => {
        // 1. 获取初始法杖数量
        const initialWands = await page.locator('.glass-card.group\\/wand').count();

        // 2. 点击 "新法杖" 按钮
        // 根据 zh.json, nav.new_wand 是 "新法杖"
        const newWandBtn = page.getByRole('button', { name: /新法杖|New Wand/ });
        await newWandBtn.click();

        // 3. 验证法杖数量增加
        await expect(page.locator('.glass-card.group\\/wand')).toHaveCount(initialWands + 1);

        // 4. 删除最新创建的法杖
        // 查找最后一个法杖卡片
        const lastWand = page.locator('.glass-card.group\\/wand').last();
        // 悬停以显示操作按钮 (如果有 opacity-0)
        await lastWand.hover();

        // 查找删除按钮 (lucide-trash2 图标所在的按钮)
        // 根据 WandCard.tsx 第 221 行，删除按钮没有 data-testid，但包含 Trash2 图标
        const deleteBtn = lastWand.locator('button').filter({ has: page.locator('svg.lucide-trash2') });
        await deleteBtn.click();

        // 5. 验证法杖数量恢复
        await expect(page.locator('.glass-card.group\\/wand')).toHaveCount(initialWands);
    });

    test('should persist wands after page refresh', async ({ page }) => {
        // 1. 创建一根新法杖并修改其属性
        const newWandBtn = page.getByRole('button', { name: /新法杖|New Wand/ });
        await newWandBtn.click();

        const lastWand = page.locator('.glass-card.group\\/wand').last();
        await lastWand.click(); // 展开编辑器

        // 修改法力上限
        // 注意：PropInput 的 input 在非聚焦状态下是 opacity-0 的，我们需要先点击它所占用的空间
        const manaInputContainer = lastWand.locator('.group\\/prop').first();
        const manaInput = manaInputContainer.locator('input');

        await manaInput.click({ force: true }); // 强制点击以触发 focus
        await manaInput.fill('1234');
        await page.keyboard.press('Enter'); // 模拟提交

        // 2. 刷新页面
        await page.reload();
        await page.waitForSelector('header', { timeout: 10000 });

        // 3. 验证修改是否保留
        const reloadedWand = page.locator('.glass-card.group\\/wand').last();
        await expect(reloadedWand).toBeVisible();

        // 检查值。使用 nth(0) 解决 strict mode violation，或者使用更具体的选择器
        // 这里的错误是因为 .text-cyan-400 匹配到了多个元素（法力上限和回蓝速度可能都有这个类）
        const manaStat = reloadedWand.locator('.text-cyan-400').first();
        await expect(manaStat).toHaveText('1234');
    });
});
