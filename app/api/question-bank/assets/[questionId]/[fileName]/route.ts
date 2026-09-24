import fs from 'fs/promises';
import { NextResponse } from 'next/server';
import { questionAssetFile } from '@/lib/content-import/storage';

const SAFE_SEGMENT = /^[a-zA-Z0-9.-]+$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ questionId: string; fileName: string }> }
) {
  try {
    const { questionId, fileName } = await context.params;
    if (!SAFE_SEGMENT.test(questionId) || !SAFE_SEGMENT.test(fileName)) {
      return NextResponse.json({ error: 'Invalid asset path.' }, { status: 400 });
    }
    const bytes = await fs.readFile(questionAssetFile(questionId, fileName));
    const extension = fileName.split('.').pop()?.toLowerCase();
    const contentType =
      extension === 'png'
        ? 'image/png'
        : extension === 'webp'
          ? 'image/webp'
          : extension === 'pdf'
            ? 'application/pdf'
            : extension === 'docx'
              ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              : 'image/jpeg';
    return new Response(bytes, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Unable to read asset.' }, { status: 500 });
  }
}
