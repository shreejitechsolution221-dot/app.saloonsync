import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {randomBytes} from 'node:crypto';
import {requireModule} from '@/lib/salon/context';
import {calendarConfiguration} from '@/lib/operations/calendar-tokens';
import {secureAuthCookies} from '@/lib/auth/cookie-options';
export async function GET(){const c=await requireModule('appointments'),config=calendarConfiguration();if(!config)return NextResponse.redirect(new URL('/salon/settings/integrations?calendar=configuration_required',process.env.APP_ORIGIN));const state=randomBytes(32).toString('hex');(await cookies()).set('calendar_oauth',JSON.stringify({state,userId:c.user.id,salonId:c.salonId}),{httpOnly:true,secure:secureAuthCookies(),sameSite:'lax',path:'/api/calendar',maxAge:600});const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirectUri,response_type:'code',scope:'https://www.googleapis.com/auth/calendar.app.created',access_type:'offline',prompt:'consent',state}).toString();return NextResponse.redirect(url);}
