import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  completeRoadmapActivity,
  loadStudentState,
  recordExamResult,
  recordPracticeResult,
  resetStudentState,
  resolveStudentShellModel,
  searchStudentDestinations,
  startRoadmapActivity,
  STUDENT_STATE_STORAGE_PREFIX,
  updateStudentProfile,
} from './student-service';
import type { StudentProfile } from './types';

const profile: StudentProfile = {
  id: 'test-student-1',
  name: 'Trần Văn An',
  email: 'an@example.com',
  grade: 12,
  targetScore: 8,
  examBlock: 'A01',
};

function storageKeyFor(studentId: string): string {
  return `${STUDENT_STATE_STORAGE_PREFIX}${studentId}`;
}

describe('resolveStudentShellModel', () => {
  it('derives identity fields from the given profile', () => {
    const model = resolveStudentShellModel(profile);

    expect(model.identity.id).toBe(profile.id);
    expect(model.identity.name).toBe(profile.name);
    expect(model.identity.email).toBe(profile.email);
    expect(model.identity.initials).toBe('TA');
  });

  it('exposes only verified student destinations', () => {
    const model = resolveStudentShellModel(profile);
    const hrefs = model.destinations.map((destination) => destination.href);

    expect(hrefs).toEqual([
      '/student/dashboard',
      '/student/roadmap',
      '/student/practice',
      '/student/exams',
      '/student/rankings',
      '/student/arena',
      '/student/profile',
    ]);
  });

  it('includes at least one metric and one notification', () => {
    const model = resolveStudentShellModel(profile);

    expect(model.metrics.length).toBeGreaterThan(0);
    expect(model.notifications.length).toBeGreaterThan(0);
  });

  it('produces a JSON-serializable model', () => {
    const model = resolveStudentShellModel(profile);

    expect(() => JSON.parse(JSON.stringify(model))).not.toThrow();
  });
});

describe('searchStudentDestinations', () => {
  const destinations = resolveStudentShellModel(profile).destinations;

  it('returns every destination for an empty query', () => {
    expect(searchStudentDestinations(destinations, '')).toHaveLength(destinations.length);
    expect(searchStudentDestinations(destinations, '   ')).toHaveLength(destinations.length);
  });

  it('filters destinations by title, description, or keywords', () => {
    const result = searchStudentDestinations(destinations, 'lộ trình');

    expect(result).toHaveLength(1);
    expect(result[0]?.href).toBe('/student/roadmap');
  });

  it('matches case-insensitively', () => {
    const result = searchStudentDestinations(destinations, 'HỒ SƠ');

    expect(result).toHaveLength(1);
    expect(result[0]?.href).toBe('/student/profile');
  });

  it('returns results for flashcards and review destinations', () => {
    expect(searchStudentDestinations(destinations, 'flashcard')).toHaveLength(1);
    expect(searchStudentDestinations(destinations, 'ôn tập').length).toBeGreaterThanOrEqual(1);
  });

  it('returns no results for an unmatched query', () => {
    const result = searchStudentDestinations(destinations, 'không tồn tại xyz');

    expect(result).toHaveLength(0);
  });
});

describe('loadStudentState (persistence boundary)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('loading: returns a default state on first load (empty storage)', () => {
    const result = loadStudentState(profile);

    expect(result.status).toBe('success');
    expect(result.state.profile).toEqual(profile);
    expect(result.state.completedActivityIds).toEqual([]);
    expect(result.state.practiceResults).toEqual([]);
    expect(result.state.examResults).toEqual([]);
    expect(result.state.version).toBeGreaterThan(0);
  });

  it('success: persists and reloads the same state across calls (navigation/reload simulation)', () => {
    const first = loadStudentState(profile);
    startRoadmapActivity(first.state, 'step-3');
    const afterStart = completeRoadmapActivity(first.state, 'step-3');

    expect(afterStart.status).toBe('success');

    const reloaded = loadStudentState(profile);
    expect(reloaded.state.completedActivityIds).toContain('step-3');
  });

  it('empty: resetStudentState clears persisted data back to defaults', () => {
    const loaded = loadStudentState(profile);
    completeRoadmapActivity(loaded.state, 'step-3');

    const reset = resetStudentState(profile);
    expect(reset.status).toBe('success');
    expect(reset.state.completedActivityIds).toEqual([]);

    const reloaded = loadStudentState(profile);
    expect(reloaded.state.completedActivityIds).toEqual([]);
  });

  it('error: falls back to defaults when stored JSON is malformed', () => {
    window.localStorage.setItem(storageKeyFor(profile.id), '{not-valid-json');

    const result = loadStudentState(profile);

    expect(result.status).toBe('recovered');
    expect(result.state.profile).toEqual(profile);
    expect(result.state.completedActivityIds).toEqual([]);
  });

  it('error: falls back to defaults when stored payload has a stale/unsupported version', () => {
    window.localStorage.setItem(
      storageKeyFor(profile.id),
      JSON.stringify({ version: -1, profile, completedActivityIds: ['step-1'] })
    );

    const result = loadStudentState(profile);

    expect(result.status).toBe('recovered');
    expect(result.state.completedActivityIds).toEqual([]);
  });

  it('error: falls back to defaults when localStorage access throws', () => {
    const getItemSpy = vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    const result = loadStudentState(profile);

    expect(result.status).toBe('unavailable');
    expect(result.state.profile).toEqual(profile);

    getItemSpy.mockRestore();
  });
});

