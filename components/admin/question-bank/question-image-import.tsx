'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ClipboardPaste, FileImage, LoaderCircle, RotateCw, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QuestionCandidateEditor } from '@/components/admin/import/question-candidate-editor';
import {
  RIGHTS_STATUSES,
  RIGHTS_STATUS_LABELS,
  type CropRegion,
  type ImportSession,
  type QuestionCandidate,
} from '@/lib/content-import/types';

async function dimensions(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const result = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return result;
}

function sourceUrl(session: ImportSession): string {
  return `/api/content-import/sessions/${session.id}/pages/${session.pages[0].id}/source`;
}

export function QuestionImageImport() {
  const [session, setSession] = React.useState<ImportSession | null>(null);
  const [candidate, setCandidate] = React.useState<QuestionCandidate | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const mutationQueue = React.useRef<Promise<void>>(Promise.resolve());
  const inputRef = React.useRef<HTMLInputElement>(null);
  const replaceRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  React.useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('sessionId');
    if (!sessionId) return;
    void fetch(`/api/content-import/sessions/${sessionId}`).then(async (response) => {
      if (!response.ok) return;
      const result = (await response.json()) as ImportSession;
      setSession(result);
      setCandidate(result.candidates[0] ?? null);
    });
  }, []);

  async function upload(file: File) {
    setUploading(true);
    setError('');
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
        throw new Error('Ảnh phải có định dạng JPG, PNG hoặc WEBP.');
      const imageSize = await dimensions(file);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(file);
      });
      const form = new FormData();
      form.append('file', file);
      form.append('manifest', JSON.stringify([{ name: file.name, ...imageSize }]));
      const response = await fetch('/api/content-import/questions/image', {
        method: 'POST',
        body: form,
      });
      const result = (await response.json()) as ImportSession & { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Không thể tải ảnh.');
      setSession(result);
      setCandidate(null);
      window.history.replaceState(
        null,
        '',
        `/admin/question-bank/import/image?sessionId=${result.id}`
      );
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải ảnh.');
    } finally {
      setUploading(false);
    }
  }

  async function replace(file: File) {
    if (!session) return upload(file);
    setUploading(true);
    try {
      const imageSize = await dimensions(file);
      const form = new FormData();
      form.append('file', file);
      form.append('width', String(imageSize.width));
      form.append('height', String(imageSize.height));
      const page = session.pages[0];
      const response = await fetch(`/api/content-import/sessions/${session.id}/pages/${page.id}`, {
        method: 'PUT',
        body: form,
      });
      const result = (await response.json()) as ImportSession & { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Không thể thay ảnh.');
      setSession(result);
      setCandidate(null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Không thể thay ảnh.');
    } finally {
      setUploading(false);
    }
  }

  async function patchSession(body: object): Promise<ImportSession> {
    if (!session) throw new Error('Chưa có phiên nhập.');
    const request = mutationQueue.current.then(async () => {
      const response = await fetch(`/api/content-import/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as ImportSession & { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Không thể lưu thay đổi.');
      setSession(result);
      return result;
    });
    mutationQueue.current = request.then(
      () => undefined,
      () => undefined
    );
    return request;
  }

  async function updatePage(patch: Partial<ImportSession['pages'][number]>) {
    if (!session) return;
    const page = { ...session.pages[0], ...patch };
    setSession({ ...session, pages: [page] });
    try {
      await patchSession({
        pageUpdates: [{ id: page.id, rotation: page.rotation, crop: page.crop }],
      });
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Không thể cập nhật ảnh.');
    }
  }

  async function processImage() {
    if (!session) return;
    setProcessing(true);
    setError('');
    try {
      const response = await fetch(`/api/content-import/sessions/${session.id}/process`, {
        method: 'POST',
      });
      const result = (await response.json()) as ImportSession & { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Không thể nhận diện câu hỏi.');
      setSession(result);
      setCandidate(result.candidates[0] ?? null);
      if (!result.candidates[0])
        setError(
          'Không tìm thấy câu hỏi rõ ràng trong vùng ảnh đã chọn. Hãy crop lại ảnh và thử lại.'
        );
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Không thể nhận diện câu hỏi.');
    } finally {
      setProcessing(false);
    }
  }

  async function saveDraft() {
    if (!candidate) return;
    setSaving(true);
    try {
      const result = await patchSession({ candidate });
      setCandidate(result.candidates.find((item) => item.id === candidate.id) ?? candidate);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Không thể lưu bản nháp.');
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    if (!session || !candidate) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(
        `/api/content-import/sessions/${session.id}/candidates/${candidate.id}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidate }),
        }
      );
      const result = (await response.json()) as { candidate?: QuestionCandidate; error?: string };
      if (!response.ok || !result.candidate)
        throw new Error(result.error ?? 'Không thể duyệt câu hỏi.');
      setCandidate(result.candidate);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Không thể duyệt câu hỏi.');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setSession(null);
    setCandidate(null);
    setError('');
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return '';
    });
    window.history.replaceState(null, '', '/admin/question-bank/import/image');
  }

  function handlePaste(event: React.ClipboardEvent) {
    const file = Array.from(event.clipboardData.files).find((item) =>
      item.type.startsWith('image/')
    );
    if (file) {
      event.preventDefault();
      void upload(file);
    }
  }

  function warningAction(
    warningId: string,
    action: QuestionCandidate['warnings'][number]['actions'][number]
  ) {
    if (!candidate) return;
    if (action === 'SKIP') {
      setCandidate({ ...candidate, status: 'SKIPPED' });
      return;
    }
    let next = {
      ...candidate,
      warnings: candidate.warnings.filter((warning) => warning.id !== warningId),
      status: 'EDITED' as const,
    };
    if (action === 'NO_ANSWER') next = { ...next, correctAnswer: '' };
    if (action === 'RESELECT_REGION' && session) {
      void updatePage({ crop: { top: 5, right: 5, bottom: 5, left: 5 } });
    }
    setCandidate(next);
  }

  const page = session?.pages[0];
  const crop: CropRegion = page?.crop ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const visibleSource = session ? sourceUrl(session) : previewUrl;

  return (
    <div className="mx-auto max-w-7xl space-y-4" onPaste={handlePaste}>
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Import câu hỏi từ ảnh</h1>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-500">
            Tải ảnh chụp một câu hỏi. Tú Tài sẽ nhận diện nội dung, phương án, đáp án và hình minh
            họa để bạn kiểm tra.
          </p>
        </div>
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          render={<Link href="/admin/question-bank" />}
        >
          Quay lại ngân hàng
        </Button>
      </header>
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="Đóng cảnh báo">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="grid min-h-[680px] gap-4 lg:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
        <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Ảnh nguồn</h2>
              <p className="text-[11px] text-slate-400">Dán ảnh bằng Ctrl+V hoặc tải một tệp</p>
            </div>
            {page && (
              <span className="text-[11px] text-slate-400">
                {page.width}×{page.height}
              </span>
            )}
          </div>
          {!visibleSource ? (
            <div className="m-3 flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <span className="grid size-10 place-items-center rounded-lg bg-blue-50 text-blue-600">
                <FileImage className="size-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-800">
                Kéo, chọn hoặc dán một ảnh
              </p>
              <p className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP · tối đa 12 MB</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
                  <Upload /> Chọn ảnh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigator.clipboard
                      .read()
                      .then((items) =>
                        items[0]?.getType(
                          items[0].types.find((type) => type.startsWith('image/')) ?? ''
                        )
                      )
                      .then(async (blob) => {
                        if (blob.size > 0)
                          await upload(new File([blob], 'clipboard.png', { type: blob.type }));
                      })
                      .catch(() =>
                        setError('Trình duyệt không cho phép đọc clipboard. Hãy dùng Ctrl+V.')
                      )
                  }
                >
                  <ClipboardPaste /> Dán ảnh
                </Button>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void updatePage({
                      rotation: (((page?.rotation ?? 0) + 90) % 360) as 0 | 90 | 180 | 270,
                    })
                  }
                >
                  <RotateCw /> Xoay
                </Button>
                <Button variant="ghost" size="sm" onClick={() => replaceRef.current?.click()}>
                  Thay ảnh
                </Button>
                <input
                  ref={replaceRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void replace(file);
                    event.target.value = '';
                  }}
                />
                <Button variant="ghost" size="sm" className="ml-auto text-red-600" onClick={reset}>
                  Xóa
                </Button>
              </div>
              <div className="relative min-h-[360px] flex-1 overflow-auto bg-slate-100 p-3">
                <div className="relative mx-auto h-full min-h-[330px] w-full overflow-hidden bg-white">
                  <Image
                    src={visibleSource}
                    alt="Ảnh gốc câu hỏi"
                    fill
                    unoptimized
                    sizes="(max-width: 1024px) 100vw, 45vw"
                    className="object-contain"
                    style={{ transform: `rotate(${page?.rotation ?? 0}deg)` }}
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute border-2 border-blue-500 bg-blue-500/5"
                    style={{
                      top: `${crop.top}%`,
                      right: `${crop.right}%`,
                      bottom: `${crop.bottom}%`,
                      left: `${crop.left}%`,
                    }}
                  />
                </div>
              </div>
              <div className="border-t border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-700">Crop vùng câu hỏi</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Loại bỏ header website, sidebar hoặc vùng không liên quan. Ảnh gốc không bị thay
                  đổi.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                  {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
                    <label key={side} className="text-[11px] text-slate-500">
                      <span className="flex justify-between">
                        <span>
                          {{ top: 'Trên', right: 'Phải', bottom: 'Dưới', left: 'Trái' }[side]}
                        </span>
                        <span>{crop[side]}%</span>
                      </span>
                      <input
                        className="w-full accent-blue-600"
                        type="range"
                        min={0}
                        max={40}
                        value={crop[side]}
                        onChange={(event) =>
                          void updatePage({ crop: { ...crop, [side]: Number(event.target.value) } })
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-200 p-3">
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => void processImage()}
                  disabled={processing || session?.extractionProvider === 'UNAVAILABLE'}
                >
                  {processing ? (
                    <>
                      <LoaderCircle className="animate-spin" /> Đang nhận diện…
                    </>
                  ) : (
                    'Nhận diện câu hỏi'
                  )}
                </Button>
                {session?.extractionProvider === 'UNAVAILABLE' && (
                  <p className="mt-2 text-center text-[11px] text-amber-700">
                    Chưa cấu hình dịch vụ nhận diện. Không có kết quả giả được tạo.
                  </p>
                )}
              </div>
            </>
          )}
        </section>

        <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-slate-50">
          <div className="border-b border-slate-200 bg-white px-3 py-2.5">
            <h2 className="text-sm font-semibold text-slate-800">Dữ liệu trích xuất</h2>
            <p className="text-[11px] text-slate-400">
              Kết quả AI luôn cần người quản trị kiểm tra
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {candidate ? (
              <QuestionCandidateEditor
                candidate={candidate}
                onChange={setCandidate}
                onWarningAction={warningAction}
              />
            ) : (
              <div className="grid h-full min-h-[360px] place-items-center text-center">
                <div>
                  <p className="text-sm font-medium text-slate-600">Chưa có dữ liệu trích xuất</p>
                  <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">
                    Tải ảnh, crop vùng câu hỏi rồi chạy nhận diện. Hệ thống không coi lựa chọn được
                    tô màu là đáp án đúng.
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white p-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void saveDraft()}
              disabled={!candidate || saving}
            >
              Lưu bản nháp
            </Button>
            <Button
              size="sm"
              onClick={() => void approve()}
              disabled={!candidate || saving || candidate.status === 'APPROVED'}
            >
              {candidate?.status === 'APPROVED'
                ? 'Đã thêm vào ngân hàng (bản nháp)'
                : 'Duyệt và thêm vào ngân hàng'}
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              Import ảnh khác
            </Button>
          </div>
        </section>
      </div>

      {session && (
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <h2 className="text-xs font-semibold text-slate-700">Nguồn và quyền sử dụng</h2>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-slate-500">
              Tên nguồn
              <Input
                className="mt-1"
                value={session.singleQuestionSource?.sourceName ?? ''}
                onChange={(event) =>
                  setSession({
                    ...session,
                    singleQuestionSource: {
                      ...session.singleQuestionSource!,
                      sourceName: event.target.value,
                    },
                  })
                }
                onBlur={() =>
                  void patchSession({ singleQuestionSource: session.singleQuestionSource })
                }
              />
            </label>
            <label className="text-xs text-slate-500">
              URL nguồn
              <Input
                className="mt-1"
                type="url"
                value={session.singleQuestionSource?.sourceUrl ?? ''}
                onChange={(event) =>
                  setSession({
                    ...session,
                    singleQuestionSource: {
                      ...session.singleQuestionSource!,
                      sourceUrl: event.target.value,
                    },
                  })
                }
                onBlur={() =>
                  void patchSession({ singleQuestionSource: session.singleQuestionSource })
                }
              />
            </label>
            <label className="text-xs text-slate-500">
              Quyền sử dụng
              <select
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                value={session.singleQuestionSource?.rightsStatus}
                onChange={(event) => {
                  const next = {
                    ...session.singleQuestionSource!,
                    rightsStatus: event.target.value as NonNullable<
                      ImportSession['singleQuestionSource']
                    >['rightsStatus'],
                  };
                  setSession({ ...session, singleQuestionSource: next });
                  void patchSession({ singleQuestionSource: next });
                }}
              >
                {RIGHTS_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {RIGHTS_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}
    </div>
  );
}
