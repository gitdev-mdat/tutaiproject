'use client';

import * as React from 'react';
import { ArrowLeft, FileUp, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { InlineText } from '@/components/learning/rich-text';
import type { PageLayout, PagePosition, TextbookAnchor } from '@/lib/textbook-reference/types';
import {
  MAX_UPLOAD_BYTES,
  textbookApi,
  uploadTextbook,
  type DocumentSummary,
  type DocumentView,
  type LibraryView,
  type UploadPhase,
} from './textbook-client';
import { JobLine, pageRange, StatusPill, usePolling, WorkerNotice } from './textbook-status';

const MB = 1024 * 1024;

export function TextbookLibrarySheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        showCloseButton={false}
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[720px]"
        aria-describedby={undefined}
      >
        {open && <Library onClose={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function Library({ onClose }: { onClose: () => void }) {
  const [library, setLibrary] = React.useState<LibraryView | null>(null);
  const [error, setError] = React.useState<{ text: string; missing?: string[] } | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const result = await textbookApi.library();
    if (!result.ok) return setError({ text: result.error, missing: result.missing });
    setError(null);
    setLibrary(result.data);
  }, []);
  React.useEffect(() => {
    // Loading the library from the server is an external sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const busy = library?.documents.some(
    (document) => document.status === 'VERIFYING' || document.status === 'INDEXING'
  );
  usePolling(!!busy && !selected, load);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-3 border-b border-slate-200 px-5 pb-4 pt-5 sm:px-6">
        {selected && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Quay lại danh sách sách"
            onClick={() => setSelected(null)}
          >
            <ArrowLeft />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <SheetTitle className="text-lg font-bold text-slate-950">Sách tham chiếu</SheetTitle>
          <SheetDescription className="mt-0.5 text-sm text-slate-500">
            Nguồn để soạn bài. Học sinh không thấy sách và trích đoạn.
          </SheetDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Đóng
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-5 py-5 sm:px-6">
        {error ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
            <p className="font-semibold text-slate-900">{error.text}</p>
            {error.missing?.length ? (
              <p className="mt-1 text-slate-600">
                Máy chủ còn thiếu cấu hình: {error.missing.join(', ')}. Sau khi cấu hình, tải lại
                trang.
              </p>
            ) : (
              <Button className="mt-3" size="sm" variant="outline" onClick={() => void load()}>
                Thử lại
              </Button>
            )}
          </div>
        ) : !library ? (
          <div className="h-32 animate-pulse rounded-xl bg-slate-200/70" aria-busy="true" />
        ) : selected ? (
          <DocumentDetail documentId={selected} onChanged={load} />
        ) : (
          <div className="space-y-4">
            <WorkerNotice
              worker={library.worker}
              waiting={
                library.documents.filter(
                  (document) => document.status === 'VERIFYING' || document.status === 'INDEXING'
                ).length
              }
            />
            <Uploader
              onDone={async (documentId) => {
                await load();
                setSelected(documentId);
              }}
            />
            {library.documents.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
                Chưa có sách. Tải lên bản PDF (kể cả bản scan) tối đa 50 MB.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {library.documents.map((document) => (
                  <li key={document.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(document.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {document.title}
                        </p>
                        <p className="text-xs text-slate-500">{documentFacts(document)}</p>
                      </div>
                      <StatusPill status={document.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function documentFacts(document: DocumentSummary) {
  return [
    document.pdfPageCount ? `${document.pdfPageCount} trang PDF` : null,
    document.byteSize ? `${(document.byteSize / MB).toFixed(1)} MB` : null,
    document.scanDetection?.scanned ? 'bản scan' : null,
    document.tocEntryCount ? `${document.tocEntryCount} mục` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function Uploader({ onDone }: { onDone: (documentId: string) => void }) {
  const input = React.useRef<HTMLInputElement>(null);
  const controller = React.useRef<AbortController | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [phase, setPhase] = React.useState<UploadPhase | null>(null);
  const [message, setMessage] = React.useState<{ text: string; error?: boolean } | null>(null);

  const start = async (chosen: File) => {
    setFile(chosen);
    setMessage(null);
    if (chosen.size > MAX_UPLOAD_BYTES)
      return setMessage({ text: 'Tệp lớn hơn 50 MB.', error: true });
    const abort = new AbortController();
    controller.current = abort;
    try {
      const outcome = await uploadTextbook(chosen, setPhase, abort.signal);
      setPhase(null);
      setFile(null);
      setMessage({
        text:
          outcome.kind === 'duplicate'
            ? `Sách này đã có trong thư viện (“${outcome.document.title}”). Không tải lại.`
            : 'Đã tải lên. Bộ xử lý sẽ kiểm tra tệp trước khi thiết lập trang.',
      });
      onDone(outcome.document.id);
    } catch (error) {
      setPhase(null);
      setMessage(
        abort.signal.aborted
          ? { text: 'Đã hủy tải lên.' }
          : {
              text: `${error instanceof Error ? error.message : 'Tải lên thất bại.'} Phần đã tải được giữ lại; chọn lại đúng tệp để tiếp tục.`,
              error: true,
            }
      );
    } finally {
      controller.current = null;
    }
  };

  const percent =
    phase?.kind === 'uploading'
      ? Math.floor((phase.uploaded / Math.max(phase.total, 1)) * 100)
      : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-label="Chọn tệp PDF"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          event.target.value = '';
          if (chosen) void start(chosen);
        }}
      />
      {phase ? (
        <div className="space-y-2" role="status" aria-live="polite">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin text-blue-600" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{file?.name}</span>
            <Button size="sm" variant="ghost" onClick={() => controller.current?.abort()}>
              <X /> Hủy
            </Button>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-[width]"
              style={{ width: `${percent ?? (phase.kind === 'finishing' ? 100 : 2)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            {phase.kind === 'hashing'
              ? 'Đang tính mã kiểm tra để phát hiện sách trùng…'
              : phase.kind === 'finishing'
                ? 'Đang ghi nhận sách…'
                : `${(phase.uploaded / MB).toFixed(1)} / ${(phase.total / MB).toFixed(1)} MB · ${percent}%${phase.resumed ? ' · tiếp tục từ lần trước' : ''}`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 text-sm leading-6 text-slate-600">
            PDF tối đa 50 MB. Tệp đi thẳng vào kho riêng tư; mạng ngắt thì chọn lại tệp để tải tiếp.
          </p>
          <Button onClick={() => input.current?.click()}>
            <FileUp /> Tải PDF lên
          </Button>
        </div>
      )}
      {message && (
        <p
          role={message.error ? 'alert' : 'status'}
          className={`mt-2 text-sm ${message.error ? 'text-red-700' : 'text-emerald-700'}`}
        >
          {message.text}
          {message.error && file && (
            <button
              type="button"
              className="ml-2 font-medium underline"
              onClick={() => void start(file)}
            >
              Thử lại
            </button>
          )}
        </p>
      )}
    </div>
  );
}

type AnchorRow = { printedPage: string; pdfPage: string; position: PagePosition };

function DocumentDetail({
  documentId,
  onChanged,
}: {
  documentId: string;
  onChanged: () => Promise<void>;
}) {
  const [view, setView] = React.useState<DocumentView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const load = React.useCallback(async () => {
    const result = await textbookApi.document(documentId);
    if (!result.ok) return setError(result.error);
    setError(null);
    setView(result.data);
  }, [documentId]);
  React.useEffect(() => {
    // Loading the book from the server is an external sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const pending =
    view?.jobs.filter((job) => job.status === 'QUEUED' || job.status === 'RUNNING') ?? [];
  usePolling(pending.length > 0, load);

  if (error)
    return (
      <p role="alert" className="text-sm text-red-700">
        {error}
      </p>
    );
  if (!view)
    return <div className="h-40 animate-pulse rounded-xl bg-slate-200/70" aria-busy="true" />;
  const { document } = view;
  const setupJobs = view.jobs.filter((job) => job.kind !== 'EXTRACT').slice(0, 3);
  const locked =
    view.mappings.some((mapping) => mapping.status === 'CONFIRMED') || view.artifacts.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 flex-1 text-base font-semibold text-slate-950">
            {document.title}
          </h2>
          <StatusPill status={document.status} />
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {documentFacts({ ...document, tocEntryCount: document.tocEntries.length })} ·{' '}
          {document.originalFilename}
        </p>
      </div>
      <WorkerNotice worker={view.worker} waiting={pending.length} />
      {setupJobs.length > 0 && (
        <div className="space-y-1">
          {setupJobs.map((job) => (
            <JobLine key={job.id} job={job} showError={false} />
          ))}
        </div>
      )}
      {document.processingErrors.length > 0 && document.status !== 'INDEXED' && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {document.processingErrors[document.processingErrors.length - 1]}
          {document.status === 'FAILED' && ' Tải tệp lên lại để thay bản lỗi.'}
        </p>
      )}

      {document.status === 'VERIFYING' ? (
        <Step title="1. Kiểm tra tệp" done={false}>
          <p className="text-sm text-slate-600">
            Bộ xử lý mở tệp đã lưu, đối chiếu mã kiểm tra và đếm số trang. Sau bước này mới thiết
            lập trang.
          </p>
        </Step>
      ) : document.status !== 'FAILED' ? (
        <>
          <PageSetup
            view={view}
            locked={locked}
            onSaved={async () => {
              await load();
              await onChanged();
            }}
          />
          {document.tocEntries.length > 0 && <TocBrowser view={view} onSaved={load} />}
        </>
      ) : null}
    </div>
  );
}

function Step({
  title,
  done,
  children,
}: {
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className={`text-sm font-semibold ${done ? 'text-slate-500' : 'text-slate-900'}`}>
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function parseList(value: string) {
  const pages = new Set<number>();
  for (const part of value.split(/[,;\s]+/).filter(Boolean)) {
    const range = /^(\d+)\s*[-–]\s*(\d+)$/.exec(part);
    if (range)
      for (let page = Number(range[1]); page <= Number(range[2]) && pages.size < 10; page += 1)
        pages.add(page);
    else if (/^\d+$/.test(part)) pages.add(Number(part));
  }
  return [...pages];
}

function PageSetup({
  view,
  locked,
  onSaved,
}: {
  view: DocumentView;
  locked: boolean;
  onSaved: () => Promise<void>;
}) {
  const { document } = view;
  const [layout, setLayout] = React.useState<PageLayout>(document.pageLayout ?? 'TWO_UP');
  const [rows, setRows] = React.useState<AnchorRow[]>(
    document.anchors.length
      ? document.anchors.map((anchor) => ({
          printedPage: String(anchor.printedPage),
          pdfPage: String(anchor.pdfPage),
          position: anchor.position,
        }))
      : [
          { printedPage: '', pdfPage: '', position: 'RIGHT' },
          { printedPage: '', pdfPage: '', position: 'LEFT' },
        ]
  );
  const [tocPages, setTocPages] = React.useState(document.tocPdfPages?.join(', ') ?? '');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(document.tocEntries.length === 0);
  const indexing = document.status === 'INDEXING';

  if (!editing || locked)
    return (
      <Step title="Thiết lập trang" done>
        <p className="text-sm text-slate-600">
          {document.pageLayout === 'SINGLE'
            ? 'Mỗi trang PDF một trang sách'
            : 'Hai trang sách trên một trang PDF'}{' '}
          · mốc{' '}
          {document.anchors
            .map(
              (anchor) =>
                `tr. ${anchor.printedPage} → PDF ${anchor.pdfPage}${anchor.position === 'LEFT' ? ' trái' : anchor.position === 'RIGHT' ? ' phải' : ''}`
            )
            .join(', ')}
          {document.tocPdfPages?.length
            ? ` · mục lục ở trang PDF ${document.tocPdfPages.join(', ')}`
            : ''}
        </p>
        {locked ? (
          <p className="mt-1 text-xs text-slate-500">
            Đã có mục được liên kết nên mốc trang và mục lục được giữ cố định.
          </p>
        ) : (
          !indexing && (
            <div className="mt-2 flex flex-wrap gap-2">
              {document.tocEntries.length === 0 && (
                <Button size="sm" disabled={busy} onClick={() => void retry()}>
                  {busy && <Loader2 className="animate-spin" />} Đọc lại mục lục
                </Button>
              )}
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>
                Sửa thiết lập
              </Button>
            </div>
          )
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </Step>
    );

  async function retry() {
    setBusy(true);
    setError(null);
    const queued = await textbookApi.indexToc(document.id);
    setBusy(false);
    if (!queued.ok) return setError(queued.error);
    await onSaved();
  }

  const save = async () => {
    setBusy(true);
    setError(null);
    const anchors: TextbookAnchor[] = rows
      .filter((row) => row.printedPage && row.pdfPage)
      .map((row) => ({
        printedPage: Number(row.printedPage),
        pdfPage: Number(row.pdfPage),
        position: layout === 'SINGLE' ? 'FULL' : row.position,
        evidence: 'Admin đối chiếu số trang in trên bản quét.',
      }));
    const saved = await textbookApi.pageSetup({
      documentId: document.id,
      layout,
      anchors,
      tocPdfPages: parseList(tocPages),
    });
    if (!saved.ok) {
      setBusy(false);
      return setError(saved.error);
    }
    const queued = await textbookApi.indexToc(document.id);
    setBusy(false);
    if (!queued.ok) return setError(queued.error);
    setEditing(false);
    await onSaved();
  };

  return (
    <Step title="Thiết lập trang và đọc mục lục" done={false}>
      <div className="space-y-4 text-sm">
        <fieldset>
          <legend className="text-xs font-medium text-slate-600">Bản PDF</legend>
          <div className="mt-1 flex flex-col gap-1.5 sm:flex-row sm:gap-4">
            {(
              [
                ['TWO_UP', 'Hai trang sách trên một trang PDF'],
                ['SINGLE', 'Mỗi trang PDF một trang sách'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="layout"
                  className="accent-blue-600"
                  checked={layout === value}
                  onChange={() => setLayout(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <p className="text-xs font-medium text-slate-600">Mốc trang</p>
          <p className="text-xs text-slate-500">
            Mở PDF, tìm số trang in ở chân trang và ghi lại nó nằm ở trang PDF nào. Cần ít nhất hai
            mốc, cách xa nhau; chỉ các trang nằm giữa hai mốc mới trích được.
          </p>
          <ul className="mt-2 space-y-2">
            {rows.map((row, index) => (
              <li key={index} className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  Trang in
                  <Input
                    value={row.printedPage}
                    inputMode="numeric"
                    className="h-8 w-20"
                    aria-label={`Mốc ${index + 1}: số trang in`}
                    onChange={(event) =>
                      setRows(
                        rows.map((item, i) =>
                          i === index
                            ? { ...item, printedPage: event.target.value.replace(/\D/g, '') }
                            : item
                        )
                      )
                    }
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  ở trang PDF
                  <Input
                    value={row.pdfPage}
                    inputMode="numeric"
                    className="h-8 w-20"
                    aria-label={`Mốc ${index + 1}: trang PDF`}
                    onChange={(event) =>
                      setRows(
                        rows.map((item, i) =>
                          i === index
                            ? { ...item, pdfPage: event.target.value.replace(/\D/g, '') }
                            : item
                        )
                      )
                    }
                  />
                </label>
                {layout === 'TWO_UP' && (
                  <select
                    value={row.position}
                    aria-label={`Mốc ${index + 1}: nửa trang`}
                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"
                    onChange={(event) =>
                      setRows(
                        rows.map((item, i) =>
                          i === index
                            ? { ...item, position: event.target.value as PagePosition }
                            : item
                        )
                      )
                    }
                  >
                    <option value="LEFT">nửa trái</option>
                    <option value="RIGHT">nửa phải</option>
                  </select>
                )}
                {rows.length > 2 && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Xóa mốc ${index + 1}`}
                    onClick={() => setRows(rows.filter((_, i) => i !== index))}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {rows.length < 8 && (
            <Button
              className="mt-1"
              size="sm"
              variant="ghost"
              onClick={() =>
                setRows([...rows, { printedPage: '', pdfPage: '', position: 'RIGHT' }])
              }
            >
              <Plus /> Thêm mốc
            </Button>
          )}
        </div>
        <label className="block text-xs font-medium text-slate-600">
          Trang PDF có mục lục (tối đa 4)
          <Input
            value={tocPages}
            onChange={(event) => setTocPages(event.target.value)}
            placeholder="5-7"
            className="mt-1 h-9 w-40"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {document.tocEntries.length > 0 && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
              Hủy
            </Button>
          )}
          <Button size="sm" disabled={busy} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Lưu và đọc mục lục
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          AI chỉ đọc các trang mục lục đã chọn. Bạn kiểm tra kết quả ở danh sách mục bên dưới.
        </p>
      </div>
    </Step>
  );
}

function TocBrowser({ view, onSaved }: { view: DocumentView; onSaved: () => Promise<void> }) {
  const { document } = view;
  const [query, setQuery] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Record<string, { heading: string; page: string }>>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const changes = Object.entries(draft)
    .map(([entryId, value]) => {
      const entry = document.tocEntries.find((item) => item.id === entryId)!;
      const page = value.page.trim() ? Number(value.page) : null;
      return { entryId, heading: value.heading, printedStartPage: page, entry };
    })
    .filter(
      (change) =>
        change.heading.trim() !== change.entry.originalHeading ||
        change.printedStartPage !== change.entry.printedStartPage
    );
  const save = async (confirmComplete: boolean) => {
    setBusy(true);
    setError(null);
    const result = await textbookApi.correctToc(
      document.id,
      changes.map(({ entryId, heading, printedStartPage }) => ({
        entryId,
        heading,
        printedStartPage,
      })),
      confirmComplete
    );
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setEditing(false);
    setDraft({});
    await onSaved();
  };
  const field = (entryId: string) => {
    const entry = document.tocEntries.find((item) => item.id === entryId)!;
    return (
      draft[entryId] ?? {
        heading: entry.originalHeading,
        page: entry.printedStartPage ? String(entry.printedStartPage) : '',
      }
    );
  };
  const setField = (entryId: string, patch: Partial<{ heading: string; page: string }>) =>
    setDraft((current) => ({ ...current, [entryId]: { ...field(entryId), ...patch } }));
  const normalized = query.trim().toLocaleLowerCase('vi');
  const linked = new Map<string, string[]>();
  for (const mapping of view.mappings.filter((item) => item.status === 'CONFIRMED'))
    linked.set(mapping.entryId, [
      ...(linked.get(mapping.entryId) ?? []),
      mapping.knowledgeNodeTitle ?? mapping.knowledgeNodeId,
    ]);
  const entries = normalized
    ? document.tocEntries.filter((entry) => entry.normalizedHeading.includes(normalized))
    : document.tocEntries;
  const minLevel = Math.min(...document.tocEntries.map((entry) => entry.level));
  return (
    <section className="rounded-xl border border-slate-200 bg-white" aria-label="Mục lục">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <h3 className="flex-1 text-sm font-semibold text-slate-900">
          Mục lục{' '}
          <span className="font-normal text-slate-500">
            · {document.tocEntries.length} mục
            {document.tocIndexCompleteness === 'PARTIAL'
              ? ', AI đọc, cần đối chiếu'
              : ', đã đối chiếu'}
          </span>
        </h3>
        {!editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil /> Sửa mục lục
          </Button>
        )}
        <div className="relative w-full sm:w-56">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm mục…"
            aria-label="Tìm trong mục lục"
            className="h-8 pl-8"
          />
        </div>
      </div>
      <ol className="max-h-[480px] divide-y divide-slate-50 overflow-y-auto py-1">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex items-start gap-3 py-1.5 pr-4 text-sm"
            style={{ paddingLeft: `${16 + (normalized ? 0 : (entry.level - minLevel) * 16)}px` }}
          >
            {editing ? (
              <>
                <Input
                  value={field(entry.id).heading}
                  onChange={(event) => setField(entry.id, { heading: event.target.value })}
                  aria-label={`Tên mục ${entry.originalHeading}`}
                  className="h-8 min-w-0 flex-1 text-sm"
                />
                <Input
                  value={field(entry.id).page}
                  onChange={(event) =>
                    setField(entry.id, { page: event.target.value.replace(/D/g, '') })
                  }
                  inputMode="numeric"
                  aria-label={`Trang bắt đầu của ${entry.originalHeading}`}
                  className="h-8 w-16 shrink-0 text-sm tabular-nums"
                />
              </>
            ) : (
              <>
                <span
                  className={`min-w-0 flex-1 leading-5 ${entry.level === minLevel ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
                >
                  <InlineText text={entry.originalHeading} />
                  {linked.get(entry.id)?.map((title) => (
                    <span
                      key={title}
                      className="ml-2 inline-flex rounded-full bg-blue-50 px-2 py-0.5 align-middle text-xs font-medium text-blue-800"
                    >
                      {title}
                    </span>
                  ))}
                </span>
                <span className="shrink-0 pt-0.5 text-xs tabular-nums text-slate-500">
                  {pageRange(entry.printedStartPage, entry.printedEndPage)}
                  {entry.locations[0]?.position === 'UNCERTAIN' && (
                    <span className="ml-1 text-amber-700" title="Ngoài khoảng mốc trang">
                      ·?
                    </span>
                  )}
                </span>
              </>
            )}
          </li>
        ))}
      </ol>
      {editing && (
        <div className="space-y-2 border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-500">
            Sửa tên và trang bắt đầu theo đúng sách; trang kết thúc tự tính lại. Mục đã liên kết và
            trích đoạn vẫn giữ nguyên.
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setDraft({});
                setError(null);
              }}
            >
              Hủy
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || changes.length === 0}
              onClick={() => void save(false)}
            >
              Lưu {changes.length || ''} thay đổi
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void save(true)}>
              {busy && <Loader2 className="animate-spin" />} Lưu và xác nhận đã đối chiếu
            </Button>
          </div>
        </div>
      )}
      <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        Liên kết mục với bài học trong tab “Tư liệu” của từng bài. Trang có dấu ? nằm ngoài khoảng
        mốc, cần thêm mốc trước khi trích.
      </p>
    </section>
  );
}
