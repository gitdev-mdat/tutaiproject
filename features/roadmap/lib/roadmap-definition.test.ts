import { describe, expect, it } from 'vitest';
import {
  deriveStudentDashboard,
  seededRoadmapDefinition,
  simulateRoadmap,
  validateRoadmap,
} from './roadmap-definition';

const copy = () => structuredClone(seededRoadmapDefinition);

describe('roadmap definition', () => {
  it('validates structural and scoring errors', () => {
    const definition = copy();
    definition.stages[0].order = definition.stages[1].order;
    definition.stages[0].steps[0].prerequisiteStepIds = [definition.stages[0].steps[0].id];
    definition.stages[0].steps[2].minimumScore = 120;
    const messages = validateRoadmap(definition)
      .map((issue) => issue.message)
      .join(' ');
    expect(messages).toContain('Thứ tự giai đoạn');
    expect(messages).toContain('phụ thuộc chính nó');
    expect(messages).toContain('từ 1 đến 100');
  });

  it('simulates completed, current, next and locked states', () => {
    const result = simulateRoadmap(copy(), {
      id: 'student',
      label: 'Student',
      completedStepIds: ['step-derivative'],
      inProgressStepId: 'step-substitution',
    });
    const states = result.stages.flatMap((stage) => stage.steps.map((step) => step.state));
    expect(states).toEqual(expect.arrayContaining(['completed', 'current', 'next', 'locked']));
  });

  it('rejects missing content, duplicate order, missing prerequisites and cycles', () => {
    const definition = copy();
    definition.stages[0].steps[1].order = definition.stages[0].steps[0].order;
    definition.stages[0].steps[0].contentRef = { type: 'lesson', id: 'missing-lesson' };
    definition.stages[0].steps[1].prerequisiteStepIds = ['missing-step'];
    definition.stages[0].steps[2].prerequisiteStepIds = ['step-extrema'];
    definition.stages[0].steps[3].prerequisiteStepIds = ['step-monotonicity'];
    const messages = validateRoadmap(definition)
      .map((issue) => issue.message)
      .join(' ');
    expect(messages).toContain('Thứ tự hoạt động');
    expect(messages).toContain('không tồn tại');
    expect(messages).toContain('vòng lặp');
  });

  it('counts only required steps toward progress', () => {
    const definition = copy();
    const result = simulateRoadmap(definition, {
      id: 'student',
      label: 'Student',
      completedStepIds: ['step-derivative', 'step-substitution', 'step-monotonicity', 'step-check'],
    });
    expect(result.stages[0].progress).toBe(100);
    expect(result.stages[0].steps.find((step) => step.id === 'step-extrema')?.state).not.toBe(
      'completed'
    );
  });

  it('derives student content from the admin definition', () => {
    const definition = copy();
    definition.stages[0].title = 'Tên chặng do quản trị viên đặt';
    definition.stages[0].steps[1].title = 'Bài học đã chỉnh sửa';
    const dashboard = deriveStudentDashboard(definition, {
      id: 'student',
      label: 'Student',
      completedStepIds: ['step-derivative'],
    });
    expect(dashboard.stages[0].title).toBe('Tên chặng do quản trị viên đặt');
    expect(dashboard.today.activities[0].title).toBe('Bài học đã chỉnh sửa');
  });
});
