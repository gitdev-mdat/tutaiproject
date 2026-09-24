'use client';

import * as React from 'react';
import {
  ChevronDown,
  FileText,
  Info,
  Lightbulb,
  Medal,
  Swords,
  Target,
  Trophy,
  Users,
} from 'lucide-react';
import type { RankingSnapshot } from '../lib/types';
import {
  buildRankingPresentation,
  type RankingPeriod,
  type RankingScope,
  type RankingStudent,
} from '../lib/ranking-presentation';
import styles from './student-rankings-overview.module.css';

const SCOPES: Array<{ id: RankingScope; label: string; icon: typeof Users }> = [
  { id: 'overall', label: 'Tổng hợp', icon: Users },
  { id: 'arena', label: 'Đấu trường', icon: Swords },
  { id: 'exam', label: 'Luyện thi', icon: FileText },
];

const PERIODS: Array<{ id: RankingPeriod; label: string }> = [
  { id: 'week', label: 'Tuần này' },
  { id: 'month', label: 'Tháng này' },
  { id: 'all', label: 'Toàn thời gian' },
];

function HeroArtwork() {
  return (
    <svg className={styles.heroArt} viewBox="0 0 760 155" fill="none" aria-hidden="true">
      <defs>
        <pattern id="ranking-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" stroke="currentColor" strokeWidth=".5" />
        </pattern>
      </defs>
      <rect x="24" width="620" height="155" fill="url(#ranking-grid)" opacity=".16" />
      <g stroke="currentColor" strokeWidth="1.25">
        <path d="M98 132h70V96h70v36h70V108h70v24" opacity=".55" />
        <path d="M187 25h72v20c0 25-15 42-36 42s-36-17-36-42V25zM205 87h36v20M188 107h70v25" />
        <path d="M188 35h-20c0 27 8 38 28 39M258 35h20c0 27-8 38-28 39" opacity=".72" />
        <path
          d="M161 83c-25-17-31-42-26-68M151 71l-18-7M145 54l-16-11M140 36l-9-14M286 83c25-17 31-42 26-68M296 71l18-7M302 54l16-11M307 36l9-14"
          opacity=".65"
        />
        <path d="M394 115l43-35l38 17l55-53l42 13l51-42" />
      </g>
      <g fill="currentColor" fontFamily="sans-serif" fontWeight="700">
        <text x="193" y="127" fontSize="15">
          #1
        </text>
        <text x="122" y="126" fontSize="13">
          #2
        </text>
        <text x="324" y="126" fontSize="13">
          #3
        </text>
      </g>
      <g fill="currentColor">
        <circle cx="437" cy="80" r="3" />
        <circle cx="475" cy="97" r="3" />
        <circle cx="530" cy="44" r="3" />
        <circle cx="572" cy="57" r="3" />
        <circle cx="623" cy="15" r="3" />
      </g>
    </svg>
  );
}

function AnimatedBar({ value }: { value: number }) {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <span className={styles.progressTrack}>
      <span
        className={styles.progressFill}
        style={{ width: ready ? `${Math.min(100, Math.max(0, value))}%` : 0 }}
      />
    </span>
  );
}

function TopStudentCard({ student }: { student: RankingStudent }) {
  return (
    <article className={`${styles.topStudent} ${styles[`rank${student.rank}`] ?? ''}`}>
      <Trophy size={20} aria-hidden="true" />
      <strong>#{student.rank}</strong>
      <div>
        <h3>{student.name}</h3>
        <p>{student.school}</p>
      </div>
      <b>{student.score.toFixed(2)}</b>
    </article>
  );
}

