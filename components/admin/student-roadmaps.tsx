import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { LearningOverview, DeclarationOverview } from '@/lib/admin/learning-overview';
import { programHref } from '@/features/lessons/lib/study-plan';

/**
 * How students receive their Roadmap. There is nothing to assign by hand: the
 * admin publishes curriculum in the Knowledge Tree and every student is placed
 * on the published program of the subject and grade they declared. This page
 * shows that rule, every program it can place a student on, and which
 * declarations still have no matching program.
 */

const RULES = [
  {
    title: 'Chương trình',
    text: 'Môn muốn cải thiện và lớp trong hồ sơ chọn chương trình đang có bài mở trên cây kiến thức. Chưa có đúng lớp thì dùng lớp gần nhất của cùng môn. Môn chưa có bài thì học sinh học tạm chương trình đang mở và được báo rõ.',
  },
  {
    title: 'Thứ tự bài',
    text: 'Theo thứ tự chương và bài trên cây. Mọi bài đều mở; không bài nào bị bỏ qua dựa trên điểm học sinh tự khai.',
  },
  {
    title: 'Bước tiếp theo',
    text: 'Làm tiếp bài luyện tập đang dở, rồi học tiếp bài đang dở, rồi luyện lại bài đã học mà chưa đạt 80%, rồi bài đầu tiên chưa hoàn thành.',
  },
];

function resultLabel(row: DeclarationOverview) {
  if (row.basis === 'PROFILE') return { text: row.programTitle ?? '—', tone: 'text-slate-900' };
  if (row.basis === 'OTHER_GRADE')
    return { text: `${row.programTitle}, lớp gần nhất`, tone: 'text-amber-800' };
  if (row.basis === 'NO_SUBJECT_PROGRAM')
    return { text: `Học tạm ${row.programTitle}`, tone: 'text-amber-800' };
  return { text: 'Chưa có chương trình nào', tone: 'text-red-700' };
}

export function StudentRoadmapsAdmin({ overview }: { overview: LearningOverview }) {
  const declared = overview.declarations;
  const gaps = declared.filter((row) => row.students > 0 && row.basis !== 'PROFILE');
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6" data-testid="student-roadmaps">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Lộ trình học sinh</h1>
        <p className="mt-0.5 max-w-3xl text-sm text-slate-500">
          Không cần xếp lộ trình cho từng em. Khi một bài được xuất bản trên{' '}
          <Link href="/admin/knowledge" className="font-semibold text-blue-700 hover:underline">
            Chương trình &amp; Kiến thức
          </Link>
          , mọi học sinh của môn và lớp đó thấy bài ngay ở Lộ trình, theo đúng thứ tự trên cây.
        </p>
      </header>

      <section aria-labelledby="roadmap-rules">
        <h2 id="roadmap-rules" className="mb-2 text-sm font-semibold text-slate-900">
          Lộ trình được chọn thế nào
        </h2>
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="roadmap-rules">
          {RULES.map((rule, index) => (
            <li key={rule.title} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold text-blue-700">
                {index + 1}. {rule.title}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{rule.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Chưa có bài kiểm tra đầu vào, nên Tú Tài không biết học sinh đã vững phần nào. Điểm hiện
          tại và điểm mục tiêu chỉ hiển thị làm mục tiêu, không đổi lộ trình. Học sinh sửa môn, lớp
          và mục tiêu trong Hồ sơ; lộ trình đổi theo ở lần mở sau.
        </p>
      </section>

      <section aria-labelledby="roadmap-programs">
        <h2 id="roadmap-programs" className="mb-2 text-sm font-semibold text-slate-900">
          Chương trình đang mở cho học sinh
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          {overview.programs.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-600" data-testid="roadmap-programs-empty">
              Chưa có bài nào được xuất bản cho học sinh. Học sinh mới sẽ thấy Lộ trình trống cho
              đến khi có bài đầu tiên.
            </p>
          ) : (
            <table className="w-full min-w-[640px] text-sm" data-testid="roadmap-programs">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Chương trình</th>
                  <th className="px-3 py-2.5">Nội dung</th>
                  <th className="px-3 py-2.5">Luyện tập</th>
                  <th className="px-3 py-2.5">Học sinh</th>
                  <th className="px-4 py-2.5 text-right">Xem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview.programs.map((program) => (
                  <tr key={program.id}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{program.title}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {program.chapterCount} chương · {program.lessonCount} bài
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {program.lessonsWithPractice}/{program.lessonCount} bài có câu ·{' '}
                      {program.practiceQuestions} câu
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {program.studentsPlaced} nhận theo hồ sơ · {program.studentsPracticing} đã
                      luyện tập
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={programHref(program)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                      >
                        Như học sinh <ExternalLink className="size-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section aria-labelledby="roadmap-declarations">
        <h2 id="roadmap-declarations" className="mb-1 text-sm font-semibold text-slate-900">
          Học sinh khai gì thì nhận chương trình nào
        </h2>
        <p className="mb-2 text-xs text-slate-500">
          {overview.students.onboarded} học sinh đã hoàn tất hồ sơ.{' '}
          {gaps.length
            ? `${gaps.reduce((sum, row) => sum + row.students, 0)} em đang học tạm vì môn hoặc lớp của các em chưa có bài.`
            : 'Mọi học sinh đều nhận đúng chương trình của môn và lớp đã khai.'}
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[520px] text-sm" data-testid="roadmap-declarations">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Môn ưu tiên</th>
                <th className="px-3 py-2.5">Lớp</th>
                <th className="px-3 py-2.5">Học sinh</th>
                <th className="px-4 py-2.5">Nhận lộ trình</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {declared.map((row) => {
                const result = resultLabel(row);
                return (
                  <tr
                    key={`${row.subjectCode}-${row.grade}`}
                    data-testid="roadmap-declaration"
                    data-basis={row.basis}
                    className={row.students > 0 && row.basis !== 'PROFILE' ? 'bg-amber-50/50' : ''}
                  >
                    <td className="px-4 py-2.5 text-slate-900">{row.subjectLabel}</td>
                    <td className="px-3 py-2.5 text-slate-600">{row.grade}</td>
                    <td className="px-3 py-2.5 text-slate-600">{row.students}</td>
                    <td className={`px-4 py-2.5 text-xs font-semibold ${result.tone}`}>
                      {result.text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs leading-5 text-slate-400">
        Trình soạn lộ trình mẫu trước đây chỉ lưu trong bộ nhớ máy chủ, trỏ tới bài mẫu không có
        trên cây và không học sinh nào nhận được, nên đã được gỡ. Đường dẫn cũ mở trang này.
      </p>
    </div>
  );
}
