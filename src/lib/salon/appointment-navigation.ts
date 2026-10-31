import {parseAppointmentFilters} from './appointment-filters';
export function appointmentBackUrl(id:string,startsAt:Date|string,returnTo?:string){
 const fallback=new Date(new Date(startsAt).getTime()+330*60000).toISOString().slice(0,10);
 let date=fallback,view='day';let filters:Record<string,string>={};
 if(returnTo?.startsWith('/salon/appointments?')){
  const url=new URL(returnTo,'https://saloonsync.invalid');
  if(url.origin==='https://saloonsync.invalid'&&url.pathname==='/salon/appointments'){
   const requested=url.searchParams.get('date');
   if(requested&&/^\d{4}-\d{2}-\d{2}$/.test(requested)&&Number.isFinite(new Date(requested).getTime()))date=requested;
   const requestedView=url.searchParams.get('view');if(requestedView&&['day','week','list'].includes(requestedView))view=requestedView;
   filters=Object.fromEntries(Object.entries(parseAppointmentFilters({staff:url.searchParams.get('staff')??'',service:url.searchParams.get('service')??'',from:url.searchParams.get('from')??'',to:url.searchParams.get('to')??''})).filter(([,value])=>value));
  }
 }
 return `/salon/appointments?${new URLSearchParams({date,view,...filters,appointment:id})}`;
}