export function StudentRankingsOverview({ snapshot }: { snapshot: RankingSnapshot }) {
  const [scope, setScope] = React.useState<RankingScope>('overall');
  const [period, setPeriod] = React.useState<RankingPeriod>('week');
  const [subject, setSubject] = React.useState('all');
  const data = buildRankingPresentation(snapshot);
  const { summary, milestone } = data;
  const percentilePosition = summary
    ? Math.min(100, Math.max(0, ((10 - summary.percentile) / 9) * 100))
    : 0;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <HeroArtwork />
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>THỨ HẠNG</p>
          <h1>Thành tích cạnh tranh của em</h1>
          <p className={styles.subtitle}>
            <Info size={16} />
            {data.sourceLabel}
          </p>
        </div>
        <blockquote className={styles.quote}>
          Kiến thức hôm nay
          <br />
          là cơ hội ngày mai.<cite>— Tú Tài</cite>
        </blockquote>
      </header>

      <section className={styles.filters} aria-label="Bộ lọc bảng xếp hạng">
        <div className={styles.scopeTabs}>
          {SCOPES.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" aria-pressed={scope === id} onClick={() => setScope(id)}>
              <Icon size={17} />
              {label}
            </button>
          ))}
        </div>
        <div className={styles.filterRight}>
          <div className={styles.periodTabs}>
            {PERIODS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={period === id}
                onClick={() => setPeriod(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className={styles.subjectSelect}>
            <span className="sr-only">Môn học</span>
            <select value={subject} onChange={(event) => setSubject(event.target.value)}>
              <option value="all">Tất cả môn</option>
              <option value="math">Toán</option>
              <option value="physics">Vật lý</option>
              <option value="chemistry">Hóa học</option>
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </label>
        </div>
      </section>

      {summary && milestone ? (
        <div className={styles.summaryGrid}>
          <section className={`${styles.card} ${styles.personalCard}`}>
            <div className={styles.cardHeading}>
              <span>
                <Medal size={21} />
              </span>
              <h2>Thứ hạng của em</h2>
            </div>
            <div className={styles.rankLine}>
              <strong>#{summary.rank}</strong>
              <p>
                Top {summary.percentile}% <i>·</i> {summary.score.toFixed(2)} điểm
              </p>
              {summary.rankDelta && <span>↑&nbsp; {summary.rankDelta} bậc tuần này</span>}
            </div>
            <div className={styles.percentileScale}>
              <span>Top 10%</span>
              <div className={styles.scaleRail}>
                <i style={{ left: `${percentilePosition}%` }}>
                  <b>Bạn</b>
                </i>
                {[0, 20, 40, 60, 80, 100].map((position) => (
                  <em key={position} style={{ left: `${position}%` }} />
                ))}
              </div>
              <span>Top 1%</span>
            </div>
          </section>

          <section className={`${styles.card} ${styles.milestoneCard}`}>
            <div className={styles.cardHeading}>
              <span>
                <Target size={21} />
              </span>
              <h2>Mốc tiếp theo</h2>
            </div>
            <h3>Top {milestone.targetPercentile}%</h3>
            <p>
              Còn <strong>{milestone.scoreRemaining.toFixed(2)} điểm</strong> để đạt
            </p>
            <div className={styles.scoreProgress}>
              <AnimatedBar value={(summary.score / milestone.targetScore) * 100} />
              <b>
                {summary.score.toFixed(2)} / {milestone.targetScore.toFixed(2)}
              </b>
            </div>
            <div className={styles.guidance}>
              <Lightbulb size={16} />
              <span>Hoàn thành thêm 1–2 lượt thi có điểm tốt để cải thiện thứ hạng.</span>
            </div>
          </section>
        </div>
      ) : (
        <section className={`${styles.card} ${styles.emptyState}`}>
          <Medal size={24} />
          <div>
            <h2>Chưa có thứ hạng</h2>
            <p>
              Hoàn thành một lượt Đấu trường hoặc đề thi có bật xếp hạng để xem thành tích của em.
            </p>
          </div>
        </section>
      )}

      <section className={`${styles.card} ${styles.leaderboardCard}`}>
        <div className={styles.leaderboardHeader}>
          <div className={styles.cardHeading}>
            <span className={styles.trophyIcon}>
              <Trophy size={21} />
            </span>
            <h2>Top học sinh</h2>
          </div>
          {summary && (
            <div className={styles.contextBadge}>
              <Users size={16} />
              <strong>{100 - summary.percentile}%</strong> học sinh đang xếp sau bạn
            </div>
          )}
        </div>
        <div className={styles.topThree}>
          {data.topStudents.map((student) => (
            <TopStudentCard student={student} key={student.rank} />
          ))}
        </div>
        <h3 className={styles.tableTitle}>Bảng xếp hạng</h3>
        <div className={styles.rankingTable} role="table" aria-label="Bảng xếp hạng học sinh">
          <div className={styles.tableHeader} role="row">
            <span role="columnheader">#</span>
            <span role="columnheader">Họ và tên</span>
            <span role="columnheader">Trường</span>
            <span role="columnheader">Điểm</span>
            <span />
          </div>
          {data.nearbyStudents.slice(0, 3).map((student) => (
            <RankingRow student={student} key={student.rank} />
          ))}
          {data.nearbyStudents.length > 3 && (
            <div className={styles.ellipsis} aria-label="Các thứ hạng ở giữa">
              •••
            </div>
          )}
          {data.nearbyStudents.slice(3).map((student) => (
            <RankingRow student={student} key={student.rank} />
          ))}
        </div>
      </section>
    </div>
  );
}

function RankingRow({ student }: { student: RankingStudent }) {
  return (
    <div
      className={`${styles.tableRow} ${student.isCurrentUser ? styles.currentUser : ''}`}
      role="row"
    >
      <strong role="cell">#{student.rank}</strong>
      <span role="cell">{student.name}</span>
      <span role="cell">{student.school}</span>
      <b role="cell">{student.score.toFixed(2)}</b>
      <span role="cell">{student.isCurrentUser && <em>Bạn</em>}</span>
    </div>
  );
}
