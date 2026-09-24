'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, CheckCircle2, Clock3, FileText, Play, Timer } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { studentAssessmentHref } from '@/features/student-experience/lib/assessment-links';
import { getStudentExperienceState } from '@/features/student-experience/lib/student-experience-service';
import type { StudentAssessmentAttempt } from '@/features/student-experience/lib/types';
import { CURRICULUM_EXAM_SETS } from '@/lib/exam-sets/curriculum-data';
import type { CurriculumExamSet } from '@/lib/exam-sets/types';
import styles from './exams.module.css';

type Category = 'ALL' | 'SEMESTER_1' | 'SEMESTER_2' | 'NATIONAL';
type ExamState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

const EXAM_SETS = CURRICULUM_EXAM_SETS.filter(
  (set) =>
    set.subjectId === 'MATH' &&
    set.grade === 12 &&
    set.tier === 'STANDARD' &&
    (set.scope === 'SEMESTER' || set.scope === 'NATIONAL')
);

const CATEGORIES: Array<{ id: Category; label: string }> = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'SEMESTER_1', label: 'Học kỳ I' },
  { id: 'SEMESTER_2', label: 'Học kỳ II' },
  { id: 'NATIONAL', label: 'THPT Quốc Gia' },
];

function categoryFor(set: CurriculumExamSet) {
  if (set.scope === 'NATIONAL') return 'THPT Quốc Gia';
  return `Học kỳ ${set.semester === 1 ? 'I' : 'II'}`;
}

function matchesCategory(set: CurriculumExamSet, category: Category) {
  if (category === 'ALL') return true;
  if (category === 'NATIONAL') return set.scope === 'NATIONAL';
  return set.scope === 'SEMESTER' && set.semester === (category === 'SEMESTER_1' ? 1 : 2);
}

