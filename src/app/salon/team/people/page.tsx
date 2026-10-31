import {redirect} from 'next/navigation';
import {requireModule} from '@/lib/salon/context';
import {TeamManagement} from '@/components/salon/team-management';
export const dynamic='force-dynamic';
export default async function People(){const c=await requireModule('team');if(!c.administrator||c.membership.branchScope!=='all')redirect('/salon/access-denied');return <TeamManagement context={c} back/>;}
