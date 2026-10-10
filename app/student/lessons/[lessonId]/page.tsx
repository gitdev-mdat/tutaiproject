import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import { LessonArticleView } from '@/components/learning/lesson-article-view';
import {
  ChapterLessonList,
  LessonViewRecorder,
} from '@/features/lessons/components/lesson-reader-client';
import { findLessonInCatalog } from '@/lib/knowledge-tree/learning-visibility';
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
  const chapterLessons = lessons.filter((item) => item.chapterId === lesson.chapterId);
  const positionInChapter = chapterLessons.findIndex((item) => item.id === lesson.id) + 1;
  const previous = lessons[index - 1];
  const next = lessons[index + 1];

  return (
    <div className="mx-auto w-full max-w-[1120px] pb-12">
      <LessonViewRecorder lessonId={lesson.id} />
      <Link
        href={`/student/lessons?subject=${encodeURIComponent(subject.id)}`}
        className="inline-flex items-center gap-1.5 rounded-lg py-1 text-[13px] font-semibold text-slate-500 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {subject.title}
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article className="min-w-0">
          <header className="mb-7">
            <p className="text-[13px] font-semibold text-blue-600">
              {lesson.chapterTitle} · Bài {positionInChapter}/{chapterLessons.length}
            </p>
            <h1 className="mt-1.5 text-[28px] font-extrabold leading-tight tracking-tight text-[#091224] sm:text-[34px]">
              {article.title}
            </h1>
          </header>
          <div className="rounded-[20px] border border-[#E5EBF3] bg-white p-5 sm:p-8">
            <LessonArticleView blocks={article.blocks} />
          </div>

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

        <aside className="lg:sticky lg:top-6 lg:self-start">
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
