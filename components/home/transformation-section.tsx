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
} from 'lucide-react';

import { TuTaiMark } from '@/components/layout/public-header';
import { getRoadmapCta, getClientRoadmapUserState } from '@/lib/navigation/roadmap-flow';
import { useOnboardingDraft } from '@/lib/onboarding/use-onboarding-draft';

import { ProductDemoCursor, productDemoHostClassName } from './product-demo-cursor';
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
}

function TodayTaskCard({
  index,
  title,
  progress,
  meta,
  action,
  note,
  secondary = false,
}: TodayTaskCardProps) {
  return (
    <article
      className={`${styles.taskCard} ${secondary ? styles.taskSecondary : styles.taskPrimary}`}
      data-demo-card={secondary ? undefined : 'primary'}
    >
      <span className={styles.taskNumber} aria-label={`Bước ${index}`}>
        {index}
      </span>
      <span
        className={styles.taskIllustration}
        data-demo-icon={secondary ? undefined : 'primary'}
        aria-hidden="true"
      >
        {secondary ? (
          <Dumbbell size={26} strokeWidth={1.9} />
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
              <LockKeyhole size={12} strokeWidth={1.9} aria-hidden={true} />
              {note}
            </span>
          ) : null}
        </div>
      </div>
      <Link
        href="/auth/register"
        className={`${styles.taskAction} ${secondary ? styles.taskActionSecondary : ''}`}
        data-demo-action={secondary ? undefined : 'primary'}
        aria-label={`${action}: ${title}`}
      >
        {action}
        <ArrowRight size={14} strokeWidth={2} aria-hidden={true} />
        {!secondary ? <span data-demo-ripple aria-hidden="true" /> : null}
      </Link>
    </article>
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
          <strong className={styles.reasonOrange}>Sai 3/5 câu liên quan</strong>
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
          <span>Sau khi học xong, 5 câu luyện trọng tâm sẽ được mở khóa</span>
        </div>
      </div>
    </aside>
  );
}

function ProductShowcaseShell() {
  const productStageRef = useRef<HTMLDivElement>(null);

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
              progress={35}
              meta="Bài học · Toán 12"
              action="Học"
            />
            <TodayTaskCard
              index={2}
              title="5 câu luyện trọng tâm"
              progress={0}
              meta="Bài luyện · Toán 12"
              note="Mở khóa khi hoàn thành Bài học 1"
              action="Luyện tập"
              secondary
            />
          </div>

          <MiniStatCards />
          <RecommendationReasonCard />
        </div>
      </div>
      <ProductDemoCursor hostRef={productStageRef} />
    </div>
  );
}

function MobileProductShowcase() {
  const [lessonComplete, setLessonComplete] = useState(false);
  const progress = lessonComplete ? 100 : 35;

  return (
    <div className={`${styles.mobileProductStage} ${styles.reveal}`}>
      <div className={styles.mobileDashboard}>
        <header className={styles.mobileDashboardHeader}>
          <span>LỘ TRÌNH CỦA EM</span>
          <div>
            <h3>Hôm nay em nên học gì?</h3>
            <span className={styles.mobileGoalChip}>
              Mục tiêu <strong>8.5+</strong>
            </span>
          </div>
        </header>

        <div className={styles.mobileTaskList}>
          <article className={styles.mobileLessonCard}>
            <div className={styles.mobileLessonHeading}>
              <span className={styles.mobileStepBadge}>1</span>
              <span className={styles.mobileTaskIcon} aria-hidden="true">
                <BookOpen size={24} strokeWidth={1.9} />
              </span>
              <h4>Phương pháp đổi biến số</h4>
            </div>

            <div className={styles.mobileProgressRow}>
              <div
                className={styles.mobileProgressTrack}
                role="progressbar"
                aria-label="Tiến độ Phương pháp đổi biến số"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <span style={{ width: `${progress}%` }} />
              </div>
              <strong>{progress}%</strong>
            </div>

            <div className={styles.mobileLessonFooter}>
              <span>
                <Clock3 size={14} strokeWidth={1.9} aria-hidden="true" />
                Bài học · Toán 12
              </span>
              <Link href="/auth/register" className={styles.mobileTaskCta}>
                Học
                <ArrowRight size={15} strokeWidth={2.1} aria-hidden="true" />
              </Link>
            </div>
          </article>

          <article
            className={`${styles.mobilePracticeCard} ${lessonComplete ? styles.mobilePracticeActive : ''}`}
            aria-live="polite"
          >
            <div className={styles.mobilePracticeHeading}>
              <span className={styles.mobileStepBadge}>2</span>
              <span className={styles.mobilePracticeIcon} aria-hidden="true">
                <Dumbbell size={22} strokeWidth={1.9} />
              </span>
              <div>
                <h4>5 câu luyện trọng tâm</h4>
                {lessonComplete ? (
                  <span className={styles.mobilePracticeMeta}>5 câu · ~7 phút</span>
                ) : (
                  <span className={styles.mobilePracticeLock}>
                    <LockKeyhole size={14} strokeWidth={1.9} aria-hidden="true" />
                    Mở sau khi hoàn thành bài học phía trên
                  </span>
                )}
              </div>
              {lessonComplete ? (
                <Link href="/auth/register" className={styles.mobilePracticeCta}>
                  Luyện tập
                  <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </article>
        </div>

        <div className={styles.mobileStatsGrid} aria-label="Tiến độ học tập">
          {STATS.map(({ value, label, Icon, tone }) => (
            <article key={label} className={styles.mobileStatCard}>
              <div>
                <span className={styles[`mobileStat_${tone}`]} aria-hidden="true">
                  <Icon size={16} strokeWidth={2} />
                </span>
                <strong>{value}</strong>
              </div>
              <small>{label}</small>
            </article>
          ))}
        </div>

        <aside className={styles.mobileInsight} aria-label="Lý do Tú Tài chọn bài học">
          <header>
            <span aria-hidden="true">
              <Lightbulb size={19} strokeWidth={1.9} />
            </span>
            <h4>Vì sao Tú Tài chọn bài này?</h4>
          </header>

          <dl className={styles.mobileInsightRows}>
            <div>
              <dt>Mục tiêu của em</dt>
              <dd>8.5+</dd>
            </div>
            <div>
              <dt>Chủ đề cần cải thiện</dt>
              <dd>Đổi biến số</dd>
            </div>
            <div>
              <dt>5 câu gần nhất</dt>
              <dd className={styles.mobileWarning}>Sai 3 câu</dd>
            </div>
          </dl>

          <p>Vì vậy, đây là phần Tú Tài ưu tiên cho em hôm nay.</p>

          <button
            type="button"
            className={styles.mobileInsightCta}
            onClick={() => setLessonComplete(true)}
            disabled={lessonComplete}
          >
            {lessonComplete ? (
              <>
                <CheckCircle2 size={17} strokeWidth={2} aria-hidden="true" />
                Đã hoàn thành
              </>
            ) : (
              <>
                Học ngay
                <ArrowRight size={17} strokeWidth={2.1} aria-hidden="true" />
              </>
            )}
          </button>

          <span className={styles.mobileInsightLock}>
            <LockKeyhole size={15} strokeWidth={1.9} aria-hidden="true" />
            {lessonComplete
              ? '5 câu luyện trọng tâm đã được mở'
              : 'Hoàn thành bài này để mở 5 câu luyện trọng tâm'}
          </span>
        </aside>
      </div>
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
        <MobileProductShowcase />
      </div>
    </div>
  );
}
