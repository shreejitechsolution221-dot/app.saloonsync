import {z} from 'zod';
export function optionalCommissionRate(value:FormDataEntryValue|null){
 if(value===null||value==='')return null;
 const amount=z.string().regex(/^\d{1,3}(\.\d{1,2})?$/,'Enter a commission percentage with up to two decimal places.').parse(value);
 return z.number().int().min(0).max(10000).parse(Math.round(Number(amount)*100));
}
export function commissionRate(serviceRate:number|null|undefined,staffRate:number|null|undefined){return serviceRate??staffRate??0;}
