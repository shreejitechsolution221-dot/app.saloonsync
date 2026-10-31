import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ otpSend: vi.fn(), otpVerify: vi.fn(), signIn: vi.fn(), signUp: vi.fn(), reset: vi.fn(), signOut: vi.fn(), update: vi.fn(), getUser: vi.fn(), cookie: { get: vi.fn(), delete: vi.fn(), set: vi.fn() }, legal: vi.fn(), saveUser: vi.fn(), saveConsent: vi.fn(), saveCustomer: vi.fn(), registeredEmailExists: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => m.cookie }));
vi.mock('next/navigation', () => ({ redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); } }));
vi.mock('@/lib/auth/config', () => ({ legalConfig: m.legal, passwordMinimum: () => 12 }));
vi.mock('@/lib/auth/supabase', () => ({ supabase: async () => ({ auth: { signInWithOtp: m.otpSend, verifyOtp: m.otpVerify, signInWithPassword: m.signIn, signUp: m.signUp, resetPasswordForEmail: m.reset, signOut: m.signOut, updateUser: m.update, getUser: m.getUser } }) }));
vi.mock('@/lib/db', () => ({ db: { $transaction: async (fn: (tx: unknown) => unknown) => fn({ user: { upsert: m.saveUser }, consentRecord: { upsert: m.saveConsent }, customerProfile: { upsert: m.saveCustomer } }) } }));
vi.mock('@/lib/security', () => ({ requireSameOrigin: async () => {}, rateLimit: async () => {}, appOrigin: () => 'https://app.test' }));
vi.mock('@/lib/email/signup-policy', () => ({ emailPolicyError: () => null, assertSignupEmail: async () => {} }));
vi.mock('@/lib/auth/registered-email', () => ({ registeredEmailExists: m.registeredEmailExists }));
import { authenticate, forgotPassword, register, resetPassword, logout, requestLoginOtp, verifyLoginOtp } from '@/server/auth-actions';
function form(values: Record<string,string>) { const f = new FormData(); Object.entries(values).forEach(([k,v]) => f.set(k,v)); return f; }
beforeEach(() => { vi.resetAllMocks(); m.legal.mockReturnValue({ ready: false }); m.registeredEmailExists.mockResolvedValue(true); });
it.each(['salon', 'customer', 'platform'])('routes %s login only after provider success', async portal => {
  m.signIn.mockResolvedValue({ error: null });
  await expect(authenticate({}, form({ portal, email: 'a@example.test', password: 'password', next: '//evil.test' }))).rejects.toThrow(`REDIRECT:/${portal}`);
});
it('does not enumerate invalid account versus invalid password', async () => {
  m.signIn.mockResolvedValueOnce({ error: { message: 'Unknown account' } }).mockResolvedValueOnce({ error: { message: 'Wrong password' } });
  const input = form({ email: 'a@example.test', password: 'password' });
  expect(await authenticate({}, input)).toEqual(await authenticate({}, input));
});
it('blocks registration before provider calls without finalized terms', async () => {
  expect((await register({}, new FormData())).error).toContain('service terms'); expect(m.signUp).not.toHaveBeenCalled();
});
it('validates password mismatch and consent before signup', async () => {
  m.legal.mockReturnValue({ ready: true });
  const input = form({ name: 'A Person', email: 'a@example.test', password: 'long-enough-password', confirmation: 'different', consent: 'on', salonName: 'A Salon', mobileNumber: '+91 98765 43210' });
  expect((await register({}, input)).fields?.confirmation).toBeTruthy();
  input.set('confirmation', 'long-enough-password'); input.delete('consent');
  expect((await register({}, input)).fields?.consent).toBeTruthy(); expect(m.signUp).not.toHaveBeenCalled();
});
it('does not report a recovery email as sent when provider fails', async () => {
  m.reset.mockResolvedValue({ error: { message: 'Unavailable' } }); expect((await forgotPassword({}, form({ email: 'a@example.test' }))).error).toBeTruthy();
});
it('requires a provider user and recovery context before changing credentials', async () => {
  m.getUser.mockResolvedValue({ data: { user: { id: 'u' } } }); m.cookie.get.mockReturnValue(undefined);
  expect((await resetPassword({}, form({ password: 'long-enough-password', confirmation: 'long-enough-password' }))).error).toContain('reset link'); expect(m.update).not.toHaveBeenCalled();
});
it('revokes sessions through provider logout before redirecting', async () => {
  m.signOut.mockResolvedValue({ error: null });
  await expect(logout()).rejects.toThrow('REDIRECT:/salon/login'); expect(m.signOut).toHaveBeenCalled(); expect(m.cookie.delete).toHaveBeenCalledWith('workspace');
});
it('persists owner mobile and salon name after provider signup confirmation', async () => {
  m.legal.mockReturnValue({ ready:true,version:'test-v1' });
  m.signUp.mockResolvedValue({ data:{user:{id:'new-owner',identities:[{id:'identity'}]}},error:null });
  const result=await register({},form({portal:'salon',name:'Owner Name',email:'owner@example.test',password:'long-enough-password',confirmation:'long-enough-password',consent:'on',mobileNumber:'+91 98765 43210',salonName:'My Studio'}));
  expect(result.message).toContain('Check your inbox');
  expect(m.saveUser).toHaveBeenCalledWith(expect.objectContaining({create:expect.objectContaining({mobileNumber:'+919876543210',salonRegistrationName:'My Studio'})}));
  expect(m.saveCustomer).not.toHaveBeenCalled();
});
it.each(['salon','customer','platform'])('redirects successful recovery to %s sign-in after provider logout',async portal=>{
  m.getUser.mockResolvedValue({data:{user:{id:'u'}}});m.cookie.get.mockImplementation(name=>({value:name==='recovery_user'?'u':portal}));m.update.mockResolvedValue({error:null});m.signOut.mockResolvedValue({error:null});
  await expect(resetPassword({},form({password:'new-password-for-test',confirmation:'new-password-for-test'}))).rejects.toThrow(`REDIRECT:/${portal}/login?reset=success`);
  expect(m.signOut).toHaveBeenCalledWith({scope:'global'});expect(m.cookie.delete).toHaveBeenCalledWith('recovery_user');
});
it('does not claim reset success when the provider rejects the password',async()=>{
  m.getUser.mockResolvedValue({data:{user:{id:'u'}}});m.cookie.get.mockReturnValue({value:'u'});m.update.mockResolvedValue({error:{message:'Rejected'}});
  expect((await resetPassword({},form({password:'new-password-for-test',confirmation:'new-password-for-test'}))).error).toBeTruthy();expect(m.signOut).not.toHaveBeenCalled();
});
it('shows email not found and never requests a reset for an unregistered address',async()=>{
  m.registeredEmailExists.mockResolvedValue(false);
  const result=await forgotPassword({},form({email:'unknown@example.test',portal:'salon'}));
  expect(result.error).toContain('Email not found');expect(result.fields?.email).toBeTruthy();expect(m.reset).not.toHaveBeenCalled();
});
it('requests reset only for a registered address and preserves its portal',async()=>{
  m.reset.mockResolvedValue({error:null});
  const result=await forgotPassword({},form({email:'known@example.test',portal:'customer'}));
  expect(m.registeredEmailExists).toHaveBeenCalledWith('known@example.test');expect(m.reset).toHaveBeenCalledTimes(1);expect(result.message).toContain('Check your inbox');expect(m.cookie.set).toHaveBeenCalledWith('auth_portal','customer',expect.anything());
});
it('does not send reset mail if the account lookup is unavailable',async()=>{
  m.registeredEmailExists.mockRejectedValue(new Error('Unavailable'));expect((await forgotPassword({},form({email:'known@example.test'}))).error).toBeTruthy();expect(m.reset).not.toHaveBeenCalled();
});