function stateFor(set: CurriculumExamSet, attempts: StudentAssessmentAttempt[]): ExamState {
  if (attempts.length || set.status === 'COMPLETED') return 'COMPLETED';
  if (set.status === 'IN_PROGRESS') return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

function scoreFor(attempt: StudentAssessmentAttempt) {
  return (attempt.correct / attempt.total) * 10;
}

function examHref(set: CurriculumExamSet, mode: 'PRACTICE' | 'EXAM_SIMULATION') {
  return studentAssessmentHref({
    set,
    kind: 'exam',
    source: '/student/exams',
    title: `${categoryFor(set)} · Đề số ${String(set.sequence).padStart(2, '0')}`,
    mode,
  });
}

function HeaderArtwork() {
  return (
    <div className={styles.headerArtwork} aria-hidden="true">
      <svg viewBox="0 0 520 150" role="presentation">
        <g transform="rotate(-11 260 75)" fill="none" stroke="#74A8F4" strokeWidth="2">
          <rect
            x="125"
            y="-2"
            width="250"
            height="160"
            rx="14"
            fill="#DDEBFF"
            fillOpacity=".28"
            strokeOpacity=".12"
          />
          {[0, 1, 2, 3].map((row) => (
            <g key={row} transform={`translate(0 ${row * 30})`}>
              <text x="150" y="32" fill="#4E91EC" stroke="none" fontSize="13">
                {String(row + 1).padStart(2, '0')}
              </text>
              {[0, 1, 2, 3].map((column) => (
                <circle
                  key={column}
                  cx={205 + column * 38}
                  cy="27"
                  r="10"
                  fill={row === column ? '#8DBBFA' : 'none'}
                  fillOpacity=".35"
                  strokeOpacity=".3"
                />
              ))}
            </g>
          ))}
          <path
            d="M340 20h18M340 30h18M340 40h18M340 50h18M340 60h18M340 70h18M340 80h18M340 90h18"
            opacity=".18"
          />
        </g>
        <g
          transform="translate(401 25) rotate(42)"
          fill="#D8E9FF"
          stroke="#70A6F0"
          strokeOpacity=".28"
        >
          <rect x="0" y="0" width="18" height="94" rx="8" />
          <path d="m0 94 9 22 9-22" fill="none" />
          <path d="M3 17h12" />
        </g>
      </svg>
    </div>
  );
}

function StartExamDialog({ set, label }: { set: CurriculumExamSet; label: string }) {
  return (
    <Dialog>
      <DialogTrigger className={styles.cardAction}>
        {label}
        {label !== 'Làm lại' && <ArrowRight size={16} />}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Bắt đầu đề thi</DialogTitle>
          <DialogDescription>
            {set.title} · {set.questionCount} câu · {set.durationMinutes} phút
          </DialogDescription>
        </DialogHeader>
        <div className={styles.modeChoices}>
          <p>Chọn chế độ</p>
          <Link href={examHref(set, 'PRACTICE')} className={styles.modeChoice}>
            <span>
              <BookOpen size={20} />
            </span>
            <div>
              <strong>Luyện tập</strong>
              <p>Linh hoạt hơn, phù hợp để ôn tập.</p>
            </div>
            <ArrowRight size={17} />
          </Link>
          <Link href={examHref(set, 'EXAM_SIMULATION')} className={styles.modeChoice}>
            <span>
              <Timer size={20} />
            </span>
            <div>
              <strong>Thi thật</strong>
              <p>Giới hạn thời gian, xem đáp án sau khi nộp.</p>
            </div>
            <ArrowRight size={17} />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResumeExam({ set }: { set: CurriculumExamSet }) {
  const answered = Math.max(0, (set.resumeQuestion ?? 1) - 1);
  const progress = Math.round((answered / set.questionCount) * 100);
  return (
    <section className={styles.resumeCard} aria-labelledby="resume-exam-title">
      <div className={styles.resumeLabel}>
        <Play size={19} fill="currentColor" />
        <span>TIẾP TỤC BÀI THI</span>
      </div>
      <div className={styles.resumeIdentity}>
        <div className={styles.resumeTags}>
          <span>{categoryFor(set)}</span>
          <span>Đề số {String(set.sequence).padStart(2, '0')}</span>
        </div>
        <h2 id="resume-exam-title">{set.title}</h2>
        <p>
          {set.questionCount} câu <b>·</b> {set.durationMinutes} phút
        </p>
      </div>
      <div className={styles.resumeProgress}>
        <p>Tiến độ hiện tại</p>
        <div>
          <strong>
            {answered} / {set.questionCount} câu
          </strong>
          <b>{progress}%</b>
        </div>
        <div className={styles.progressTrack}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <small>Còn {set.questionCount - answered} câu chưa làm</small>
      </div>
      <div className={styles.resumeActionWrap}>
        <Link href={examHref(set, 'EXAM_SIMULATION')} className={styles.resumeAction}>
          Tiếp tục <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}

function ExamCard({
  set,
  attempts,
}: {
  set: CurriculumExamSet;
  attempts: StudentAssessmentAttempt[];
}) {
  const state = stateFor(set, attempts);
  const answered = Math.max(0, (set.resumeQuestion ?? 1) - 1);
  const latestScore = attempts.length ? scoreFor(attempts[0]) : null;
  return (
    <article className={styles.examCard}>
      <div className={styles.cardTop}>
        <span>{categoryFor(set)}</span>
        <b>Đề {String(set.sequence).padStart(2, '0')}</b>
      </div>
      <h3>{set.title}</h3>
      <p className={styles.cardMeta}>
        {set.questionCount} câu <b>·</b> {set.durationMinutes} phút
      </p>
      <div className={styles.cardBottom}>
        <div className={styles.statusGroup}>
          {state === 'COMPLETED' ? (
            <>
              <span className={styles.completed}>
                <CheckCircle2 size={16} /> Đã hoàn thành
              </span>
              {latestScore !== null && (
                <strong className={styles.score}>{latestScore.toFixed(1)} điểm</strong>
              )}
            </>
          ) : state === 'IN_PROGRESS' ? (
            <span className={styles.inProgress}>
              <Clock3 size={16} /> {answered} / {set.questionCount}
            </span>
          ) : (
            <span className={styles.notStarted}>
              <FileText size={16} /> Chưa làm
            </span>
          )}
        </div>
        {state === 'IN_PROGRESS' ? (
          <Link href={examHref(set, 'EXAM_SIMULATION')} className={styles.cardAction}>
            Tiếp tục <ArrowRight size={16} />
          </Link>
        ) : (
          <StartExamDialog set={set} label={state === 'COMPLETED' ? 'Làm lại' : 'Làm đề'} />
        )}
      </div>
    </article>
  );
}

export default function StudentExamsPage() {
  const [category, setCategory] = React.useState<Category>('ALL');
  const [attemptsReady, setAttemptsReady] = React.useState(false);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => setAttemptsReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const attemptsBySet = React.useMemo(() => {
    if (!attemptsReady) return {} as Record<string, StudentAssessmentAttempt[]>;
    const examAttempts = getStudentExperienceState().attempts.filter(
      (attempt) => attempt.kind === 'exam'
    );
    return Object.fromEntries(
      EXAM_SETS.map((set) => [
        set.id,
        examAttempts
          .filter((attempt) => attempt.activityId === set.id)
          .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt)),
      ])
    ) as Record<string, StudentAssessmentAttempt[]>;
  }, [attemptsReady]);

  const featuredSet = EXAM_SETS.find((set) => set.status === 'IN_PROGRESS');
  const visibleSets = EXAM_SETS.filter((set) => matchesCategory(set, category)).filter(
    (set) => category !== 'ALL' || set.id !== featuredSet?.id
  );

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>TOÁN · LUYỆN THI</p>
          <h1>Luyện thi</h1>
          <p>Chọn đề phù hợp và bắt đầu.</p>
        </div>
        <HeaderArtwork />
      </header>
      {featuredSet && <ResumeExam set={featuredSet} />}
      <nav className={styles.filters} aria-label="Lọc bài thi theo phạm vi">
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCategory(item.id)}
            aria-pressed={category === item.id}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <section className={styles.library} aria-labelledby="exam-library-title">
        <div className={styles.libraryHeader}>
          <h2 id="exam-library-title">
            {category === 'ALL'
              ? 'Thư viện đề thi'
              : CATEGORIES.find((item) => item.id === category)?.label}
          </h2>
          <p>{visibleSets.length} đề</p>
        </div>
        <div className={styles.examGrid} key={category}>
          {visibleSets.map((set) => (
            <ExamCard key={set.id} set={set} attempts={attemptsBySet[set.id] ?? []} />
          ))}
        </div>
      </section>
    </main>
  );
}
