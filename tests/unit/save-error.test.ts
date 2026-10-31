import {expect,it,vi,afterEach} from 'vitest';
import {saveError} from '@/lib/operations/save-error';
import {DomainError} from '@/lib/operations/errors';
afterEach(()=>vi.restoreAllMocks());
it('explains a live Prisma 7 overpayment rejection instead of a generic save failure',()=>{vi.spyOn(console,'error').mockImplementation(()=>{});expect(saveError({code:'P2039',meta:{driverAdapterError:{cause:{originalCode:'P0001',kind:'postgres',originalMessage:'Payment exceeds outstanding balance'}}}})).toContain('remaining balance');});
it('preserves business validation and suppresses database parameter values',()=>{const error=vi.spyOn(console,'error').mockImplementation(()=>{});expect(saveError(new DomainError('Choose a location.'))).toBe('Choose a location.');saveError({code:'P2039',meta:{driverAdapterError:{cause:{originalCode:'23503',kind:'postgres',originalMessage:'private account value'}}}});expect(error.mock.calls.flat().join('')).not.toContain('private account value');});
it('asks the user to verify existing records before retrying a timed-out save',()=>{vi.spyOn(console,'error').mockImplementation(()=>{});expect(saveError({code:'P2028'})).toContain('whether the bill was saved');});
