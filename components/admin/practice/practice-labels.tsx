import type { LessonReadiness } from '@/lib/practice/practice-admin';
import type { PracticeQuestionState } from '@/lib/practice/practice-rules';

export const READINESS: Record<LessonReadiness, { label: string; tone: string; hint: string }> = {
  READY: {
    label: 'Học sinh đang luyện được',
    tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    hint: 'Đủ câu luyện tập.',
  },
  FEW_QUESTIONS: {
    label: 'Ít câu',
    tone: 'bg-amber-50 text-amber-700 ring-amber-200',
    hint: 'Học sinh luyện được nhưng nên có từ 3 câu.',
  },
  NO_QUESTIONS: {
    label: 'Chưa có câu luyện tập',
    tone: 'bg-rose-50 text-rose-700 ring-rose-200',
    hint: 'Bài đang mở nhưng học sinh chưa có gì để luyện.',
  },
  LESSON_HIDDEN: {
    label: 'Bài học chưa mở',
    tone: 'bg-slate-100 text-slate-600 ring-slate-200',
    hint: 'Học sinh chưa thấy bài này, kể cả khi đã có câu hỏi.',
  },
};

export const QUESTION_STATE: Record<PracticeQuestionState, { label: string; tone: string }> = {
  IN_PRACTICE: {
    label: 'Học sinh đang nhận',
    tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  DRAFT: { label: 'Bản nháp', tone: 'bg-slate-100 text-slate-600 ring-slate-200' },
  IN_REVIEW: { label: 'Chờ duyệt', tone: 'bg-amber-50 text-amber-700 ring-amber-200' },
  ARCHIVED: { label: 'Đã gỡ', tone: 'bg-slate-100 text-slate-500 ring-slate-200' },
  PUBLISHED_ELSEWHERE: {
    label: 'Đã xuất bản, chưa vào luyện tập',
    tone: 'bg-sky-50 text-sky-700 ring-sky-200',
  },
  NOT_USABLE: { label: 'Không dùng được', tone: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

export const QUESTION_TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE_SINGLE: 'Trắc nghiệm 1 đáp án',
  MULTIPLE_CHOICE_MULTIPLE: 'Trắc nghiệm nhiều đáp án',
  TRUE_FALSE: 'Đúng / Sai',
  NUMERIC: 'Trả lời số',
  SHORT_ANSWER: 'Tự luận ngắn',
};

export const DIFFICULTY_LABEL: Record<string, string> = {
  FOUNDATIONAL: 'Cơ bản',
  INTERMEDIATE: 'Trung bình',
  ADVANCED: 'Khó',
  HIGH_DISCRIMINATION: 'Phân loại cao',
};

export function Chip({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset ${tone}`}
    >
      {children}
    </span>
  );
}
