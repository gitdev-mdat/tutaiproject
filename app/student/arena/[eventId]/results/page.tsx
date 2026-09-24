'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BarChart3, CheckCircle2, Trophy } from 'lucide-react';
import { STUDENT_ARENA_EVENTS } from '@/features/student-experience/lib/mock-data';
import {
  getInitialStudentExperienceState,
  getStudentExperienceState,
} from '@/features/student-experience/lib/student-experience-service';

export default function StudentArenaResultPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const event = STUDENT_ARENA_EVENTS.find((item) => item.id === eventId);
  const [state, setState] = React.useState(getInitialStudentExperienceState);
  React.useEffect(() => {
    const hydration = window.setTimeout(() => setState(getStudentExperienceState()), 0);
    return () => window.clearTimeout(hydration);
  }, []);
  const attempt = [...state.attempts]
    .reverse()
    .find((item) => item.kind === 'arena' && item.activityId === eventId);
  const reward = [...state.rewards].reverse().find((item) => item.sourceEventId === eventId);

  if (!event || !attempt?.competitiveResult) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-xl font-extrabold text-slate-950">Chưa có kết quả cho sự kiện này</h1>
        <Link href="/student/arena" className="mt-4 inline-flex text-sm font-bold text-blue-600">
          Quay lại Đấu trường
        </Link>
      </div>
    );
  }

  const score = ((attempt.correct / attempt.total) * 10).toFixed(2);
  return (
    <div className="mx-auto max-w-[760px] pb-12">
      <Link
        href="/student/arena"
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-500"
      >
        <ArrowLeft size={15} /> Đấu trường
      </Link>
      <section className="mt-5 overflow-hidden rounded-3xl border border-slate-800 bg-[#0c1a34] text-white shadow-xl shadow-slate-900/10">
        <div className="p-6 sm:p-8">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
            <Trophy size={24} />
          </div>
          <p className="mt-6 text-sm font-bold text-blue-300">Kết quả đã xác minh</p>
          <h1 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">{event.title}</h1>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Điểm', score],
              ['Số câu đúng', `${attempt.correct}/${attempt.total}`],
              ['Thứ hạng', `#${attempt.competitiveResult.rank}`],
              ['Phân vị', `Top ${attempt.competitiveResult.percentile}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-2 text-xl font-extrabold text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
        {reward && (
          <div className="flex items-center gap-3 border-t border-amber-300/15 bg-amber-300/[0.07] px-6 py-4 sm:px-8">
            <CheckCircle2 size={19} className="text-amber-300" />
            <p className="text-sm text-slate-200">
              Phần thưởng đã ghi nhận: <strong className="text-amber-200">{reward.title}</strong>
            </p>
          </div>
        )}
      </section>
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Link
          href={`/student/rankings?competition=${event.id}`}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-extrabold text-white hover:bg-blue-700"
        >
          <BarChart3 size={16} /> Xem bảng xếp hạng
        </Link>
      </div>
    </div>
  );
}
