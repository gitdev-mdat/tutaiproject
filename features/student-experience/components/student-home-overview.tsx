'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Atom,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FlaskConical,
  Info,
  PenLine,
  Play,
  Sigma,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { StudentNotificationBell } from '@/components/student/student-topbar';
import { useStudentHome } from '../hooks/use-student-home';
import {
  CONTINUE_LEARNING,
  COURSE_PROGRESS_META,
  DAILY_GOALS,
} from '../lib/dashboard-presentation';
import type { DashboardActivityPoint, OverviewPeriod } from '../lib/types';
import styles from './student-home-overview.module.css';

const PERIODS: { id: OverviewPeriod; label: string }[] = [
  { id: 'day', label: 'Hôm nay' },
  { id: 'week', label: 'Tuần này' },
  { id: 'month', label: 'Tháng này' },
];

const PERIOD_LABELS: Record<OverviewPeriod, string> = {
  day: 'Hôm nay',
  week: 'Tuần này',
  month: 'Tháng này',
};

const SUBJECT_ICONS: Record<string, LucideIcon> = {
  Toán: Sigma,
  'Vật lý': Atom,
  'Hóa học': FlaskConical,
};

function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

function AnimatedNumber({ value }: { value: number }) {
  const reducedMotion = useReducedMotion();
  const [displayed, setDisplayed] = React.useState(reducedMotion ? value : 0);

  React.useEffect(() => {
    if (reducedMotion) {
      return;
    }
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 520);
      setDisplayed(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion, value]);

  return <>{reducedMotion ? value : displayed}</>;
}

function AcademicArtwork() {
  return (
    <svg className={styles.academicArtwork} viewBox="0 0 760 180" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.2">
        <path d="M21 149H207M49 168V18" opacity=".32" />
        <path d="M56 135C82 134 83 48 112 48C143 48 140 135 171 135C187 135 197 103 205 74" />
        <path d="M240 25v119M219 122h146" opacity=".25" />
        <path d="M241 121l68-73v73zM309 48v73" opacity=".55" />
        <path d="M425 52l91-39l91 39l-91 39z" />
        <path d="M452 68v45c30 17 98 17 128 0V68M607 53v44" opacity=".72" />
        <path d="M438 123h151l-12 25H450zM448 148h137l-10 19H458z" opacity=".42" />
        <path d="M631 112c24-62 50-62 74 0c17 43 31 43 43 3" opacity=".65" />
        <path d="M616 112h138M692 33v112" opacity=".22" />
      </g>
      <g fill="currentColor" fontFamily="sans-serif">
        <text x="82" y="35" fontSize="14" opacity=".62">
          y = f(x)
        </text>
        <text x="260" y="40" fontSize="13" opacity=".48">
          a² + b² = c²
        </text>
        <text x="620" y="28" fontSize="15" fontStyle="italic" opacity=".5">
          y = sin x
        </text>
        <text x="615" y="161" fontSize="14" fontStyle="italic" opacity=".48">
          E = mc²
        </text>
      </g>
    </svg>
  );
}

/**
 * Supporting-rank section glyph (presentation only).
 *
 * Section icons sit one tier below the page anchor and the single accent
 * next-action, so they render smaller and lighter than before to keep
 * "Hoạt động học tập" / "Tiến độ khóa học" clearly subordinate.
 */
function SectionIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className={styles.sectionIcon} data-rank="supporting" aria-hidden="true">
      <Icon size={18} strokeWidth={2} />
    </span>
  );
}

