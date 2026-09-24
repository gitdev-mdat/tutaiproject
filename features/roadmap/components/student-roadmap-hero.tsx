import { Target } from 'lucide-react';
import type { StudentRoadmap } from '@/features/roadmap/lib/types';

export function StudentRoadmapHero({ roadmap }: { roadmap: StudentRoadmap }) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
          Lộ trình của em
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#091224] md:text-4xl">
          Từng bước tiến tới mục tiêu {roadmap.targetScore}+
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Hoàn thành từng hoạt động nhỏ để tiến bộ vững vàng.
        </p>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
        <Target size={20} className="text-blue-600" />
        <div>
          <span className="block text-xs font-semibold text-blue-500">Mục tiêu</span>
          <strong className="text-blue-700">{roadmap.targetScore}+</strong>
        </div>
      </div>
    </header>
  );
}
