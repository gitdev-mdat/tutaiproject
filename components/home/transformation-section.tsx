'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Dumbbell } from 'lucide-react';

import type { LandingCta } from '@/lib/navigation/landing-cta';

import {
  ProductDemoCursor,
  productDemoHostClassName,
  type ProductDemoScene,
} from './product-demo-cursor';
import styles from './transformation-section.module.css';

interface TodayTaskCardProps {
  index: number;
  title: string;
  meta: string;
  action: string;
  /** Reading progress; only the lesson card has one. */
  progress?: number;
  secondary?: boolean;
  ready?: boolean;
  becomingReady?: boolean;
  completed?: boolean;
}

function TodayTaskCard({
  index,
  title,
  meta,
  action,
  progress,
  secondary = false,
  ready = false,
  becomingReady = false,
  completed = false,
}: TodayTaskCardProps) {
  const cardClassName = `${styles.taskCard} ${secondary ? styles.taskSecondary : styles.taskPrimary} ${ready ? styles.taskReady : ''} ${completed ? styles.taskCompleted : ''} ${becomingReady ? styles.taskBecomingReady : ''}`;
  const actionClassName = `${styles.taskAction} ${secondary ? styles.taskActionSecondary : ''}`;
  const Icon = secondary ? Dumbbell : BookOpen;

  return (
    <article className={cardClassName} data-demo-card={secondary ? undefined : 'primary'}>
      <span className={styles.taskNumber} aria-label={`Bước ${index}`}>
        {completed ? <CheckCircle2 size={15} strokeWidth={2.4} aria-hidden="true" /> : index}
      </span>
      <span
        className={styles.taskIllustration}
        data-demo-icon={secondary ? undefined : 'primary'}
        aria-hidden="true"
      >
        <Icon size={secondary ? 26 : 28} strokeWidth={1.9} />
      </span>
      <div className={styles.taskBody}>
        <h4>{title}</h4>
        {progress !== undefined ? (
          <div className={styles.progressRow}>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-label={`Tiến độ ${title}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <span
                className={styles.progressFill}
                data-demo-progress="primary"
                style={{ '--task-progress': `${progress}%` } as CSSProperties}
              />
            </div>
            <strong>{progress}%</strong>
          </div>
        ) : null}
        <p className={styles.taskMeta}>{meta}</p>
      </div>
      {secondary && !ready ? (
        <span className={actionClassName} aria-disabled="true">
          Sau bài học
        </span>
      ) : (
        <Link
          href="/auth/register"
          className={actionClassName}
          data-demo-action={secondary ? 'secondary' : 'primary'}
          aria-label={`${action}: ${title}`}
        >
          {action}
          <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
          {!secondary ? <span data-demo-ripple aria-hidden="true" /> : null}
        </Link>
      )}
    </article>
  );
}

function LessonExperience({ scene }: { scene: ProductDemoScene }) {
  const completedSteps =
    scene === 'LESSON_COMPLETE'
      ? 3
      : scene === 'LESSON_STEP_3'
        ? 2
        : scene === 'LESSON_STEP_2'
          ? 1
          : 0;
  const activeStep =
    scene === 'LESSON_STEP_3'
      ? 3
      : scene === 'LESSON_STEP_2'
        ? 2
        : scene === 'LESSON_STEP_1'
          ? 1
          : 0;
  const completed = scene === 'LESSON_COMPLETE';
  const steps = ['Nhận diện dạng bài', 'Chọn biến u', 'Biến đổi biểu thức'] as const;

  return (
    <div
      className={styles.lessonExperience}
      data-completed={completed ? 'true' : 'false'}
      data-active-step={activeStep}
      aria-live="polite"
    >
      <header className={styles.lessonHeader}>
        <div>
          <span className={styles.todayLabel}>BÀI HỌC</span>
          <h3>Phương pháp đổi biến số</h3>
          <p>Toán 12 · Nguyên hàm</p>
        </div>
        <span className={styles.lessonStepChip}>
          {completed ? 'Hoàn thành' : `Bước ${Math.max(activeStep, 1)}/3`}
        </span>
      </header>

      <article className={styles.conceptCard}>
        <div className={styles.formulaPanel} aria-label="Công thức đổi biến số">
          <span>∫ f(u(x)) · u&apos;(x) dx</span>
          <span className={styles.formulaArrow} aria-hidden="true">
            →
          </span>
          <strong>u = u(x)</strong>
          <span className={styles.formulaSweep} aria-hidden="true" />
        </div>

        <div className={styles.lessonSteps} aria-label="Các bước trong bài học">
          {steps.map((title, index) => {
            const step = index + 1;
            const isComplete = step <= completedSteps;
            const isActive = step === activeStep;
            return (
              <div
                key={title}
                className={styles.lessonStep}
                data-visible={isComplete || isActive || completed ? 'true' : 'false'}
                data-status={isComplete || completed ? 'complete' : isActive ? 'active' : 'pending'}
              >
                <span className={styles.lessonStepMarker} aria-hidden="true">
                  {isComplete || completed ? <CheckCircle2 size={18} strokeWidth={2.4} /> : step}
                </span>
                <strong>{title}</strong>
              </div>
            );
          })}
        </div>
      </article>
    </div>
  );
}

const PRACTICE_QUESTIONS = [
  {
    question: 'Với tích phân ∫ 2x · cos(x²) dx, em nên đặt u bằng gì?',
    answers: ['u = 2x', 'u = x²', 'u = cos(x)', 'u = x'],
    correctIndex: 1,
    explanation: 'Vì du = 2x dx, tích phân trở thành ∫ cos(u) du.',
  },
  {
    question: 'Nếu đặt u = x² thì du bằng gì?',
    answers: ['du = x dx', 'du = 2x dx', 'du = 2 dx', 'du = x² dx'],
    correctIndex: 1,
    explanation: 'Đạo hàm của x² là 2x, nên du = 2x dx.',
  },
  {
    question: 'Sau khi đặt u = x², tích phân trở thành dạng nào?',
    answers: ['∫ cos(u) du', '∫ u · cos(u) du', '∫ cos(x) dx', '∫ 2u dx'],
    correctIndex: 0,
    explanation: 'Thay u = x² và du = 2x dx, ta được ∫ cos(u) du.',
  },
] as const;

const FIREWORK_PARTICLES = [
  [10, 22, -36, -30, '#58a6ff', 0],
  [10, 22, -15, -50, '#8b6ff0', 40],
  [10, 22, 12, -46, '#19b99a', 70],
  [10, 22, 36, -25, '#f5b940', 20],
  [10, 22, 42, 7, '#58a6ff', 90],
  [10, 22, 16, 28, '#8b6ff0', 120],
  [10, 22, -20, 24, '#19b99a', 60],
  [90, 20, -40, -24, '#f5b940', 80],
  [90, 20, -14, -49, '#58a6ff', 20],
  [90, 20, 16, -43, '#8b6ff0', 100],
  [90, 20, 39, -16, '#19b99a', 50],
  [90, 20, 43, 15, '#f5b940', 130],
  [90, 20, 14, 28, '#58a6ff', 70],
  [90, 20, -22, 23, '#8b6ff0', 10],
  [13, 80, -36, -17, '#19b99a', 160],
  [13, 80, -22, 23, '#f5b940', 110],
  [13, 80, 2, 42, '#58a6ff', 190],
  [13, 80, 34, 20, '#8b6ff0', 140],
  [87, 78, -37, -11, '#f5b940', 180],
  [87, 78, -21, 28, '#58a6ff', 120],
  [87, 78, 0, -45, '#19b99a', 200],
  [87, 78, 27, 21, '#8b6ff0', 150],
] as const;

function PracticeCelebration({ scene }: { scene: ProductDemoScene }) {
  const celebrating = scene === 'CELEBRATING';
  const finalSummary = scene === 'FINAL_SUMMARY';

  if (finalSummary) {
    return (
      <div className={styles.finalSummary} aria-live="polite">
        <span className={styles.summaryLabel}>LỘ TRÌNH TOÁN 12</span>
        <span className={styles.summaryCheck} aria-hidden="true">
          <CheckCircle2 size={42} strokeWidth={2.1} />
        </span>
        <h3>Xong bài Phương pháp đổi biến số</h3>
        <div className={styles.summaryProgress}>
          <span>Bước tiếp theo</span>
          <strong>Tích phân từng phần</strong>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.practiceCompletion} data-celebrating={celebrating ? 'true' : 'false'}>
      {celebrating ? (
        <div className={styles.celebrationLayer} aria-hidden="true">
          {FIREWORK_PARTICLES.map(([x, y, dx, dy, color, delay], index) => (
            <span
              key={`${x}-${y}-${index}`}
              style={
                {
                  '--particle-x': `${x}%`,
                  '--particle-y': `${y}%`,
                  '--particle-dx': `${dx}px`,
                  '--particle-dy': `${dy}px`,
                  '--particle-color': color,
                  '--particle-delay': `${delay}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : null}
      <div className={styles.practiceCompletionCard}>
        <span className={styles.completionLabel}>LUYỆN TẬP</span>
        <span className={styles.completionCheck} aria-hidden="true">
          <CheckCircle2 size={46} strokeWidth={2.1} />
        </span>
        <h3>3/3 câu đúng</h3>
        <p>Đạt từ 80% trở lên, bài này đã hoàn thành.</p>
      </div>
    </div>
  );
}

function PracticeExperience({ scene }: { scene: ProductDemoScene }) {
  const completionScene = ['PRACTICE_COMPLETE', 'CELEBRATING', 'FINAL_SUMMARY'].includes(scene);
  if (completionScene) return <PracticeCelebration scene={scene} />;

  const questionIndex = scene.startsWith('PRACTICE_Q3')
    ? 2
    : scene.startsWith('PRACTICE_Q2')
      ? 1
      : 0;
  const questionNumber = questionIndex + 1;
  const question = PRACTICE_QUESTIONS[questionIndex];
  const answered = scene.endsWith('_PRESS') || scene.endsWith('_FEEDBACK');
  const feedback = scene.endsWith('_FEEDBACK');

  return (
    <div
      className={styles.practiceExperience}
      data-feedback={feedback ? 'true' : 'false'}
      data-question={questionNumber}
    >
      <header className={styles.practiceHeader}>
        <div>
          <span className={styles.todayLabel}>LUYỆN TẬP</span>
          <h3>3 câu luyện tập</h3>
          <p>Phương pháp đổi biến số · Toán 12</p>
        </div>
        <span className={styles.practiceCount}>Câu {questionNumber} / 3</span>
      </header>

      <article key={questionNumber} className={styles.questionCard}>
        <span className={styles.questionLabel}>CÂU HỎI</span>
        <h4>{question.question}</h4>
        <div className={styles.answerGrid}>
          {question.answers.map((answer, index) => {
            const correct = index === question.correctIndex;
            return (
              <div
                key={answer}
                className={`${styles.answerOption} ${correct && answered ? styles.answerCorrect : ''}`}
                data-demo-answer={correct ? 'correct' : undefined}
              >
                <span>{String.fromCharCode(65 + index)}</span>
                <strong>{answer}</strong>
                {correct && answered ? (
                  <CheckCircle2 size={18} strokeWidth={2.4} aria-hidden="true" />
                ) : null}
              </div>
            );
          })}
        </div>
      </article>

      <div className={styles.practiceFooter}>
        <div className={styles.answerFeedback} aria-live="polite">
          <CheckCircle2 size={20} strokeWidth={2.4} aria-hidden="true" />
          <span>
            <strong>Chính xác</strong>
            <small>{question.explanation}</small>
          </span>
        </div>
      </div>
    </div>
  );
}

// Toán 12 (GDPT 2018) has six chapters; the example student is in chapter 4.
const CHAPTERS = [
  'Ứng dụng đạo hàm',
  'Vectơ trong không gian',
  'Thống kê',
  'Nguyên hàm và tích phân',
  'Tọa độ trong không gian',
  'Xác suất',
] as const;
const CURRENT_CHAPTER = 3;

function ChapterTrack() {
  return (
    <div className={styles.chapterTrack}>
      <ol aria-label="Các chương Toán 12">
        {CHAPTERS.map((chapter, index) => (
          <li
            key={chapter}
            data-state={
              index < CURRENT_CHAPTER ? 'done' : index === CURRENT_CHAPTER ? 'current' : 'later'
            }
            title={chapter}
          />
        ))}
      </ol>
      <p>
        Chương {CURRENT_CHAPTER + 1}/{CHAPTERS.length} ·{' '}
        <strong>{CHAPTERS[CURRENT_CHAPTER]}</strong>
      </p>
    </div>
  );
}

function ProductShowcaseShell() {
  const productStageRef = useRef<HTMLDivElement>(null);
  const [demoScene, setDemoScene] = useState<ProductDemoScene>('ROADMAP_LOCKED');
  const lessonVisible = demoScene.startsWith('LESSON_');
  const practiceVisible =
    demoScene === 'PRACTICE_ACTIVE' ||
    demoScene.startsWith('PRACTICE_Q') ||
    demoScene === 'PRACTICE_COMPLETE' ||
    demoScene === 'CELEBRATING' ||
    demoScene === 'FINAL_SUMMARY';
  const lessonCompleted = [
    'ROADMAP_LESSON_COMPLETE',
    'PRACTICE_UNLOCKING',
    'PRACTICE_READY',
    'PRACTICE_APPROACH',
    'PRACTICE_HOVER',
    'PRACTICE_PRESS',
  ].includes(demoScene);
  const practiceReady = [
    'PRACTICE_READY',
    'PRACTICE_APPROACH',
    'PRACTICE_HOVER',
    'PRACTICE_PRESS',
  ].includes(demoScene);
  const practiceBecomingReady = demoScene === 'PRACTICE_UNLOCKING';

  return (
    <div
      ref={productStageRef}
      className={`${styles.productStage} ${styles.desktopProductStage} ${styles.reveal} ${productDemoHostClassName}`}
      style={{ '--reveal-delay': '140ms' } as CSSProperties}
      data-product-demo-host
    >
      <div className={styles.stageGlow} aria-hidden="true" />
      <div className={styles.productShell}>
        <div className={styles.productMain}>
          <div
            className={`${styles.demoScene} ${lessonVisible ? styles.demoSceneLesson : practiceVisible ? styles.demoScenePractice : styles.demoSceneRoadmap}`}
            data-demo-scene
          >
            {lessonVisible ? (
              <LessonExperience scene={demoScene} />
            ) : practiceVisible ? (
              <PracticeExperience scene={demoScene} />
            ) : (
              <div
                className={styles.roadmapExperience}
                data-completed={lessonCompleted ? 'true' : 'false'}
              >
                <header className={styles.productHeader}>
                  <div>
                    <span className={styles.todayLabel}>LỘ TRÌNH TOÁN 12</span>
                    <h3>Hôm nay em nên học gì?</h3>
                  </div>
                </header>

                <ChapterTrack />

                <div className={styles.taskList}>
                  <TodayTaskCard
                    index={1}
                    title="Phương pháp đổi biến số"
                    progress={lessonCompleted ? 100 : 35}
                    meta={lessonCompleted ? 'Đã học xong' : 'Đang học dở, mở lại đúng chỗ'}
                    action={lessonCompleted ? 'Xem lại' : 'Học tiếp'}
                    completed={lessonCompleted}
                  />
                  <TodayTaskCard
                    index={2}
                    title="3 câu luyện tập"
                    meta="Đúng 80% là xong bài"
                    action="Luyện tập"
                    secondary
                    ready={practiceReady}
                    becomingReady={practiceBecomingReady}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className={styles.stageCaption}>Giao diện minh họa, số liệu là ví dụ.</p>
      <ProductDemoCursor hostRef={productStageRef} onSceneChange={setDemoScene} />
    </div>
  );
}

export function TransformationSection({ primaryCta }: { primaryCta: LandingCta }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { threshold: 0.12 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={sectionRef}
      className={styles.section}
      data-visible={visible ? 'true' : 'false'}
      aria-labelledby="daily-experience-title"
    >
      <div className={styles.boundaryWash} aria-hidden="true" />
      <div className={styles.curvedDepth} aria-hidden="true" />
      <div className={styles.orbitOne} aria-hidden="true" />
      <div className={styles.orbitTwo} aria-hidden="true" />
      <svg
        className={styles.sharedAtmosphere}
        viewBox="0 0 1600 900"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g className={styles.atmosphereLines}>
          <path d="M590 86C790 14 1045 40 1224 174" />
          <path d="M1062 38C1270 128 1394 316 1418 548" />
          <path d="M712 712C882 620 1062 610 1236 692" />
          <path d="M572 348C700 324 812 350 914 430" />
        </g>
        <g className={styles.atmosphereNodes}>
          <circle cx="614" cy="82" r="3" />
          <circle cx="1016" cy="58" r="2.3" />
          <circle cx="1395" cy="430" r="3.2" />
          <circle cx="1198" cy="680" r="2.5" />
          <circle cx="696" cy="337" r="2" />
        </g>
      </svg>

      <div className={styles.container}>
        <div className={styles.editorial}>
          <p className={`${styles.eyebrow} ${styles.reveal}`}>LỘ TRÌNH</p>

          <h2 id="daily-experience-title" className={`${styles.heading} ${styles.reveal}`}>
            <span>Mở Tú Tài lên.</span>
            <span className={styles.headingBlue}>Biết ngay hôm nay</span>
            <span className={styles.headingBlue}>cần học gì.</span>
          </h2>

          <p className={`${styles.description} ${styles.reveal}`}>
            Mỗi lần mở chỉ có một bước tiếp theo, kèm lý do. Học dở thì mở lại đúng chỗ đang dừng.
          </p>

          <div
            className={`${styles.actions} ${styles.reveal}`}
            style={{ '--reveal-delay': '320ms' } as CSSProperties}
          >
            <Link href={primaryCta.path} className={styles.primaryCta}>
              <span>{primaryCta.label}</span>
              <span aria-hidden="true">
                <ArrowRight size={17} strokeWidth={2.2} />
              </span>
            </Link>
          </div>
        </div>

        <ProductShowcaseShell />
      </div>
    </div>
  );
}
