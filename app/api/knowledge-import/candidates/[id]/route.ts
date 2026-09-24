import { NextResponse } from 'next/server';
import {
  readImportData,
  writeImportData,
  clearImportCache,
} from '@/lib/knowledge-graph/kg-import-storage';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    clearImportCache();
    const resolvedParams = await params;
    const reqBody = await req.json();
    const { status, matchedCanonicalId, adminNote, sourceData } = reqBody;

    const data = await readImportData();
    const candidate = data.candidates.find((c) => c.id === resolvedParams.id);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    const session = data.sessions.find((s) => s.id === candidate.sessionId);
    if (!session || session.status === 'COMPLETED' || session.status === 'COMMITTING') {
      return NextResponse.json(
        { error: 'Cannot modify candidate in completed or committing session' },
        { status: 400 }
      );
    }

    if (status) candidate.status = status;
    if (matchedCanonicalId !== undefined) candidate.matchedCanonicalId = matchedCanonicalId;
    if (adminNote !== undefined) candidate.adminNote = adminNote;
    if (sourceData !== undefined) candidate.sourceData = { ...candidate.sourceData, ...sourceData };

    candidate.updatedAt = new Date().toISOString();

    const sessionCandidates = data.candidates.filter((c) => c.sessionId === session.id);
    session.summary.approved = sessionCandidates.filter(
      (item) => item.status.startsWith('APPROVED') || item.status === 'AUTO_MATCHED'
    ).length;
    session.summary.rejected = sessionCandidates.filter(
      (item) => item.status === 'REJECTED'
    ).length;
    session.summary.unresolved = sessionCandidates.filter(
      (item) => item.status === 'PENDING' || item.status === 'NEEDS_REVIEW'
    ).length;
    session.status = session.summary.unresolved === 0 ? 'READY_TO_COMMIT' : 'REVIEW_REQUIRED';
    session.updatedAt = new Date().toISOString();

    await writeImportData(data);

    return NextResponse.json({ candidate, session });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
