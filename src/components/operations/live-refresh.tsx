'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
export function LiveRefresh(){const router=useRouter();useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState==='visible'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName??''))router.refresh();},30000);return()=>clearInterval(timer);},[router]);return <span className="live-badge"><i/> Refreshes every 30 seconds while visible</span>;}
