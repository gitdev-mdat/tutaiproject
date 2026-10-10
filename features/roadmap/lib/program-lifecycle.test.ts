import { describe, expect, it } from 'vitest';
import { seededRoadmapDefinition } from './roadmap-definition';
import {
  createEnrollment,
  LifecycleError,
  replanTarget,
  resolveProgramVersion,
  transitionProgramVersion,
  updateProgramVersion,
  validateProgramVersion,
  type AssignmentRule,
  type ProgramVersion,
} from './program-lifecycle';

const version = (status: ProgramVersion['status'] = 'PUBLISHED'): ProgramVersion => ({
  id: 'v-2026.1',
  programId: 'grade-12',
  version: '2026.1',
  status,
  definition: structuredClone(seededRoadmapDefinition),
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  masteryThreshold: 70,
});
const rule = (id: string, priority: number): AssignmentRule => ({
  id,
  programVersionId: 'v-2026.1',
  enabled: true,
  priority,
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  grade: 12,
  curriculumId: 'gdpt',
});
const now = '2026-06-01T00:00:00.000Z';

describe('program lifecycle', () => {
  it('publishes only valid reviewed versions and records the actor', () => {
    const reviewed = version('READY_FOR_REVIEW');
    const published = transitionProgramVersion(reviewed, 'PUBLISHED', 'admin-1', now);
    expect(published).toMatchObject({
      status: 'PUBLISHED',
      publishedBy: 'admin-1',
      publishedAt: now,
    });
    const broken = version('READY_FOR_REVIEW');
    broken.definition.stages[0].steps[0].contentRef = undefined;
    expect(validateProgramVersion(broken).length).toBeGreaterThan(0);
    expect(() => transitionProgramVersion(broken, 'PUBLISHED', 'admin-1', now)).toThrowError(
      expect.objectContaining({ code: 'PUBLISH_VALIDATION_FAILED' })
    );
  });

  it('makes published versions immutable and retirement one-way', () => {
    expect(() => updateProgramVersion(version(), { version: 'changed' })).toThrowError(
      expect.objectContaining({ code: 'PUBLISHED_VERSION_IMMUTABLE' })
    );
    const retired = transitionProgramVersion(version(), 'RETIRED', 'admin', now);
    expect(retired.status).toBe('RETIRED');
    expect(() => transitionProgramVersion(retired, 'PUBLISHED', 'admin', now)).toThrowError(
      expect.objectContaining({ code: 'INVALID_VERSION_TRANSITION' })
    );
  });

  it('selects the unique highest priority and reports no-match or conflict', () => {
    const selected = resolveProgramVersion(
      { grade: 12, curriculumId: 'gdpt' },
      [rule('low', 1), rule('high', 10)],
      [version()],
      now
    );
    expect(selected.rule.id).toBe('high');
    expect(() =>
      resolveProgramVersion({ grade: 11 }, [rule('only', 1)], [version()], now)
    ).toThrowError(expect.objectContaining({ code: 'NO_ELIGIBLE_PROGRAM' }));
    expect(() =>
      resolveProgramVersion(
        { grade: 12, curriculumId: 'gdpt' },
        [rule('a', 5), rule('b', 5)],
        [version()],
        now
      )
    ).toThrowError(expect.objectContaining({ code: 'ASSIGNMENT_CONFLICT' }));
  });

  it('pins enrollment idempotently and replans target without migrating versions', () => {
    const resolved = { rule: rule('selected', 10), version: version() };
    const first = createEnrollment('student-1', 8.5, resolved, undefined, now);
    const retry = createEnrollment('student-1', 9, resolved, first, '2026-07-01T00:00:00.000Z');
    expect(retry).toEqual(first);
    const changed = replanTarget(first, 9, '2026-07-01T00:00:00.000Z');
    expect(changed.id).toBe(first.id);
    expect(changed.programVersionId).toBe('v-2026.1');
    expect(changed.targetScore).toBe(9);
  });

  it('never enrolls into a draft', () => {
    expect(() =>
      resolveProgramVersion(
        { grade: 12, curriculumId: 'gdpt' },
        [rule('draft-rule', 1)],
        [version('DRAFT')],
        now
      )
    ).toThrowError(LifecycleError);
  });
});
