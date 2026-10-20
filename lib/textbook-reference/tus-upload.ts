/**
 * Minimal TUS 1.0 client for Supabase Storage's resumable endpoint, used by the
 * Admin browser upload (and the integration test). It authenticates with the
 * one-object signed token from the server, so no Storage key reaches the browser.
 * An interrupted upload resumes from the offset Storage reports.
 */

export interface TusTarget {
  endpoint: string;
  token: string;
  bucket: string;
  objectName: string;
  chunkSize: number;
  publishableKey?: string | null;
}

export interface TusOptions {
  signal?: AbortSignal;
  onProgress?: (uploaded: number, total: number) => void;
  /** Upload URL of an earlier attempt for the same object, to resume. */
  resumeUrl?: string | null;
  /** Called once the upload URL is known, so a caller can store it for resuming. */
  onUploadUrl?: (url: string) => void;
  retryDelaysMs?: number[];
}

export class TusUploadError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'TusUploadError';
  }
}

const encode = (value: string) =>
  typeof btoa === 'function' ? btoa(value) : Buffer.from(value, 'utf8').toString('base64');

function headers(target: TusTarget, extra: Record<string, string> = {}) {
  return {
    'Tus-Resumable': '1.0.0',
    'x-signature': target.token,
    ...(target.publishableKey ? { apikey: target.publishableKey } : {}),
    ...extra,
  };
}

async function currentOffset(target: TusTarget, url: string, signal?: AbortSignal) {
  const response = await fetch(url, { method: 'HEAD', headers: headers(target), signal });
  if (!response.ok) return null;
  const offset = Number(response.headers.get('upload-offset'));
  return Number.isFinite(offset) ? offset : null;
}

async function createUpload(target: TusTarget, size: number, signal?: AbortSignal) {
  const metadata = [
    `bucketName ${encode(target.bucket)}`,
    `objectName ${encode(target.objectName)}`,
    `contentType ${encode('application/pdf')}`,
    `cacheControl ${encode('3600')}`,
  ].join(',');
  const response = await fetch(target.endpoint, {
    method: 'POST',
    headers: headers(target, { 'Upload-Length': String(size), 'Upload-Metadata': metadata }),
    signal,
  });
  const location = response.headers.get('location');
  if (!response.ok || !location)
    throw new TusUploadError(
      response.status === 409
        ? 'Tệp này đã có trong kho lưu trữ.'
        : `Không bắt đầu được phiên tải lên (HTTP ${response.status}).`,
      response.status
    );
  return new URL(location, target.endpoint).toString();
}

export async function tusUpload(target: TusTarget, file: Blob, options: TusOptions = {}) {
  const { signal, onProgress } = options;
  const delays = options.retryDelaysMs ?? [1000, 3000, 8000];
  let url = options.resumeUrl ?? null;
  let offset = url ? await currentOffset(target, url, signal).catch(() => null) : null;
  if (url === null || offset === null) {
    url = await createUpload(target, file.size, signal);
    offset = 0;
  }
  options.onUploadUrl?.(url);
  onProgress?.(offset, file.size);
  let failures = 0;
  while (offset < file.size) {
    if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    const chunk = file.slice(offset, Math.min(offset + target.chunkSize, file.size));
    try {
      const response: Response = await fetch(url, {
        method: 'PATCH',
        headers: headers(target, {
          'Upload-Offset': String(offset),
          'Content-Type': 'application/offset+octet-stream',
        }),
        body: chunk,
        signal,
      });
      if (response.status === 409) {
        // Offset mismatch (an earlier chunk did land): ask Storage where to continue.
        const actual = await currentOffset(target, url, signal);
        if (actual === null) throw new TusUploadError('Phiên tải lên đã hết hạn.', 409);
        offset = actual;
        continue;
      }
      if (!response.ok)
        throw new TusUploadError(`Tải lên bị từ chối (HTTP ${response.status}).`, response.status);
      offset = Number(response.headers.get('upload-offset') ?? offset + chunk.size);
      failures = 0;
      onProgress?.(offset, file.size);
    } catch (error) {
      if (signal?.aborted) throw error;
      const status = error instanceof TusUploadError ? error.status : undefined;
      if ((status && status < 500 && status !== 409) || failures >= delays.length) throw error;
      await new Promise((resolve) => setTimeout(resolve, delays[failures]));
      failures += 1;
      const actual = await currentOffset(target, url, signal).catch(() => null);
      if (actual !== null) offset = actual;
    }
  }
  return { url, size: file.size };
}
