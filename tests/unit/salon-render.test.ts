import {it,expect,vi} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const mock=vi.hoisted(()=>({context:{user:{id:'owner',displayName:'Jamie Davis'},salonId:'salon',membership:{role:'owner',branchScope:'all',salon:{name:'The Studio'}},branches:[{id:'branch',name:'Main Studio'}],operator:true,administrator:true}}));
vi.mock('@/lib/salon/context',()=>({salonContext:async()=>mock.context,requireModule:async()=>mock.context,indiaDate:()=> '2026-10-29',dateRange:()=>({gte:new Date('2026-10-28T18:30:00Z'),lt:new Date('2026-10-29T18:30:00Z')})}));
vi.mock('@/server/salon-actions',()=>({createAppointment:vi.fn(),changeAppointment:vi.fn(),rescheduleAppointment:vi.fn()}));
vi.mock('@/server/auth-actions',()=>({logout:vi.fn()}));
vi.mock('@/components/auth/layout',()=>({Wordmark:()=>React.createElement('a',{className:'wordmark',href:'/'},'saloonsync.')}));
vi.mock('@/components/salon/forms',()=>({ActionForm:({children,submit}:{children:React.ReactNode;submit:string})=>React.createElement('form',{className:'studio-form'},children,React.createElement('button',{className:'primary'},submit)),CreatePanel:({label}:{label:string})=>React.createElement('button',{className:'primary'},'+ '+label),Field:()=>null}));
vi.mock('@/lib/db',()=>({db:{appointment:{findMany:async()=>[
{id:'a',assignedUserId:'jamie',startsAt:new Date('2026-10-29T03:30:00Z'),durationMinutes:60,serviceName:'Cut & finish',status:'confirmed',salonCustomer:{displayName:'Olivia Martin'}},
{id:'b',assignedUserId:'sarah',startsAt:new Date('2026-10-29T04:00:00Z'),durationMinutes:120,serviceName:'Balayage',status:'confirmed',salonCustomer:{displayName:'Emma Wilson'}},
{id:'c',assignedUserId:'alex',startsAt:new Date('2026-10-29T03:30:00Z'),durationMinutes:60,serviceName:'Cut & finish',status:'confirmed',salonCustomer:{displayName:'Sophia Davis'}},
{id:'d',assignedUserId:'jamie',startsAt:new Date('2026-10-29T05:00:00Z'),durationMinutes:45,serviceName:'Hair treatment',status:'checked_in',salonCustomer:{displayName:'Amelia Clark'}}]},salonMembership:{findMany:async()=>[{userId:'jamie',user:{displayName:'Jamie L.'}},{userId:'sarah',user:{displayName:'Sarah K.'}},{userId:'alex',user:{displayName:'Alex M.'}}]},salonCustomer:{findMany:async()=>[]},service:{findMany:async()=>[]}}}));
import Appointments from '@/app/salon/appointments/page';
import {db} from '@/lib/db';
async function resolve(node:unknown):Promise<unknown>{
 if(Array.isArray(node))return Promise.all(node.map(resolve));
 if(!React.isValidElement(node))return node;
 const element=node as React.ReactElement<Record<string,unknown>>;
 if(typeof element.type==='function'&&element.type.constructor.name==='AsyncFunction')return resolve(await (element.type as (props:unknown)=>Promise<unknown>)(element.props));
 const props={...element.props};for(const key of Object.keys(props))if(React.isValidElement(props[key])||Array.isArray(props[key]))props[key]=await resolve(props[key]);
 return React.cloneElement(element,props);
}
it('renders the reference calendar with scoped fixture data for visual review',async()=>{
 const customers=vi.spyOn(db.salonCustomer,'findMany');const services=vi.spyOn(db.service,'findMany');
 const tree=await resolve(await Appointments({searchParams:Promise.resolve({date:'2026-10-29'})}));
 expect(customers).not.toHaveBeenCalled();expect(services).not.toHaveBeenCalled();
 const html=renderToStaticMarkup(tree as React.ReactNode);expect(html).toContain('Olivia Martin');expect(html).toContain('calendar-column');expect(html).toContain('Appointments');
 await mkdir('.cache/preview',{recursive:true});const css=await readFile('src/app/globals.css','utf8');await writeFile('.cache/preview/calendar.html',`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body>${html}</body></html>`);
});
it('applies staff, service and time filters inside the scoped query and preserves them in navigation',async()=>{
 const find=vi.spyOn(db.appointment,'findMany');const staffId='11111111-1111-4111-8111-111111111111';
 const tree=await resolve(await Appointments({searchParams:Promise.resolve({date:'2026-10-29',staff:staffId,service:'Cut & finish',from:'09:00',to:'11:00'})}));
 expect(find.mock.calls[0]?.[0]).toMatchObject({where:{salonId:'salon',branchId:{in:['branch']},AND:[{assignedUserId:staffId},{serviceName:'Cut & finish'},{OR:[{startsAt:{gte:new Date('2026-10-29T03:30:00Z'),lt:new Date('2026-10-29T05:31:00Z')}}]}]}});
 const html=renderToStaticMarkup(tree as React.ReactNode);expect(html).toContain('Filter appointments');expect(html).toContain('from=09%3A00');expect(html).not.toContain('New / recurring booking');
});
