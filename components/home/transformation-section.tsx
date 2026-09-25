'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarCheck,
  ChartNoAxesCombined,
  CheckCircle2,
  Clock3,
  Dumbbell,
  FileText,
  Lightbulb,
  LockKeyhole,
  Map,
  Settings,
  Sparkles,
  Target,
  TriangleAlert,
  TrendingUp,
  UnlockKeyhole,
} from 'lucide-react';

import { TuTaiMark } from '@/components/layout/public-header';
import { getRoadmapCta, getClientRoadmapUserState } from '@/lib/navigation/roadmap-flow';
import { useOnboardingDraft } from '@/lib/onboarding/use-onboarding-draft';

import {
  ProductDemoCursor,
  productDemoHostClassName,
  type ProductDemoScene,
} from './product-demo-cursor';
import styles from './transformation-section.module.css';

type IconComponent = ComponentType<{
  size?: number;
  strokeWidth?: number;
  'aria-hidden'?: boolean;
}>;

const BENEFITS: Array<{
  title: string;
  description: string;
  Icon: IconComponent;
  tone: 'blue' | 'violet' | 'cyan';
}> = [
  {
    title: 'Không học lan man',
    description: 'Tập trung vào đúng phần em cần cải thiện.',
    Icon: Target,
    tone: 'blue',
  },
  {
    title: 'Biết rõ học gì trước',
    description: 'Tú Tài sắp sẵn bài học và luyện tập phù hợp mỗi ngày.',
    Icon: CalendarCheck,
    tone: 'violet',
  },
  {
    title: 'Tiến bộ đúng trọng tâm',
    description: 'Theo dõi tiến độ và điều chỉnh liên tục cho em.',
    Icon: TrendingUp,
    tone: 'cyan',
  },
];

const NAV_ITEMS: Array<{ label: string; Icon: IconComponent }> = [
  { label: 'Hôm nay', Icon: CalendarCheck },
  { label: 'Lộ trình', Icon: Map },
  { label: 'Bài học', Icon: BookOpen },
  { label: 'Luyện tập', Icon: Dumbbell },
  { label: 'Đề thi', Icon: FileText },
  { label: 'Thống kê', Icon: BarChart3 },
  { label: 'Cài đặt', Icon: Settings },
];

const STATS: Array<{
  value: string;
  label: string;
  Icon: IconComponent;
  tone: 'blue' | 'amber' | 'green';
}> = [
  { value: '4/12', label: 'Chương đã vững', Icon: BookOpen, tone: 'blue' },
  { value: '5/12', label: 'Chương cần ôn', Icon: ChartNoAxesCombined, tone: 'amber' },
  { value: '38%', label: 'Tiến độ lộ trình', Icon: TrendingUp, tone: 'green' },
];

