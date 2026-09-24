'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Check,
  Circle,
  CircleAlert,
  FileImage,
  Info,
  LoaderCircle,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ExamImageList } from '@/components/admin/exams/exam-image-list';
import { ImagePreviewDialog } from '@/components/admin/import/image-preview-dialog';
import { ImageUploadDropzone } from '@/components/admin/import/image-upload-dropzone';
import { ImportStepper } from '@/components/admin/import/import-stepper';
import {
  ImportWorkflowHeader,
  type ImportSaveState,
} from '@/components/admin/import/import-workflow-header';
import {
  EXAM_TYPES,
  PIPELINE_STAGE_LABELS,
  RIGHTS_STATUS_LABELS,
  RIGHTS_STATUSES,
  type ExamMetadata,
  type ImportSession,
  type PageType,
  type SourcePage,
} from '@/lib/content-import/types';
import { codesNeedConfirmation } from '@/lib/content-import/session-utils';
import {
  validateExamUpload,
  type UploadValidationIssue,
} from '@/lib/content-import/upload-validation';
import { SUBJECT_ID_VALUES, SUBJECT_LABELS } from '@/lib/question-bank/qb-types';

interface PendingFile {
  id: string;
  file: File;
  width: number;
  height: number;
  progress: number;
  status: 'READY' | 'UPLOADING' | 'DONE' | 'FAILED';
  retryable: boolean;
  error?: string;
}

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 12 * 1024 * 1024;
const MAX_FILES = 24;

const EXAM_TYPE_LABELS: Record<(typeof EXAM_TYPES)[number], string> = {
  LESSON: 'Theo bài',
  CHAPTER: 'Theo chương',
  SEMESTER: 'Học kỳ',
  NATIONAL_EXAM_MOCK: 'Thi thử THPT Quốc gia',
  OFFICIAL: 'Đề chính thức',
  OTHER: 'Khác',
};

