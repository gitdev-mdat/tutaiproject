'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  useOnboardingDraft,
  getEarliestIncompleteOnboardingRoute,
} from '@/lib/onboarding/use-onboarding-draft';
import { OnboardingRoadmapHero } from '@/features/roadmap/components/onboarding-roadmap-hero';
import {
  OnboardingRoadmapJourney,
  type JourneyStage,
} from '@/features/roadmap/components/onboarding-roadmap-journey';

/**
 * Defensive boundary around the redesigned hero/journey composition. If a
 * downstream rendering defect throws during render, this prevents the whole
 * route from crashing into a dev/runtime error overlay: the required facts
 * and the primary CTA still render via the fallback below.
 */
class RoadmapSectionErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('Roadmap result section failed to render; showing fallback.', error);
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/**
 * Product constant: the onboarding draft has no generated duration, so this
 * is an explicit, human-labeled approximation — not a calculated value.
 */
const ESTIMATED_WEEKS = 10;

function buildRoadmapStages(targetScore: string): JourneyStage[] {
  return [
    {
      step: '1',
      title: 'Củng cố nền tảng',
      description: 'Hệ thống lại kiến thức cốt lõi và lấp các lỗ hổng quan trọng.',
      outcome: 'Tự tin làm chắc các câu hỏi cơ bản.',
    },
    {
      step: '2',
      title: 'Thành thạo chuyên đề',
      description: 'Luyện sâu từng chuyên đề trọng tâm theo mức độ khó tăng dần.',
      outcome: 'Giảm rõ rệt lỗi sai theo từng chủ đề.',
    },
    {
      step: '3',
      title: 'Luyện theo cấu trúc đề',
      description: 'Làm quen với đề tổng hợp và rèn kỹ năng quản lý thời gian.',
      outcome: 'Tiến gần hơn tới mục tiêu điểm số.',
    },
    {
      step: '4',
      title: 'Thi thử & hoàn thiện',
      description: 'Thi thử sát đề thật, rà soát và vá các lỗi còn sót lại.',
      outcome: `Ổn định quanh mức điểm mục tiêu ${targetScore}.`,
    },
  ];
}

export function RoadmapResultClient({ isAuthenticated }: { isAuthenticated: boolean }) {
  const router = useRouter();
  const { draft, updateDraft } = useOnboardingDraft();
  const [isStarting, setIsStarting] = React.useState(false);
  // Detect confirmed client hydration using the standard mount-effect flag.
  // This guarantees the flag flips to true only after the client has
  // mounted in the browser, so completeness/redirect logic never runs
  // against the null server snapshot, and the result reliably renders once
  // the client draft is available.
  const [hasHydrated, setHasHydrated] = React.useState(false);
  React.useEffect(() => {
    setHasHydrated(true);
  }, []);

  // Only evaluate completeness once client hydration is confirmed — the
  // server snapshot is always null and must never trigger a redirect.
  const incompleteRoute = hasHydrated ? getEarliestIncompleteOnboardingRoute(draft) : null;

  React.useEffect(() => {
    if (hasHydrated && incompleteRoute) {
      router.replace(incompleteRoute);
    }
  }, [hasHydrated, incompleteRoute, router]);

  const handleStart = () => {
    if (isStarting) return;

    setIsStarting(true);

    if (isAuthenticated) {
      updateDraft({ progress: 'roadmap', hasRoadmap: true });
      router.push('/student/roadmap');
      return;
    }

    updateDraft({ progress: 'roadmap' });
    router.push('/auth/register?returnTo=%2Fstudent%2Froadmap');
  };

  if (!hasHydrated || incompleteRoute || !draft) {
    // Awaiting confirmed hydration, repairing an incomplete draft, or the
    // draft is otherwise absent: keep the skip-link target present, but do
    // not render missing required facts or any fallback/synthetic
    // personalization. The explicit `!draft` check (rather than relying on
    // `incompleteRoute`) is what lets TypeScript narrow `draft` from
    // `OnboardingDraft | null` to `OnboardingDraft` below. Render a neutral,
    // connected placeholder shape (never literal blank space) so this
    // transient state cannot read as a missing or broken result.
    return (
      <div
        className="mx-auto w-full min-w-0 max-w-[1200px] pb-4 sm:pb-6"
        id="main-content"
        tabIndex={-1}
        aria-busy="true"
        aria-live="polite"
      >
        <div className="space-y-5 sm:space-y-7">
          <div className="h-40 rounded-2xl border border-slate-100 bg-slate-50 sm:h-48" />
          <div className="h-72 rounded-2xl border border-slate-100 bg-slate-50 sm:h-64" />
        </div>
      </div>
    );
  }

  const subjectLabel = draft.subjects!.join(', ');
  const targetScore = draft.targetScore!;
  const baselineScore = draft.selfReportedLevel!;
  const dailyCommitment = `${draft.dailyStudyMinutes} phút/ngày`;
  const durationLabel = `Khoảng ${ESTIMATED_WEEKS} tuần`;
  const roadmapStages = buildRoadmapStages(targetScore);

  return (
    <div
      className="mx-auto w-full min-w-0 max-w-[1200px] pb-4 sm:pb-6"
      id="main-content"
      tabIndex={-1}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pb-3 pt-0.5">
        <button
          type="button"
          onClick={() => router.push('/onboarding/study-time')}
          className="-ml-2 flex min-h-[44px] shrink-0 items-center gap-2 rounded-md px-2 text-sm font-semibold text-slate-500 transition hover:text-[#0052FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052FF]"
        >
          <ArrowLeft size={16} /> Quay lại
        </button>
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0052FF] sm:text-xs sm:tracking-[0.2em]">
          Lộ trình học cá nhân hóa
        </span>
      </header>

      <div className="space-y-5 sm:space-y-7">
        <RoadmapSectionErrorBoundary
          fallback={
            <section
              aria-labelledby="roadmap-fallback-heading"
              className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
            >
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0052FF]">
                  {subjectLabel}
                </p>
                <h2
                  id="roadmap-fallback-heading"
                  className="text-xl font-extrabold text-slate-900 sm:text-2xl"
                >
                  Từ {baselineScore} đến {targetScore}
                </h2>
                <p className="text-sm text-slate-600">
                  {dailyCommitment} · {durationLabel}
                </p>
              </div>

              <ol className="space-y-2">
                {roadmapStages.map((stage) => (
                  <li key={stage.step} className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">
                      Bước {stage.step}: {stage.title}.
                    </span>{' '}
                    {stage.description}
                  </li>
                ))}
              </ol>

              <button
                type="button"
                onClick={handleStart}
                disabled={isStarting}
                aria-busy={isStarting}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#0052FF] px-6 text-sm font-bold text-white transition hover:bg-[#0043D6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {isStarting ? 'Đang bắt đầu…' : 'Bắt đầu lộ trình'}
              </button>
            </section>
          }
        >
          <OnboardingRoadmapHero
            subject={subjectLabel}
            targetScore={targetScore}
            baselineScore={baselineScore}
            dailyCommitment={dailyCommitment}
            durationLabel={durationLabel}
            onStart={handleStart}
            isStarting={isStarting}
          />

          <OnboardingRoadmapJourney stages={roadmapStages} />
        </RoadmapSectionErrorBoundary>
      </div>
    </div>
  );
}
