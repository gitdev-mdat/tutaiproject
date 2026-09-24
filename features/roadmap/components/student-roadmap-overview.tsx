'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  FileCheck2,
  Lightbulb,
  LockKeyhole,
  Network,
  Trophy,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { RoadmapStageItem, StudentRoadmap, StudentRoadmapDashboard } from '../lib/types';
import { buildRoadmapPresentation } from '../lib/roadmap-presentation';
import styles from './student-roadmap-overview.module.css';

function AcademicHeroArt() {
  return (
    <svg className={styles.heroArt} viewBox="0 0 720 190" fill="none" aria-hidden="true">
      <defs>
        <pattern id="roadmap-grid" width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M22 0H0V22" stroke="currentColor" strokeWidth=".5" />
        </pattern>
      </defs>
      <rect x="70" width="460" height="190" fill="url(#roadmap-grid)" opacity=".18" />
      <g stroke="currentColor" strokeWidth="1.25">
        <path d="M94 155H352M130 178V18" opacity=".42" />
        <path d="M132 145C167 144 172 60 207 60c37 0 39 84 74 84c31 0 43-52 69-89" />
        <path d="M483 62l85-33l85 33l-85 34zM505 80v43c30 13 93 13 124 0V80" opacity=".72" />
        <path d="M487 128h154l-10 22H497zM497 150h134l-9 19H506z" opacity=".46" />
      </g>
      <g fill="currentColor" fontFamily="sans-serif" fontStyle="italic">
        <text x="224" y="32" fontSize="14">
          y = f(x)
        </text>
        <text x="361" y="153" fontSize="13" opacity=".65">
          f′(x) &gt; 0
        </text>
      </g>
    </svg>
  );
}

function LessonGraph() {
  return (
    <div className={styles.lessonGraph} aria-hidden="true">
      <svg viewBox="0 0 250 150" fill="none">
        <path className={styles.axis} d="M18 118H232M80 138V16" />
        <path
          className={styles.curve}
          d="M22 116C51 116 53 61 80 61c29 0 34 55 62 55c30 0 34-46 73-47"
        />
        <circle cx="80" cy="61" r="3" />
        <circle cx="215" cy="69" r="3" />
        <text x="134" y="37">
          f′(x) &gt; 0
        </text>
        <text x="130" y="139">
          f′(x) &lt; 0
        </text>
        <text x="226" y="130">
          x
        </text>
        <text x="68" y="22">
          y
        </text>
      </svg>
    </div>
  );
}

function AnimatedProgress({ value, delay = 0 }: { value: number; delay?: number }) {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <span className={styles.progressTrack}>
      <span
        className={styles.progressFill}
        style={{ width: ready ? `${value}%` : 0, transitionDelay: `${delay}ms` }}
      />
    </span>
  );
}

function StageIndicator({ item }: { item: RoadmapStageItem }) {
  if (item.status === 'completed')
    return (
      <span className={`${styles.stageDot} ${styles.completed}`}>
        <Check size={14} strokeWidth={3} />
      </span>
    );
  if (item.status === 'current')
    return (
      <span className={`${styles.stageDot} ${styles.current}`}>
        <span />
      </span>
    );
  return <span className={styles.stageDot} />;
}

