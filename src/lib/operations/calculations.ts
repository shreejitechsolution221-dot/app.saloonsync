import {createHash} from 'node:crypto';
export const messageKey=(...parts:string[])=>createHash('sha256').update(parts.join(':')).digest('hex');
export function basisPoints(value:FormDataEntryValue|null){const s=String(value??'');if(!/^\d{1,3}(\.\d{1,2})?$/.test(s))throw new Error('Enter a percentage with up to two decimal places.');const result=Math.round(Number(s)*100);if(result>10000)throw new Error('Percentage must be between 0 and 100.');return result;}
