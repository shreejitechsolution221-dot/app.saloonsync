export function nextBookingTime(now:number,openingHour:number,closingHour:number){
 const step=15*60000;
 const local=new Date(Math.ceil((now+5*60000)/step)*step+330*60000);
 if(local.getUTCHours()<openingHour)local.setUTCHours(openingHour,0,0,0);
 else if(local.getUTCHours()>=closingHour){local.setUTCDate(local.getUTCDate()+1);local.setUTCHours(openingHour,0,0,0);}
 return local.toISOString().slice(0,16);
}
export function earliestServiceStart(startsAt:Date|string){return new Date(startsAt).getTime()-15*60000;}
export function serviceStartMessage(startsAt:Date|string){
 return `This service can start from ${new Date(earliestServiceStart(startsAt)).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})} IST (15 minutes before the appointment).`;
}
