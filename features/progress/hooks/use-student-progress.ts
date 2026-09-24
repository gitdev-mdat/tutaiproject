'use client';

import { useEffect, useState } from 'react';
import { getStudentProgressDashboard } from '@/features/progress/lib/progress-service';
import type { StudentProgressDashboard } from '@/features/progress/lib/types';

export function useStudentProgress() {
  const [data, setData] = useState<StudentProgressDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getStudentProgressDashboard()
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError('Chưa thể tải dữ liệu tiến bộ. Em thử lại sau nhé.');
      });
    return () => {
      active = false;
    };
  }, []);

  return { data, error, isLoading: !data && !error };
}
