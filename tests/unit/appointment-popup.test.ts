import {expect,it,vi} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('@/server/salon-actions',()=>({changeAppointment:vi.fn(),rescheduleAppointment:vi.fn()}));
import {AppointmentPopup} from '@/components/salon/appointment-popup';
const booking={id:'visit',customerName:'Alex',serviceName:'Haircut',startsAt:'2026-11-01T04:30:00Z',durationMinutes:40,staffName:'Jamie',branchName:'Main',status:'confirmed'};
function render(status:string,operator=true){return renderToStaticMarkup(React.createElement(AppointmentPopup,{booking:{...booking,status},operator,children:'Alex'}));}
it('shows check-in, cancellation, no-show, rescheduling and visit details for confirmed appointments',()=>{const html=render('confirmed');for(const text of ['Check in','Cancel appointment','Mark no-show','Reschedule appointment','Haircut','Jamie','Main','aria-haspopup="dialog"'])expect(html).toContain(text);expect(html).not.toContain('Complete service');});
it('shows the next step for checked-in and in-service appointments',()=>{expect(render('checked_in')).toContain('Start service');expect(render('in_service')).toContain('Complete service');expect(render('in_service')).not.toContain('Reschedule appointment');});
it('limits staff to service actions',()=>{const html=render('checked_in',false);expect(html).toContain('Start service');for(const text of ['Cancel appointment','Mark no-show','Reschedule appointment'])expect(html).not.toContain(text);expect(render('confirmed',false)).not.toContain('Check in');});
it.each(['completed','cancelled','no_show'])('keeps %s appointments terminal',status=>{const html=render(status);expect(html).toContain('no further status actions');expect(html).not.toContain('appointment-popup-actions');});
