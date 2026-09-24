import 'server-only';

import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { seededRoadmapDefinition, simulateRoadmap } from './roadmap-definition';
import {
  calculateRoadmapProgress,
  type CompleteActivityInput,
  type RoadmapActivity,
  type RoadmapPhase,
  type StudentRoadmap,
} from './types';

export interface TopicEvidence {
  topicId: string;
  correct: number;
  total: number;
}
export interface CompetencyState {
  topicId: string;
  mastery: number;
  evidenceCount: number;
  updatedAt: string;
}
export interface DiagnosticAttempt {
  id: string;
  submissionId?: string;
  targetScore: number;
  evidence: TopicEvidence[];
  submittedAt: string;
}
export interface ActivityOutcome {
  id: string;
  activityId: string;
  score?: number;
  accuracy?: number;
  outcome: 'passed' | 'remediation';
  submittedAt: string;
}
export interface OverrideAudit {
  id: string;
  actorId: string;
  rationale: string;
  progressPolicy: 'retain' | 'map' | 'reset';
  previousDefinitionVersion: string;
  nextDefinitionVersion: string;
  createdAt: string;
}
export interface RoadmapAssignment {
  definitionId: string;
  definitionVersion: string;
  source: 'diagnostic' | 'admin';
  rationale: string;
  assignedAt: string;
  evidence: TopicEvidence[];
}
type StoredRoadmap = {
  studentId: string;
  roadmap: StudentRoadmap;
  assignment: RoadmapAssignment;
  diagnosticAttempts: DiagnosticAttempt[];
  competencies: CompetencyState[];
  activityOutcomes: ActivityOutcome[];
  overrideAudit: OverrideAudit[];
  completedRequestIds: string[];
};
let queue: Promise<void> = Promise.resolve();

