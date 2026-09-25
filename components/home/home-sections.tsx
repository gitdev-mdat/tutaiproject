'use client';

import { Suspense } from 'react';

import { PublicHeader } from '@/components/layout';
import { HeroKnowledgeAtlas } from '@/components/home/hero-knowledge-atlas';
import { ProblemStatement } from '@/components/home/problem-statement';
import { TransformationSection } from '@/components/home/transformation-section';
import { SubjectProofSection } from '@/components/home/subject-proof-section';

import { CompetitionSection } from '@/components/home/competition-section';
import { PricingPreview } from '@/components/home/pricing-preview';
import styles from './home-sections.module.css';

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
