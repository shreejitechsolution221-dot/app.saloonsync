import 'server-only';
import {db} from '@/lib/db';
let cached:{ready:boolean;until:number}|undefined;
let checking:Promise<boolean>|undefined;
// Public schema readiness only; no identity, permissions or business data are
// stored across requests. A pending rollout is retried within five seconds.
export async function businessSchemaReady(){if(cached&&cached.until>Date.now())return cached.ready;if(checking)return checking;checking=(async()=>{const [row]=await db.$queryRaw<{ready:boolean}[]>`SELECT to_regclass('app."CalendarJob"') IS NOT NULL AND to_regclass('app."LocationStock"') IS NOT NULL AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='app' AND table_name='Expense' AND column_name='receiptPath') AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='app' AND table_name='SalonCustomer' AND column_name='originBranchId') AS ready`;cached={ready:row.ready,until:Date.now()+(row.ready?3600000:5000)};return row.ready;})();try{return await checking;}finally{checking=undefined;}}
