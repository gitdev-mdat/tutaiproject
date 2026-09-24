import type { RoadmapActivity } from '@/features/roadmap/lib/types';
import { RoadmapActivityItem } from './roadmap-activity-item';
export function RoadmapActivityList({
  activities,
  onStart,
}: {
  activities: RoadmapActivity[];
  onStart?: (activityId: string) => void;
}) {
  return (
    <div className="relative space-y-5 pl-1">
      <div className="absolute bottom-5 left-5 top-5 w-px bg-slate-200" aria-hidden="true" />
      {activities.map((activity) => (
        <RoadmapActivityItem key={activity.id} activity={activity} onStart={onStart} />
      ))}
    </div>
  );
}
