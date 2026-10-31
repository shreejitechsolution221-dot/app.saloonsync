import {timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {completeDueServices} from '@/lib/operations/timed-services';
export async function POST(request:Request){
 const expected=process.env.SERVICE_WORKER_SECRET,provided=request.headers.get('authorization')?.replace(/^Bearer /,'');
 if(!expected||expected.length<32||!provided||Buffer.byteLength(provided)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))return NextResponse.json({error:'Unauthorized'},{status:401});
 return NextResponse.json(await completeDueServices(),{headers:{'Cache-Control':'no-store'}});
}
