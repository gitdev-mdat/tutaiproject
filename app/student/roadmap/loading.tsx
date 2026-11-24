import { PathSkeleton } from '@/features/roadmap/components/student-roadmap';

export default function RoadmapLoading() {
  return (
    <div className="mx-auto w-full max-w-[1120px] pb-12">
      <PathSkeleton />
    </div>
  );
}