function FullRoadmapSheet({ dashboard }: { dashboard: StudentRoadmapDashboard }) {
  return (
    <Sheet>
      <SheetTrigger className={styles.outlineButton}>Xem toàn bộ lộ trình</SheetTrigger>
      <SheetContent className="w-[min(92vw,440px)] overflow-y-auto sm:max-w-[440px]">
        <SheetHeader className="border-b border-slate-100 p-6 pr-12">
          <SheetTitle className="text-xl font-extrabold text-slate-900">Lộ trình của em</SheetTitle>
          <SheetDescription>
            Mục tiêu {dashboard.targetScore}+ · {dashboard.progress.roadmapPercentage}% hoàn thành
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-6 pb-8">
          {dashboard.stages.map((stage) => (
            <section key={stage.id}>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-blue-600">
                Giai đoạn {stage.order}
              </p>
              <h3 className="mt-1 font-extrabold text-slate-900">{stage.title}</h3>
              <ol className="mt-3 space-y-3">
                {stage.items.map((item) => (
                  <li
                    className="flex items-center gap-3 text-sm font-semibold text-slate-600"
                    key={item.id}
                  >
                    <StageIndicator item={item} />
                    {item.title}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function StudentRoadmapOverview({
  roadmap,
  dashboard,
}: {
  roadmap: StudentRoadmap;
  dashboard: StudentRoadmapDashboard;
}) {
  const [lockExplanationOpen, setLockExplanationOpen] = React.useState(false);
  const model = buildRoadmapPresentation(roadmap, dashboard);
  const lesson = model.currentLesson;
  const quiz = model.quickCheck;
  const lessonProgress = Math.min(100, Math.max(0, lesson.progress ?? 0));
  const completedChapterItems = model.chapterItems.filter(
    (item) => item.status === 'completed'
  ).length;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <AcademicHeroArt />
        <div className={styles.heroCopy}>
          <Link href="/student/dashboard" className={styles.breadcrumb}>
            <ArrowLeft size={16} />
            Lộ trình học tập
          </Link>
          <h1>
            Kế hoạch hôm nay <span>· {model.subject}</span>
          </h1>
          <p>
            Tiếp tục chinh phục mục tiêu {model.targetScore}+ với bước học tiếp theo phù hợp với
            năng lực hiện tại.
          </p>
          <div className={styles.heroProgress}>
            <strong>
              Bạn đang ở <b>{model.percentage}%</b> lộ trình
            </strong>
            <AnimatedProgress value={model.percentage} />
          </div>
        </div>
        <blockquote className={styles.quote}>
          “Kiến thức hôm nay
          <br />
          là cơ hội ngày mai.”<cite>— Tú Tài</cite>
        </blockquote>
      </header>

      <div className={styles.contentGrid}>
        <main className={styles.mainColumn}>
          <section className={`${styles.card} ${styles.lessonCard}`}>
            <div className={styles.stepLabel}>
              <span>01</span>
              <strong>Tiếp theo dành cho bạn</strong>
            </div>
            <div className={styles.lessonLayout}>
              <LessonGraph />
              <div className={styles.lessonContent}>
                <h2>{lesson.title}</h2>
                <div className={styles.metadata}>
                  <span>
                    <BookOpen size={16} />
                    {lesson.subject}
                  </span>
                  <span>·</span>
                  <span>Ứng dụng đạo hàm</span>
                  <span>·</span>
                  <span>
                    <Clock3 size={16} />~{lesson.estimatedMinutes ?? 18} phút
                  </span>
                </div>
                <p>
                  {lesson.description ??
                    'Bài học tiếp theo phù hợp để củng cố kiến thức trọng tâm.'}
                </p>
                <div className={styles.lessonProgress}>
                  <AnimatedProgress value={lessonProgress} delay={120} />
                  <b>{lessonProgress}%</b>
                </div>
              </div>
              {lesson.action?.href && (
                <Link href={lesson.action.href} className={styles.primaryButton}>
                  {lesson.action.label || 'Học tiếp'}
                  <ArrowRight size={20} />
                </Link>
              )}
            </div>
            <aside className={styles.reasonBox}>
              <span>
                <Lightbulb size={21} />
              </span>
              <div>
                <h3>Vì sao bài này xuất hiện?</h3>
                <p>
                  {model.reason} Bài học này sẽ giúp em củng cố nền tảng quan trọng để học tốt các
                  phần tiếp theo.
                </p>
              </div>
            </aside>
          </section>

          {quiz && (
            <section className={`${styles.card} ${styles.quizCard}`}>
              <div className={styles.stepLabel}>
                <span>02</span>
                <strong>Kiểm tra nhanh</strong>
              </div>
              <div className={styles.quizRow}>
                <span className={styles.quizIcon}>
                  <FileCheck2 size={23} />
                </span>
                <div>
                  <h2>{quiz.title}</h2>
                  <p>{quiz.dependencyLabel ?? `Mở khóa sau khi hoàn thành bài ${lesson.title}.`}</p>
                </div>
                <div className={styles.lockWrap}>
                  <button
                    type="button"
                    aria-expanded={lockExplanationOpen}
                    onClick={() => setLockExplanationOpen((open) => !open)}
                    className={styles.lockButton}
                  >
                    <LockKeyhole size={17} />
                    Chưa mở khóa
                  </button>
                  {lockExplanationOpen && (
                    <div role="status" className={styles.lockPopover}>
                      Hoàn thành bài đang học để mở khóa hoạt động này.
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </main>

        <aside
          className={`${styles.card} ${styles.summaryCard}`}
          aria-labelledby="roadmap-summary-heading"
        >
          <div className={styles.summaryHeader}>
            <div>
              <h2 id="roadmap-summary-heading">Lộ trình của em</h2>
              <p>Mục tiêu {model.targetScore}+</p>
            </div>
            <strong>{model.percentage}%</strong>
          </div>
          <AnimatedProgress value={model.percentage} />
          <div className={styles.chapterHeader}>
            <h3>{model.chapterTitle}</h3>
            <b>
              {completedChapterItems}/{model.chapterItems.length}
            </b>
          </div>
          <ol className={styles.stageList}>
            {model.chapterItems.map((item, index) => (
              <li
                className={item.status === 'current' ? styles.activeStage : ''}
                key={item.id}
                style={{ animationDelay: `${180 + index * 45}ms` }}
              >
                <StageIndicator item={item} />
                <span>{item.title}</span>
                {item.status === 'current' && <b>Đang học</b>}
                {['upcoming', 'locked'].includes(item.status) && <em>Tiếp theo</em>}
              </li>
            ))}
          </ol>
          <FullRoadmapSheet dashboard={dashboard} />
        </aside>
      </div>

      <section className={`${styles.card} ${styles.journeyCard}`}>
        <div className={styles.journeyHeader}>
          <span>
            <Network size={22} />
          </span>
          <div>
            <h2>Tiếp theo trong hành trình</h2>
            <p>
              Hoàn thành bài học hiện tại để mở khóa các nội dung tiếp theo và tiến gần hơn tới mục
              tiêu {model.targetScore}+.
            </p>
          </div>
          <em>Cứ đi từng bước một!</em>
        </div>
        <div className={styles.journeySteps}>
          {model.journey.map((item, index) => (
            <React.Fragment key={item.id}>
              <article>
                <span>{String(item.order).padStart(2, '0')}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </article>
              {index < model.journey.length - 1 && (
                <ChevronRight className={styles.journeyArrow} size={22} />
              )}
            </React.Fragment>
          ))}
          <ChevronRight className={styles.journeyArrow} size={22} />
          <article className={styles.encouragement}>
            <span>
              <Trophy size={22} />
            </span>
            <div>
              <h3>Tiếp tục cố gắng</h3>
              <p>Mỗi bài học là một bước tiến tới mục tiêu {model.targetScore}+!</p>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
