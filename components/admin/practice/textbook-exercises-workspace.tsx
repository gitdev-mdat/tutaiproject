'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  FileSearch,
  Image as ImageIcon,
  Loader2,
  Pencil,
  RotateCcw,
  X,
} from 'lucide-react';
import { QuestionMath } from '@/components/shared/question-content-renderer';
import { textbookApi } from '@/components/admin/textbooks/textbook-client';
import type {
  LessonPracticeWorkspace,
  PracticeSetView,
} from '@/lib/textbook-reference/practice-service';
import type { TextbookImportOutcome } from '@/lib/textbook-reference/practice-import';
import type { ExerciseChoice, SolutionStatus } from '@/lib/textbook-reference/types';
import { Chip, QUESTION_STATE } from './practice-labels';

type Exercise = PracticeSetView['exercises'][number];
type Candidate = Exercise['candidates'][number];

const STATUS: Record<SolutionStatus, { label: string; tone: string }> = {
  UNRESOLVED: { label: 'Chưa có lời giải', tone: 'bg-slate-100 text-slate-600 ring-slate-200' },
  SUGGESTED: { label: 'Gợi ý ghép', tone: 'bg-sky-50 text-sky-700 ring-sky-200' },
  NEEDS_CONFIRMATION: { label: 'Cần Admin xem', tone: 'bg-amber-50 text-amber-800 ring-amber-200' },
  MATCHED: { label: 'Đáp án theo sách', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  ADMIN_VERIFIED: {
    label: 'Admin tự giải',
    tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
};

const RIGHTS = [
  { value: 'LICENSED', label: 'Tú Tài có giấy phép dùng sách này' },
  { value: 'PERMISSION_GRANTED', label: 'Tác giả hoặc nhà xuất bản đã cho phép' },
  { value: 'PUBLICLY_AVAILABLE', label: 'Tài liệu công khai, được phép dùng' },
  { value: 'REVIEW_REQUIRED', label: 'Chưa rõ: chỉ lưu nháp, chưa xuất bản được' },
] as const;

type Filter = 'ALL' | 'REVIEW' | 'READY' | 'IMPORTED' | 'MISSING';
const FILTERS: Record<Filter, string> = {
  ALL: 'Tất cả',
  REVIEW: 'Cần xem',
  READY: 'Sẵn sàng nhập',
  IMPORTED: 'Đã vào Ngân hàng',
  MISSING: 'Chưa có lời giải',
};
const matchesFilter = (exercise: Exercise, filter: Filter) =>
  filter === 'ALL' ||
  (filter === 'REVIEW' &&
    !exercise.question &&
    (exercise.status === 'SUGGESTED' ||
      exercise.status === 'NEEDS_CONFIRMATION' ||
      (exercise.verification && exercise.blockers.length > 0))) ||
  (filter === 'READY' && !exercise.question && exercise.blockers.length === 0) ||
  (filter === 'IMPORTED' && !!exercise.question) ||
  (filter === 'MISSING' && exercise.status === 'UNRESOLVED');

const button =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors disabled:opacity-50';

async function practiceApi(
  body: Record<string, unknown>
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const response = await fetch('/api/admin/textbooks/practice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!response) return { ok: false, error: 'Không kết nối được máy chủ.' };
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return response.ok
    ? { ok: true, data }
    : { ok: false, error: String(data.error ?? 'Không thực hiện được.') };
}

const pageImage = (documentId: string, page: number) =>
  `/api/admin/textbooks/page-image?documentId=${encodeURIComponent(documentId)}&page=${page}`;

/** A printed page from the private scan, Admin-only, with where it sits in the two-up PDF. */
function ScanPage({
  documentId,
  page,
  layout,
}: {
  documentId: string;
  page: number;
  layout?: { pdfPage: number; position: string };
}) {
  const [open, setOpen] = React.useState(false);
  const [wide, setWide] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const where = layout
    ? `PDF trang ${layout.pdfPage}${layout.position === 'LEFT' ? ', nửa trái' : layout.position === 'RIGHT' ? ', nửa phải' : ''}`
    : null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700"
        aria-expanded={open}
        data-testid={`scan-toggle-${page}`}
      >
        <ImageIcon className="size-3.5 text-slate-400" /> Trang sách {page}
        {where && <span className="font-normal text-slate-500">({where})</span>}
        <ChevronRight className={`ml-auto size-3.5 transition ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-slate-100 p-2">
          {failed ? (
            <p className="px-1 py-3 text-xs text-rose-700">
              Không tải được ảnh trang. Thử mở lại sau.
            </p>
          ) : (
            <div
              className={`overflow-auto rounded bg-slate-50 ${wide ? 'max-h-[80vh]' : 'max-h-[28rem]'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- private, Admin-only route */}
              <img
                src={pageImage(documentId, page)}
                alt={`Trang ${page} của sách (bản quét)`}
                className={wide ? 'max-w-none' : 'w-full'}
                style={wide ? { width: 1000 } : undefined}
                onError={() => setFailed(true)}
                data-testid={`scan-image-${page}`}
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => setWide((v) => !v)}
            className="mt-1 text-[11px] font-semibold text-primary"
          >
            {wide ? 'Thu nhỏ' : 'Phóng to'}
          </button>
        </div>
      )}
    </div>
  );
}

