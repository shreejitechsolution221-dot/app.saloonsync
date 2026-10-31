import { beforeEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({verify:vi.fn(),set:vi.fn(),sameOrigin:vi.fn(),limit:vi.fn()}));
vi.mock('next/navigation',()=>({redirect:(path:string)=>{throw new Error('REDIRECT:'+path);}}));
vi.mock('next/headers',()=>({cookies:async()=>({set:m.set})}));
vi.mock('@/lib/auth/supabase',()=>({supabase:async()=>({auth:{verifyOtp:m.verify}})}));
vi.mock('@/lib/security',()=>({requireSameOrigin:m.sameOrigin,rateLimit:m.limit,appOrigin:()=> 'http://localhost:3000'}));
import {confirmPasswordRecovery} from '@/server/recovery-actions';
function form(values:Record<string,string>){const f=new FormData();Object.entries(values).forEach(([k,v])=>f.set(k,v));return f;}
beforeEach(()=>{vi.resetAllMocks();});
it('rejects malformed and non-recovery tokens without provider calls',async()=>{
 for(const values of [{token_hash:'bad',type:'recovery'},{token_hash:'a'.repeat(64),type:'signup'}])expect((await confirmPasswordRecovery({},form(values))).error).toBeTruthy();
 expect(m.verify).not.toHaveBeenCalled();expect(m.set).not.toHaveBeenCalled();
});
it('never marks an expired provider token as a valid recovery',async()=>{
 m.verify.mockResolvedValue({data:{user:null,session:null},error:{code:'otp_expired'}});
 expect((await confirmPasswordRecovery({},form({token_hash:'a'.repeat(64),type:'recovery'}))).error).toContain('invalid');expect(m.set).not.toHaveBeenCalled();
});
it.each(['platform','salon','customer'])('creates recovery context only after verified provider recovery for %s',async portal=>{
 m.verify.mockResolvedValue({data:{user:{id:'verified-user'},session:{access_token:'test'}},error:null});
 await expect(confirmPasswordRecovery({},form({token_hash:'a'.repeat(64),type:'recovery',portal}))).rejects.toThrow('REDIRECT:/auth/reset-password');
 expect(m.verify).toHaveBeenCalledWith({token_hash:'a'.repeat(64),type:'recovery'});
 expect(m.set).toHaveBeenCalledWith('recovery_user','verified-user',expect.objectContaining({httpOnly:true,maxAge:600}));
 expect(m.set).toHaveBeenCalledWith('auth_portal',portal,expect.anything());
});
it('requires same-origin POST before verifying',async()=>{
 m.sameOrigin.mockRejectedValue(new Error('Origin'));
 expect((await confirmPasswordRecovery({},form({token_hash:'a'.repeat(64),type:'recovery'}))).error).toBeTruthy();expect(m.verify).not.toHaveBeenCalled();
});
it('passes the complete PKCE-prefixed token hash unchanged to Supabase',async()=>{
 const token='pkce_'+'c'.repeat(56);
 m.verify.mockResolvedValue({data:{user:{id:'verified-user'},session:{access_token:'test'}},error:null});
 await expect(confirmPasswordRecovery({},form({token_hash:token,type:'recovery',portal:'platform'}))).rejects.toThrow('REDIRECT:/auth/reset-password');
 expect(m.verify).toHaveBeenCalledWith({token_hash:token,type:'recovery'});
});
