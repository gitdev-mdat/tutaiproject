'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCode2,
  FileImage,
  FileText,
  LoaderCircle,
  Save,
  Sheet,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KnowledgeNodePicker } from '@/components/admin/question-bank/knowledge-node-picker';
import { QuestionCandidateEditor } from '@/components/admin/import/question-candidate-editor';
import type { ImportSession, QuestionCandidate } from '@/lib/content-import/types';
import { PIPELINE_STAGE_LABELS } from '@/lib/content-import/types';

export type ReviewFilter = 'ALL' | 'READY' | 'REVIEW' | 'BLOCKING';

export const FILTER_LABELS: Record<ReviewFilter, string> = {
  ALL: 'Tất cả',
  READY: 'Sẵn sàng',
  REVIEW: 'Cần kiểm tra',
  BLOCKING: 'Thiếu thông tin',
};

export function formatUserFacingWarnings(warnings: string[]): string[] {
  if (!warnings || warnings.length === 0) return [];

  const normalized = new Map<string, string>();

  warnings.forEach((warning) => {
    const raw = warning.trim();
    let userFacingMessage = '';

    if (
      raw.toLowerCase().includes('visual recovery') ||
      raw.toLowerCase().includes('gemini visual')
    ) {
      userFacingMessage =
        'Hệ thống đã tự động quét và phục hồi bố cục nâng cao từ tài liệu. Vui lòng đối chiếu với bản gốc bên phải.';
    } else if (
      raw.toLowerCase().includes('ocr') ||
      raw.toLowerCase().includes('low text') ||
      raw.toLowerCase().includes('scan')
    ) {
      userFacingMessage =
        'Một số trang có chất lượng nhận diện chữ chưa tối ưu. Vui lòng kiểm tra lại công thức và nội dung.';
    } else if (
      raw.toLowerCase().includes('duration') ||
      raw.toLowerCase().includes('latency') ||
      raw.toLowerCase().includes('elapsed')
    ) {
      userFacingMessage =
        'Thời gian xử lý tài liệu kéo dài hơn dự kiến. Các câu hỏi đã được trích xuất hoàn tất.';
    } else {
      userFacingMessage = raw;
    }

    normalized.set(userFacingMessage, userFacingMessage);
  });

  return Array.from(normalized.values());
}

