import { test, expect, Page } from '@playwright/test';

/**
 * Paper theme family (Quiet Paper / Quiet Ink).
 * Verifies the theme is applied through tokens on <html> and the app root,
 * that the Tailwind palette remap takes effect, and that non-paper themes
 * keep their stock colors.
 */
const openWithSettings = async (page: Page, settings: Record<string, unknown>) => {
    await page.addInitScript((s) => {
        if (sessionStorage.getItem('__paper_spec_seeded')) return;
        sessionStorage.setItem('__paper_spec_seeded', '1');
        localStorage.setItem('twwe_settings', JSON.stringify(s));
    }, settings);
    await page.goto('/');
    await page.waitForSelector('header', { timeout: 10000 });
};

const computed = (page: Page, selector: string, prop: string) =>
    page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p).trim(), prop);

test.describe('Paper theme family', () => {
    test('Quiet Paper sets tokens on <html> and remaps the palette', async ({ page }) => {
        await openWithSettings(page, { coolUIMode: true, coolUITheme: 'quietpaper' });

        await expect(page.locator('html')).toHaveAttribute('data-paper-theme', 'quietpaper');
        await expect(page.locator('.theme-paper')).toHaveCount(1);

        // Header surfaces resolve to warm ivory instead of zinc glass.
        expect(await computed(page, 'html', '--paper-canvas')).toBe('#f0eee6');
        expect(await computed(page, 'header', 'border-bottom-color')).not.toBe('rgba(255, 255, 255, 0.05)');

        // `text-zinc-500` now resolves to warm ink, not stock zinc (113 113 122).
        const muted = await page.evaluate(() => {
            const probe = document.createElement('span');
            probe.className = 'text-zinc-500';
            document.querySelector('.theme-paper')!.appendChild(probe);
            const color = getComputedStyle(probe).color;
            probe.remove();
            return color;
        });
        expect(muted).toBe('rgb(107, 106, 100)');

        // Brand: serif wordmark and the original spark mark.
        await expect(page.locator('.app-brand-mark')).toBeVisible();
        expect(await computed(page, '.app-wordmark-title', 'font-family')).toContain('Newsreader');
        await expect(page.getByText('TWWE', { exact: true })).toBeVisible();
    });

    test('Quiet Ink is the dark sibling', async ({ page }) => {
        await openWithSettings(page, { coolUIMode: true, coolUITheme: 'quietink' });
        await expect(page.locator('html')).toHaveAttribute('data-paper-theme', 'quietink');
        expect(await computed(page, 'html', '--paper-ink')).toBe('#faf9f5');
        expect(await computed(page, 'html', 'color-scheme')).toBe('dark');
    });

    test('non-paper themes keep stock palette and no paper attribute', async ({ page }) => {
        await openWithSettings(page, { coolUIMode: true, coolUITheme: 'pureprism' });
        await expect(page.locator('html')).not.toHaveAttribute('data-paper-theme', /.+/);
        await expect(page.locator('.theme-paper')).toHaveCount(0);
        const muted = await page.evaluate(() => {
            const probe = document.createElement('span');
            probe.className = 'text-indigo-400';
            document.body.appendChild(probe);
            const color = getComputedStyle(probe).color;
            probe.remove();
            return color;
        });
        expect(muted).toBe('rgb(129, 140, 248)');
    });

    test('settings picker previews every theme with a swatch and switches live', async ({ page }) => {
        await openWithSettings(page, { coolUIMode: true, coolUITheme: 'pureprism' });
        await page.getByTestId('header-settings-btn').click();
        await page.locator('.settings-nav-item').nth(1).click();

        const paperSwatch = page.getByTestId('theme-swatch-quietpaper');
        await expect(paperSwatch.locator('.theme-swatch-chip')).toBeVisible();
        await paperSwatch.click();

        await expect(page.locator('html')).toHaveAttribute('data-paper-theme', 'quietpaper');
        await expect(paperSwatch).toHaveClass(/theme-swatch-active/);
    });
});
