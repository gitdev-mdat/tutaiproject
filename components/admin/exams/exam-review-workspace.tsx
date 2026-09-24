'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Maximize2,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCw,
  Save,
  SkipForward,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImportStepper } from '@/components/admin/import/import-stepper';
import { QuestionCandidateEditor } from '@/components/admin/import/question-candidate-editor';
import type { ImportSession, QuestionCandidate, ReviewStatus } from '@/lib/content-import/types';
import { QUESTION_TYPE_LABELS } from '@/lib/question-bank/qb-types';

const STATUS_LABELS: Record<ReviewStatus, string> = {
  UNREVIEWED: 'Chưa kiểm tra',
  WARNING: 'Có cảnh báo',
  EDITED: 'Đã chỉnh sửa',
  APPROVED: 'Đã duyệt',
  SKIPPED: 'Bỏ qua',
};

const STATUS_DOT: Record<ReviewStatus, string> = {
  UNREVIEWED: 'bg-slate-300',
  WARNING: 'bg-amber-500',
  EDITED: 'bg-blue-500',
  APPROVED: 'bg-emerald-500',
  SKIPPED: 'bg-slate-500',
};

function sourceUrl(sessionId: string, pageId: string): string {
  return `/api/content-import/sessions/${sessionId}/pages/${pageId}/source`;
}

