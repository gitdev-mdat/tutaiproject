'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { BookOpen, Check, CheckCircle2, Pencil, X, type LucideIcon } from 'lucide-react';

import { TuTaiMark } from '@/components/layout/public-header';
import styles from './problem-statement.module.css';

interface StepCardProps {
  number: string;
  tone: 'purple' | 'blue' | 'mint' | 'orange';
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  className?: string;
  revealed?: boolean;
  active?: boolean;
}

function StepCard({
  number,
  tone,
  icon: Icon,
  title,
  children,
  className = '',
  revealed = false,
  active = false,
}: StepCardProps) {
  return (
    <article
      className={`${styles.stepCard} ${styles[`step_${tone}`]} ${className}`}
      data-revealed={revealed}
      data-active={active}
    >
      <span className={styles.stepNumber}>{number}</span>
      <span className={styles.stepIcon} aria-hidden="true">
        <Icon size={25} strokeWidth={2} />
      </span>
      <div className={styles.stepCopy}>
        <h3>{title}</h3>
        {children}
      </div>
    </article>
  );
}

function AnalysisModule({
  className = '',
  revealed = false,
  active = false,
}: {
  className?: string;
  revealed?: boolean;
  active?: boolean;
}) {
  return (
    <div
      className={`${styles.analysisModule} ${className}`}
      data-revealed={revealed}
      data-active={active}
    >
      <div className={styles.analysisRings} aria-hidden="true" />
      <div className={styles.analysisNode} aria-hidden="true">
        <span>
          <TuTaiMark size={48} />
        </span>
      </div>
      <article className={styles.analysisCard}>
        <span className={styles.stepNumber}>3</span>
        <strong>LỜI GIẢI</strong>
        <p>
          (x³)′ = 3x², đáp án đúng là <b>C</b>.
        </p>
      </article>
    </div>
  );
}

function GoalNode({
  className = '',
  revealed = false,
  active = false,
}: {
  className?: string;
  revealed?: boolean;
  active?: boolean;
}) {
  return (
    <div
      className={`${styles.goalNode} ${className}`}
      data-revealed={revealed}
      data-active={active}
      aria-label="Mục tiêu 9+"
    >
      <span>9+</span>
      <small>MỤC TIÊU</small>
    </div>
  );
}

// Cards reveal on odd phases, the arrow into the next card on the even phase after it.
const CONNECTOR_PHASES = [2, 4, 6, 8] as const;
const GOAL_PHASE = 9;
const SEQUENCE_END = 10;

function isActivePhase(phase: number, start: number, end: number) {
  return phase >= start && phase <= end;
}

