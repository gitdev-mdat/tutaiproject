'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Lock,
  FileText,
  Clock,
  BookOpen,
  ChevronRight,
  BarChart,
} from 'lucide-react';
import {
  ExamSet,
  SUBJECT_LABELS,
  EXAM_TYPE_LABELS,
  DIFFICULTY_LABELS,
} from '@/lib/exam-sets/types';

const BLUE = '#1768FF';
const TEXT_HEAD = '#0F172A';
const TEXT_MUTED = '#627188';
const BORDER_SOFT = 'rgba(40,75,130,0.12)';
const SURFACE = '#FFFFFF';

const SUBJECT_COLORS: Record<string, string> = {
  MATH: '#1768FF',
  PHYSICS: '#0091EA',
  CHEMISTRY: '#FF8F00',
  BIOLOGY: '#13B99A',
};

const PREMIUM_STYLES = `
  @keyframes float-subtle {
    0% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-8px) rotate(0.5deg); }
    100% { transform: translateY(0px) rotate(0deg); }
  }
  @keyframes premium-sweep {
    0%, 18% {
      transform: translate3d(-240%, 0, 0) rotate(12deg);
      opacity: 0;
    }
    25% { opacity: 0.12; }
    72% { opacity: 0.12; }
    84%, 100% {
      transform: translate3d(430%, 0, 0) rotate(12deg);
      opacity: 0;
    }
  }
  .glass-card {
    background: rgba(10, 20, 45, 0.4);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }
  .glass-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
    background: rgba(15, 28, 60, 0.5);
  }
  .timeline-line {
    background: linear-gradient(180deg, rgba(95, 130, 255, 0.8) 0%, rgba(95, 130, 255, 0) 100%);
  }
  .premium-text-gradient {
    background: linear-gradient(180deg, #FFFFFF 0%, #D4E0F9 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .premium-cover-front::after {
    content: "";
    position: absolute;
    z-index: 4;
    top: -20%;
    left: 0;
    width: 40%;
    height: 140%;
    pointer-events: none;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.88), transparent);
    filter: blur(42px);
    opacity: 0;
    transform: translate3d(-240%, 0, 0) rotate(12deg);
    animation: premium-sweep 9s ease-in-out infinite;
    will-change: transform, opacity;
  }
  @media (prefers-reduced-motion: reduce) {
    .premium-cover-front,
    .premium-cover-front::after {
      animation: none !important;
    }
  }
`;

// ─── Shared Book Cover ──────────────────────────────────────────────────────

