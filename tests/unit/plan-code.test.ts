import {expect,it} from 'vitest';
import {parseRecord} from '@/lib/platform/validation';
function plan(code:string){const form=new FormData();for(const [key,value] of Object.entries({id:'',version:'0',kind:'plan',title:'Temporary Starter',status:'draft',salonId:'',assigneeId:'',code,pricePaise:'0',branchLimit:'1',staffLimit:'5',trialDays:'14',graceDays:'7',entitlements:'online_booking'}))form.set(key,value);return form;}
it.each(['temp-starter','pro-monthly','plan_2','plan.v1'])('accepts plan code %s while retaining a display name with spaces and capitals',code=>{
 const parsed=parseRecord(plan(code));expect(parsed.title).toBe('Temporary Starter');expect(parsed.payload.code).toBe(code);
});
it.each(['Temporary Starter','Starter','1starter','x','a'.repeat(81)])('explains which field needs changing for invalid plan code %s',code=>{
 expect(()=>parseRecord(plan(code))).toThrow('Plan code must start with a lowercase letter');expect(()=>parseRecord(plan(code))).toThrow('temp-starter');
});
