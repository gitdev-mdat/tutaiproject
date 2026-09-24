import { NextResponse } from 'next/server';
import {
  addSecondaryDomainMembership,
  removeSecondaryDomainMembership,
} from '@/lib/knowledge-graph/kg-service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { conceptId, domainId } = body;
    if (!conceptId || !domainId) throw new Error('conceptId and domainId are required');
    const membership = await addSecondaryDomainMembership(conceptId, domainId);
    return NextResponse.json({ success: true, membership });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const conceptId = url.searchParams.get('conceptId');
    const domainId = url.searchParams.get('domainId');
    if (!conceptId || !domainId) throw new Error('conceptId and domainId are required');

    await removeSecondaryDomainMembership(conceptId, domainId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