function filePath() {
  return (
    process.env.TUTAI_ROADMAPS_FILE ??
    path.join(
      /* turbopackIgnore: true */ process.cwd(),
      'data',
      'roadmaps',
      'student-roadmaps.json'
    )
  );
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
async function readAll(): Promise<StoredRoadmap[]> {
  const file = filePath();
  try {
    return JSON.parse(
      await fs.readFile(/* turbopackIgnore: true */ file, 'utf8')
    ) as StoredRoadmap[];
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}
async function writeAll(records: StoredRoadmap[]) {
  const file = filePath();
  const directory = path.dirname(file);
  await fs.mkdir(/* turbopackIgnore: true */ directory, { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(
    /* turbopackIgnore: true */ temporary,
    JSON.stringify(records, null, 2),
    'utf8'
  );
  await fs.rename(/* turbopackIgnore: true */ temporary, /* turbopackIgnore: true */ file);
}
async function mutate<T>(operation: (records: StoredRoadmap[]) => T | Promise<T>): Promise<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const result = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  queue = queue
    .catch(() => undefined)
    .then(async () => {
      try {
        const records = await readAll();
        const value = await operation(records);
        await writeAll(records);
        resolve(value);
      } catch (error) {
        reject(error);
      }
    });
  return result;
}

function buildRoadmap(
  studentId: string,
  targetScore: number,
  evidence: TopicEvidence[]
): StudentRoadmap {
  const weak = evidence.some((item) => item.total > 0 && item.correct / item.total < 0.7);
  const strong =
    evidence.length > 0 &&
    evidence.every((item) => item.total > 0 && item.correct / item.total >= 0.8);
  const completedStepIds = strong ? ['step-derivative', 'step-substitution'] : [];
  const simulation = simulateRoadmap(seededRoadmapDefinition, {
    id: studentId,
    label: studentId,
    completedStepIds,
    weakTags: weak ? ['dao-ham'] : [],
  });
  const phases: RoadmapPhase[] = simulation.stages.map((stage) => ({
    id: stage.id,
    roadmapId: `assignment-${studentId}`,
    order: stage.order,
    title: stage.title,
    description: stage.description ?? '',
    topics: stage.steps.map((step) => step.title),
    outcome: stage.description ?? stage.title,
    status:
      stage.progress === 100
        ? 'completed'
        : stage.steps.some((step) => step.state === 'current')
          ? 'active'
          : 'locked',
    weeks: [
      {
        id: `week-${stage.id}`,
        phaseId: stage.id,
        order: 1,
        title: stage.title,
        status:
          stage.progress === 100
            ? 'completed'
            : stage.steps.some((step) => step.state === 'current')
              ? 'active'
              : 'locked',
        completedActivities: stage.steps.filter((step) => step.state === 'completed').length,
        totalActivities: stage.steps.length,
        activities: stage.steps.map((step) => ({
          id: step.id,
          weekId: `week-${stage.id}`,
          order: step.order,
          type: step.type,
          title: step.title,
          estimatedMinutes: step.estimatedMinutes,
          contentRef: step.contentRef,
          status:
            step.state === 'completed'
              ? 'completed'
              : step.state === 'current'
                ? 'available'
                : 'locked',
        })),
      },
    ],
  }));
  const now = new Date().toISOString();
  const current = phases
    .flatMap((phase) => phase.weeks)
    .flatMap((week) => week.activities)
    .find((activity) => activity.status === 'available');
  return {
    id: `assignment-${studentId}`,
    studentId,
    subject: { id: 'math-12', code: 'MATH12', name: 'Toán' },
    targetScore,
    dailyStudyMinutes: 30,
    estimatedWeeks: 12,
    status: 'active',
    currentPhaseId: current
      ? (phases.find((phase) =>
          phase.weeks.some((week) => week.activities.some((activity) => activity.id === current.id))
        )?.id ?? null)
      : null,
    currentWeekId: current?.weekId ?? null,
    currentActivityId: current?.id ?? null,
    phases,
    progress: calculateRoadmapProgress(phases),
    createdAt: now,
    updatedAt: now,
  };
}

export async function getOwnedRoadmap(studentId: string): Promise<StudentRoadmap | null> {
  return clone((await readAll()).find((item) => item.studentId === studentId)?.roadmap ?? null);
}
export async function getOwnedAssignment(studentId: string): Promise<RoadmapAssignment | null> {
  return clone((await readAll()).find((item) => item.studentId === studentId)?.assignment ?? null);
}
export async function getOwnedLearningState(studentId: string) {
  const record = (await readAll()).find((item) => item.studentId === studentId);
  if (!record) return null;
  return clone({
    diagnosticAttempts: record.diagnosticAttempts ?? [],
    competencies: record.competencies ?? [],
    activityOutcomes: record.activityOutcomes ?? [],
    overrideAudit: record.overrideAudit ?? [],
  });
}
export async function assignFromDiagnostic(input: {
  studentId: string;
  targetScore: number;
  evidence: TopicEvidence[];
  submissionId?: string;
}) {
  if (
    !input.evidence.length ||
    (input.submissionId !== undefined && !input.submissionId.trim()) ||
    input.evidence.some((item) => item.total < 1 || item.correct < 0 || item.correct > item.total)
  )
    throw new Error('INVALID_DIAGNOSTIC');
  return mutate((records) => {
    const existing = records.find((item) => item.studentId === input.studentId);
    if (existing) {
      const duplicate = input.submissionId
        ? existing.diagnosticAttempts?.find(
            (attempt) => attempt.submissionId === input.submissionId
          )
        : undefined;
      if (duplicate)
        return {
          roadmap: clone(existing.roadmap),
          assignment: clone(existing.assignment),
          diagnosticAttempt: clone(duplicate),
          competencies: clone(existing.competencies ?? []),
        };
      throw new Error('ALREADY_ASSIGNED');
    }
    const weak = input.evidence
      .filter((item) => item.correct / item.total < 0.7)
      .map((item) => item.topicId);
    const now = new Date().toISOString();
    const assignment: RoadmapAssignment = {
      definitionId: seededRoadmapDefinition.id,
      definitionVersion: seededRoadmapDefinition.updatedAt,
      source: 'diagnostic',
      rationale: weak.length
        ? `Bắt đầu từ kiến thức nền do còn yếu: ${weak.join(', ')}.`
        : 'Kết quả chẩn đoán vững; bắt đầu ở phần luyện tập phù hợp mục tiêu.',
      assignedAt: now,
      evidence: clone(input.evidence),
    };
    const roadmap = buildRoadmap(input.studentId, input.targetScore, input.evidence);
    const diagnosticAttempt: DiagnosticAttempt = {
      id: randomUUID(),
      submissionId: input.submissionId,
      targetScore: input.targetScore,
      evidence: clone(input.evidence),
      submittedAt: now,
    };
    const competencies = input.evidence.map((item) => ({
      topicId: item.topicId,
      mastery: Math.round((item.correct / item.total) * 100),
      evidenceCount: item.total,
      updatedAt: now,
    }));
    records.push({
      studentId: input.studentId,
      roadmap,
      assignment,
      diagnosticAttempts: [diagnosticAttempt],
      competencies,
      activityOutcomes: [],
      overrideAudit: [],
      completedRequestIds: [],
    });
    return {
      roadmap: clone(roadmap),
      assignment: clone(assignment),
      diagnosticAttempt: clone(diagnosticAttempt),
      competencies: clone(competencies),
    };
  });
}

export async function transitionOwnedActivity(input: {
  studentId: string;
  roadmapId: string;
  activityId: string;
  action: 'start' | 'complete';
  requestId?: string;
  result?: CompleteActivityInput;
}): Promise<RoadmapActivity> {
  return mutate((records) => {
    const record = records.find((item) => item.studentId === input.studentId);
    if (!record || record.roadmap.id !== input.roadmapId) throw new Error('ROADMAP_NOT_FOUND');
    const activities = record.roadmap.phases
      .flatMap((phase) => phase.weeks)
      .flatMap((week) => week.activities);
    const activity = activities.find((item) => item.id === input.activityId);
    if (!activity) throw new Error('ACTIVITY_NOT_FOUND');
    if (input.requestId && record.completedRequestIds.includes(input.requestId))
      return clone(activity);
    if (activity.status === 'locked') throw new Error('ACTIVITY_LOCKED');
    const now = new Date().toISOString();
    if (input.action === 'start') {
      if (activity.status !== 'completed') activity.status = 'in_progress';
      activity.progress = { ...activity.progress, startedAt: activity.progress?.startedAt ?? now };
    } else {
      const accuracy = input.result?.accuracy ?? input.result?.score;
      const passed = accuracy === undefined || accuracy >= 0.7;
      record.activityOutcomes ??= [];
      record.competencies ??= [];
      record.activityOutcomes.push({
        id: input.requestId ?? randomUUID(),
        activityId: activity.id,
        score: input.result?.score,
        accuracy: input.result?.accuracy,
        outcome: passed ? 'passed' : 'remediation',
        submittedAt: now,
      });
      for (const reference of activity.knowledgeRefs ?? []) {
        const existing = record.competencies.find(
          (item) => item.topicId === reference.knowledgeNodeId
        );
        const mastery = Math.round((accuracy ?? 1) * 100);
        if (existing) {
          existing.mastery = Math.round(
            (existing.mastery * existing.evidenceCount + mastery) / (existing.evidenceCount + 1)
          );
          existing.evidenceCount += 1;
          existing.updatedAt = now;
        } else
          record.competencies.push({
            topicId: reference.knowledgeNodeId,
            mastery,
            evidenceCount: 1,
            updatedAt: now,
          });
      }
      activity.progress = { ...activity.progress, ...input.result };
      if (passed) {
        activity.status = 'completed';
        activity.progress.completedAt = activity.progress.completedAt ?? now;
        const next = activities.find((item) => item.status === 'locked');
        if (next) next.status = 'available';
      } else {
        activity.status = 'available';
        delete activity.progress.completedAt;
      }
    }
    if (input.requestId) record.completedRequestIds.push(input.requestId);
    record.roadmap.progress = calculateRoadmapProgress(record.roadmap.phases);
    record.roadmap.currentActivityId =
      activities.find((item) => item.status === 'in_progress' || item.status === 'available')?.id ??
      null;
    record.roadmap.updatedAt = now;
    return clone(activity);
  });
}
