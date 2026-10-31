import { test, expect } from '@playwright/test';
test('home has distinct salon and customer illustrations with motion', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.portal-art-salon')).toBeVisible();
  await expect(page.locator('.portal-art-customer')).toBeVisible();
  expect(await page.locator('.scene-float').first().evaluate(el => getComputedStyle(el).animationName)).toBe('portal-float');
});
test('portal art respects reduced-motion preferences', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.locator('.scene-float').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await expect(page.getByRole('link', { name: /For salon teams/i })).toBeVisible();
});
