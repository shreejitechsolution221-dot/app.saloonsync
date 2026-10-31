import { expect,it,vi } from 'vitest';
const query=vi.hoisted(()=>vi.fn());vi.mock('@/lib/db',()=>({db:{$queryRaw:query}}));
import {registeredEmailExists} from '@/lib/auth/registered-email';
it('uses the provider registration record and returns only existence',async()=>{
  query.mockResolvedValue([{exists:true}]);expect(await registeredEmailExists('known@example.test')).toBe(true);
  expect(query.mock.calls[0][1]).toBe('known@example.test');
});
it('does not invent a match for absent or soft-deleted users',async()=>{
  query.mockResolvedValue([{exists:false}]);expect(await registeredEmailExists('unknown@example.test')).toBe(false);
  query.mockResolvedValue([]);expect(await registeredEmailExists('unknown@example.test')).toBe(false);
});
