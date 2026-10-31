'use client';
import {useEffect,useState} from 'react';
import {ActionForm} from './forms';
import {changeAppointment} from '@/server/salon-actions';
import {transitions} from '@/lib/salon/validation';
import {earliestServiceStart,serviceStartMessage} from '@/lib/salon/booking-time';
const labels:Record<string,string>={checked_in:'Check in',in_service:'Start service',completed:'Complete service',cancelled:'Cancel appointment',no_show:'Mark no-show'};
export function VisitStatusActions({id,status,startsAt,operator}:{id:string;status:string;startsAt:string;operator:boolean}){
 const [now,setNow]=useState<number|null>(null);
 useEffect(()=>{setNow(Date.now());if(status!=='checked_in')return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[status]);
 const next=(transitions[status]??[]).filter(s=>operator||['in_service','completed'].includes(s));
 const tooEarly=now===null||now<earliestServiceStart(startsAt);
 return <><div className="visit-status-actions">{next.map(s=>s==='in_service'&&tooEarly?<button key={s} type="button" className="primary" disabled>Start service</button>:<ActionForm key={s} action={changeAppointment} submit={labels[s]} className={['cancelled','no_show'].includes(s)?'visit-danger-action':''}><input type="hidden" name="id" value={id}/><input type="hidden" name="status" value={s}/></ActionForm>)}</div>{status==='checked_in'&&tooEarly&&<p className="hint">{serviceStartMessage(startsAt)}</p>}{!next.length&&<p className="hint">{['completed','cancelled','no_show'].includes(status)?'This visit is closed. Its details remain available below.':'No status actions are available for your role.'}</p>}</>;
}