function ReviewBadge({ level }: { level: NonNullable<QuestionCandidate['reviewLevel']> }) {
  const styles = {
    READY: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    REVIEW: 'border-amber-200 bg-amber-50 text-amber-700',
    BLOCKING: 'border-red-200 bg-red-50 text-red-700',
  };
  const labelMap = {
    READY: 'Sẵn sàng',
    REVIEW: 'Cần kiểm tra',
    BLOCKING: 'Thiếu thông tin',
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${styles[level]}`}>
      {labelMap[level]}
    </span>
  );
}

export function QuestionDocumentImport({ initialSessionId }: { initialSessionId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [session, setSession] = React.useState<ImportSession | null>(null);
  const [selectedId, setSelectedId] = React.useState('');
  const [candidate, setCandidate] = React.useState<QuestionCandidate | null>(null);
  const [filter, setFilter] = React.useState<ReviewFilter>('ALL');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [loadingSession, setLoadingSession] = React.useState(Boolean(initialSessionId));
  const [loadAttempt, setLoadAttempt] = React.useState(0);
  const [loadElapsedSeconds, setLoadElapsedSeconds] = React.useState(0);
  const [showAdvancedSource, setShowAdvancedSource] = React.useState(false);
  const [defaultKnowledgeNodeId, setDefaultKnowledgeNodeId] = React.useState(
    () => searchParams.get('curriculumItemId') ?? ''
  );
  const [applyingBatchKnowledge, setApplyingBatchKnowledge] = React.useState(false);
  const [editorState, setEditorState] = React.useState({ editing: false, dirty: false });
  const [noticesExpanded, setNoticesExpanded] = React.useState(true);

  const selectCandidate = React.useCallback(
    (item: QuestionCandidate) => {
      if (
        editorState.dirty &&
        !window.confirm('Bạn có thay đổi chưa lưu. Rời câu hỏi này và bỏ thay đổi?')
      )
        return;
      setSelectedId(item.id);
      setCandidate(item);
    },
    [editorState.dirty]
  );

  const effectiveSessionId = initialSessionId || searchParams.get('session') || '';

  const syncUrlSession = React.useCallback(
    (sessionId: string) => {
      if (!sessionId) {
        if (pathname.includes('/review')) {
          router.replace('/admin/question-bank/import');
        } else {
          router.replace(pathname);
        }
        return;
      }
      if (pathname.includes('/review')) {
        router.replace(`/admin/question-bank/import/${sessionId}/review`);
      } else {
        const params = new URLSearchParams(searchParams.toString());
        params.set('session', sessionId);
        router.replace(`${pathname}?${params.toString()}`);
      }
    },
    [pathname, router, searchParams]
  );

  React.useEffect(() => {
    if (!loadingSession) return;
    const interval = window.setInterval(
      () => setLoadElapsedSeconds((seconds) => seconds + 1),
      1000
    );
    return () => window.clearInterval(interval);
  }, [loadingSession, loadAttempt]);

  React.useEffect(() => {
    if (!effectiveSessionId) {
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    void fetch(`/api/content-import/sessions/${effectiveSessionId}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as ImportSession & { error?: string };
        if (!response.ok) {
          throw new Error(
            result.error || 'Phiên nhập không tồn tại hoặc đã hết hạn. Vui lòng tạo phiên nhập mới.'
          );
        }
        if (!cancelled) {
          setSession(result);
          setSelectedId(result.candidates[0]?.id ?? '');
          setCandidate(result.candidates[0] ?? null);
          setLoadingSession(false);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof DOMException && loadError.name === 'AbortError'
              ? 'Phiên làm việc tải quá lâu. Hãy kiểm tra kết nối rồi thử lại.'
              : loadError instanceof Error
                ? loadError.message
                : 'Không thể tải phiên nhập tài liệu.'
          );
          setLoadingSession(false);
        }
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [effectiveSessionId, loadAttempt]);

  async function upload(file: File) {
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/content-import/questions/document', {
        method: 'POST',
        body,
      });
      const result = (await response.json()) as ImportSession & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Tải lên và trích xuất tài liệu thất bại.');
      setSession(result);
      setSelectedId(result.candidates[0]?.id ?? '');
      setCandidate(result.candidates[0] ?? null);
      syncUrlSession(result.id);
    } catch (uploadError: unknown) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Tải lên và trích xuất tài liệu thất bại.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveCandidate(next = candidate): Promise<boolean> {
    if (!session || !next) return false;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/content-import/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate: next }),
      });
      const result = (await response.json()) as ImportSession & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Không thể lưu bản nháp câu hỏi.');
      setSession(result);
      setCandidate(result.candidates.find((item) => item.id === next.id) ?? next);
      return true;
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu bản nháp câu hỏi.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function applyDocumentKnowledgeNode(nodeId: string) {
    if (!session || !nodeId) return;
    setApplyingBatchKnowledge(true);
    setBusy(true);
    setError('');
    try {
      const updatedCandidates: QuestionCandidate[] = session.candidates.map((item) => ({
        ...item,
        primaryKnowledgeNodeId: nodeId,
        status:
          item.status === 'APPROVED'
            ? 'EDITED'
            : item.status === 'UNREVIEWED'
              ? 'EDITED'
              : item.status,
        updatedAt: new Date().toISOString(),
      }));

      await Promise.all(
        updatedCandidates.map(async (updatedCandidate) => {
          const response = await fetch(`/api/content-import/sessions/${session.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candidate: updatedCandidate }),
          });
          if (!response.ok) {
            const result = (await response.json()) as { error?: string };
            throw new Error(
              result.error || `Không thể gán kiến thức cho câu ${updatedCandidate.number}.`
            );
          }
        })
      );

      const sessionRes = await fetch(`/api/content-import/sessions/${session.id}`);
      const latestSession = (await sessionRes.json()) as ImportSession;
      setSession(latestSession);
      if (candidate) {
        setCandidate(
          latestSession.candidates.find((item) => item.id === candidate.id) ??
            latestSession.candidates[0] ??
            null
        );
      }
    } catch (batchError: unknown) {
      setError(
        batchError instanceof Error
          ? batchError.message
          : 'Không thể gán kiến thức hàng loạt cho các câu hỏi.'
      );
    } finally {
      setApplyingBatchKnowledge(false);
      setBusy(false);
    }
  }

  async function commitBatch() {
    if (!session?.structuredData) return;
    if (candidate && !(await saveCandidate(candidate))) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/question-bank/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          idempotencyKey: session.id,
          allowPartial: false,
          conflictActions: {},
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        successCount?: number;
        failedCount?: number;
        failedRows?: Array<{ rowIndex: number; errors: string[] }>;
      };
      if (!response.ok) throw new Error(result.error || 'Lưu danh sách câu hỏi thất bại.');
      if ((result.failedCount ?? 0) > 0) {
        throw new Error(
          result.failedRows?.flatMap((row) => row.errors).join(' ') ||
            'Vui lòng xử lý toàn bộ các câu hỏi còn thiếu thông tin trước khi hoàn tất.'
        );
      }
      setSession((current) =>
        current ? { ...current, status: 'COMPLETED', currentStep: 5 } : current
      );
    } catch (commitError: unknown) {
      setError(
        commitError instanceof Error ? commitError.message : 'Lưu danh sách câu hỏi thất bại.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!session || !candidate) return;
    setBusy(true);
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
      if (!response.ok || !result.candidate) {
        throw new Error(result.error || 'Câu hỏi chưa đủ điều kiện để duyệt.');
      }
      const approved = result.candidate;
      setCandidate(approved);
      setSession((current) =>
        current
          ? {
              ...current,
              candidates: current.candidates.map((item) =>
                item.id === approved.id ? approved : item
              ),
            }
          : current
      );
    } catch (approveError: unknown) {
      setError(
        approveError instanceof Error ? approveError.message : 'Câu hỏi chưa đủ điều kiện để duyệt.'
      );
    } finally {
      setBusy(false);
    }
  }

  function warningAction(
    id: string,
    action: QuestionCandidate['warnings'][number]['actions'][number]
  ) {
    if (!candidate) return;
    setCandidate({
      ...candidate,
      status: action === 'SKIP' ? 'SKIPPED' : 'EDITED',
      warnings: candidate.warnings.filter((warning) => warning.id !== id),
    });
  }

  async function updateRights(
    rightsStatus: NonNullable<ImportSession['singleQuestionSource']>['rightsStatus']
  ) {
    if (!session?.singleQuestionSource) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/content-import/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          singleQuestionSource: { ...session.singleQuestionSource, rightsStatus },
        }),
      });
      const result = (await response.json()) as ImportSession & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Không thể cập nhật quyền tài liệu nguồn.');
      setSession(result);
    } catch (rightsError: unknown) {
      setError(
        rightsError instanceof Error
          ? rightsError.message
          : 'Không thể cập nhật quyền tài liệu nguồn.'
      );
    } finally {
      setBusy(false);
    }
  }

  function resetSession() {
    if (editorState.dirty && !window.confirm('Bạn có thay đổi chưa lưu. Rời phiên và bỏ thay đổi?'))
      return;
    setSession(null);
    setSelectedId('');
    setCandidate(null);
    setError('');
    syncUrlSession('');
  }

  if (loadingSession) {
    const invalidRouteSession = /[\[\]]/.test(effectiveSessionId);
    if (invalidRouteSession) {
      return (
        <div className="mx-auto flex min-h-[320px] max-w-2xl items-center justify-center px-4">
          <section
            role="alert"
            className="w-full rounded-xl border border-amber-200 bg-white p-6 text-center shadow-xs"
          >
            <AlertTriangle className="mx-auto size-7 text-amber-600" />
            <h1 className="mt-3 text-base font-semibold text-slate-900">
              Đường dẫn phiên kiểm tra không hợp lệ
            </h1>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
              Hãy mở một phiên nhập thực tế từ danh sách nhập tài liệu; không thể dùng phần giữ chỗ
              trong địa chỉ.
            </p>
            <Button
              nativeButton={false}
              className="mt-5"
              render={<Link href="/admin/question-bank/import" />}
            >
              <ArrowLeft className="size-4" /> Chọn hoặc tạo phiên nhập
            </Button>
          </section>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Nhập tài liệu
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">Đang mở phiên kiểm tra</h1>
            <p className="mt-1 text-sm text-slate-500">
              Đã chờ {loadElapsedSeconds} giây · tự động báo lỗi sau 15 giây
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
          >
            Thử tải lại
          </Button>
        </header>
        <section
          aria-live="polite"
          aria-busy="true"
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs"
        >
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50">
              <LoaderCircle className="size-5 animate-spin text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Đang tải dữ liệu phiên…</p>
              <p className="text-xs text-slate-500">
                Khôi phục câu hỏi, trạng thái duyệt và tài liệu nguồn
              </p>
            </div>
          </div>
          <div className="grid min-h-[380px] md:grid-cols-[15rem_1fr]">
            <aside className="border-b border-slate-100 bg-slate-50/70 p-4 md:border-b-0 md:border-r">
              <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
              {[1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="mt-3 h-11 animate-pulse rounded-lg bg-slate-200/70" />
              ))}
            </aside>
            <main className="p-5 sm:p-7">
              <div className="h-5 w-44 animate-pulse rounded bg-slate-200" />
              <div className="mt-5 space-y-3 rounded-xl border border-slate-100 p-5">
                <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
                <div className="h-28 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
              </div>
              <p className="mt-5 text-xs text-slate-500">
                Bạn có thể thử tải lại ngay hoặc quay lại danh sách nhập tài liệu.
              </p>
              <Link
                href="/admin/question-bank/import"
                className="mt-2 inline-flex text-sm font-semibold text-blue-700 hover:underline"
              >
                Quay lại trang nhập tài liệu
              </Link>
            </main>
          </div>
        </section>
      </div>
    );
  }

  if (!session && error && effectiveSessionId) {
    return (
      <div className="mx-auto flex min-h-[420px] max-w-3xl items-center justify-center px-4">
        <section className="w-full rounded-xl border border-red-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-red-50">
            <AlertTriangle className="size-6 text-red-600" />
          </div>
          <h1 className="mt-4 text-base font-semibold text-slate-900">
            Không thể mở phiên kiểm tra
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">{error}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button
              onClick={() => {
                setError('');
                setLoadAttempt((attempt) => attempt + 1);
              }}
            >
              Thử tải lại
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/admin/question-bank/import" />}
            >
              <ArrowLeft className="size-4" />
              Tạo phiên nhập mới
            </Button>
          </div>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <header>
          <h1 className="text-xl font-bold text-slate-900">Nhập câu hỏi vào kho nội dung</h1>
          <p className="mt-1 text-sm text-slate-500">
            PDF, Word, dữ liệu có cấu trúc và ảnh đều đi qua bước trích xuất, kiểm tra trước khi trở
            thành câu hỏi chuẩn hóa trong Ngân hàng câu hỏi.
          </p>
        </header>
        {error && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <span>{error}</span>
            <Button variant="outline" size="xs" onClick={() => resetSession()}>
              Nhập tài liệu mới
            </Button>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-blue-300 bg-blue-50/40 p-5 hover:bg-blue-50"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? (
              <LoaderCircle className="size-6 animate-spin text-blue-600" />
            ) : (
              <Upload className="size-6 text-blue-600" />
            )}
            <span className="mt-3 text-sm font-semibold">Tải PDF hoặc DOCX</span>
            <span className="text-xs text-slate-500">
              Tối đa 30 MB · luôn tạo bản nháp để duyệt
            </span>
          </button>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            <Link
              href="/admin/question-bank?import=excel"
              className="flex items-center gap-3 p-4 hover:bg-slate-50"
            >
              <Sheet className="size-4" />
              <span className="text-sm">Excel / CSV / JSON</span>
            </Link>
            <Link
              href="/admin/question-bank/import/image"
              className="flex items-center gap-3 p-4 hover:bg-slate-50"
            >
              <FileImage className="size-4" />
              <span className="text-sm">Một ảnh câu hỏi</span>
            </Link>
            <Link
              href="/admin/exams/import/images"
              className="flex items-center gap-3 p-4 hover:bg-slate-50"
            >
              <FileImage className="size-4" />
              <span className="min-w-0">
                <span className="block text-sm">Nhiều ảnh của một đề gốc</span>
                <span className="block text-[11px] text-slate-500">
                  Giữ thứ tự đề và đưa từng câu vào Ngân hàng câu hỏi trước khi tạo đề nháp.
                </span>
              </span>
            </Link>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>
    );
  }

  if (session.status === 'PROCESSING' || session.status === 'FAILED') {
    const activeStage = session.pipelineStages.find((stage) => stage.status === 'PROCESSING');
    const failedStage = session.pipelineStages.find((stage) => stage.status === 'FAILED');
    const stage = failedStage ?? activeStage;
    const isFailed = session.status === 'FAILED' || Boolean(failedStage || session.processingError);
    const sourceLabel =
      session.sourceDocument?.originalFileName ||
      session.structuredData?.fileName ||
      'Tài liệu đã tải lên';

    return (
      <div className="mx-auto flex min-h-[420px] max-w-2xl items-center justify-center px-4">
        <section
          aria-live="polite"
          aria-busy={!isFailed}
          role={isFailed ? 'alert' : 'status'}
          className={`w-full rounded-xl border bg-white p-6 shadow-xs ${
            isFailed ? 'border-red-200' : 'border-slate-200'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${isFailed ? 'bg-red-50' : 'bg-blue-50'}`}
            >
              {isFailed ? (
                <AlertTriangle className="size-5 text-red-600" />
              ) : (
                <LoaderCircle className="size-5 animate-spin text-blue-600" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-500">{sourceLabel}</p>
              <h1 className="mt-1 text-base font-semibold text-slate-900">
                {isFailed
                  ? 'Chưa thể chuẩn bị phiên kiểm tra'
                  : 'Đang chuẩn bị câu hỏi để kiểm tra'}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {isFailed
                  ? session.processingError?.reason ||
                    stage?.message ||
                    'Quá trình xử lý bị gián đoạn. Bạn có thể tải lại trạng thái hoặc nhập lại tài liệu.'
                  : stage
                    ? PIPELINE_STAGE_LABELS[stage.id]
                    : 'Đã nhận tài liệu, đang chờ bước xử lý tiếp theo.'}
              </p>
              {!isFailed && (
                <p className="mt-1 text-xs text-slate-500">
                  Tiến độ chỉ thay đổi khi hệ thống lưu xong từng công đoạn; không cần giữ trang này
                  mở.
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  variant={isFailed ? 'default' : 'outline'}
                  onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                >
                  {isFailed ? 'Thử tải lại trạng thái' : 'Cập nhật trạng thái'}
                </Button>
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={<Link href="/admin/question-bank/import" />}
                >
                  Nhập lại tài liệu
                </Button>
              </div>
              {!session.sourceDocument && !session.structuredData && (
                <p className="mt-4 text-xs text-amber-700">
                  Tài liệu nguồn hiện chưa khả dụng. Hãy cập nhật trạng thái hoặc nhập lại tài liệu.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  const counts: Record<ReviewFilter, number> = {
    ALL: session.candidates.length,
    READY: session.candidates.filter((c) => c.reviewLevel === 'READY').length,
    REVIEW: session.candidates.filter((c) => c.reviewLevel === 'REVIEW').length,
    BLOCKING: session.candidates.filter((c) => c.reviewLevel === 'BLOCKING').length,
  };

  const visible = session.candidates.filter(
    (item) => filter === 'ALL' || item.reviewLevel === filter
  );

  const pageCountText = session.pages?.length
    ? `${session.pages.length} trang`
    : session.sourceDocument?.pageCount
      ? `${session.sourceDocument.pageCount} trang`
      : '';

  const formatBadge =
    session.sourceFormat || (session.sourceDocument?.mimeType?.includes('pdf') ? 'PDF' : 'DOCX');
  const userFacingWarnings = formatUserFacingWarnings(session.warnings || []);

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[680px] flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-xs">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">Kiểm tra câu hỏi đã nhập</h1>
              <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                {formatBadge}
              </span>
            </div>
            <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700 truncate max-w-xs sm:max-w-sm">
                {session.sourceDocument?.originalFileName ||
                  session.structuredData?.fileName ||
                  'Tài liệu nguồn'}
              </span>
              <span>·</span>
              <span className="font-medium text-slate-700">
                {session.candidates.length} câu hỏi
              </span>
              {pageCountText && (
                <>
                  <span>·</span>
                  <span>{pageCountText}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.structuredData ? (
            <Button
              size="sm"
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => void commitBatch()}
              disabled={busy || session.status === 'COMPLETED'}
            >
              <Save className="size-4" />
              {session.status === 'COMPLETED'
                ? 'Đã lưu vào Ngân hàng câu hỏi'
                : 'Lưu vào Ngân hàng câu hỏi'}
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => {
                if (candidate) void approve();
              }}
              disabled={
                busy || candidate?.status === 'APPROVED' || candidate?.reviewLevel === 'BLOCKING'
              }
            >
              {candidate?.status === 'APPROVED' ? (
                <>
                  <CheckCircle2 className="size-4" /> Đã duyệt (Bản nháp)
                </>
              ) : (
                'Lưu vào Ngân hàng câu hỏi'
              )}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => resetSession()}>
            <ArrowLeft className="size-4" />
            Nhập tài liệu khác
          </Button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {userFacingWarnings.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
          <button
            type="button"
            className="flex w-full items-center justify-between font-semibold"
            onClick={() => setNoticesExpanded((value) => !value)}
            aria-expanded={noticesExpanded}
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" />
              Lưu ý tài liệu ({userFacingWarnings.length})
            </span>
            {noticesExpanded ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </button>
          {noticesExpanded && (
            <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
              {userFacingWarnings.map((msg, i) => (
                <p key={i}>{msg}</p>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[280px_minmax(520px,1fr)_minmax(360px,440px)]">
        {/* Left Column: Question list & Filters */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
          <div className="grid grid-cols-2 gap-1 border-b border-slate-200 p-2 bg-slate-50/70">
            {(['ALL', 'READY', 'REVIEW', 'BLOCKING'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`flex items-center justify-between rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                  filter === value
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{FILTER_LABELS[value]}</span>
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                    filter === value ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {counts[value]}
                </span>
              </button>
            ))}
          </div>

          {/* Batch Document-Level Knowledge Node Picker */}
          <div className="border-b border-slate-200 bg-slate-50/50 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-800">Kiến thức cho tài liệu</span>
            </div>
            <KnowledgeNodePicker
              value={defaultKnowledgeNodeId}
              placeholder="Chọn mục kiến thức chung..."
              className="text-xs min-h-8 py-1"
              onChange={(nodeId) => setDefaultKnowledgeNodeId(nodeId)}
            />
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="w-full text-xs border-blue-200 text-blue-700 bg-blue-50/60 hover:bg-blue-100 hover:text-blue-800 font-medium"
              disabled={!defaultKnowledgeNodeId || busy || applyingBatchKnowledge}
              onClick={() => void applyDocumentKnowledgeNode(defaultKnowledgeNodeId)}
            >
              {applyingBatchKnowledge ? (
                <>
                  <LoaderCircle className="size-3 animate-spin mr-1" />
                  Đang áp dụng...
                </>
              ) : (
                'Áp dụng cho tất cả câu hỏi'
              )}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {visible.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">
                Không có câu hỏi phù hợp với bộ lọc.
              </p>
            ) : (
              visible.map((item) => (
                <button
                  key={item.id}
                  onClick={() => selectCandidate(item)}
                  className={`w-full rounded-lg border p-2.5 text-left transition-all ${
                    item.id === selectedId
                      ? 'border-blue-500 bg-blue-50/80 shadow-xs ring-1 ring-blue-500'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">Câu {item.number}</span>
                    <ReviewBadge level={item.reviewLevel ?? 'REVIEW'} />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-slate-600">
                    {item.content || 'Chưa có nội dung'}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Center Column: Question Candidate Editor */}
        <main className="flex min-h-0 flex-col overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/70 p-3 shadow-xs">
          {candidate ? (
            <div className="flex-1 space-y-3">
              <QuestionCandidateEditor
                candidate={candidate}
                sessionId={session.id}
                onChange={setCandidate}
                onSave={saveCandidate}
                onEditingChange={(editing, dirty) => setEditorState({ editing, dirty })}
                onWarningAction={warningAction}
              />
              <div className="sticky bottom-0 -mx-3 -mb-3 flex items-center justify-between border-t border-slate-200 bg-white/95 backdrop-blur-xs p-3 shadow-xs">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void saveCandidate()}
                  disabled={busy}
                >
                  <Save className="size-4" />
                  Lưu bản nháp
                </Button>
                {!session.structuredData && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => void approve()}
                    disabled={
                      busy ||
                      candidate.status === 'APPROVED' ||
                      candidate.reviewLevel === 'BLOCKING'
                    }
                  >
                    {candidate.status === 'APPROVED' ? (
                      <>
                        <CheckCircle2 className="size-4" /> Đã duyệt
                      </>
                    ) : (
                      'Duyệt câu hỏi này'
                    )}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-500">
              Vui lòng chọn một câu hỏi ở danh sách bên trái để kiểm tra.
            </div>
          )}
        </main>

        {/* Right Column: Source Evidence Panel */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5 bg-slate-50/60">
            <span className="text-xs font-bold text-slate-800">Tài liệu gốc đối chiếu</span>
            <span className="text-[11px] font-medium text-slate-500">
              {candidate?.sourcePages?.[0] ? `Trang ${candidate.sourcePages[0]}` : formatBadge}
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto bg-slate-100 flex flex-col">
            {session.structuredData ? (
              <pre className="flex-1 overflow-auto whitespace-pre-wrap p-3 text-[11px] font-mono text-slate-700 bg-white">
                {JSON.stringify(candidate?.stagedQuestion ?? {}, null, 2)}
              </pre>
            ) : session.sourceFormat === 'PDF' ||
              session.sourceDocument?.mimeType?.includes('pdf') ? (
              <iframe
                title="Tài liệu PDF nguồn"
                src={`/api/content-import/sessions/${session.id}/document#page=${candidate?.sourcePages?.[0] ?? 1}`}
                className="w-full flex-1 min-h-[380px] border-0"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-sm text-slate-600 bg-white m-3 rounded-lg border border-slate-200">
                <FileCode2 className="size-8 text-slate-400 mb-2" />
                <p className="font-medium text-slate-800">Tài liệu DOCX đã được lưu trữ an toàn.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Bạn có thể tải về hoặc mở tài liệu gốc để tra cứu.
                </p>
                <a
                  className="mt-3 inline-flex items-center gap-1 rounded-md bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  href={`/api/content-import/sessions/${session.id}/document`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Mở tài liệu nguồn
                </a>
              </div>
            )}

            {/* Progressive Disclosure for Source Rights & Bounds */}
            <div className="border-t border-slate-200 bg-white">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                onClick={() => setShowAdvancedSource((prev) => !prev)}
              >
                <span>Thông tin bản quyền & Tọa độ trích xuất</span>
                {showAdvancedSource ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </button>

              {showAdvancedSource && (
                <div className="space-y-3 p-3 pt-0 border-t border-slate-100 bg-slate-50/50">
                  <label className="block text-[11px] font-medium text-slate-600 pt-2">
                    Tình trạng bản quyền nguồn
                    <select
                      className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
                      value={session.singleQuestionSource?.rightsStatus ?? 'UNVERIFIED'}
                      onChange={(event) =>
                        void updateRights(
                          event.target.value as NonNullable<
                            ImportSession['singleQuestionSource']
                          >['rightsStatus']
                        )
                      }
                    >
                      <option value="UNVERIFIED">Chưa xác minh — Cần kiểm tra</option>
                      <option value="OFFICIAL_SOURCE">Tài liệu chính thức</option>
                      <option value="PERMISSION_GRANTED">Đã được cấp phép</option>
                      <option value="OPEN_LICENSE">Giấy phép mở</option>
                      <option value="INTERNAL_CONTENT">Nội bộ</option>
                      <option value="RESTRICTED">Hạn chế sử dụng — Cần kiểm tra</option>
                    </select>
                  </label>

                  {candidate && (
                    <div className="space-y-2 border-t border-slate-200 pt-2">
                      <p className="text-[11px] font-semibold text-slate-700">
                        Tọa độ vùng gốc (%)
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {(['x', 'y', 'width', 'height'] as const).map((key) => (
                          <label key={key} className="text-[10px] uppercase text-slate-500">
                            {key}
                            <Input
                              type="number"
                              value={candidate.sourceBounds?.[key] ?? 0}
                              onChange={(event) =>
                                setCandidate({
                                  ...candidate,
                                  sourceBounds: {
                                    x: candidate.sourceBounds?.x ?? 0,
                                    y: candidate.sourceBounds?.y ?? 0,
                                    width: candidate.sourceBounds?.width ?? 0,
                                    height: candidate.sourceBounds?.height ?? 0,
                                    [key]: Number(event.target.value),
                                  },
                                })
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Lưu vùng nguồn để đối chiếu lại chữ hoặc phục hồi hình vẽ khi cần.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
