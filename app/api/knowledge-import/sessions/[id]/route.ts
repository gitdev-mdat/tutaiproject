import { NextResponse } from 'next/server';
import {
  readImportData,
  writeImportData,
  clearImportCache,
} from '@/lib/knowledge-graph/kg-import-storage';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    clearImportCache();
    const resolvedParams = await params;
    const data = await readImportData();
    const session = data.sessions.find((s) => s.id === resolvedParams.id);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const candidates = data.candidates.filter((c) => c.sessionId === resolvedParams.id);
    return NextResponse.json({ session, candidates });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    clearImportCache();
    const resolvedParams = await params;
    const data = await readImportData();
    const session = data.sessions.find((s) => s.id === resolvedParams.id);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    if (session.status === 'COMPLETED' || session.status === 'COMMITTING') {
      return NextResponse.json(
        { error: 'Cannot delete completed or committing session' },
        { status: 400 }
      );
    }

    session.status = 'CANCELLED';
    await writeImportData(data);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
