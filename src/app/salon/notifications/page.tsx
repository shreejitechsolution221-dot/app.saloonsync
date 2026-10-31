import {locationProducts} from '@/lib/operations/location-stock';
import {db} from '@/lib/db';
import {salonContext} from '@/lib/salon/context';
import {SalonShell,PageHeading} from '@/components/salon/shell';
import {NotificationsBoard,type UpdateItem} from '@/components/salon/notifications-board';
export const dynamic='force-dynamic';
export default async function Notifications(){
 const c=await salonContext();
 const managerial=['owner','admin','manager'].includes(c.membership.role);
 const stock=['owner','admin','inventory'].includes(c.membership.role)&&c.membership.branchScope==='all';
 const [visits,leave,products]=await Promise.all([
  db.appointment.findMany({where:{salonId:c.salonId,branchId:{in:c.branches.map(b=>b.id)},...(c.operator?{}:{assignedUserId:c.user.id}),updatedAt:{gte:new Date(Date.now()-24*3600000)}},select:{id:true,serviceName:true,status:true,startsAt:true},orderBy:{updatedAt:'desc'},take:30}),
  managerial?db.leaveRequest.count({where:{salonId:c.salonId,branchId:{in:c.branches.map(b=>b.id)},status:'pending',userId:{not:c.user.id}}}):Promise.resolve(0),
  stock?locationProducts(c,'',500):Promise.resolve([])
 ]);
 const items:UpdateItem[]=[];
 if(leave>0)items.push({id:'leave',category:'team',title:`${leave} leave ${leave===1?'request needs':'requests need'} review`,detail:'Your team is waiting for a decision. Review dates and approve or decline.',status:'Needs review',attention:true,href:'/salon/team/leave',action:'Review requests'});
 for(const p of products.filter(p=>p.stock<=p.reorderAt))items.push({id:'stock-'+p.id,category:'stock',title:p.name,detail:`${p.stock} units available · Reorder level ${p.reorderAt} units`,status:p.stock<=0?'Out of stock':'Low stock',attention:true,href:'/salon/inventory',action:'View inventory'});
 for(const v of visits)items.push({id:v.id,category:'bookings',title:v.serviceName,detail:'Scheduled for '+v.startsAt.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}),status:v.status.replaceAll('_',' '),attention:false,href:'/salon/appointments/visit/'+v.id,action:'Open visit'});
 return <SalonShell active="notifications"><PageHeading eyebrow="YOUR WORKSPACE, AT A GLANCE" title="Notifications" description="Booking activity and the things that need your attention."/><NotificationsBoard items={items} teamVisible={managerial} stockVisible={stock}/></SalonShell>;
}
