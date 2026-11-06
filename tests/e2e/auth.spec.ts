import { test, expect } from '@playwright/test';
test('home shows salon and customer access without exposing platform administration', async ({ page }, testInfo) => {
  await page.goto('/'); await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  for (const portal of ['salon', 'customer']) await expect(page.locator(`a.portal-card[href="/${portal}/login"]`)).toBeVisible();
  await expect(page.locator('a[href^="/platform"]')).toHaveCount(0);
  await expect(page.getByText(/administer the platform/i)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath(`home-${testInfo.project.name}.png`), fullPage: true });
});
test('public authentication pages have no platform navigation', async ({ page }) => {
  for (const path of ['/salon/login', '/customer/login', '/salon/register', '/customer/register', '/auth/forgot-password']) {
    await page.goto(path);
    await expect(page.locator('a[href^="/platform"]')).toHaveCount(0);
  }
});
test('private platform entry is excluded from search indexing', async ({ page }) => {
  const response = await page.goto('/platform/login');
  expect(response?.headers()['x-robots-tag']).toContain('noindex');
});
for (const [portal, title] of [['salon', 'Run your salon.'], ['customer', 'Plan your next visit.'], ['platform', 'Manage the platform.']]) {
  test(`${portal} login has accessible labels and no overflow`, async ({ page }, testInfo) => {
    await page.goto(`/${portal}/login`);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '← Back to Saloonsync', exact: true })).toHaveCount(0);
    await page.getByLabel('Email address').fill('test@example.test');
    await page.getByLabel('Password', { exact: true }).fill('private-password');
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password', exact: true }).click();
    await expect(page.locator('#password')).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Hide password', exact: true }).click();
    await page.getByLabel('Email address').focus(); await page.keyboard.press('Tab');
    if (portal !== 'platform') {
      await expect(page.getByRole('radio', { name: 'Use password', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
    }
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (portal === 'platform') await expect(page.getByRole('link', { name: /create.*account/i })).toHaveCount(0);
    await page.getByLabel('Email address').fill('');
    await page.getByLabel('Password', { exact: true }).fill('');
    await page.screenshot({ path: testInfo.outputPath(`${portal}-${testInfo.project.name}.png`), fullPage: true });
  });
}
test('registration requires legal configuration and mandatory consent', async ({ page }) => {
  for (const portal of ['salon', 'customer']) {
    await page.goto(`/${portal}/register`);
    await expect(page.getByLabel('Full name')).toBeVisible();
    const consent = page.getByRole('checkbox');
    if (await consent.count()) {
      await expect(consent).toHaveAttribute('required', '');
      await expect(consent).not.toBeChecked();
      await expect(page.getByRole('link', { name: 'service terms', exact: true })).toHaveAttribute('href', /^https:\/\//);
      await expect(page.getByRole('link', { name: 'privacy notice', exact: true })).toHaveAttribute('href', /^https:\/\//);
    } else {
      await expect(page.getByRole('button', { name: portal === 'salon' ? 'Create salon account' : 'Create account' })).toBeDisabled();
    }
  }
  await page.goto('/platform/register'); await expect(page.getByRole('heading', { name: 'Let’s find your space.' })).toBeVisible();
});
test('recovery and verification routes render', async ({ page }) => {
  for (const route of ['forgot-password', 'reset-password', 'verify-email']) {
    await page.goto(`/auth/${route}`); await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
test('invitation token is removed from the address and held in an HttpOnly cookie', async ({ page, context }) => {
  const token = 'a'.repeat(43);
  await page.goto(`/salon/invitations/accept#token=${token}`);
  await expect(page.getByRole('status')).toContainText('Invitation saved');
  expect(page.url()).not.toContain(token);
  const cookie = (await context.cookies()).find(c => c.name === 'invitation');
  expect(cookie?.httpOnly).toBe(true); expect(cookie?.value).toBe(token);
});
test('anonymous protected dashboards return to login', async ({ page }) => {
  for (const portal of ['salon', 'platform']) { await page.goto(`/${portal}`); await expect(page).toHaveURL(new RegExp(`/${portal}/login$`)); }
  await page.goto('/customer/bookings'); await expect(page).toHaveURL(/\/customer\/login$/);
});
