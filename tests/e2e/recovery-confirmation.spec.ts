import {test,expect} from '@playwright/test';
test('confirmation GET does not consume a recovery token',async({page})=>{
 const providerRequests:string[]=[];page.on('request',r=>{if(r.url().includes('supabase.co/auth/'))providerRequests.push(r.url());});
 await page.goto('/auth/confirm?portal=platform&type=recovery&token_hash='+'a'.repeat(64));
 await expect(page.getByRole('button',{name:'Continue to reset password',exact:true})).toBeVisible();
 expect(providerRequests).toHaveLength(0);await expect(page).toHaveURL(/\/auth\/confirm\?/);
});
test('recovery error banner does not persist into a fresh request page',async({page})=>{
 await page.goto('/platform/login#error=access_denied&error_code=otp_expired');
 await page.getByRole('link',{name:'Request a new password reset link',exact:true}).click();
 await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
});
test('incomplete confirmation link offers recovery without a confirmation submit',async({page})=>{
 await page.goto('/auth/confirm?portal=platform');
 await expect(page.getByRole('main').getByRole('alert')).toContainText('incomplete or invalid');
 await expect(page.getByRole('button',{name:'Continue to reset password'})).toHaveCount(0);
});
test('invalid recovery token cannot authorize a password change',async({page})=>{
 await page.goto('/auth/confirm?portal=platform&type=recovery&token_hash='+'b'.repeat(64));
 await page.getByRole('button',{name:'Continue to reset password',exact:true}).click();
 await expect(page.getByRole('main').getByRole('alert')).toContainText('invalid or has already been used',{timeout:15000});
 await expect(page).toHaveURL(/\/auth\/confirm\?/);
 await expect(page.getByLabel('Confirm password',{exact:true})).toHaveCount(0);
});

test('accepts the PKCE-prefixed recovery hash format without consuming it on GET',async({page})=>{
 await page.goto('/auth/confirm?portal=platform&type=recovery&token_hash=pkce_'+'c'.repeat(56));
 await expect(page.getByRole('button',{name:'Continue to reset password',exact:true})).toBeVisible();
 await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
});
