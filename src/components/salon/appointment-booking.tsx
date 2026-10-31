'use client';

import {useState} from 'react';
import {ActionForm} from './forms';
import {AppointmentCustomer} from './appointment-customer';
import {createGroupAppointment,createGroupWalkIn} from '@/server/salon-actions';

type Branch={id:string;name:string};
type Service={id:string;name:string;durationMinutes:number;eligibleUserIds:string[];pricePaise?:number;category?:string};
type Employee={id:string;name:string;branchIds:string[]};
type Props={customers:{id:string;displayName:string;phone:string|null}[];services:Service[];staff:Employee[];branches:Branch[];initialTime:string;walkIn?:boolean};
export function AppointmentBooking(props:Props){
 const [people,setPeople]=useState([0]);
 const [nextId,setNextId]=useState(1);
 return <ActionForm action={props.walkIn?createGroupWalkIn:createGroupAppointment} submit={props.walkIn?'Check in walk-in':'Book appointment'} className="booking-form">
  <input type="hidden" name="personCount" value={people.length}/>
  <div className="booking-people">
  {people.map((key,index)=><fieldset key={key} className="booking-person"><legend>Person {index+1}</legend><Person {...props} index={index}/>{people.length>1&&<button type="button" className="secondary" onClick={()=>setPeople(current=>current.filter(id=>id!==key))}>Remove person</button>}</fieldset>)}
  </div>
  <div className="booking-footer">
   {people.length<10&&<button type="button" className="secondary" onClick={()=>{setPeople(current=>[...current,nextId]);setNextId(nextId+1);}}>+ Add another person</button>}
   {!props.walkIn&&<label className="field booking-repeat">Visits<input name="recurrenceCount" type="number" min={1} max={12} required defaultValue={1}/><small>Extra visits repeat weekly</small></label>}
   <p className="hint">All services are booked together.<br/>Availability is checked when you save.</p>
  </div>
 </ActionForm>;
}
function Person({customers,services,staff,branches,initialTime,index,walkIn}:Props&{index:number}){
 const [employee,setEmployee]=useState(staff.length===1?staff[0].id:'');
 const eligibleBranches=branches.filter(b=>staff.find(s=>s.id===employee)?.branchIds.includes(b.id));
 const [branch,setBranch]=useState(eligibleBranches[0]?.id??'');
 const [selectedServices,setSelectedServices]=useState<string[]>([]);
 const [time,setTime]=useState(initialTime);
 const prefix=`person.${index}.`;
 const minutes=selectedServices.reduce((sum,id)=>sum+(services.find(s=>s.id===id)?.durationMinutes??0),0);
 return <div className="booking-person-layout"><div className="booking-details">
  <AppointmentCustomer customers={customers} branches={branch?branches.filter(b=>b.id===branch):branches} name={prefix+'salonCustomerId'}/>
  <label className="field">Team member<select name={prefix+'assignedUserId'} required value={employee} onChange={event=>{const id=event.target.value;setEmployee(id);const available=branches.filter(b=>staff.find(s=>s.id===id)?.branchIds.includes(b.id));setBranch(available.some(b=>b.id===branch)?branch:available[0]?.id??'');setSelectedServices(current=>current.filter(serviceId=>{const s=services.find(s=>s.id===serviceId);return s&&(!s.eligibleUserIds.length||s.eligibleUserIds.includes(id));}));}}><option value="" disabled>Choose a team member</option>{staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
  {eligibleBranches.length<=1?<><input type="hidden" name={prefix+'branchId'} value={branch}/><p className="hint">Branch: {eligibleBranches[0]?.name??'Choose an employee to select their branch'}</p></>:<label className="field">Branch<select name={prefix+'branchId'} required value={branch} onChange={e=>setBranch(e.target.value)}>{eligibleBranches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
  {walkIn?<p className="hint">Walk-in starts at the next minute. Selected services run in order and appear in the checked-in queue.</p>:<label className="field">Date &amp; time (IST)<input name={prefix+'startsAt'} type="datetime-local" required value={time} onChange={e=>setTime(e.target.value)}/></label>}
  </div><div className="booking-service-section">
  <ServicePicker services={services.filter(s=>!employee||!s.eligibleUserIds.length||s.eligibleUserIds.includes(employee))} selected={selectedServices} onChange={setSelectedServices}/>
  {selectedServices.map(id=><input key={id} type="hidden" name={prefix+'serviceId'} value={id}/>)}
  <div className="booking-service-summary" aria-live="polite"><span>{selectedServices.length?`${selectedServices.length} selected · ${minutes} min`:'Choose services for this visit'}</span>{selectedServices.length>0&&<strong>{new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:0,maximumFractionDigits:2}).format(selectedServices.reduce((sum,id)=>sum+(services.find(s=>s.id===id)?.pricePaise??0),0)/100)}</strong>}<p>{selectedServices.length?selectedServices.map(id=>services.find(s=>s.id===id)?.name).join(' → '):'Select cards in the order the services should run.'}</p></div>
  </div></div>;
}
function ServicePicker({services,selected,onChange}:{services:Service[];selected:string[];onChange:(ids:string[])=>void}){
 const [query,setQuery]=useState('');
 const [page,setPage]=useState(0);
 const matches=services.filter(s=>`${s.name} ${s.category??''}`.toLowerCase().includes(query.toLowerCase()));
 const pages=Math.max(1,Math.ceil(matches.length/6));
 const current=Math.min(page,pages-1);
 return <fieldset className="booking-services"><legend>Services <span>Select one or more</span></legend>
  <label className="field"><span className="sr-only">Search services</span><input type="search" value={query} placeholder="Search hair, beard, facial…" onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label>
  <div className="booking-service-grid">{matches.slice(current*6,current*6+6).map(s=>{const position=selected.indexOf(s.id);return <label key={s.id} className={`booking-service-card${position>=0?' is-selected':''}`}><input type="checkbox" checked={position>=0} onChange={e=>onChange(e.target.checked?[...selected,s.id]:selected.filter(id=>id!==s.id))}/><span className="service-card-top"><span className="service-category">{s.category||'Salon service'}</span><span className="service-selection-mark" aria-hidden="true">{position>=0?position+1:'+'}</span></span><strong>{s.name}</strong><span className="service-card-bottom"><span>{s.durationMinutes} min</span>{s.pricePaise!==undefined&&<span>{new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:0,maximumFractionDigits:2}).format(s.pricePaise/100)}</span>}</span></label>;})}</div>
  {!matches.length&&<p className="hint">No matching services{query?'. Try another search.':' for this employee.'}</p>}
  {pages>1&&<div className="service-pagination"><span>{matches.length} services · {current+1} / {pages}</span><button type="button" className="secondary" aria-label="Previous services" disabled={current===0} onClick={()=>setPage(current-1)}>←</button><button type="button" className="secondary" aria-label="Next services" disabled={current===pages-1} onClick={()=>setPage(current+1)}>→</button></div>}
 </fieldset>;
}

