import {serviceCatalogQuery,type ServiceCatalogRow} from '@/lib/salon/page-queries';
import {db} from '@/lib/db';
import {requireModule} from '@/lib/salon/context';
import {SalonShell,PageHeading} from '@/components/salon/shell';
import {SidePanel} from '@/components/salon/side-panel';
import {ServiceForm} from '@/components/salon/service-form';
import {ServiceCatalog} from '@/components/salon/service-catalog';
export const dynamic='force-dynamic';
export default async function Services(){
 const c=await requireModule('services');const canManage=c.administrator&&c.membership.branchScope==='all';
 const [staff,services]=await Promise.all([
  canManage?db.salonMembership.findMany({where:{salonId:c.salonId,role:{in:['owner','admin','manager','staff']},status:'active',user:{disabledAt:null}},select:{userId:true,user:{select:{displayName:true}}},take:100}):[],
  db.$queryRaw<ServiceCatalogRow[]>(serviceCatalogQuery({salonId:c.salonId,userId:c.user.id,staff:c.membership.role==='staff',administrator:c.administrator})),
 ]);
 const team=staff.map(member=>({id:member.userId,name:member.user.displayName}));const active=services.filter(service=>service.active);const categories=[...new Set(services.map(service=>service.category))].sort();
 return <SalonShell active="services"><PageHeading eyebrow="THE SERVICE COLLECTION" title="Your craft. Beautifully offered." description="Shape your services, set the details and make every visit special." action={canManage?<SidePanel label="+ Add service" title="Something lovely to offer." description="Define the service, its price and the team who bring it to life." eyebrow="SERVICE CATALOG"><ServiceForm staff={team} categories={categories}/></SidePanel>:undefined}/><div className="studio-content services-workspace"><div className="service-catalog-stats"><div><span>Active services</span><strong>{active.length}</strong><small>Available for new bookings</small></div><div><span>Categories</span><strong>{new Set(active.map(service=>service.category)).size}</strong><small>Ways to care for your customers</small></div><div><span>Packages</span><strong>{active.filter(service=>service.kind==='package').length}</strong><small>Thoughtfully bundled experiences</small></div><div><span>Add-ons</span><strong>{active.filter(service=>service.kind==='addon').length}</strong><small>A little extra care</small></div></div><ServiceCatalog services={services} staff={team} canManage={canManage}/></div></SalonShell>;
}
