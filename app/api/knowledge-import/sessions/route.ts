import { NextResponse } from 'next/server';
import { readImportData, clearImportCache } from '@/lib/knowledge-graph/kg-import-storage';
import { parseImportFile } from '@/lib/knowledge-graph/kg-import-service';

export async function GET() {
  try {
    clearImportCache();
    const data = await readImportData();
    return NextResponse.json(data.sessions);
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { payload, filename } = await req.json();
    if (!payload) return NextResponse.json({ error: 'Missing payload' }, { status: 400 });

    const sessionId = await parseImportFile(payload, filename || 'unknown.json');
    return NextResponse.json({ sessionId });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
