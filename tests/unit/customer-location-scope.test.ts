import {expect,it} from 'vitest';
import {customerScope} from '@/lib/operations/customer-scope';
const salon='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',a='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',b='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const context={salonId:salon,membership:{branchScope:'selected'},selectedBranchId:a,branches:[{id:a}],availableBranches:[{id:a},{id:b}]};
it('customer lists use only the selected authorized location',()=>{expect(customerScope(context as never)).toEqual({salonId:salon,OR:[{originBranchId:{in:[a]}},{bookings:{some:{branchId:{in:[a]}}}}]});});
it('write authorization uses current membership branches, not a client-selected resource ID',()=>{expect(customerScope(context as never,true)).toEqual({salonId:salon,OR:[{originBranchId:{in:[a,b]}},{bookings:{some:{branchId:{in:[a,b]}}}}]});});
it('an all-location role can access its own salon but never drops the tenant predicate',()=>{expect(customerScope({...context,membership:{branchScope:'all'}} as never,true)).toEqual({salonId:salon});});
