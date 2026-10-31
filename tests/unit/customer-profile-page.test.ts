import {expect,it,vi} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const m=vi.hoisted(()=>({find:vi.fn(),visits:vi.fn(),loyalty:vi.fn(),context:{salonId:'salon',branches:[{id:'branch'}],availableBranches:[{id:'branch'}],membership:{branchScope:'all',salon:{name:'Micasa Saloon'}},administrator:true}}));
vi.mock('@/lib/db',()=>({db:{salonCustomer:{findFirst:m.find},appointment:{findMany:m.visits},loyaltyAccount:{findUnique:m.loyalty},portfolioPhoto:{findMany:async()=>[]}}}));
vi.mock('@/lib/salon/context',()=>({requireOperations:async()=>m.context,money:(value:number)=>'₹'+(value/100).toLocaleString('en-IN')}));
vi.mock('@/server/growth-inventory',()=>({updateCustomerDetails:vi.fn(),queueCustomerMessage:vi.fn()}));
vi.mock('@/server/portfolio',()=>({uploadPortfolio:vi.fn()}));
vi.mock('@/components/salon/forms',()=>({ActionForm:({children,submit}:{children:React.ReactNode;submit:string})=>React.createElement('form',{className:'studio-form'},children,React.createElement('button',{className:'primary'},submit)),Field:({name,label,type='text',value,required}:{name:string;label:string;type:string;value:string;required:boolean})=>React.createElement('label',{className:'field'},label,React.createElement('input',{name,type,defaultValue:value,required}))}));
vi.mock('@/components/salon/shell',()=>({SalonShell:({children}:{children:React.ReactNode})=>React.createElement('div',{className:'studio-app'},React.createElement('aside',{className:'studio-sidebar'},'Micasa Saloon'),React.createElement('div',{className:'studio-main'},React.createElement('header',{className:'studio-topbar'},'Workspace / Customers'),React.createElement('main',{},children),React.createElement('footer',{className:'studio-footer'},'Saloonsync'))),PageHeading:({eyebrow,title,description,action}:{eyebrow:string;title:string;description:string;action:React.ReactNode})=>React.createElement('div',{className:'studio-heading'},React.createElement('div',{},React.createElement('p',{className:'eyebrow'},eyebrow),React.createElement('h1',{},title),React.createElement('p',{},description)),action)}));
import CustomerProfile from '@/app/salon/customers/profile/[customerId]/page';
const id='73ad7404-7a47-4561-a333-1855d2c86f28';
it('keeps history and profile editing in a redesigned profile without directory navigation tabs',async()=>{
 m.find.mockResolvedValue({id,displayName:'Olivia Martin',phone:'+919876543210',notes:'Gentle wash. Keep a natural finish.',tags:['Regular','Sensitive scalp'],birthday:new Date('1995-08-15'),whatsappConsentAt:new Date(),marketingConsentAt:new Date(),photoConsentAt:null});
 m.visits.mockResolvedValue([{id:'visit',startsAt:new Date('2026-10-25T04:30:00Z'),status:'completed',serviceName:'Haircut & finish',pricePaise:65000},{id:'next',startsAt:new Date('2026-11-01T04:30:00Z'),status:'confirmed',serviceName:'Hair spa',pricePaise:90000}]);
 m.loyalty.mockResolvedValue({points:180,membershipName:'Gold member',referralCode:'OLIVIA26'});
 const html=renderToStaticMarkup(await CustomerProfile({params:Promise.resolve({customerId:id})}));
 for(const text of ['Olivia Martin','Edit profile','Visit history','Haircut &amp; finish','Gold member','OLIVIA26','Service portfolio','whatsappConsent','marketingConsent','photoConsent'])expect(html).toContain(text);
 expect(html).not.toContain('module-tabs');expect(html).not.toContain('Retention &amp; rebooking');expect(html).toContain('side-panel');
 expect(m.visits).toHaveBeenCalledWith(expect.objectContaining({where:{salonId:'salon',salonCustomerId:id,branchId:{in:['branch']}}}));
 await mkdir('.cache/preview/business',{recursive:true});await writeFile('.cache/preview/business/CustomerProfile.html',`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${await readFile('src/app/globals.css','utf8')}</style></head><body>${html}</body></html>`);
});

