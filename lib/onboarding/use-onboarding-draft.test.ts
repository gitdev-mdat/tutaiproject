import React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getEarliestIncompleteOnboardingRoute,
  getServerDraft,
  isRequiredOnboardingDraftComplete,
  ONBOARDING_DRAFT_STORAGE_KEY,
  ONBOARDING_STEP_ROUTES,
  readDraft,
  resetOnboardingDraftStoreForTests,
  saveOnboardingDraft,
  subscribeDraft,
  useOnboardingDraft,
} from '@/lib/onboarding/use-onboarding-draft';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function createBrowserStub() {
  const localStorage = new MemoryStorage();
  const storageListeners = new Set<(event: StorageEvent) => void>();

  return {
    localStorage,
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type === 'storage' && typeof listener === 'function') {
        storageListeners.add(listener);
      }
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type === 'storage' && typeof listener === 'function') {
        storageListeners.delete(listener);
      }
    },
    emitStorage(key: string | null, newValue: string | null) {
      const event = { key, newValue, storageArea: localStorage } as StorageEvent;
      storageListeners.forEach((listener) => listener(event));
    },
  };
}

let browserStub: ReturnType<typeof createBrowserStub>;

beforeEach(() => {
  browserStub = createBrowserStub();
  vi.stubGlobal('window', browserStub);
  resetOnboardingDraftStoreForTests();
});

afterEach(() => {
  resetOnboardingDraftStoreForTests();
  vi.unstubAllGlobals();
});

