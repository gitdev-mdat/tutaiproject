import { NextResponse } from 'next/server';
import {
  createImageImportSession,
  ImportStorageError,
  type UploadImageManifestItem,
} from '@/lib/content-import/storage';

function parseManifest(value: FormDataEntryValue | null): UploadImageManifestItem[] {
  if (typeof value !== 'string') return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) => {
    const record = item as Record<string, unknown>;
    return {
      name: typeof record.name === 'string' ? record.name : '',
      width: typeof record.width === 'number' ? record.width : 0,
      height: typeof record.height === 'number' ? record.height : 0,
    };
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files').filter((value): value is File => value instanceof File);
    const session = await createImageImportSession({
      domain: 'EXAM',
      files,
      manifest: parseManifest(formData.get('manifest')),
    });
    return NextResponse.json(session, { status: 201 });
  } catch (error: unknown) {
    const status = error instanceof ImportStorageError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không thể tạo phiên nhập.' },
      { status }
    );
  }
}
