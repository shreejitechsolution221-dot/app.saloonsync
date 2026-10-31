'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {refreshServiceTimers} from '@/server/salon-actions';
export function ServiceTimerRefresh(){
 const router=useRouter();
 useEffect(()=>{
  let stopped=false,running=false;
  const refresh=async()=>{if(running||document.visibilityState!=='visible')return;running=true;try{const result=await refreshServiceTimers();if(!stopped&&result.completed)router.refresh();}catch{/* The next poll retries temporary network failures. */}finally{running=false;}};
  void refresh();const timer=setInterval(()=>void refresh(),15000);
  const visible=()=>{if(document.visibilityState==='visible')void refresh();};document.addEventListener('visibilitychange',visible);
  return()=>{stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[router]);
 return null;
}
