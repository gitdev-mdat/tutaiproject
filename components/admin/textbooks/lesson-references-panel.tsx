'use client';

import * as React from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  Lightbulb,
  Link2,
  Loader2,
  Pencil,
  RotateCcw,
  Search,
  Sparkles,
  Unlink,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { InlineText, RichText } from '@/components/learning/rich-text';
import { findMathIssues, hasMathIssues } from '@/lib/content/math-notation';
import { entrySpan, formatSpan, type PageSpan } from '@/lib/textbook-reference/lesson-coverage';
import { formatPageList } from '@/lib/textbook-reference/section-state';
import type { LessonTextbookReadiness } from '@/lib/textbook-reference/lesson-view';
import { PROMPT_VERSION } from '@/lib/textbook-reference/prompt-version';
import type {
  TextbookArtifact,
  TextbookExtractionJob,
  TextbookTocEntry,
} from '@/lib/textbook-reference/types';
import {
  textbookApi,
  type LessonRecommendation,
  type LessonSection,
  type LessonView,
} from './textbook-client';
import { JobLine, KIND_LABELS, usePolling, WorkerNotice } from './textbook-status';

const MAX_PAGES = 6;

const TONE: Record<LessonSection['state']['tone'], string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  waiting: 'bg-amber-50 text-amber-800 ring-amber-200',
  working: 'bg-blue-50 text-blue-800 ring-blue-200',
  attention: 'bg-amber-50 text-amber-900 ring-amber-200',
  error: 'bg-red-50 text-red-700 ring-red-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

/**
 * The textbook side of one lesson, as one path: link a section → extract its
 * pages → review what was extracted → approved extracts are what AI drafting
 * reads. Every state shown comes from stored jobs and artifacts; nothing here
 * reaches students.
 */
export function LessonReferencesPanel({
  nodeId,
  onOpenLibrary,
  onReadinessChange,
  onOpenAiDraft,
}: {
  nodeId: string;
  onOpenLibrary: () => void;
  onReadinessChange?: (readiness: LessonTextbookReadiness) => void;
  /** Opens AI drafting once material is ready. */
  onOpenAiDraft?: () => void;
}) {
  const [view, setView] = React.useState<LessonView | null>(null);
  const [error, setError] = React.useState<{ text: string; unavailable?: boolean } | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [linking, setLinking] = React.useState(false);

  const load = React.useCallback(async () => {
    const result = await textbookApi.lesson(nodeId);
    if (!result.ok) {
      setError({ text: result.error, unavailable: result.status === 503 });
      return;
    }
    setError(null);
    setView(result.data);
    onReadinessChange?.(result.data.readiness);
  }, [nodeId, onReadinessChange]);

  React.useEffect(() => {
    // Loading the lesson's references from the server is an external sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const pending =
    view?.jobs.filter((job) => job.status === 'QUEUED' || job.status === 'RUNNING') ?? [];
  usePolling(pending.length > 0, load);

  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 5000);
  };

  if (error && !view)
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
        <p className="font-semibold text-slate-900">
          {error.unavailable
            ? 'Kho sách tham chiếu chưa được bật trên máy chủ này.'
            : 'Không tải được tư liệu.'}
        </p>
        <p className="mt-1 text-slate-600">
          {error.unavailable
            ? 'Cần cấu hình PostgreSQL và bucket Storage riêng tư cho sách. Bài học vẫn soạn bình thường.'
            : error.text}
        </p>
        {!error.unavailable && (
          <Button className="mt-3" size="sm" variant="outline" onClick={() => void load()}>
            Thử lại
          </Button>
        )}
      </div>
    );
  if (!view)
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Đang tải tư liệu">
        {[0, 1].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
        ))}
      </div>
    );

  const link = async (
    documentId: string,
    entry: TextbookTocEntry,
    range: PageSpan | null,
    message: string
  ) => {
    const result = await textbookApi.link(documentId, entry.id, view.node.id, range);
    if (!result.ok) return result.error;
    setLinking(false);
    await load();
    flash(message);
    return null;
  };

  // Not using a suggestion stores a declined link, so it is not suggested again; linking undoes it.
  const decline = async (item: LessonRecommendation) => {
    const result = await textbookApi.unlink(item.documentId, item.entry.id, view.node.id);
    if (!result.ok) return result.error;
    await load();
    flash(`Đã ẩn gợi ý “${item.entry.originalHeading}”. Vẫn tìm lại được trong mục lục.`);
    return null;
  };

  // A question may be paired with a solution extracted under another linked section.
  const lessonArtifacts = [
    ...new Map(
      view.sections.flatMap((section) => section.artifacts).map((item) => [item.id, item])
    ).values(),
  ];

  return (
    <div className="space-y-4">
      <ReadinessSummary
        readiness={view.readiness}
        onOpenAiDraft={onOpenAiDraft}
        onOpenLibrary={onOpenLibrary}
      />
      <WorkerNotice worker={view.worker} jobs={pending} />
      <div
        role="status"
        aria-live="polite"
        className={notice ? 'text-sm font-medium text-emerald-700' : 'sr-only'}
      >
        {notice}
      </div>

      {view.sections.map((section) => (
        <SectionCard
          key={section.mapping.id}
          section={section}
          lessonArtifacts={lessonArtifacts}
          nodeId={nodeId}
          otherLessons={view.otherLinks.filter(
            (item) => item.documentId === section.document.id && item.entryId === section.entry.id
          )}
          onChanged={load}
          onFlash={flash}
        />
      ))}

      {(view.recommendations.length > 0 || view.coverage.some((item) => item.previous)) && (
        <Recommendations view={view} onLink={link} onDecline={decline} />
      )}

      {view.sections.length === 0 && view.recommendations.length === 0 ? (
        <LinkPicker view={view} onOpenLibrary={onOpenLibrary} onLink={link} />
      ) : linking ? (
        <LinkPicker
          view={view}
          onCancel={() => setLinking(false)}
          onOpenLibrary={onOpenLibrary}
          onLink={link}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setLinking(true)}>
            <Search /> Tìm mục khác trong mục lục
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpenLibrary}>
            <BookOpen /> Thư viện sách
          </Button>
        </div>
      )}
    </div>
  );
}

