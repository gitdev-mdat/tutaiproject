'use client';

import * as React from 'react';
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { QuestionBankHeader } from './qb-header';
import { QuestionBankMetricsRow } from './qb-metrics';
import { QuestionBankFilters } from './qb-filters';
import { QuestionBankTable } from './qb-table';
import { QuestionBankBulkActions } from './qb-bulk-actions';
import { QuestionImportWizard } from './qb-import-wizard';
import { ImportJobHistory } from './qb-import-history';
import type {
  Question,
  QuestionFilter,
  QuestionBankMetrics,
  ImportJob,
  QuestionListResult,
} from '@/lib/question-bank/qb-types';

const DEFAULT_FILTER: QuestionFilter = {
  page: 1,
  pageSize: 50,
};

function countActiveFilters(filter: QuestionFilter): number {
  let count = 0;
  if (filter.search) count++;
  if (filter.subjectId) count++;
  if (filter.grade) count++;
  if (filter.chapterId) count++;
  if (filter.lessonId) count++;
  if (filter.curriculumItemId) count++;
  if (filter.questionType) count++;
  if (filter.difficulty) count++;
  if (filter.accessTier) count++;
  if (filter.usageContext) count++;
  if (filter.editorialStatus) count++;
  if (filter.roadmapEligible !== undefined) count++;
  if (filter.isSpecial !== undefined) count++;
  if (filter.sourceType) count++;
  if (filter.importOrigin) count++;
  return count;
}

function EmptyWorkspace() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-slate-400"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      </div>
      <div className="mt-4 space-y-1.5 text-center">
        <p className="text-sm font-semibold text-slate-800">Chưa có câu hỏi</p>
        <p className="text-xs leading-relaxed text-slate-500">
          Thêm câu hỏi thủ công hoặc nhập từ tài liệu có sẵn.
          <br />
          PDF · Word · Excel/CSV/JSON · Ảnh đơn
        </p>
      </div>
      <div className="mt-6 flex items-center gap-2">
        <Link
          href="/admin/question-bank/import"
          className="inline-flex h-8 items-center justify-center rounded-lg border border-transparent bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Nhập câu hỏi
        </Link>
        <Link
          href="/admin/question-bank/new"
          className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          + Thêm câu hỏi
        </Link>
      </div>
    </div>
  );
}

