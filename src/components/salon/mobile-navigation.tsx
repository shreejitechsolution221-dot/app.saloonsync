'use client';
import {NavigationLink} from './navigation-link';
import {usePathname} from 'next/navigation';
import {Icon} from './icons';
const nav:Record<string,[string,string,string][]>= {
 owner:[['','Home','overview'],['/appointments','Bookings','calendar'],['/customers','Customers','people'],['/reports','Reports','overview'],['/more','More','settings']],
 manager:[['','Home','overview'],['/appointments','Bookings','calendar'],['/customers','Customers','people'],['/team','Team','people'],['/more','More','settings']],
 receptionist:[['','Home','overview'],['/appointments','Bookings','calendar'],['/appointments/queue','Check-in','people'],['/customers','Customers','people'],['/billing','Billing','card']],
 staff:[['','Home','overview'],['/appointments','My bookings','calendar'],['/team/attendance','Attendance','people'],['/team/performance','Performance','overview'],['/settings/profile','Profile','settings']],
 inventory:[['','Home','overview'],['/inventory','Products','box'],['/inventory/purchases','Purchases','card'],['/reports','Reports','overview'],['/settings/profile','Profile','settings']],
 accountant:[['','Home','overview'],['/billing','Invoices','card'],['/billing/cash','Cash','card'],['/reports','Reports','overview'],['/settings/profile','Profile','settings']],
 cashier:[['','Home','overview'],['/billing/pos','POS','card'],['/billing','Invoices','card'],['/billing/cash','Cash','card'],['/settings/profile','Profile','settings']],
};
export function MobileNavigation({role}:{role:string}){const path=usePathname()??'';const items=nav[role==='admin'?'owner':role]??[];const active=items.map(([part])=>'/salon'+part).filter(href=>path===href||href!=='/salon'&&path.startsWith(href+'/')).sort((a,b)=>b.length-a.length)[0];return <nav className="mobile-bottom-nav" aria-label="Quick navigation">{items.map(([part,label,icon])=><NavigationLink warm={path!=='/salon'+part} key={part} href={'/salon'+part} aria-current={active==='/salon'+part?'page':undefined}><Icon name={icon}/>{label}</NavigationLink>)}</nav>;}