function Completion({ session, onContinue }: { session: ImportSession; onContinue: () => void }) {
  const summary = session.summary;
  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <ImportStepper current={5} />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <h1 className="text-base font-semibold text-emerald-900">Đã tạo bản nháp đề thi</h1>
          <p className="mt-1 text-xs leading-5 text-emerald-800">
            Chỉ các câu đã duyệt được thêm vào ngân hàng dưới dạng bản nháp. Các ứng viên còn lại
            vẫn nằm trong hàng chờ kiểm tra.
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            ['Tổng trang', summary.pageCount],
            ['Phát hiện', summary.detectedQuestions],
            ['Đã duyệt', summary.approvedQuestions],
            ['Cần kiểm tra', summary.reviewQuestions],
            ['Bỏ qua', summary.skippedQuestions],
            ['Có đáp án', summary.questionsWithAnswers],
            ['Không đáp án', summary.questionsWithoutAnswers],
            ['Nghi trùng', summary.duplicateCandidates],
            ['Thất bại', summary.failedItems],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[11px] text-slate-500">{label}</p>
              <p className="mt-1 text-xl font-semibold text-slate-800">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button nativeButton={false} size="sm" render={<Link href="/admin/exams" />}>
            Xem đề thi
          </Button>
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            render={<Link href="/admin/question-bank" />}
          >
            Mở ngân hàng câu hỏi
          </Button>
          <Button variant="outline" size="sm" onClick={onContinue}>
            Tiếp tục kiểm tra
          </Button>
          <Button
            nativeButton={false}
            variant="ghost"
            size="sm"
            render={<Link href="/admin/exams/import/images" />}
          >
            Import đề khác
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ExamReviewWorkspace({ sessionId }: { sessionId: string }) {
  const [session, setSession] = React.useState<ImportSession | null>(null);
  const [selectedId, setSelectedId] = React.useState('');
  const [draft, setDraft] = React.useState<QuestionCandidate | null>(null);
  const [filter, setFilter] = React.useState('ALL');
  const [navigatorOpen, setNavigatorOpen] = React.useState(true);
  const [mobileTab, setMobileTab] = React.useState<'SOURCE' | 'EDITOR'>('EDITOR');
  const [zoom, setZoom] = React.useState(1);
  const [viewerRotation, setViewerRotation] = React.useState(0);
  const [annotations, setAnnotations] = React.useState(true);
  const [processed, setProcessed] = React.useState(false);
  const [saveState, setSaveState] = React.useState<'SAVED' | 'SAVING' | 'ERROR'>('SAVED');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const load = React.useCallback(async () => {
    const response = await fetch(`/api/content-import/sessions/${sessionId}`);
    if (!response.ok) throw new Error('Không tải được phiên kiểm tra.');
    const result = (await response.json()) as ImportSession;
    setSession(result);
    setSelectedId((current) => current || result.candidates[0]?.id || '');
  }, [sessionId]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : 'Không tải được phiên kiểm tra.')
    );
  }, [load]);
  React.useEffect(() => {
    const candidate = session?.candidates.find((item) => item.id === selectedId) ?? null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(candidate);
    setSaveState('SAVED');
  }, [selectedId, session]);

  const candidates = React.useMemo(
    () =>
      session?.candidates.filter((candidate) => {
        if (filter === 'ALL') return true;
        if (filter === 'REVIEW')
          return candidate.status === 'WARNING' || candidate.warnings.length > 0;
        if (filter === 'MISSING_ANSWER') return !candidate.correctAnswer;
        if (filter === 'SUSPECT_MATH')
          return candidate.warnings.some((warning) => warning.code === 'SUSPECT_MATH');
        if (filter === 'HAS_ASSET') return Boolean(candidate.questionAssetDescription);
        if (filter === 'APPROVED') return candidate.status === 'APPROVED';
        return true;
      }) ?? [],
    [filter, session]
  );
  const selectedIndex =
    session?.candidates.findIndex((candidate) => candidate.id === selectedId) ?? -1;
  const selectedPage =
    session?.pages.find((page) => draft?.sourcePageIds.includes(page.id)) ?? session?.pages[0];

  async function saveCandidate(candidate = draft) {
    if (!candidate) return;
    setSaveState('SAVING');
    const response = await fetch(`/api/content-import/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate }),
    });
    if (!response.ok) {
      setSaveState('ERROR');
      setError('Không thể lưu bản nháp.');
      return;
    }
    setSession((await response.json()) as ImportSession);
    setSaveState('SAVED');
  }

  async function approveCandidate(candidate = draft) {
    if (!candidate) return;
    setBusy(true);
    setError('');
    const response = await fetch(
      `/api/content-import/sessions/${sessionId}/candidates/${candidate.id}/approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate }),
      }
    );
    const result = (await response.json()) as { error?: string };
    if (!response.ok) setError(result.error ?? 'Không thể duyệt câu hỏi.');
    else {
      await load();
      const next = session?.candidates[selectedIndex + 1];
      if (next) setSelectedId(next.id);
    }
    setBusy(false);
  }

  async function setCandidateStatus(status: ReviewStatus) {
    if (!draft) return;
    const next = { ...draft, status, updatedAt: new Date().toISOString() };
    setDraft(next);
    await saveCandidate(next);
  }

  function warningAction(
    warningId: string,
    action: QuestionCandidate['warnings'][number]['actions'][number]
  ) {
    if (!draft || !session) return;
    if (action === 'SKIP') {
      void setCandidateStatus('SKIPPED');
      return;
    }
    const next = { ...draft };
    if (action === 'NO_ANSWER') next.correctAnswer = '';
    if (action === 'MERGE_NEXT_PAGE') {
      const lastOrder = Math.max(
        ...next.sourcePageIds.map((id) => session.pages.find((page) => page.id === id)?.order ?? 0)
      );
      const page = session.pages.find((item) => item.order === lastOrder + 1);
      if (page && !next.sourcePageIds.includes(page.id))
        next.sourcePageIds = [...next.sourcePageIds, page.id];
    }
    if (action === 'RESELECT_REGION') next.sourceBounds = { x: 5, y: 5, width: 90, height: 90 };
    next.warnings = next.warnings.filter((warning) => warning.id !== warningId);
    next.status = 'EDITED';
    next.updatedAt = new Date().toISOString();
    setDraft(next);
    setSaveState('SAVING');
    void saveCandidate(next);
  }

  async function approveSafeCandidates() {
    if (!session) return;
    setBusy(true);
    const safe = session.candidates.filter(
      (candidate) =>
        candidate.status !== 'APPROVED' &&
        candidate.status !== 'SKIPPED' &&
        candidate.warnings.length === 0 &&
        candidate.content.trim()
    );
    for (const candidate of safe) {
      await fetch(`/api/content-import/sessions/${sessionId}/candidates/${candidate.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate }),
      });
    }
    await load();
    setBusy(false);
  }

  async function finalize() {
    setBusy(true);
    setError('');
    const response = await fetch(`/api/content-import/sessions/${sessionId}/finalize`, {
      method: 'POST',
    });
    const result = (await response.json()) as { session?: ImportSession; error?: string };
    if (!response.ok || !result.session) setError(result.error ?? 'Không thể hoàn tất phiên nhập.');
    else setSession(result.session);
    setBusy(false);
  }

  if (!session)
    return (
      <div className="grid h-full place-items-center bg-slate-50 text-sm text-slate-500">
        {error || 'Đang tải không gian kiểm tra…'}
      </div>
    );
  if (session.currentStep === 5)
    return (
      <Completion
        session={session}
        onContinue={() => {
          setSession({ ...session, currentStep: 4 });
        }}
      />
    );
  if (!draft)
    return (
      <div className="grid h-full place-items-center bg-slate-50">
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-800">Không có câu hỏi được phát hiện</p>
          <p className="mt-1 text-xs text-slate-500">Quay lại bước tải ảnh để kiểm tra nguồn.</p>
          <Button
            nativeButton={false}
            className="mt-3"
            variant="outline"
            size="sm"
            render={<Link href="/admin/exams/import/images" />}
          >
            Quay lại tải ảnh
          </Button>
        </div>
      </div>
    );

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-100">
      <header className="z-20 flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2 sm:px-3">
        <Button
          nativeButton={false}
          variant="ghost"
          size="icon-sm"
          render={<Link href="/admin/exams" />}
          aria-label="Quay lại"
        >
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">
            {session.examMetadata?.name || 'Đề nhập từ ảnh'}
          </p>
          <p className="text-[10px] text-slate-400">
            Cần kiểm tra · Câu {selectedIndex + 1} / {session.candidates.length}
          </p>
        </div>
        <span
          className={`hidden items-center gap-1 text-[11px] sm:flex ${saveState === 'ERROR' ? 'text-red-600' : 'text-slate-400'}`}
        >
          <Save className="size-3" />
          {saveState === 'SAVING' ? 'Đang lưu…' : saveState === 'ERROR' ? 'Lưu thất bại' : 'Đã lưu'}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="hidden md:inline-flex"
          onClick={() => void approveSafeCandidates()}
          disabled={busy}
        >
          Duyệt câu không cảnh báo
        </Button>
        <Button
          size="sm"
          onClick={() => void approveCandidate()}
          disabled={busy || !draft.content.trim()}
        >
          <Check /> Duyệt câu hỏi
        </Button>
      </header>

      {error && (
        <div
          role="alert"
          className="z-10 flex shrink-0 items-center justify-between border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          <span>{error}</span>
          <button className="font-semibold" onClick={() => setError('')}>
            Đóng
          </button>
        </div>
      )}
      <div className="flex shrink-0 border-b border-slate-200 bg-white p-1 md:hidden">
        <button
          className={`flex-1 rounded px-3 py-1.5 text-xs font-medium ${mobileTab === 'SOURCE' ? 'bg-blue-50 text-blue-700' : 'text-slate-500'}`}
          onClick={() => setMobileTab('SOURCE')}
        >
          Ảnh gốc
        </button>
        <button
          className={`flex-1 rounded px-3 py-1.5 text-xs font-medium ${mobileTab === 'EDITOR' ? 'bg-blue-50 text-blue-700' : 'text-slate-500'}`}
          onClick={() => setMobileTab('EDITOR')}
        >
          Dữ liệu trích xuất
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside
          className={`${navigatorOpen ? 'w-52' : 'w-10'} hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] lg:flex`}
        >
          <div className="flex h-10 items-center justify-between border-b border-slate-100 px-2">
            <span
              className={`text-xs font-semibold text-slate-700 ${navigatorOpen ? '' : 'sr-only'}`}
            >
              Câu hỏi
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setNavigatorOpen((value) => !value)}
              aria-label={navigatorOpen ? 'Thu gọn danh sách câu' : 'Mở danh sách câu'}
            >
              {navigatorOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
            </Button>
          </div>
          {navigatorOpen && (
            <>
              <div className="border-b border-slate-100 p-2">
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="REVIEW">Cần kiểm tra</option>
                  <option value="MISSING_ANSWER">Thiếu đáp án</option>
                  <option value="SUSPECT_MATH">Công thức nghi ngờ</option>
                  <option value="HAS_ASSET">Có hình</option>
                  <option value="APPROVED">Đã duyệt</option>
                </select>
              </div>
              <nav className="min-h-0 flex-1 overflow-y-auto p-1.5" aria-label="Danh sách câu hỏi">
                <ul className="space-y-1">
                  {candidates.map((candidate) => {
                    const page = session.pages.find((item) =>
                      candidate.sourcePageIds.includes(item.id)
                    );
                    return (
                      <li key={candidate.id}>
                        <button
                          onClick={() => setSelectedId(candidate.id)}
                          className={`w-full rounded-md border px-2 py-2 text-left ${candidate.id === selectedId ? 'border-blue-200 bg-blue-50' : 'border-transparent hover:bg-slate-50'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`size-2 rounded-full ${STATUS_DOT[candidate.status]}`}
                            />
                            <span className="text-xs font-semibold text-slate-700">
                              Câu {candidate.number}
                            </span>
                            {candidate.warnings.length > 0 && (
                              <span className="ml-auto text-amber-600">!</span>
                            )}
                          </div>
                          <p className="mt-1 truncate text-[10px] text-slate-400">
                            Trang {page?.order ?? '—'} ·{' '}
                            {QUESTION_TYPE_LABELS[candidate.questionType]}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {STATUS_LABELS[candidate.status]}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </>
          )}
        </aside>

        <section
          className={`${mobileTab === 'SOURCE' ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col border-r border-slate-200 bg-slate-200 md:flex md:basis-[48%]`}
        >
          <div className="flex h-10 shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))}
              aria-label="Thu nhỏ"
            >
              <Minus />
            </Button>
            <span className="w-11 text-center text-[11px] text-slate-500">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setZoom((value) => Math.min(2.5, value + 0.1))}
              aria-label="Phóng to"
            >
              <Plus />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setZoom(1)}
              aria-label="Vừa chiều rộng"
            >
              <Maximize2 />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setViewerRotation((value) => (value + 90) % 360)}
              aria-label="Xoay khung xem"
            >
              <RotateCw />
            </Button>
            <span className="mx-1 h-5 w-px bg-slate-200" />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setAnnotations((value) => !value)}
              aria-label="Bật tắt vùng nhận diện"
            >
              {annotations ? <Eye /> : <EyeOff />}
            </Button>
            <Button
              variant="outline"
              size="xs"
              className="ml-auto"
              onClick={() => setProcessed((value) => !value)}
            >
              {processed ? 'Bản xử lý' : 'Ảnh gốc'}
            </Button>
          </div>
          <div className="flex min-h-0 flex-1">
            <div className="w-16 shrink-0 overflow-y-auto border-r border-slate-300 bg-slate-100 p-1.5">
              {session.pages.map((page) => (
                <button
                  key={page.id}
                  onClick={() => {
                    if (draft.sourcePageIds.includes(page.id)) return;
                    setViewerRotation(0);
                  }}
                  className={`relative mb-1.5 block h-16 w-12 overflow-hidden rounded border ${selectedPage?.id === page.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-300'}`}
                >
                  <Image
                    src={sourceUrl(session.id, page.id)}
                    alt={`Trang ${page.order}`}
                    fill
                    unoptimized
                    sizes="48px"
                    className="object-cover"
                  />
                  <span className="absolute bottom-0 right-0 bg-slate-900/70 px-1 text-[9px] text-white">
                    {page.order}
                  </span>
                </button>
              ))}
            </div>
            <div className="min-w-0 flex-1 overflow-auto p-4">
              {selectedPage && (
                <div
                  className="relative mx-auto origin-top bg-white shadow-sm"
                  style={{
                    width: `${Math.min(760, selectedPage.width)}px`,
                    aspectRatio: `${selectedPage.width}/${selectedPage.height}`,
                    transform: `scale(${zoom}) rotate(${viewerRotation}deg)`,
                    filter: processed ? 'grayscale(1) contrast(1.2)' : undefined,
                  }}
                >
                  <Image
                    src={sourceUrl(session.id, selectedPage.id)}
                    alt={`${processed ? 'Bản xem trước xử lý' : 'Ảnh gốc'} trang ${selectedPage.order}`}
                    fill
                    unoptimized
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-contain"
                  />
                  {annotations &&
                    draft.sourceBounds &&
                    draft.sourcePageIds[0] === selectedPage.id && (
                      <div
                        className="absolute border-2 border-blue-500 bg-blue-500/10"
                        style={{
                          left: `${draft.sourceBounds.x}%`,
                          top: `${draft.sourceBounds.y}%`,
                          width: `${draft.sourceBounds.width}%`,
                          height: `${draft.sourceBounds.height}%`,
                        }}
                      >
                        <span className="absolute -top-5 left-0 bg-blue-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                          Câu {draft.number}
                        </span>
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section
          className={`${mobileTab === 'EDITOR' ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col bg-slate-50 md:flex md:basis-[52%]`}
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <QuestionCandidateEditor
              candidate={draft}
              sessionId={session.id}
              onChange={(candidate) => {
                setDraft(candidate);
                setSaveState('SAVING');
              }}
              onWarningAction={warningAction}
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-200 bg-white px-3 py-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void saveCandidate()}
              disabled={saveState === 'SAVING'}
            >
              Lưu nháp
            </Button>
            <Button size="sm" onClick={() => void approveCandidate()} disabled={busy}>
              Duyệt câu
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void setCandidateStatus('SKIPPED')}>
              <SkipForward /> Bỏ qua
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-amber-700"
              onClick={() => void setCandidateStatus('WARNING')}
            >
              Đánh dấu cần chuyên môn
            </Button>
            <div className="ml-auto flex gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() =>
                  selectedIndex > 0 && setSelectedId(session.candidates[selectedIndex - 1].id)
                }
                disabled={selectedIndex <= 0}
                aria-label="Câu trước"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() =>
                  selectedIndex < session.candidates.length - 1 &&
                  setSelectedId(session.candidates[selectedIndex + 1].id)
                }
                disabled={selectedIndex >= session.candidates.length - 1}
                aria-label="Câu sau"
              >
                <ChevronRight />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => void finalize()} disabled={busy}>
              Hoàn tất import
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
