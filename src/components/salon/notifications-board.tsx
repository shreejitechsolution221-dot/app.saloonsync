'use client';
import {useState,useTransition} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
export type UpdateItem={id:string;category:'bookings'|'team'|'stock';title:string;detail:string;status:string;attention:boolean;href:string;action:string};
const labels={bookings:'Bookings',team:'Team',stock:'Stock'};
export function NotificationsBoard({items,teamVisible,stockVisible}:{items:UpdateItem[];teamVisible:boolean;stockVisible:boolean}){
 const [category,setCategory]=useState('all');const [query,setQuery]=useState('');const [attention,setAttention]=useState(false);
 const router=useRouter();const [pending,startTransition]=useTransition();
 const categories=['all','bookings',...(teamVisible?['team']:[]),...(stockVisible?['stock']:[])];
 const filtered=items.filter(item=>(category==='all'||item.category===category)&&(!attention||item.attention)&&`${item.title} ${item.detail} ${item.status}`.toLowerCase().includes(query.trim().toLowerCase()));
 const needsAttention=items.filter(item=>item.attention).length;
 return <section className="notifications-workspace" aria-label="Workspace updates">
  <div className="updates-summary"><div><span className="updates-orbit" aria-hidden="true">✧</span><div><p className="eyebrow">THE LATEST FROM YOUR SALON</p><h2>{needsAttention?`${needsAttention} ${needsAttention===1?'item needs':'items need'} attention`:'You’re all caught up on alerts'}</h2><p>Booking changes from the last 24 hours. Current team and stock alerts.</p></div></div><button type="button" className="secondary" disabled={pending} onClick={()=>startTransition(()=>router.refresh())}>{pending?'Refreshing…':'↻ Refresh'}</button></div>
  <div className="updates-controls"><div className="updates-tabs" role="group" aria-label="Filter updates">{categories.map(key=><button key={key} type="button" aria-pressed={category===key} onClick={()=>setCategory(key)}>{key==='all'?'All updates':labels[key as keyof typeof labels]}<span>{items.filter(item=>key==='all'||item.category===key).length}</span></button>)}</div><div className="updates-search"><input type="search" aria-label="Search notifications" placeholder="Search updates…" value={query} onChange={e=>setQuery(e.target.value)}/><label><input type="checkbox" checked={attention} onChange={e=>setAttention(e.target.checked)}/>Needs attention</label></div></div>
  <div className="updates-list-heading"><span>{category==='all'?'YOUR UPDATES':labels[category as keyof typeof labels].toUpperCase()}</span><span role="status" aria-live="polite">{filtered.length} {filtered.length===1?'update':'updates'}</span></div>
  <div className="updates-feed">{filtered.length?filtered.map(item=><article key={item.id} className={`update-card update-${item.category}`}><span className="update-icon" aria-hidden="true">{item.category==='bookings'?'◷':item.category==='team'?'♧':'▦'}</span><div className="update-copy"><div className="update-meta"><span>{labels[item.category]}</span><span className={item.attention?'update-status attention':'update-status'}>{item.status}</span></div><h3>{item.title}</h3><p>{item.detail}</p></div><Link className="update-action" href={item.href} aria-label={`${item.action}: ${item.title}`}>{item.action}<span aria-hidden="true">↗</span></Link></article>):<div className="updates-empty"><span aria-hidden="true">✧</span><h3>{query||attention||category!=='all'?'No matching updates':'A quiet moment'}</h3><p>{query||attention||category!=='all'?'Try another category or clear your filters.':'New booking activity and alerts will appear here.'}</p>{(query||attention||category!=='all')&&<button className="secondary" type="button" onClick={()=>{setQuery('');setAttention(false);setCategory('all');}}>Clear filters</button>}</div>}</div>
 </section>;
}
