import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({members:vi.fn(),leave:vi.fn(),shifts:vi.fn(),orders:vi.fn(),lines:vi.fn(),suppliers:vi.fn(),products:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{salonMembership:{findMany:m.members},leaveRequest:{findMany:m.leave},shift:{findMany:m.shifts},purchaseOrder:{findMany:m.orders},purchaseLine:{findMany:m.lines},supplier:{findMany:m.suppliers},product:{findMany:m.products}}}));
vi.mock('@/lib/salon/context',()=>{
 const c={salonId:'salon',user:{id:'user',displayName:'Member'},membership:{role:'owner',branchScope:'all'},administrator:true,branches:[{id:'branch',name:'Branch'}]};
 return {requireModule:async()=>c,requireOperations:async()=>c,money:String};
});
vi.mock('@/server/operations',()=>({requestLeave:vi.fn(),reviewLeave:vi.fn(),attendanceAction:vi.fn(),addShift:vi.fn(),addStaffProfile:vi.fn(),updateStaffProfile:vi.fn(),cancelShift:vi.fn()}));
vi.mock('@/server/growth-inventory',()=>({addSupplier:vi.fn(),requestPurchase:vi.fn(),reviewPurchase:vi.fn(),receivePurchase:vi.fn(),saveRecipe:vi.fn()}));
vi.mock('@/components/salon/shell',()=>({SalonShell:()=>null,PageHeading:()=>null}));
vi.mock('@/components/salon/forms',()=>({ActionForm:()=>null,Field:()=>null}));
vi.mock('@/components/operations/ui',()=>({ModuleTabs:()=>null,Panel:()=>null,Select:()=>null,Status:()=>null,Metric:()=>null}));
import TeamSection from '@/app/salon/team/[section]/page';
import InventorySection from '@/app/salon/inventory/[section]/page';
beforeEach(()=>{vi.resetAllMocks();for(const query of Object.values(m))query.mockResolvedValue([]);});
it.each(['leave','schedule'])('starts %s data while the independent authorized member selector is pending',async(section)=>{
 let release!:(rows:unknown[])=>void;let started!:()=>void;
 const called=new Promise<void>(resolve=>{started=resolve;});
 m.members.mockImplementation(()=>new Promise(resolve=>{release=resolve;}));
 const query=section==='leave'?m.leave:m.shifts;query.mockImplementation(async()=>{started();return [];});
 const page=TeamSection({params:Promise.resolve({section})});
 await called;expect(query).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({salonId:'salon',branchId:{in:['branch']}})}));
 release([]);await page;
});
it('loads purchase lines without waiting for unrelated supplier selection',async()=>{
 let release!:(rows:unknown[])=>void;let started!:()=>void;
 const called=new Promise<void>(resolve=>{started=resolve;});
 m.suppliers.mockImplementation(()=>new Promise(resolve=>{release=resolve;}));
 m.orders.mockResolvedValue([{id:'order'}]);
 m.lines.mockImplementation(async()=>{started();return [];});
 const page=InventorySection({params:Promise.resolve({section:'purchases'})});
 await called;expect(m.lines).toHaveBeenCalledWith(expect.objectContaining({where:{salonId:'salon',orderId:{in:['order']}}}));
 release([]);await page;
});
