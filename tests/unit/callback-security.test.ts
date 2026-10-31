import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const m=vi.hoisted(()=>({exchange:vi.fn(),get:vi.fn(),set:vi.fn(),delete:vi.fn(),has:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:m.get,set:m.set,delete:m.delete,has:m.has})}));
vi.mock('@/lib/auth/supabase',()=>({supabase:async()=>({auth:{exchangeCodeForSession:m.exchange}})}));
vi.mock('@/lib/security',()=>({appOrigin:()=> 'http://localhost:3000'}));
import {GET} from '@/app/auth/callback/route';
beforeEach(()=>{vi.resetAllMocks();});
it('never grants recovery context from a forged next parameter',async()=>{
 m.exchange.mockResolvedValue({data:{user:{id:'u'},session:{},redirectType:null},error:null});
 const r=await GET(new NextRequest('http://localhost:3000/auth/callback?code=test&next=/auth/reset-password&portal=platform'));
 expect(r.headers.get('location')).toContain('/auth/forgot-password?portal=platform&error=recovery');expect(m.set).not.toHaveBeenCalled();expect(m.delete).toHaveBeenCalledWith('recovery_user');
});
it('allows only SDK-confirmed PKCE recovery to establish recovery context',async()=>{
 m.exchange.mockResolvedValue({data:{user:{id:'u'},session:{},redirectType:'recovery'},error:null});
 const r=await GET(new NextRequest('http://localhost:3000/auth/callback?code=test&next=/platform'));
 expect(r.headers.get('location')).toBe('http://localhost:3000/auth/reset-password');expect(m.set).toHaveBeenCalledWith('recovery_user','u',expect.objectContaining({httpOnly:true,maxAge:600}));
});
it('blocks external redirect URLs after successful authentication',async()=>{
 m.exchange.mockResolvedValue({data:{user:{id:'u'},session:{},redirectType:null},error:null});
 const r=await GET(new NextRequest('http://localhost:3000/auth/callback?code=test&next=https://evil.example'));
 expect(r.headers.get('location')).toBe('http://localhost:3000/salon');
});
it('provider failure never establishes recovery context',async()=>{
 m.exchange.mockResolvedValue({data:{user:null,session:null},error:{code:'invalid'}});
 const r=await GET(new NextRequest('http://localhost:3000/auth/callback?code=test&next=/auth/reset-password'));
 expect(r.headers.get('location')).toContain('/auth/forgot-password');expect(m.set).not.toHaveBeenCalled();
});
