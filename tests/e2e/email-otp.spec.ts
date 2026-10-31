import { test, expect } from '@playwright/test';
for (const portal of ['salon','customer']) {
  test(`${portal} offers an accessible email code login`,async({page})=>{
    await page.goto(`/${portal}/login`);
    await page.getByLabel('Email address',{exact:true}).fill('person@example.com');
    await page.getByRole('radio',{name:'Email OTP',exact:true}).check();
    await expect(page.getByLabel('Email address',{exact:true})).toHaveValue('person@example.com');
    await expect(page.getByLabel('Password',{exact:true})).not.toBeVisible();
    await expect(page.locator('input[type=email]')).toHaveCount(1);
    await expect(page.getByRole('button',{name:'Send sign-in code',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('radio',{name:'Use password',exact:true}).check();
    await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
    await expect(page.getByLabel('Email address',{exact:true})).toHaveValue('person@example.com');
  });
}
test('platform does not offer email OTP',async({page})=>{
  await page.goto('/platform/login');await expect(page.getByRole('radio',{name:'Email OTP',exact:true})).toHaveCount(0);
});
test('reset confirmation stays closed before a successful provider response',async({page})=>{
  await page.goto('/auth/forgot-password?portal=customer');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});


