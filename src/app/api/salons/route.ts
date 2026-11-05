import { NextResponse } from 'next/server';
import { getExploreSalonsData } from '@/lib/customer/queries';
export async function GET() {
  try {
    const { salons } = await getExploreSalonsData();
    return NextResponse.json({ salons }, { headers: { 'Cache-Control': 'public, max-age=30' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load salons.' }, { status: 503 });
  }
}
