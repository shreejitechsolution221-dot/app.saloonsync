import 'server-only';
import {withDatabaseTiming} from '@/lib/performance/database-timing';
import {saveError} from './save-error';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {unstable_rethrow} from 'next/navigation';
import {db} from '@/lib/db';
import {requireSameOrigin,rateLimit} from '@/lib/security';
import {salonContext} from '@/lib/salon/context';
import type {FormState} from '@/server/auth-actions';
import type {Prisma} from '@/generated/prisma/client';
import {DomainError} from './errors';
import {getSalonLayoutData} from '@/lib/salon/layout-data';

export {DomainError} from './errors';
export type Context=Awaited<ReturnType<typeof salonContext>>;
export const id=(f:FormData,key='id')=>z.uuid().parse(f.get(key));
export const text=(f:FormData,key:string,max=200)=>z.string().trim().min(1).max(max).parse(f.get(key));
export function paise(value:FormDataEntryValue|null){const s=z.string().regex(/^\d{1,7}(\.\d{1,2})?$/,'Enter a valid amount with up to two decimal places.').parse(value);return Math.round(Number(s)*100);}
export function localTime(value:FormDataEntryValue|null){const local=z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).parse(value);const date=z.coerce.date().parse(local+':00+05:30');if(new Date(date.getTime()+330*60000).toISOString().slice(0,16)!==local)throw new DomainError('Choose a valid date and time.');return date;}
export function requireRoles(c:Context,roles:readonly string[],all=false){if(!roles.includes(c.membership.role)||(all&&c.membership.branchScope!=='all'))throw new DomainError('Your role does not have permission for this action.');}
export function branch(f:FormData,c:Context){const value=id(f,'branchId');if(!c.branches.some(b=>b.id===value))throw new DomainError('Choose a location you can access.');return value;}
export const businessRoles=['owner','admin'] as const;
export const financeRoles=['owner','admin','accountant'] as const;
export const teamRoles=['owner','admin','manager'] as const;
export const frontDeskRoles=['owner','admin','manager','receptionist'] as const;
export const stockRoles=['owner','admin','inventory'] as const;
export async function perform(work:(c:Context)=>Promise<void>,options?:{paths:string[];operation?:string}):Promise<FormState>{
 return withDatabaseTiming(options?.operation??'operations.write',async()=>{try{await requireSameOrigin();const c=await salonContext();await rateLimit('operations-write',c.user.id,100);await work(c);if(options){for(const path of options.paths)revalidatePath(path,'page');}else revalidatePath('/salon','layout');return {message:'Saved successfully.'};}
 catch(error){unstable_rethrow(error);return {error:saveError(error,options?.operation)};}});
}
export {audit} from './audit';
export {cashLock} from './finance-locks';
export async function staffAt(tx:Prisma.TransactionClient,c:Context,userId:string,branchId:string){const row=await tx.salonMembership.findFirst({where:{salonId:c.salonId,userId,role:{in:['owner','admin','manager','staff']},status:'active',user:{disabledAt:null},OR:[{branchScope:'all'},{branches:{some:{branchId}}}]}});if(!row)throw new DomainError('Choose an active team member assigned to this location.');return row;}
export {settingsSchema,settings} from '@/lib/salon/layout-data';
export async function getSettings(c:Context){const layout=await getSalonLayoutData(c.salonId);return layout.settings;}
