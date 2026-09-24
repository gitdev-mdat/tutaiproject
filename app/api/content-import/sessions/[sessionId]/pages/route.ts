import { NextResponse } from 'next/server';
import {
  appendImagesToSession,
  ImportStorageError,
  type UploadImageManifestItem,
} from '@/lib/content-import/storage';

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await context.params;
    const formData = await request.formData();
    const files = formData.getAll('files').filter((value): value is File => value instanceof File);
    const manifestRaw = formData.get('manifest');
    if (typeof manifestRaw !== 'string') {
      throw new ImportStorageError('Thiếu thông tin kích thước ảnh.', 400);
    }
    const manifest = JSON.parse(manifestRaw) as UploadImageManifestItem[];
    return NextResponse.json(await appendImagesToSession({ sessionId, files, manifest }));
  } catch (error: unknown) {
    const status = error instanceof ImportStorageError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không thể thêm ảnh vào phiên nhập.' },
      { status }
    );
  }
}
