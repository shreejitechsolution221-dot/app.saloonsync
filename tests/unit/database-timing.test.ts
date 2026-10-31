import {afterEach,expect,it,vi} from 'vitest';
import {databaseOperation,withDatabaseTiming} from '@/lib/performance/database-timing';
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
it('keeps overlapping render counters separate without logging params',async()=>{
 vi.stubEnv('DB_TIMING_DEBUG','1');const info=vi.spyOn(console,'info').mockImplementation(()=>{});vi.spyOn(console,'warn').mockImplementation(()=>{});
 await Promise.all([withDatabaseTiming('billing',async()=>{databaseOperation('SELECT.Invoice',10);await Promise.resolve();databaseOperation('SELECT.Payment',20);}),withDatabaseTiming('customers',async()=>{databaseOperation('SELECT.SalonCustomer',5);})]);
 const rows=info.mock.calls.map(([message])=>JSON.parse(message));expect(rows.find(r=>r.event==='database.request_timing'&&r.route==='billing')).toMatchObject({queryCount:2,databaseMs:30});expect(rows.find(r=>r.event==='database.request_timing'&&r.route==='customers')).toMatchObject({queryCount:1,databaseMs:5});expect(rows.filter(r=>r.event==='database.query_timing').every(r=>r.params==='[redacted]')).toBe(true);
});
it('reports queries at the 200ms threshold with an operation and caller',async()=>{vi.stubEnv('DB_TIMING_DEBUG','1');vi.spyOn(console,'info').mockImplementation(()=>{});const warning=vi.spyOn(console,'warn').mockImplementation(()=>{});await withDatabaseTiming('billing',async()=>databaseOperation('SELECT.Invoice',200));expect(JSON.parse(warning.mock.calls[0][0])).toMatchObject({event:'database.slow_query',caller:'billing',operation:'SELECT.Invoice',durationMs:200,params:'[redacted]'});});
