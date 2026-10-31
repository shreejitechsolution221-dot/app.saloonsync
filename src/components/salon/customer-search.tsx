'use client';
import {useEffect,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
export function CustomerSearch({initialQuery}:{initialQuery:string}){
 const router=useRouter();const [query,setQuery]=useState(initialQuery);const [pending,startTransition]=useTransition();const requested=useRef(initialQuery);const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(initialQuery!==requested.current){requested.current=initialQuery;setQuery(initialQuery);}},[initialQuery]);
 useEffect(()=>{
  const value=query.trim();if(value===initialQuery)return;
  const timer=setTimeout(()=>{requested.current=value;startTransition(()=>router.replace(value?`/salon/customers?${new URLSearchParams({q:value})}`:'/salon/customers',{scroll:false}));},300);
  return()=>clearTimeout(timer);
 },[query,initialQuery,router]);
 return <div className="customer-search customer-autosearch" role="search" aria-busy={pending}><span aria-hidden="true" className="customer-search-icon">⌕</span><input ref={input} type="search" aria-label="Search customers by name or phone" value={query} maxLength={120} placeholder="Search name or phone number…" onChange={e=>setQuery(e.target.value)}/>{pending&&<span className="ui-spinner" role="status" aria-label="Searching customers"/>}{query&&<button type="button" className="customer-search-clear" aria-label="Clear customer search" onClick={()=>{setQuery('');input.current?.focus();}}>×</button>}</div>;
}
