import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { PracticeSession } from '@/components/exam-sets/practice-session';
import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { safeReturnPath } from '@/lib/auth/safe-return-path';
import { CURRICULUM_EXAM_SETS } from '@/lib/exam-sets/curriculum-data';
import type { CurriculumExamSet, ExamSessionMode } from '@/lib/exam-sets/types';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    source?: string;
    restart?: string;
    mode?: string;
    knowledgeNodeId?: string;
    experience?: string;
    experienceId?: string;
    experienceTitle?: string;
    rankingEligible?: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const examSet = CURRICULUM_EXAM_SETS.find((item) => item.slug === slug);
  return {
    title: examSet ? `Đang luyện: ${examSet.title}` : 'Bộ đề không tìm thấy',
    description: examSet?.description,
  };
}

export default async function ExamPracticePage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const examSet = CURRICULUM_EXAM_SETS.find((item) => item.slug === slug);
  if (!examSet) notFound();

  const source = safeReturnPath(query.source, '/exam-sets');
  const mode: ExamSessionMode = query.mode === 'EXAM_SIMULATION' ? 'EXAM_SIMULATION' : 'PRACTICE';
  const knowledgeNodeId = query.knowledgeNodeId?.trim() || undefined;
  const experienceKind =
    query.experience === 'practice' || query.experience === 'exam' || query.experience === 'arena'
      ? query.experience
      : undefined;
  const returnParams = new URLSearchParams({ source, mode });
  if (knowledgeNodeId) returnParams.set('knowledgeNodeId', knowledgeNodeId);
  if (experienceKind && query.experienceId && query.experienceTitle) {
    returnParams.set('experience', experienceKind);
    returnParams.set('experienceId', query.experienceId);
    returnParams.set('experienceTitle', query.experienceTitle);
    returnParams.set('rankingEligible', query.rankingEligible === '1' ? '1' : '0');
  }
  const returnTo = `/exam-sets/${slug}/practice?${returnParams.toString()}`;
  const session = await getDemoStudentSession();

  if (!session) {
    redirect(
      `/auth/login?intent=practice&exam=${encodeURIComponent(slug)}&source=${encodeURIComponent(
        source
      )}&returnTo=${encodeURIComponent(returnTo)}`
    );
  }

  const hasPlus = false;
  if (examSet.tier === 'SPECIAL' && !hasPlus) {
    redirect(`/exam-sets/${slug}`);
  }

  const restart = query.restart === '1';
  const startQuestion = restart ? 1 : (examSet.resumeQuestion ?? 1);

  return (
    <main className="min-h-screen bg-[#F7F9FC] text-[#0A1628]">
      <PracticeSession
        examSet={examSet}
        startQuestion={startQuestion}
        restart={restart}
        source={source}
        mode={mode}
        knowledgeNodeId={knowledgeNodeId}
        questions={
          (
            examSet as CurriculumExamSet & {
              questions?: readonly {
                content: string;
                options: readonly { id: string; label: string }[];
                correctAnswer: string;
                primaryKnowledgeNodeId?: string;
                knowledgePath?: readonly string[];
                explanationParts?: readonly {
                  type: 'text' | 'signTable' | 'conclusion';
                  content?: string;
                }[];
              }[];
            }
          ).questions
        }
        experience={
          experienceKind && query.experienceId && query.experienceTitle
            ? {
                kind: experienceKind,
                activityId: query.experienceId,
                title: query.experienceTitle,
                rankingEligible: query.rankingEligible === '1',
              }
            : undefined
        }
      />
    </main>
  );
}