function PremiumCover({ set }: { set: ExamSet }) {
  const isFree = set.accessTier === 'FREE';
  const subjectLabel = SUBJECT_LABELS[set.subjectId];
  const typeLabel = EXAM_TYPE_LABELS[set.examType];
  const accentColor = SUBJECT_COLORS[set.subjectId];

  if (isFree) {
    return (
      <div
        style={{
          background: 'linear-gradient(145deg, #071A35 0%, #0B2348 100%)',
          position: 'relative',
          padding: 'clamp(24px, 4vw, 28px)',
          width: '100%',
          aspectRatio: '4 / 5',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRadius: 12,
          borderBottom: `4px solid ${accentColor}`,
          boxShadow: '0 16px 32px rgba(10, 25, 60, 0.2)',
        }}
      >
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: accentColor,
            }}
          >
            {subjectLabel} {set.grade}
          </span>
        </div>
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.7)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {set.examType === 'MOCK_EXAM' || set.examType === 'THPT_NATIONAL'
              ? 'BỘ ĐỀ'
              : 'CHUYÊN ĐỀ'}
          </div>
          <div
            style={{
              fontSize: 'clamp(26px, 3.5vw, 28px)',
              fontWeight: 750,
              color: '#FFFFFF',
              letterSpacing: '0.02em',
              lineHeight: 1.2,
              textTransform: 'uppercase',
            }}
          >
            {typeLabel}
          </div>
        </div>
        <div style={{ position: 'relative', zIndex: 1 }} />
      </div>
    );
  }

  // ULTRA PREMIUM STACK DESIGN (SPECIAL)
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '4 / 5.2',
        perspective: 1200,
        margin: '0 auto',
      }}
    >
      {/* Stack Layer 2 */}
      <div
        className="premium-cover-front"
        style={{
          position: 'absolute',
          inset: 0,
          background: '#041024',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.06)',
          transform: 'translateY(16px) scale(0.9) rotate(-3deg)',
          zIndex: 0,
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}
      />

      {/* Stack Layer 1 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#061732',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          transform: 'translateY(8px) scale(0.95) rotate(1.5deg)',
          zIndex: 1,
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}
      />

      {/* Main Front Layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(145deg, #091C3E 0%, #102B60 40%, #1A3F85 100%)',
          borderRadius: 16,
          boxShadow:
            '0 12px 48px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255,255,255,0.25), inset 0 2px 8px rgba(255,255,255,0.2)',
          zIndex: 2,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: 'clamp(24px, 4vw, 32px)',
          transformStyle: 'preserve-3d',
          animation: 'float-subtle 7s ease-in-out infinite',
        }}
      >
        {/* Subtle noise grain */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")',
            opacity: 0.035,
            pointerEvents: 'none',
          }}
        />

        {/* Ambient Top Light */}
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            left: '-20%',
            right: '-20%',
            height: '50%',
            background:
              'radial-gradient(ellipse at top, rgba(255,255,255,0.2) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* --- Card Content --- */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: '0.15em',
              color: accentColor,
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            }}
          >
            {subjectLabel} {set.grade}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.25)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)',
              padding: '4px 12px',
              borderRadius: 999,
              color: '#FFFFFF',
              fontSize: 11,
              fontWeight: 750,
              letterSpacing: '0.08em',
            }}
          >
            <span style={{ color: '#E2E8F0', textShadow: '0 0 8px rgba(255,255,255,0.5)' }}>✦</span>{' '}
            TUYỂN CHỌN
          </span>
        </div>

        <div
          style={{
            position: 'relative',
            zIndex: 10,
            marginTop: 'auto',
            marginBottom: 'auto',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: '0.2em',
              marginBottom: 12,
              textTransform: 'uppercase',
            }}
          >
            {set.examType === 'MOCK_EXAM' || set.examType === 'THPT_NATIONAL'
              ? 'BỘ ĐỀ THI'
              : 'CHUYÊN ĐỀ'}
          </div>
          <div
            style={{
              fontSize: 'clamp(28px, 4.5vw, 36px)',
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '0.02em',
              lineHeight: 1.15,
              textTransform: 'uppercase',
              textShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            {typeLabel}
          </div>
          {set.year && (
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: accentColor,
                letterSpacing: '0.15em',
                marginTop: 16,
                textTransform: 'uppercase',
              }}
            >
              Ấn bản {set.editionLabel || set.year}
            </div>
          )}
        </div>

        <div style={{ position: 'relative', zIndex: 10 }}>
          <div
            style={{
              width: '100%',
              height: 1,
              background: 'rgba(255,255,255,0.2)',
              marginBottom: 16,
            }}
          />

          <div
            style={{
              fontSize: 14,
              color: '#FFFFFF',
              fontWeight: 600,
              letterSpacing: '0.08em',
              marginBottom: 16,
              textTransform: 'uppercase',
            }}
          >
            {set.specialReason === 'UNCOMMON_QUESTION_PATTERNS'
              ? 'Chuỗi câu hỏi hiếm gặp'
              : 'Mô phỏng cấu trúc thi'}
          </div>

          <div
            style={{
              width: '100%',
              height: 1,
              background: 'rgba(255,255,255,0.1)',
              marginBottom: 16,
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                <CheckCircle2 size={13} color={accentColor} /> Đã kiểm duyệt
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                <CheckCircle2 size={13} color={accentColor} /> Số lượng giới hạn
              </div>
            </div>
            {set.selectionSourceCount && (
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.5)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 4,
                  }}
                >
                  Nguồn chắt lọc
                </div>
                <div style={{ fontSize: 14, fontWeight: 750, color: '#FFFFFF' }}>
                  Top {set.selectionSourceCount}%
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero Component ──────────────────────────────────────────────────────────

function ExamSetHeroContent({ set, isFree }: { set: ExamSet; isFree: boolean }) {
  if (isFree) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 0' }}>
        <Link
          href="/exam-sets"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13.5,
            fontWeight: 600,
            color: TEXT_MUTED,
            textDecoration: 'none',
            marginBottom: 'clamp(24px, 4vw, 36px)',
            transition: 'color 180ms ease',
          }}
        >
          <ArrowLeft size={16} strokeWidth={2.5} aria-hidden="true" />
          Bộ đề
        </Link>

        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 750,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: BLUE,
              margin: 0,
            }}
          >
            {SUBJECT_LABELS[set.subjectId]} {set.grade} · {EXAM_TYPE_LABELS[set.examType]}
          </p>
          <span
            style={{
              fontSize: 11,
              fontWeight: 750,
              background: 'rgba(19, 185, 154, 0.1)',
              color: '#10967D',
              padding: '4px 10px',
              borderRadius: 999,
              textTransform: 'uppercase',
            }}
          >
            Miễn phí
          </span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(28px, 4vw, 40px)',
            fontWeight: 760,
            color: TEXT_HEAD,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            marginBottom: 20,
          }}
        >
          {set.title}
        </h1>

        <p
          style={{
            fontSize: 16,
            color: '#475569',
            lineHeight: 1.6,
            maxWidth: 620,
            marginBottom: 28,
          }}
        >
          {set.description}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              height: 48,
              padding: '0 28px',
              borderRadius: 12,
              background: BLUE,
              color: '#FFFFFF',
              fontSize: 15,
              fontWeight: 650,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(23,104,255,0.22)',
            }}
          >
            Luyện ngay
            <ArrowRight size={16} strokeWidth={2.5} />
          </button>
          <span style={{ fontSize: 13, color: TEXT_MUTED, fontWeight: 500 }}>
            Miễn phí · Lưu tiến độ sau khi đăng nhập
          </span>
        </div>
      </div>
    );
  }

  // ULTRA PREMIUM SPECIAL HERO CONTENT
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 0' }}>
      <Link
        href="/exam-sets"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--hero-muted)',
          textDecoration: 'none',
          marginBottom: 'clamp(20px, 3vw, 32px)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          transition: 'color 200ms ease',
        }}
        className="special-exam-focus hover:text-white"
      >
        <ArrowLeft size={14} strokeWidth={3} /> Trở về
      </Link>

      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#BACDFF',
            margin: 0,
          }}
        >
          {SUBJECT_LABELS[set.subjectId]} {set.grade}{' '}
          <span style={{ opacity: 0.5, margin: '0 6px' }}>/</span> {EXAM_TYPE_LABELS[set.examType]}
        </p>
      </div>

      <h1
        className="premium-text-gradient"
        style={{
          fontSize: 'clamp(36px, 5vw, 56px)',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          marginBottom: 24,
          textShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}
      >
        {set.title}
      </h1>

      <p
        style={{
          fontSize: 17,
          color: 'rgba(255,255,255,0.85)',
          lineHeight: 1.7,
          maxWidth: 580,
          marginBottom: 24,
          letterSpacing: '0.01em',
          fontWeight: 400,
        }}
      >
        {set.description}
      </p>

      <div
        className="glass-card"
        style={{
          padding: '16px 20px',
          borderRadius: 16,
          borderLeft: '3px solid #5F82FF',
          maxWidth: 540,
        }}
      >
        <p
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.95)',
            lineHeight: 1.6,
            margin: 0,
            fontStyle: 'italic',
            letterSpacing: '0.02em',
          }}
        >
          &ldquo;Không nhất thiết khó hơn. Chỉ là những cách hỏi em hiếm khi được luyện
          trước.&rdquo;
        </p>
      </div>
    </div>
  );
}

