'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  GripVertical,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Shuffle,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KnowledgeNodePicker } from '@/components/admin/question-bank/knowledge-node-picker';
import type {
  ExamDraftInput,
  ExamQuestionCriteria,
  ExamRecord,
  ExamSelectionFailure,
  ExamSelectionRule,
} from '@/lib/exams/exam-types';
import type {
  Difficulty,
  Grade,
  Question,
  QuestionType,
  SubjectId,
} from '@/lib/question-bank/qb-types';
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_VALUES,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_VALUES,
  SUBJECT_ID_VALUES,
  SUBJECT_LABELS,
} from '@/lib/question-bank/qb-types';

interface ExamDetailResponse {
  exam: ExamRecord;
  questions: Question[];
}

interface CandidateResponse {
  questions: Question[];
  total: number;
}

interface GenerateSuccess {
  ok: true;
  questionIds: string[];
  questions: Question[];
  allocations: Array<{
    ruleIndex: number;
    criteria: ExamQuestionCriteria;
    questionIds: string[];
  }>;
}

const GRADES: Grade[] = [10, 11, 12];

function messageFromResponse(value: unknown, fallback: string): string {
  if (!value || typeof value !== 'object') return fallback;
  const body = value as { message?: string; error?: string; details?: Array<{ message?: string }> };
  return (
    body.details
      ?.map((item) => item.message)
      .filter(Boolean)
      .join(' ') ||
    body.message ||
    body.error ||
    fallback
  );
}

function NativeSelect(props: React.ComponentProps<'select'>) {
  return (
    <select
      {...props}
      className={`h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${props.className ?? ''}`}
    />
  );
}