function ActivityChart({
  series,
  periodLabel,
}: {
  series: DashboardActivityPoint[];
  periodLabel: string;
}) {
  const reducedMotion = useReducedMotion();
  const [ready, setReady] = React.useState(false);
  const total = series.reduce((sum, point) => sum + point.practice + point.exams, 0);
  const hasData = total > 0;
  const peak = series.reduce((top, point) => Math.max(top, point.practice, point.exams), 0);
  // Scale is derived from the real series only — never from fabricated values.
  const max = Math.max(4, Math.ceil(peak / 4) * 4);
  const guides = [max, (max * 3) / 4, max / 2, max / 4, 0];

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const barHeight = (value: number) => {
    if (value <= 0) return 0;
    if (!reducedMotion && !ready) return 0;
    return `${Math.max(4, (value / max) * 100)}%`;
  };

  return (
    <div className={styles.chart} data-empty={!hasData || undefined}>
      <div className={styles.chartPlot}>
        {guides.map((guide) => (
          <div key={guide} className={styles.guide} style={{ bottom: `${(guide / max) * 100}%` }}>
            <span>{guide}</span>
          </div>
        ))}
        <div
          className={styles.barGroups}
          style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}
          aria-hidden={!hasData || undefined}
        >
          {series.map((point, index) => (
            <div className={styles.barGroup} key={`${point.label}-${index}`}>
              <div
                className={styles.bars}
                tabIndex={hasData ? 0 : -1}
                aria-label={`${point.label}: ${point.practice} luyện đề, ${point.exams} luyện thi`}
              >
                {point.practice > 0 && (
                  <span
                    className={`${styles.bar} ${styles.practiceBar}`}
                    style={{
                      height: barHeight(point.practice),
                      transitionDelay: `${index * 45}ms`,
                    }}
                  />
                )}
                {point.exams > 0 && (
                  <span
                    className={`${styles.bar} ${styles.examBar}`}
                    style={{
                      height: barHeight(point.exams),
                      transitionDelay: `${index * 45 + 35}ms`,
                    }}
                  />
                )}
                {point.practice + point.exams === 0 && (
                  <span className={styles.zeroMark} aria-hidden="true" />
                )}
                {hasData && (
                  <span className={styles.tooltip}>
                    <strong>{point.practice + point.exams} bài</strong>
                    <small>{point.label}</small>
                  </span>
                )}
              </div>
              <span className={styles.dayLabel}>{point.label}</span>
            </div>
          ))}
        </div>
        {!hasData && (
          <div className={styles.chartEmpty}>
            <p className={styles.chartEmptyTitle}>Chưa có hoạt động nào</p>
            <p className={styles.chartEmptyBody}>
              Bạn chưa hoàn thành bài luyện đề hay luyện thi nào trong kỳ “{periodLabel}”. Hoàn
              thành một đề để bắt đầu theo dõi tiến độ.
            </p>
            <Link
              href="/student/practice"
              className={styles.chartEmptyAction}
              data-tone="supporting"
            >
              Bắt đầu luyện đề
              <ArrowRight size={15} />
            </Link>
          </div>
        )}
      </div>
      <div className={styles.legend}>
        <span>
          <i className={styles.practiceDot} />
          Luyện đề
        </span>
        <span>
          <i className={styles.examDot} />
          Luyện thi
        </span>
        <small>
          {hasData ? `Tổng ${total} bài · ${periodLabel}` : `Chưa có dữ liệu · ${periodLabel}`}
        </small>
      </div>
    </div>
  );
}

function ProgressBar({ value, delay = 0 }: { value: number; delay?: number }) {
  const reducedMotion = useReducedMotion();
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return (
    <span className={styles.progressTrack}>
      <span
        className={styles.progressFill}
        style={{ width: reducedMotion || ready ? `${value}%` : 0, transitionDelay: `${delay}ms` }}
      />
    </span>
  );
}

/**
 * DATA TRUTH GUARD (presentation only — no business rule change).
 *
 * The activity series must never contradict the KPI tiles for the same period.
 * When the period summary reports zero completed practice/exam items, any
 * non-zero bar is fabricated fallback data, so we normalise the series to zero
 * and let the already-built honest empty state render instead.
 */
function reconcileActivitySeries(
  series: DashboardActivityPoint[],
  summary: { practiceCompleted: number; examsCompleted: number }
): DashboardActivityPoint[] {
  const reportedTotal = summary.practiceCompleted + summary.examsCompleted;
  if (reportedTotal > 0) return series;
  const seriesTotal = series.reduce((sum, point) => sum + point.practice + point.exams, 0);
  if (seriesTotal === 0) return series;
  return series.map((point) => ({ ...point, practice: 0, exams: 0 }));
}

/**
 * Dominant next-action affordance (presentation only).
 *
 * One accent-filled CTA per screen. The title/meta are passed through verbatim
 * from existing presentation data so the lesson named here stays identical to
 * the lead item rendered elsewhere on the page.
 */
