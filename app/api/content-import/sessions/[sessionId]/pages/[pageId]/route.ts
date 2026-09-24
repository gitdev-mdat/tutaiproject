import { NextResponse } from 'next/server';
import {
  deleteSourcePage,
  ImportStorageError,
  replaceSourcePage,
} from '@/lib/content-import/storage';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ sessionId: string; pageId: string }> }
) {
  try {
    const { sessionId, pageId } = await context.params;
    return NextResponse.json(await deleteSourcePage(sessionId, pageId));
  } catch (error: unknown) {
    const status = error instanceof ImportStorageError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không thể xóa ảnh.' },
      { status }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ sessionId: string; pageId: string }> }
) {
  try {
    const { sessionId, pageId } = await context.params;
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) throw new ImportStorageError('Thiếu ảnh thay thế.', 400);
    const width = Number(formData.get('width'));
    const height = Number(formData.get('height'));
    return NextResponse.json(await replaceSourcePage({ sessionId, pageId, file, width, height }));
  } catch (error: unknown) {
    const status = error instanceof ImportStorageError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không thể thay ảnh.' },
      { status }
    );
  }
}
