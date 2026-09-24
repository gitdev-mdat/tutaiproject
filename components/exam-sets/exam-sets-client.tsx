'use client';

import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Landmark,
  Layers3,
  ListChecks,
  LockKeyhole,
  Search,
  Sparkles,
  Target,
  FileCheck,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CURRICULUM_CHAPTERS,
  CURRICULUM_EXAM_SETS,
  SEMESTER_COLLECTIONS,
} from '@/lib/exam-sets/curriculum-data';
import {
  getBrowseDisplayLimits,
  getNextBatchCount,
  getNextVisibleCount,
  getRegularCollectionTitle,
  isNewRelease,
  matchesActiveExamFilter,
  partitionExamSets,
} from '@/lib/exam-sets/browse-results';
import {
  getCuratedShelfMaxIndex,
  getCuratedShelfPageSize,
  getNextCuratedShelfIndex,
  hasCuratedShelfNavigation,
} from '@/lib/exam-sets/curated-shelf';
import type {
  CurriculumChapter,
  CurriculumExamSet,
  CurriculumLesson,
  ExamSetScope,
  SubjectId,
  ExamSessionMode,
} from '@/lib/exam-sets/types';
import { ALL_SUBJECTS, SUBJECT_LABELS } from '@/lib/exam-sets/types';

import styles from './exam-sets-client.module.css';

const SUBJECT_QUERY: Record<SubjectId, string> = {
  MATH: 'math',
  PHYSICS: 'physics',
  CHEMISTRY: 'chemistry',
  BIOLOGY: 'biology',
};

const QUERY_SUBJECT = Object.fromEntries(
  Object.entries(SUBJECT_QUERY).map(([subject, query]) => [query, subject])
) as Record<string, SubjectId>;

const SCOPE_QUERY: Record<ExamSetScope, string> = {
  LESSON: 'lesson',
  CHAPTER: 'chapter',
  SEMESTER: 'semester',
  NATIONAL: 'national',
};

const QUERY_SCOPE = Object.fromEntries(
  Object.entries(SCOPE_QUERY).map(([scope, query]) => [query, scope])
) as Record<string, ExamSetScope>;

const SCOPE_OPTIONS: Array<{ value: ExamSetScope; label: string; icon: LucideIcon }> = [
  { value: 'LESSON', label: 'Theo bài', icon: FileText },
  { value: 'CHAPTER', label: 'Theo chương', icon: Layers3 },
  { value: 'SEMESTER', label: 'Theo học kỳ', icon: CalendarDays },
  { value: 'NATIONAL', label: 'THPT Quốc gia', icon: Landmark },
];

type CollectionKind = 'CURATED' | 'REGULAR';

type ExamPresentation = {
  title?: string;
  summary?: string;
  relevanceLabel?: string;
  icon?: LucideIcon;
};

type ExamRecommendation = {
  examSet: CurriculumExamSet;
  title: string;
  summary: string;
  isNew: boolean;
  isFeatured: boolean;
  relevanceLabel?: string;
  icon: LucideIcon;
};

type ExamCollectionModel = {
  kind: CollectionKind;
  title: string;
  description?: string;
  icon: LucideIcon;
  items: ExamRecommendation[];
  previewLimit: number;
  batchSize: number;
};

const COMPACT_RESULTS_QUERY = '(max-width: 1080px)';
const MOBILE_RESULTS_QUERY = '(max-width: 760px)';

function subscribeToCompactResults(onChange: () => void): () => void {
  const mediaQuery = window.matchMedia(COMPACT_RESULTS_QUERY);
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
}

function getCompactResultsSnapshot(): boolean {
  return window.matchMedia(COMPACT_RESULTS_QUERY).matches;
}

function subscribeToMobileResults(onChange: () => void): () => void {
  const mediaQuery = window.matchMedia(MOBILE_RESULTS_QUERY);
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
}

function getMobileResultsSnapshot(): boolean {
  return window.matchMedia(MOBILE_RESULTS_QUERY).matches;
}

