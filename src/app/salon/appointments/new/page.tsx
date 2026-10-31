import {AppointmentBooking} from '@/components/salon/appointment-booking';
import {customerScope} from '@/lib/operations/customer-scope';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {requireModule} from '@/lib/salon/context';
import {getSettings} from '@/lib/operations/shared';
import {nextBookingTime} from '@/lib/salon/booking-time';
import {SalonShell,PageHeading} from '@/components/salon/shell';
export const dynamic='force-dynamic';
export default async function NewAppointment(){
 const c=await requireModule('appointments');
 if(!c.operator)redirect('/salon/access-denied');
 const [customers,services,staff,rules]=await Promise.all([
  db.salonCustomer.findMany({where:customerScope(c,true),select:{id:true,displayName:true,phone:true},orderBy:{displayName:'asc'},take:500}),
  db.service.findMany({where:{salonId:c.salonId,active:true},select:{id:true,name:true,durationMinutes:true,eligibleUserIds:true,pricePaise:true,category:true},orderBy:{name:'asc'},take:200}),
  db.salonMembership.findMany({where:{salonId:c.salonId,role:{in:['owner','admin','manager','staff']},status:'active',user:{disabledAt:null},OR:[{branchScope:'all'},{branches:{some:{branchId:{in:c.branches.map(b=>b.id)}}}}]},select:{userId:true,user:{select:{displayName:true}},branchScope:true,branches:{select:{branchId:true}}},take:100}),
  getSettings(c),
 ]);
 const initialTime=nextBookingTime(Date.now(),rules.openingHour,rules.closingHour);
 return <SalonShell active="appointments"><PageHeading title="Make time for a little care." description="Book one person or bring everyone together." action={<Link href="/salon/appointments" className="secondary">Back to calendar</Link>}/><div className="studio-content appointment-booking-content"><section className="studio-panel booking-panel"><AppointmentBooking customers={customers} services={services} branches={c.branches} initialTime={initialTime} staff={staff.map(s=>({id:s.userId,name:s.user.displayName,branchIds:c.branches.filter(b=>s.branchScope==='all'||s.branches.some(access=>access.branchId===b.id)).map(b=>b.id)}))}/></section></div></SalonShell>;
}