function CandidateCard({
  candidate,
  exercise,
  documentId,
  layouts,
  busy,
  onConfirm,
  onReject,
}: {
  candidate: Candidate;
  exercise: Exercise;
  documentId: string;
  layouts: Record<number, { pdfPage: number; position: string }>;
  busy: boolean;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const strong = candidate.strength === 'STRONG';
  return (
    <li
      className={`rounded-xl border p-3 ${strong ? 'border-sky-200 bg-sky-50/40' : 'border-amber-200 bg-amber-50/40'}`}
      data-testid="candidate"
      data-solution={candidate.solution.id}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip
          tone={
            strong
              ? 'bg-sky-100 text-sky-800 ring-sky-200'
              : 'bg-amber-100 text-amber-900 ring-amber-200'
          }
        >
          {strong ? 'Khớp chắc' : 'Cần đối chiếu'}
        </Chip>
        <span className="text-xs font-semibold text-slate-800">
          {candidate.solution.title} · tr. {candidate.solution.printedPages.join(', ')}
        </span>
        <span className="text-xs text-slate-600">
          · Sách chọn: <strong>{candidate.answerChoice ?? 'không ghi'}</strong>
        </span>
      </div>
      <ul className="mt-2 space-y-0.5 text-xs">
        {candidate.evidence.map((line) => (
          <li key={line} className="flex gap-1.5 text-slate-700">
            <Check className="mt-0.5 size-3 shrink-0 text-emerald-600" /> {line}
          </li>
        ))}
        {candidate.conflicts.map((line) => (
          <li key={line} className="flex gap-1.5 text-amber-900">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" /> {line}
          </li>
        ))}
      </ul>
      <div className="mt-2 rounded-lg bg-white px-3 py-2 text-xs leading-relaxed whitespace-pre-line text-slate-800 ring-1 ring-slate-200">
        <QuestionMath text={candidate.solution.content} />
      </div>
      <div className="mt-2 space-y-1">
        {candidate.solution.printedPages.map((page) => (
          <ScanPage key={page} documentId={documentId} page={page} layout={layouts[page]} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !candidate.answerChoice || !!exercise.verification}
          onClick={onConfirm}
          className={`${button} bg-emerald-600 text-white hover:bg-emerald-700`}
          data-testid="confirm-candidate"
        >
          <CheckCircle2 className="size-3.5" /> Đúng lời giải của câu này
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onReject}
          className={`${button} border border-slate-200 text-slate-700 hover:bg-slate-50`}
          data-testid="reject-candidate"
        >
          <X className="size-3.5" /> Không phải
        </button>
      </div>
    </li>
  );
}

function ChoiceList({ choices, answer }: { choices: ExerciseChoice[]; answer: string | null }) {
  return (
    <ul className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
      {choices.map((choice) => (
        <li
          key={choice.label}
          className={choice.label === answer ? 'font-semibold text-emerald-700' : ''}
        >
          {choice.label}. <QuestionMath text={choice.text} />
        </li>
      ))}
    </ul>
  );
}

function DraftEditor({
  exercise,
  onSave,
  onCancel,
  busy,
}: {
  exercise: Exercise;
  onSave: (draft: { stem: string; choices: ExerciseChoice[]; explanation: string }) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [stem, setStem] = React.useState(exercise.stem);
  const [choices, setChoices] = React.useState(exercise.choices);
  const [explanation, setExplanation] = React.useState(exercise.explanation);
  const field =
    'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono leading-relaxed';
  return (
    <div
      className="space-y-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"
      data-testid="draft-editor"
    >
      <p className="text-xs text-slate-600">
        Viết công thức trong $…$. Bản trích gốc không bị sửa; nội dung này là bản sẽ vào Ngân hàng
        câu hỏi.
      </p>
      <label className="block text-xs font-semibold text-slate-700">
        Đề bài
        <textarea
          value={stem}
          onChange={(e) => setStem(e.target.value)}
          rows={3}
          className={field}
          data-testid="draft-stem"
        />
      </label>
      <div className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
        <QuestionMath text={stem} />
      </div>
      {choices.map((choice, index) => (
        <label key={choice.label} className="block text-xs font-semibold text-slate-700">
          Phương án {choice.label}
          <input
            value={choice.text}
            onChange={(e) =>
              setChoices((list) =>
                list.map((item, i) => (i === index ? { ...item, text: e.target.value } : item))
              )
            }
            className={`${field} h-9 py-0`}
          />
        </label>
      ))}
      <label className="block text-xs font-semibold text-slate-700">
        Lời giải cho học sinh (hiện sau khi nộp bài)
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={5}
          className={field}
          data-testid="draft-explanation"
        />
      </label>
      {explanation && (
        <div className="rounded-lg bg-white px-3 py-2 text-xs leading-relaxed whitespace-pre-line ring-1 ring-slate-200">
          <QuestionMath text={explanation} />
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave({ stem, choices, explanation })}
          className={`${button} bg-primary text-primary-foreground`}
          data-testid="draft-save"
        >
          Lưu bản sửa
        </button>
        <button type="button" onClick={onCancel} className={`${button} text-slate-600`}>
          Hủy
        </button>
      </div>
    </div>
  );
}

function AdminSolve({
  exercise,
  onSubmit,
  onCancel,
  busy,
}: {
  exercise: Exercise;
  onSubmit: (answer: string, explanation: string) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [answer, setAnswer] = React.useState('');
  const [explanation, setExplanation] = React.useState(exercise.explanation);
  const [confirmed, setConfirmed] = React.useState(false);
  return (
    <div
      className="space-y-3 rounded-xl bg-violet-50 p-3 ring-1 ring-violet-200"
      data-testid="admin-solve"
    >
      <p className="text-xs text-violet-900">
        Ghi nhận đáp án do chính bạn giải. Câu sẽ được đánh dấu “Admin tự giải”, không phải đáp án
        của sách.
      </p>
      <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Đáp án đúng">
        {exercise.choices.map((choice) => (
          <label key={choice.label} className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name={`answer-${exercise.id}`}
              value={choice.label}
              checked={answer === choice.label}
              onChange={() => setAnswer(choice.label)}
            />
            {choice.label}
          </label>
        ))}
      </div>
      <label className="block text-xs font-semibold text-slate-700">
        Lời giải của bạn
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={5}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm"
          data-testid="admin-explanation"
        />
      </label>
      <label className="flex items-start gap-2 text-xs text-violet-900">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        Tôi đã tự giải câu này; đáp án và lời giải trên là của tôi.
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !answer || !explanation.trim() || !confirmed}
          onClick={() => onSubmit(answer, explanation)}
          className={`${button} bg-violet-700 text-white`}
          data-testid="admin-solve-submit"
        >
          Ghi nhận đáp án
        </button>
        <button type="button" onClick={onCancel} className={`${button} text-violet-800`}>
          Hủy
        </button>
      </div>
    </div>
  );
}

function ExerciseDetail({
  exercise,
  set,
  workspace,
  allSolutions,
  onAction,
  busy,
}: {
  exercise: Exercise;
  set: PracticeSetView;
  workspace: LessonPracticeWorkspace;
  allSolutions: Candidate['solution'][];
  onAction: (body: Record<string, unknown>, message: string) => Promise<boolean>;
  busy: boolean;
}) {
  const [mode, setMode] = React.useState<'none' | 'edit' | 'solve'>('none');
  const [other, setOther] = React.useState('');
  const layouts = workspace.pageLayouts[set.documentId] ?? {};
  const locked = !!exercise.question && exercise.question.editorialStatus !== 'DRAFT';
  const candidateIds = new Set(exercise.candidates.map((candidate) => candidate.solution.id));
  const others = allSolutions.filter((solution) => !candidateIds.has(solution.id));
  const lessonTitle = (id: string | undefined) =>
    workspace.lessons.find((lesson) => lesson.id === id)?.title ?? 'bài khác';

  return (
    <article className="space-y-4" data-testid="exercise-detail" data-exercise={exercise.id}>
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold text-slate-900">Câu {exercise.questionNumber ?? '?'}</h2>
        <Chip tone={STATUS[exercise.status].tone}>{STATUS[exercise.status].label}</Chip>
        <span className="text-xs text-slate-500">
          {set.heading}
          {set.problemType ? ` · ${set.problemType}` : ''} · tr. {exercise.printedPages.join(', ')}
        </span>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {exercise.draftSaved ? 'Đề (đã sửa)' : 'Đề trích từ sách'}
          </h3>
          {!locked && mode !== 'edit' && (
            <button
              type="button"
              onClick={() => setMode('edit')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
              data-testid="edit-exercise"
            >
              <Pencil className="size-3" /> Sửa ký hiệu, lời giải
            </button>
          )}
        </div>
        <div className="mt-2 text-sm leading-relaxed whitespace-pre-line text-slate-900">
          <QuestionMath text={exercise.stem} />
        </div>
        <ChoiceList choices={exercise.choices} answer={exercise.answer} />
        {exercise.citation && (
          <p className="mt-2 text-[11px] text-slate-500">{exercise.citation}</p>
        )}
        {exercise.hasDiagram && (
          <p className="mt-2 text-xs font-medium text-amber-800">
            Câu này dựa vào hình vẽ hoặc bảng: đối chiếu trên trang sách.
          </p>
        )}
        <div className="mt-3 space-y-1">
          {exercise.printedPages.map((page) => (
            <ScanPage key={page} documentId={set.documentId} page={page} layout={layouts[page]} />
          ))}
        </div>
        {mode === 'edit' && (
          <div className="mt-3">
            <DraftEditor
              exercise={exercise}
              busy={busy}
              onCancel={() => setMode('none')}
              onSave={async (draft) => {
                if (
                  await onAction(
                    { action: 'save-draft', exerciseId: exercise.id, ...draft },
                    'Đã lưu bản sửa. Chưa có gì được xuất bản.'
                  )
                )
                  setMode('none');
              }}
            />
          </div>
        )}
      </section>

      <section
        className="rounded-xl border border-slate-200 bg-white p-4"
        aria-label="Đáp án và lời giải"
      >
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Đáp án và lời giải
        </h3>
        {exercise.verification ? (
          <div className="mt-2 space-y-2" data-testid="verified">
            <p className="text-sm text-slate-800">
              Đáp án <strong className="text-emerald-700">{exercise.answer}</strong> ·{' '}
              {exercise.verification.method === 'ADMIN_SOLVED'
                ? 'Admin tự giải'
                : `theo ${exercise.confirmedSolution?.title ?? 'lời giải'} tr. ${exercise.confirmedSolution?.printedPages.join(', ')}, Admin đã xác nhận`}
            </p>
            {exercise.check.status !== 'NOT_APPLICABLE' && (
              <p
                className={`text-xs ${exercise.check.status === 'CONFLICT' ? 'font-semibold text-rose-700' : 'text-slate-600'}`}
              >
                {exercise.check.note}
              </p>
            )}
            {exercise.explanation && (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed whitespace-pre-line text-slate-700">
                <QuestionMath text={exercise.explanation} />
              </div>
            )}
            {exercise.confirmedSolution?.printedPages.map((page) => (
              <ScanPage key={page} documentId={set.documentId} page={page} layout={layouts[page]} />
            ))}
            {!locked && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  onAction(
                    { action: 'clear-verification', exerciseId: exercise.id },
                    'Đã bỏ xác nhận. Các gợi ý hiện lại.'
                  )
                }
                className={`${button} border border-slate-200 text-slate-700`}
                data-testid="clear-verification"
              >
                <RotateCcw className="size-3.5" /> Bỏ xác nhận
              </button>
            )}
          </div>
        ) : (
          <div className="mt-2 space-y-3">
            {exercise.candidates.length ? (
              <>
                <p className="text-xs text-slate-600">
                  {exercise.status === 'SUGGESTED'
                    ? 'Một lời giải khớp cả số câu, dạng bài và nội dung toán. Đối chiếu rồi xác nhận.'
                    : 'Có lời giải cùng số câu nhưng chưa đủ bằng chứng. So sánh với trang sách trước khi chọn.'}
                </p>
                <ul className="space-y-2">
                  {exercise.candidates.map((candidate) => (
                    <CandidateCard
                      key={candidate.solution.id}
                      candidate={candidate}
                      exercise={exercise}
                      documentId={set.documentId}
                      layouts={layouts}
                      busy={busy}
                      onConfirm={() =>
                        onAction(
                          {
                            action: 'confirm-solution',
                            exerciseId: exercise.id,
                            solutionId: candidate.solution.id,
                          },
                          `Đã xác nhận ${candidate.solution.title} là lời giải của câu này.`
                        )
                      }
                      onReject={() =>
                        onAction(
                          {
                            action: 'reject-solution',
                            exerciseId: exercise.id,
                            solutionId: candidate.solution.id,
                          },
                          'Đã loại lời giải này; hệ thống không gợi ý lại cho câu này.'
                        )
                      }
                    />
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-slate-600">
                {allSolutions.length
                  ? 'Chưa thấy lời giải nào khớp câu này trong các trang đã trích.'
                  : 'Chưa trích trang lời giải nào. Trích phần “Hướng dẫn giải” ở đầu trang.'}
              </p>
            )}
            {others.length > 0 && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="block min-w-0 flex-1 text-xs font-semibold text-slate-700">
                  Chọn lời giải khác
                  <select
                    value={other}
                    onChange={(e) => setOther(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                    data-testid="other-solution"
                  >
                    <option value="">— Lời giải khác trong chương —</option>
                    {others.map((solution) => (
                      <option key={solution.id} value={solution.id}>
                        {solution.title} · tr. {solution.printedPages.join(', ')}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy || !other}
                  onClick={() =>
                    onAction(
                      { action: 'confirm-solution', exerciseId: exercise.id, solutionId: other },
                      'Đã xác nhận lời giải bạn chọn.'
                    )
                  }
                  className={`${button} h-9 border border-emerald-300 text-emerald-800`}
                >
                  Dùng lời giải này
                </button>
              </div>
            )}
            {mode === 'solve' ? (
              <AdminSolve
                exercise={exercise}
                busy={busy}
                onCancel={() => setMode('none')}
                onSubmit={async (answer, explanation) => {
                  if (
                    await onAction(
                      { action: 'admin-verify', exerciseId: exercise.id, answer, explanation },
                      'Đã ghi nhận đáp án do Admin tự giải.'
                    )
                  )
                    setMode('none');
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setMode('solve')}
                className={`${button} border border-violet-300 text-violet-800 hover:bg-violet-50`}
                data-testid="open-admin-solve"
              >
                Tự giải và ghi nhận đáp án
              </button>
            )}
          </div>
        )}
      </section>

      <section
        className="rounded-xl border border-slate-200 bg-white p-4"
        aria-label="Bài học và Ngân hàng câu hỏi"
      >
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Luyện tập</h3>
        <label className="mt-2 block text-xs font-semibold text-slate-700">
          Bài học
          <select
            value={exercise.lesson?.lessonId ?? ''}
            disabled={busy || locked}
            onChange={(e) =>
              e.target.value &&
              onAction(
                { action: 'assign-lesson', exerciseIds: [exercise.id], lessonId: e.target.value },
                `Đã gán cho “${lessonTitle(e.target.value)}”.`
              )
            }
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
            data-testid="exercise-lesson"
          >
            <option value="">— Chọn bài —</option>
            {workspace.lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.title}
              </option>
            ))}
          </select>
        </label>
        {exercise.lesson && (
          <p className="mt-1 text-[11px] text-slate-500">
            {exercise.lesson.source === 'ADMIN'
              ? 'Admin đã chọn.'
              : `Gợi ý: ${exercise.lesson.reason}.`}
          </p>
        )}
        {exercise.question ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" data-testid="imported">
            <span className="font-semibold text-slate-800">{exercise.question.code}</span>
            <Chip tone={QUESTION_STATE[exercise.question.practiceState].tone}>
              {QUESTION_STATE[exercise.question.practiceState].label}
            </Chip>
            {exercise.question.lessonId && (
              <Link
                href={`/admin/practice/${exercise.question.lessonId}`}
                className="font-semibold text-primary"
              >
                Duyệt trong “Câu luyện tập của bài”
              </Link>
            )}
          </div>
        ) : exercise.blockers.length ? (
          <ul className="mt-3 space-y-1 text-xs text-slate-700" data-testid="blockers">
            {exercise.blockers.map((blocker) => (
              <li key={blocker} className="flex gap-1.5">
                <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-600" /> {blocker}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="size-3.5" /> Sẵn sàng nhập vào Ngân hàng câu hỏi.
          </p>
        )}
      </section>
    </article>
  );
}

function SolutionSources({
  set,
  lessonId,
  onQueued,
}: {
  set: PracticeSetView;
  lessonId: string;
  onQueued: (message: string) => void;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  if (!set.solutionSources.length)
    return (
      <p className="text-xs text-slate-500">
        Mục lục không có phần “Hướng dẫn giải” cho chương này. Có thể tự giải từng câu.
      </p>
    );
  return (
    <div className="space-y-2">
      {set.solutionSources.map((source) => (
        <div key={source.entryId} className="text-xs">
          <p className="text-slate-700">
            <FileSearch className="mr-1 inline size-3.5 text-slate-400" />
            Lời giải: <strong>{source.heading}</strong> ({source.pages}).{' '}
            <span className="text-slate-500">{source.reason}.</span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {source.chunks.map((chunk) => {
              const label =
                chunk.pages.length > 1
                  ? `tr. ${chunk.pages[0]}–${chunk.pages.at(-1)}`
                  : `tr. ${chunk.pages[0]}`;
              const running = chunk.job?.status === 'QUEUED' || chunk.job?.status === 'RUNNING';
              const key = chunk.pages.join();
              return chunk.extracted ? (
                <Chip key={key} tone="bg-emerald-50 text-emerald-700 ring-emerald-200">
                  Đã trích {label}
                </Chip>
              ) : (
                <button
                  key={key}
                  type="button"
                  disabled={!!busy || running}
                  onClick={async () => {
                    setBusy(key);
                    setError(null);
                    const result = await textbookApi.extract({
                      documentId: set.documentId,
                      entryIds: [source.entryId],
                      knowledgeNodeId: lessonId,
                      printedPages: chunk.pages,
                    });
                    setBusy(null);
                    if (!result.ok) return setError(result.error);
                    onQueued(
                      result.data.cacheHit
                        ? `Các trang ${label} đã trích trước đây; dùng lại kết quả.`
                        : `Đang trích lời giải ${label}. Kết quả hiện ở đây khi xong.`
                    );
                  }}
                  className={`${button} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}
                  data-testid="extract-solutions"
                >
                  {busy === key || running ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  {running
                    ? `Đang trích ${label}`
                    : chunk.job?.status === 'FAILED'
                      ? `Thử lại ${label}`
                      : `Trích lời giải ${label}`}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {error && (
        <p className="text-xs font-medium text-rose-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextbookExercisesWorkspace({ lessonId }: { lessonId: string }) {
  const [workspace, setWorkspace] = React.useState<LessonPracticeWorkspace | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  const [filter, setFilter] = React.useState<Filter>('ALL');
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [rights, setRights] = React.useState('');
  const [outcomes, setOutcomes] = React.useState<TextbookImportOutcome[] | null>(null);
  const detailRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    const response = await fetch(
      `/api/admin/textbooks/practice?lessonId=${encodeURIComponent(lessonId)}`
    ).catch(() => null);
    const data = response ? await response.json().catch(() => null) : null;
    if (!response?.ok || !data)
      return setLoadError(data?.error ?? 'Không tải được bài tập từ sách.');
    setLoadError(null);
    setWorkspace(data as LessonPracticeWorkspace);
  }, [lessonId]);

  React.useEffect(() => {
    // Loading the workspace from the server is an external sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const extracting = workspace?.sets.some((set) =>
    set.solutionSources.some((s) =>
      s.chunks.some((c) => c.job?.status === 'QUEUED' || c.job?.status === 'RUNNING')
    )
  );
  React.useEffect(() => {
    if (!extracting) return;
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [extracting, load]);

  const act = async (body: Record<string, unknown>, message: string) => {
    setBusy(true);
    const result = await practiceApi(body);
    setBusy(false);
    setNotice(result.ok ? { text: message, tone: 'ok' } : { text: result.error, tone: 'error' });
    if (result.ok) await load();
    return result.ok;
  };

  if (loadError && !workspace)
    return (
      <div className="mx-auto max-w-5xl p-6">
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {loadError}
        </p>
      </div>
    );
  if (!workspace)
    return (
      <div className="mx-auto max-w-6xl space-y-3 p-6" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-200/70" />
        ))}
      </div>
    );

  const exercises = workspace.sets.flatMap((set) =>
    set.exercises.map((exercise) => ({ set, exercise }))
  );
  const current = exercises.find((item) => item.exercise.id === selected) ?? null;
  const ready = exercises.filter(({ exercise }) => checked.has(exercise.id));
  const solutionsBySet = (set: PracticeSetView) => workspace.solutions[set.documentId] ?? [];
  const counts = workspace.counts;
  const tiles = [
    { label: 'Câu trích từ sách', value: counts.extracted },
    { label: 'Đã xác nhận đáp án', value: counts.solutionsConfirmed },
    { label: 'Cần Admin xem', value: counts.needsReview },
    { label: 'Đã vào Ngân hàng', value: counts.imported },
    { label: 'Gán cho bài này', value: counts.assignedHere },
    { label: 'Học sinh đang nhận', value: counts.availableToStudents },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-4 pb-28 sm:p-6 sm:pb-28">
      <div>
        <Link
          href={`/admin/practice/${lessonId}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="size-3.5" /> Câu luyện tập của bài
        </Link>
        <p className="mt-3 text-xs text-slate-500">{workspace.lesson.path.join(' › ')}</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
          Bài tập từ sách · {workspace.lesson.title}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Ghép mỗi câu với lời giải in trong sách, kiểm tra rồi nhập vào Ngân hàng câu hỏi. Học sinh
          chỉ nhận câu sau khi câu được duyệt và xuất bản ở “Câu luyện tập của bài”. Tư liệu lý
          thuyết cho AI soạn bài nằm riêng ở Cây kiến thức.
        </p>
      </div>

      <section
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
        aria-label="Tiến độ"
        data-testid="practice-counts"
      >
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-[11px] text-slate-500">{tile.label}</p>
            <p className="text-lg font-bold tabular-nums text-slate-900">{tile.value}</p>
          </div>
        ))}
      </section>

      {notice && (
        <p
          role="status"
          className={`rounded-xl px-3 py-2 text-sm ring-1 ${notice.tone === 'ok' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-rose-50 text-rose-800 ring-rose-200'}`}
          data-testid="practice-notice"
        >
          {notice.text}
        </p>
      )}

      {workspace.sets.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <BookOpen className="mx-auto size-6 text-slate-400" />
          <p className="mt-2 text-sm font-semibold text-slate-800">
            Bài này chưa liên kết với chương nào của sách.
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Liên kết bài với mục lý thuyết hoặc “Dạng” tương ứng ở Cây kiến thức; phần bài tập và
            lời giải của chương sẽ hiện ở đây.
          </p>
          <Link
            href="/admin/knowledge"
            className="mt-3 inline-flex text-xs font-semibold text-primary"
          >
            Mở Cây kiến thức
          </Link>
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <div className={`space-y-4 ${current ? 'hidden lg:block' : ''}`}>
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Lọc câu hỏi">
              {(Object.keys(FILTERS) as Filter[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  onClick={() => setFilter(key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${filter === key ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200'}`}
                >
                  {FILTERS[key]} (
                  {exercises.filter(({ exercise }) => matchesFilter(exercise, key)).length})
                </button>
              ))}
            </div>
            {workspace.sets.map((set) => {
              const items = set.exercises.filter((exercise) => matchesFilter(exercise, filter));
              const suggested = set.lesson
                ? workspace.lessons.find((lesson) => lesson.id === set.lesson!.lessonId)?.title
                : null;
              return (
                <section
                  key={`${set.documentId}-${set.entryId}`}
                  className="rounded-xl border border-slate-200 bg-white"
                  data-testid="practice-set"
                  data-entry={set.entryId}
                >
                  <header className="space-y-2 border-b border-slate-100 px-4 py-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        {set.heading}
                        {set.problemType && (
                          <span className="font-normal text-slate-500"> · {set.problemType}</span>
                        )}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {set.documentTitle} · {set.pages} · {set.exercises.length} câu
                      </p>
                      <p className="mt-1 text-xs text-slate-700" data-testid="set-lesson">
                        {suggested ? (
                          <>
                            Gợi ý bài: <strong>{suggested}</strong>{' '}
                            <span className="text-slate-500">({set.lesson!.reason})</span>
                          </>
                        ) : set.ambiguousLessonIds.length ? (
                          'Nhiều bài cùng liên kết với dạng này: chọn bài cho từng câu.'
                        ) : (
                          'Chưa xác định bài: chọn bài cho các câu.'
                        )}
                      </p>
                    </div>
                    <SolutionSources
                      set={set}
                      lessonId={lessonId}
                      onQueued={(text) => {
                        setNotice({ text, tone: 'ok' });
                        void load();
                      }}
                    />
                  </header>
                  {set.exercises.length === 0 ? (
                    <p className="px-4 py-4 text-xs text-slate-500">
                      Chưa trích câu nào của mục này. Trích trang {set.pages} ở mục sách trong Cây
                      kiến thức.
                    </p>
                  ) : items.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-slate-500">
                      Không có câu nào ở bộ lọc này.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {items.map((exercise) => {
                        const canImport = !exercise.question && exercise.blockers.length === 0;
                        return (
                          <li
                            key={exercise.id}
                            className={`flex items-center gap-2 px-3 py-2 ${selected === exercise.id ? 'bg-primary/5' : ''}`}
                            data-testid="exercise-row"
                            data-number={exercise.questionNumber ?? ''}
                          >
                            <input
                              type="checkbox"
                              aria-label={`Chọn Câu ${exercise.questionNumber}`}
                              disabled={!canImport}
                              checked={checked.has(exercise.id)}
                              onChange={(e) =>
                                setChecked((set) => {
                                  const next = new Set(set);
                                  if (e.target.checked) next.add(exercise.id);
                                  else next.delete(exercise.id);
                                  return next;
                                })
                              }
                              className="size-4 shrink-0"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setSelected(exercise.id);
                                requestAnimationFrame(() =>
                                  detailRef.current?.scrollIntoView({
                                    block: 'start',
                                    behavior: 'smooth',
                                  })
                                );
                              }}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                              <span className="w-12 shrink-0 text-xs font-semibold text-slate-900">
                                Câu {exercise.questionNumber ?? '?'}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                                {exercise.stem.replace(/\$/g, '')}
                              </span>
                              {exercise.question ? (
                                <Chip tone={QUESTION_STATE[exercise.question.practiceState].tone}>
                                  {QUESTION_STATE[exercise.question.practiceState].label}
                                </Chip>
                              ) : (
                                <Chip
                                  tone={
                                    canImport
                                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                      : STATUS[exercise.status].tone
                                  }
                                >
                                  {canImport ? 'Sẵn sàng' : STATUS[exercise.status].label}
                                </Chip>
                              )}
                              <ChevronRight className="size-3.5 shrink-0 text-slate-400" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>

          <div ref={detailRef} className={`scroll-mt-4 ${current ? '' : 'hidden lg:block'}`}>
            {current ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 lg:hidden"
                >
                  <ArrowLeft className="size-3.5" /> Danh sách câu
                </button>
                <ExerciseDetail
                  key={
                    current.exercise.id +
                    JSON.stringify(current.exercise.verification ?? null) +
                    current.exercise.draftSaved
                  }
                  exercise={current.exercise}
                  set={current.set}
                  workspace={workspace}
                  allSolutions={solutionsBySet(current.set)}
                  onAction={act}
                  busy={busy}
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                Chọn một câu để xem đề, trang sách và lời giải gợi ý.
              </div>
            )}
          </div>
        </div>
      )}

      {(ready.length > 0 || importing || outcomes) && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur"
          data-testid="import-bar"
        >
          <div className="mx-auto max-w-7xl">
            {outcomes ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <ul className="space-y-0.5 text-xs text-slate-700" data-testid="import-outcomes">
                  {outcomes.map((outcome) => (
                    <li key={outcome.exerciseId}>
                      <strong>Câu {outcome.questionNumber ?? '?'}</strong>:{' '}
                      {outcome.result === 'CREATED'
                        ? `đã tạo bản nháp ${outcome.questionCode}`
                        : outcome.result === 'UPDATED'
                          ? `đã cập nhật bản nháp ${outcome.questionCode}`
                          : outcome.result === 'UNCHANGED'
                            ? outcome.reason
                            : `bỏ qua: ${outcome.reason}`}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/practice/${lessonId}`}
                    className={`${button} bg-primary text-primary-foreground`}
                  >
                    Duyệt và xuất bản
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOutcomes(null)}
                    className={`${button} text-slate-600`}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : importing ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="block min-w-0 flex-1 text-xs font-semibold text-slate-700">
                  Quyền sử dụng câu hỏi của sách
                  <select
                    value={rights}
                    onChange={(e) => setRights(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                    data-testid="import-rights"
                  >
                    <option value="">— Chọn —</option>
                    {RIGHTS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy || !rights}
                    onClick={async () => {
                      setBusy(true);
                      const result = await practiceApi({
                        action: 'import',
                        lessonId,
                        exerciseIds: ready.map(({ exercise }) => exercise.id),
                        rightsStatus: rights,
                      });
                      setBusy(false);
                      if (!result.ok) return setNotice({ text: result.error, tone: 'error' });
                      setOutcomes(result.data.outcomes as TextbookImportOutcome[]);
                      setImporting(false);
                      setChecked(new Set());
                      await load();
                    }}
                    className={`${button} h-9 bg-emerald-600 text-white hover:bg-emerald-700`}
                    data-testid="import-confirm"
                  >
                    {busy && <Loader2 className="size-3.5 animate-spin" />} Nhập {ready.length} câu
                    dạng nháp
                  </button>
                  <button
                    type="button"
                    onClick={() => setImporting(false)}
                    className={`${button} h-9 text-slate-600`}
                  >
                    Hủy
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-700">
                  Đã chọn <strong>{ready.length}</strong> câu. Câu vào Ngân hàng dạng nháp; xuất bản
                  là bước duyệt riêng.
                </p>
                <button
                  type="button"
                  onClick={() => setImporting(true)}
                  className={`${button} h-9 bg-primary text-primary-foreground`}
                  data-testid="import-open"
                >
                  Nhập vào Ngân hàng câu hỏi
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
