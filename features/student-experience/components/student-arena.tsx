'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Crown,
  Gift,
  Info,
  LockKeyhole,
  Medal,
  Sigma,
  Star,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CURRICULUM_EXAM_SETS } from '@/lib/exam-sets/curriculum-data';
import { studentAssessmentHref } from '../lib/assessment-links';
import { STUDENT_ARENA_EVENTS, STUDENT_HAS_PLUS } from '../lib/mock-data';
import {
  getStudentExperienceState,
  getInitialStudentExperienceState,
  registerForCompetition,
} from '../lib/student-experience-service';
import type { StudentCompetition, StudentExperienceState } from '../lib/types';
import styles from './student-arena.module.css';

type ArenaFilter = 'all' | 'live' | 'upcoming' | 'participated';
const dateTime = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
const filters: Array<{ value: ArenaFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'live', label: 'Đang diễn ra' },
  { value: 'upcoming', label: 'Sắp tới' },
  { value: 'participated', label: 'Đã tham gia' },
];

function formatCurrency(amount: number) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} đ`;
}
function formatCountdown(target: string, now: number, live: boolean, durationMinutes: number) {
  const distance = new Date(target).getTime() - now;
  if (distance <= 0) {
    // The seeded demo keeps `live` as the authoritative status even after its sample timestamp.
    return live ? `Còn ${Math.max(1, Math.round(durationMinutes * 0.72))} phút` : 'Sắp bắt đầu';
  }
  const minutes = Math.ceil(distance / 60_000);
  if (minutes < 60) return `Còn ${minutes} phút`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `Còn ${hours} giờ`;
  return `Còn ${Math.ceil(hours / 24)} ngày`;
}
function useNow() {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function RulesDialog({ event, dark = false }: { event: StudentCompetition; dark?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger className={dark ? styles.heroSecondary : styles.textAction}>
        Xem thể lệ
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thể lệ · {event.title}</DialogTitle>
          <DialogDescription>
            Thông tin cần biết trước khi em đăng ký và bắt đầu làm bài.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
            <div>
              <p className="text-slate-500">Thời lượng</p>
              <p className="mt-1 font-bold text-slate-900">{event.durationMinutes} phút</p>
            </div>
            <div>
              <p className="text-slate-500">Số câu</p>
              <p className="mt-1 font-bold text-slate-900">{event.questionCount} câu</p>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Cách xếp hạng</h3>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
              {event.rankingRules.map((rule) => (
                <li key={rule} className="flex gap-2">
                  <Check className="mt-1 size-4 shrink-0 text-blue-600" />
                  {rule}
                </li>
              ))}
              <li className="flex gap-2">
                <Check className="mt-1 size-4 shrink-0 text-blue-600" />
                Chỉ bài nộp trong thời gian sự kiện diễn ra mới được xếp hạng.
              </li>
            </ul>
          </div>
          {event.registrationDeadline && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Hạn đăng ký: <strong>{dateTime.format(new Date(event.registrationDeadline))}</strong>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ArenaAction({
  event,
  state,
  onRegister,
}: {
  event: StudentCompetition;
  state: StudentExperienceState;
  onRegister: (id: string) => void;
}) {
  const registered =
    event.initiallyRegistered === true || state.registeredCompetitionIds.includes(event.id);
  const set = CURRICULUM_EXAM_SETS.find((item) => item.slug === event.examSetSlug);
  if (event.eligibility === 'plus_required' && !STUDENT_HAS_PLUS)
    return (
      <Link
        href={`/pricing?source=student-arena&competition=${event.id}`}
        className={styles.primaryAction}
      >
        <LockKeyhole size={17} /> Nâng cấp Plus để tham gia
      </Link>
    );
  if (event.eligibility === 'not_eligible')
    return <span className={styles.disabledAction}>Chưa đủ điều kiện tham gia</span>;
  if (event.status === 'live' && registered && set)
    return (
      <Link
        href={studentAssessmentHref({
          set,
          kind: 'arena',
          source: '/student/arena',
          title: event.title,
          mode: 'EXAM_SIMULATION',
          rankingEligible: true,
          activityId: event.id,
        })}
        className={styles.primaryAction}
      >
        Vào phòng thi <ArrowRight size={16} />
      </Link>
    );
  if ((event.status === 'registration_open' || event.status === 'upcoming') && registered)
    return (
      <span className={styles.registered}>
        <Check size={16} /> Đã đăng ký
      </span>
    );
  if (event.status === 'registration_open')
    return (
      <Button onClick={() => onRegister(event.id)} className={styles.primaryButton}>
        Đăng ký tham gia
      </Button>
    );
  return <span className={styles.disabledAction}>Sắp mở đăng ký</span>;
}

function HeaderArtwork() {
  return (
    <div className={styles.headerArtwork} aria-hidden="true">
      <svg viewBox="0 0 560 150">
        <defs>
          <linearGradient id="mountainFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7EB1FF" stopOpacity=".25" />
            <stop offset="1" stopColor="#DDEAFF" stopOpacity=".08" />
          </linearGradient>
        </defs>
        <path d="M138 145 233 55l24 28 45-63 38 48 26-25 95 102Z" fill="url(#mountainFill)" />
        <path
          d="m148 145 85-90 24 29 45-64 38 49 26-25 88 101"
          fill="none"
          stroke="#94BFFF"
          strokeWidth="1.5"
          opacity=".4"
        />
        <path
          d="m233 55 19 38 20-16 30-57 9 65 29-16 13 44 13-69"
          fill="none"
          stroke="#8AB8FF"
          opacity=".32"
        />
        <path
          d="M303 18V92M303 19c15 5 22-7 36-1v25c-14-6-21 6-36 1"
          fill="none"
          stroke="#1463FF"
          strokeWidth="3"
          opacity=".68"
        />
        <path
          d="m312 26 5 8 5-8 2 14"
          fill="none"
          stroke="#1463FF"
          strokeWidth="1.6"
          opacity=".75"
        />
        <path d="M18 28h50M38 8v48M458 14h83M486 2v64" stroke="#ABC9F8" opacity=".18" />
      </svg>
      <span className={styles.handwritten}>
        Better Students
        <br />
        Brighter Tomorrows
      </span>
      <span className={styles.manifesto}>
        TRI THỨC
        <br />
        TẠO NÊN
        <br />
        NHỮNG NGƯỜI
        <br />
        PHI THƯỜNG
      </span>
    </div>
  );
}

function TrophyArtwork() {
  return (
    <div className={styles.trophyArtwork} aria-hidden="true">
      <svg viewBox="0 0 330 280">
        <g fill="none" stroke="#69A7FF" opacity=".15">
          <path d="M22 46h78M54 18v84M224 42h74M260 12v94" />
          <path d="M23 180h70M58 145v72M222 175h78M260 137v80" />
          <path d="m18 126 40-40 34 27M225 91l33-26 34 18" />
          <path d="M241 232h58M270 203v58" />
        </g>
        <g fill="#86B8FF" fontFamily="serif" opacity=".22">
          <text x="12" y="30" fontSize="20">
            ∫ x² dx
          </text>
          <text x="202" y="127" fontSize="18">
            a²+b²=c²
          </text>
        </g>
        <g stroke="#8FC0FF" strokeWidth="2.2" fill="none" opacity=".42">
          <path d="M112 42c-28 0-48 17-49 44-1 22 17 38 43 39M218 42c28 0 48 17 49 44 1 22-17 38-43 39" />
          <path
            d="M108 34h114v38c0 49-24 83-57 83s-57-34-57-83Z"
            fill="#2B66A7"
            fillOpacity=".34"
          />
          <path d="M165 155v32M133 189h64M119 207h92" />
          <path d="M104 217h122v28H104Z" fill="#153E70" fillOpacity=".7" />
          <path d="M88 246h154v27H88Z" fill="#102F58" fillOpacity=".8" />
          <path d="M105 69h120M122 47c10 27 23 43 43 43s34-16 43-43" />
        </g>
        <path d="M157 55h16l-4 12 10 7-14 1-8 11 1-14-10-7 13-2Z" fill="#BBD7FF" opacity=".65" />
        <text x="165" y="237" textAnchor="middle" fill="#83B5F8" fontSize="9" letterSpacing="3">
          KNOWLEDGE
        </text>
        <text x="165" y="259" textAnchor="middle" fill="#83B5F8" fontSize="8" letterSpacing="2.2">
          COMPETES · GROWS
        </text>
      </svg>
    </div>
  );
}

function PrizePanel({ event }: { event: StudentCompetition }) {
  const labels = ['Giải Nhất', 'Nhóm giải tiếp theo', 'Nhóm giải khuyến khích'];
  return (
    <aside className={styles.prizePanel}>
      <p>Tổng giải thưởng</p>
      <div className={styles.prizeTotal}>
        <Trophy size={26} /> {formatCurrency(event.prizePool)}
      </div>
      <div className={styles.prizeList}>
        {event.prizes.slice(0, 3).map((prize, index) => (
          <div className={styles.prizeRow} key={`${prize.rankFrom}-${prize.rankTo}`}>
            <span className={styles.medal}>
              <Medal size={22} />
            </span>
            <span className={styles.prizeCopy}>
              <strong>{labels[index]}</strong>
              <b>
                {formatCurrency(prize.amount)}
                {prize.rankTo > prize.rankFrom && <small> / giải</small>}
              </b>
            </span>
            <span className={styles.rankLabel}>
              Hạng {prize.rankFrom}
              {prize.rankTo > prize.rankFrom ? `–${prize.rankTo}` : ''}
            </span>
          </div>
        ))}
      </div>
      <div className={styles.prizeNote}>
        <Info size={14} /> Kết quả được xác minh trước khi trao giải
      </div>
    </aside>
  );
}

function EventCard({
  event,
  state,
  onRegister,
  now,
  index,
}: {
  event: StudentCompetition;
  state: StudentExperienceState;
  onRegister: (id: string) => void;
  now: number;
  index: number;
}) {
  const attempt = [...state.attempts]
    .reverse()
    .find((item) => item.kind === 'arena' && item.activityId === event.id);
  const reward = [...state.rewards].reverse().find((item) => item.sourceEventId === event.id);
  const isLive = event.status === 'live';
  const completed = event.status === 'completed';
  const countdown = !completed
    ? formatCountdown(
        isLive ? (event.endAt ?? event.startAt) : event.startAt,
        now,
        isLive,
        event.durationMinutes
      )
    : null;
  const score = attempt ? ((attempt.correct / attempt.total) * 10).toFixed(2) : null;
  return (
    <article
      className={styles.eventCard}
      style={{ '--delay': `${index * 65}ms` } as React.CSSProperties}
    >
      <div className={`${styles.eventIcon} ${isLive ? styles.eventIconLive : ''}`}>
        {completed ? <Trophy size={23} /> : <Swords size={23} />}
      </div>
      <div className={styles.eventDetails}>
        <div className={styles.eventTitleLine}>
          <h3>{event.title}</h3>
          {isLive && <span className={styles.liveBadge}>Đang diễn ra</span>}
        </div>
        <p>
          {event.subject.split(' · ')[0]} · {event.questionCount} câu · {event.durationMinutes} phút
        </p>
        {!completed && (
          <span className={styles.eventDate}>
            <CalendarDays size={13} /> {dateTime.format(new Date(event.startAt))}
          </span>
        )}
      </div>
      {completed && attempt?.competitiveResult ? (
        <div className={styles.achievementChips}>
          <span>
            <BarChart3 size={15} /> Hạng #{attempt.competitiveResult.rank}
          </span>
          <span>
            <Star size={15} /> Top {attempt.competitiveResult.percentile}%
          </span>
          {reward && (
            <span className={styles.rewardChip}>
              <Gift size={15} /> Phần thưởng: {reward.title}
            </span>
          )}
          {score && (
            <span>
              <Sigma size={15} /> {score} điểm
            </span>
          )}
        </div>
      ) : countdown ? (
        <span className={`${styles.countdown} ${isLive ? styles.countdownLive : ''}`}>
          <Clock3 size={15} /> {countdown}
        </span>
      ) : null}
      <div className={styles.eventActions}>
        {completed ? (
          <>
            <Link href={`/student/arena/${event.id}/results`} className={styles.textAction}>
              Xem kết quả
            </Link>
            <Link
              href={`/student/rankings?competition=${event.id}`}
              className={styles.outlineAction}
            >
              Bảng xếp hạng <ArrowRight size={15} />
            </Link>
          </>
        ) : (
          <>
            <RulesDialog event={event} />
            <ArenaAction event={event} state={state} onRegister={onRegister} />
          </>
        )}
      </div>
    </article>
  );
}

export function StudentArena() {
  const [state, setState] = React.useState(getInitialStudentExperienceState);
  const [filter, setFilter] = React.useState<ArenaFilter>('all');
  const now = useNow();
  React.useEffect(() => {
    const hydration = window.setTimeout(() => setState(getStudentExperienceState()), 0);
    return () => window.clearTimeout(hydration);
  }, []);
  const featured = STUDENT_ARENA_EVENTS.find((event) => event.featured)!;
  const groups = [
    {
      key: 'live' as const,
      title: 'Đang diễn ra',
      events: STUDENT_ARENA_EVENTS.filter((event) => !event.featured && event.status === 'live'),
    },
    {
      key: 'upcoming' as const,
      title: 'Sắp diễn ra',
      events: STUDENT_ARENA_EVENTS.filter(
        (event) =>
          !event.featured && ['upcoming', 'registration_open', 'registered'].includes(event.status)
      ),
    },
    {
      key: 'participated' as const,
      title: 'Đã tham gia',
      events: STUDENT_ARENA_EVENTS.filter(
        (event) => !event.featured && event.status === 'completed'
      ),
    },
  ];
  const visibleGroups = filter === 'all' ? groups : groups.filter((group) => group.key === filter);
  const register = (id: string) => setState(registerForCompetition(id));
  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.headerCopy}>
          <p className={styles.eyebrow}>ĐẤU TRƯỜNG</p>
          <h1>Đấu trường học thuật</h1>
          <p>Thi thử theo thời gian thực, cạnh tranh thứ hạng và chinh phục các mốc thành tích.</p>
        </div>
        <HeaderArtwork />
      </header>
      <nav className={styles.filterBar} aria-label="Lọc sự kiện đấu trường">
        <div className={styles.filters}>
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className={styles.subjectSelect}>
          <Sigma size={18} /> Toán <ChevronDown size={16} />
        </button>
      </nav>
      <section className={styles.featured} aria-labelledby="featured-title">
        <div className={styles.featuredInfo}>
          <div className={styles.heroBadges}>
            <span>Đang mở đăng ký</span>
            <span className={styles.plusBadge}>
              <Crown size={14} /> Dành cho Plus
            </span>
          </div>
          <p className={styles.featuredSubject}>{featured.subject}</p>
          <h2 id="featured-title">{featured.title}</h2>
          <p className={styles.featuredDescription}>{featured.description}</p>
          <div className={styles.heroMeta}>
            <span>
              <CalendarDays size={17} /> {dateTime.format(new Date(featured.startAt))}
            </span>
            <span>
              <Clock3 size={17} /> {featured.durationMinutes} phút · {featured.questionCount} câu
            </span>
            <span>
              <Users size={17} /> {featured.participantCount.toLocaleString('vi-VN')} đã quan tâm
            </span>
          </div>
          <div className={styles.heroActions}>
            <ArenaAction event={featured} state={state} onRegister={register} />
            <RulesDialog event={featured} dark />
          </div>
        </div>
        <TrophyArtwork />
        <PrizePanel event={featured} />
      </section>
      <div className={styles.eventGroups}>
        {visibleGroups.map((group, groupIndex) => (
          <section key={group.key} className={styles.eventSection}>
            <div className={styles.sectionHeader}>
              <h2>
                <span className={styles[group.key]} /> {group.title}
              </h2>
              {group.key === 'participated' ? (
                <Link href="/student/rankings">Xem tất cả thứ hạng</Link>
              ) : (
                <span>{group.events.length} sự kiện</span>
              )}
            </div>
            <div className={styles.eventList}>
              {group.events.map((event, index) => (
                <EventCard
                  key={event.id}
                  event={event}
                  state={state}
                  onRegister={register}
                  now={now}
                  index={groupIndex + index}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
