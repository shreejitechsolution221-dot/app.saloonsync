import { PlatformWorkspace } from '@/components/platform/workspace';
import { platformSearch } from '@/lib/platform/search';
export const dynamic = 'force-dynamic';
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PlatformWorkspace section="analytics" search={platformSearch(await searchParams)}/>;
}