function PrimaryNextAction({
  eyebrow,
  title,
  meta,
  href,
  actionLabel,
  progress,
  progressLabel,
}: {
  eyebrow: string;
  title: string;
  meta?: string;
  href: string;
  actionLabel: string;
  progress?: number;
  progressLabel?: string;
}) {
  return (
    <section className={`${styles.card} ${styles.nextAction}`} data-rank="hero">
      <div className={styles.nextActionCopy}>
        <p className={styles.nextActionEyebrow}>{eyebrow}</p>
        <p className={styles.nextActionTitle}>{title}</p>
        {meta ? <p className={styles.nextActionMeta}>{meta}</p> : null}
        {typeof progress === 'number' ? (
          <div className={styles.nextActionProgress}>
            <ProgressBar value={progress} />
            {progressLabel ? <small>{progressLabel}</small> : null}
          </div>
        ) : null}
      </div>
      <Link href={href} className={styles.nextActionButton}>
        <Play size={16} strokeWidth={2.6} />
        {actionLabel}
        <ArrowRight size={16} strokeWidth={2.4} />
      </Link>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className={styles.skeleton} aria-label="Đang tải tổng quan" aria-busy="true">
      <div className={styles.skeletonHero} />
      <div className={styles.skeletonMetrics} data-secondary="true">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} />
        ))}
      </div>
      <div className={styles.skeletonGrid}>
        <div />
        <div />
      </div>
    </div>
  );
}

