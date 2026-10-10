import {
  LESSON_PUBLICATION_LABELS,
  type LessonPublicationState,
} from '@/lib/knowledge-tree/learning-visibility';

const STYLES: Record<LessonPublicationState, { pill: string; dot: string; text: string }> = {
  PUBLISHED: {
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
  },
  READY: {
    pill: 'bg-blue-50 text-blue-700 ring-blue-200',
    dot: 'bg-blue-500',
    text: 'text-blue-700',
  },
  DRAFT: {
    pill: 'bg-amber-50 text-amber-800 ring-amber-200',
    dot: 'bg-amber-500',
    text: 'text-amber-800',
  },
  NO_ARTICLE: {
    pill: 'bg-white text-slate-500 ring-slate-200',
    dot: 'border border-slate-300 bg-white',
    text: 'text-slate-400',
  },
  ARCHIVED: {
    pill: 'bg-slate-100 text-slate-500 ring-slate-200',
    dot: 'bg-slate-400',
    text: 'text-slate-500',
  },
};

/**
 * Lesson state label. `pill` is for headers where the state is the subject;
 * `dot` is the quiet form used in dense lists.
 */
export function PublicationBadge({
  state,
  variant = 'pill',
}: {
  state: LessonPublicationState;
  variant?: 'pill' | 'dot';
}) {
  const style = STYLES[state];
  if (variant === 'dot') {
    return (
      <span
        data-state={state}
        className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${style.text}`}
      >
        <span aria-hidden="true" className={`size-2 rounded-full ${style.dot}`} />
        {LESSON_PUBLICATION_LABELS[state]}
      </span>
    );
  }
  return (
    <span
      data-state={state}
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset ${style.pill}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${style.dot}`} />
      {LESSON_PUBLICATION_LABELS[state]}
    </span>
  );
}
