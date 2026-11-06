import { expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { platformPrivileges } from '@/lib/authorization/platform-policy';
const m = vi.hoisted(() => ({ grants: [] as string[], require: vi.fn(), records: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/platform/queries', () => ({
  platformContext: async () => ({ user: { id: 'admin', displayName: 'Platform Operator' }, grants: m.grants }),
  platformMetrics: async () => ({ total: 248, active: 219, newSalons: 18, bookings: 12480, stages: [{ stage: 'registered', count: 16 }, { stage: 'review', count: 13 }, { stage: 'active', count: 219 }] }),
  analytics: async () => ({ metrics: { total: 248, active: 219, newSalons: 18 }, acquisition: [{ month:'2026-10',count:18n }], volume: [{month:'2026-10',count:12480n}], plans: [], adoption: [], returning: {previous:0n,retained:0n} }),
  healthSnapshot: async () => ({ database:'Ready',latency:12,jobs:[],incidents:0,checkedAt:'2026-11-05T17:00:00Z' }),
}));
vi.mock('@/lib/authorization/server', () => ({ requirePlatformPrivilege: m.require }));
vi.mock('@/lib/auth/page-guard', () => ({ guard: async (_portal: string, action: () => unknown) => action() }));
vi.mock('@/lib/platform/schema-ready', () => ({ platformSchemaReady: async () => true }));
vi.mock('@/server/auth-actions', () => ({ logout: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { salon: { findMany: async () => [{ id: 'salon', name:'The Studio', status:'active', createdAt:new Date('2026-11-01'), updatedAt:new Date('2026-11-01'), settings:{}, subscription:null, _count:{branches:1,services:8,memberships:3}, memberships:[] }] }, user:{findMany:async()=>[]}, platformRecord:{findMany:m.records}, auditEvent:{findMany:async()=>[]}, $queryRaw:async()=>[] } }));
import { PlatformWorkspace } from '@/components/platform/workspace';
import { sections } from '@/lib/platform/catalog';
async function resolve(node: unknown): Promise<unknown> {
  if (Array.isArray(node)) return Promise.all(node.map(resolve));
  if (!React.isValidElement(node)) return node;
  const element = node as React.ReactElement<Record<string, unknown>>;
  if (typeof element.type === 'function' && element.type.constructor.name === 'AsyncFunction') return resolve(await (element.type as (props: unknown) => Promise<unknown>)(element.props));
  const props={...element.props};for(const key of Object.keys(props))if(React.isValidElement(props[key])||Array.isArray(props[key]))props[key]=await resolve(props[key]);
  return React.cloneElement(element,props);
}
it('renders all twelve sections and exports a desktop/mobile visual fixture', async () => {
  m.grants = [...platformPrivileges]; m.require.mockResolvedValue({id:'admin'});
  for (const section of sections) {
    const tree = await resolve(await PlatformWorkspace({section:section.slug}));
    const html = renderToStaticMarkup(tree as React.ReactNode);
    expect(html).toContain('SaloonSync'); expect(html.toLowerCase()).not.toContain('glowdesk'); expect(html).toContain('Platform administration');
    if (!section.slug) {
      await mkdir('.cache/preview',{recursive:true});const css=await readFile('src/components/platform/platform.css','utf8');
      await writeFile('.cache/preview/platform.html',`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}body{margin:0}.muted{color:#819078}.link-button{background:none;border:none;color:inherit;cursor:pointer}${css}</style></head><body>${html}</body></html>`);
    }
  }
});
it('denies protected sections before reading their records', async () => {
  m.grants=['platform.manage','platform.support.manage']; m.require.mockRejectedValue(new Error('Forbidden'));m.records.mockClear();
  await expect(PlatformWorkspace({section:'configuration'})).rejects.toThrow('Forbidden');expect(m.records).not.toHaveBeenCalled();
});