export function ExamSetHero({ set }: { set: ExamSet }) {
  const isFree = set.accessTier === 'FREE';

  return (
    <>
      <style>{PREMIUM_STYLES}</style>

      {isFree ? (
        <section className="flex flex-col md:flex-row items-center gap-12 md:gap-16 mb-12 md:mb-16">
          <div className="flex-1 w-full order-1 md:order-1">
            <ExamSetHeroContent set={set} isFree={isFree} />
          </div>
          <div className="w-full max-w-[280px] md:max-w-[340px] flex-shrink-0 order-2 md:order-2 self-center">
            <PremiumCover set={set} />
          </div>
        </section>
      ) : (
        // Special (Plus) ultra premium layout
        <section
          className="special-hero-grid flex flex-col md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.72fr)] gap-8 md:gap-12"
          style={{
            position: 'relative',
            padding: 'clamp(20px, 3vw, 36px) clamp(20px, 3.5vw, 44px)',
          }}
        >
          {/* Subtle glow behind the hero */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(circle at 75% 20%, rgba(95, 130, 255, 0.08), transparent 40%)',
              pointerEvents: 'none',
            }}
          />

          <div className="order-1 md:col-start-1 md:row-start-1 flex flex-col justify-center z-10">
            <ExamSetHeroContent set={set} isFree={isFree} />
          </div>
          <div className="order-2 md:col-start-2 md:row-start-1 w-full max-w-[260px] md:max-w-[340px] mx-auto md:mx-0 self-center z-10">
            <PremiumCover set={set} />
          </div>
        </section>
      )}
    </>
  );
}