export function ExamComposer({ examId }: { examId?: string }) {
  const router = useRouter();
  const [record, setRecord] = React.useState<ExamRecord | null>(null);
  const [name, setName] = React.useState('');
  const [subjectId, setSubjectId] = React.useState<SubjectId | undefined>();
  const [grade, setGrade] = React.useState<Grade | undefined>();
  const [durationMinutes, setDurationMinutes] = React.useState<number | undefined>(45);
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [candidates, setCandidates] = React.useState<Question[]>([]);
  const [candidateTotal, setCandidateTotal] = React.useState(0);
  const [candidateLoading, setCandidateLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [manualChapterId, setManualChapterId] = React.useState('');
  const [manualLessonId, setManualLessonId] = React.useState('');
  const [manualKnowledgeNodeId, setManualKnowledgeNodeId] = React.useState('');
  const [manualDifficulty, setManualDifficulty] = React.useState<Difficulty | ''>('');
  const [manualType, setManualType] = React.useState<QuestionType | ''>('');
  const [rules, setRules] = React.useState<ExamSelectionRule[]>([{ count: 5 }]);
  const [selectionStrategy, setSelectionStrategy] = React.useState<'SEQUENTIAL' | 'RANDOM'>(
    'SEQUENTIAL'
  );
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [shortfall, setShortfall] = React.useState<ExamSelectionFailure | null>(null);
  const [draggedId, setDraggedId] = React.useState<string | null>(null);

  const published = record?.publishStatus === 'PUBLISHED';
  const selectedIds = React.useMemo(
    () => new Set(questions.map((question) => question.id)),
    [questions]
  );
  const selectedIdKey = React.useMemo(
    () => questions.map((question) => question.id).join('\u0000'),
    [questions]
  );

  React.useEffect(() => {
    async function load() {
      if (!examId) return;
      const detailResponse = await fetch(`/api/exams/${examId}`);
      if (!detailResponse.ok) throw new Error('Không tải được đề thi.');
      const detail = (await detailResponse.json()) as ExamDetailResponse;
      setRecord(detail.exam);
      setName(detail.exam.name);
      setSubjectId(detail.exam.subjectId);
      setGrade(detail.exam.grade);
      setDurationMinutes(detail.exam.durationMinutes);
      const byId = new Map(detail.questions.map((question) => [question.id, question]));
      setQuestions(
        detail.exam.questionIds
          .map((questionId) => byId.get(questionId))
          .filter((question): question is Question => Boolean(question))
      );
    }
    void load()
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Không thể mở trình biên soạn.')
      )
      .finally(() => setLoading(false));
  }, [examId]);

  React.useEffect(() => {
    if (published) return;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setCandidateLoading(true);
      void fetch('/api/exams/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          mode: 'CANDIDATES',
          limit: 60,
          excludeQuestionIds: selectedIdKey ? selectedIdKey.split('\u0000') : [],
          criteria: {
            search: search.trim() || undefined,
            subjectId,
            grade,
            chapterId: manualChapterId.trim() || undefined,
            lessonId: manualLessonId.trim() || undefined,
            knowledgeNodeId: manualKnowledgeNodeId || undefined,
            difficulty: manualDifficulty || undefined,
            questionType: manualType || undefined,
          },
        }),
      })
        .then(async (response) => {
          const result = (await response.json()) as CandidateResponse & { error?: string };
          if (!response.ok) {
            throw new Error(messageFromResponse(result, 'Không tải được câu hỏi đủ điều kiện.'));
          }
          setCandidates(result.questions);
          setCandidateTotal(result.total);
        })
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === 'AbortError') return;
          setError(
            reason instanceof Error ? reason.message : 'Không tải được câu hỏi đủ điều kiện.'
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setCandidateLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    grade,
    manualChapterId,
    manualDifficulty,
    manualKnowledgeNodeId,
    manualLessonId,
    manualType,
    published,
    search,
    selectedIdKey,
    subjectId,
  ]);

  const manualCandidates = React.useMemo(() => {
    return candidates.filter((question) => !selectedIds.has(question.id));
  }, [candidates, selectedIds]);

  function addQuestion(question: Question) {
    setQuestions((current) =>
      current.some((item) => item.id === question.id) ? current : [...current, question]
    );
    setNotice(`Đã thêm ${question.code} vào cuối đề.`);
  }

  function removeQuestion(questionId: string) {
    setQuestions((current) => current.filter((question) => question.id !== questionId));
  }

  function moveQuestion(questionId: string, offset: number) {
    setQuestions((current) => {
      const from = current.findIndex((question) => question.id === questionId);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function dropBefore(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    setQuestions((current) => {
      const next = [...current];
      const from = next.findIndex((question) => question.id === draggedId);
      const target = next.findIndex((question) => question.id === targetId);
      if (from < 0 || target < 0) return current;
      const [moved] = next.splice(from, 1);
      next.splice(from < target ? target - 1 : target, 0, moved);
      return next;
    });
    setDraggedId(null);
  }

  async function generate() {
    setBusy(true);
    setError('');
    setNotice('');
    setShortfall(null);
    try {
      const normalizedRules = rules.map((rule) => ({
        ...rule,
        subjectId: rule.subjectId ?? subjectId,
        grade: rule.grade ?? grade,
      }));
      const response = await fetch('/api/exams/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'GENERATE',
          strategy: selectionStrategy,
          rules: normalizedRules,
          excludeQuestionIds: questions.map((question) => question.id),
        }),
      });
      const result = (await response.json()) as GenerateSuccess | ExamSelectionFailure;
      if (!response.ok || !result.ok) {
        if ('error' in result && result.error === 'INSUFFICIENT_QUESTIONS') setShortfall(result);
        throw new Error(messageFromResponse(result, 'Không đủ câu hỏi phù hợp.'));
      }
      const byId = new Map(result.questions.map((question) => [question.id, question]));
      const generated = result.questionIds.flatMap((questionId) => {
        const question = byId.get(questionId);
        return question ? [question] : [];
      });
      if (generated.length !== result.questionIds.length) {
        throw new Error('Máy chủ không trả đủ nội dung câu hỏi đã chọn.');
      }
      setQuestions((current) => [...current, ...generated]);
      setNotice(`Đã tự động thêm ${generated.length} câu, không có câu trùng.`);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Không thể tự động chọn câu hỏi.');
    } finally {
      setBusy(false);
    }
  }

  async function replaceQuestion(question: Question) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/exams/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'REPLACEMENT',
          targetQuestionId: question.id,
          currentQuestionIds: questions.map((item) => item.id),
        }),
      });
      const result = (await response.json()) as CandidateResponse & { error?: string };
      if (!response.ok) throw new Error(messageFromResponse(result, 'Không thể tìm câu thay thế.'));
      const replacement = result.questions[0];
      if (!replacement)
        throw new Error('Không còn câu hỏi thay thế phù hợp với tiêu chí của câu này.');
      setQuestions((current) =>
        current.map((item) => (item.id === question.id ? replacement : item))
      );
      setNotice(`Đã thay ${question.code} bằng ${replacement.code}.`);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Không thể thay câu hỏi.');
    } finally {
      setBusy(false);
    }
  }

  function draftPayload(): ExamDraftInput {
    return {
      name: name.trim(),
      subjectId,
      grade,
      durationMinutes,
      questionIds: questions.map((question) => question.id),
    };
  }

  async function saveDraft(): Promise<ExamRecord> {
    if (!name.trim()) throw new Error('Hãy nhập tên đề trước khi lưu.');
    const response = await fetch(record ? `/api/exams/${record.id}` : '/api/exams', {
      method: record ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draftPayload()),
    });
    const result = (await response.json()) as ExamRecord & { error?: string; message?: string };
    if (!response.ok) throw new Error(messageFromResponse(result, 'Không thể lưu bản nháp.'));
    setRecord(result);
    if (!record) router.replace(`/admin/exams/${result.id}`);
    return result;
  }

  async function handleSave() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await saveDraft();
      setNotice('Đã lưu bản nháp.');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Không thể lưu bản nháp.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = await saveDraft();
      const response = await fetch(`/api/exams/${saved.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PUBLISH' }),
      });
      const result = (await response.json()) as ExamRecord & {
        error?: string;
        details?: Array<{ message?: string }>;
      };
      if (!response.ok)
        throw new Error(messageFromResponse(result, 'Đề chưa đủ điều kiện xuất bản.'));
      setRecord(result);
      setNotice('Đã xuất bản và đóng băng nội dung đề thành công.');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Không thể xuất bản đề.');
    } finally {
      setBusy(false);
    }
  }

  function updateRule(index: number, patch: Partial<ExamSelectionRule>) {
    setRules((current) =>
      current.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...patch } : rule))
    );
  }

  if (loading) {
    return (
      <div className="grid min-h-80 place-items-center text-sm text-slate-500">
        Đang mở trình biên soạn…
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12">
      <header className="flex flex-wrap items-center gap-3">
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          render={<Link href="/admin/exams" />}
        >
          <ArrowLeft /> Danh sách đề
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {published ? 'Đề đã xuất bản' : record ? 'Biên soạn đề' : 'Tạo đề mới'}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {published
              ? 'Nội dung bên dưới là snapshot bất biến tại thời điểm xuất bản.'
              : 'Chọn thủ công hoặc tự động điền trong cùng một bản nháp.'}
          </p>
        </div>
        {published ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="size-4" /> Đã xuất bản
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void handleSave()} disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" /> : <Save />} Lưu nháp
            </Button>
            <Button onClick={() => void handlePublish()} disabled={busy}>
              <Send /> Xuất bản
            </Button>
          </div>
        )}
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Đóng">
            <X className="size-4" />
          </button>
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}
      {shortfall && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">Không đủ câu hỏi để tự động điền</p>
          <ul className="mt-1 list-disc pl-5 text-xs leading-5">
            {shortfall.shortfalls.map((item) => (
              <li key={item.ruleIndex}>
                Nhóm {item.ruleIndex + 1}: cần {item.requested}, hiện có {item.available}, thiếu{' '}
                {item.shortage} câu.
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs">Không câu nào được thêm từ lần tạo này.</p>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Thông tin đề</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <label className="md:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-600">Tên đề *</span>
            <Input
              value={name}
              disabled={published}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ví dụ: Kiểm tra giữa kỳ I"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-600">Môn học</span>
            <NativeSelect
              className="w-full"
              value={subjectId ?? ''}
              disabled={published}
              onChange={(event) =>
                setSubjectId((event.target.value || undefined) as SubjectId | undefined)
              }
            >
              <option value="">Chọn môn</option>
              {SUBJECT_ID_VALUES.map((value) => (
                <option key={value} value={value}>
                  {SUBJECT_LABELS[value]}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-600">Lớp</span>
            <NativeSelect
              className="w-full"
              value={grade ?? ''}
              disabled={published}
              onChange={(event) =>
                setGrade(event.target.value ? (Number(event.target.value) as Grade) : undefined)
              }
            >
              <option value="">Chọn lớp</option>
              {GRADES.map((value) => (
                <option key={value} value={value}>
                  Lớp {value}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-600">Thời gian (phút)</span>
            <Input
              type="number"
              min={1}
              value={durationMinutes ?? ''}
              disabled={published}
              onChange={(event) =>
                setDurationMinutes(event.target.value ? Number(event.target.value) : undefined)
              }
            />
          </label>
        </div>
      </section>

      {!published && (
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Chọn câu thủ công</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Chỉ hiển thị câu đã xuất bản và hợp lệ.
                </p>
              </div>
              <span className="text-xs text-slate-500">
                {candidateLoading ? 'Đang lọc…' : `${candidateTotal} khả dụng`}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="relative col-span-2">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" />
                <Input
                  className="pl-8"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm mã hoặc nội dung câu…"
                />
              </label>
              <Input
                aria-label="Mã chương"
                value={manualChapterId}
                onChange={(event) => setManualChapterId(event.target.value)}
                placeholder="Mã chương (nếu cần)"
              />
              <Input
                aria-label="Mã bài học"
                value={manualLessonId}
                onChange={(event) => setManualLessonId(event.target.value)}
                placeholder="Mã bài học (nếu cần)"
              />
              <div className="col-span-2 flex items-center gap-2">
                <KnowledgeNodePicker
                  value={manualKnowledgeNodeId}
                  onChange={(nodeId) => setManualKnowledgeNodeId(nodeId)}
                  placeholder="Lọc theo mục kiến thức…"
                  className="min-w-0 flex-1"
                />
                {manualKnowledgeNodeId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setManualKnowledgeNodeId('')}
                    aria-label="Bỏ lọc mục kiến thức"
                  >
                    <X />
                  </Button>
                )}
              </div>
              <NativeSelect
                value={manualDifficulty}
                onChange={(event) => setManualDifficulty(event.target.value as Difficulty | '')}
              >
                <option value="">Mọi độ khó</option>
                {DIFFICULTY_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {DIFFICULTY_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                value={manualType}
                onChange={(event) => setManualType(event.target.value as QuestionType | '')}
              >
                <option value="">Mọi dạng câu</option>
                {QUESTION_TYPE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {QUESTION_TYPE_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="mt-3 max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {candidateLoading ? (
                <p className="flex items-center justify-center gap-2 p-5 text-xs text-slate-500">
                  <LoaderCircle className="size-4 animate-spin" /> Đang tìm trong Ngân hàng câu hỏi…
                </p>
              ) : manualCandidates.length === 0 ? (
                <p className="p-5 text-center text-xs text-slate-500">Không có câu phù hợp.</p>
              ) : (
                manualCandidates.map((question) => (
                  <div key={question.id} className="flex items-start gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-blue-700">
                        {question.code} · {DIFFICULTY_LABELS[question.difficulty]}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-700">
                        {question.stem}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => addQuestion(question)}>
                      <Plus /> Thêm
                    </Button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Shuffle className="size-4 text-blue-600" /> Tự động điền theo tiêu chí
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Các nhóm chạy lần lượt và luôn loại các câu đã được cấp.
              </p>
            </div>
            <div className="mt-3 space-y-2">
              {rules.map((rule, index) => (
                <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">Nhóm {index + 1}</span>
                    {rules.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setRules((current) =>
                            current.filter((_, itemIndex) => itemIndex !== index)
                          )
                        }
                        className="text-slate-400 hover:text-red-600"
                        aria-label={`Xóa nhóm ${index + 1}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Input
                      aria-label="Số câu"
                      type="number"
                      min={1}
                      value={rule.count}
                      onChange={(event) => updateRule(index, { count: Number(event.target.value) })}
                    />
                    <NativeSelect
                      aria-label="Môn học"
                      value={rule.subjectId ?? ''}
                      onChange={(event) =>
                        updateRule(index, {
                          subjectId: (event.target.value || undefined) as SubjectId | undefined,
                        })
                      }
                    >
                      <option value="">Môn của đề</option>
                      {SUBJECT_ID_VALUES.map((value) => (
                        <option key={value} value={value}>
                          {SUBJECT_LABELS[value]}
                        </option>
                      ))}
                    </NativeSelect>
                    <Input
                      aria-label="Mã chương"
                      value={rule.chapterId ?? ''}
                      onChange={(event) =>
                        updateRule(index, { chapterId: event.target.value || undefined })
                      }
                      placeholder="Mã chương"
                    />
                    <Input
                      aria-label="Mã bài học"
                      value={rule.lessonId ?? ''}
                      onChange={(event) =>
                        updateRule(index, { lessonId: event.target.value || undefined })
                      }
                      placeholder="Mã bài học"
                    />
                    <NativeSelect
                      aria-label="Khối lớp"
                      value={rule.grade ?? ''}
                      onChange={(event) =>
                        updateRule(index, {
                          grade: event.target.value
                            ? (Number(event.target.value) as Grade)
                            : undefined,
                        })
                      }
                    >
                      <option value="">Lớp của đề</option>
                      {GRADES.map((value) => (
                        <option key={value} value={value}>
                          Lớp {value}
                        </option>
                      ))}
                    </NativeSelect>
                    <NativeSelect
                      value={rule.difficulty ?? ''}
                      onChange={(event) =>
                        updateRule(index, {
                          difficulty: (event.target.value || undefined) as Difficulty | undefined,
                        })
                      }
                    >
                      <option value="">Mọi độ khó</option>
                      {DIFFICULTY_VALUES.map((value) => (
                        <option key={value} value={value}>
                          {DIFFICULTY_LABELS[value]}
                        </option>
                      ))}
                    </NativeSelect>
                    <NativeSelect
                      value={rule.questionType ?? ''}
                      onChange={(event) =>
                        updateRule(index, {
                          questionType: (event.target.value || undefined) as
                            QuestionType | undefined,
                        })
                      }
                    >
                      <option value="">Mọi dạng</option>
                      {QUESTION_TYPE_VALUES.map((value) => (
                        <option key={value} value={value}>
                          {QUESTION_TYPE_LABELS[value]}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <KnowledgeNodePicker
                      value={rule.knowledgeNodeId}
                      onChange={(knowledgeNodeId) => updateRule(index, { knowledgeNodeId })}
                      placeholder="Giới hạn theo mục kiến thức…"
                      className="min-w-0 flex-1"
                    />
                    {rule.knowledgeNodeId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => updateRule(index, { knowledgeNodeId: undefined })}
                        aria-label={`Bỏ mục kiến thức nhóm ${index + 1}`}
                      >
                        <X />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRules((current) => [...current, { count: 5 }])}
              >
                <Plus /> Thêm nhóm
              </Button>
              <NativeSelect
                aria-label="Cách chọn câu"
                value={selectionStrategy}
                onChange={(event) =>
                  setSelectionStrategy(event.target.value as 'SEQUENTIAL' | 'RANDOM')
                }
              >
                <option value="SEQUENTIAL">Chọn ổn định</option>
                <option value="RANDOM">Trộn ngẫu nhiên có điều kiện</option>
              </NativeSelect>
              <Button size="sm" onClick={() => void generate()} disabled={busy}>
                {busy ? <LoaderCircle className="animate-spin" /> : <Shuffle />} Tạo và thêm vào đề
              </Button>
            </div>
          </section>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Nội dung đề</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {questions.length} câu · thứ tự này được dùng khi xuất bản
            </p>
          </div>
        </div>
        {questions.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Chưa có câu hỏi. Chọn thủ công hoặc dùng tự động điền ở trên.
          </div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {questions.map((question, index) => (
              <li
                key={question.id}
                draggable={!published}
                onDragStart={() => setDraggedId(question.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropBefore(question.id)}
                className="flex items-start gap-3 px-4 py-4"
              >
                <span className="mt-0.5 flex items-center gap-1 text-slate-400">
                  {!published && <GripVertical className="size-4 cursor-grab" />}
                  <span className="grid size-6 place-items-center rounded-md bg-slate-100 text-xs font-semibold text-slate-700">
                    {index + 1}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-semibold text-blue-700">{question.code}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                      {QUESTION_TYPE_LABELS[question.questionType]}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                      {DIFFICULTY_LABELS[question.difficulty]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-slate-800">{question.stem}</p>
                  {published && (
                    <p className="mt-2 text-xs font-medium text-emerald-700">
                      Đáp án: {question.correctAnswer}
                    </p>
                  )}
                </div>
                {!published && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === 0}
                      onClick={() => moveQuestion(question.id, -1)}
                      aria-label="Đưa câu lên"
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === questions.length - 1}
                      onClick={() => moveQuestion(question.id, 1)}
                      aria-label="Đưa câu xuống"
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={busy}
                      onClick={() => void replaceQuestion(question)}
                      aria-label="Thay câu"
                    >
                      <RefreshCw />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeQuestion(question.id)}
                      aria-label="Xóa câu"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
