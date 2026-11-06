import { beforeEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({ready:vi.fn(),salon:vi.fn(),flag:vi.fn()}));
vi.mock('@/lib/platform/schema-ready',()=>({checkPlatformSchema:m.ready}));
vi.mock('@/lib/db',()=>({db:{salon:{findUnique:m.salon},platformRecord:{findUnique:m.flag}}}));
import {platformFeatureEnabled} from '@/lib/platform/features';
beforeEach(()=>{vi.resetAllMocks();m.ready.mockResolvedValue(true);m.salon.mockResolvedValue({settings:{platformRolloutGroup:'early'},subscription:{planCode:'pro'}});});
it('preserves existing behavior without querying the new table before migration',async()=>{
 m.ready.mockResolvedValue(false);expect(await platformFeatureEnabled('salon','online_booking')).toBe(true);expect(m.flag).not.toHaveBeenCalled();
});
it('looks up the indexed feature key and enforces a matching disabled flag',async()=>{
 m.flag.mockResolvedValue({salonId:'salon',status:'disabled',payload:{percentage:100}});expect(await platformFeatureEnabled('salon','online_booking')).toBe(false);expect(m.flag).toHaveBeenCalledWith(expect.objectContaining({where:{key:'flag:online_booking'}}));
});
it('does not apply another salon or plan rollout to this tenant',async()=>{
 m.flag.mockResolvedValue({salonId:'other',status:'disabled',payload:{percentage:100}});expect(await platformFeatureEnabled('salon','online_booking')).toBe(true);
 m.flag.mockResolvedValue({salonId:null,status:'disabled',payload:{planCode:'enterprise',percentage:100}});expect(await platformFeatureEnabled('salon','online_booking')).toBe(true);
});
it('enables a matching plan and rollout group at full rollout',async()=>{
 m.flag.mockResolvedValue({salonId:null,status:'enabled',payload:{planCode:'pro',group:'early',percentage:100}});expect(await platformFeatureEnabled('salon','online_booking')).toBe(true);
});
