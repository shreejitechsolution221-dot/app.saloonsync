import {z} from 'zod';
export type AppointmentFilterQuery={staff?:string;service?:string;from?:string;to?:string};
export function parseAppointmentFilters(query:AppointmentFilterQuery){
 const time=(value?:string)=>value&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value)?value:'';
 return {staff:query.staff==='unassigned'||z.uuid().safeParse(query.staff).success?query.staff!:'',service:query.service?.trim().slice(0,200)??'',from:time(query.from),to:time(query.to)};
}
export function appointmentTimeRanges(start:Date,days:number,from:string,to:string){
 if(!from&&!to)return [];
 const minutes=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3));
 const first=from?minutes(from):0,last=to?minutes(to)+1:1440;
 if(first>=last)return [{startsAt:{gte:start,lt:start}}];
 return Array.from({length:days},(_,index)=>({startsAt:{gte:new Date(start.getTime()+(index*1440+first)*60000),lt:new Date(start.getTime()+(index*1440+last)*60000)}}));
}
