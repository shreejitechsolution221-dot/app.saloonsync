import Link from 'next/link';
export function BillingStats({items}:{items:{label:string;value:string|number;note:string}[]}){
 return <div className="billing-stats">{items.map(item=><div className="billing-stat" key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.note}</small></div>)}</div>;
}
export function BillingIntro({title,description}:{title:string;description:string}){
 return <div className="billing-intro"><div><p className="eyebrow">THE BUSINESS SIDE, SIMPLIFIED</p><h2>{title}</h2><p>{description}</p></div><Link className="secondary" href="/salon/billing#direct-bill">+ Direct walk-in bill</Link></div>;
}
