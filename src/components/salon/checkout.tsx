'use client';
import {useActionState,useRef,useState,useTransition} from 'react';
import {AppointmentCustomer} from './appointment-customer';
import {createDirectBill} from '@/server/direct-bill';
import {retailSale} from '@/server/retail';
import {verifyLoyaltyCode} from '@/server/loyalty-checkout';
import type {FormState} from '@/server/auth-actions';

export type CheckoutItem={id:string;name:string;pricePaise:number;stock?:number;sku?:string;barcode?:string|null};
export type CheckoutCustomer={id:string;displayName:string;phone:string|null;points:number};
export type CheckoutProps={kind:'service'|'product';branches:{id:string;name:string}[];customers:CheckoutCustomer[];items:CheckoutItem[];taxBps:number};
const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(n/100);
function ItemPicker({items,value,onChange,label}:{items:CheckoutItem[];value:string;onChange:(id:string)=>void;label:string}){
 const [query,setQuery]=useState('');const [open,setOpen]=useState(false);const input=useRef<HTMLInputElement>(null);
 const selected=items.find(i=>i.id===value);
 const matches=items.filter(i=>(i.name+' '+(i.sku??'')+' '+(i.barcode??'')).toLowerCase().includes(query.toLowerCase())).slice(0,12);
 return <div className="checkout-picker"><label className="field">{label}<input ref={input} type="search" value={selected?selected.name:query} required placeholder={`Search ${label.toLowerCase()}…`} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);onChange('');setOpen(true);e.target.setCustomValidity('Select an item from the results.');}}/></label>{open&&!selected&&<div className="checkout-results" role="group" aria-label={`${label} search results`}>{matches.map(item=><button type="button" key={item.id} onClick={()=>{onChange(item.id);setQuery('');setOpen(false);input.current?.setCustomValidity('');}}><span>{item.name}<small>{item.sku}{item.stock!==undefined?` · ${item.stock} in stock`:''}</small></span><strong>{money(item.pricePaise)}</strong></button>)}{!matches.length&&<p>No matching items.</p>}</div>}</div>;
}
export function Checkout(props:CheckoutProps){const [version,setVersion]=useState(0);return <CheckoutDraft key={version} {...props} onNew={()=>setVersion(v=>v+1)}/>;}
function CheckoutDraft({kind,branches,customers,items,taxBps,onNew}:CheckoutProps&{onNew:()=>void}){
 const [state,dispatch,pending]=useActionState<FormState,FormData>(kind==='product'?retailSale:createDirectBill,{});
 const nextId=useRef(1);const [lines,setLines]=useState([{key:0,id:'',quantity:'1'}]);
 const [customer,setCustomer]=useState<{id:string;displayName:string}|null>(null);const [guest,setGuest]=useState(false);
 const [discount,setDiscount]=useState('0');const [code,setCode]=useState('');
 const [verified,setVerified]=useState<{code:string;customerId:string;points:number}|null>(null);const [loyaltyError,setLoyaltyError]=useState('');const [checking,startCheck]=useTransition();
 const customerId=customer?.id??'';const points=customers.find(c=>c.id===customerId)?.points??0;
 const applied=verified?.code===code&&verified.customerId===customerId?verified.points:0;
 const subtotal=lines.reduce((n,l)=>n+(items.find(i=>i.id===l.id)?.pricePaise??0)*Number(l.quantity||0),0);
 const manual=Math.round(Number(discount||0)*100),net=Math.max(0,subtotal-manual-applied*100),tax=Math.round(net*taxBps/10000);
 function update(key:number,patch:{id?:string;quantity?:string}){setLines(current=>current.map(l=>l.key===key?{...l,...patch}:l));}
 function verify(){setLoyaltyError('');startCheck(async()=>{try{const result=await verifyLoyaltyCode(customerId,code);if(result.error){setVerified(null);setLoyaltyError(result.error);}else setVerified({code,customerId,points:result.points??0});}catch{setLoyaltyError('Unable to verify this code. Try again.');}});}
 if(state.link&&!state.error)return <div className="checkout-success" role="status"><span>✓</span><h3>{state.message}</h3><p>Invoice, payment and loyalty changes have been saved together.</p><a className="primary" href={state.link}>View / print bill ↗</a><button className="secondary" type="button" onClick={onNew}>Start a new bill</button></div>;
 return <form action={dispatch} className="studio-form checkout-form"><fieldset disabled={pending}>
  <div className="bill-form-grid"><label className="field">Billing location<select name="branchId" required>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label className="checkout-guest"><input type="checkbox" checked={guest} onChange={e=>{setGuest(e.target.checked);setCustomer(null);setVerified(null);setCode('');}}/> Unregistered walk-in customer</label></div>
  {guest?<label className="field">Customer name<input name="customerName" defaultValue="Walk-in customer" required maxLength={120}/></label>:<AppointmentCustomer customers={customers} branches={branches} name="customerId" onSelect={value=>{setCustomer(value);setVerified(null);setCode('');}}/>}
  <div className="bill-section-label">{kind==='product'?'PRODUCTS':'SERVICES & CHARGES'}<span>Prices from your catalogue</span></div>
  {lines.map((line,index)=>{const item=items.find(i=>i.id===line.id);return <div className="checkout-line" key={line.key}>
   <ItemPicker items={items} value={line.id} label={`${kind==='product'?'Product':'Service'} ${index+1}`} onChange={id=>update(line.key,{id})}/>
   <input type="hidden" name={kind==='product'?'productId':'serviceId'} value={line.id}/>
   {kind==='service'&&<><input type="hidden" name="description" value={item?.name??''}/><input type="hidden" name="unitRupees" value={(item?.pricePaise??0)/100}/></>}
   <div className="checkout-line-values"><label className="field">Quantity<input name="quantity" type="number" required min="1" max={kind==='product'?Math.min(1000,item?.stock??1000):1000} value={line.quantity} onChange={e=>update(line.key,{quantity:e.target.value})}/></label><div><small>Unit price</small><strong>{money(item?.pricePaise??0)}</strong></div><div><small>Line total</small><strong>{money((item?.pricePaise??0)*Number(line.quantity||0))}</strong></div><button type="button" className="bill-remove" disabled={lines.length===1} aria-label={`Remove ${kind} ${index+1}`} onClick={()=>setLines(current=>current.filter(l=>l.key!==line.key))}>×</button></div>
  </div>;})}
  <button type="button" className="secondary bill-add" disabled={lines.length>=30} onClick={()=>{const key=nextId.current++;setLines(current=>[...current,{key,id:'',quantity:'1'}]);}}>+ Add {kind==='product'?'product':'service'}</button>
  <section className="checkout-loyalty"><div><strong>Loyalty rewards</strong><span>{customer?`${points.toLocaleString('en-IN')} points available · 1 point = ₹1`:'Select a registered customer to use loyalty points'}</span></div><div className="checkout-code"><label className="field">Redemption code<input value={code} disabled={!customer||checking} maxLength={40} placeholder="Enter customer’s code" onChange={e=>{setCode(e.target.value.toUpperCase());setVerified(null);setLoyaltyError('');}}/></label><button className="secondary" type="button" disabled={!customer||!code||checking} onClick={verify}>{checking?'Checking…':'Apply code'}</button></div><input type="hidden" name="loyaltyCode" value={applied?code:''}/>{loyaltyError&&<p className="status error" role="alert">{loyaltyError}</p>}{applied>0&&<p className="status" role="status">Code verified · {applied} points = {money(applied*100)} discount. <button type="button" className="link-button" onClick={()=>{setVerified(null);setCode('');}}>Remove</button></p>}</section>
  <div className="bill-form-grid"><label className="field">Additional discount (₹)<input name="discountRupees" type="number" min="0" max={Math.max(0,subtotal/100-applied)} step="0.01" required value={discount} onChange={e=>setDiscount(e.target.value)}/></label><label className="field">Record payment<select name="method"><option value="unpaid">Not paid — collect later</option><option value="cash">Paid in full · Cash</option><option value="upi">Paid in full · UPI</option><option value="card">Paid in full · Card</option><option value="transfer">Paid in full · Bank transfer</option></select></label></div>
  <div className="bill-total" aria-live="polite"><p><span>Subtotal</span><span>{money(subtotal)}</span></p><p><span>Additional discount</span><span>− {money(manual)}</span></p><p><span>Loyalty discount ({applied} points)</span><span>− {money(applied*100)}</span></p><p><span>Tax ({taxBps/100}%)</span><span>{money(tax)}</span></p><strong><span>Total payable</span><span>{money(net+tax)}</span></strong></div>
  {manual+applied*100>subtotal&&<p className="status error">Discounts cannot exceed the subtotal. Use a code for fewer points.</p>}
  <p className="hint">Record payment after receiving the full amount. Points, stock and payment records are saved with the invoice.</p>
  {state.error&&<p role="alert" className="status error">{state.error}</p>}
  <button className="primary" disabled={pending||checking||manual+applied*100>subtotal} aria-busy={pending}>{pending?'Saving…':kind==='product'?'Create product invoice':'Create walk-in bill'}</button>
 </fieldset></form>;
}
