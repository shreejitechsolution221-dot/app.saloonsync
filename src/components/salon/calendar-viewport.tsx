'use client';
import {useCallback} from 'react';
export function CalendarViewport({hour,children}:{hour:number;children:React.ReactNode}){
 const attach=useCallback((node:HTMLDivElement|null)=>{if(node)node.scrollTop=hour*100;},[hour]);
 return <div className="calendar-scroll" ref={attach} role="region" aria-label="Appointment schedule" tabIndex={0}>{children}</div>;
}
