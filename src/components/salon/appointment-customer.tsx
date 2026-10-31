'use client';

import {useRef,useState,useTransition} from 'react';
import {addCustomer} from '@/server/salon-actions';

type Option={id:string;displayName:string;phone?:string|null};
export function AppointmentCustomer({customers,branches,name:fieldName='salonCustomerId',onSelect}:{customers:Option[];branches:{id:string;name:string}[];name?:string;onSelect?:(customer:Option|null)=>void}) {
 const [created,setCreated]=useState<Option[]>([]);
 const [selected,setSelected]=useState('');
 const [adding,setAdding]=useState(false);
 const [name,setName]=useState('');
 const [phone,setPhone]=useState('');
 const [notes,setNotes]=useState('');
 const [branchId,setBranchId]=useState(branches[0]?.id??'');
 const effectiveBranchId=branches.some(b=>b.id===branchId)?branchId:branches[0]?.id??'';
 const [error,setError]=useState('');
 const [pending,startTransition]=useTransition();
 const [query,setQuery]=useState('');
 const [limit,setLimit]=useState(8);
 const search=useRef<HTMLInputElement>(null);
 const options=[...customers,...created.filter(x=>!customers.some(c=>c.id===x.id))].sort((a,b)=>a.displayName.localeCompare(b.displayName));
 const digits=query.replace(/\D/g,'');
 const matches=options.filter(x=>x.displayName.toLowerCase().includes(query.toLowerCase())||Boolean(digits&&(x.phone??'').replace(/\D/g,'').includes(digits)));
 function choose(customer:Option){setSelected(customer.id);setQuery(`${customer.displayName}${customer.phone?' · '+customer.phone:''}`);setAdding(false);search.current?.setCustomValidity('');onSelect?.(customer);}
 function save(){
  if(name.trim().length<2){setError('Enter a full name with at least 2 characters.');return;}
  const data=new FormData();
  data.set('displayName',name);data.set('phone',phone);data.set('notes',notes);data.set('branchId',effectiveBranchId);
  setError('');
  startTransition(async()=>{
   try {
    const result=await addCustomer({},data);
    if(result.error){setError(result.error);return;}
    if('customer' in result&&result.customer){const customer={...result.customer,phone};setCreated(current=>[...current,customer]);choose(customer);setName('');setPhone('');setNotes('');}
   } catch {setError('Unable to add customer. Please try again.');}
  });
 }
 return <>
  <input type="hidden" name={fieldName} value={adding?'':selected}/>
  <label className="field">Customer<input ref={search} type="search" required value={query} placeholder="Search by name or phone number" disabled={pending} onChange={event=>{setQuery(event.target.value);setSelected('');onSelect?.(null);setLimit(8);event.target.setCustomValidity('Choose a customer from the search results.');}}/></label>
  {!selected&&!adding&&query.trim()&&<div className="customer-search-results"><div role="group" aria-label="Matching customers">{matches.slice(0,limit).map(x=><button key={x.id} type="button" className="customer-search-result" onClick={()=>choose(x)}><strong>{x.displayName}</strong><span>{x.phone||'No phone number'}</span></button>)}</div>{!matches.length&&<p className="hint">No matching customers.</p>}{matches.length>limit&&<button type="button" className="secondary" onClick={()=>setLimit(limit+8)}>Show more customers</button>}</div>}
  <button type="button" className="secondary" disabled={pending} onClick={()=>{setAdding(true);setError('');search.current?.setCustomValidity('Save the new customer before booking.');}}>+ Add customer</button>
  {adding&&<fieldset className="studio-form" disabled={pending} style={{border:'1px solid var(--studio-line)',borderRadius:8,padding:16}}><legend>Add customer</legend>
   <label className="field">Full name<input value={name} onChange={e=>setName(e.target.value)} maxLength={120} autoComplete="name"/></label>
   <label className="field">Phone (optional)<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} maxLength={30} autoComplete="tel"/></label>
   <label className="field">Customer’s first location<select value={effectiveBranchId} onChange={e=>setBranchId(e.target.value)}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
   <label className="field">Preferences &amp; notes (optional)<textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={2000}/></label>
   {error&&<p role="alert" className="status error">{error}</p>}
   <div style={{display:'flex',gap:8}}><button type="button" className="primary" onClick={save} disabled={pending} aria-busy={pending}>{pending?'Adding…':'Add customer'}</button><button type="button" className="secondary" disabled={pending} onClick={()=>{setAdding(false);search.current?.setCustomValidity(selected?'':'Choose a customer from the search results.');}}>Cancel</button></div>
  </fieldset>}
 </>;
}
