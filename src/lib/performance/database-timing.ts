import {AsyncLocalStorage} from 'node:async_hooks';
export type DatabaseSpan={route:string;queries:number;databaseMs:number;started:number};
const registry=globalThis as unknown as {salonDatabaseTiming?:AsyncLocalStorage<DatabaseSpan>};
const storage=registry.salonDatabaseTiming??=new AsyncLocalStorage<DatabaseSpan>();
const enabled=()=>process.env.NODE_ENV==='development'||process.env.DB_TIMING_DEBUG==='1';
export function databaseOperation(operation:string,durationMs:number){
 const span=storage.getStore();
 if(span){span.queries++;span.databaseMs+=durationMs;}
 if(durationMs>=200)console.warn(JSON.stringify({event:'database.slow_query',operation,caller:span?.route??'background',durationMs:Math.round(durationMs*10)/10,params:'[redacted]'}));
 else if(process.env.DB_TIMING_DEBUG==='1')console.info(JSON.stringify({event:'database.query_timing',operation,caller:span?.route??'background',durationMs:Math.round(durationMs*10)/10,params:'[redacted]'}));
}
export async function withDatabaseTiming<T>(route:string,work:()=>Promise<T>):Promise<T>{
 if(!enabled()||storage.getStore())return work();
 const span:DatabaseSpan={route,queries:0,databaseMs:0,started:performance.now()};
 return storage.run(span,async()=>{try{return await work();}finally{console.info(JSON.stringify({event:'database.request_timing',route,queryCount:span.queries,databaseMs:Math.round(span.databaseMs*10)/10,durationMs:Math.round((performance.now()-span.started)*10)/10}));}});
}
export function measuredPage<A extends unknown[],T>(route:string,render:(...args:A)=>Promise<T>){return async(...args:A):Promise<T>=>withDatabaseTiming(route,()=>render(...args));}
