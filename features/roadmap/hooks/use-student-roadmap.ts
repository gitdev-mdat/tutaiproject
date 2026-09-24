'use client';

import { useCallback, useEffect, useState } from 'react';
import { roadmapService } from '../lib/roadmap-api-service';
import type {
  CompleteActivityInput,
  RoadmapActivity,
  RoadmapWeek,
  StudentRoadmap,
  StudentRoadmapDashboard,
} from '../lib/types';

export type StudentRoadmapState = 'loading' | 'ready' | 'error' | 'empty';

export function useStudentRoadmap() {
  const [roadmap, setRoadmap] = useState<StudentRoadmap | null>(null);
  const [dashboard, setDashboard] = useState<StudentRoadmapDashboard | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<RoadmapWeek | null>(null);
  const [state, setState] = useState<StudentRoadmapState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [mutatingActivityId, setMutatingActivityId] = useState<string | null>(null);

  const fetchRoadmap = useCallback(
    () =>
      Promise.all([roadmapService.getStudentRoadmap(), roadmapService.getStudentRoadmapDashboard()])
        .then(([result, dashboardResult]) => {
          if (!result) {
            setRoadmap(null);
            setDashboard(null);
            setSelectedWeek(null);
            setState('empty');
            return;
          }
          setRoadmap(result);
          setDashboard(dashboardResult);
          setSelectedWeek(
            result.phases
              .flatMap((phase) => phase.weeks)
              .find((week) => week.id === result.currentWeekId) ?? null
          );
          setState('ready');
        })
        .catch((cause: unknown) => {
          setState('error');
          setError(cause instanceof Error ? cause.message : 'Không thể tải lộ trình');
        }),
    []
  );
  useEffect(() => {
    void fetchRoadmap();
  }, [fetchRoadmap]);

  const reload = useCallback(async () => {
    setState('loading');
    setError(null);
    await fetchRoadmap();
  }, [fetchRoadmap]);

  const selectWeek = useCallback(
    (weekOrId: RoadmapWeek | string) => {
      if (typeof weekOrId === 'string') {
        const found =
          roadmap?.phases.flatMap((phase) => phase.weeks).find((week) => week.id === weekOrId) ??
          null;
        if (found) setSelectedWeek(found);
      } else {
        setSelectedWeek(weekOrId);
      }
    },
    [roadmap]
  );
  const mutate = useCallback(
    async (activityId: string, action: (id: string) => Promise<RoadmapActivity>) => {
      if (!roadmap) return;
      setMutatingActivityId(activityId);
      try {
        await action(activityId);
        const [refreshed, refreshedDashboard] = await Promise.all([
          roadmapService.getStudentRoadmap(),
          roadmapService.getStudentRoadmapDashboard(),
        ]);
        if (!refreshed) {
          setRoadmap(null);
          setDashboard(null);
          setSelectedWeek(null);
          setState('empty');
          return;
        }
        setRoadmap(refreshed);
        setDashboard(refreshedDashboard);
        setSelectedWeek(
          refreshed.phases
            .flatMap((phase) => phase.weeks)
            .find((week) => week.id === selectedWeek?.id) ?? null
        );
      } finally {
        setMutatingActivityId(null);
      }
    },
    [roadmap, selectedWeek?.id]
  );
  const startActivity = useCallback(
    (id: string) =>
      mutate(id, (activityId) => roadmapService.startActivity(roadmap!.id, activityId)),
    [mutate, roadmap]
  );
  const completeActivity = useCallback(
    (id: string, input?: CompleteActivityInput) =>
      mutate(id, (activityId) => roadmapService.completeActivity(roadmap!.id, activityId, input)),
    [mutate, roadmap]
  );
  return {
    roadmap,
    dashboard,
    selectedWeek,
    state,
    error,
    mutatingActivityId,
    reload,
    selectWeek,
    startActivity,
    completeActivity,
  };
}
