import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  Clock3,
  ListChecks,
  Lock,
  Play,
} from 'lucide-react';
import { LessonArticleView } from '@/components/learning/lesson-article-view';
import {
  ChapterLessonList,
  ChapterProgress,
  LessonFlowNav,
  LessonViewRecorder,
} from '@/features/lessons/components/lesson-reader-client';
import { LessonPracticeCard } from '@/features/lessons/components/lesson-practice-card';
import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { findLessonInCatalog } from '@/lib/knowledge-tree/learning-visibility';
import { getLessonPracticeOverview } from '@/lib/practice/practice-service';
import {
  estimateReadingMinutes,
  learningPromise,
  lessonFlow,
} from '@/lib/knowledge-tree/lesson-structure';
import { QuestionMath } from '@/components/shared/question-content-renderer';
import {
  getKnowledgeArticle,
  getLearningCatalog,
} from '@/lib/knowledge-tree/knowledge-tree-service';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ lessonId: string }> };

async function loadLesson(lessonId: string) {
  const catalog = await getLearningCatalog();
  const found = findLessonInCatalog(catalog, lessonId);
  if (!found) return null;
  const article = await getKnowledgeArticle(lessonId);
  return article ? { ...found, article } : null;
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
          Bài có thể đang được thầy cô cập nhật. Em xem các bài khác trong chương trình nhé.
        </p>
        <Link
          href="/student/lessons"
          className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#0052FF] px-5 text-[15px] font-bold text-white hover:bg-[#0044CC]"
        >
          Về danh sách bài học
        </Link>
      </div>
    );
  }

  const { subject, lesson, index, lessons, article } = data;
  const student = await getDemoStudentSession();
  const practice = student
    ? await getLessonPracticeOverview(student.id, lesson.id).catch((error) => {
        console.error('[lesson-practice]', error);
        return null;
      })
    : null;
  const chapterLessons = lessons.filter((item) => item.chapterId === lesson.chapterId);
  const previous = lessons[index - 1];
  const next = lessons[index + 1];
  const hasPractice = !!practice && (practice.questionCount > 0 || !!practice.lastCompleted);
  const flow = lessonFlow(article.blocks, { practice: hasPractice });
  const minutes = estimateReadingMinutes(article.blocks);
  const promise = learningPromise(article.blocks);
  const practiceHref = `/student/lessons/${encodeURIComponent(lesson.id)}/practice`;
  const inProgress = practice?.inProgress ?? null;
  const best = practice?.best ?? null;

  return (
    <div className="mx-auto w-full max-w-[1120px] pb-12">
      <LessonViewRecorder lessonId={lesson.id} />
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8">
        <article className="min-w-0">
          <header className="mb-5 overflow-hidden rounded-[24px] border border-[#DCE6F5] bg-gradient-to-br from-[#EEF4FF] via-white to-white p-5 sm:p-7">
            <nav
              aria-label="Vị trí bài học"
              className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-slate-500"
            >
              <Link
                href={`/student/lessons?subject=${encodeURIComponent(subject.id)}`}
                className="inline-flex items-center gap-1 rounded hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                {subject.title}
              </Link>
              <span aria-hidden="true" className="text-slate-300">
                /
              </span>
              <span className="text-blue-700">{lesson.chapterTitle}</span>
            </nav>
            <div className="mt-4">
              <ChapterProgress lessons={chapterLessons} currentId={lesson.id} />
            </div>
            <h1 className="mt-3 text-[28px] font-extrabold leading-tight tracking-tight text-[#091224] sm:text-[36px]">
              {article.title}
            </h1>
            {promise && (
              <p className="mt-3 max-w-[640px] text-[16px] leading-7 text-slate-700 sm:text-[17px]">
                <span className="font-semibold text-[#091224]">Sau bài này, em sẽ </span>
                <QuestionMath text={promise.charAt(0).toLocaleLowerCase('vi') + promise.slice(1)} />
                .
              </p>
            )}
            <ul className="mt-4 flex flex-wrap gap-2 text-[13px] font-semibold text-slate-600">
              <li className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">
                <Clock3 className="size-3.5 text-slate-400" aria-hidden="true" />
                Khoảng {minutes} phút
              </li>
              <li className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">
                <ListChecks className="size-3.5 text-slate-400" aria-hidden="true" />
                {flow.length} bước
              </li>
              {practice && practice.questionCount > 0 && (
                <li className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">
                  <ClipboardCheck className="size-3.5 text-slate-400" aria-hidden="true" />
                  {best
                    ? `Luyện tập: ${best.correctCount}/${best.totalCount} câu đúng`
                    : `${practice.questionCount} câu luyện tập`}
                </li>
              )}
            </ul>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              {inProgress ? (
                <Link
                  href={`${practiceHref}?attempt=${inProgress.id}`}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-[15px] font-bold text-white hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  <Clock3 className="size-4" aria-hidden="true" />
                  Làm tiếp luyện tập ({inProgress.answeredCount}/{inProgress.totalCount})
                </Link>
              ) : (
                <a
                  href={`#${flow[0]?.id ?? 'luyen-tap'}`}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-[15px] font-bold text-white hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  <Play className="size-4 fill-current" aria-hidden="true" />
                  {best ? 'Ôn lại bài học' : 'Bắt đầu học'}
                </a>
              )}
              {hasPractice && !inProgress && (
                <a
                  href="#luyen-tap"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#D5DEEA] bg-white px-5 text-[15px] font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {best ? 'Luyện tập lại' : 'Đến phần luyện tập'}
                </a>
              )}
            </div>
          </header>

          <div className="mb-5">
            <LessonFlowNav steps={flow} variant="chips" />
          </div>

          <LessonArticleView
            blocks={article.blocks}
            practiceHref={hasPractice ? '#luyen-tap' : null}
          />

          <LessonPracticeCard lessonId={lesson.id} overview={practice} />

          <nav aria-label="Chuyển bài" className="mt-6 grid gap-3 sm:grid-cols-2">
            {previous ? (
              <Link
                href={`/student/lessons/${encodeURIComponent(previous.id)}`}
                className="group rounded-2xl border border-[#E5EBF3] bg-white p-4 transition hover:border-blue-200 hover:bg-[#F4F8FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                  <ArrowLeft className="size-3.5" aria-hidden="true" /> Bài trước
                </span>
                <span className="mt-1 block text-[15px] font-semibold leading-snug text-slate-800">
                  {previous.title}
                </span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {next ? (
              <Link
                href={`/student/lessons/${encodeURIComponent(next.id)}`}
                className="group rounded-2xl border border-blue-200 bg-[#F4F8FF] p-4 text-right transition hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span className="flex items-center justify-end gap-1.5 text-xs font-semibold text-blue-600">
                  Bài tiếp theo <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
                <span className="mt-1 block text-[15px] font-semibold leading-snug text-[#091224]">
                  {next.title}
                </span>
              </Link>
            ) : (
              <Link
                href={`/student/lessons?subject=${encodeURIComponent(subject.id)}`}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-right transition hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span className="text-xs font-semibold text-emerald-700">Đây là bài cuối</span>
                <span className="mt-1 block text-[15px] font-semibold text-emerald-900">
                  Về danh sách bài học
                </span>
              </Link>
            )}
          </nav>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-48px)] lg:self-start lg:overflow-y-auto">
          <div className="hidden lg:block">
            <LessonFlowNav steps={flow} variant="rail" />
          </div>
          <ChapterLessonList
            chapterTitle={lesson.chapterTitle}
            lessons={chapterLessons}
            currentId={lesson.id}
          />
        </aside>
      </div>
    </div>
  );
}
