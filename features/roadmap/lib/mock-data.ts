import type {
  RoadmapActivityStatus,
  RoadmapPhaseStatus,
  StudentRoadmap,
  StudentRoadmapDashboard,
} from './types';
import {
  ROADMAP_STUDENT_FIXTURES,
  deriveStudentDashboard,
  seededRoadmapDefinition,
  simulateRoadmap,
  type RoadmapStepState,
} from './roadmap-definition';

/**
 * Student fixtures are projections of the published Admin definition. Keeping
 * this adapter at the mock repository boundary prevents the legacy week model
 * and the dashboard from drifting while a real API is not available.
 */
export function deriveStudentRoadmap(): StudentRoadmap {
  const definition = seededRoadmapDefinition;
  const student = ROADMAP_STUDENT_FIXTURES[1];
  const simulation = simulateRoadmap(definition, student);
  const activityStatus = (state: RoadmapStepState): RoadmapActivityStatus =>
    state === 'current' ? 'in_progress' : state === 'next' ? 'available' : state;
  const phaseStatus = (progress: number, hasCurrent: boolean): RoadmapPhaseStatus =>
    progress === 100 ? 'completed' : hasCurrent ? 'active' : progress > 0 ? 'available' : 'locked';
  const phases = simulation.stages.map((stage) => {
    const hasCurrent = stage.steps.some((step) => step.state === 'current');
    const completedActivities = stage.steps.filter((step) => step.state === 'completed').length;
    return {
      id: stage.id,
      roadmapId: definition.id,
      order: stage.order,
      title: stage.title,
      description: stage.description ?? '',
      topics: stage.steps.map((step) => step.title),
      outcome: `Hoàn thành ${stage.title.toLocaleLowerCase('vi-VN')}`,
      status: phaseStatus(stage.progress, hasCurrent),
      weeks: [
        {
          id: `${stage.id}-activities`,
          phaseId: stage.id,
          order: 1,
          title: stage.title,
          description: stage.description,
          status: phaseStatus(stage.progress, hasCurrent),
          completedActivities,
          totalActivities: stage.steps.length,
          activities: stage.steps.map((step) => ({
            id: step.id,
            weekId: `${stage.id}-activities`,
            order: step.order,
            type: step.type,
            title: step.title,
            estimatedMinutes: step.estimatedMinutes,
            status: activityStatus(step.state),
            contentRef: step.contentRef,
            progress:
              step.state === 'completed' ? { completedAt: definition.updatedAt } : undefined,
          })),
        },
      ],
    };
  });
  const steps = simulation.stages.flatMap((stage) => stage.steps);
  const required = steps.filter((step) => step.required);
  const completed = required.filter((step) => step.state === 'completed').length;
  const active = steps.find((step) => step.state === 'current');
  const activeStage = simulation.stages.find((stage) =>
    stage.steps.some((step) => step.id === active?.id)
  );
  return {
    id: definition.id,
    studentId: 'student-demo',
    subject: {
      id: `${definition.subject.toLowerCase()}-${definition.grade}`,
      code: `GRADE${definition.grade}`,
      name: definition.subject,
    },
    targetScore: definition.targetScore ?? 10,
    baselineScore: 5.2,
    dailyStudyMinutes: active?.estimatedMinutes ?? 15,
    estimatedWeeks: definition.stages.length,
    status: simulation.overallProgress === 100 ? 'completed' : 'active',
    currentPhaseId: activeStage?.id ?? null,
    currentWeekId: activeStage ? `${activeStage.id}-activities` : null,
    currentActivityId: active?.id ?? null,
    phases,
    progress: {
      completedActivities: completed,
      totalActivities: required.length,
      percentage: simulation.overallProgress,
    },
    createdAt: definition.updatedAt,
    updatedAt: definition.updatedAt,
  };
}

export const mockStudentRoadmapDashboard: StudentRoadmapDashboard = deriveStudentDashboard(
  seededRoadmapDefinition,
  ROADMAP_STUDENT_FIXTURES[1]
);

export const mockStudentRoadmap: StudentRoadmap = deriveStudentRoadmap();