const EXAM_PRESENTATION: Record<string, ExamPresentation> = {
  'national-structure-01': {
    title: 'Đề minh hoạ tháng 8',
    summary: 'Bám cấu trúc THPT Quốc gia 2026',
    icon: FileText,
  },
  'national-structure-02': {
    title: 'Phân bổ thời gian',
    summary: 'Luyện thứ tự làm bài và kiểm soát thời gian theo từng phần',
    relevanceLabel: 'Ôn trọng tâm',
    icon: Clock3,
  },
  'national-simulation-01': {
    title: 'Cập nhật cấu trúc 2026',
    summary: 'Luyện nhịp làm bài theo cấu trúc thi mới',
    icon: Target,
  },
  'national-simulation-02': {
    title: 'Full đề 50 câu · 90 phút',
    summary: 'Mô phỏng kỳ thi THPT Quốc gia trong điều kiện thời gian thật',
    relevanceLabel: 'Mô phỏng kỳ thi',
    icon: Landmark,
  },
  'national-simulation-special': {
    title: 'Đề phân loại 9+',
    summary: 'Có nhóm câu phân loại thường tạo khoảng cách ở vùng điểm 8–9+.',
    relevanceLabel: 'Dạng phân loại',
    icon: Sparkles,
  },
  'national-simulation-special-realism': {
    summary: 'Nhịp độ và cách phân bố câu hỏi gần với kỳ thi chính thức.',
    relevanceLabel: 'Sát cấu trúc thi thật',
    icon: Target,
  },
  'national-simulation-special-rare': {
    summary: 'Có những dạng ít gặp nhưng vẫn nằm trong cấu trúc thi.',
    relevanceLabel: 'Dạng bài hiếm',
    icon: Sparkles,
  },
};

function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .trim();
}

function recommendationFor(examSet: CurriculumExamSet): ExamRecommendation {
  const presentation = EXAM_PRESENTATION[examSet.id];
  return {
    examSet,
    title: presentation?.title ?? examSet.title,
    summary: presentation?.summary ?? examSet.description,
    isNew: isNewRelease(examSet),
    isFeatured: Boolean(examSet.isFeatured),
    relevanceLabel: presentation?.relevanceLabel,
    icon: presentation?.icon ?? (examSet.tier === 'SPECIAL' ? Sparkles : BookOpen),
  };
}

function buildCollections(
  examSets: CurriculumExamSet[],
  scope: ExamSetScope,
  displayLimits: ReturnType<typeof getBrowseDisplayLimits>,
  contextLabel?: string
): ExamCollectionModel[] {
  const { curated, regular } = partitionExamSets(examSets);
  let hasFeaturedCuratedItem = false;
  const curatedItems = curated.map((examSet) => {
    const item = recommendationFor(examSet);
    const isFeatured = item.isFeatured && !hasFeaturedCuratedItem;
    hasFeaturedCuratedItem ||= isFeatured;
    return { ...item, isFeatured };
  });
  const regularItems = regular.map(recommendationFor);
  const collections: ExamCollectionModel[] = [];

  if (curatedItems.length > 0) {
    collections.push({
      kind: 'CURATED',
      title: 'Tú Tài tuyển chọn',
      description:
        'Những bộ đề Tú Tài chỉ giữ lại khi chúng thực sự đáng để em dành thời gian luyện.',
      icon: Sparkles,
      items: curatedItems,
      previewLimit: displayLimits.curated,
      batchSize: displayLimits.curated,
    });
  }

  if (regularItems.length > 0) {
    collections.push({
      kind: 'REGULAR',
      title: getRegularCollectionTitle(scope, contextLabel),
      icon: scope === 'NATIONAL' ? Target : BookOpen,
      items: regularItems,
      previewLimit: displayLimits.regular,
      batchSize: displayLimits.regular,
    });
  }

  return collections;
}

function matchesSearch(item: ExamRecommendation, search: string): boolean {
  if (!search) return true;
  return normalized(
    `${item.title} ${item.summary} ${item.examSet.title} ${item.examSet.description} ${
      item.relevanceLabel ?? ''
    }`
  ).includes(search);
}

type ExamActionDialog = 'COMPLETED' | 'LIMIT' | 'PLUS' | 'ERROR' | 'SELECT_MODE' | null;