// ─── Source Block ────────────────────────────────────────────────────────────

export function DetailSource({
  set,
  variant = 'light',
}: {
  set: ExamSet;
  variant?: 'light' | 'dark';
}) {
  if (!set.authorName) return null;
  const isDark = variant === 'dark';
  return (
    <div
      className={isDark ? undefined : 'special-exam-author'}
      style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginTop: isDark ? 16 : 0 }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: isDark ? 'rgba(255,255,255,0.06)' : '#F0F4FA',
          border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        <GraduationCap size={22} color={isDark ? '#FFFFFF' : BLUE} strokeWidth={2.5} />
      </div>
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 750,
            color: isDark ? 'rgba(255,255,255,0.3)' : TEXT_MUTED,
            letterSpacing: '0.1em',
            marginBottom: 4,
            textTransform: 'uppercase',
          }}
        >
          Biên soạn bởi
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 750,
            color: isDark ? '#FFFFFF' : TEXT_HEAD,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
            letterSpacing: '0.01em',
          }}
        >
          {set.authorName || 'Tổ biên soạn Tú Tài'}
          {set.verifiedSource && (
            <span title="Nguồn đã xác minh" style={{ display: 'flex', alignItems: 'center' }}>
              <CheckCircle2 size={16} color={isDark ? '#5F82FF' : BLUE} strokeWidth={3} />
            </span>
          )}
        </div>
        {(set.authorRole || set.schoolName) && (
          <div
            style={{
              fontSize: 13.5,
              color: isDark ? 'rgba(255,255,255,0.4)' : TEXT_MUTED,
              fontWeight: 500,
            }}
          >
            {set.authorRole}
            {set.authorRole && set.schoolName ? ' · ' : ''}
            {set.schoolName}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export function DetailMetadata({ set }: { set: ExamSet }) {
  const isFree = set.accessTier === 'FREE';
  const items = [
    { icon: FileText, label: 'Số đề', value: `${set.examCount} đề` },
    { icon: Clock, label: 'Thời lượng', value: set.estimatedDuration ?? '—' },
    { icon: BarChart, label: 'Độ khó', value: DIFFICULTY_LABELS[set.difficulty] },
    { icon: BookOpen, label: 'Loại đề', value: EXAM_TYPE_LABELS[set.examType] },
  ];

  if (isFree) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 20,
          padding: '24px 32px',
          background: SURFACE,
          border: `1px solid ${BORDER_SOFT}`,
          borderRadius: 20,
          marginBottom: 48,
          boxShadow: '0 4px 16px rgba(40,75,130,0.03)',
        }}
      >
        {items.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 10 }}>
              <item.icon size={20} color={BLUE} strokeWidth={2} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: TEXT_MUTED,
                  fontWeight: 650,
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {item.label}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_HEAD }}>{item.value}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Special metadata belongs fully to the light content theme.
  return (
    <div
      className="special-exam-stats"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 24,
        padding: '24px 32px',
        borderRadius: 24,
        background: 'rgba(255, 255, 255, 0.96)',
        border: '1px solid var(--content-border)',
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.07)',
      }}
    >
      {items.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: 'rgba(23, 105, 255, 0.07)', padding: 12, borderRadius: 12 }}>
            <item.icon
              size={20}
              color="var(--content-accent)"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--content-muted)',
                fontWeight: 700,
                marginBottom: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 750,
                color: 'var(--content-heading)',
                letterSpacing: '0.01em',
              }}
            >
              {item.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Features (Special Only) ─────────────────────────────────────────────────

export function DetailFeatures({
  features,
}: {
  features?: { title: string; description: string }[];
}) {
  if (!features || features.length === 0) return null;

  return (
    <section className="special-content-section" style={{ position: 'relative' }}>
      <h2 className="special-section-title">Tài liệu đặc quyền</h2>
      <div className="special-timeline" style={{ position: 'relative', paddingLeft: 32 }}>
        {/* Connecting line */}
        <div
          className="timeline-line"
          style={{ position: 'absolute', top: 12, bottom: 12, left: 15, width: 2, borderRadius: 2 }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 44 }}>
          {features.map((feature, idx) => (
            <article
              key={idx}
              style={{
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: '48px minmax(0, 1fr)',
                gap: 20,
                alignItems: 'flex-start',
              }}
            >
              {/* Node */}
              <div
                style={{
                  position: 'absolute',
                  left: -32,
                  top: 4,
                  width: 32,
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    border: '2px solid var(--content-accent)',
                    boxShadow: '0 0 0 5px rgba(23, 105, 255, 0.08)',
                  }}
                />
              </div>

              <div
                aria-hidden="true"
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  color: 'var(--content-subtle)',
                  opacity: 0.55,
                  letterSpacing: '-0.04em',
                  lineHeight: 0.9,
                  marginTop: 4,
                }}
              >
                0{idx + 1}
              </div>

              <div>
                <h3
                  style={{
                    fontSize: 'clamp(1.15rem, 2vw, 1.3rem)',
                    fontWeight: 650,
                    color: '#172033',
                    marginBottom: 10,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {feature.title}
                </h3>
                <p
                  style={{
                    fontSize: 16,
                    color: 'var(--content-body)',
                    lineHeight: 1.75,
                    margin: 0,
                    maxWidth: 720,
                  }}
                >
                  {feature.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Uncommon Preview (Special Only) ──────────────────────────────────────────

export function DetailUncommonPreview({ set }: { set: ExamSet }) {
  if (!set.specialTags || set.specialTags.length === 0) return null;

  return (
    <section className="special-content-section">
      <h2 className="special-section-title">Bên trong bộ sưu tập</h2>
      <div className="special-feature-grid">
        {set.specialTags.map((item, idx) => (
          <article key={idx} className="special-feature-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'rgba(23,105,255,0.07)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2
                  size={22}
                  color="var(--content-accent)"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              </div>
              <div
                aria-hidden="true"
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: 'var(--content-subtle)',
                  opacity: 0.55,
                }}
              >
                {String(idx + 1).padStart(2, '0')}
              </div>
            </div>
            <h3
              style={{
                fontSize: 17,
                color: '#172033',
                lineHeight: 1.55,
                fontWeight: 650,
                letterSpacing: '-0.01em',
                margin: 0,
              }}
            >
              {item}
            </h3>
          </article>
        ))}
      </div>
    </section>
  );
}

// ─── Exam List / Preview ─────────────────────────────────────────────────────

export function DetailExamList({ set }: { set: ExamSet }) {
  if (!set.exams || set.exams.length === 0) return null;
  const isFree = set.accessTier === 'FREE';

  if (isFree) {
    return (
      <div style={{ marginBottom: 64 }}>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 750,
            color: TEXT_HEAD,
            marginBottom: 24,
            letterSpacing: '-0.01em',
          }}
        >
          Danh sách đề
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {set.exams.map((exam) => (
            <div
              key={exam.id}
              style={{
                background: SURFACE,
                border: `1px solid ${BORDER_SOFT}`,
                borderRadius: 16,
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 24,
                boxShadow: '0 2px 8px rgba(40,75,130,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 750, color: TEXT_MUTED }}>
                  Đề {String(exam.order).padStart(2, '0')}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 650, color: TEXT_HEAD, marginBottom: 4 }}>
                    {exam.title}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      fontSize: 13,
                      color: TEXT_MUTED,
                      fontWeight: 500,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={14} /> {exam.duration}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <BarChart size={14} /> {DIFFICULTY_LABELS[exam.difficulty]}
                    </span>
                  </div>
                </div>
              </div>
              <button
                style={{
                  fontSize: 14,
                  fontWeight: 650,
                  color: BLUE,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Làm đề <ChevronRight size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ULTRA PREMIUM EXAM LIST
  return (
    <section className="special-content-section">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 24,
        }}
      >
        <h2 className="special-section-title" style={{ margin: 0 }}>
          Kho lưu trữ
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {set.exams.map((exam, idx) => {
          const isUnlocked = isFree || (set.previewEnabled && exam.previewAvailable && idx === 0);
          const isLocked = !isFree && !isUnlocked;

          return (
            <div
              key={exam.id}
              className={`special-archive-row${isUnlocked ? ' is-available' : ' is-locked'}`}
              aria-disabled={isLocked}
            >
              <div className="special-archive-main">
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: isLocked ? '#667085' : 'var(--content-accent)',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                  }}
                >
                  No. {String(exam.order).padStart(2, '0')}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      color: isLocked ? '#667085' : '#172033',
                      marginBottom: 8,
                      letterSpacing: '0.01em',
                    }}
                  >
                    {exam.title}
                  </div>
                  <div
                    className="special-archive-meta"
                    style={{ color: isLocked ? '#667085' : 'var(--content-muted)' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} aria-hidden="true" /> {exam.duration}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <BarChart size={14} aria-hidden="true" /> {DIFFICULTY_LABELS[exam.difficulty]}
                    </span>
                  </div>
                </div>
              </div>
              <div className="special-archive-action">
                {isUnlocked ? (
                  <button className="special-archive-button special-exam-focus">
                    Truy cập <ChevronRight size={14} strokeWidth={3} aria-hidden="true" />
                  </button>
                ) : (
                  <div className="special-archive-lock">
                    <Lock size={15} color="#94A3B8" aria-hidden="true" />
                    <span>Đã khóa</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Intended For ────────────────────────────────────────────────────────────

export function DetailIntendedFor({ intendedFor }: { intendedFor?: string[] }) {
  if (!intendedFor || intendedFor.length === 0) return null;

  return (
    <div
      className="special-intended-for"
      style={{
        background: '#FFFFFF',
        border: '1px solid var(--content-border)',
        padding: '32px',
        borderRadius: 24,
        boxShadow: '0 10px 28px rgba(15, 23, 42, 0.045)',
      }}
    >
      <h2
        style={{
          fontSize: 20,
          fontWeight: 750,
          color: 'var(--content-heading)',
          marginBottom: 24,
          letterSpacing: '-0.01em',
        }}
      >
        Bộ đề này phù hợp khi em…
      </h2>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {intendedFor.map((item, idx) => (
          <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <CheckCircle2
              size={20}
              color="var(--content-accent)"
              strokeWidth={2.5}
              style={{ marginTop: 2, flexShrink: 0 }}
              aria-hidden="true"
            />
            <span style={{ fontSize: 15, color: 'var(--content-body)', lineHeight: 1.6 }}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Access Panel (Special Only) ─────────────────────────────────────────────

export function DetailAccessPanel({}: { set: ExamSet }) {
  return (
    <section
      className="special-access-panel"
      style={{
        background: '#FFFFFF',
        border: '1px solid var(--content-border)',
        borderRadius: 28,
        padding: 'clamp(48px, 7vw, 72px) clamp(24px, 5vw, 40px)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.06)',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(23,105,255,0.07)',
          padding: '6px 16px',
          borderRadius: 999,
          border: '1px solid rgba(23,105,255,0.12)',
          marginBottom: 28,
        }}
      >
        <Lock size={14} color="var(--content-accent)" strokeWidth={2.5} aria-hidden="true" />
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: 'var(--content-heading)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Kho Lưu Trữ Đặc Quyền
        </span>
      </div>
      <h2
        style={{
          fontSize: 'clamp(28px, 4vw, 40px)',
          fontWeight: 750,
          color: 'var(--content-heading)',
          marginBottom: 20,
          letterSpacing: '-0.03em',
          maxWidth: 660,
          lineHeight: 1.2,
        }}
      >
        Mở khóa toàn bộ bộ sưu tập và đánh giá điểm mù kiến thức
      </h2>
      <p
        style={{
          fontSize: 16,
          color: 'var(--content-body)',
          lineHeight: 1.7,
          maxWidth: 560,
          marginBottom: 40,
        }}
      >
        Phân tích chi tiết giúp em nhận diện những cách diễn đạt hiếm gặp và cải thiện tốc độ phản
        xạ.
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <Link
          href="/auth/register"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            height: 56,
            padding: '0 32px',
            borderRadius: 16,
            background: 'var(--content-accent)',
            color: '#FFFFFF',
            fontSize: 15,
            fontWeight: 750,
            textDecoration: 'none',
            boxShadow: '0 8px 24px rgba(23,104,255,0.22)',
            transition: 'transform 200ms ease',
          }}
          className="special-exam-focus hover:scale-105"
        >
          Khám phá ngay <ArrowRight size={18} strokeWidth={2.5} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
