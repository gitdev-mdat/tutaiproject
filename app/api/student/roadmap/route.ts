import { NextResponse } from 'next/server';
import { requireDemoStudentSession } from '@/lib/auth/demo-session';
import {
  getOwnedAssignment,
  getOwnedLearningState,
  getOwnedRoadmap,
} from '@/features/roadmap/lib/roadmap-storage';
import {
  deriveStudentDashboard,
  seededRoadmapDefinition,
} from '@/features/roadmap/lib/roadmap-definition';

export async function GET() {
  try {
    const student = await requireDemoStudentSession();
    const [roadmap, assignment, learningState] = await Promise.all([
      getOwnedRoadmap(student.id),
      getOwnedAssignment(student.id),
      getOwnedLearningState(student.id),
    ]);
    if (!roadmap)
      return NextResponse.json({
        roadmap: null,
        dashboard: null,
        assignment: null,
        learningState: null,
      });
    const completedStepIds = roadmap.phases
      .flatMap((phase) => phase.weeks)
      .flatMap((week) => week.activities)
      .filter((activity) => activity.status === 'completed')
      .map((activity) => activity.id);
    const weakTags =
      assignment?.evidence
        .filter((item) => item.correct / item.total < 0.7)
        .map((item) => item.topicId) ?? [];
    const dashboard = deriveStudentDashboard(seededRoadmapDefinition, {
      id: student.id,
      label: student.name,
      completedStepIds,
      inProgressStepId: roadmap.currentActivityId ?? undefined,
      weakTags,
    });
    return NextResponse.json({ roadmap, dashboard, assignment, learningState });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized')
      return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
    return NextResponse.json({ error: 'Không thể tải lộ trình.' }, { status: 500 });
  }
}
