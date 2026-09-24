import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PublicHeader } from '@/components/layout';
import { PublicFooter } from '@/components/layout';
import { ExamSetsClient } from '@/components/exam-sets/exam-sets-client';
import { isDemoStudentAuthenticated } from '@/lib/auth/demo-session';

import pageStyles from './page.module.css';

export const metadata: Metadata = {
  title: 'Luyện đề theo chương trình | Tú Tài',
  description:
    'Luyện đề Toán 12 theo bài, theo chương, theo học kỳ và theo phạm vi kỳ thi THPT Quốc gia.',
};

/**
 * /exam-sets — Exam set discovery page.
 *
 * Architecture:
 * - Server Component: imports data and passes typed props to ExamSetsClient.
 * - Swap `publishedExamSets` with an async fetch when the real API is ready.
 *   The ExamSetsClient interface stays unchanged.
 */
export default async function ExamSetsPage() {
  const isAuthenticated = await isDemoStudentAuthenticated();

  return (
    <div className={`${pageStyles.pageFrame} flex min-h-screen flex-col`}>
      {/* Keep the established desktop canvas; mobile exposes the page background around the card. */}
      <div className="bg-transparent lg:bg-[linear-gradient(180deg,#0C1E3C_0%,#0A1835_100%)]">
        <PublicHeader />
      </div>
      <main id="main-content" className="flex-1" tabIndex={-1}>
        <Suspense>
          <ExamSetsClient isAuthenticated={isAuthenticated} hasPlus={false} />
        </Suspense>
      </main>
      <PublicFooter />
    </div>
  );
}
