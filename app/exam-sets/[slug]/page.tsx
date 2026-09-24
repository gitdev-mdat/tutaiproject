import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { PublicHeader, PublicFooter } from '@/components/layout';
import { EXAM_SETS } from '@/lib/exam-sets/mock-data';
import { CURRICULUM_EXAM_SETS } from '@/lib/exam-sets/curriculum-data';
import { curriculumExamSetToDetail } from '@/lib/exam-sets/detail-adapter';
import {
  ExamSetHero,
  DetailSource,
  DetailMetadata,
  DetailFeatures,
  DetailExamList,
  DetailIntendedFor,
  DetailAccessPanel,
  DetailUncommonPreview,
} from '@/components/exam-sets/detail';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const set =
    EXAM_SETS.find((examSet) => examSet.slug === slug) ??
    CURRICULUM_EXAM_SETS.find((examSet) => examSet.slug === slug);
  if (!set) {
    return { title: 'Bộ đề không tìm thấy | Tú Tài' };
  }
  return {
    title: `${set.title} | Tú Tài`,
    description: set.description,
  };
}

export function generateStaticParams() {
  return [
    ...EXAM_SETS.filter((examSet) => examSet.published).map((examSet) => ({
      slug: examSet.slug,
    })),
    ...CURRICULUM_EXAM_SETS.map((examSet) => ({ slug: examSet.slug })),
  ];
}

export default async function ExamSetDetailPage({ params }: Props) {
  const { slug } = await params;
  const legacySet = EXAM_SETS.find((examSet) => examSet.slug === slug && examSet.published);
  const curriculumSet = CURRICULUM_EXAM_SETS.find((examSet) => examSet.slug === slug);
  const set = legacySet ?? (curriculumSet ? curriculumExamSetToDetail(curriculumSet) : undefined);

  const isSpecial = set && set.accessTier !== 'FREE';

  return (
    <div
      className={
        isSpecial ? 'special-exam-page flex min-h-screen flex-col' : 'flex min-h-screen flex-col'
      }
      style={{
        backgroundColor: isSpecial ? '#F6F8FC' : undefined,
        backgroundImage: !isSpecial
          ? 'radial-gradient(circle at 50% 0%, rgba(23, 104, 255, 0.08), transparent 30%), linear-gradient(180deg, #F4F7FD 0%, #F8FAFD 48%, #F3F7FC 100%)'
          : undefined,
      }}
    >
      <div
        className={isSpecial ? 'special-exam-header' : undefined}
        style={{
          background: isSpecial ? '#071224' : 'linear-gradient(180deg, #0C1E3C 0%, #0A1835 100%)',
          borderBottom: isSpecial ? '1px solid rgba(148, 163, 184, 0.16)' : undefined,
        }}
      >
        <PublicHeader />
      </div>

      <main id="main-content" className="flex-1" tabIndex={-1}>
        {!set ? (
          /* ── 404-like state ── */
          <div
            style={{
              maxWidth: 640,
              margin: '0 auto',
              padding: 'clamp(48px, 8vw, 96px) clamp(16px, 4vw, 48px)',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 15, color: '#64748B', marginBottom: 24 }}>
              Bộ đề này không tồn tại hoặc chưa được công bố.
            </p>
            <Link
              href="/exam-sets"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 14,
                fontWeight: 600,
                color: '#1768FF',
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={14} strokeWidth={2.2} aria-hidden="true" />
              Quay lại Bộ đề
            </Link>
          </div>
        ) : set.accessTier === 'FREE' ? (
          /* ── Detail page ── */
          <div
            style={{
              maxWidth: 1120,
              margin: '0 auto',
              padding: 'clamp(24px, 4vw, 40px) clamp(16px, 4vw, 48px)',
            }}
          >
            <ExamSetHero set={set} />
            <DetailMetadata set={set} />
            <DetailExamList set={set} />
            <DetailIntendedFor intendedFor={set.intendedFor} />
          </div>
        ) : (
          <>
            <section className="special-exam-hero-shell">
              <div className="exam-detail-container exam-detail-hero-container">
                <ExamSetHero set={set} />
              </div>
            </section>

            <div aria-hidden="true" className="hero-to-content-transition" />

            <section className="special-exam-light-content">
              <div className="exam-detail-container special-exam-content-stack">
                <DetailMetadata set={set} />
                <DetailSource set={set} variant="light" />
                <DetailFeatures features={set.features} />
                <DetailUncommonPreview set={set} />
                <DetailExamList set={set} />
                <DetailIntendedFor intendedFor={set.intendedFor} />
                <DetailAccessPanel set={set} />
              </div>
            </section>
          </>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
