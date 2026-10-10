import {
  LESSON_PUBLICATION_LABELS,
  type LessonPublicationState,
} from '@/lib/knowledge-tree/learning-visibility';

const STYLES: Record<LessonPublicationState, { pill: string; dot: string }> = {
  PUBLISHED: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  READY: { pill: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' },
  DRAFT: { pill: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  NO_ARTICLE: { pill: 'bg-white text-slate-500 ring-slate-200', dot: 'bg-slate-300' },
  ARCHIVED: { pill: 'bg-slate-100 text-slate-500 ring-slate-200', dot: 'bg-slate-400' },
};

export function PublicationBadge({ state }: { state: LessonPublicationState }) {
  const style = STYLES[state];
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