export function QuestionBankPage() {
  const [tab, setTab] = React.useState('questions');
  const [filter, setFilter] = React.useState<QuestionFilter>(DEFAULT_FILTER);
  const [listResult, setListResult] = React.useState<QuestionListResult | null>(null);
  const [metrics, setMetrics] = React.useState<QuestionBankMetrics | null>(null);
  const [importJobs, setImportJobs] = React.useState<ImportJob[]>([]);
  const [loadingQuestions, setLoadingQuestions] = React.useState(false);
  const [loadingMetrics, setLoadingMetrics] = React.useState(false);
  const [loadingJobs, setLoadingJobs] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [showImportWizard, setShowImportWizard] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch questions
  const fetchQuestions = React.useCallback(async (f: QuestionFilter) => {
    setLoadingQuestions(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (f.search) params.set('search', f.search);
      if (f.subjectId) params.set('subjectId', f.subjectId);
      if (f.grade) params.set('grade', String(f.grade));
      if (f.chapterId) params.set('chapterId', f.chapterId);
      if (f.lessonId) params.set('lessonId', f.lessonId);
      if (f.questionType) params.set('questionType', f.questionType);
      if (f.difficulty) params.set('difficulty', f.difficulty);
      if (f.accessTier) params.set('accessTier', f.accessTier);
      if (f.usageContext) params.set('usageContext', f.usageContext);
      if (f.editorialStatus) params.set('editorialStatus', f.editorialStatus);
      if (f.roadmapEligible !== undefined) params.set('roadmapEligible', String(f.roadmapEligible));
      if (f.isSpecial !== undefined) params.set('isSpecial', String(f.isSpecial));
      if (f.sourceType) params.set('sourceType', f.sourceType);
      if (f.importOrigin) params.set('importOrigin', f.importOrigin);
      params.set('page', String(f.page ?? 1));
      params.set('pageSize', String(f.pageSize ?? 50));

      const res = await fetch(`/api/question-bank?${params}`);
      if (!res.ok) throw new Error('Không tải được danh sách câu hỏi.');
      const data = (await res.json()) as QuestionListResult;
      setListResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setLoadingQuestions(false);
    }
  }, []);

  const fetchMetrics = React.useCallback(async () => {
    setLoadingMetrics(true);
    try {
      const res = await fetch('/api/question-bank/metrics');
      if (res.ok) {
        setMetrics((await res.json()) as QuestionBankMetrics);
      }
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  const fetchJobs = React.useCallback(async () => {
    setLoadingJobs(true);
    try {
      const res = await fetch('/api/question-bank/import-jobs');
      if (res.ok) {
        setImportJobs((await res.json()) as ImportJob[]);
      }
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMetrics();
  }, [fetchMetrics]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchQuestions(filter);
  }, [filter, fetchQuestions]);

  React.useEffect(() => {
    if (tab === 'history') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchJobs();
    }
  }, [tab, fetchJobs]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('import');
    const curriculumItemId = params.get('curriculumItemId');
    if (curriculumItemId) setFilter((current) => ({ ...current, curriculumItemId }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (requested === 'excel' || requested === 'json') setShowImportWizard(true);
  }, []);

  const handleFilterChange = React.useCallback((patch: Partial<QuestionFilter>) => {
    setFilter((f) => ({ ...f, ...patch }));
    setSelectedIds(new Set());
  }, []);

  const handleClearFilters = React.useCallback(() => {
    setFilter(DEFAULT_FILTER);
    setSelectedIds(new Set());
  }, []);

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(listResult?.questions.map((q) => q.id) ?? []));
    } else {
      setSelectedIds(new Set());
    }
  }

  function handleSelectOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleStatusChange(id: string, status: Question['editorialStatus']) {
    try {
      await fetch(`/api/question-bank/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editorialStatus: status }),
      });
      await Promise.all([fetchQuestions(filter), fetchMetrics()]);
    } catch {
      // Silently handle for now — a toast would be added when a toast system is wired
    }
  }

  async function handleBulkStatusChange(status: Question['editorialStatus']) {
    await Promise.all(Array.from(selectedIds).map((id) => handleStatusChange(id, status)));
    setSelectedIds(new Set());
  }

  async function handleBulkSetAccessTier(tier: 'OPEN' | 'PLUS') {
    await Promise.all(
      Array.from(selectedIds).map((id) =>
        fetch(`/api/question-bank/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessTier: tier }),
        })
      )
    );
    setSelectedIds(new Set());
    await Promise.all([fetchQuestions(filter), fetchMetrics()]);
  }

  async function handleBulkSetRoadmap(eligible: boolean) {
    await Promise.all(
      Array.from(selectedIds).map((id) =>
        fetch(`/api/question-bank/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roadmapEligible: eligible }),
        })
      )
    );
    setSelectedIds(new Set());
    await Promise.all([fetchQuestions(filter), fetchMetrics()]);
  }

  const activeFilterCount = countActiveFilters(filter);

  // A globally empty database means no questions exist at all.
  const isGloballyEmpty = metrics?.total === 0;

  return (
    <>
      {/* Import Wizard Overlay */}
      {showImportWizard && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-wizard-title"
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setShowImportWizard(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-[90vh] max-h-[720px] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <QuestionImportWizard
              onClose={() => setShowImportWizard(false)}
              onComplete={() => {
                void Promise.all([fetchQuestions(filter), fetchMetrics()]);
              }}
            />
          </div>
        </div>
      )}

      {/* Page */}
      <div className="space-y-5">
        {/* Header + inline metrics */}
        <div className="space-y-1.5">
          <QuestionBankHeader />
          <QuestionBankMetricsRow metrics={metrics} loading={loadingMetrics} />
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <span>{error}</span>
            <button
              onClick={() => fetchQuestions(filter)}
              className="text-xs font-medium underline"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList variant="line">
            <TabsTrigger value="questions">Câu hỏi</TabsTrigger>
            <TabsTrigger value="history">Lịch sử nhập</TabsTrigger>
          </TabsList>

          <TabsContent value="questions" className="mt-4 space-y-3">
            {isGloballyEmpty ? (
              <EmptyWorkspace />
            ) : (
              <>
                {/* Filters */}
                <QuestionBankFilters
                  filter={filter}
                  onFilterChange={handleFilterChange}
                  onClear={handleClearFilters}
                  activeCount={activeFilterCount}
                />

                {/* Bulk actions */}
                <QuestionBankBulkActions
                  selectedIds={selectedIds}
                  onClearSelection={() => setSelectedIds(new Set())}
                  onBulkStatusChange={handleBulkStatusChange}
                  onBulkSetAccessTier={handleBulkSetAccessTier}
                  onBulkSetRoadmap={handleBulkSetRoadmap}
                />

                {/* Table */}
                <QuestionBankTable
                  questions={listResult?.questions ?? []}
                  loading={loadingQuestions}
                  initialLoad={loadingQuestions && !listResult}
                  selectedIds={selectedIds}
                  onSelectAll={handleSelectAll}
                  onSelectOne={handleSelectOne}
                  onClearFilters={handleClearFilters}
                  onStatusChange={handleStatusChange}
                  total={listResult?.total ?? 0}
                  page={listResult?.page ?? 1}
                  pageSize={listResult?.pageSize ?? 50}
                  onPageChange={(p) => handleFilterChange({ page: p })}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <ImportJobHistory jobs={importJobs} loading={loadingJobs} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