describe('onboarding draft external store', () => {
  it('returns the same snapshot reference while storage is unchanged', () => {
    browserStub.localStorage.setItem(
      ONBOARDING_DRAFT_STORAGE_KEY,
      JSON.stringify({ goal: 'Đạt 9 điểm' })
    );

    const first = readDraft();
    const second = readDraft();

    expect(first).toBe(second);
  });

  it('publishes a new snapshot when the draft changes', () => {
    saveOnboardingDraft({ goal: 'Đạt 8 điểm' });
    const previous = readDraft();

    saveOnboardingDraft({ goal: 'Đạt 9 điểm', progress: 'subjects' });
    const next = readDraft();

    expect(next).not.toBe(previous);
    expect(next).toEqual({ goal: 'Đạt 9 điểm', progress: 'subjects' });
  });

  it('returns a stable server snapshot', () => {
    expect(getServerDraft()).toBe(getServerDraft());
  });

  it('notifies same-tab subscribers once and removes them on unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDraft(listener);

    saveOnboardingDraft({ progress: 'assessment' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(readDraft()).toEqual({ progress: 'assessment' });

    unsubscribe();
    saveOnboardingDraft({ progress: 'roadmap' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('updates the cached snapshot once for a cross-tab storage event', () => {
    saveOnboardingDraft({ progress: 'goal' });
    const previous = readDraft();
    const listener = vi.fn();
    const unsubscribe = subscribeDraft(listener);
    const raw = JSON.stringify({ progress: 'analyzing' });

    browserStub.localStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, raw);
    browserStub.emitStorage(ONBOARDING_DRAFT_STORAGE_KEY, raw);

    const next = readDraft();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(next).not.toBe(previous);
    expect(next).toEqual({ progress: 'analyzing' });

    unsubscribe();
  });

  it('renders a minimal hook consumer once without a snapshot loop', () => {
    let renderCount = 0;

    function DraftConsumer() {
      renderCount += 1;
      const { draft } = useOnboardingDraft();
      return React.createElement('span', null, draft?.goal ?? 'empty');
    }

    expect(renderToString(React.createElement(DraftConsumer))).toBe('<span>empty</span>');
    expect(renderCount).toBe(1);
  });
});

describe('required onboarding draft completeness resolver', () => {
  const completeDraft = {
    targetScore: '8+',
    subjects: ['Toán'],
    selfReportedLevel: '6–7',
    dailyStudyMinutes: 30,
  };

  it('treats a null draft as incomplete and routes to the earliest step', () => {
    expect(getEarliestIncompleteOnboardingRoute(null)).toBe(ONBOARDING_STEP_ROUTES.goal);
    expect(isRequiredOnboardingDraftComplete(null)).toBe(false);
  });

  it('accepts a valid draft with a single subject', () => {
    expect(getEarliestIncompleteOnboardingRoute(completeDraft)).toBeNull();
    expect(isRequiredOnboardingDraftComplete(completeDraft)).toBe(true);
  });

  it('accepts a valid draft with multiple subjects', () => {
    const draft = { ...completeDraft, subjects: ['Toán', 'Vật lý', 'Hóa học'] };
    expect(getEarliestIncompleteOnboardingRoute(draft)).toBeNull();
  });

  it('routes to /onboarding/goal when targetScore is missing or blank', () => {
    expect(getEarliestIncompleteOnboardingRoute({ ...completeDraft, targetScore: undefined })).toBe(
      ONBOARDING_STEP_ROUTES.goal
    );
    expect(getEarliestIncompleteOnboardingRoute({ ...completeDraft, targetScore: '   ' })).toBe(
      ONBOARDING_STEP_ROUTES.goal
    );
  });

  it('routes to /onboarding/subjects when subjects is empty or malformed', () => {
    expect(getEarliestIncompleteOnboardingRoute({ ...completeDraft, subjects: [] })).toBe(
      ONBOARDING_STEP_ROUTES.subjects
    );
    expect(
      getEarliestIncompleteOnboardingRoute({
        ...completeDraft,
        subjects: ['Toán', ''],
      })
    ).toBe(ONBOARDING_STEP_ROUTES.subjects);
    expect(
      getEarliestIncompleteOnboardingRoute({
        ...completeDraft,
        subjects: 'Toán' as unknown as string[],
      })
    ).toBe(ONBOARDING_STEP_ROUTES.subjects);
  });

  it('routes to /onboarding/assessment when selfReportedLevel is missing or blank', () => {
    expect(
      getEarliestIncompleteOnboardingRoute({ ...completeDraft, selfReportedLevel: undefined })
    ).toBe(ONBOARDING_STEP_ROUTES.assessment);
    expect(
      getEarliestIncompleteOnboardingRoute({ ...completeDraft, selfReportedLevel: '  ' })
    ).toBe(ONBOARDING_STEP_ROUTES.assessment);
  });

  it('routes to /onboarding/study-time when dailyStudyMinutes is missing, zero, negative, or non-numeric', () => {
    expect(
      getEarliestIncompleteOnboardingRoute({ ...completeDraft, dailyStudyMinutes: undefined })
    ).toBe(ONBOARDING_STEP_ROUTES.studyTime);
    expect(getEarliestIncompleteOnboardingRoute({ ...completeDraft, dailyStudyMinutes: 0 })).toBe(
      ONBOARDING_STEP_ROUTES.studyTime
    );
    expect(getEarliestIncompleteOnboardingRoute({ ...completeDraft, dailyStudyMinutes: -15 })).toBe(
      ONBOARDING_STEP_ROUTES.studyTime
    );
    expect(
      getEarliestIncompleteOnboardingRoute({
        ...completeDraft,
        dailyStudyMinutes: '30' as unknown as number,
      })
    ).toBe(ONBOARDING_STEP_ROUTES.studyTime);
    expect(
      getEarliestIncompleteOnboardingRoute({ ...completeDraft, dailyStudyMinutes: Number.NaN })
    ).toBe(ONBOARDING_STEP_ROUTES.studyTime);
  });

  it('resolves to the earliest applicable step when multiple fields are missing', () => {
    expect(
      getEarliestIncompleteOnboardingRoute({
        subjects: [],
        selfReportedLevel: undefined,
        dailyStudyMinutes: undefined,
      })
    ).toBe(ONBOARDING_STEP_ROUTES.goal);

    expect(
      getEarliestIncompleteOnboardingRoute({
        targetScore: '8+',
        selfReportedLevel: undefined,
        dailyStudyMinutes: undefined,
      })
    ).toBe(ONBOARDING_STEP_ROUTES.subjects);
  });
});
