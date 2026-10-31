import Link from 'next/link';
import type {parseAppointmentFilters} from '@/lib/salon/appointment-filters';
export function AppointmentFilters({filters,staff,services,date,view}:{filters:ReturnType<typeof parseAppointmentFilters>;staff:{id:string;name:string}[];services:string[];date:string;view:string}){
 const active=Object.values(filters).some(Boolean);
 return <details className="appointment-filter-panel"><summary>Filters <span>Staff · Service · Time (IST){active?` · ${Object.values(filters).filter(Boolean).length} active`:''}</span></summary><form className="appointment-filterbar" method="get" aria-label="Filter appointments"><input type="hidden" name="date" value={date}/><input type="hidden" name="view" value={view}/>
  <label>Staff<select name="staff" defaultValue={filters.staff}><option value="">All staff</option>{staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}<option value="unassigned">Unassigned</option></select></label>
  <label>Service<select name="service" defaultValue={filters.service}><option value="">All services</option>{services.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
  <label>From (IST)<input name="from" type="time" defaultValue={filters.from}/></label>
  <label>Until (IST)<input name="to" type="time" defaultValue={filters.to}/></label>
  <button className="calendar-control" type="submit">Apply filters</button>{active&&<Link href={`?${new URLSearchParams({date,view})}`}>Clear filters</Link>}
  {filters.from&&filters.to&&filters.from>filters.to&&<p role="alert">Until must be at or after From.</p>}
 </form></details>;
}