function BenefitList() {
  return (
    <ul className={styles.benefitList} aria-label="Lợi ích của lộ trình học mỗi ngày">
      {BENEFITS.map(({ title, description, Icon, tone }, index) => (
        <li
          key={title}
          className={`${styles.benefit} ${styles.reveal}`}
          style={{ '--reveal-delay': `${220 + index * 90}ms` } as CSSProperties}
        >
          <span className={`${styles.benefitIcon} ${styles[tone]}`} aria-hidden="true">
            <Icon size={18} strokeWidth={2} />
          </span>
          <span>
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}

function ProductNavigation() {
  return (
    <nav className={styles.productNav} aria-label="Điều hướng ứng dụng Tú Tài">
      <div className={styles.productLogo} aria-label="Tú Tài">
        <TuTaiMark size={28} />
      </div>
      <div className={styles.navItems}>
        {NAV_ITEMS.map(({ label, Icon }, index) => (
          <div
            key={label}
            className={`${styles.navItem} ${index === 0 ? styles.navItemActive : ''}`}
            aria-current={index === 0 ? 'page' : undefined}
            title={label}
          >
            <Icon size={17} strokeWidth={index === 0 ? 2.25 : 1.8} aria-hidden={true} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </nav>
  );
}

interface TodayTaskCardProps {
  index: number;
  title: string;
  progress: number;
  meta: string;
  action: string;
  note?: string;
  secondary?: boolean;
  unlocked?: boolean;
  completed?: boolean;
  unlocking?: boolean;
}

function TodayTaskCard({
  index,
  title,
  progress,
  meta,
  action,
  note,
  secondary = false,
  unlocked = false,
  completed = false,
  unlocking = false,
}: TodayTaskCardProps) {
  const cardClassName = `${styles.taskCard} ${secondary ? styles.taskSecondary : styles.taskPrimary} ${unlocked ? styles.taskUnlocked : ''} ${completed ? styles.taskCompleted : ''} ${unlocking ? styles.taskUnlocking : ''}`;
  const actionClassName = `${styles.taskAction} ${secondary ? styles.taskActionSecondary : ''} ${!unlocked && secondary ? styles.taskActionLocked : ''}`;

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
        {secondary ? (
          unlocked || unlocking ? (
            <UnlockKeyhole size={26} strokeWidth={1.9} />
          ) : (
            <LockKeyhole size={25} strokeWidth={1.9} />
          )
        ) : (
          <BookOpen size={28} strokeWidth={1.9} />
        )}
      </span>
      <div className={styles.taskBody}>
        <h4>{title}</h4>
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
              data-demo-progress={secondary ? undefined : 'primary'}
              style={{ '--task-progress': `${progress}%` } as CSSProperties}
            />
          </div>
          <strong>{progress}%</strong>
        </div>
        <div className={styles.taskMeta}>
          <span>
            <Clock3 size={13} strokeWidth={1.9} aria-hidden={true} />
            {meta}
          </span>
          {note ? (
            <span className={styles.unlockNote}>
              {unlocking ? (
                <UnlockKeyhole size={12} strokeWidth={1.9} aria-hidden={true} />
              ) : !unlocked ? (
                <LockKeyhole size={12} strokeWidth={1.9} aria-hidden={true} />
              ) : null}
              {note}
            </span>
          ) : null}
        </div>
      </div>
      {secondary && !unlocked ? (
        <span className={actionClassName} aria-disabled="true" aria-label={`${action}: đang khóa`}>
          {unlocking ? (
            <UnlockKeyhole size={13} strokeWidth={2} aria-hidden="true" />
          ) : (
            <LockKeyhole size={13} strokeWidth={2} aria-hidden="true" />
          )}
          {unlocking ? 'Đang mở…' : 'Đang khóa'}
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
  const steps = [
    ['Nhận diện dạng bài', 'Tìm biểu thức phù hợp để đặt ẩn'],
    ['Chọn biến u', 'Đặt u = u(x) để rút gọn biểu thức'],
    ['Biến đổi biểu thức', 'Đưa tích phân về dạng quen thuộc'],
  ] as const;

  return (
    <div
      className={styles.lessonExperience}
      data-completed={completed ? 'true' : 'false'}
      data-active-step={activeStep}
      aria-live="polite"
    >
      <header className={styles.lessonHeader}>
        <div>
          <span className={styles.todayLabel}>BÀI HỌC ĐƯỢC ĐỀ XUẤT</span>
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

        <p className={styles.conceptHint}>
          Chọn <strong>u</strong> sao cho phần còn lại của biểu thức chính là{' '}
          <strong>u&apos;(x) dx</strong>.
        </p>
        <div className={styles.lessonSteps} aria-label="Các bước trong bài học">
          {steps.map(([title, detail], index) => {
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
                <span>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </span>
              </div>
            );
          })}
        </div>
      </article>

      <div className={styles.lessonOutcome}>
        <div className={styles.lessonProgressHeading}>
          <span>Tiến độ bài học</span>
          <strong>{completed ? '100%' : '35%'}</strong>
        </div>
        <div
          className={styles.lessonProgressTrack}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={completed ? 100 : 35}
        >
          <span />
        </div>
        <span className={styles.progressGain}>Hoàn thành 100%</span>

        <div className={styles.tutaiResponse}>
          <span aria-hidden="true">
            <TuTaiMark size={25} />
          </span>
          <div>
            <strong>Hoàn thành bài học</strong>
            <p>Em đã sẵn sàng luyện tập.</p>
          </div>
        </div>
      </div>
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
        <span className={styles.summaryLabel}>HOÀN THÀNH MỤC TIÊU HÔM NAY</span>
        <span className={styles.summaryCheck} aria-hidden="true">
          <CheckCircle2 size={42} strokeWidth={2.1} />
        </span>
        <h3>Hôm nay em đã hoàn thành</h3>
        <div className={styles.summaryItems}>
          <span>
            <CheckCircle2 size={18} strokeWidth={2.4} aria-hidden="true" />
            Phương pháp đổi biến số
          </span>
          <span>
            <CheckCircle2 size={18} strokeWidth={2.4} aria-hidden="true" />3 câu luyện trọng tâm
          </span>
        </div>
        <div className={styles.summaryProgress}>
          <span>Tiến độ hôm nay</span>
          <strong>100%</strong>
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
        <span className={styles.completionLabel}>LUYỆN TẬP HOÀN THÀNH</span>
        <span className={styles.completionCheck} aria-hidden="true">
          <CheckCircle2 size={46} strokeWidth={2.1} />
        </span>
        <h3>Xuất sắc! Em đã hoàn thành 3/3 câu</h3>
        <p>Phương pháp đổi biến số đã được củng cố.</p>
        <div className={styles.completionStats}>
          <span>
            <strong>3/3</strong>
            chính xác
          </span>
          <span>
            <strong>100%</strong>
            hoàn thành
          </span>
        </div>
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
  const completedCount = feedback ? questionNumber : questionIndex;
  const progress =
    completedCount === 1 ? 33 : completedCount === 2 ? 67 : completedCount === 3 ? 100 : 0;

  return (
    <div
      className={styles.practiceExperience}
      data-feedback={feedback ? 'true' : 'false'}
      data-question={questionNumber}
    >
      <header className={styles.practiceHeader}>
        <div>
          <span className={styles.todayLabel}>LUYỆN TẬP ĐÃ MỞ KHÓA</span>
          <h3>3 câu luyện trọng tâm</h3>
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
        <div className={styles.practiceProgress}>
          <div>
            <span>Tiến độ luyện tập</span>
            <strong>{completedCount}/3 câu hoàn thành</strong>
          </div>
          <span
            className={styles.practiceProgressTrack}
            role="progressbar"
            aria-label="Tiến độ luyện tập"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ '--practice-progress': `${progress}%` } as CSSProperties} />
          </span>
        </div>
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

function MiniStatCards() {
  return (
    <div className={styles.statsGrid} aria-label="Tiến độ học tập">
      {STATS.map(({ value, label, Icon, tone }) => (
        <article key={label} className={`${styles.statCard} ${styles[`stat${tone}`]}`}>
          <span className={styles.statIcon} aria-hidden="true">
            <Icon size={20} strokeWidth={2} />
          </span>
          <div>
            <strong>{value}</strong>
            <small>{label}</small>
          </div>
        </article>
      ))}
    </div>
  );
}

function RecommendationReasonCard() {
  return (
    <aside className={styles.reasonCard} aria-label="Lý do đề xuất bài học">
      <span className={styles.reasonIcon} aria-hidden="true">
        <Lightbulb size={25} strokeWidth={1.9} />
      </span>
      <div className={styles.reasonSummary}>
        <h4>Vì sao Tú Tài đề xuất bài này?</h4>
        <p className={styles.reasonDesktopCopy}>
          Dựa trên mục tiêu 8.5+ và kết quả gần đây, đổi biến số là chủ đề em còn yếu. Học chắc phần
          này sẽ giúp em tăng điểm nhanh hơn.
        </p>
      </div>
      <span className={styles.reasonPulse} aria-hidden="true">
        <span />
      </span>

      <div className={styles.reasonDetails}>
        <div className={styles.reasonDetailRow}>
          <Target size={16} strokeWidth={2} aria-hidden={true} />
          <span>Mục tiêu của em:</span>
          <strong className={styles.reasonBlue}>8.5+</strong>
        </div>
        <div className={styles.reasonDetailRow}>
          <Dumbbell size={16} strokeWidth={2} aria-hidden={true} />
          <span>Chủ đề còn yếu:</span>
          <strong className={styles.reasonViolet}>Đổi biến số / Tích phân</strong>
        </div>
        <div className={styles.reasonDetailRow}>
          <TriangleAlert size={16} strokeWidth={2} aria-hidden={true} />
          <span>Kết quả gần đây:</span>
          <strong className={styles.reasonOrange}>Sai 2/3 câu liên quan</strong>
        </div>
      </div>

      <p className={styles.reasonExplanation}>
        Tú Tài đề xuất em học phần này trước để tăng điểm nhanh hơn.
      </p>

      <div className={styles.reasonActions}>
        <Link href="/auth/register" className={styles.reasonCta}>
          Học ngay
          <ArrowRight size={17} strokeWidth={2.2} aria-hidden={true} />
        </Link>
        <div className={styles.reasonLockNote}>
          <LockKeyhole size={16} strokeWidth={1.9} aria-hidden={true} />
          <span>Sau khi học xong, 3 câu luyện trọng tâm sẽ được mở khóa</span>
        </div>
      </div>
    </aside>
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
  const practiceUnlocked = [
    'PRACTICE_READY',
    'PRACTICE_APPROACH',
    'PRACTICE_HOVER',
    'PRACTICE_PRESS',
  ].includes(demoScene);
  const practiceUnlocking = demoScene === 'PRACTICE_UNLOCKING';

  return (
    <div
      ref={productStageRef}
      className={`${styles.productStage} ${styles.desktopProductStage} ${styles.reveal} ${productDemoHostClassName}`}
      style={{ '--reveal-delay': '140ms' } as CSSProperties}
      data-product-demo-host
    >
      <div className={styles.stageGlow} aria-hidden="true" />
      <div className={styles.productShell}>
        <ProductNavigation />
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
                data-unlocking={practiceUnlocking ? 'true' : 'false'}
              >
                <header className={styles.productHeader}>
                  <div>
                    <span className={styles.todayLabel}>LỘ TRÌNH CỦA EM</span>
                    <h3>Hôm nay em nên học gì?</h3>
                  </div>
                  <span className={styles.goalChip}>
                    <Target size={15} strokeWidth={2} aria-hidden={true} />
                    Mục tiêu <strong>8.5+</strong>
                  </span>
                </header>

                <div className={styles.taskList}>
                  <TodayTaskCard
                    index={1}
                    title="Phương pháp đổi biến số"
                    progress={lessonCompleted ? 100 : 35}
                    meta={lessonCompleted ? 'Đã hoàn thành' : 'Bài học · Toán 12'}
                    action={lessonCompleted ? 'Xem lại' : 'Học'}
                    completed={lessonCompleted}
                  />
                  <div
                    className={styles.unlockBridge}
                    data-visible={practiceUnlocking ? 'true' : 'false'}
                    aria-hidden={practiceUnlocking ? undefined : 'true'}
                  >
                    <span />
                    Bài học hoàn thành · Đang mở khóa luyện tập
                  </div>
                  <TodayTaskCard
                    index={2}
                    title="3 câu luyện trọng tâm"
                    progress={0}
                    meta={practiceUnlocked ? '3 câu · ~5 phút' : 'Bài luyện · Toán 12'}
                    note={
                      practiceUnlocking
                        ? 'Bài học hoàn thành · Đang mở khóa…'
                        : practiceUnlocked
                          ? 'Đã mở khóa · Sẵn sàng luyện tập'
                          : 'Mở khóa khi hoàn thành Bài học 1'
                    }
                    action="Luyện tập"
                    secondary
                    unlocked={practiceUnlocked}
                    unlocking={practiceUnlocking}
                  />
                </div>

                <MiniStatCards />
                <RecommendationReasonCard />
              </div>
            )}
          </div>
        </div>
      </div>
      <ProductDemoCursor hostRef={productStageRef} onSceneChange={setDemoScene} />
    </div>
  );
}

export function TransformationSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { draft } = useOnboardingDraft();
  const roadmapCta = getRoadmapCta({
    ...getClientRoadmapUserState(draft?.progress),
    hasRoadmap: draft?.hasRoadmap ?? false,
  });
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
          <div className={`${styles.eyebrow} ${styles.reveal}`}>
            <Sparkles size={14} strokeWidth={2} aria-hidden={true} />
            <span className={styles.desktopEyebrowText}>TRẢI NGHIỆM MỖI NGÀY</span>
            <span className={styles.mobileEyebrowText}>LỘ TRÌNH CỦA EM</span>
          </div>

          <h2 id="daily-experience-title" className={`${styles.heading} ${styles.reveal}`}>
            <span>Mở Tú Tài lên.</span>
            <span className={styles.headingBlue}>Biết ngay hôm nay</span>
            <span className={styles.headingBlue}>cần học gì.</span>
          </h2>

          <p className={`${styles.description} ${styles.reveal}`}>
            <span className={styles.desktopDescription}>
              Từ lộ trình cá nhân, Tú Tài sắp sẵn bài học, bài luyện
              <br /> và bước tiếp theo để em tiến bộ mỗi ngày
              <br /> mà không học lan man.
            </span>
            <span className={styles.mobileDescription}>
              Tú Tài sắp sẵn bài học, bài luyện và bước tiếp theo để em tiến bộ mỗi ngày mà không
              học lan man.
            </span>
          </p>

          <BenefitList />

          <div
            className={`${styles.actions} ${styles.reveal}`}
            style={{ '--reveal-delay': '520ms' } as CSSProperties}
          >
            <Link href={roadmapCta.path} className={styles.primaryCta}>
              <span className={styles.desktopCtaLabel}>{roadmapCta.label}</span>
              <span className={styles.mobileCtaLabel}>Xem Tú Tài chọn bài cho em</span>
              <span aria-hidden="true">
                <ArrowRight size={17} strokeWidth={2.2} />
              </span>
            </Link>
            <a href="#product-preview" className={styles.secondaryCta}>
              Tìm hiểu cách Tú Tài cá nhân hóa
              <ArrowRight size={14} strokeWidth={2} aria-hidden={true} />
            </a>
          </div>
        </div>

        <ProductShowcaseShell />
      </div>
    </div>
  );
}
