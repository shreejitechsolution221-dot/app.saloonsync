import {timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {dispatchMessages} from '@/lib/operations/communications';
export async function POST(request:Request){const expected=process.env.COMMUNICATIONS_WORKER_SECRET,provided=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!expected||expected.length<32||!provided||Buffer.byteLength(provided)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.json(await dispatchMessages(),{headers:{'Cache-Control':'no-store'}});}
