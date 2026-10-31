'use server';
import {randomBytes,createHash} from 'node:crypto';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {invalidateSalonLayout} from '@/lib/salon/layout-data';
import {db} from '@/lib/db';
import {requireModule} from '@/lib/salon/context';
import {canInvite} from '@/lib/authorization/policy';
import {requireSameOrigin,rateLimit,appOrigin} from '@/lib/security';
import {basisPoints} from '@/lib/operations/calculations';
import {DomainError,audit,type Context} from '@/lib/operations/shared';
import {invitationSchema} from '@/lib/validation/auth';
import {emailPolicyError,assertSignupEmail} from '@/lib/email/signup-policy';
import {sendInvitationEmail} from '@/lib/email/invitations';
import type {Prisma} from '@/generated/prisma/client';
import type {FormState} from './auth-actions';
async function administrator(tx:Prisma.TransactionClient,c:Context){
 await tx.$queryRaw`SELECT id FROM app."Salon" WHERE id=${c.salonId}::uuid FOR UPDATE`;
 const actor=await tx.salonMembership.findUnique({where:{salonId_userId:{salonId:c.salonId,userId:c.user.id}},include:{user:true,salon:true}});
 if(!actor||!['owner','admin'].includes(actor.role)||actor.branchScope!=='all'||actor.status!=='active'||actor.user.disabledAt||actor.salon.status!=='active')throw new DomainError('All-location administrator access is required.');
 return actor;
}
async function saveTeammate(form:FormData,existingProfile=false):Promise<FormState>{
 try{
  await requireSameOrigin();const c=await requireModule('team');if(!c.administrator||c.membership.branchScope!=='all')throw new DomainError('All-location administrator access is required.');await rateLimit('teammate-create',c.user.id,30);
  const mode=existingProfile?'invite':z.enum(['invite','existing','profile']).parse(form.get('accessMode'));
  const invitation=mode==='invite'?invitationSchema.parse({...Object.fromEntries(form),salonId:c.salonId,branches:form.getAll('branches')}):null;
  const origin=invitation?appOrigin():null;
  if(invitation){const error=emailPolicyError(invitation.email);if(error)throw new DomainError(error);try{await assertSignupEmail(invitation.email);}catch(error){throw new DomainError(error instanceof Error?error.message:'Check the invitation email address.');}}
  const token=invitation?randomBytes(32).toString('base64url'):null;
  const result=await db.$transaction(async tx=>{
   const actor=await administrator(tx,c);
   if(invitation&&!canInvite(actor.role,invitation.role))throw new DomainError('Your role cannot invite this role.');
   if(invitation?.branchScope==='selected'&&await tx.branch.count({where:{salonId:c.salonId,status:'active',id:{in:[...new Set(invitation.branches)]}}})!==new Set(invitation.branches).size)throw new DomainError('Choose active locations in this salon.');
   const userId=mode==='existing'?z.uuid().parse(form.get('userId')):null;
   if(userId){if(!await tx.salonMembership.findFirst({where:{salonId:c.salonId,userId,status:'active',user:{disabledAt:null}}}))throw new DomainError('Choose an active workspace login.');if(await tx.staffProfile.findFirst({where:{salonId:c.salonId,userId}}))throw new DomainError('This login already has an employee profile. Edit that profile instead.');}
   const profile=existingProfile?await tx.staffProfile.findFirst({where:{id:z.uuid().parse(form.get('profileId')),salonId:c.salonId,active:true,userId:null}}):await tx.staffProfile.create({data:{salonId:c.salonId,userId,displayName:z.string().trim().min(2).max(120).parse(form.get('displayName')),jobTitle:z.string().trim().min(2).max(100).parse(form.get('jobTitle')),commissionBps:basisPoints(form.get('commissionPercent')??'0')}});
   if(!profile)throw new DomainError('Choose an active employee without a linked login.');
   if(existingProfile){const previous=await tx.invitation.findFirst({where:{salonId:c.salonId,staffProfileId:profile.id,acceptedAt:null,revokedAt:null}});if(previous&&!canInvite(actor.role,previous.role))throw new DomainError('Only a higher-access administrator can replace this invitation.');}
   let invitationId:string|null=null;
   if(invitation){
    const pending=await tx.invitation.findFirst({where:{salonId:c.salonId,intendedEmail:invitation.email,acceptedAt:null,revokedAt:null,expiresAt:{gt:new Date()},OR:[{staffProfileId:null},{staffProfileId:{not:profile.id}}]}});if(pending)throw new DomainError('This email already has a pending invitation. Manage that teammate instead.');
    await tx.invitation.updateMany({where:{salonId:c.salonId,staffProfileId:profile.id,acceptedAt:null,revokedAt:null},data:{revokedAt:new Date()}});
    const row=await tx.invitation.create({data:{salonId:c.salonId,staffProfileId:profile.id,intendedEmail:invitation.email,role:invitation.role,branchScope:invitation.branchScope,tokenHash:createHash('sha256').update(token!).digest('hex'),invitedBy:c.user.id,expiresAt:new Date(Date.now()+72*3600000)}});invitationId=row.id;
    if(invitation.branchScope==='selected')await tx.invitationBranchAccess.createMany({data:[...new Set(invitation.branches)].map(branchId=>({invitationId:row.id,salonId:c.salonId,branchId}))});
    await audit(tx,c,'invitation.created',row.id,{staffProfileId:profile.id});
   }
   await audit(tx,c,existingProfile?'employee.invited':'employee.created',profile.id,{accessMode:mode});return {invitationId};
  });
  await invalidateSalonLayout(c.salonId);
  revalidatePath('/salon','layout');
  if(!invitation)return {message:'Teammate profile created.'};
  const link=`${origin}/salon/invitations/accept#token=${token}`;
  const sent=form.get('emailDelivery')==='on'&&await sendInvitationEmail(invitation.email,link,result.invitationId!);
  return {message:sent?'Teammate saved. Invitation accepted by the email service; expires in 72 hours.':'Teammate saved. Share this invitation privately with the intended recipient; expires in 72 hours.',link};
 }catch(error){return {error:error instanceof DomainError?error.message:error instanceof z.ZodError?error.issues[0]?.message:'Unable to save this teammate. Check the details, email and permissions.'};}
}
export async function createTeammate(_:FormState,form:FormData){return saveTeammate(form);}
export async function inviteExistingTeammate(_:FormState,form:FormData){return saveTeammate(form,true);}
export async function setTeammateActive(_:FormState,form:FormData):Promise<FormState>{
 try{
  await requireSameOrigin();const c=await requireModule('team');if(!c.administrator||c.membership.branchScope!=='all')throw new DomainError('All-location administrator access is required.');await rateLimit('teammate-status',c.user.id,60);
  const active=z.enum(['true','false']).parse(form.get('active'))==='true';if(form.get('confirm')!=='on')throw new DomainError('Confirm this teammate change.');
  await db.$transaction(async tx=>{
   const actor=await administrator(tx,c);
   const profile=form.get('profileId')?await tx.staffProfile.findFirst({where:{id:z.uuid().parse(form.get('profileId')),salonId:c.salonId}}):null;
   if(form.get('profileId')&&!profile)throw new DomainError('Employee profile is unavailable.');
   const member=profile?.userId?await tx.salonMembership.findUnique({where:{salonId_userId:{salonId:c.salonId,userId:profile.userId}},include:{user:true}}):form.get('membershipId')?await tx.salonMembership.findFirst({where:{id:z.uuid().parse(form.get('membershipId')),salonId:c.salonId},include:{user:true}}):null;
   if(!profile&&!member)throw new DomainError('Teammate is unavailable.');
   if(profile?.userId&&!member)throw new DomainError('The linked workspace login is unavailable. Refresh and try again.');
   if(profile&&!member){const pending=await tx.invitation.findFirst({where:{salonId:c.salonId,staffProfileId:profile.id,acceptedAt:null,revokedAt:null}});if(pending&&!canInvite(actor.role,pending.role))throw new DomainError('Your role cannot manage this teammate’s invitation.');}
   if(member&&(member.userId===c.user.id||member.role==='owner'||!canInvite(actor.role,member.role)))throw new DomainError('You cannot remove or restore this member. The owner and your own account are protected.');
   if(active&&member?.user.disabledAt)throw new DomainError('This account is disabled. Contact platform support before restoring access.');
   if(active&&member&&!['active','suspended'].includes(member.status))throw new DomainError('This login needs a new invitation before workspace access can be granted.');
   if(!active&&member){
    const visits=await tx.appointment.count({where:{salonId:c.salonId,assignedUserId:member.userId,status:{in:['confirmed','checked_in','in_service']},OR:[{startsAt:{gte:new Date()}},{status:{in:['checked_in','in_service']}}]}});if(visits)throw new DomainError('Reassign or finish this teammate’s upcoming and active appointments before removing them.');
    if(await tx.attendance.count({where:{salonId:c.salonId,userId:member.userId,clockedOutAt:null}}))throw new DomainError('Clock this teammate out before removing them.');
    await tx.shift.updateMany({where:{salonId:c.salonId,userId:member.userId,cancelledAt:null,endsAt:{gte:new Date()}},data:{cancelledAt:new Date()}});
   }
   if(member){await tx.salonMembership.update({where:{id:member.id},data:{status:active?'active':'suspended'}});await tx.staffProfile.updateMany({where:{salonId:c.salonId,userId:member.userId},data:{active}});}
   else if(profile)await tx.staffProfile.updateMany({where:{id:profile.id,salonId:c.salonId},data:{active}});
   if(!active&&profile)await tx.invitation.updateMany({where:{salonId:c.salonId,staffProfileId:profile.id,acceptedAt:null,revokedAt:null},data:{revokedAt:new Date()}});
   await audit(tx,c,active?'employee.restored':'employee.removed',profile?.id??member!.id);
  });
  await invalidateSalonLayout(c.salonId);
  revalidatePath('/salon','layout');return {message:active?'Teammate restored.':'Teammate removed from the active team. History is preserved.'};
 }catch(error){return {error:error instanceof DomainError?error.message:'Unable to update this teammate. Check your permissions and try again.'};}
}
