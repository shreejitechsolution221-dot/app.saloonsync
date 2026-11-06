import { test, expect } from '@playwright/test';

const screens = [
  { name: 'small-phone', width: 320, height: 568 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'wide-monitor', width: 2560, height: 1440 },
];

for (const screen of screens) {
  test(`home fits ${screen.name} without horizontal overflow and keeps portal cards reachable`, async ({ page }, testInfo) => {
    await page.setViewportSize(screen);
    await page.goto('/');
    const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewportWidth: innerWidth, viewportHeight: innerHeight }));
    expect(size.width).toBeLessThanOrEqual(size.viewportWidth);
    for (const portal of ['salon', 'customer']) {
      const card = page.locator(`a.portal-card[href="/${portal}/login"]`);
      await card.scrollIntoViewIfNeeded();
      await expect(card).toBeInViewport({ ratio: 0.99 });
      await expect(card.locator('.portal-cta')).toBeInViewport({ ratio: 1 });
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`responsive-${screen.name}.png`), fullPage: true });
  });
}

test('login fits a laptop and phone while keeping the footer accessible', async ({ page }, testInfo) => {
  for (const screen of screens.filter(s => ['phone','tablet','laptop','desktop'].includes(s.name))) {
    await page.setViewportSize(screen);
    await page.goto('/salon/login');
    const size = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, viewport: innerHeight }));
    await page.screenshot({ path: testInfo.outputPath(`login-${screen.name}.png`), fullPage: true });
    expect(size.height, `${screen.name}: ${JSON.stringify(size)}`).toBeLessThanOrEqual(size.viewport + 1);
    expect(await page.locator('.auth-main').evaluate(el => el.scrollHeight <= el.clientHeight + 1), `${screen.name}: form fits without an inner scrollbar`).toBe(true);
    const footer = await page.locator('.auth-footer').boundingBox();
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(screen.height + 1);
  }
});

test('long registration forms remain reachable on small screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/salon/register');
  await page.getByRole('button', { name: 'Create salon account' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Create salon account' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