function DesktopLoop({ pathId, glowId, phase }: { pathId: string; glowId: string; phase: number }) {
  return (
    <div className={styles.desktopLoop} aria-label="Vòng học thích ứng của Tú Tài">
      <svg className={styles.loopSvg} viewBox="0 0 820 660" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={pathId} x1="80" y1="130" x2="730" y2="390">
            <stop stopColor="#1768ff" />
            <stop offset="0.52" stopColor="#2c9ef2" />
            <stop offset="1" stopColor="#075cf4" />
          </linearGradient>
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker
            id={`${pathId}-arrow`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path
              d="M1 1L9 5L1 9"
              fill="none"
              stroke="#1685f2"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>
        <g className={styles.ambientRings}>
          <circle cx="414" cy="334" r="92" />
          <circle cx="414" cy="334" r="145" />
          <circle cx="414" cy="334" r="205" />
        </g>
        <g
          className={styles.loopPaths}
          stroke={`url(#${pathId})`}
          filter={`url(#${glowId})`}
          markerEnd={`url(#${pathId}-arrow)`}
        >
          <path
            d="M270 137C289 137 301 138 320 141"
            data-revealed={phase >= CONNECTOR_PHASES[0]}
            data-active={phase === CONNECTOR_PHASES[0]}
          />
          <path
            d="M540 153C640 166 655 265 552 325"
            data-revealed={phase >= CONNECTOR_PHASES[1]}
            data-active={phase === CONNECTOR_PHASES[1]}
          />
          <path
            d="M394 446C394 464 394 478 394 494"
            data-revealed={phase >= CONNECTOR_PHASES[2]}
            data-active={phase === CONNECTOR_PHASES[2]}
          />
          <path
            d="M518 560C640 560 714 470 726 392"
            data-revealed={phase >= CONNECTOR_PHASES[3]}
            data-active={phase === CONNECTOR_PHASES[3]}
          />
        </g>
        <g className={styles.loopParticles}>
          {CONNECTOR_PHASES.map((connectorPhase, index) => (
            <circle
              key={connectorPhase}
              cx={[302, 626, 394, 668][index]}
              cy={[141, 233, 470, 512][index]}
              r="5"
              data-revealed={phase >= connectorPhase}
              data-active={phase === connectorPhase}
            />
          ))}
        </g>
      </svg>

      <StepCard
        number="1"
        tone="purple"
        icon={BookOpen}
        title="Học bài"
        className={styles.desktopStepOne}
        revealed={phase >= 1}
        active={isActivePhase(phase, 1, 2)}
      >
        <span className={styles.subjectTag}>Đạo hàm</span>
      </StepCard>

      <StepCard
        number="2"
        tone="blue"
        icon={Pencil}
        title="Luyện ngay"
        className={styles.desktopStepTwo}
        revealed={phase >= 3}
        active={isActivePhase(phase, 3, 4)}
      >
        <p className={styles.answerChoice}>
          Câu 04 · B <X size={16} strokeWidth={2.6} aria-label="Sai" />
        </p>
      </StepCard>

      <AnalysisModule
        className={styles.desktopAnalysis}
        revealed={phase >= 5}
        active={isActivePhase(phase, 5, 6)}
      />

      <StepCard
        number="4"
        tone="orange"
        icon={CheckCircle2}
        title="Luyện lại"
        className={styles.desktopStepFour}
        revealed={phase >= 7}
        active={isActivePhase(phase, 7, 8)}
      >
        <p className={styles.answerChoice}>
          Câu 04 · C <Check size={17} strokeWidth={2.8} aria-label="Đúng" />
        </p>
      </StepCard>

      <GoalNode
        className={styles.desktopGoal}
        revealed={phase >= GOAL_PHASE}
        active={phase === GOAL_PHASE}
      />
    </div>
  );
}

function MobileLoop({ pathId, phase }: { pathId: string; phase: number }) {
  return (
    <div className={styles.mobileLoop} aria-label="Vòng học thích ứng của Tú Tài">
      <svg className={styles.mobileLoopSvg} viewBox="0 0 350 420" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={pathId} x1="35" y1="54" x2="250" y2="464">
            <stop stopColor="#1768ff" />
            <stop offset="0.55" stopColor="#29a7ee" />
            <stop offset="1" stopColor="#075cf4" />
          </linearGradient>
          <marker
            id={`${pathId}-arrow`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5.5"
            markerHeight="5.5"
            orient="auto-start-reverse"
          >
            <path
              d="M1 1L9 5L1 9"
              fill="none"
              stroke="#1685f2"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>
        <g className={styles.mobileAmbientRings}>
          <circle cx="175" cy="222" r="82" />
          <circle cx="175" cy="222" r="132" />
        </g>
        <g
          className={styles.mobilePaths}
          stroke={`url(#${pathId})`}
          markerEnd={`url(#${pathId}-arrow)`}
        >
          {[
            'M151 64C169 64 181 64 199 64',
            'M268 108C268 128 231 141 198 153',
            'M151 284C127 297 101 309 86 328',
          ].map((path, index) => (
            <path
              key={path}
              d={path}
              data-revealed={phase >= CONNECTOR_PHASES[index]}
              data-active={phase === CONNECTOR_PHASES[index]}
            />
          ))}
        </g>
      </svg>

      <div className={styles.mobileLoopContent}>
        <div className={`${styles.mobileStepRow} ${styles.mobileTopRow}`}>
          <StepCard
            number="1"
            tone="purple"
            icon={BookOpen}
            title="Học bài"
            className={styles.mobileStepOne}
            revealed={phase >= 1}
            active={isActivePhase(phase, 1, 2)}
          >
            <span className={styles.subjectTag}>Đạo hàm</span>
          </StepCard>

          <StepCard
            number="2"
            tone="blue"
            icon={Pencil}
            title="Luyện ngay"
            className={styles.mobileStepTwo}
            revealed={phase >= 3}
            active={isActivePhase(phase, 3, 4)}
          >
            <p className={styles.answerChoice}>
              Câu 04 · B <X size={13} strokeWidth={2.6} aria-label="Sai" />
            </p>
          </StepCard>
        </div>

        <div className={styles.mobileAnalysisRow}>
          <AnalysisModule
            className={styles.mobileAnalysis}
            revealed={phase >= 5}
            active={isActivePhase(phase, 5, 6)}
          />
        </div>

        <div className={`${styles.mobileStepRow} ${styles.mobileBottomRow}`}>
          <StepCard
            number="4"
            tone="orange"
            icon={CheckCircle2}
            title="Luyện lại"
            className={styles.mobileStepFour}
            revealed={phase >= 7}
            active={isActivePhase(phase, 7, 8)}
          >
            <p className={styles.answerChoice}>
              Câu 04 · C <Check size={14} strokeWidth={2.8} aria-label="Đúng" />
            </p>
          </StepCard>

          <div className={styles.mobileGoalCell}>
            <GoalNode
              className={styles.mobileGoal}
              revealed={phase >= GOAL_PHASE}
              active={phase === GOAL_PHASE}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProblemStatement() {
  const instanceId = useId().replace(/:/g, '');
  const sectionRef = useRef<HTMLElement>(null);
  const hasPlayedRef = useRef(false);
  const [isVisible, setIsVisible] = useState(false);
  const [phase, setPhase] = useState(-1);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', updatePreference);

    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasPlayedRef.current) return;
        hasPlayedRef.current = true;
        setIsVisible(true);
        setPhase(0);
        observer.disconnect();
      },
      // Reveal once the section's top is in the lower part of the viewport. A share of
      // the section's height is too late on phones, where the section is tall.
      { rootMargin: '0px 0px -22% 0px' }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (phase < 0 || phase >= SEQUENCE_END) return;

    const standardDelays = [900, 900, 620, 950, 620, 1200, 620, 900, 620, 800];
    const reducedDelays = [280, 220, 100, 220, 100, 280, 100, 220, 100, 220];
    const delays = prefersReducedMotion ? reducedDelays : standardDelays;
    const timer = window.setTimeout(() => setPhase((current) => current + 1), delays[phase]);

    return () => window.clearTimeout(timer);
  }, [phase, prefersReducedMotion]);

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      data-visible={isVisible}
      data-sequence-complete={phase >= SEQUENCE_END}
      aria-labelledby="learning-loop-heading"
    >
      <div className={styles.backgroundArcs} aria-hidden="true" />
      <div className={styles.container}>
        <div className={styles.editorial}>
          <p className={styles.eyebrow}>CÁCH HỌC</p>

          <h2 id="learning-loop-heading" className={styles.heading}>
            <span>Học để hiểu.</span>
            <span>Luyện để nhớ lâu.</span>
          </h2>

          <p className={styles.description}>
            Học xong lý thuyết là làm bài ngay. Câu sai có lời giải, luyện lại đến khi đúng 80% là
            xong bài.
          </p>
        </div>

        <DesktopLoop
          pathId={`desktop-loop-${instanceId}`}
          glowId={`desktop-glow-${instanceId}`}
          phase={phase}
        />
        <MobileLoop pathId={`mobile-loop-${instanceId}`} phase={phase} />
      </div>
    </section>
  );
}
