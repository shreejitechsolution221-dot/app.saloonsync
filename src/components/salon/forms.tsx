'use client';
import { useActionState, useId, useRef } from 'react';
import type { FormState } from '@/server/auth-actions';
export function ActionForm({action,children,submit='Save',className=''}:{action:(state:FormState,form:FormData)=>Promise<FormState>;children?:React.ReactNode;submit?:string;className?:string}) {
 const [state,dispatch,pending]=useActionState(action,{});
 return <form action={dispatch} className={`studio-form ${className}`}>{children}{state.error&&<p role="alert" className="status error">{state.error}</p>}{state.message&&<p role="status" className="status">{state.message}</p>}{state.link?.startsWith('/salon/billing/receipt/')&&<a className="secondary" href={state.link}>View / print bill ↗</a>}<button className="primary" disabled={pending} aria-busy={pending}>{pending?'Saving…':submit}</button></form>;
}
export function CreatePanel({label,title,children}:{label:string;title:string;children:React.ReactNode}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const titleId=useId();
 return <><button type="button" className="primary" onClick={()=>dialog.current?.showModal()}>+ {label}</button><dialog className="studio-dialog" ref={dialog} aria-labelledby={titleId}><div className="dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" aria-label="Close dialog" onClick={()=>dialog.current?.close()}>×</button></div>{children}</dialog></>;
}
export function Field({name,label,type='text',required=true,value,min,max}:{name:string;label:string;type?:string;required?:boolean;value?:string|number;min?:number;max?:number}) {return <label className="field">{label}<input name={name} type={type} required={required} defaultValue={value} min={min} max={max} step={(name.endsWith('Rupees')||name.endsWith('Percent'))?'0.01':undefined} maxLength={type==='text'?120:undefined}/></label>;}