describe('updateStudentProfile', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('applies valid partial updates and persists them', () => {
    const { state } = loadStudentState(profile);
    const result = updateStudentProfile(state, { name: 'Trần Văn Bình', targetScore: 9 });

    expect(result.status).toBe('success');
    expect(result.state.profile.name).toBe('Trần Văn Bình');
    expect(result.state.profile.targetScore).toBe(9);

    const reloaded = loadStudentState(profile);
    expect(reloaded.state.profile.name).toBe('Trần Văn Bình');
  });

  it('rejects invalid updates with an error outcome and leaves state unchanged', () => {
    const { state } = loadStudentState(profile);
    const result = updateStudentProfile(state, { name: '   ' });

    expect(result.status).toBe('error');
    expect(result.state.profile.name).toBe(profile.name);
  });

  it('rejects an out-of-range target score', () => {
    const { state } = loadStudentState(profile);
    const result = updateStudentProfile(state, { targetScore: 999 });

    expect(result.status).toBe('error');
  });
});

describe('roadmap activity transitions', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starting an activity is idempotent and does not duplicate progress entries', () => {
    const { state } = loadStudentState(profile);
    const first = startRoadmapActivity(state, 'step-3');
    const second = startRoadmapActivity(first.state, 'step-3');

    expect(second.status).toBe('success');
    expect(second.state.inProgressActivityIds.filter((id) => id === 'step-3')).toHaveLength(1);
  });

  it('completing an activity is idempotent and removes it from in-progress', () => {
    const { state } = loadStudentState(profile);
    startRoadmapActivity(state, 'step-3');
    const first = completeRoadmapActivity(state, 'step-3');
    const second = completeRoadmapActivity(first.state, 'step-3');

    expect(second.status).toBe('success');
    expect(second.state.completedActivityIds.filter((id) => id === 'step-3')).toHaveLength(1);
    expect(second.state.inProgressActivityIds).not.toContain('step-3');
  });

  it('rejects an unknown activity id', () => {
    const { state } = loadStudentState(profile);
    const result = completeRoadmapActivity(state, 'not-a-real-step');

    expect(result.status).toBe('error');
  });
});

describe('recordPracticeResult', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('records a new practice result deterministically', () => {
    const { state } = loadStudentState(profile);
    const result = recordPracticeResult(state, {
      id: 'practice-1',
      topic: 'Hàm số',
      score: 8,
      total: 10,
      completedAt: '2024-01-01T00:00:00.000Z',
    });

    expect(result.status).toBe('success');
    expect(result.state.practiceResults).toHaveLength(1);
    expect(result.state.practiceResults[0]?.score).toBe(8);
  });

  it('replaces an existing practice result with the same id rather than duplicating it', () => {
    const { state } = loadStudentState(profile);
    const first = recordPracticeResult(state, {
      id: 'practice-1',
      topic: 'Hàm số',
      score: 6,
      total: 10,
      completedAt: '2024-01-01T00:00:00.000Z',
    });
    const second = recordPracticeResult(first.state, {
      id: 'practice-1',
      topic: 'Hàm số',
      score: 9,
      total: 10,
      completedAt: '2024-01-02T00:00:00.000Z',
    });

    expect(second.state.practiceResults).toHaveLength(1);
    expect(second.state.practiceResults[0]?.score).toBe(9);
  });

  it('rejects a malformed practice result', () => {
    const { state } = loadStudentState(profile);
    const result = recordPracticeResult(state, {
      id: '',
      topic: 'Hàm số',
      score: 8,
      total: 10,
      completedAt: '2024-01-01T00:00:00.000Z',
    });

    expect(result.status).toBe('error');
  });
});

describe('recordExamResult', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('records an exam result and persists it across reload', () => {
    const { state } = loadStudentState(profile);
    const result = recordExamResult(state, {
      id: 'exam-1',
      examName: 'Đề thi thử số 1',
      score: 7.5,
      completedAt: '2024-01-03T00:00:00.000Z',
    });

    expect(result.status).toBe('success');
    expect(result.state.examResults).toHaveLength(1);

    const reloaded = loadStudentState(profile);
    expect(reloaded.state.examResults).toHaveLength(1);
    expect(reloaded.state.examResults[0]?.examName).toBe('Đề thi thử số 1');
  });

  it('rejects an exam result with an invalid score', () => {
    const { state } = loadStudentState(profile);
    const result = recordExamResult(state, {
      id: 'exam-2',
      examName: 'Đề thi thử số 2',
      score: -1,
      completedAt: '2024-01-03T00:00:00.000Z',
    });

    expect(result.status).toBe('error');
  });
});
