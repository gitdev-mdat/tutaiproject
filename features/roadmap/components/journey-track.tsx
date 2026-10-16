import { MapPin } from 'lucide-react';
import type { LessonStanding, StudyScope } from '@/features/lessons/lib/study-plan';

/**
 * The program as stages: one segment per chapter, sized by its lessons and
 * filled by the lessons completed. The Roadmap's hero shows it in full; the
 * end of a lesson and of a practice session show it compact, so the student
 * sees the same journey move where they just learned.
 */
export function JourneyTrack({
  program,
  standings,
  currentLessonId,
  compact = false,
}: {
  program: Pick<StudyScope, 'chapters'>;
  standings: Map<string, LessonStanding>;
  /** The chapter that holds this lesson gets the pin. */
  currentLessonId: string | null;
  compact?: boolean;
}) {
  const many = program.chapters.length;
  return (
    <ol
      className="flex gap-1.5"
      aria-label="Các chương trong hành trình"
      data-testid="journey-track"
    >
      {program.chapters.map((chapter, index) => {
        const done = chapter.lessons.filter((l) => standings.get(l.id)?.completed).length;
        const here = chapter.lessons.some((l) => l.id === currentLessonId);
        return (
          <li
            key={chapter.id}
            className="min-w-[24px]"
            style={{ flexGrow: chapter.lessons.length, flexBasis: 0 }}
            aria-label={`Chương ${index + 1}: ${chapter.title}, ${done}/${chapter.lessons.length} bài xong${here ? ', em đang ở chương này' : ''}`}
          >
            <span className="flex h-2 overflow-hidden rounded-full bg-white/15">
              <span
                className="h-full rounded-full bg-[#34D399] motion-safe:transition-[width] motion-safe:duration-700"
                style={{ width: `${(done / chapter.lessons.length) * 100}%` }}
              />
            </span>
            {!compact && (
              <span
                className={`mt-2 flex items-center gap-1 truncate text-[12px] font-semibold ${
                  here ? 'text-white' : 'text-blue-200/80'
                }`}
                aria-hidden="true"
              >
                {here && <MapPin className="size-3.5 shrink-0 text-[#FFC857]" />}
                <span className="truncate">
                  {many > 4 ? `C${index + 1}` : `Chương ${index + 1}`}
                  {many <= 2 && (
                    <span className="font-normal text-blue-200/80"> · {chapter.title}</span>
                  )}
                </span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
