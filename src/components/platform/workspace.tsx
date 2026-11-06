import { notFound } from 'next/navigation';
import { guard } from '@/lib/auth/page-guard';
import { requirePlatformPrivilege } from '@/lib/authorization/server';
import { sections, type RecordKind } from '@/lib/platform/catalog';
import { platformContext } from '@/lib/platform/queries';
import { PlatformShell } from './shell';
import { SalonDirectory, UserDirectory, Plans } from './directories';
import { Overview, Analytics, Health, Security } from './insights';
import { RecordArea, type Search } from './records';

export async function PlatformWorkspace({ section = '', search = {} }: { section?: string; search?: Search }) {
  const definition = sections.find(item => item.slug === section); if (!definition) notFound();
  const { user, grants, preferences } = await platformContext();
  if (!(section === 'users' && grants.includes('platform.operators.manage'))) await guard('platform', () => requirePlatformPrivilege(definition.privilege));
  const page = Math.max(1, Math.min(10000, Number.parseInt(search.page ?? '1', 10) || 1));
  const props = { search, page, grants };
  let content: React.ReactNode;
  if (!section) content = <Overview grants={grants}/>;
  else if (section === 'salons') content = <SalonDirectory {...props}/>;
  else if (section === 'users') content = <><p className="pa-notice">Your operator ID: {user.id}. Existing administrators can use Assign platform role to explicitly grant the expanded Super admin permissions.</p><UserDirectory {...props}/></>;
  else if (section === 'plans') content = <Plans {...props}/>;
  else if (section === 'analytics') content = <Analytics/>;
  else if (section === 'security') content = <Security {...props}/>;
  else if (section === 'health') content = <Health {...props}/>;
  else {
    const kinds: RecordKind[] = section === 'support' ? ['ticket', 'access'] : section === 'configuration' ? ['flag', 'template', 'policy'] : section === 'announcements' ? ['announcement'] : section === 'jobs' ? ['integration', 'job'] : ['preference', 'settings'];
    content = <>{section === 'jobs' && <div className="pa-notice">Provider states and exceptions are recorded by operators. Requesting a retry adds a recovery task; external execution and automatic notification delivery require connected workers.</div>}{section === 'support' && <div className="pa-notice">Create case → verify requester → request consented metadata access if needed → independent security review → resolve and audit. Keep customer records, credentials and payment details out of case notes.</div>}<RecordArea kinds={kinds} {...props} section={section}/></>;
  }
  return <PlatformShell active={section} grants={grants} name={user.displayName} compact={preferences?.density === 'compact'}><div className="pa-heading"><div><p className="pa-eyebrow">SaloonSync · Platform administration</p><h1>{section ? definition.label : 'Platform overview'}</h1><p>{definition.description}</p></div><span className="pa-heading-date">{new Intl.DateTimeFormat(preferences?.locale ?? 'en-IN', { dateStyle: 'medium', timeZone: preferences?.timezone ?? 'Asia/Kolkata' }).format(new Date())}</span></div>{content}</PlatformShell>;
}
