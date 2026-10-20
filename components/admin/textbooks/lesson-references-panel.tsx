'use client';

import * as React from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  Link2,
  Loader2,
  Pencil,
  RotateCcw,
  Search,
  Unlink,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { InlineText, RichText } from '@/components/learning/rich-text';
import { findMathIssues, hasMathIssues } from '@/lib/content/math-notation';
import type { TextbookArtifact, TextbookTocEntry } from '@/lib/textbook-reference/types';
import { textbookApi, type LessonSection, type LessonView } from './textbook-client';
import { JobLine, KIND_LABELS, pageRange, usePolling, WorkerNotice } from './textbook-status';

const MAX_PAGES = 6;

/**
 * The textbook side of one lesson: which book sections back it, extraction of
 * chosen pages, and review of what was extracted. Only approved extracts are
 * offered to AI drafting; nothing here reaches students.
 */
export function LessonReferencesPanel({
  nodeId,
  onOpenLibrary,
  onApprovedChange,
}: {
  nodeId: string;
  onOpenLibrary: () => void;
  onApprovedChange?: (count: number) => void;
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
    onApprovedChange?.(result.data.approvedCount);
  }, [nodeId, onApprovedChange]);

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
    window.setTimeout(() => setNotice(null), 4000);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 text-sm leading-6 text-slate-600">
          {view.approvedCount > 0 ? (
            <>
              <span className="font-semibold text-emerald-700">
                {view.approvedCount} trích đoạn đã duyệt
              </span>{' '}
              sẽ làm căn cứ khi soạn nháp bằng AI. Học sinh không thấy tư liệu này.
            </>
          ) : (
            'Liên kết mục sách, trích các trang cần dùng rồi duyệt. Chỉ trích đoạn đã duyệt mới được dùng khi soạn nháp bằng AI.'
          )}
        </p>
        <Button size="sm" variant="ghost" onClick={onOpenLibrary}>
          <BookOpen /> Thư viện sách
        </Button>
      </div>
      <WorkerNotice worker={view.worker} waiting={pending.length} compact />
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
          nodeId={nodeId}
          jobs={view.jobs.filter(
            (job) => job.documentId === section.document.id && job.kind === 'EXTRACT'
          )}
          onChanged={load}
          onFlash={flash}
        />
      ))}

      {view.sections.length === 0 || linking ? (
        <LinkPicker
          view={view}
          onCancel={view.sections.length ? () => setLinking(false) : undefined}
          onOpenLibrary={onOpenLibrary}
          onLinked={async (heading) => {
            setLinking(false);
            await load();
            flash(`Đã liên kết “${heading}”.`);
          }}
        />
      ) : (
        <Button variant="outline" size="sm" onClick={() => setLinking(true)}>
          <Link2 /> Liên kết thêm mục sách
        </Button>
      )}
    </div>
  );
}