const STEPS = ['Liên kết mục sách', 'Trích trang', 'Duyệt nội dung', 'AI dùng được'] as const;

/**
 * The four steps with their real counts and the one thing to do next. Linked is
 * not usable: only the last step's number is what AI drafting will read.
 */
function ReadinessSummary({
  readiness,
  onOpenAiDraft,
  onOpenLibrary,
}: {
  readiness: LessonTextbookReadiness;
  onOpenAiDraft?: () => void;
  onOpenLibrary: () => void;
}) {
  const { linkedSections, approved, needsReview, activeJobs, failedSections, notExtracted } =
    readiness;
  const extracted = linkedSections - notExtracted;
  const marks = [
    linkedSections > 0 ? `${linkedSections} mục` : 'chưa có',
    linkedSections === 0
      ? '—'
      : activeJobs > 0
        ? `đang xử lý ${activeJobs}`
        : `${extracted}/${linkedSections} mục`,
    needsReview > 0 ? `${needsReview} chờ duyệt` : approved > 0 ? 'xong' : '—',
    approved > 0 ? `${approved} trích đoạn` : 'chưa có',
  ];
  const done = [linkedSections > 0, extracted > 0, approved > 0, approved > 0];
  const next =
    linkedSections === 0
      ? 'Liên kết mục sách dạy nội dung bài này. Liên kết chỉ cho biết bài dùng phần nào của sách; AI chưa đọc gì.'
      : approved > 0
        ? `AI soạn nháp sẽ đọc nguyên văn ${approved} trích đoạn đã duyệt.${needsReview ? ` ${needsReview} trích đoạn khác chưa duyệt nên chưa được dùng.` : ''}`
        : needsReview > 0
          ? `Duyệt ${needsReview} trích đoạn bên dưới. Đến khi có trích đoạn đã duyệt, AI soạn nháp không dùng sách.`
          : activeJobs > 0
            ? 'Đang trích trang; kết quả sẽ hiện ở mục tương ứng để duyệt. AI chưa dùng gì từ sách.'
            : failedSections > 0
              ? 'Lần trích gần nhất bị lỗi. Xem lí do ở mục tương ứng và thử lại.'
              : 'Đã liên kết nhưng chưa trích trang nào. Chọn trang trong mục và bấm “Trích xuất”: liên kết thôi chưa cho AI đọc được nội dung sách.';
  return (
    <section
      aria-label="Tình trạng tư liệu sách cho AI"
      className="rounded-xl border border-slate-200 bg-white px-4 py-3"
    >
      <ol className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
        {STEPS.map((label, index) => (
          <li key={label} className="min-w-0">
            <p
              className={`flex items-center gap-1.5 text-xs font-medium ${done[index] ? 'text-slate-800' : 'text-slate-500'}`}
            >
              <span
                className={`flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] ring-1 ${
                  done[index]
                    ? index === 3
                      ? 'bg-emerald-600 text-white ring-emerald-600'
                      : 'bg-slate-800 text-white ring-slate-800'
                    : 'bg-white text-slate-500 ring-slate-300'
                }`}
                aria-hidden="true"
              >
                {done[index] ? <Check className="size-3" /> : index + 1}
              </span>
              {label}
            </p>
            <p
              className={`ml-5.5 text-sm tabular-nums ${index === 3 && approved > 0 ? 'font-semibold text-emerald-700' : 'text-slate-600'}`}
            >
              {marks[index]}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-3 border-t border-slate-100 pt-2.5 text-sm leading-6 text-slate-700">
        {next} <span className="text-slate-500">Học sinh không thấy tư liệu này.</span>
      </p>
      {(approved > 0 && onOpenAiDraft) || linkedSections === 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {approved > 0 && onOpenAiDraft && (
            <Button
              size="sm"
              variant="outline"
              className="border-violet-200 text-violet-700 hover:bg-violet-50"
              onClick={onOpenAiDraft}
            >
              <Sparkles /> Soạn nháp theo sách
            </Button>
          )}
          {linkedSections === 0 && (
            <Button size="sm" variant="ghost" onClick={onOpenLibrary}>
              <BookOpen /> Thư viện sách
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}

const STRENGTH: Record<LessonRecommendation['strength'], { label: string; className: string }> = {
  STRONG: { label: 'Phù hợp nhất', className: 'bg-blue-50 text-blue-800 ring-blue-200' },
  POSSIBLE: { label: 'Có thể dùng', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  WEAK: { label: 'Cần cân nhắc', className: 'bg-amber-50 text-amber-900 ring-amber-200' },
};

type LinkFn = (
  documentId: string,
  entry: TextbookTocEntry,
  range: PageSpan | null,
  message: string
) => Promise<string | null>;

/** Suggestions, visibly separate from confirmed links; nothing is linked until the Admin says so. */
function Recommendations({
  view,
  onLink,
  onDecline,
}: {
  view: LessonView;
  onLink: LinkFn;
  onDecline: (item: LessonRecommendation) => Promise<string | null>;
}) {
  return (
    <section
      aria-label="Gợi ý mục sách"
      className="rounded-xl border border-dashed border-blue-300 bg-blue-50/30"
    >
      <div className="px-4 pb-1 pt-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <Lightbulb className="size-4 text-blue-600" aria-hidden="true" /> Gợi ý, chưa liên kết
        </h3>
        {view.coverage
          .filter((item) => item.previous)
          .map((item) => (
            <p key={item.documentId} className="mt-1 text-xs leading-5 text-slate-600">
              {item.documentTitle}: bài trước trong chương trình, “{item.previous!.title}”, dùng{' '}
              {formatSpan(item.previous!.span)} (đến “
              <InlineText text={item.previous!.lastHeading} />
              ”).
              {item.next && (
                <>
                  {' '}
                  Bài sau, “{item.next.title}”, bắt đầu từ tr. {item.next.span.start}.
                </>
              )}
              {item.skipped.length > 0 && (
                <> {item.skipped.length} bài ở giữa chưa liên kết sách này.</>
              )}
            </p>
          ))}
      </div>
      {view.recommendations.length === 0 ? (
        <p className="px-4 pb-3 text-sm text-slate-500">
          Chưa có mục nào nối tiếp phù hợp. Tìm trong mục lục bên dưới.
        </p>
      ) : (
        <ul className="space-y-2 p-3">
          {view.recommendations.map((item) => (
            <RecommendationCard
              key={`${item.documentId}-${item.entry.id}`}
              item={item}
              onLink={onLink}
              onDecline={onDecline}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function RangeFields({
  span,
  limit,
  onChange,
}: {
  span: { start: string; end: string };
  limit: PageSpan | null;
  onChange: (span: { start: string; end: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs font-medium text-slate-600">
        Từ trang
        <Input
          value={span.start}
          inputMode="numeric"
          onChange={(event) => onChange({ ...span, start: event.target.value })}
          className="mt-1 h-8 w-20 bg-white"
        />
      </label>
      <label className="text-xs font-medium text-slate-600">
        đến trang
        <Input
          value={span.end}
          inputMode="numeric"
          onChange={(event) => onChange({ ...span, end: event.target.value })}
          className="mt-1 h-8 w-20 bg-white"
        />
      </label>
      {limit && <span className="pb-1.5 text-xs text-slate-500">trong {formatSpan(limit)}</span>}
    </div>
  );
}

function parseRange(value: { start: string; end: string }, limit: PageSpan | null) {
  const start = Number(value.start);
  const end = Number(value.end || value.start);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end < start)
    return { error: 'Nhập trang bắt đầu và kết thúc, ví dụ 21 và 24.' };
  if (limit && (start < limit.start || end > limit.end))
    return { error: `Trang phải nằm trong ${formatSpan(limit)} của mục này.` };
  return { span: { start, end } };
}

function RecommendationCard({
  item,
  onLink,
  onDecline,
}: {
  item: LessonRecommendation;
  onLink: LinkFn;
  onDecline: (item: LessonRecommendation) => Promise<string | null>;
}) {
  const whole = entrySpan(item.entry);
  const [editing, setEditing] = React.useState(false);
  const [range, setRange] = React.useState({
    start: String(item.span?.start ?? ''),
    end: String(item.span?.end ?? ''),
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const strength = STRENGTH[item.strength];

  const confirm = async (span: PageSpan | null) => {
    setBusy(true);
    setError(null);
    const message = `Đã liên kết “${item.entry.originalHeading}”${span ? ` (${formatSpan(span)})` : ''}. Bước tiếp theo: trích trang để AI có nội dung để đọc.`;
    const failure = await onLink(item.documentId, item.entry, span, message);
    setBusy(false);
    if (failure) setError(failure);
  };
  const decline = async () => {
    setBusy(true);
    setError(null);
    const result = await onDecline(item);
    setBusy(false);
    if (result) setError(result);
  };

  const parsed = parseRange(range, whole);
  return (
    <li className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
        <p className="min-w-0 flex-1 text-sm font-semibold leading-5 text-slate-900">
          <InlineText text={item.entry.originalHeading} />
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${strength.className}`}
        >
          {strength.label}
        </span>
      </div>
      <p className="text-xs text-slate-500">
        {item.documentTitle} · {formatSpan(item.span)}
        {item.partial && whole && <> (phần còn lại của mục {formatSpan(whole)})</>}
      </p>
      <ul className="mt-1.5 space-y-0.5 text-xs leading-5 text-slate-700">
        {item.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
        {item.linkedElsewhere.map((other) => (
          <li key={other.nodeId} className="text-slate-600">
            Đang dùng cho “{other.title}” ({formatSpan(other.span)}).
          </li>
        ))}
        {item.warnings.map((warning) => (
          <li key={warning} className="flex gap-1 text-amber-800">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            {warning}
          </li>
        ))}
      </ul>
      {editing && (
        <div className="mt-2 space-y-1.5 rounded-md bg-slate-50 p-2">
          <RangeFields span={range} limit={whole} onChange={setRange} />
          {parsed.error && <p className="text-xs text-amber-800">{parsed.error}</p>}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button
              size="sm"
              disabled={busy || !parsed.span}
              onClick={() => parsed.span && void confirm(parsed.span)}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Link2 />} Liên kết{' '}
              {parsed.span ? formatSpan(parsed.span) : ''}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
              Hủy
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void confirm(item.partial ? item.span : null)}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Link2 />} Liên kết{' '}
              {formatSpan(item.span)}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(true)}>
              <Pencil /> Chỉnh trang
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void decline()}>
              <X /> Không dùng
            </Button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-red-700">
          {error}
        </p>
      )}
    </li>
  );
}

function LinkPicker({
  view,
  onLink,
  onCancel,
  onOpenLibrary,
}: {
  view: LessonView;
  onLink: LinkFn;
  onCancel?: () => void;
  onOpenLibrary: () => void;
}) {
  const [query, setQuery] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const normalized = query.trim().toLocaleLowerCase('vi');
  const linked = new Set(
    view.sections.map((section) => `${section.document.id}\0${section.entry.id}`)
  );
  const results = normalized
    ? view.documents
        .flatMap((document) =>
          document.tocEntries
            .filter((entry) => entry.normalizedHeading.includes(normalized))
            .map((entry) => ({ documentId: document.id, documentTitle: document.title, entry }))
        )
        .filter((item) => !linked.has(`${item.documentId}\0${item.entry.id}`))
        .slice(0, 12)
    : [];

  const link = async (documentId: string, entry: TextbookTocEntry) => {
    setBusy(entry.id);
    setError(null);
    const failure = await onLink(
      documentId,
      entry,
      null,
      `Đã liên kết “${entry.originalHeading}”. Bước tiếp theo: trích trang để AI có nội dung để đọc.`
    );
    setBusy(null);
    if (failure) setError(failure);
  };

  if (!view.documents.length)
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
        <p className="font-semibold text-slate-900">Chưa có sách nào có mục lục.</p>
        <p className="mt-1 text-sm text-slate-500">
          Tải sách lên và đọc mục lục trong Thư viện sách.
        </p>
        <Button className="mt-4" size="sm" onClick={onOpenLibrary}>
          <BookOpen /> Mở thư viện sách
        </Button>
      </div>
    );

  return (
    <section aria-label="Tìm mục sách" className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <h3 className="flex-1 text-sm font-semibold text-slate-900">Tìm mục trong mục lục sách</h3>
        {onCancel && (
          <Button size="icon-sm" variant="ghost" aria-label="Đóng" onClick={onCancel}>
            <X />
          </Button>
        )}
      </div>
      <div className="space-y-3 px-4 py-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ví dụ: tham số, cực trị…"
            aria-label="Tìm mục trong mục lục sách"
            className="h-9 pl-9"
          />
        </div>
        {!normalized ? (
          <p className="text-sm text-slate-500">Gõ một phần tên mục để tìm.</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-slate-500">Không có mục nào khớp.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
            {results.map((item) => (
              <li
                key={`${item.documentId}-${item.entry.id}`}
                className="flex items-center gap-3 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-5 text-slate-900">
                    <InlineText text={item.entry.originalHeading} />
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.documentTitle} · {formatSpan(entrySpan(item.entry))}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void link(item.documentId, item.entry)}
                >
                  {busy === item.entry.id ? <Loader2 className="animate-spin" /> : <Link2 />} Liên
                  kết
                </Button>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function parsePages(value: string): number[] {
  const pages = new Set<number>();
  for (const part of value.split(/[,;\s]+/).filter(Boolean)) {
    const range = /^(\d+)\s*[-–]\s*(\d+)$/.exec(part);
    if (range) {
      for (
        let page = Number(range[1]);
        page <= Number(range[2]) && pages.size <= MAX_PAGES;
        page += 1
      )
        pages.add(page);
    } else if (/^\d+$/.test(part)) pages.add(Number(part));
  }
  return [...pages].sort((a, b) => a - b);
}

/** The next pages worth extracting: the first unread pages of the linked range, at most six. */
function defaultPages(section: LessonSection) {
  const remaining = section.state.remainingPages ?? [];
  const first = remaining.slice(0, MAX_PAGES);
  if (!first.length)
    return String(section.state.span?.start ?? section.entry.printedStartPage ?? '');
  const contiguous = first.every((page, index) => index === 0 || page === first[index - 1] + 1);
  return contiguous && first.length > 1
    ? `${first[0]}-${first[first.length - 1]}`
    : first.join(', ');
}

function SectionCard({
  section,
  lessonArtifacts,
  nodeId,
  otherLessons,
  onChanged,
  onFlash,
}: {
  section: LessonSection;
  lessonArtifacts: TextbookArtifact[];
  nodeId: string;
  otherLessons: LessonView['otherLinks'];
  onChanged: () => Promise<void>;
  onFlash: (text: string) => void;
}) {
  const { entry, document, state } = section;
  const span = state.span;
  const whole = entrySpan(entry);
  const narrowed = !!span && !!whole && (span.start !== whole.start || span.end !== whole.end);
  const [pagesText, setPagesText] = React.useState(() => defaultPages(section));
  const [busy, setBusy] = React.useState<'extract' | 'unlink' | 'range' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showSubsections, setShowSubsections] = React.useState(false);
  const [editingRange, setEditingRange] = React.useState(false);
  const [range, setRange] = React.useState({
    start: String(span?.start ?? ''),
    end: String(span?.end ?? ''),
  });
  const pages = parsePages(pagesText);
  const outside = !!span && pages.some((page) => page < span.start || page > span.end);
  const pageProblem = !pages.length
    ? 'Nhập số trang in, ví dụ 13, 16 hoặc 13-15.'
    : pages.length > MAX_PAGES
      ? `Mỗi lần trích tối đa ${MAX_PAGES} trang.`
      : outside
        ? `Trang phải nằm trong ${formatSpan(span)} đã liên kết.`
        : null;

  const extract = async (chosen = pages, entryIds?: string[]) => {
    setBusy('extract');
    setError(null);
    // The section that contains every chosen page most tightly, so provenance stays precise.
    const candidates = [entry, ...section.subsections].filter(
      (item) =>
        item.printedStartPage !== null &&
        chosen.every(
          (page) =>
            page >= item.printedStartPage! &&
            (item.printedEndPage === null || page <= item.printedEndPage)
        )
    );
    const target = candidates.sort((a, b) => b.level - a.level)[0] ?? entry;
    const result = await textbookApi.extract({
      documentId: document.id,
      entryIds: entryIds ?? [target.id],
      knowledgeNodeId: nodeId,
      printedPages: chosen,
    });
    setBusy(null);
    if (!result.ok) return setError(result.error);
    onFlash(
      result.data.cacheHit
        ? 'Các trang này đã được trích trước đây; dùng lại kết quả, không gọi AI.'
        : result.data.existing
          ? 'Việc trích các trang này đã có trong hàng đợi.'
          : 'Đã đưa vào hàng đợi. Trạng thái thật hiện ngay ở mục này.'
    );
    await onChanged();
  };

  const unlink = async () => {
    setBusy('unlink');
    const result = await textbookApi.unlink(document.id, entry.id, nodeId);
    setBusy(null);
    if (!result.ok) return setError(result.error);
    onFlash(
      'Đã bỏ liên kết. Trích đoạn của mục này vẫn được giữ, nhưng không còn dùng cho bài này.'
    );
    await onChanged();
  };

  const parsedRange = parseRange(range, whole);
  const saveRange = async (next: PageSpan | null) => {
    setBusy('range');
    setError(null);
    const result = await textbookApi.link(document.id, entry.id, nodeId, next);
    setBusy(null);
    if (!result.ok) return setError(result.error);
    setEditingRange(false);
    onFlash(next ? `Bài này giờ dùng ${formatSpan(next)} của mục.` : 'Bài này dùng cả mục.');
    await onChanged();
  };

  const recent = section.jobs.slice(0, 3);
  const byKind = (['THEORY', 'METHOD', 'WORKED_EXAMPLE', 'EXERCISE', 'SOLUTION'] as const)
    .map((kind) => ({
      kind,
      items: section.artifacts
        .filter((artifact) => artifact.kind === kind)
        .sort(
          (a, b) =>
            (a.printedPages[0] ?? 0) - (b.printedPages[0] ?? 0) ||
            Number(a.questionNumber ?? 0) - Number(b.questionNumber ?? 0)
        ),
    }))
    .filter((group) => group.items.length);
  const approvedIds = new Set(
    lessonArtifacts.filter((item) => item.reviewStatus === 'APPROVED').map((item) => item.id)
  );

  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      aria-label={entry.originalHeading}
    >
      <header className="flex items-start gap-3 px-4 pt-3">
        <BookOpen className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-sm font-semibold leading-5 text-slate-950">
              <InlineText text={entry.originalHeading} />
            </h3>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${TONE[state.tone]}`}
            >
              {state.key === 'EXTRACTING' && (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              )}
              {state.label}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {document.title} · {formatSpan(span)}
            {narrowed && <> (một phần của mục {formatSpan(whole)})</>}
            {section.subsections.length > 0 && (
              <>
                {' · '}
                <button
                  type="button"
                  className="font-medium text-slate-600 underline-offset-2 hover:underline"
                  aria-expanded={showSubsections}
                  onClick={() => setShowSubsections((value) => !value)}
                >
                  {section.subsections.length} mục con
                </button>
              </>
            )}
            {' · '}
            <button
              type="button"
              className="font-medium text-slate-600 underline-offset-2 hover:underline"
              onClick={() => setEditingRange((value) => !value)}
            >
              Chỉnh trang
            </button>
          </p>
          {otherLessons.length > 0 && (
            <p className="text-xs text-slate-500">
              Cũng dùng cho:{' '}
              {otherLessons.map((item) => `“${item.title ?? 'bài khác'}”`).join(', ')}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy !== null}
          onClick={() => void unlink()}
          aria-label={`Bỏ liên kết ${entry.originalHeading}`}
        >
          <Unlink /> <span className="hidden sm:inline">Bỏ liên kết</span>
        </Button>
      </header>
      <p className="px-4 pb-3 pl-11 pt-1 text-xs leading-5 text-slate-600">
        {state.next}
        {state.extractedPages.length > 0 && (
          <>
            {' '}
            Đã trích: {formatPageList(state.extractedPages)}
            {state.remainingPages && state.remainingPages.length > 0 && (
              <>; chưa trích: {formatPageList(state.remainingPages)}</>
            )}
            .
          </>
        )}
      </p>
      {editingRange && (
        <div className="mx-4 mb-3 space-y-2 rounded-lg bg-slate-50 p-3">
          <p className="text-xs leading-5 text-slate-600">
            Khi hai bài chia nhau một mục, chọn đúng phần bài này dùng. AI chỉ đọc trích đoạn từ các
            trang này.
          </p>
          <RangeFields span={range} limit={whole} onChange={setRange} />
          {parsedRange.error && <p className="text-xs text-amber-800">{parsedRange.error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy !== null || !parsedRange.span}
              onClick={() => parsedRange.span && void saveRange(parsedRange.span)}
            >
              {busy === 'range' && <Loader2 className="animate-spin" />} Lưu phạm vi trang
            </Button>
            {narrowed && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => void saveRange(null)}
              >
                Dùng cả mục
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setEditingRange(false)}>
              Hủy
            </Button>
          </div>
        </div>
      )}
      {showSubsections && (
        <ul className="mx-4 mb-3 space-y-0.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {section.subsections.map((item) => (
            <li
              key={item.id}
              style={{ paddingLeft: `${(item.level - entry.level - 1) * 12}px` }}
              className="flex gap-2"
            >
              <span className="min-w-0 flex-1">
                <InlineText text={item.originalHeading} />
              </span>
              <span className="shrink-0 tabular-nums text-slate-400">
                {formatSpan(entrySpan(item))}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1 text-xs font-medium text-slate-600">
            Trang sách cần trích (tối đa {MAX_PAGES})
            <Input
              value={pagesText}
              onChange={(event) => setPagesText(event.target.value)}
              inputMode="numeric"
              placeholder="13, 16, 19"
              aria-invalid={!!pageProblem && pagesText.length > 0}
              className="mt-1 h-9 bg-white"
            />
          </label>
          <Button
            size="sm"
            className="h-9"
            disabled={!!pageProblem || busy !== null || !!state.activeJob}
            onClick={() => void extract()}
          >
            {busy === 'extract' ? <Loader2 className="animate-spin" /> : null} Trích xuất
          </Button>
        </div>
        <p
          className={`mt-1 text-xs ${pageProblem && pagesText ? 'text-amber-800' : 'text-slate-500'}`}
        >
          {pageProblem && pagesText
            ? pageProblem
            : 'Dùng số trang in trên sách. AI chỉ đọc đúng các trang này; kết quả cần bạn duyệt trước khi dùng.'}
        </p>
        {!state.activeJob && (state.failedJob || state.lastCompletedJob) && (
          <ExtractionResult
            section={section}
            busy={busy !== null}
            onRetry={(job) => void extract(job.printedPages, job.entryIds)}
          />
        )}
        {recent.length > 0 && (
          <details className="mt-2 text-xs text-slate-500">
            <summary className="cursor-pointer font-medium text-slate-600">
              Lịch sử trích xuất ({section.jobs.length})
            </summary>
            <div className="mt-1 space-y-1">
              {recent.map((job) => (
                <JobLine
                  key={job.id}
                  job={job}
                  showError={false}
                  onCancel={async () => {
                    await textbookApi.cancelJob(job.id);
                    await onChanged();
                  }}
                />
              ))}
            </div>
          </details>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      {byKind.length > 0 && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4">
          {byKind.map((group) => (
            <div key={group.kind}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {KIND_LABELS[group.kind]}
                {group.items.length > 1 && (
                  <span className="ml-1 font-normal normal-case tabular-nums">
                    ({group.items.length})
                  </span>
                )}
              </h4>
              {group.kind === 'EXERCISE' && (
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Câu hỏi trích từ sách chỉ là tư liệu soạn bài: không tự đưa vào Ngân hàng câu hỏi
                  hay cho học sinh. Đáp án chỉ lấy từ lời giải in trong sách, không do AI đoán.
                </p>
              )}
              <ul className="mt-2 space-y-2">
                {group.items.map((artifact) => (
                  <ArtifactCard
                    key={artifact.id}
                    artifact={artifact}
                    paired={lessonArtifacts.find((item) => item.id === artifact.pairedArtifactId)}
                    pairedApproved={
                      !!artifact.pairedArtifactId && approvedIds.has(artifact.pairedArtifactId)
                    }
                    onChanged={onChanged}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const OUTCOME: Record<
  'COMPLETE' | 'PARTIAL' | 'EMPTY' | 'FAILED' | 'CACHED',
  { label: string; box: string; chip: string }
> = {
  COMPLETE: {
    label: 'Trích đủ',
    box: 'border-emerald-200 bg-emerald-50/50',
    chip: 'bg-emerald-100 text-emerald-800',
  },
  PARTIAL: {
    label: 'Trích được một phần',
    box: 'border-amber-200 bg-amber-50/60',
    chip: 'bg-amber-100 text-amber-900',
  },
  EMPTY: {
    label: 'Không có nội dung để trích',
    box: 'border-slate-200 bg-white',
    chip: 'bg-slate-100 text-slate-700',
  },
  FAILED: {
    label: 'Chưa trích được',
    box: 'border-red-200 bg-red-50/60',
    chip: 'bg-red-100 text-red-800',
  },
  CACHED: {
    label: 'Dùng lại kết quả đã có',
    box: 'border-slate-200 bg-white',
    chip: 'bg-slate-100 text-slate-700',
  },
};

const HALF: Record<string, string> = { LEFT: 'nửa trái', RIGHT: 'nửa phải', FULL: 'cả trang' };
const PAGE_STATUS: Record<string, string> = {
  READ: 'đọc được',
  PARTLY_READABLE: 'đọc được một phần',
  UNREADABLE: 'không đọc được',
  NO_EDUCATIONAL_CONTENT: 'không có nội dung học tập',
};

/**
 * The newest extraction of a section in one box: which printed pages were read
 * (and where they sit in the PDF), whether it succeeded fully or partly, how many
 * questions and matched solutions it produced, and the one next step. Provider
 * details stay folded under "Chi tiết kỹ thuật".
 */
function ExtractionResult({
  section,
  busy,
  onRetry,
}: {
  section: LessonSection;
  busy: boolean;
  onRetry: (job: TextbookExtractionJob) => void;
}) {
  const { state } = section;
  const job = state.failedJob ?? state.lastCompletedJob;
  if (!job) return null;
  const failed = job.status === 'FAILED';
  const kind = failed
    ? 'FAILED'
    : job.cacheHit
      ? 'CACHED'
      : (job.outcome ?? (job.providerCalls ? 'COMPLETE' : 'CACHED'));
  const style = OUTCOME[kind];
  const diagnostics = job.diagnostics;
  const read = diagnostics?.images.length
    ? diagnostics.images
        .map(
          (image) =>
            `tr. ${image.printedPage} (PDF ${image.pdfPage}, ${HALF[image.position] ?? image.position})`
        )
        .join(', ')
    : null;
  const jobArtifacts = section.artifacts.filter((artifact) =>
    artifact.printedPages.some((page) => job.printedPages.includes(page))
  );
  const questions = jobArtifacts.filter(
    (artifact) => artifact.kind === 'EXERCISE' && artifact.reviewStatus !== 'REJECTED'
  );
  const solutions = jobArtifacts.filter(
    (artifact) => artifact.kind === 'SOLUTION' && artifact.reviewStatus !== 'REJECTED'
  );
  const others = jobArtifacts.length - questions.length - solutions.length;
  const waiting = jobArtifacts.filter(
    (artifact) => artifact.reviewStatus === 'NEEDS_REVIEW'
  ).length;
  const missed = [
    ...(diagnostics?.unreadable ?? []).map(
      (item) => `${item.reference || 'Một vùng'} (tr. ${item.printedPage}): ${item.reason}`
    ),
    ...(diagnostics?.rejectedItems ?? []).map((item) => `${item.reference}: ${item.reason}`),
  ];
  const newStrategy = (job.promptVersion ?? 'cũ') !== PROMPT_VERSION;
  const counts = [
    questions.length > 0 && `${questions.length} câu hỏi`,
    questions.length > 0 &&
      `${questions.filter((item) => item.pairedArtifactId).length} có lời giải`,
    solutions.length > 0 && `${solutions.length} lời giải`,
    others > 0 && `${others} trích đoạn lí thuyết/ví dụ`,
    waiting > 0 && `${waiting} chờ duyệt`,
  ].filter(Boolean);
  const next = failed
    ? job.retryable === false
      ? 'Sửa nguyên nhân trước khi trích lại; gửi lại y nguyên không giúp.'
      : newStrategy
        ? 'Thử lại sẽ dùng cách đọc mới cho trang chỉ có bài tập: mỗi câu là một mục và không cần lời giải đi kèm.'
        : 'Thử lại gửi đúng yêu cầu này thêm một lần; nên dùng khi lỗi do mạng hoặc Gemini quá tải. Nếu vẫn lỗi, trích từng trang một.'
    : kind === 'EMPTY'
      ? 'Các trang này không có lí thuyết, ví dụ hay bài tập. Kiểm tra lại số trang hoặc chọn trang khác.'
      : waiting > 0
        ? `Duyệt ${waiting} mục bên dưới, đối chiếu với bản quét.${questions.some((item) => !item.pairedArtifactId) ? ' Câu chưa có lời giải: trích các trang “Hướng dẫn giải” tương ứng, hệ thống sẽ tự ghép khi đối chiếu được.' : ''}`
        : missed.length > 0
          ? 'Các mục còn thiếu cần trích lại từng trang hoặc nhập tay.'
          : 'Không cần làm gì thêm với lần trích này.';

  return (
    <div
      role={failed ? 'alert' : 'status'}
      className={`mt-2 space-y-1.5 rounded-lg border px-3 py-2.5 text-xs leading-5 text-slate-700 ${style.box}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-slate-900">
          Lần trích {formatPageList(job.printedPages)}
        </span>
        <span className={`rounded-full px-2 py-0.5 font-medium ${style.chip}`}>{style.label}</span>
        {counts.length > 0 && <span className="tabular-nums">{counts.join(' · ')}</span>}
      </div>
      {read && <p>Đã gửi cho AI: {read}.</p>}
      {failed && <p className="font-medium text-red-800">{job.error ?? 'Lần trích này bị lỗi.'}</p>}
      {kind === 'CACHED' && (
        <p>
          Các trang này đã được trích trước đây; dùng lại kết quả, không gọi AI và không tạo bản
          trùng.
        </p>
      )}
      {missed.length > 0 && (
        <div>
          <p className="font-medium text-amber-900">
            Chưa trích được {missed.length} mục (đã giữ nguồn trang):
          </p>
          <ul className="list-disc pl-4">
            {missed.slice(0, 6).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <p>
        <span className="font-medium text-slate-900">Tiếp theo: </span>
        {next}
      </p>
      {failed && job.retryable !== false && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 bg-white"
          disabled={busy}
          onClick={() => onRetry(job)}
        >
          <RotateCcw /> Thử lại {formatPageList(job.printedPages)}
        </Button>
      )}
      <details className="text-slate-500">
        <summary className="cursor-pointer font-medium text-slate-600">Chi tiết kỹ thuật</summary>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 break-words">
          {failed && (
            <>
              <dt>Loại lỗi</dt>
              <dd>{job.errorCode ?? '—'}</dd>
              <dt>Chi tiết</dt>
              <dd className="font-mono text-[11px]">{job.errorDetail ?? '—'}</dd>
            </>
          )}
          <dt>Mô hình</dt>
          <dd>
            {job.model ?? '—'} · cách đọc {job.promptVersion ?? 'trước v9'}
          </dd>
          <dt>Lượt gọi AI</dt>
          <dd className="tabular-nums">
            {job.providerCalls ?? (job.cacheHit ? 0 : 'không được ghi (lần chạy trước bản sửa)')}
            {job.tokenUsage &&
              ` · ${job.tokenUsage.input ?? '?'} token vào, ${job.tokenUsage.output ?? '?'} token ra`}
          </dd>
          {diagnostics && (
            <>
              <dt>Ảnh trang</dt>
              <dd className="tabular-nums">
                {diagnostics.images
                  .map((image) => `tr. ${image.printedPage}: ${image.width}×${image.height}px`)
                  .join('; ')}
              </dd>
              <dt>Phản hồi</dt>
              <dd className="tabular-nums">
                {diagnostics.responseChars} ký tự · kết thúc {diagnostics.finishReason ?? '—'}
                {diagnostics.truncated && ' (bị cắt)'} · {diagnostics.itemsReturned} mục trả về,{' '}
                {diagnostics.itemsAccepted} hợp lệ
              </dd>
              {diagnostics.pageReports.length > 0 && (
                <>
                  <dt>Từng trang</dt>
                  <dd>
                    {diagnostics.pageReports
                      .map(
                        (page) =>
                          `tr. ${page.printedPage}: ${PAGE_STATUS[page.status] ?? page.status}${page.note ? ` (${page.note})` : ''}`
                      )
                      .join('; ')}
                  </dd>
                </>
              )}
            </>
          )}
          <dt>Mã việc</dt>
          <dd className="font-mono text-[11px]">{job.id}</dd>
        </dl>
      </details>
    </div>
  );
}

const REVIEW_STYLES = {
  NEEDS_REVIEW: {
    label: 'Chờ duyệt · AI chưa dùng',
    className: 'border-amber-200',
    badge: 'bg-amber-50 text-amber-900',
  },
  APPROVED: {
    label: 'Đã duyệt · AI dùng được',
    className: 'border-emerald-200 bg-emerald-50/30',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  REJECTED: {
    label: 'Đã loại',
    className: 'border-slate-200 opacity-70',
    badge: 'bg-slate-100 text-slate-500',
  },
} as const;

function ArtifactCard({
  artifact,
  paired,
  pairedApproved,
  onChanged,
}: {
  artifact: TextbookArtifact;
  paired?: TextbookArtifact;
  pairedApproved: boolean;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState(artifact.title);
  const [content, setContent] = React.useState(artifact.content);
  const [open, setOpen] = React.useState(artifact.reviewStatus === 'NEEDS_REVIEW');
  const awaitingSolution =
    artifact.kind === 'EXERCISE' &&
    artifact.reviewStatus === 'APPROVED' &&
    (artifact.pairedArtifactId ? !pairedApproved : artifact.solutionStatus === 'UNRESOLVED');
  const style = awaitingSolution
    ? {
        ...REVIEW_STYLES.APPROVED,
        label: 'Đã duyệt đề · AI chưa dùng',
        className: 'border-amber-200',
      }
    : REVIEW_STYLES[artifact.reviewStatus];
  const mathProblem = hasMathIssues(findMathIssues(`${artifact.title}\n${artifact.content}`));
  // Mirrors the selection rule: an exercise whose paired solution is not approved is skipped.
  const exerciseSkipped =
    artifact.kind === 'EXERCISE' &&
    artifact.reviewStatus === 'APPROVED' &&
    !!artifact.pairedArtifactId &&
    !pairedApproved;

  const run = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Không lưu được.');
    setEditing(false);
    await onChanged();
  };

  return (
    <li className={`rounded-lg border bg-white ${style.className}`}>
      <button
        type="button"
        className="flex w-full items-start gap-2 px-3 py-2 text-left"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown
          className={`mt-0.5 size-4 shrink-0 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-slate-900">
          <InlineText text={artifact.title} />
          {artifact.kind === 'EXERCISE' && (
            <span
              className={`ml-1.5 whitespace-nowrap rounded px-1 py-px text-[11px] font-medium ${artifact.pairedArtifactId ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
            >
              {artifact.pairedArtifactId ? 'có lời giải' : 'chưa có lời giải'}
            </span>
          )}
          <span className="ml-1.5 text-xs font-normal text-slate-500">
            tr. {artifact.printedPages.join(', ')}
          </span>
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>
          {style.label}
        </span>
      </button>
      {open && (
        <div className="space-y-3 px-3 pb-3 sm:pl-9">
          {editing ? (
            <div className="space-y-2">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-label="Tiêu đề trích đoạn"
              />
              <Textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                aria-label="Nội dung trích đoạn"
                className="min-h-[140px] font-mono text-[13px] leading-6"
              />
              <p className="text-xs text-slate-500">
                Viết công thức trong $...$, ví dụ $f&apos;(x) \ge 0$.
              </p>
            </div>
          ) : (
            <RichText content={artifact.content} className="text-sm leading-7 text-slate-800" />
          )}
          {!editing && mathProblem && (
            <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
              Có công thức chưa hiển thị được. Bấm “Sửa” để viết lại trước khi duyệt.
            </p>
          )}
          {exerciseSkipped && (
            <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
              Lời giải ghép với bài này chưa được duyệt, nên AI sẽ bỏ qua bài tập này.
            </p>
          )}
          {artifact.kind === 'EXERCISE' && (
            <SolutionStatusNote
              artifact={artifact}
              paired={paired}
              pairedApproved={pairedApproved}
            />
          )}
          <p className="text-xs text-slate-500">
            Nguồn: tr. {artifact.printedPages.join(', ')} (trang PDF {artifact.pdfPages.join(', ')})
            {paired && (
              <>
                {' · '}Ghép với {paired.kind === 'SOLUTION' ? 'lời giải' : 'đề'} “
                <InlineText text={paired.title} />”
              </>
            )}
          </p>
          {artifact.verificationNotes.length > 0 && (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer font-medium text-slate-600">
                Ghi chú kiểm tra ({artifact.verificationNotes.length})
              </summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {artifact.verificationNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            {artifact.reviewStatus === 'NEEDS_REVIEW' && !editing && (
              <>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void run(() => textbookApi.review(artifact.id, 'approve'))}
                >
                  <Check /> Duyệt cho AI dùng
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run(() => textbookApi.review(artifact.id, 'reject'))}
                >
                  <X /> Loại
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(true)}>
                  <Pencil /> Sửa
                </Button>
              </>
            )}
            {editing && (
              <>
                <Button
                  size="sm"
                  disabled={busy || !title.trim() || !content.trim()}
                  onClick={() => void run(() => textbookApi.edit(artifact.id, title, content))}
                >
                  Lưu sửa
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setEditing(false);
                    setTitle(artifact.title);
                    setContent(artifact.content);
                  }}
                >
                  Hủy
                </Button>
              </>
            )}
            {artifact.reviewStatus !== 'NEEDS_REVIEW' && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void run(() => textbookApi.review(artifact.id, 'reopen'))}
              >
                <RotateCcw /> {artifact.reviewStatus === 'APPROVED' ? 'Bỏ duyệt' : 'Duyệt lại'}
              </Button>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** Where a question stands on its solution, and its answer only as the book's solution gives it. */
function SolutionStatusNote({
  artifact,
  paired,
  pairedApproved,
}: {
  artifact: TextbookArtifact;
  paired?: TextbookArtifact;
  pairedApproved: boolean;
}) {
  const verified =
    !!artifact.pairedArtifactId && artifact.reviewStatus === 'APPROVED' && pairedApproved;
  const answer =
    artifact.answer?.status === 'FROM_SOLUTION'
      ? artifact.answer.choice
        ? `Đáp án theo lời giải trong sách: ${artifact.answer.choice}.`
        : 'Lời giải trong sách không ghi rõ phương án.'
      : 'Đáp án: chưa xác định (chưa có lời giải).';
  return (
    <div className="space-y-1 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs leading-5 text-slate-600">
      <p>
        <span className="font-medium text-slate-800">
          {verified
            ? 'Đã xác minh: đề và lời giải đều đã duyệt.'
            : artifact.pairedArtifactId
              ? `Đã ghép lời giải ${paired ? `“${paired.title}”, tr. ${paired.printedPages.join(', ')}` : (artifact.solutionReference ?? '')}; ${paired ? 'cần duyệt cả hai.' : 'liên kết mục chứa lời giải với bài này để duyệt và để AI dùng được.'}`
              : 'Chưa tìm thấy lời giải.'}
        </span>{' '}
      </p>
      <p>{answer}</p>
      {artifact.hasDiagram && (
        <p className="text-amber-900">
          Câu này dựa vào hình hoặc bảng: xem trên bản quét, hình không được chép lại.
        </p>
      )}
    </div>
  );
}
