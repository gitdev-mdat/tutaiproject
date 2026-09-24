import fs from 'fs/promises';
import { NextResponse } from 'next/server';
import { requireImportSession, sourcePageFile } from '@/lib/content-import/storage';

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string; pageId: string }> }
) {
  try {
    const { sessionId, pageId } = await context.params;
    const session = await requireImportSession(sessionId);
    const page = session.pages.find((item) => item.id === pageId);
    if (!page) return NextResponse.json({ error: 'Không tìm thấy ảnh.' }, { status: 404 });
    const bytes = await fs.readFile(sourcePageFile(sessionId, page.storedFileName));
    return new Response(bytes, {
      headers: {
        'Content-Type': page.mimeType,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(page.originalFileName)}`,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không thể tải ảnh.' },
      { status: 500 }
    );
  }
}