function ExamAction({
  examSet,
  isAuthenticated,
  hasPlus,
  className,
  label = 'Luyện ngay',
}: {
  examSet: CurriculumExamSet;
  isAuthenticated: boolean;
  hasPlus: boolean;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dialog, setDialog] = useState<ExamActionDialog>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isRestart, setIsRestart] = useState(false);
  const isSpecial = examSet.tier === 'SPECIAL';
  const isLocked = isSpecial && !hasPlus;
  const source = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ''}`;
  const practicePath = `/exam-sets/${examSet.slug}/practice?source=${encodeURIComponent(source)}`;
  const loginUrl = `/auth/login?intent=practice&exam=${encodeURIComponent(
    examSet.slug
  )}&source=${encodeURIComponent(source)}&returnTo=${encodeURIComponent(practicePath)}`;

  async function startExam(mode: ExamSessionMode) {
    if (!isAuthenticated) {
      router.push(loginUrl);
      return;
    }
    if (isLocked) {
      setDialog('PLUS');
      return;
    }

    setIsStarting(true);
    try {
      const response = await fetch('/api/exam-sets/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: examSet.slug, source, restart: isRestart, mode }),
      });
      const data = (await response.json()) as {
        code?: string;
        destination?: string;
        loginUrl?: string;
      };

      if (data.code === 'AUTH_REQUIRED' && data.loginUrl) {
        router.push(data.loginUrl);
      } else if (data.code === 'FREE_LIMIT_REACHED') {
        setDialog('LIMIT');
      } else if (data.code === 'PLUS_REQUIRED') {
        setDialog('PLUS');
      } else if (data.code === 'START' && data.destination) {
        router.push(data.destination);
      } else {
        setDialog('ERROR');
      }
    } catch {
      setDialog('ERROR');
    } finally {
      setIsStarting(false);
    }
  }

  function handleAction() {
    if (!isAuthenticated) {
      router.push(loginUrl);
    } else if (isLocked) {
      setDialog('PLUS');
    } else if (examSet.status === 'COMPLETED') {
      setIsRestart(true);
      setDialog('COMPLETED');
    } else {
      setIsRestart(false);
      setDialog('SELECT_MODE');
    }
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.examAction} ${className ?? ''}`}
        onClick={handleAction}
        disabled={isStarting}
        aria-busy={isStarting}
        aria-label={`${label}: ${examSet.title}`}
      >
        {isLocked ? <LockKeyhole size={13} aria-hidden="true" /> : null}
        {isStarting ? 'Đang mở…' : label}
        {!isLocked ? <ArrowRight size={13} aria-hidden="true" /> : null}
      </button>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent
          className={styles.actionDialog}
          style={dialog === 'SELECT_MODE' ? { maxWidth: '720px', width: '92vw' } : undefined}
          showCloseButton={false}
        >
          {dialog === 'COMPLETED' ? (
            <>
              <DialogHeader>
                <DialogTitle>Em đã hoàn thành bài luyện này.</DialogTitle>
                <DialogDescription>
                  Em có thể làm lại để luyện phản xạ hoặc xem kết quả đã lưu.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.dialogSecondary}
                  onClick={() => router.push(`/exam-sets/${examSet.slug}/results`)}
                >
                  Xem kết quả
                </button>
                <button
                  type="button"
                  className={styles.dialogPrimary}
                  onClick={() => setDialog('SELECT_MODE')}
                  disabled={isStarting}
                >
                  {isStarting ? 'Đang mở…' : 'Làm lại'}
                </button>
              </DialogFooter>
            </>
          ) : null}

          {dialog === 'LIMIT' ? (
            <>
              <DialogHeader>
                <DialogTitle>Hôm nay em đã luyện đủ số đề miễn phí.</DialogTitle>
                <DialogDescription>
                  Mai quay lại để tiếp tục luyện, hoặc nâng cấp Tú Tài Plus để luyện không giới hạn.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className={styles.dialogActions}>
                <DialogClose className={styles.dialogSecondary}>Mai em quay lại</DialogClose>
                <Link className={styles.dialogPrimary} href="/pricing">
                  Khám phá Tú Tài Plus
                </Link>
              </DialogFooter>
            </>
          ) : null}

          {dialog === 'PLUS' ? (
            <>
              <DialogHeader>
                <p className={styles.dialogEyebrow}>TÚ TÀI PLUS</p>
                <DialogTitle>Mở khóa bộ đề tuyển chọn.</DialogTitle>
                <DialogDescription>
                  Luyện các cách hỏi, dữ kiện và tình huống ít gặp để sẵn sàng cho phòng thi.
                </DialogDescription>
              </DialogHeader>
              <ul className={styles.plusBenefits}>
                <li>
                  <CheckCircle2 size={16} aria-hidden="true" /> Toàn bộ đề tuyển chọn
                </li>
                <li>
                  <CheckCircle2 size={16} aria-hidden="true" /> Luyện không giới hạn
                </li>
                <li>
                  <CheckCircle2 size={16} aria-hidden="true" /> Phân tích kết quả chi tiết
                </li>
              </ul>
              <DialogFooter className={styles.dialogActions}>
                <DialogClose className={styles.dialogSecondary}>Để sau</DialogClose>
                <Link className={styles.dialogPrimary} href="/pricing">
                  Khám phá Tú Tài Plus
                </Link>
              </DialogFooter>
            </>
          ) : null}

          {dialog === 'ERROR' ? (
            <>
              <DialogHeader>
                <DialogTitle>Chưa thể mở bài luyện lúc này</DialogTitle>
                <DialogDescription>
                  Kết nối vừa gián đoạn. Em thử lại một lần nữa nhé.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className={styles.dialogActions}>
                <DialogClose className={styles.dialogSecondary}>Đóng</DialogClose>
                <button
                  type="button"
                  className={styles.dialogPrimary}
                  onClick={() => void startExam('PRACTICE')}
                >
                  Thử lại
                </button>
              </DialogFooter>
            </>
          ) : null}

          {dialog === 'SELECT_MODE' ? (
            <>
              <DialogHeader>
                <DialogTitle
                  style={{ fontSize: 22, fontWeight: 750, color: '#0F172A', marginBottom: 8 }}
                >
                  Em muốn làm đề theo cách nào?
                </DialogTitle>
                <DialogDescription style={{ fontSize: 15, color: '#64748B', marginBottom: 24 }}>
                  Chọn cách phù hợp với mục tiêu của em lúc này.
                </DialogDescription>
              </DialogHeader>

              <div className={styles.modeSelectGrid}>
                {/* Luyện tập */}
                <div className={`${styles.modeCard} ${styles.modeCardPractice}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ background: '#F0F5FF', padding: 10, borderRadius: 12 }}>
                      <BookOpen size={22} color="#1768FF" />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 750, color: '#0F172A', margin: 0 }}>
                      Luyện tập
                    </h3>
                  </div>
                  <p style={{ fontSize: 14, color: '#475569', marginBottom: 16, fontWeight: 500 }}>
                    Học đến đâu, kiểm tra đến đó.
                  </p>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: '0 0 24px 0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      flex: 1,
                    }}
                  >
                    <li
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        fontSize: 13.5,
                        color: '#334155',
                      }}
                    >
                      <CheckCircle2
                        size={16}
                        color="#1768FF"
                        style={{ flexShrink: 0, marginTop: 2 }}
                      />
                      <span>Xem đáp án từng câu</span>
                    </li>
                    <li
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        fontSize: 13.5,
                        color: '#334155',
                      }}
                    >
                      <CheckCircle2
                        size={16}
                        color="#1768FF"
                        style={{ flexShrink: 0, marginTop: 2 }}
                      />
                      <span>Có lời giải sau khi kiểm tra</span>
                    </li>
                    <li
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        fontSize: 13.5,
                        color: '#334155',
                      }}
                    >
                      <CheckCircle2
                        size={16}
                        color="#1768FF"
                        style={{ flexShrink: 0, marginTop: 2 }}
                      />
                      <span>Thoải mái sửa lại ngay</span>
                    </li>
                  </ul>
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: 12,
                      color: '#0F172A',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    onClick={() => void startExam('PRACTICE')}
                    disabled={isStarting}
                  >
                    {isStarting ? 'Đang mở…' : 'Bắt đầu luyện'}
                  </button>
                </div>

                {/* Mô phỏng kỳ thi */}
                <div className={`${styles.modeCard} ${styles.modeCardSimulation}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ background: '#1E40AF', padding: 10, borderRadius: 12 }}>
                      <FileCheck size={22} color="#FFFFFF" />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 750, color: '#1E3A8A', margin: 0 }}>
                      Mô phỏng kỳ thi
                    </h3>
                  </div>
                  <p style={{ fontSize: 14, color: '#1E3A8A', marginBottom: 16, fontWeight: 600 }}>
                    Làm trọn đề như trong phòng thi thật.
                  </p>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: '0 0 24px 0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      flex: 1,
                    }}
                  >
                    <li
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        fontSize: 13.5,
                        color: '#1E40AF',
                      }}
                    >
                      <CheckCircle2
                        size={16}
                        color="#1E40AF"
                        style={{ flexShrink: 0, marginTop: 2 }}
                      />
                      <span>90 phút làm bài</span>
                    </li>
                    <li
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        fontSize: 13.5,
                        color: '#1E40AF',
                      }}
                    >
                      <CheckCircle2
                        size={16}
                        color="#1E40AF"
                        style={{ flexShrink: 0, marginTop: 2 }}
                      />
                      <span>Không xem đáp án khi đang làm</span>
                    </li>
                    <li
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        fontSize: 13.5,
                        color: '#1E40AF',
                      }}
                    >
                      <CheckCircle2
                        size={16}
                        color="#1E40AF"
                        style={{ flexShrink: 0, marginTop: 2 }}
                      />
                      <span>Chấm sau khi nộp bài</span>
                    </li>
                  </ul>
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#1768FF',
                      border: 'none',
                      borderRadius: 12,
                      color: '#FFFFFF',
                      fontSize: 14,
                      fontWeight: 750,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(23,104,255,0.25)',
                    }}
                    onClick={() => void startExam('EXAM_SIMULATION')}
                    disabled={isStarting}
                  >
                    {isStarting ? 'Đang mở…' : 'Bắt đầu mô phỏng'}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExamFilters({
  subject,
  scope,
  searchInput,
  onSubjectChange,
  onScopeChange,
  onSearchChange,
}: {
  subject: SubjectId;
  scope: ExamSetScope;
  searchInput: string;
  onSubjectChange: (subject: SubjectId) => void;
  onScopeChange: (scope: ExamSetScope) => void;
  onSearchChange: (value: string) => void;
}) {
  return (
    <>
      <div className={styles.subjectBar}>
        <div className={styles.subjectControls}>
          <span className={styles.controlLabel}>Môn học</span>
          <div className={styles.subjectTabs} role="tablist" aria-label="Chọn môn học">
            {ALL_SUBJECTS.map((subjectId) => (
              <button
                key={subjectId}
                type="button"
                role="tab"
                aria-selected={subject === subjectId}
                className={subject === subjectId ? styles.activeSubject : ''}
                onClick={() => onSubjectChange(subjectId)}
              >
                {SUBJECT_LABELS[subjectId]}
              </button>
            ))}
          </div>
        </div>

        <label className={styles.searchBox}>
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Tìm trong phạm vi đang chọn</span>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Tìm trong phạm vi…"
          />
        </label>
      </div>

      <div className={styles.scopeArea} id="scope-filters">
        <span className={styles.controlLabel}>Chọn phạm vi</span>
        <div className={styles.scopeTabs} role="tablist" aria-label="Chọn phạm vi luyện tập">
          {SCOPE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = scope === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={isActive ? styles.activeScope : ''}
                onClick={() => onScopeChange(option.value)}
              >
                <Icon size={18} aria-hidden="true" />
                <strong>{option.label}</strong>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function SubScopeSelector({
  label,
  options,
  selectedId,
  onSelect,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  if (options.length === 0) return null;

  return (
    <div className={styles.subScopeRow}>
      <span className={styles.subScopeLabel}>{label}</span>
      <div className={styles.subScopeOptions} role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={selectedId === option.id}
            className={selectedId === option.id ? styles.activeSubScope : ''}
            onClick={() => onSelect(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ExamCard({
  item,
  variant,
  isAuthenticated,
  hasPlus,
}: {
  item: ExamRecommendation;
  variant: 'regular' | 'plus';
  isAuthenticated: boolean;
  hasPlus: boolean;
}) {
  const Icon = item.icon;
  const isPlus = variant === 'plus';
  const badge = isPlus ? 'TÚ TÀI PLUS' : item.isNew ? 'MỚI' : item.relevanceLabel;
  const cardRef = useRef<HTMLElement>(null);
  const [featuredEntranceActive, setFeaturedEntranceActive] = useState(false);

  useEffect(() => {
    const card = cardRef.current;
    if (!item.isFeatured || !card || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setFeaturedEntranceActive(true);
        observer.disconnect();
      },
      { threshold: 0.55 }
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, [item.isFeatured]);

  return (
    <article
      ref={cardRef}
      className={`${styles.examCard} ${isPlus ? styles.plusCard : ''}`}
      data-variant={variant}
      data-featured={item.isFeatured || undefined}
      data-featured-entrance={featuredEntranceActive || undefined}
      onAnimationEnd={() => {
        if (featuredEntranceActive) setFeaturedEntranceActive(false);
      }}
    >
      <div className={styles.cardIcon} aria-hidden="true">
        <Icon size={25} strokeWidth={1.9} />
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardTitleRow}>
          <h3>{item.title}</h3>
          {badge ? (
            <span
              className={
                isPlus ? styles.plusBadge : item.isNew ? styles.newBadge : styles.relevanceBadge
              }
            >
              {badge}
            </span>
          ) : null}
        </div>
        <p>{item.summary}</p>
        <div className={styles.cardBottom}>
          <span className={styles.compactMeta}>
            <ListChecks size={13} aria-hidden="true" /> {item.examSet.questionCount} câu
            <span aria-hidden="true">·</span>
            <Clock3 size={13} aria-hidden="true" /> {item.examSet.durationMinutes} phút
          </span>
          <ExamAction
            examSet={item.examSet}
            isAuthenticated={isAuthenticated}
            hasPlus={hasPlus}
            className={isPlus ? styles.plusAction : undefined}
            label={isPlus && !hasPlus ? 'Mở với Plus' : 'Luyện ngay'}
          />
        </div>
      </div>
    </article>
  );
}

function ExamCollection({
  collection,
  isAuthenticated,
  hasPlus,
  isCompact,
  isMobile,
}: {
  collection: ExamCollectionModel;
  isAuthenticated: boolean;
  hasPlus: boolean;
  isCompact: boolean;
  isMobile: boolean;
}) {
  const Icon = collection.icon;
  const [visibleCount, setVisibleCount] = useState(collection.previewLimit);
  const [shelfIndex, setShelfIndex] = useState(0);
  const shelfViewportRef = useRef<HTMLDivElement>(null);
  const shelfTrackRef = useRef<HTMLDivElement>(null);
  const visibleItems =
    collection.kind === 'CURATED' ? collection.items : collection.items.slice(0, visibleCount);
  const hasMore = collection.kind === 'REGULAR' && visibleCount < collection.items.length;
  const nextBatchCount = getNextBatchCount(
    visibleCount,
    collection.items.length,
    collection.batchSize
  );
  const usesCuratedShelf =
    collection.kind === 'CURATED' && hasCuratedShelfNavigation(collection.items.length);
  const shelfPageSize = getCuratedShelfPageSize(isCompact, isMobile);
  const shelfMaxIndex = getCuratedShelfMaxIndex(collection.items.length, shelfPageSize);

  function moveCuratedShelf(direction: -1 | 1): void {
    const nextIndex = getNextCuratedShelfIndex(
      shelfIndex,
      direction,
      collection.items.length,
      shelfPageSize
    );
    const nextCard = shelfTrackRef.current?.children.item(nextIndex) as HTMLElement | null;

    setShelfIndex(nextIndex);
    shelfViewportRef.current?.scrollTo({ left: nextCard?.offsetLeft ?? 0 });
  }

  function syncCuratedShelfIndex(): void {
    const viewport = shelfViewportRef.current;
    const track = shelfTrackRef.current;
    if (!viewport || !track) return;

    const cards = Array.from(track.children) as HTMLElement[];
    const closestIndex = cards.reduce((closest, card, index) => {
      const closestDistance = Math.abs(cards[closest].offsetLeft - viewport.scrollLeft);
      const cardDistance = Math.abs(card.offsetLeft - viewport.scrollLeft);
      return cardDistance < closestDistance ? index : closest;
    }, 0);
    const nextIndex = Math.min(closestIndex, shelfMaxIndex);
    setShelfIndex((current) => (current === nextIndex ? current : nextIndex));
  }

  return (
    <section className={styles.examCollection} aria-labelledby={`collection-${collection.kind}`}>
      <header className={styles.collectionHeader}>
        <div className={styles.collectionHeadingBlock}>
          <div className={styles.collectionTitleLine}>
            <span className={styles.collectionIcon} aria-hidden="true">
              <Icon size={19} />
            </span>
            <h2 id={`collection-${collection.kind}`}>{collection.title}</h2>
            {collection.kind === 'REGULAR' ? (
              <span className={styles.collectionCount}>{collection.items.length} bộ đề</span>
            ) : null}
          </div>
          {collection.description ? <p>{collection.description}</p> : null}
        </div>
      </header>

      {usesCuratedShelf ? (
        <div className={styles.curatedShelf}>
          <div
            ref={shelfViewportRef}
            className={styles.curatedShelfViewport}
            role="region"
            aria-label="Danh sách bộ đề Tú Tài tuyển chọn"
            onScroll={syncCuratedShelfIndex}
          >
            <div ref={shelfTrackRef} className={styles.curatedShelfTrack}>
              {collection.items.map((item) => (
                <ExamCard
                  key={item.examSet.id}
                  item={item}
                  variant="plus"
                  isAuthenticated={isAuthenticated}
                  hasPlus={hasPlus}
                />
              ))}
            </div>
          </div>

          {!isMobile ? (
            <>
              <button
                type="button"
                className={`${styles.shelfArrow} ${styles.shelfArrowPrevious}`}
                onClick={() => moveCuratedShelf(-1)}
                disabled={shelfIndex === 0}
                aria-label="Xem đề tuyển chọn trước"
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`${styles.shelfArrow} ${styles.shelfArrowNext}`}
                onClick={() => moveCuratedShelf(1)}
                disabled={shelfIndex >= shelfMaxIndex}
                aria-label="Xem đề tuyển chọn tiếp theo"
              >
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {visibleItems.map((item) => (
            <ExamCard
              key={item.examSet.id}
              item={item}
              variant={item.examSet.access === 'PLUS' ? 'plus' : 'regular'}
              isAuthenticated={isAuthenticated}
              hasPlus={hasPlus}
            />
          ))}
        </div>
      )}

      {collection.kind === 'REGULAR' && hasMore ? (
        <div className={styles.loadMoreRow}>
          <button
            type="button"
            className={styles.loadMore}
            onClick={() =>
              setVisibleCount((current) =>
                getNextVisibleCount(current, collection.items.length, collection.batchSize)
              )
            }
            aria-label={`Xem thêm ${nextBatchCount} bộ đề trong ${collection.title}`}
          >
            Xem thêm {nextBatchCount} đề <ChevronDown size={15} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

function EmptyState({ search, onChooseAnother }: { search: boolean; onChooseAnother: () => void }) {
  return (
    <div className={styles.emptyState} role="status">
      <Search size={24} aria-hidden="true" />
      <strong>
        {search
          ? 'Không tìm thấy bộ đề trong phạm vi này.'
          : 'Chưa có bộ đề phù hợp với phạm vi này.'}
      </strong>
      <p>
        {search
          ? 'Thử một từ khóa ngắn hơn hoặc chọn phạm vi khác.'
          : 'Tú Tài đang tiếp tục cập nhật bộ đề mới.'}
      </p>
      <button type="button" onClick={onChooseAnother}>
        Chọn phạm vi khác
      </button>
    </div>
  );
}

export function ExamSetsClient({
  isAuthenticated,
  hasPlus,
}: {
  isAuthenticated: boolean;
  hasPlus: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const subject = QUERY_SUBJECT[searchParams.get('subject') ?? ''] ?? 'MATH';
  const scope = QUERY_SCOPE[searchParams.get('scope') ?? ''] ?? 'NATIONAL';
  const [searchInput, setSearchInput] = useState('');
  const search = normalized(searchInput);
  const isCompactResults = useSyncExternalStore(
    subscribeToCompactResults,
    getCompactResultsSnapshot,
    () => false
  );
  const isMobileResults = useSyncExternalStore(
    subscribeToMobileResults,
    getMobileResultsSnapshot,
    () => false
  );
  const displayLimits = getBrowseDisplayLimits(isCompactResults);

  const subjectExamSets = useMemo(
    () =>
      CURRICULUM_EXAM_SETS.filter(
        (examSet) => examSet.subjectId === subject && examSet.grade === 12
      ),
    [subject]
  );
  const subjectChapters = CURRICULUM_CHAPTERS.filter(
    (chapter) => chapter.subjectId === subject && chapter.grade === 12
  );

  const chapterOptions = subjectChapters.filter((chapter) =>
    subjectExamSets.some(
      (examSet) =>
        examSet.scope === scope &&
        examSet.chapterId === chapter.id &&
        (scope !== 'LESSON' || Boolean(examSet.lessonId))
    )
  );
  const requestedChapterId = searchParams.get('chapter') ?? undefined;
  const selectedChapter =
    chapterOptions.find((chapter) => chapter.id === requestedChapterId) ?? chapterOptions[0];

  const lessonOptions: CurriculumLesson[] =
    scope === 'LESSON' && selectedChapter
      ? selectedChapter.lessons.filter((lesson) =>
          subjectExamSets.some(
            (examSet) => examSet.scope === 'LESSON' && examSet.lessonId === lesson.id
          )
        )
      : [];
  const requestedLessonId = searchParams.get('lesson') ?? undefined;
  const selectedLesson =
    lessonOptions.find((lesson) => lesson.id === requestedLessonId) ?? lessonOptions[0];

  const semesterOptions = SEMESTER_COLLECTIONS.filter(
    (semester) =>
      semester.subjectId === subject &&
      semester.grade === 12 &&
      subjectExamSets.some(
        (examSet) => examSet.scope === 'SEMESTER' && examSet.semester === semester.semester
      )
  );
  const requestedSemester = Number(searchParams.get('semester'));
  const selectedSemester =
    semesterOptions.find((semester) => semester.semester === requestedSemester) ??
    semesterOptions[0];

  const activeUniverse = subjectExamSets.filter((examSet) =>
    matchesActiveExamFilter(examSet, {
      subjectId: subject,
      grade: 12,
      scope,
      chapterId: selectedChapter?.id,
      lessonId: selectedLesson?.id,
      semester: selectedSemester?.semester,
    })
  );
  const searchedUniverse = activeUniverse.filter((examSet) =>
    matchesSearch(recommendationFor(examSet), search)
  );
  const contextLabel =
    scope === 'CHAPTER'
      ? selectedChapter?.shortTitle
      : scope === 'LESSON'
        ? selectedLesson?.title
        : scope === 'SEMESTER'
          ? selectedSemester?.title
          : 'THPT Quốc gia';
  const visibleCollections = buildCollections(searchedUniverse, scope, displayLimits, contextLabel);
  const progressiveResetKey = [
    subject,
    scope,
    selectedChapter?.id,
    selectedLesson?.id,
    selectedSemester?.semester,
    search,
    isCompactResults ? 'compact' : 'desktop',
    isMobileResults ? 'mobile' : 'wide',
  ]
    .filter(Boolean)
    .join(':');

  function updateQuery(
    changes: Record<string, string | undefined>,
    clearKeys: string[] = []
  ): void {
    const next = new URLSearchParams(searchParams.toString());
    clearKeys.forEach((key) => next.delete(key));
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function changeSubject(nextSubject: SubjectId) {
    setSearchInput('');
    updateQuery({ subject: SUBJECT_QUERY[nextSubject], scope: SCOPE_QUERY[scope] }, [
      'chapter',
      'lesson',
      'semester',
    ]);
  }

  function changeScope(nextScope: ExamSetScope) {
    setSearchInput('');
    updateQuery({ subject: SUBJECT_QUERY[subject], scope: SCOPE_QUERY[nextScope] }, [
      'chapter',
      'lesson',
      'semester',
    ]);
  }

  function changeChapter(chapterId: string) {
    setSearchInput('');
    updateQuery({ chapter: chapterId }, ['lesson']);
  }

  function chooseAnotherScope() {
    setSearchInput('');
    document
      .getElementById('scope-filters')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const resultContext = [
    SUBJECT_LABELS[subject],
    SCOPE_OPTIONS.find((option) => option.value === scope)?.label,
    scope === 'CHAPTER' || scope === 'LESSON' ? selectedChapter?.shortTitle : undefined,
    scope === 'LESSON' ? selectedLesson?.title : undefined,
    scope === 'SEMESTER' ? selectedSemester?.title : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="exam-sets-title">
        <h1 id="exam-sets-title">
          Bộ đề đặc biệt của <span>Tú Tài</span>
          <Sparkles className={styles.titleSparkle} size={28} aria-hidden="true" />
        </h1>
      </section>

      <section className={styles.browser} aria-label="Kho bộ đề Tú Tài">
        <ExamFilters
          subject={subject}
          scope={scope}
          searchInput={searchInput}
          onSubjectChange={changeSubject}
          onScopeChange={changeScope}
          onSearchChange={setSearchInput}
        />

        {scope === 'CHAPTER' || scope === 'LESSON' ? (
          <div className={styles.subScopeArea}>
            <SubScopeSelector
              label="Chọn chương"
              options={chapterOptions.map((chapter: CurriculumChapter) => ({
                id: chapter.id,
                label: chapter.shortTitle,
              }))}
              selectedId={selectedChapter?.id}
              onSelect={changeChapter}
            />
            {scope === 'LESSON' ? (
              <SubScopeSelector
                label="Chọn bài"
                options={lessonOptions.map((lesson) => ({ id: lesson.id, label: lesson.title }))}
                selectedId={selectedLesson?.id}
                onSelect={(lessonId) => {
                  setSearchInput('');
                  updateQuery({ chapter: selectedChapter?.id, lesson: lessonId });
                }}
              />
            ) : null}
          </div>
        ) : null}

        {scope === 'SEMESTER' ? (
          <div className={styles.subScopeArea}>
            <SubScopeSelector
              label="Chọn học kỳ"
              options={semesterOptions.map((semester) => ({
                id: String(semester.semester),
                label: semester.title,
              }))}
              selectedId={selectedSemester ? String(selectedSemester.semester) : undefined}
              onSelect={(semester) => {
                setSearchInput('');
                updateQuery({ semester });
              }}
            />
          </div>
        ) : null}

        <div className={styles.resultArea} role="tabpanel" aria-label={resultContext}>
          <div className={styles.resultContext}>
            <span>{resultContext}</span>
            <p>Đây là những lựa chọn phù hợp nhất với phạm vi em đang muốn luyện.</p>
          </div>

          {visibleCollections.length > 0 ? (
            <div className={styles.collections}>
              {visibleCollections.map((collection) => (
                <ExamCollection
                  key={`${progressiveResetKey}:${collection.kind}`}
                  collection={collection}
                  isAuthenticated={isAuthenticated}
                  hasPlus={hasPlus}
                  isCompact={isCompactResults}
                  isMobile={isMobileResults}
                />
              ))}
            </div>
          ) : (
            <EmptyState search={search.length > 0} onChooseAnother={chooseAnotherScope} />
          )}
        </div>
      </section>
    </div>
  );
}