export function StudentHomeOverview() {
  const [period, setPeriod] = React.useState<OverviewPeriod>('week');
  const data = useStudentHome(period);

  if (!data) return <DashboardSkeleton />;

  const periodLabel = PERIOD_LABELS[period];
  const metrics: Array<{
    label: string;
    value: number | string;
    suffix?: string;
    context: string;
    icon: LucideIcon;
    tone?: 'green' | 'amber';
    delta?: string;
    deltaDirection?: 'up' | 'down' | 'flat';
    hint?: string;
  }> = [
    {
      label: 'Khóa học',
      value: data.summary.enrolledCourses,
      context: data.program.enrolledCourses.map((course) => course.subject).join(' · '),
      icon: BookOpen,
    },
    {
      label: 'Luyện đề đã hoàn thành',
      value: data.summary.practiceCompleted,
      suffix: 'đề',
      context: periodLabel,
      icon: ClipboardCheck,
      tone: 'green',
    },
    {
      label: 'Luyện thi đã hoàn thành',
      value: data.summary.examsCompleted,
      suffix: 'bài',
      context: periodLabel,
      icon: PenLine,
    },
    {
      label: 'Độ chính xác',
      value: data.summary.accuracy ?? '—',
      suffix: data.summary.accuracy === undefined ? undefined : '%',
      context: periodLabel,
      icon: Target,
      tone: 'amber',
      // A trend badge is only meaningful next to a real accuracy value. With no
      // accuracy for the period the tile shows "—" and the delta is suppressed,
      // otherwise the card reads as "Độ chính xác −3%".
      delta:
        data.summary.accuracy === undefined || data.summary.accuracyDelta === undefined
          ? undefined
          : `${data.summary.accuracyDelta > 0 ? '+' : ''}${data.summary.accuracyDelta}%`,
      deltaDirection:
        data.summary.accuracy === undefined || data.summary.accuracyDelta === undefined
          ? undefined
          : data.summary.accuracyDelta > 0
            ? 'up'
            : data.summary.accuracyDelta < 0
              ? 'down'
              : 'flat',
      hint:
        data.summary.accuracy === undefined
          ? `Chưa đủ dữ liệu để tính độ chính xác trong kỳ “${periodLabel}”.`
          : undefined,
    },
  ];
  const activitySeries = reconcileActivitySeries(data.activitySeries, data.summary);
  const lessonProgress = Math.round(
    (CONTINUE_LEARNING.completedUnits / CONTINUE_LEARNING.totalUnits) * 100
  );
  const completedGoals = DAILY_GOALS.filter((goal) => goal.completed).length;

  return (
    <div className={styles.dashboard}>
      <header className={styles.hero}>
        <AcademicArtwork />
        <div className={styles.heroCopy}>
          <p className={styles.greeting}>Chào mừng trở lại,</p>
          <h1>Tổng quan học tập</h1>
          <p className={styles.program}>{data.program.title}</p>
          <p className={styles.subjects}>
            {data.program.enrolledCourses.map((course) => course.subject).join(' · ')}
          </p>
        </div>
        <blockquote className={styles.quote}>
          “Kiến thức hôm nay
          <br />
          là cơ hội ngày mai.”<cite>— Tú Tài</cite>
        </blockquote>
        <div className={styles.heroActions}>
          <StudentNotificationBell />
          <div className={styles.periodControl} aria-label="Khoảng thời gian báo cáo">
            <span
              className={styles.periodSlider}
              style={{
                transform: `translateX(${PERIODS.findIndex((item) => item.id === period) * 100}%)`,
              }}
            />
            {PERIODS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                aria-pressed={period === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <PrimaryNextAction
        eyebrow={CONTINUE_LEARNING.subject}
        title={CONTINUE_LEARNING.title}
        meta={`${CONTINUE_LEARNING.eyebrow} · Mục tiêu hôm nay ${completedGoals}/${DAILY_GOALS.length}`}
        href={CONTINUE_LEARNING.href}
        actionLabel="Học tiếp"
        progress={lessonProgress}
        progressLabel={`${CONTINUE_LEARNING.completedUnits}/${CONTINUE_LEARNING.totalUnits} chuyên đề · ${lessonProgress}%`}
      />

      <section className={styles.metricGrid} aria-label="Tóm tắt học tập" data-rank="secondary">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <article
              className={styles.metricCard}
              key={metric.label}
              style={{ animationDelay: `${60 + index * 45}ms` }}
            >
              <span className={`${styles.metricIcon} ${metric.tone ? styles[metric.tone] : ''}`}>
                <Icon size={23} strokeWidth={2.15} aria-hidden="true" />
              </span>
              <div className={styles.metricBody}>
                <p className={styles.metricLabel}>{metric.label}</p>
                <p className={styles.metricValue}>
                  {typeof metric.value === 'number' ? (
                    <AnimatedNumber value={metric.value} />
                  ) : (
                    metric.value
                  )}
                  {metric.suffix && <small>{metric.suffix}</small>}
                </p>
                <p className={styles.metricContext}>{metric.context}</p>
              </div>
              {metric.delta && (
                <span className={styles.metricDelta} data-direction={metric.deltaDirection}>
                  {metric.deltaDirection === 'up'
                    ? '↑'
                    : metric.deltaDirection === 'down'
                      ? '↓'
                      : '→'}{' '}
                  {metric.delta}
                </span>
              )}
              {metric.label === 'Độ chính xác' && (
                <Info
                  className={styles.infoIcon}
                  size={16}
                  aria-hidden={metric.hint ? undefined : true}
                  aria-label={metric.hint}
                  role={metric.hint ? 'img' : undefined}
                />
              )}
            </article>
          );
        })}
      </section>

      <div className={styles.mainGrid}>
        <section className={`${styles.card} ${styles.activityCard}`}>
          <div className={styles.cardHeader}>
            <div className={styles.headingGroup}>
              <SectionIcon icon={BarChart3} />
              <div>
                <h2>Hoạt động học tập</h2>
                <p>Số bài đã hoàn thành · {periodLabel}</p>
              </div>
            </div>
            <button type="button" className={styles.compactFilter}>
              Không tính thời gian học <ChevronDown size={15} />
            </button>
          </div>
          <ActivityChart series={activitySeries} periodLabel={periodLabel} />
        </section>

        <section className={`${styles.card} ${styles.courseCard}`}>
          <div className={styles.cardHeader}>
            <div className={styles.headingGroup}>
              <SectionIcon icon={Target} />
              <div>
                <h2>Tiến độ khóa học</h2>
                <p>Tiến độ tích lũy trên toàn lộ trình</p>
              </div>
            </div>
          </div>
          <div className={styles.courseList}>
            {data.courseProgress.map((course, index) => {
              const Icon = SUBJECT_ICONS[course.name] ?? BookOpen;
              const meta = COURSE_PROGRESS_META.find((item) => item.subject === course.name);
              return (
                <Link href="/student/roadmap" className={styles.courseRow} key={course.courseId}>
                  <span className={styles.subjectIcon}>
                    <Icon size={22} />
                  </span>
                  <span className={styles.courseMain}>
                    <span className={styles.courseLabels}>
                      <strong>{course.name}</strong>
                      <b>{course.progress}%</b>
                    </span>
                    <ProgressBar value={course.progress} delay={index * 90} />
                  </span>
                  <span className={styles.topicCount}>
                    {meta
                      ? `${meta.completedTopics}/${meta.totalTopics} chuyên đề`
                      : 'Xem lộ trình'}
                  </span>
                  <ChevronRight className={styles.chevron} size={17} />
                </Link>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}
