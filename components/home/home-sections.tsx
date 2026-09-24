'use client';

import { Suspense } from 'react';
import type { CSSProperties } from 'react';

import { PublicHeader } from '@/components/layout';
import { HeroKnowledgeAtlas } from '@/components/home/hero-knowledge-atlas';
import { ProblemStatement } from '@/components/home/problem-statement';
import { TransformationSection } from '@/components/home/transformation-section';
import { SubjectProofSection } from '@/components/home/subject-proof-section';

import { CompetitionSection } from '@/components/home/competition-section';
import { PricingPreview } from '@/components/home/pricing-preview';
import styles from './home-sections.module.css';

const TRANSITION_PARTICLES = [
  { right: '9%', bottom: '54px', drift: 24, size: 4, color: '#55b9ff', delay: 0 },
  { right: '14%', bottom: '34px', drift: 32, size: 3, color: '#69e4ea', delay: 80 },
  { right: '20%', bottom: '62px', drift: 20, size: 4, color: '#6d9cff', delay: 150 },
  { right: '25%', bottom: '28px', drift: 28, size: 3, color: '#72d7f4', delay: 220 },
  { right: '30%', bottom: '48px', drift: 18, size: 3, color: '#76a7ff', delay: 290 },
] as const;

function HeroBoundaryParticles() {
  return (
    <div className={styles.heroBoundaryParticles} aria-hidden="true">
      {TRANSITION_PARTICLES.map((particle, index) => (
        <i
          key={index}
          style={
            {
              right: particle.right,
              bottom: particle.bottom,
              '--particle-drift': `${particle.drift}px`,
              '--particle-size': `${particle.size}px`,
              '--particle-color': particle.color,
              '--particle-delay': `${particle.delay}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function HeroCurveHandoff() {
  return (
    <svg
      className={styles.heroCurveHandoff}
      viewBox="0 0 1440 64"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path pathLength="1" d="M790 7C1008 7 1240 23 1440 43" />
    </svg>
  );
}

/**
 * HomeSections
 *
 * Native browser scrolling. No wheel interception, no forced section jumps.
 *
 * - PublicHeader lives here so it scrolls away naturally with Hero.
 * - Each section is a plain semantic <section> in document flow.
 * - Section entrance animations are triggered by IntersectionObserver.
 * - The Hero scroll cue scrolls to #knowledge-gps via anchor link.
 */
export function HomeSections() {
  return (
    <>
      <div className={styles.heroFrame}>
        <PublicHeader />
        <section id="hero" className="flex min-h-0 flex-1" aria-label="Giới thiệu Tú Tài">
          <HeroKnowledgeAtlas />
        </section>
        <HeroCurveHandoff />
        <HeroBoundaryParticles />
      </div>

      <section
        id="subjects-proof"
        aria-label="Các môn học trên Tú Tài"
        className={styles.knowledgeSection}
      >
        <SubjectProofSection />
      </section>

      <section
        id="knowledge-gps"
        className={styles.knowledgeSection}
        aria-label="Lộ trình học tập cá nhân hóa"
      >
        <ProblemStatement />
      </section>

      {/* ── 3. Daily experience ── */}
      <section id="transformation" aria-label="Trải nghiệm học tập mỗi ngày với Tú Tài">
        <TransformationSection />
      </section>

      {/* ── 8. Competition Arena (Teaser) ── */}
      <section id="arena" aria-label="Đấu trường Tú Tài">
        <CompetitionSection />
      </section>

      {/* ── 9. Pricing Preview ── */}
      <Suspense fallback={<div style={{ height: '800px' }} />}>
        <PricingPreview />
      </Suspense>
    </>
  );
}
