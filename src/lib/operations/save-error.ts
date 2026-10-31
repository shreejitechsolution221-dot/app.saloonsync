import 'server-only';
import {z} from 'zod';
import {DomainError} from './errors';
export function saveError(error:unknown,operation='operations.write'){
 if(error instanceof DomainError)return error.message;
 if(error instanceof z.ZodError)return error.issues[0]?.message??'Check the entered details.';
 const e=error as {code?:string;meta?:{driverAdapterError?:{cause?:{originalCode?:string;kind?:string;originalMessage?:string}}}};
 const driver=e?.meta?.driverAdapterError?.cause;
 const safe=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9_.-]{1,80}$/.test(value)?value:undefined;
 console.error(JSON.stringify({event:'operations.save_failed',operation:safe(operation),code:safe(e?.code),sqlState:safe(driver?.originalCode),kind:safe(driver?.kind)}));
 if(e?.code==='P2028'||e?.code==='P1001'||e?.code==='P1002'||driver?.originalCode==='57014')return 'The connection timed out. Refresh to check whether the bill was saved before trying again.';
 if(e?.code==='P2002'||driver?.originalCode==='23505')return 'This record already exists. Refresh the page to see the latest records.';
 if(driver?.originalMessage==='Payment exceeds outstanding balance')return 'The amount exceeds the remaining balance. Refresh the invoice and enter the outstanding amount.';
 if(e?.code==='P2003'||driver?.originalCode==='23503')return 'A linked record is unavailable. Refresh and select the customer or invoice again.';
 if(driver?.originalCode==='42501')return 'Your salon’s billing setup needs administrator attention. No changes were saved.';
 return 'Unable to save this record. Please refresh the page and try again.';
}
