import type { Metadata } from 'next';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { StudentLessonJourney } from '@/features/lessons/components/student-lesson-journey';
import { LessonNextStep } from '@/features/lessons/components/lesson-practice-card';
import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { getAssistAvailability } from '@/lib/learning/lesson-assist-service';
import { findLessonInCatalog } from '@/lib/knowledge-tree/learning-visibility';
import { buildLessonJourney } from '@/lib/knowledge-tree/lesson-journey';
import {
  getLessonChecks,
  getLessonPracticeOverview,
  getStudentLessonSummaries,
} from '@/lib/practice/practice-service';
import { programFor, programHref, ROADMAP_HREF } from '@/features/lessons/lib/study-plan';
import {
  getKnowledgeArticle,
  getLearningCatalog,
} from '@/lib/knowledge-tree/knowledge-tree-service';

export const dynamic = 'force-dynamic';

// `?from=roadmap` in older links is accepted and no longer needed: every
// lesson leads back to its program on the Roadmap.
type Props = { params: Promise<{ lessonId: string }> };

async function loadLesson(lessonId: string) {
  const catalog = await getLearningCatalog();
  const found = findLessonInCatalog(catalog, lessonId);
  if (!found) return null;
  const article = await getKnowledgeArticle(lessonId);
  return article ? { ...found, article, catalog } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lessonId } = await params;
  const data = await loadLesson(decodeURIComponent(lessonId));
  return { title: data ? `${data.article.title} | Tú Tài` : 'Bài học | Tú Tài' };
}

export default async function StudentLessonPage({ params }: Props) {
  const { lessonId: rawId } = await params;
  const lessonId = decodeURIComponent(rawId);
  const data = await loadLesson(lessonId);

  // Unpublished, archived and deleted lessons all land here: never leak draft content.
  if (!data) {
    return (
      <div className="mx-auto max-w-[520px] py-16 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">
          <Lock className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-[#091224]">
          Bài học này chưa mở
        </h1>
        <p className="mt-2 text-[15px] leading-7 text-slate-500">
          Bài có thể đang được thầy cô cập nhật. Em xem các bài khác trên lộ trình nhé.
        </p>
        <Link
          href={ROADMAP_HREF}
          className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#0052FF] px-5 text-[15px] font-bold text-white hover:bg-[#0044CC]"
        >
          Về lộ trình
        </Link>
      </div>
    );
  }

  const { subject, lesson, article, catalog } = data;
  const student = await getDemoStudentSession();
  // The program on the Roadmap this lesson belongs to: where it leads back to,
  // and where the next step after it is chosen from.
  const program = programFor(catalog, lesson.id);
  const scope = program?.lessons ?? [];
  const [practice, checks, summaries] = await Promise.all([
    student
      ? getLessonPracticeOverview(student.id, lesson.id).catch((error) => {
          console.error('[lesson-practice]', error);
          return null;
        })
      : null,
    getLessonChecks(lesson.id).catch((error) => {
      console.error('[lesson-checks]', error);
      return [];
    }),
    student
      ? getStudentLessonSummaries(
          student.id,
          scope.map((item) => item.id)
        ).catch(() => ({}))
      : {},
  ]);
  const journey = buildLessonJourney(article.blocks, { checks: checks.length });
  const next = scope[scope.findIndex((item) => item.id === lesson.id) + 1];
  const chapterIndex = program ? program.chapters.findIndex((c) => c.id === lesson.chapterId) : -1;
  const position = scope.findIndex((item) => item.id === lesson.id) + 1;

  return (
    <StudentLessonJourney
      lessonId={lesson.id}
      title={article.title}
      subjectTitle={subject.title}
      chapterTitle={lesson.chapterTitle}
      backHref={programHref(program)}
      backLabel={program ? `Hành trình ${program.title}` : 'Lộ trình'}
      trail={
        program && chapterIndex >= 0
          ? `Chương ${chapterIndex + 1} · Bài ${position}/${scope.length}`
          : undefined
      }
      journey={journey}
      checks={checks}
      practice={practice}
      practiceHref={`/student/lessons/${encodeURIComponent(lesson.id)}/practice`}
      next={next ? { id: next.id, title: next.title } : null}
      practiceCard={
        <LessonNextStep
          lessonId={lesson.id}
          overview={practice}
          program={program}
          summaries={summaries}
        />
      }
      assist={{
        lessonId: lesson.id,
        contentVersion: article.updatedAt,
        available: getAssistAvailability().available,
      }}
    />
  );
}
