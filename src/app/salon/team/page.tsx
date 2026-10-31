import {measuredPage} from '@/lib/performance/database-timing';
import {ModuleTabs} from '@/components/operations/ui';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {requireModule} from '@/lib/salon/context';
import {SalonShell,PageHeading} from '@/components/salon/shell';
import {TeamManagement} from '@/components/salon/team-management';
import {TeamRoster} from '@/components/salon/team-roster';
export const dynamic='force-dynamic';
async function Team(){
 const c=await requireModule('team');if(c.membership.role==='staff')redirect('/salon/team/attendance');const manage=c.administrator&&c.membership.branchScope==='all';if(manage)return <TeamManagement context={c}/>;
 const members=await db.salonMembership.findMany({where:{salonId:c.salonId,status:'active',user:{disabledAt:null},OR:[{branchScope:'all'},{branches:{some:{branchId:{in:c.branches.map(b=>b.id)}}}}]},select:{id:true,userId:true,role:true,branchScope:true,user:{select:{displayName:true}},branches:{select:{branchId:true,branch:{select:{name:true}}}}},take:100});
 return <SalonShell active="team"><PageHeading eyebrow="THE PEOPLE BEHIND YOUR CRAFT" title="A great team. A beautiful rhythm." description="Your people, their locations and the work you do together."/><ModuleTabs module="team"/><div className="studio-content team-workspace"><div className="team-stat-strip"><div><small>Active teammates</small><strong>{members.length}</strong><span>Up to 100 people shown</span></div><div><small>Service team</small><strong>{members.filter(m=>['owner','admin','manager','staff'].includes(m.role)).length}</strong><span>People behind each appointment</span></div><div><small>Locations in view</small><strong>{c.branches.length}</strong><span>Working together across your salon</span></div></div><TeamRoster members={members.map(m=>({id:m.id,name:m.user.displayName,role:m.role,locations:m.branchScope==='all'?['All locations']:m.branches.map(b=>b.branch.name)}))}/></div></SalonShell>;
}

export default measuredPage("team",Team);