it.each(['salon','customer'])('sends OTP for existing %s accounts without creating users',async portal=>{
  m.otpSend.mockResolvedValue({error:null});
  const result=await requestLoginOtp({},form({portal,email:'known@example.test'}));
  expect(result.email).toBe('known@example.test');expect(result.sentAt).toBeTypeOf('number');
  expect(m.otpSend).toHaveBeenCalledWith(expect.objectContaining({options:expect.objectContaining({shouldCreateUser:false})}));
});
it('never sends OTP to unknown accounts or platform logins',async()=>{
  m.registeredEmailExists.mockResolvedValue(false);
  expect((await requestLoginOtp({},form({portal:'customer',email:'unknown@example.test'}))).error).toContain('Email not found');
  expect((await requestLoginOtp({},form({portal:'platform',email:'known@example.test'}))).error).toBeTruthy();expect(m.otpSend).not.toHaveBeenCalled();
});
it('does not show OTP sent success when provider fails',async()=>{
  m.otpSend.mockResolvedValue({error:{message:'Unavailable'}});
  expect((await requestLoginOtp({},form({portal:'salon',email:'known@example.test'}))).sentAt).toBeUndefined();
});
it('requires a requested OTP context and rejects malformed codes',async()=>{
  expect((await verifyLoginOtp({},form({token:'123456'}))).error).toContain('Request a new');
  expect((await verifyLoginOtp({},form({token:'abc'}))).error).toContain('numeric');expect(m.otpVerify).not.toHaveBeenCalled();
});
it.each(['salon','customer'])('verifies code with server-bound email and routes to %s',async portal=>{
  m.cookie.get.mockReturnValue({value:JSON.stringify({email:'known@example.test',portal,sentAt:Date.now()})});
  m.otpVerify.mockResolvedValue({data:{user:{id:'u'},session:{access_token:'test'}},error:null});
  await expect(verifyLoginOtp({},form({token:'123456',email:'other@example.test',portal:'platform'}))).rejects.toThrow(`REDIRECT:/${portal}`);
  expect(m.otpVerify).toHaveBeenCalledWith({email:'known@example.test',token:'123456',type:'email'});expect(m.cookie.delete).toHaveBeenCalledWith('login_otp');
});
it('rejects expired OTP context and provider-invalid codes',async()=>{
  m.cookie.get.mockReturnValue({value:JSON.stringify({email:'known@example.test',portal:'salon',sentAt:Date.now()-3600001})});
  expect((await verifyLoginOtp({},form({token:'123456'}))).error).toContain('Request a new');expect(m.otpVerify).not.toHaveBeenCalled();
  m.cookie.get.mockReturnValue({value:JSON.stringify({email:'known@example.test',portal:'salon',sentAt:Date.now()})});
  m.otpVerify.mockResolvedValue({data:{user:null,session:null},error:{message:'Expired'}});
  expect((await verifyLoginOtp({},form({token:'123456'}))).error).toContain('invalid or expired');
});
it('throttles resend before contacting the provider',async()=>{
  m.cookie.get.mockReturnValue({value:JSON.stringify({sentAt:Date.now()})});
  expect((await requestLoginOtp({},form({portal:'salon',email:'known@example.test'}))).error).toContain('one minute');expect(m.otpSend).not.toHaveBeenCalled();
});