function formatBytes(value: number): string {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

async function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600">
      <span>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function UploadQueue({
  pending,
  uploading,
  onUpload,
  onRetry,
  onRemove,
}: {
  pending: PendingFile[];
  uploading: boolean;
  onUpload: () => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (pending.length === 0) return null;
  const readyCount = pending.filter((item) => item.status === 'READY').length;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
        <p className="text-xs font-semibold text-slate-700">Hàng chờ tải lên ({pending.length})</p>
        {readyCount > 0 && (
          <Button size="sm" onClick={onUpload} disabled={uploading}>
            {uploading ? <LoaderCircle className="animate-spin" /> : <FileImage />}
            {uploading ? 'Đang tải…' : `Tải ${readyCount} ảnh`}
          </Button>
        )}
      </div>
      <ul className="divide-y divide-slate-100" aria-live="polite">
        {pending.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
            <FileImage className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                <span className="truncate font-medium text-slate-700">{item.file.name}</span>
                <span className="shrink-0 text-slate-500">
                  {item.width > 0 ? `${item.width}×${item.height} · ` : ''}
                  {formatBytes(item.file.size)}
                </span>
              </div>
              {(item.status === 'UPLOADING' || item.status === 'DONE') && (
                <div
                  className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-label={`Tiến độ tải ${item.file.name}`}
                  aria-valuenow={item.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="h-full bg-blue-600" style={{ width: `${item.progress}%` }} />
                </div>
              )}
              {item.error && <p className="mt-1 text-[11px] text-red-600">{item.error}</p>}
            </div>
            {item.status === 'FAILED' && item.retryable && (
              <Button variant="ghost" size="xs" onClick={() => onRetry(item.id)}>
                Thử lại
              </Button>
            )}
            {item.status !== 'UPLOADING' && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onRemove(item.id)}
                aria-label={`Xóa ${item.file.name} khỏi hàng chờ`}
              >
                <X />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ValidationSummary({
  issues,
  onAction,
}: {
  issues: UploadValidationIssue[];
  onAction: (issue: UploadValidationIssue) => void;
}) {
  if (issues.length === 0) return null;
  const blocking = issues.filter((issue) => issue.level === 'BLOCKING').length;
  const review = issues.filter((issue) => issue.level === 'REVIEW').length;

  return (
    <section
      aria-label="Cảnh báo ảnh tải lên"
      className={`rounded-lg border bg-white ${blocking > 0 ? 'border-red-200' : review > 0 ? 'border-amber-200' : 'border-blue-200'}`}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        {blocking > 0 ? (
          <CircleAlert className="size-4 text-red-600" />
        ) : review > 0 ? (
          <AlertTriangle className="size-4 text-amber-600" />
        ) : (
          <Info className="size-4 text-blue-600" />
        )}
        <p className="text-xs font-semibold text-slate-800">
          {blocking > 0
            ? `${blocking} vấn đề cần xử lý trước khi tiếp tục`
            : review > 0
              ? `${review} cảnh báo cần kiểm tra`
              : 'Thông tin về phiên import'}
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {issues.slice(0, 5).map((issue) => (
          <li key={issue.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
            <span
              className={`size-1.5 shrink-0 rounded-full ${issue.level === 'BLOCKING' ? 'bg-red-500' : issue.level === 'REVIEW' ? 'bg-amber-500' : 'bg-blue-500'}`}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 text-slate-700">{issue.message}</span>
            {issue.actionLabel && (
              <Button variant="ghost" size="xs" onClick={() => onAction(issue)}>
                {issue.actionLabel}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {issues.length > 5 && (
        <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
          Còn {issues.length - 5} cảnh báo khác trong danh sách ảnh.
        </p>
      )}
    </section>
  );
}

function MetadataStep({
  metadata,
  saving,
  onChange,
  onBack,
  onSubmit,
}: {
  metadata: ExamMetadata;
  saving: boolean;
  onChange: (metadata: ExamMetadata) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const patch = (value: Partial<ExamMetadata>) => onChange({ ...metadata, ...value });
  const codeWarning =
    codesNeedConfirmation(metadata.rawExamCode, metadata.rawAnswerCode) &&
    !metadata.answerCodeConfirmed;
  const rightsWarning = ['UNVERIFIED', 'RESTRICTED'].includes(metadata.rightsStatus);

  return (
    <form
      className="space-y-4 pb-24"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Thông tin đề thi</h1>
        <p className="mt-1 text-sm text-slate-600">
          Bổ sung thông tin giúp hệ thống phân loại và ghép đáp án chính xác hơn.
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">Thông tin cơ bản</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tên đề" required>
            <Input
              value={metadata.name}
              onChange={(event) => patch({ name: event.target.value })}
              required
            />
          </Field>
          <Field label="Môn học" required>
            <select
              className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={metadata.subjectId ?? ''}
              onChange={(event) =>
                patch({ subjectId: event.target.value as ExamMetadata['subjectId'] })
              }
              required
            >
              <option value="">Chọn môn</option>
              {SUBJECT_ID_VALUES.map((subject) => (
                <option key={subject} value={subject}>
                  {SUBJECT_LABELS[subject]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lớp" required>
            <select
              className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={metadata.grade ?? ''}
              onChange={(event) => patch({ grade: Number(event.target.value) as 10 | 11 | 12 })}
              required
            >
              <option value="">Chọn lớp</option>
              {[10, 11, 12].map((grade) => (
                <option key={grade} value={grade}>
                  Lớp {grade}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Loại đề">
            <select
              className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={metadata.examType ?? ''}
              onChange={(event) =>
                patch({ examType: event.target.value as ExamMetadata['examType'] })
              }
            >
              <option value="">Chọn loại đề</option>
              {EXAM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {EXAM_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Năm">
            <Input
              type="number"
              min={2000}
              max={2100}
              value={metadata.year ?? ''}
              onChange={(event) =>
                patch({ year: event.target.value ? Number(event.target.value) : undefined })
              }
            />
          </Field>
          <Field label="Thời gian làm bài (phút)">
            <Input
              type="number"
              min={1}
              max={600}
              value={metadata.durationMinutes ?? ''}
              onChange={(event) =>
                patch({
                  durationMinutes: event.target.value ? Number(event.target.value) : undefined,
                })
              }
            />
          </Field>
          <Field label="Mã đề">
            <Input
              value={metadata.rawExamCode}
              onChange={(event) =>
                patch({ rawExamCode: event.target.value, answerCodeConfirmed: false })
              }
            />
          </Field>
          <Field label="Chương trình học">
            <Input
              value={metadata.curriculumProgram}
              onChange={(event) => patch({ curriculumProgram: event.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">Nguồn và quyền sử dụng</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tên nguồn">
            <Input
              value={metadata.sourceName}
              onChange={(event) => patch({ sourceName: event.target.value })}
            />
          </Field>
          <Field label="URL nguồn">
            <Input
              type="url"
              value={metadata.sourceUrl}
              onChange={(event) => patch({ sourceUrl: event.target.value })}
            />
          </Field>
          <Field label="Tác giả hoặc đơn vị">
            <Input
              value={metadata.publisher}
              onChange={(event) => patch({ publisher: event.target.value })}
            />
          </Field>
          <Field label="Quyền sử dụng" required>
            <select
              className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={metadata.rightsStatus}
              onChange={(event) =>
                patch({ rightsStatus: event.target.value as ExamMetadata['rightsStatus'] })
              }
            >
              {RIGHTS_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {RIGHTS_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Ghi chú nguồn">
            <Textarea
              rows={2}
              value={metadata.sourceNote}
              onChange={(event) => patch({ sourceNote: event.target.value })}
            />
          </Field>
        </div>
        {rightsWarning && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Nội dung chưa có quyền sử dụng rõ ràng. Bản nhập chỉ được giữ ở trạng thái nháp cho đến
            khi nguồn được xác minh.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">Ghép đáp án</h2>
        <div className="mt-3 flex flex-wrap gap-4">
          {[
            ['INCLUDED', 'Đáp án có trong ảnh đã tải'],
            ['UPLOAD_LATER', 'Sẽ bổ sung đáp án sau'],
            ['UNAVAILABLE', 'Không có đáp án'],
          ].map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="radio"
                name="answerMatchingMode"
                value={value}
                checked={metadata.answerMatchingMode === value}
                onChange={() =>
                  patch({ answerMatchingMode: value as ExamMetadata['answerMatchingMode'] })
                }
              />
              {label}
            </label>
          ))}
        </div>
        {metadata.answerMatchingMode === 'INCLUDED' && (
          <div className="mt-3 max-w-xs">
            <Field label="Mã đáp án (nếu có)">
              <Input
                value={metadata.rawAnswerCode}
                onChange={(event) =>
                  patch({ rawAnswerCode: event.target.value, answerCodeConfirmed: false })
                }
              />
            </Field>
          </div>
        )}
        {codeWarning && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span>
              Mã đề {metadata.rawExamCode} và mã đáp án {metadata.rawAnswerCode} có thể tương ứng.
              Vui lòng xác nhận trước khi ghép.
            </span>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => patch({ answerCodeConfirmed: true })}
            >
              Xác nhận ghép
            </Button>
          </div>
        )}
      </section>

      <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Button type="button" variant="outline" onClick={onBack}>
          Quay lại
        </Button>
        <Button
          type="submit"
          disabled={
            saving || !metadata.name || !metadata.subjectId || !metadata.grade || codeWarning
          }
        >
          {saving ? <LoaderCircle className="animate-spin" /> : null}
          {saving ? 'Đang lưu…' : 'Lưu và xử lý'}
        </Button>
      </div>
    </form>
  );
}

function ProcessingStep({
  session,
  onProcess,
  onBack,
  processing,
}: {
  session: ImportSession;
  onProcess: () => void;
  onBack: () => void;
  processing: boolean;
}) {
  function stageIcon(status: ImportSession['pipelineStages'][number]['status']) {
    if (status === 'PROCESSING')
      return <LoaderCircle className="size-4 animate-spin text-blue-600" />;
    if (status === 'COMPLETED') return <Check className="size-4 text-emerald-600" />;
    if (status === 'WARNING') return <AlertTriangle className="size-4 text-amber-600" />;
    if (status === 'FAILED') return <CircleAlert className="size-4 text-red-600" />;
    return <Circle className="size-4 text-slate-300" />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-12">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Xử lý đề thi</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ảnh gốc và thông tin đề đã được lưu trước khi hệ thống bắt đầu trích xuất.
        </p>
      </header>
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Nhận diện bố cục và câu hỏi</h2>
            <p className="mt-1 text-xs text-slate-500">
              Nếu dịch vụ thất bại, phiên nháp và toàn bộ ảnh đã tải vẫn được giữ nguyên.
            </p>
          </div>
          {session.extractionProvider === 'UNAVAILABLE' && (
            <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
              Chưa cấu hình bộ nhận diện
            </span>
          )}
        </div>
        <ol className="mt-4 divide-y divide-slate-100 border-y border-slate-100">
          {session.pipelineStages.map((stage) => (
            <li key={stage.id} className="flex items-center gap-3 py-2.5">
              {stageIcon(stage.status)}
              <span className="flex-1 text-xs font-medium text-slate-700">
                {PIPELINE_STAGE_LABELS[stage.id]}
              </span>
              <span className="text-[11px] text-slate-500">{stage.message}</span>
            </li>
          ))}
        </ol>
      </section>
      {session.processingError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">
            Không thể hoàn tất bước{' '}
            {PIPELINE_STAGE_LABELS[session.processingError.stage].toLowerCase()}
          </p>
          <p className="mt-1 text-xs leading-5 text-red-700">{session.processingError.reason}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={onProcess}>
              <RefreshCw /> Thử lại
            </Button>
            <Button variant="ghost" onClick={onBack}>
              Quay lại ảnh
            </Button>
          </div>
        </div>
      )}
      {!processing && session.status !== 'REVIEW_REQUIRED' && !session.processingError && (
        <div className="flex justify-end">
          <Button onClick={onProcess} disabled={session.extractionProvider === 'UNAVAILABLE'}>
            Bắt đầu xử lý
          </Button>
        </div>
      )}
      {processing && (
        <p role="status" aria-live="polite" className="text-center text-xs text-slate-600">
          Đang xử lý dữ liệu thật. Vui lòng giữ trang này mở…
        </p>
      )}
    </div>
  );
}

export function ExamImageImport() {
  const router = useRouter();
  const [session, setSession] = React.useState<ImportSession | null>(null);
  const [pending, setPending] = React.useState<PendingFile[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkType, setBulkType] = React.useState<PageType>('EXAM_PAGE');
  const [uploading, setUploading] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [saveState, setSaveState] = React.useState<ImportSaveState>('IDLE');
  const [savedAt, setSavedAt] = React.useState<Date>();
  const [error, setError] = React.useState('');
  const [previewPage, setPreviewPage] = React.useState<SourcePage | null>(null);
  const [confirmIntent, setConfirmIntent] = React.useState<'LEAVE' | 'CANCEL' | null>(null);
  const [metadataDraft, setMetadataDraft] = React.useState<ExamMetadata | null>(null);
  const [metadataDirty, setMetadataDirty] = React.useState(false);
  const mutationQueue = React.useRef<Promise<void>>(Promise.resolve());
  const current = session?.currentStep ?? 1;
  const issues = session ? validateExamUpload(session) : [];
  const hasBlockingIssue = issues.some((issue) => issue.level === 'BLOCKING');
  const queuedCount = pending.filter((item) => item.status === 'READY').length;
  const failedCount = pending.filter((item) => item.status === 'FAILED').length;
  const hasUnsavedLocalChanges = queuedCount > 0 || uploading || metadataDirty;

  React.useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('sessionId');
    if (!sessionId) return;
    void fetch(`/api/content-import/sessions/${sessionId}`).then(async (response) => {
      if (!response.ok) return;
      const restored = (await response.json()) as ImportSession;
      setSession(restored);
      setMetadataDraft(restored.examMetadata ?? null);
      setSavedAt(new Date(restored.updatedAt));
      setSaveState('SAVED');
    });
  }, []);

  React.useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent): void {
      if (!hasUnsavedLocalChanges && saveState !== 'SAVING') return;
      event.preventDefault();
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [hasUnsavedLocalChanges, saveState]);

  async function addFiles(files: File[]): Promise<void> {
    setError('');
    const usedSlots = (session?.pages.length ?? 0) + pending.length;
    const available = Math.max(0, MAX_FILES - usedSlots);
    const next: PendingFile[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const base = {
        id: crypto.randomUUID(),
        file,
        width: 0,
        height: 0,
        progress: 0,
      };
      if (index >= available) {
        next.push({
          ...base,
          status: 'FAILED',
          retryable: false,
          error: 'Phiên import đã đạt giới hạn 24 ảnh.',
        });
        continue;
      }
      if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
        next.push({
          ...base,
          status: 'FAILED',
          retryable: false,
          error: 'Chỉ chấp nhận JPG, JPEG, PNG hoặc WEBP.',
        });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        next.push({
          ...base,
          status: 'FAILED',
          retryable: false,
          error: 'Ảnh vượt quá giới hạn 12 MB.',
        });
        continue;
      }
      try {
        const dimensions = await imageDimensions(file);
        next.push({ ...base, ...dimensions, status: 'READY', retryable: true });
      } catch {
        next.push({
          ...base,
          status: 'FAILED',
          retryable: false,
          error: 'Không thể đọc nội dung ảnh.',
        });
      }
    }
    setPending((items) => [...items, ...next]);
  }

  function uploadOne(
    item: PendingFile,
    activeSession: ImportSession | null
  ): Promise<ImportSession> {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('files', item.file);
      form.append(
        'manifest',
        JSON.stringify([{ name: item.file.name, width: item.width, height: item.height }])
      );
      const request = new XMLHttpRequest();
      request.open(
        'POST',
        activeSession
          ? `/api/content-import/sessions/${activeSession.id}/pages`
          : '/api/content-import/exams/images'
      );
      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const progress = Math.round((event.loaded / event.total) * 100);
        setPending((items) =>
          items.map((candidate) =>
            candidate.id === item.id ? { ...candidate, progress } : candidate
          )
        );
      };
      request.onload = () => {
        let result: (ImportSession & { error?: string }) | null = null;
        try {
          result = JSON.parse(request.responseText) as ImportSession & { error?: string };
        } catch {
          reject(new Error('Máy chủ trả về phản hồi không hợp lệ.'));
          return;
        }
        if (request.status >= 200 && request.status < 300) resolve(result);
        else reject(new Error(result.error ?? 'Không thể tải ảnh.'));
      };
      request.onerror = () => reject(new Error('Mất kết nối khi tải ảnh.'));
      request.send(form);
    });
  }

  async function uploadFiles(): Promise<void> {
    const ready = pending.filter((item) => item.status === 'READY');
    if (ready.length === 0) return;
    setUploading(true);
    setError('');
    let activeSession = session;
    for (const item of ready) {
      setPending((items) =>
        items.map((candidate) =>
          candidate.id === item.id
            ? { ...candidate, status: 'UPLOADING', progress: 0, error: undefined }
            : candidate
        )
      );
      try {
        activeSession = await uploadOne(item, activeSession);
        setSession(activeSession);
        setMetadataDraft(activeSession.examMetadata ?? null);
        setSavedAt(new Date(activeSession.updatedAt));
        setSaveState('SAVED');
        window.history.replaceState(
          null,
          '',
          `/admin/exams/import/images?sessionId=${activeSession.id}`
        );
        setPending((items) =>
          items.map((candidate) =>
            candidate.id === item.id ? { ...candidate, status: 'DONE', progress: 100 } : candidate
          )
        );
      } catch (reason: unknown) {
        const message = reason instanceof Error ? reason.message : 'Không thể tải ảnh.';
        setPending((items) =>
          items.map((candidate) =>
            candidate.id === item.id
              ? { ...candidate, status: 'FAILED', retryable: true, error: message }
              : candidate
          )
        );
      }
    }
    setPending((items) => items.filter((item) => item.status !== 'DONE'));
    setUploading(false);
  }

  async function patchSession(body: object): Promise<ImportSession | null> {
    if (!session) return null;
    setSaveState('SAVING');
    const sessionId = session.id;
    const includesMetadata = Object.prototype.hasOwnProperty.call(body, 'examMetadata');
    const request = mutationQueue.current.then(async () => {
      const response = await fetch(`/api/content-import/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as ImportSession & { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Không thể lưu phiên nhập.');
      setSession(result);
      if (includesMetadata) {
        setMetadataDraft(result.examMetadata ?? null);
        setMetadataDirty(false);
      }
      setSaveState('SAVED');
      setSavedAt(new Date(result.updatedAt));
      return result;
    });
    mutationQueue.current = request.then(
      () => undefined,
      () => undefined
    );
    try {
      return await request;
    } catch (reason: unknown) {
      setSaveState('ERROR');
      throw reason;
    }
  }

  async function updatePages(pages: SourcePage[]): Promise<void> {
    const previous = session;
    if (!previous) return;
    setSession({ ...previous, pages });
    try {
      await patchSession({
        pageUpdates: pages.map(({ id, order, pageType, rotation, crop }) => ({
          id,
          order,
          pageType,
          rotation,
          crop,
        })),
      });
    } catch (reason: unknown) {
      setSession(previous);
      setError(reason instanceof Error ? reason.message : 'Không thể cập nhật trang.');
    }
  }

  async function deletePage(page: SourcePage): Promise<void> {
    if (!session || !window.confirm(`Xóa ảnh “${page.originalFileName}” khỏi phiên import?`))
      return;
    setSaveState('SAVING');
    const response = await fetch(`/api/content-import/sessions/${session.id}/pages/${page.id}`, {
      method: 'DELETE',
    });
    const result = (await response.json()) as ImportSession & { error?: string };
    if (!response.ok) {
      setSaveState('ERROR');
      setError(result.error ?? 'Không thể xóa ảnh.');
      return;
    }
    setSession(result);
    setSavedAt(new Date(result.updatedAt));
    setSaveState('SAVED');
    setSelected((ids) => {
      const next = new Set(ids);
      next.delete(page.id);
      return next;
    });
    if (previewPage?.id === page.id) setPreviewPage(null);
  }

  async function replacePage(page: SourcePage, file: File): Promise<void> {
    if (!session) return;
    if (!ACCEPTED_IMAGE_TYPES.has(file.type) || file.size > MAX_FILE_SIZE) {
      setError('Ảnh thay thế phải là JPG, JPEG, PNG hoặc WEBP và không vượt quá 12 MB.');
      return;
    }
    const dimensions = await imageDimensions(file);
    const form = new FormData();
    form.append('file', file);
    form.append('width', String(dimensions.width));
    form.append('height', String(dimensions.height));
    setSaveState('SAVING');
    const response = await fetch(`/api/content-import/sessions/${session.id}/pages/${page.id}`, {
      method: 'PUT',
      body: form,
    });
    const result = (await response.json()) as ImportSession & { error?: string };
    if (!response.ok) {
      setSaveState('ERROR');
      setError(result.error ?? 'Không thể thay ảnh.');
      return;
    }
    setSession(result);
    setSavedAt(new Date(result.updatedAt));
    setSaveState('SAVED');
  }

  async function startProcessing(): Promise<void> {
    if (!session) return;
    setProcessing(true);
    setError('');
    const poll = window.setInterval(() => {
      void fetch(`/api/content-import/sessions/${session.id}`).then(async (response) => {
        if (response.ok) setSession((await response.json()) as ImportSession);
      });
    }, 1000);
    try {
      const response = await fetch(`/api/content-import/sessions/${session.id}/process`, {
        method: 'POST',
      });
      const result = (await response.json()) as ImportSession & { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Không thể xử lý ảnh.');
      setSession(result);
      router.push(`/admin/exams/import/${session.id}/review`);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Không thể xử lý ảnh.');
      const latest = await fetch(`/api/content-import/sessions/${session.id}`);
      if (latest.ok) setSession((await latest.json()) as ImportSession);
    } finally {
      window.clearInterval(poll);
      setProcessing(false);
    }
  }

  async function saveDraftAndExit(): Promise<void> {
    if (!session) {
      if (pending.length > 0) setError('Hãy tải ảnh lên trước khi lưu bản nháp.');
      else router.push('/admin/exams');
      return;
    }
    if (queuedCount > 0 || uploading) {
      setError('Còn ảnh chưa tải lên. Hãy hoàn tất hoặc xóa chúng khỏi hàng chờ trước khi thoát.');
      return;
    }
    try {
      if (metadataDirty && metadataDraft) {
        await patchSession({ examMetadata: metadataDraft, advanceMetadata: false });
      } else {
        await mutationQueue.current;
      }
      router.push('/admin/exams');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Không thể lưu bản nháp.');
    }
  }

  async function saveDraft(): Promise<void> {
    if (!session) {
      setError('Hãy tải ít nhất một ảnh lên trước khi lưu bản nháp.');
      return;
    }
    if (queuedCount > 0 || uploading) {
      setError('Còn ảnh chưa tải lên. Hãy tải hoặc xóa ảnh khỏi hàng chờ trước khi lưu.');
      return;
    }
    try {
      if (metadataDirty && metadataDraft) {
        await patchSession({ examMetadata: metadataDraft, advanceMetadata: false });
      } else {
        setSaveState('SAVING');
        await mutationQueue.current;
        setSaveState('SAVED');
        setSavedAt(new Date());
      }
    } catch (reason: unknown) {
      setSaveState('ERROR');
      setError(reason instanceof Error ? reason.message : 'Không thể lưu bản nháp.');
    }
  }

  async function confirmNavigation(): Promise<void> {
    const intent = confirmIntent;
    setConfirmIntent(null);
    if (intent === 'CANCEL') {
      if (!session) {
        router.push('/admin/exams');
        return;
      }
      const response = await fetch(`/api/content-import/sessions/${session.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setError(result.error ?? 'Không thể hủy phiên import.');
        return;
      }
      router.push('/admin/exams');
      return;
    }
    if (intent === 'LEAVE') {
      if (metadataDirty && metadataDraft && session) {
        try {
          await patchSession({ examMetadata: metadataDraft, advanceMetadata: false });
        } catch (reason: unknown) {
          setError(reason instanceof Error ? reason.message : 'Không thể lưu thay đổi.');
          return;
        }
      }
      router.push('/admin/exams');
    }
  }

  function handleValidationAction(issue: UploadValidationIssue): void {
    if (!session) return;
    if (issue.action === 'VIEW_PAGE' && issue.pageId) {
      const page = session.pages.find((candidate) => candidate.id === issue.pageId);
      if (page) setPreviewPage(page);
      return;
    }
    if (issue.action === 'DELETE_DUPLICATE' && issue.pageId) {
      const page = session.pages.find((candidate) => candidate.id === issue.pageId);
      if (page) void deletePage(page);
      return;
    }
    document.getElementById('exam-image-list')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <ImportWorkflowHeader
        saveState={saveState}
        savedAt={savedAt}
        hasSession={Boolean(session)}
        onBack={() =>
          hasUnsavedLocalChanges ? setConfirmIntent('LEAVE') : router.push('/admin/exams')
        }
        onSaveAndExit={() => void saveDraftAndExit()}
        onCancel={() => setConfirmIntent('CANCEL')}
      />
      <ImportStepper
        current={current}
        failed={session?.status === 'FAILED'}
        onStepChange={(step) => {
          if (session && step < current) {
            void patchSession({ currentStep: step, status: step === 1 ? 'DRAFT' : session.status });
          }
        }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-6 lg:py-6">
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError('')}
                className="shrink-0 rounded p-1 outline-none hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-500"
                aria-label="Đóng thông báo lỗi"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {current === 1 && (
            <div className="space-y-4 pb-24">
              <header>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  Import đề từ ảnh
                </h1>
                <p className="mt-1 max-w-4xl text-sm leading-5 text-slate-600">
                  Tải lên các trang của cùng một đề, bao gồm trang đề, đáp án hoặc lời giải. Em có
                  thể sắp xếp và phân loại lại trước khi hệ thống xử lý.
                </p>
                <p className="mt-1.5 text-xs text-slate-500">
                  Mỗi phiên import chỉ nên chứa nội dung của một đề thi.
                </p>
              </header>

              <ImageUploadDropzone
                compact={Boolean(session)}
                disabled={uploading || (session?.pages.length ?? 0) + pending.length >= MAX_FILES}
                remaining={Math.max(0, MAX_FILES - (session?.pages.length ?? 0) - pending.length)}
                onFiles={(files) => void addFiles(files)}
              />
              <UploadQueue
                pending={pending}
                uploading={uploading}
                onUpload={() => void uploadFiles()}
                onRetry={(id) =>
                  setPending((items) =>
                    items.map((item) =>
                      item.id === id
                        ? { ...item, status: 'READY', progress: 0, error: undefined }
                        : item
                    )
                  )
                }
                onRemove={(id) => setPending((items) => items.filter((item) => item.id !== id))}
              />

              {session && (
                <>
                  <ValidationSummary issues={issues} onAction={handleValidationAction} />
                  <div id="exam-image-list">
                    <ExamImageList
                      session={session}
                      selected={selected}
                      bulkType={bulkType}
                      onSelectedChange={setSelected}
                      onBulkTypeChange={setBulkType}
                      onBulkApply={() =>
                        void updatePages(
                          session.pages.map((page) =>
                            selected.has(page.id) ? { ...page, pageType: bulkType } : page
                          )
                        )
                      }
                      onAddFiles={(files) => void addFiles(files)}
                      onUpdate={(pages) => void updatePages(pages)}
                      onDelete={(page) => void deletePage(page)}
                      onReplace={(page, file) => void replacePage(page, file)}
                      onPreview={setPreviewPage}
                    />
                  </div>

                  <footer className="sticky bottom-0 z-20 -mx-4 flex min-h-16 items-center gap-3 border-t border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
                    <Button
                      variant="ghost"
                      className="hidden text-red-600 hover:bg-red-50 hover:text-red-700 sm:inline-flex"
                      onClick={() => setConfirmIntent('CANCEL')}
                    >
                      <Trash2 /> Hủy phiên import
                    </Button>
                    <div className="hidden min-w-0 flex-1 text-center text-xs text-slate-500 md:block">
                      <span>{session.pages.length} ảnh đã tải</span>
                      {issues.filter((issue) => issue.level === 'REVIEW').length > 0 && (
                        <span>
                          {' '}
                          · {issues.filter((issue) => issue.level === 'REVIEW').length} cảnh báo cần
                          kiểm tra
                        </span>
                      )}
                      {failedCount > 0 && <span> · {failedCount} ảnh tải lỗi</span>}
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <Button variant="outline" onClick={() => void saveDraft()}>
                        Lưu nháp
                      </Button>
                      <div className="text-right">
                        {hasBlockingIssue && (
                          <p
                            id="continue-disabled-reason"
                            className="mb-1 text-[10px] text-red-600"
                          >
                            Hãy gắn ít nhất một ảnh là Trang đề
                          </p>
                        )}
                        <Button
                          disabled={hasBlockingIssue || uploading || queuedCount > 0}
                          aria-describedby={
                            hasBlockingIssue ? 'continue-disabled-reason' : undefined
                          }
                          onClick={() => void patchSession({ currentStep: 2 })}
                        >
                          {uploading ? <LoaderCircle className="animate-spin" /> : null}
                          {uploading ? 'Đang tải ảnh…' : 'Tiếp tục'}
                        </Button>
                      </div>
                    </div>
                  </footer>
                </>
              )}
            </div>
          )}

          {current === 2 && session && metadataDraft && (
            <MetadataStep
              metadata={metadataDraft}
              saving={saveState === 'SAVING'}
              onChange={(metadata) => {
                setMetadataDraft(metadata);
                setMetadataDirty(true);
              }}
              onBack={() => void patchSession({ currentStep: 1, status: 'DRAFT' })}
              onSubmit={() => {
                void patchSession({ examMetadata: metadataDraft, advanceMetadata: true })
                  .then(() => startProcessing())
                  .catch((reason: unknown) =>
                    setError(
                      reason instanceof Error ? reason.message : 'Không thể lưu thông tin đề.'
                    )
                  );
              }}
            />
          )}

          {current === 3 && session && (
            <ProcessingStep
              session={session}
              processing={processing}
              onProcess={() => void startProcessing()}
              onBack={() => void patchSession({ currentStep: 1, status: 'DRAFT' })}
            />
          )}
        </div>
      </div>

      {session && (
        <ImagePreviewDialog
          page={previewPage}
          sessionId={session.id}
          open={Boolean(previewPage)}
          onOpenChange={(open) => {
            if (!open) setPreviewPage(null);
          }}
        />
      )}

      <Dialog
        open={confirmIntent !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmIntent(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmIntent === 'CANCEL' ? 'Hủy phiên import?' : 'Rời khỏi trang import?'}
            </DialogTitle>
            <DialogDescription>
              {confirmIntent === 'CANCEL'
                ? 'Phiên nháp và các ảnh đã tải sẽ bị xóa. Thao tác này không thể hoàn tác.'
                : hasUnsavedLocalChanges
                  ? 'Các ảnh chưa tải lên sẽ không được lưu. Thay đổi thông tin đề sẽ được lưu trước khi rời đi.'
                  : 'Phiên import đã được lưu và có thể tiếp tục sau.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmIntent(null)}>
              Ở lại
            </Button>
            <Button
              variant={confirmIntent === 'CANCEL' ? 'destructive' : 'default'}
              onClick={() => void confirmNavigation()}
            >
              {confirmIntent === 'CANCEL' ? 'Hủy phiên import' : 'Rời trang'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
