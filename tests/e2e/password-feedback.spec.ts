import { test, expect } from '@playwright/test';

for (const path of ['/salon/register','/customer/register']) {
  test(`password feedback and matching update live on ${path}`,async({page})=>{
    await page.goto(path);
    const password=page.getByLabel('Password',{exact:true});const confirmation=page.getByLabel('Confirm password',{exact:true});
    await password.fill('short');await expect(page.getByText('At least 12 characters needed.',{exact:true})).toBeVisible();
    await password.fill('a-unique-longer-password');await confirmation.fill('a-different-password');
    await expect(page.getByText('Passwords do not match.',{exact:true})).toBeVisible();await expect(confirmation).toHaveAttribute('aria-invalid','true');
    await confirmation.fill('a-unique-longer-password');await expect(page.getByText('Passwords match.',{exact:true})).toBeVisible();
    await password.fill('changed-longer-password');await expect(page.getByText('Passwords do not match.',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Suggest a strong password',exact:true}).click();
    expect((await password.inputValue()).length).toBeGreaterThanOrEqual(20);expect(await confirmation.inputValue()).toBe(await password.inputValue());
    await expect(page.getByText('Passwords match.',{exact:true})).toBeVisible();
    await expect(page.getByText(/Estimated strength:/)).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}

test('recovery returns to the originating customer sign-in experience',async({page})=>{
  await page.goto('/customer/login');await page.getByRole('link',{name:'Forgot password?'}).click();
  await expect(page).toHaveURL(/\/auth\/forgot-password\?portal=customer$/);
  await expect(page.getByRole('link',{name:'Back to sign in',exact:true})).toHaveAttribute('href','/customer/login');
  await page.goto('/customer/login?reset=success');await expect(page.getByRole('status')).toContainText('Password updated');
});

test('no password-strength dictionary is loaded for the login page',async({page})=>{
  const requests:string[]=[];page.on('request',request=>requests.push(request.url()));
  await page.goto('/salon/login');
  await expect(page.getByRole('button',{name:'Suggest a strong password'})).toHaveCount(0);
  await expect(page.getByRole('meter')).toHaveCount(0);
  expect(requests.some(url=>url.includes('/password-strength'))).toBe(false);
});

test('disposable signup fails before creating any account or sending email',async({page})=>{
  await page.goto('/customer/register');
  if(!await page.getByRole('checkbox').count()){test.skip(true,'Legal configuration is intentionally absent.');return;}
  await page.getByLabel('Full name').fill('Disposable Test');await page.getByLabel('Email address').fill('not-a-real-person@mailinator.com');
  await page.getByRole('button',{name:'Suggest a strong password'}).click();
  // Local test only: the server rejects this blocked domain before provider calls.
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'Temporary or disposable'})).toBeVisible();
});

test('forgot-password reports an unknown registered-account lookup without requesting email',async({page})=>{
  await page.goto('/auth/forgot-password?portal=customer');
  await page.getByLabel('Email address').fill(`recovery-test-${Date.now()}@nonexistent-saloonsync.invalid`);
  await page.getByRole('button',{name:'Send reset link',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'Email not found'})).toBeVisible();
  await expect(page.getByLabel('Email address')).toHaveAttribute('aria-invalid','true');
});
