import 'server-only';
import {db} from '@/lib/db';
import type {Context} from '@/lib/operations/shared';
import type {TeamEmployee,TeamLogin} from './team-types';
export async function teamManagement(c:Context){
 const profilePromise=db.staffProfile.findMany({where:{salonId:c.salonId},select:{id:true,userId:true,displayName:true,jobTitle:true,commissionBps:true,active:true},orderBy:{displayName:'asc'},take:200});
 const invitationPromise=profilePromise.then(profiles=>profiles.length?db.invitation.findMany({where:{salonId:c.salonId,staffProfileId:{in:profiles.map(p=>p.id)}},select:{staffProfileId:true,intendedEmail:true,role:true,branchScope:true,expiresAt:true,acceptedAt:true,revokedAt:true,branches:{select:{branchId:true}}},orderBy:{createdAt:'desc'},take:1000}):[]);
 const [members,profiles,invitations]=await Promise.all([
  db.salonMembership.findMany({where:{salonId:c.salonId,status:{in:['active','suspended','revoked','invited']}},select:{id:true,userId:true,status:true,role:true,branchScope:true,user:{select:{displayName:true,disabledAt:true}},branches:{select:{branchId:true,branch:{select:{name:true}}}}},take:200}),
  profilePromise,invitationPromise,
 ]);
 const inviteByProfile=new Map<string,typeof invitations[number]>();for(const invite of invitations)if(invite.staffProfileId&&!inviteByProfile.has(invite.staffProfileId))inviteByProfile.set(invite.staffProfileId,invite);
 const memberByUser=new Map(members.map(member=>[member.userId,member]));const linked=new Set(profiles.flatMap(p=>p.userId?[p.userId]:[]));
 const employees:TeamEmployee[]=profiles.map(profile=>{
  const member=profile.userId?memberByUser.get(profile.userId):undefined;const invite=inviteByProfile.get(profile.id);const pending=!profile.userId&&invite&&!invite.revokedAt&&!invite.acceptedAt;
  const branchScope=member?.branchScope??invite?.branchScope??'all';const branchIds=member?.branches.map(b=>b.branchId)??invite?.branches.map(b=>b.branchId)??[];
  return {id:profile.id,profileId:profile.id,membershipId:member?.id??null,userId:profile.userId,name:profile.displayName,jobTitle:profile.jobTitle,commissionBps:profile.commissionBps,active:profile.active&&(!profile.userId||member?.status==='active')&&!member?.user.disabledAt,disabled:Boolean(member?.user.disabledAt),role:member?.role??invite?.role??null,membershipStatus:member?.status??null,branchScope,branchIds,locations:branchScope==='all'?['All locations']:c.availableBranches.filter(b=>branchIds.includes(b.id)).map(b=>b.name),invitationEmail:invite?.intendedEmail??null,invitationStatus:pending?(invite.expiresAt.getTime()>Date.now()?'pending':'expired'):'none'};
 });
 for(const member of members)if(!linked.has(member.userId))employees.push({id:member.id,profileId:null,membershipId:member.id,userId:member.userId,name:member.user.displayName,jobTitle:'Workspace teammate',commissionBps:0,active:member.status==='active'&&!member.user.disabledAt,disabled:Boolean(member.user.disabledAt),role:member.role,membershipStatus:member.status,branchScope:member.branchScope,branchIds:member.branches.map(b=>b.branchId),locations:member.branchScope==='all'?['All locations']:member.branches.map(b=>b.branch.name),invitationEmail:null,invitationStatus:'none'});
 const logins:TeamLogin[]=members.filter(m=>m.status==='active'&&!m.user.disabledAt).map(m=>({id:m.userId,name:m.user.displayName,linked:linked.has(m.userId)}));
 return {employees,logins};
}
