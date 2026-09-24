'use client';

import { useEffect, useState } from 'react';
import { getStudentHomeOverview } from '../lib/student-experience-service';
import type { OverviewPeriod, StudentDashboardOverview } from '../lib/types';

export function useStudentHome(period: OverviewPeriod) {
  const [data, setData] = useState<StudentDashboardOverview | null>(null);
  useEffect(() => {
    let active = true;
    void getStudentHomeOverview(period).then((result) => active && setData(result));
    return () => {
      active = false;
    };
  }, [period]);
  return data;
}
