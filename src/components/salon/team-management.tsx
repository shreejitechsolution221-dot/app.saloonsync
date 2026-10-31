import Link from 'next/link';
import {teamManagement} from '@/lib/salon/team-management';
import type {Context} from '@/lib/operations/shared';
import {invitationEmailConfigured} from '@/lib/email/invitations';
import {SalonShell,PageHeading} from './shell';
import {SidePanel} from './side-panel';
import {TeamMemberForm} from './team-member-form';
import {TeamEmployeeList} from './team-employee-list';
import {ModuleTabs} from '@/components/operations/ui';
export async function TeamManagement({context:c,back=false}:{context:Context;back?:boolean}){
 const data=await teamManagement(c);const emailEnabled=invitationEmailConfigured();
 return <SalonShell active="team"><PageHeading eyebrow="PEOPLE & EMPLOYEE MANAGEMENT" title={back?'Employee profiles, in one place.':'Your people, thoughtfully managed.'} description="Profiles, sign-in access and day-to-day support for every teammate." action={<div className="team-heading-actions">{back?<Link className="secondary" href="/salon/team">← Back to team</Link>:<Link className="secondary" href="/salon/settings/access">Access & ownership ↗</Link>}<SidePanel label="+ Add teammate" title="Add a teammate" description="Create their employee profile and choose how they sign in." eyebrow="ONE TEAM, ONE PROFILE"><TeamMemberForm branches={c.availableBranches} logins={data.logins} actorRole={c.membership.role} emailEnabled={emailEnabled}/></SidePanel></div>}/><ModuleTabs module="team"/><div className="studio-content team-workspace"><div className="team-stat-strip"><div><small>Active team</small><strong>{data.employees.filter(e=>e.active).length}</strong><span>Employee profiles and workspace accounts</span></div><div><small>Invitations pending</small><strong>{data.employees.filter(e=>e.active&&e.invitationStatus==='pending').length}</strong><span>Profiles ready for their first sign-in</span></div><div><small>Linked logins</small><strong>{data.employees.filter(e=>e.active&&e.userId).length}</strong><span>People with active workspace access</span></div></div><TeamEmployeeList employees={data.employees} logins={data.logins} branches={c.availableBranches} actorRole={c.membership.role} actorId={c.user.id} emailEnabled={emailEnabled}/></div></SalonShell>;
}
