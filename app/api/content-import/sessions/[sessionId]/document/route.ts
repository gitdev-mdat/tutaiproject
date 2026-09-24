import fs from 'fs/promises';
import { NextResponse } from 'next/server';
import { requireImportSession, sourceDocumentFile } from '@/lib/content-import/storage';

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await context.params;
    const session = await requireImportSession(sessionId);
    if (!session.sourceDocument) {
      return NextResponse.json({ error: 'Session has no source document.' }, { status: 404 });
    }
    const bytes = await fs.readFile(
      sourceDocumentFile(session.id, session.sourceDocument.storedFileName)
    );
    return new Response(bytes, {
      headers: {
        'Content-Type': session.sourceDocument.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(session.sourceDocument.originalFileName)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load source document.' },
      { status: 404 }
    );
  }
}
