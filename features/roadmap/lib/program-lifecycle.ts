import type { RoadmapDefinition, RoadmapValidationIssue } from './roadmap-definition';
import { validateRoadmap } from './roadmap-definition';

export type ProgramVersionStatus = 'DRAFT' | 'READY_FOR_REVIEW' | 'PUBLISHED' | 'RETIRED';

export interface Program {
  id: string;
  name: string;
  academicYear: string;
  curriculumId: string;
  grade: number;
}

export interface ProgramVersion {
  id: string;
  programId: string;
  version: string;
  status: ProgramVersionStatus;
  definition: RoadmapDefinition;
  effectiveFrom: string;
  effectiveUntil?: string;
  publishedAt?: string;
  publishedBy?: string;
  masteryThreshold: number;
}

export interface AssignmentRule {
  id: string;
  programVersionId: string;
  enabled: boolean;
  priority: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  grade: number;
  curriculumId?: string;
  academicYear?: string;
}

export interface EligibilityProfile {
  grade: number;
  curriculumId?: string;
  academicYear?: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  programVersionId: string;
  assignmentRuleId: string;
  targetScore: number;
  createdAt: string;
  updatedAt: string;
}

export class LifecycleError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

const dateIsActive = (from: string, until: string | undefined, now: string) =>
  from <= now && (!until || now <= until);

/** Deterministic assignment: equal highest priorities are a conflict, never a row-order fallback. */
export function resolveProgramVersion(
  profile: EligibilityProfile,
  rules: AssignmentRule[],
  versions: ProgramVersion[],
  now = new Date().toISOString()
): { rule: AssignmentRule; version: ProgramVersion } {
  const byId = new Map(versions.map((version) => [version.id, version]));
  const matches = rules.filter((rule) => {
    const version = byId.get(rule.programVersionId);
    return Boolean(
      rule.enabled &&
      rule.grade === profile.grade &&
      (!rule.curriculumId || rule.curriculumId === profile.curriculumId) &&
      (!rule.academicYear || rule.academicYear === profile.academicYear) &&
      dateIsActive(rule.effectiveFrom, rule.effectiveUntil, now) &&
      version?.status === 'PUBLISHED' &&
      dateIsActive(version.effectiveFrom, version.effectiveUntil, now)
    );
  });
  if (!matches.length) throw new LifecycleError('NO_ELIGIBLE_PROGRAM');
  const priority = Math.max(...matches.map((rule) => rule.priority));
  const winners = matches.filter((rule) => rule.priority === priority);
  if (winners.length !== 1) throw new LifecycleError('ASSIGNMENT_CONFLICT');
  return { rule: winners[0], version: byId.get(winners[0].programVersionId)! };
}

export function validateProgramVersion(version: ProgramVersion): RoadmapValidationIssue[] {
  const issues = validateRoadmap(version.definition);
  if (!version.version.trim()) issues.push({ path: 'version', message: 'Cần nhập mã phiên bản.' });
  if (!(version.masteryThreshold > 0 && version.masteryThreshold <= 100))
    issues.push({ path: 'masteryThreshold', message: 'Ngưỡng thành thạo phải từ 1 đến 100.' });
  if (version.effectiveUntil && version.effectiveUntil < version.effectiveFrom)
    issues.push({ path: 'effectiveUntil', message: 'Ngày kết thúc phải sau ngày bắt đầu.' });
  const required = version.definition.stages
    .flatMap((stage) => stage.steps)
    .filter((step) => step.required);
  if (!required.some((step) => step.type === 'lesson'))
    issues.push({ path: 'stages', message: 'Chương trình cần ít nhất một bài học bắt buộc.' });
  if (!required.some((step) => step.type === 'practice' || step.type === 'quiz'))
    issues.push({ path: 'stages', message: 'Chương trình cần luyện tập bắt buộc.' });
  return issues;
}

export function transitionProgramVersion(
  version: ProgramVersion,
  next: ProgramVersionStatus,
  actorId: string,
  now = new Date().toISOString()
): ProgramVersion {
  const allowed: Record<ProgramVersionStatus, ProgramVersionStatus[]> = {
    DRAFT: ['READY_FOR_REVIEW'],
    READY_FOR_REVIEW: ['DRAFT', 'PUBLISHED'],
    PUBLISHED: ['RETIRED'],
    RETIRED: [],
  };
  if (!allowed[version.status].includes(next))
    throw new LifecycleError('INVALID_VERSION_TRANSITION');
  if (next === 'PUBLISHED' && validateProgramVersion(version).length)
    throw new LifecycleError('PUBLISH_VALIDATION_FAILED');
  return {
    ...structuredClone(version),
    status: next,
    ...(next === 'PUBLISHED' ? { publishedAt: now, publishedBy: actorId } : {}),
  };
}

/** Published structure is immutable; retirement is performed through the state transition. */
export function updateProgramVersion(
  current: ProgramVersion,
  patch: Partial<Omit<ProgramVersion, 'id' | 'programId' | 'status'>>
): ProgramVersion {
  if (current.status === 'PUBLISHED' || current.status === 'RETIRED')
    throw new LifecycleError('PUBLISHED_VERSION_IMMUTABLE');
  return { ...structuredClone(current), ...structuredClone(patch) };
}

/** Transaction callers persist this result atomically. Existing enrollment always wins on retry. */
export function createEnrollment(
  studentId: string,
  targetScore: number,
  resolved: { rule: AssignmentRule; version: ProgramVersion },
  existing: Enrollment | undefined,
  now = new Date().toISOString()
): Enrollment {
  if (existing) return structuredClone(existing);
  if (resolved.version.status !== 'PUBLISHED') throw new LifecycleError('NO_ELIGIBLE_PROGRAM');
  return {
    id: `enrollment:${studentId}:${resolved.version.id}`,
    studentId,
    programVersionId: resolved.version.id,
    assignmentRuleId: resolved.rule.id,
    targetScore,
    createdAt: now,
    updatedAt: now,
  };
}

export function replanTarget(
  enrollment: Enrollment,
  targetScore: number,
  now = new Date().toISOString()
) {
  if (targetScore < 0 || targetScore > 10) throw new LifecycleError('INVALID_TARGET');
  return { ...structuredClone(enrollment), targetScore, updatedAt: now };
}