function LinkPicker({
  view,
  onLinked,
  onCancel,
  onOpenLibrary,
}: {
  view: LessonView;
  onLinked: (heading: string) => void;
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
    : view.suggestions;

  const link = async (documentId: string, entry: TextbookTocEntry) => {
    setBusy(entry.id);
    setError(null);
    const result = await textbookApi.link(documentId, entry.id, view.node.id);
    setBusy(null);
    if (!result.ok) return setError(result.error);
    onLinked(entry.originalHeading);
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
    <section aria-label="Liên kết mục sách" className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <h3 className="flex-1 text-sm font-semibold text-slate-900">
          Liên kết mục sách với bài này
        </h3>
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
            placeholder="Tìm trong mục lục…"
            aria-label="Tìm mục trong mục lục sách"
            className="h-9 pl-9"
          />
        </div>
        {!normalized && results.length > 0 && (
          <p className="text-xs font-medium text-slate-500">Gợi ý theo tên bài</p>
        )}
        {results.length === 0 ? (
          <p className="text-sm text-slate-500">
            {normalized ? 'Không có mục nào khớp.' : 'Chưa có gợi ý. Gõ tên mục để tìm.'}
          </p>
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
                    {item.documentTitle} ·{' '}
                    {pageRange(item.entry.printedStartPage, item.entry.printedEndPage)}
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

function SectionCard({
  section,
  nodeId,
  jobs,
  onChanged,
  onFlash,
}: {
  section: LessonSection;
  nodeId: string;
  jobs: LessonView['jobs'];
  onChanged: () => Promise<void>;
  onFlash: (text: string) => void;
}) {
  const { entry, document } = section;
  const [pagesText, setPagesText] = React.useState(String(entry.printedStartPage ?? ''));
  const [busy, setBusy] = React.useState<'extract' | 'unlink' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showSubsections, setShowSubsections] = React.useState(false);
  const pages = parsePages(pagesText);
  const outside =
    entry.printedStartPage !== null &&
    pages.some(
      (page) =>
        page < entry.printedStartPage! ||
        (entry.printedEndPage !== null && page > entry.printedEndPage)
    );
  const pageProblem = !pages.length
    ? 'Nhập số trang in, ví dụ 13, 16 hoặc 13-15.'
    : pages.length > MAX_PAGES
      ? `Mỗi lần trích tối đa ${MAX_PAGES} trang.`
      : outside
        ? `Trang phải nằm trong ${pageRange(entry.printedStartPage, entry.printedEndPage)}.`
        : null;

  const extract = async () => {
    if (pageProblem) return;
    setBusy('extract');
    setError(null);
    // The section that contains every chosen page most tightly, so provenance stays precise.
    const candidates = [entry, ...section.subsections].filter(
      (item) =>
        item.printedStartPage !== null &&
        pages.every(
          (page) =>
            page >= item.printedStartPage! &&
            (item.printedEndPage === null || page <= item.printedEndPage)
        )
    );
    const target = candidates.sort((a, b) => b.level - a.level)[0] ?? entry;
    const result = await textbookApi.extract({
      documentId: document.id,
      entryIds: [target.id],
      knowledgeNodeId: nodeId,
      printedPages: pages,
    });
    setBusy(null);
    if (!result.ok) return setError(result.error);
    onFlash(
      result.data.cacheHit
        ? 'Các trang này đã được trích trước đây; dùng lại kết quả, không gọi AI.'
        : result.data.existing
          ? 'Việc trích các trang này đã có trong hàng đợi.'
          : result.data.worker.online
            ? 'Đã đưa vào hàng đợi. Bộ xử lý sẽ trích trong ít phút.'
            : 'Đã đưa vào hàng đợi. Việc sẽ chạy khi bộ xử lý bật.'
    );
    await onChanged();
  };

  const unlink = async () => {
    setBusy('unlink');
    const result = await textbookApi.unlink(document.id, entry.id, nodeId);
    setBusy(null);
    if (!result.ok) return setError(result.error);
    onFlash('Đã bỏ liên kết. Trích đoạn của mục này không còn được dùng cho bài.');
    await onChanged();
  };

  const latest = jobs.slice(0, 3);
  const byKind = (['THEORY', 'METHOD', 'WORKED_EXAMPLE', 'EXERCISE', 'SOLUTION'] as const)
    .map((kind) => ({
      kind,
      items: section.artifacts.filter((artifact) => artifact.kind === kind),
    }))
    .filter((group) => group.items.length);

  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      aria-label={entry.originalHeading}
    >
      <header className="flex items-start gap-3 px-4 py-3">
        <BookOpen className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-5 text-slate-950">
            <InlineText text={entry.originalHeading} />
          </h3>
          <p className="text-xs text-slate-500">
            {document.title} · {pageRange(entry.printedStartPage, entry.printedEndPage)}
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
          </p>
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
                {pageRange(item.printedStartPage, item.printedEndPage)}
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
            disabled={!!pageProblem || busy !== null}
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
            : 'Dùng số trang in trên sách. AI đọc đúng các trang này, không đọc cả cuốn.'}
        </p>
        {latest.length > 0 && (
          <div className="mt-2 space-y-1">
            {latest.map((job) => (
              <JobLine
                key={job.id}
                job={job}
                onCancel={async () => {
                  await textbookApi.cancelJob(job.id);
                  await onChanged();
                }}
              />
            ))}
          </div>
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
              </h4>
              <ul className="mt-2 space-y-2">
                {group.items.map((artifact) => (
                  <ArtifactCard
                    key={artifact.id}
                    artifact={artifact}
                    paired={section.artifacts.find((item) => item.id === artifact.pairedArtifactId)}
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

const REVIEW_STYLES = {
  NEEDS_REVIEW: {
    label: 'Chờ duyệt',
    className: 'border-slate-200',
    badge: 'bg-slate-100 text-slate-700',
  },
  APPROVED: {
    label: 'Đã duyệt',
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
  onChanged,
}: {
  artifact: TextbookArtifact;
  paired?: TextbookArtifact;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState(artifact.title);
  const [content, setContent] = React.useState(artifact.content);
  const [open, setOpen] = React.useState(artifact.reviewStatus === 'NEEDS_REVIEW');
  const style = REVIEW_STYLES[artifact.reviewStatus];

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
          {!editing &&
            hasMathIssues(
              findMathIssues(`${artifact.title}
${artifact.content}`)
            ) && (
              <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                Có công thức chưa hiển thị được. Bấm “Sửa” để viết lại trước khi duyệt.
              </p>
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
                  <Check /> Duyệt
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
                <RotateCcw /> Duyệt lại
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
