'use client';

import { useCallback, useSyncExternalStore } from 'react';

import type { LearningEvidence, OnboardingPreferenceData } from '@/types/roadmap';

export type { LearningEvidence, OnboardingPreferenceData } from '@/types/roadmap';

export interface OnboardingDraft extends Partial<OnboardingPreferenceData> {
  goal?: string;
  target_grade?: string;
  target_timeline?: string;
  assessment_answers?: Record<string, string | number | boolean | null>;
  learningEvidence?: LearningEvidence | null;
  progress?: 'goal' | 'subjects' | 'assessment' | 'study-time' | 'analyzing' | 'roadmap';
  hasRoadmap?: boolean;
}

export const ONBOARDING_DRAFT_STORAGE_KEY = 'tutai_onboarding_draft';

let cachedDraftRaw: string | null | undefined;
let cachedDraftSnapshot: OnboardingDraft | null = null;

function parseDraft(raw: string | null): OnboardingDraft | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as OnboardingDraft) : null;
  } catch {
    return null;
  }
}

export function readDraft(): OnboardingDraft | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY);
    if (raw === cachedDraftRaw) return cachedDraftSnapshot;

    cachedDraftRaw = raw;
    cachedDraftSnapshot = parseDraft(raw);
    return cachedDraftSnapshot;
  } catch {
    return null;
  }
}

export function getOnboardingDraft(): OnboardingDraft | null {
  return readDraft();
}

const draftListeners = new Set<() => void>();
let storageListenerAttached = false;

function notifyDraftListeners(): void {
  draftListeners.forEach((listener) => listener());
}

function handleDraftStorage(event: StorageEvent): void {
  if (event.storageArea && event.storageArea !== window.localStorage) return;
  if (event.key !== null && event.key !== ONBOARDING_DRAFT_STORAGE_KEY) return;

  const raw =
    event.key === null ? window.localStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY) : event.newValue;
  if (raw === cachedDraftRaw) return;

  cachedDraftRaw = raw;
  cachedDraftSnapshot = parseDraft(raw);
  notifyDraftListeners();
}

export function saveOnboardingDraft(draft: OnboardingDraft): void {
  if (typeof window === 'undefined') return;

  try {
    const raw = JSON.stringify(draft);
    const snapshot = parseDraft(raw);
    window.localStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, raw);
    cachedDraftRaw = raw;
    cachedDraftSnapshot = snapshot;
    notifyDraftListeners();
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}

export function clearOnboardingDraft(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
    cachedDraftRaw = null;
    cachedDraftSnapshot = null;
    notifyDraftListeners();
  } catch {
    // Ignore unavailable storage during cleanup.
  }
}

export function subscribeDraft(listener: () => void): () => void {
  draftListeners.add(listener);
  if (!storageListenerAttached) {
    window.addEventListener('storage', handleDraftStorage);
    storageListenerAttached = true;
  }

  return () => {
    draftListeners.delete(listener);
    if (storageListenerAttached && draftListeners.size === 0) {
      window.removeEventListener('storage', handleDraftStorage);
      storageListenerAttached = false;
    }
  };
}

export function getServerDraft(): OnboardingDraft | null {
  return null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => isNonEmptyString(item));
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Ordered onboarding step routes, earliest-first. Used to send an incomplete
 * or malformed draft back to the earliest step capable of repairing it.
 */
export const ONBOARDING_STEP_ROUTES = {
  goal: '/onboarding/goal',
  subjects: '/onboarding/subjects',
  assessment: '/onboarding/assessment',
  studyTime: '/onboarding/study-time',
} as const;

/**
 * Pure resolver: validates the shape/usability of every field required to
 * render the roadmap result (not mere truthiness), and returns the earliest
 * onboarding route that can repair the first missing or malformed field.
 * Returns null when the draft already satisfies every required field.
 */
export function getEarliestIncompleteOnboardingRoute(
  draft: OnboardingDraft | null | undefined
): string | null {
  if (!isNonEmptyString(draft?.targetScore)) return ONBOARDING_STEP_ROUTES.goal;
  if (!isNonEmptyStringArray(draft?.subjects)) return ONBOARDING_STEP_ROUTES.subjects;
  if (!isNonEmptyString(draft?.selfReportedLevel)) return ONBOARDING_STEP_ROUTES.assessment;
  if (!isPositiveFiniteNumber(draft?.dailyStudyMinutes)) return ONBOARDING_STEP_ROUTES.studyTime;

  return null;
}

/**
 * True only when every field required to render the roadmap result is
 * present and well-formed.
 */
export function isRequiredOnboardingDraftComplete(
  draft: OnboardingDraft | null | undefined
): boolean {
  return getEarliestIncompleteOnboardingRoute(draft) === null;
}

export function resetOnboardingDraftStoreForTests(): void {
  if (storageListenerAttached && typeof window !== 'undefined') {
    window.removeEventListener('storage', handleDraftStorage);
  }

  storageListenerAttached = false;
  draftListeners.clear();
  cachedDraftRaw = undefined;
  cachedDraftSnapshot = null;
}

export function useOnboardingDraft() {
  const draft = useSyncExternalStore(subscribeDraft, readDraft, getServerDraft);

  const updateDraft = useCallback((updates: Partial<OnboardingDraft>) => {
    saveOnboardingDraft({ ...(readDraft() ?? {}), ...updates });
  }, []);

  const clearDraft = useCallback(() => {
    clearOnboardingDraft();
  }, []);

  return {
    draft,
    isMounted: true,
    updateDraft,
    saveDraft: updateDraft,
    clearDraft,
  };
}
