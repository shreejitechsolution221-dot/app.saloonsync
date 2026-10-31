'use client';

import {useEffect,useId,useRef,useState,useTransition,type CSSProperties,type ReactNode} from 'react';
import {changeAppointment,rescheduleAppointment,completeServiceTimer} from '@/server/salon-actions';
import {transitions} from '@/lib/salon/validation';
import {ActionForm,Field} from './forms';
import {earliestServiceStart,serviceStartMessage} from '@/lib/salon/booking-time';
import {appointmentBackUrl} from '@/lib/salon/appointment-navigation';

export type PopupAppointment={id:string;status:string;customerName:string;serviceName:string;startsAt:string;durationMinutes:number;staffName:string;branchName:string;phone?:string|null;pricePaise?:number;serviceStartedAt?:string|null;returnTo?:string};
const labels:Record<string,string>={checked_in:'Check in',in_service:'Start service',completed:'Complete service',cancelled:'Cancel appointment',no_show:'Mark no-show'};
export function AppointmentPopup({booking,operator,children,className,style,openOnLoad=false}:{booking:PopupAppointment;operator:boolean;children:ReactNode;className?:string;style?:CSSProperties;openOnLoad?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null);
 const title=useId();
 const openedOnLoad=useRef(false);
 useEffect(()=>{if(openOnLoad&&!openedOnLoad.current&&dialog.current){openedOnLoad.current=true;dialog.current.showModal();}},[openOnLoad]);
 const [status,setStatus]=useState(booking.status);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [pending,startTransition]=useTransition();
 const [startedAt,setStartedAt]=useState(booking.serviceStartedAt??null);
 const [now,setNow]=useState<number|null>(null);
 const attemptedEnd=useRef<number|null>(null);
 useEffect(()=>setStatus(booking.status),[booking.status]);
 useEffect(()=>{if(booking.serviceStartedAt)setStartedAt(booking.serviceStartedAt);},[booking.serviceStartedAt]);
 const endsAt=startedAt?new Date(startedAt).getTime()+booking.durationMinutes*60000:null;
 const remaining=endsAt!==null&&now!==null?Math.max(0,Math.ceil((endsAt-now)/1000)):null;
 useEffect(()=>{if(!['checked_in','in_service'].includes(status))return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[status]);
 const startTooEarly=now===null||now<earliestServiceStart(booking.startsAt);
 useEffect(()=>{
  if(status!=='in_service'||remaining!==0||endsAt===null||pending||attemptedEnd.current===endsAt)return;
  attemptedEnd.current=endsAt;
  startTransition(async()=>{
   const form=new FormData();form.set('id',booking.id);
   try{const result=await completeServiceTimer({},form);if(result.error){setError(result.error);return;}if(result.completed){setStatus('completed');setMessage('Service completed automatically.');}else{setError('Service time has finished. Use Complete service to review and finish.');}}
   catch{setError('Automatic completion could not connect. You can complete the service manually.');}
  });
 },[status,remaining,endsAt,pending,booking.id]);
 const next=(transitions[status]??[]).filter(s=>operator||['in_service','completed'].includes(s));
 function update(nextStatus:string){
  const form=new FormData();form.set('id',booking.id);form.set('status',nextStatus);setError('');setMessage('');
  startTransition(async()=>{
   try{const result=await changeAppointment({},form);if(result.error){setError(result.error);return;}if(nextStatus==='in_service'){setStartedAt(('serviceStartedAt' in result&&result.serviceStartedAt)||new Date().toISOString());setNow(Date.now());attemptedEnd.current=null;}setStatus(nextStatus);setMessage('Appointment updated.');}
   catch{setError('Unable to update the appointment. Please try again.');}
  });
 }
 return <>
  <button type="button" className={`appointment-trigger ${className??''}`} style={style} aria-haspopup="dialog" aria-label={`Open appointment for ${booking.customerName}`} onClick={()=>{setError('');setMessage('');dialog.current?.showModal();}}>{children}</button>
  <dialog className="studio-dialog appointment-popup" ref={dialog} aria-labelledby={title} onClick={event=>{if(event.target===dialog.current){const box=dialog.current.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.current.close();}}}>
   <div className="dialog-heading"><div><p className="eyebrow">APPOINTMENT DETAILS</p><h2 id={title}>{booking.customerName}</h2></div><button type="button" aria-label="Close appointment" onClick={()=>dialog.current?.close()}>×</button></div>
   <span className={`state-pill ${status}`} aria-live="polite">{status.replaceAll('_',' ')}</span>
   {status==='in_service'&&<div className="service-running-timer"><div><span>Service in progress</span><strong aria-label="Time remaining">{remaining===null?'—':`${Math.floor(remaining/60).toString().padStart(2,'0')}:${(remaining%60).toString().padStart(2,'0')}`}</strong></div><p>{remaining===0?'Service time finished. Checking completion…':'Completes automatically when the timer ends. You can also complete it below.'}</p></div>}
   <dl className="appointment-popup-details"><div><dt>Service</dt><dd>{booking.serviceName}</dd></div><div><dt>Date &amp; time (IST)</dt><dd>{new Date(booking.startsAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</dd></div><div><dt>Duration</dt><dd>{booking.durationMinutes} min</dd></div><div><dt>Team member</dt><dd>{booking.staffName}</dd></div><div><dt>Branch</dt><dd>{booking.branchName}</dd></div>{booking.phone&&<div><dt>Phone</dt><dd><a href={`tel:${booking.phone}`}>{booking.phone}</a></dd></div>}{booking.pricePaise!==undefined&&<div><dt>Price</dt><dd>{new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(booking.pricePaise/100)}</dd></div>}</dl>
   {error&&<p className="status error" role="alert">{error}</p>}{message&&<p className="status" role="status">{message}</p>}
   {status==='checked_in'&&startTooEarly&&<p className="hint" role="status">{serviceStartMessage(booking.startsAt)}</p>}
   {next.length>0&&<div className="appointment-popup-actions" aria-label="Appointment actions">{next.map(s=><button type="button" key={s} className={['cancelled','no_show'].includes(s)?'secondary appointment-destructive':'primary'} disabled={pending||(s==='in_service'&&startTooEarly)} aria-busy={pending} onClick={()=>update(s)}>{labels[s]??s.replaceAll('_',' ')}</button>)}</div>}
   {operator&&['confirmed','checked_in'].includes(status)&&<details className="appointment-reschedule"><summary>Reschedule appointment</summary><ActionForm action={rescheduleAppointment} submit="Save new time"><input type="hidden" name="id" value={booking.id}/><Field name="startsAt" label="New date & time (IST)" type="datetime-local" value={new Date(new Date(booking.startsAt).getTime()+330*60000).toISOString().slice(0,16)}/></ActionForm></details>}
   {!next.length&&<p className="hint">{['completed','cancelled','no_show'].includes(status)?'This appointment has no further status actions.':'No status actions are available for your role.'}</p>}
   <a className="appointment-full-details" href={`/salon/appointments/visit/${booking.id}?${new URLSearchParams({returnTo:appointmentBackUrl(booking.id,booking.startsAt,booking.returnTo)})}`}>Open full visit &amp; service checklist ↗</a>
  </dialog>
 </>;
}
