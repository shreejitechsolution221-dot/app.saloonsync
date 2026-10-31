import { test, expect } from '@playwright/test';
test('salon registration collects salon name and mobile accessibly', async ({page}, testInfo) => {
  await page.goto('/salon/register');
  const salon=page.getByLabel('Salon name',{exact:true});const mobile=page.getByLabel('Mobile number',{exact:true});
  await expect(salon).toHaveAttribute('required','');await expect(mobile).toHaveAttribute('type','tel');await expect(mobile).toHaveAttribute('autocomplete','tel');
  await salon.fill('Test Studio');await mobile.fill('+91 98765 43210');
  await page.getByRole('button',{name:'Create salon account'}).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'Create salon account'})).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`docs/previews/owner-registration-${testInfo.project.name}.png`,fullPage:true});
});
test('customer registration does not request salon details', async({page})=>{
  await page.goto('/customer/register');await expect(page.getByLabel('Salon name',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Mobile number',{exact:true})).toHaveCount(0);
});
