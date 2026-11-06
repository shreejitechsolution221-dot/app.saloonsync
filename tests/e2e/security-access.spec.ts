import {test,expect} from '@playwright/test';
for(const route of ['/platform','/platform/mfa','/platform/salons','/platform/users','/platform/plans','/platform/analytics','/platform/support','/platform/security','/platform/configuration','/platform/announcements','/platform/jobs','/platform/health','/platform/settings','/salon','/salon/appointments','/salon/appointments/new','/salon/appointments/queue','/salon/appointments/walk-in','/salon/appointments/no-shows','/salon/appointments/visit/11111111-1111-4111-8111-111111111111','/salon/customers/retention','/salon/customers/loyalty','/salon/customers/profile/11111111-1111-4111-8111-111111111111','/salon/team/attendance','/salon/team/leave','/salon/team/schedule','/salon/team/performance','/salon/team/people','/salon/billing/expenses','/salon/billing/cash','/salon/billing/refunds','/salon/billing/pos','/salon/billing/receipt/11111111-1111-4111-8111-111111111111','/salon/inventory/purchases','/salon/inventory/suppliers','/salon/inventory/movements','/salon/inventory/usage','/salon/marketing','/salon/marketing/offers','/salon/marketing/feedback','/salon/settings/profile','/salon/settings/locations','/salon/settings/tasks','/salon/settings/integrations','/salon/dashboard/insights','/salon/dashboard/tasks','/salon/reports/export','/salon/reports?scope=owned','/salon/notifications','/salon/more','/salon/setup','/salon/customers','/salon/services','/salon/team','/salon/billing','/salon/inventory','/salon/reports','/salon/settings','/salon/onboarding','/salon/select-workspace','/customer/bookings','/customer/profile']){
 test(`anonymous URL access is blocked for ${route}`,async({page})=>{
  await page.goto(route);await expect(page).toHaveURL(/\/(platform|salon|customer)\/login$/);
 });
}
test('direct reset URL requires a verified recovery session',async({page})=>{
 await page.goto('/auth/reset-password?portal=platform');
 await expect(page).toHaveURL(/\/auth\/forgot-password\?portal=platform&error=recovery$/);
 await expect(page.getByLabel('Confirm password',{exact:true})).toHaveCount(0);
});
for(const route of ['/platform/register','/unknown/login','/unknown/register','/auth/toString','/auth/constructor','/auth/__proto__','/platform/not-real']){
 test(`invalid URL returns 404 for ${route}`,async({request})=>{
  const r=await request.get(route);expect(r.status()).toBe(404);
 });
}
test('anonymous direct APIs cannot return customer or salon data',async({request})=>{
 const id='11111111-1111-4111-8111-111111111111';
 for(const route of [`/api/customer/bookings/${id}`,`/api/salons/${id}/branches/${id}/appointments`]){
  const r=await request.get(route);expect(r.status()).toBe(401);expect(await r.json()).toEqual({error:'Access unavailable'});
 }
});
test('cross-origin invitation cookie writes are rejected',async({request})=>{
 const r=await request.post('/api/invitation-context',{headers:{origin:'https://evil.example'},data:{token:'a'.repeat(43)}});
 expect(r.status()).toBe(403);expect(r.headers()['set-cookie']).toBeUndefined();
});
test('auth responses avoid caching and leaking token-bearing referrers',async({request})=>{
 const r=await request.get('/auth/confirm?portal=platform');
 expect(r.headers()['cache-control']).toContain('no-store');expect(r.headers()['referrer-policy']).toBe('no-referrer');expect(r.headers()['x-frame-options']).toBe('DENY');
});

test('private assets and exports reject anonymous access',async({request})=>{const id='11111111-1111-4111-8111-111111111111';for(const path of [`/api/portfolio/${id}`,`/api/receipt/${id}`,'/api/salon-report?scope=owned','/api/salon-calendar']){const response=await request.get(path);expect(response.status()).toBe(403);}});
test('delivery workers reject missing or incorrect server credentials',async({request})=>{for(const path of ['/api/internal/calendar','/api/internal/communications','/api/internal/services']){expect((await request.post(path)).status()).toBe(401);expect((await request.post(path,{headers:{authorization:'Bearer invalid-token'}})).status()).toBe(401);}});
test('unknown feedback tokens expose no visit form or details',async({page})=>{const response=await page.goto('/feedback/'+ '0'.repeat(64));expect(response?.status()).toBe(404);await expect(page.getByRole('button',{name:'Share my feedback'})).toHaveCount(0);});

test('guest customer discovery does not expose personal appointments',async({page})=>{
 await page.goto('/customer');await expect(page).toHaveURL(/\/customer$/);await expect(page.getByRole('heading',{level:1})).toContainText('Guest');await expect(page.getByRole('heading',{name:'Your Next Appointment',exact:true})).toHaveCount(0);
});
