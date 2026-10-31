import { test, expect } from '@playwright/test';
for(const portal of ['platform','salon','customer']) {
 test(`expired provider fragment offers fresh recovery for ${portal}`,async({page})=>{
  await page.goto(`/${portal}/login#error=access_denied&error_code=otp_expired&error_description=untrusted-provider-text`);
  await expect(page.getByRole('alert').filter({hasText:'This email link is invalid or has expired.'})).toBeVisible();
  await expect(page.getByText('untrusted-provider-text')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/${portal}/login$`));
  await page.getByRole('link',{name:'Request a new password reset link',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`/auth/forgot-password\\?portal=${portal}$`));
  await expect(page.getByRole('button',{name:'Send reset link',exact:true})).toBeVisible();
 });
}
test('failed recovery callback returns to recovery instead of signup verification',async({page})=>{
 await page.goto('/auth/callback?next=/auth/reset-password&error=access_denied');
 await expect(page).toHaveURL(/\/auth\/forgot-password\?error=link&portal=salon$/);
 await expect(page.getByRole('button',{name:'Send reset link',exact:true})).toBeVisible();
});
