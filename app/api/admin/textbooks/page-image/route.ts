import { NextResponse } from 'next/server';
import { adminApiGuard } from '@/lib/auth/admin';
import { PageImageError, printedPageImage } from '@/lib/textbook-reference/page-images';
import { TextbookBackendUnavailableError } from '@/lib/textbook-reference/repository';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Admin-only: one printed page of a private textbook as PNG. Students never reach this. */
export async function GET(request: Request) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  const url = new URL(request.url);
  const documentId = url.searchParams.get('documentId') ?? '';
  const page = Number(url.searchParams.get('page'));
  if (!documentId || !Number.isInteger(page) || page < 1 || page > 5000)
    return NextResponse.json({ error: 'Thiếu sách hoặc số trang.' }, { status: 400 });
  try {
    const image = await printedPageImage(documentId, page);
    return new NextResponse(new Uint8Array(image.png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=3600',
        'X-PDF-Page': String(image.pdfPage),
        'X-PDF-Position': image.position,
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch (error) {
    if (error instanceof PageImageError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof TextbookBackendUnavailableError)
      return NextResponse.json({ error: 'Kho sách chưa được cấu hình.' }, { status: 503 });
    console.error('[textbooks] page image failed:', (error as Error)?.message);
    return NextResponse.json({ error: 'Không hiển thị được trang này.' }, { status: 500 });
  }
}
