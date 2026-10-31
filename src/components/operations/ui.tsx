import {Children} from 'react';
import {NavigationLink} from '@/components/salon/navigation-link';
const sections:Record<string,readonly (readonly [string,string])[]>={
 overview:[['','Today'],['/dashboard/insights','Insights & targets'],['/dashboard/tasks','Daily checklist']],
 appointments:[['','Calendar'],['/queue','Live queue'],['/walk-in','Walk-in'],['/no-shows','No-shows']],
 customers:[['','Directory'],['/retention','Retention & rebooking'],['/loyalty','Loyalty & memberships']],
 team:[['','People'],['/attendance','Attendance'],['/leave','Leave requests'],['/performance','Performance']],
 billing:[['','Invoices & payments'],['/pos','Product POS'],['/expenses','Expenses'],['/cash','Cash register'],['/refunds','Refunds']],
 inventory:[['','Products'],['/purchases','Purchases'],['/suppliers','Suppliers'],['/movements','Stock movements'],['/usage','Service stock usage']],
 marketing:[['','Campaigns'],['/offers','Offers & gift cards'],['/feedback','Feedback']],
 settings:[['','Business'],['/profile','My profile'],['/locations','Locations'],['/access','Access'],['/tasks','Task templates'],['/integrations','Integrations & delivery']],
 reports:[['','Business reports'],['/export','Exports']],
};
export function ModuleTabs({module,active='',allowed}:{module:string;active?:string;allowed?:string[]}){const base=module==='overview'?'/salon':`/salon/${module}`;return <nav className="module-tabs" aria-label={`${module} sections`}>{(sections[module]??[]).filter(([path])=>!allowed||allowed.includes(path)).map(([path,label])=><NavigationLink key={path} href={base+path} aria-current={active===path?'page':undefined} warm={active!==path&&path!=='/new'&&path!=='/export'}>{label}</NavigationLink>)}</nav>;}
export function Metric({label,value,note}:{label:string;value:string|number;note?:string}){return <section className="metric-card"><p>{label}</p><strong>{value}</strong>{note&&<small>{note}</small>}</section>;}
export function Status({value}:{value:string}){return <span className={`state-pill ${value}`}>{value.replaceAll('_',' ')}</span>;}
export function Panel({title,description,children}:{title:string;description?:string;children:React.ReactNode}){return <section className="studio-panel"><div className="panel-intro"><h2>{title}</h2>{description&&<p className="muted">{description}</p>}</div>{Children.toArray(children).length?children:<div className="studio-empty"><span aria-hidden="true">✧</span><h3>A fresh start.</h3><p>Records will appear here as your team adds them.</p></div>}</section>;}
export function Select({name,label,options,empty,value,required=true}:{name:string;label:string;options:{id:string;name:string}[];empty?:string;value?:string;required?:boolean}){return <label className="field">{label}<select name={name} required={required} defaultValue={value??(empty?'':undefined)}>{empty&&<option value="">{empty}</option>}{options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>;}
export function MoneyMethod(){return <Select name="method" label="Payment method" options={['cash','upi','card','transfer'].map(id=>({id,name:id.toUpperCase()}))}/>;}

