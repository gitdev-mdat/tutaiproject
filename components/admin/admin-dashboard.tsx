import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileQuestion,
  FolderTree,
  Route,
  Users,
} from 'lucide-react';
import type { LearningOverview } from '@/lib/admin/learning-overview';

/**
 * The admin home: what students receive today and what is waiting before more
 * content can open. Every figure is read from the curriculum, question bank,
 * exams and student records; there are no sample numbers.
 */

function StatCard({
  label,
  value,
  detail,
  icon,
  href,
}: {
  label: string;
  value: number;
  detail: string;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"
      data-testid="overview-stat"
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
      </div>
      <span className="shrink-0 text-slate-300 group-hover:text-slate-400">{icon}</span>
    </Link>
  );
}

type Task = { text: string; detail: string; href: string; cta: string };

function tasksFor(overview: LearningOverview): Task[] {
  const tasks: Task[] = [];
  const unplaced = overview.declarations
    .filter((row) => row.students > 0 && row.basis !== 'PROFILE')
    .reduce((sum, row) => sum + row.students, 0);
  const withoutPractice = overview.programs.reduce(
    (sum, program) => sum + program.lessonCount - program.lessonsWithPractice,
    0
  );
  if (overview.pendingPayments)
    tasks.push({
      text: `${overview.pendingPayments} giao dịch Plus chờ duyệt`,
      detail: 'Học sinh đã chuyển khoản và đang chờ mở gói.',
      href: '/admin/payments',
      cta: 'Duyệt',
    });
  if (unplaced)
    tasks.push({
      text: `${unplaced} học sinh chưa có chương trình đúng môn, lớp`,
      detail:
        'Các em đang học tạm chương trình khác. Mở bài cho môn và lớp đó để các em nhận đúng.',
      href: '/admin/roadmaps',
      cta: 'Xem',
    });
  if (overview.questions.inReview)
    tasks.push({
      text: `${overview.questions.inReview} câu hỏi chờ duyệt`,
      detail: 'Câu chỉ đến với học sinh sau khi được xuất bản.',
      href: '/admin/question-bank',
      cta: 'Duyệt',
    });
  if (withoutPractice)
    tasks.push({
      text: `${withoutPractice} bài đang mở chưa có câu luyện tập`,
      detail: 'Học sinh học xong bài nhưng chưa có gì để luyện.',
      href: '/admin/practice',
      cta: 'Thêm câu',
    });
  if (overview.lessons.notVisible)
    tasks.push({
      text: `${overview.lessons.notVisible} bài đã soạn nhưng chưa hiển thị`,
      detail: 'Bài cần được xuất bản và bật "Hiển thị cho học sinh".',
      href: '/admin/knowledge',
      cta: 'Mở cây',
    });
  if (!overview.exams.takeable)
    tasks.push({
      text: 'Chưa có đề thi nào học sinh làm được',
      detail: 'Ghép đề từ câu đã xuất bản, đặt thời gian rồi xuất bản.',
      href: '/admin/exams',
      cta: 'Tạo đề',
    });
  return tasks;
}

const FLOW = [
  {
    href: '/admin/knowledge',
    title: 'Chương trình & Kiến thức',
    text: 'Tạo môn, lớp, chương, bài. Soạn và xuất bản nội dung bài.',
  },
  {
    href: '/admin/question-bank',
    title: 'Ngân hàng câu hỏi',
    text: 'Soạn hoặc nhập câu, gắn vào một bài của cây, duyệt rồi xuất bản.',
  },
  {
    href: '/admin/practice',
    title: 'Luyện tập · Đề thi',
    text: 'Câu đã xuất bản tự vào luyện tập của bài. Đề thi ghép từ các câu đó.',
  },
  {
    href: '/admin/roadmaps',
    title: 'Lộ trình học sinh',
    text: 'Học sinh nhận chương trình theo môn và lớp đã khai, tự động.',
  },
];

export function AdminDashboard({ overview }: { overview: LearningOverview }) {
  const tasks = tasksFor(overview);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Tổng quan</h1>
        <p className="mt-0.5 max-w-2xl text-sm text-slate-500">
          Những gì học sinh đang nhận được và việc cần làm trước khi mở thêm nội dung.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Bài học đang mở"
          value={overview.lessons.published}
          detail={
            overview.lessons.notVisible
              ? `${overview.lessons.notVisible} bài đã soạn, chưa hiển thị`
              : 'Không có bài chờ xuất bản'
          }
          icon={<FolderTree className="size-5" />}
          href="/admin/knowledge"
        />
        <StatCard
          label="Câu hỏi đã xuất bản"
          value={overview.questions.published}
          detail={`${overview.questions.inReview} chờ duyệt · ${overview.questions.draft} bản nháp`}
          icon={<FileQuestion className="size-5" />}
          href="/admin/question-bank"
        />
        <StatCard
          label="Đề thi học sinh làm được"
          value={overview.exams.takeable}
          detail={
            overview.exams.unpublished
              ? `${overview.exams.unpublished} đề chưa xuất bản`
              : 'Không có đề chờ xuất bản'
          }
          icon={<BookOpen className="size-5" />}
          href="/admin/exams"
        />
        <StatCard
          label="Học sinh đã có hồ sơ"
          value={overview.students.onboarded}
          detail={`trên ${overview.students.registered} tài khoản đã đăng ký`}
          icon={<Users className="size-5" />}
          href="/admin/roadmaps"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="overview-tasks">
          <h2 id="overview-tasks" className="mb-2 text-sm font-semibold text-slate-900">
            Việc cần làm
          </h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {tasks.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-4 text-sm text-slate-600">
                <CheckCircle2 className="size-4 text-emerald-600" /> Không có việc tồn đọng.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100" data-testid="overview-tasks">
                {tasks.map((task) => (
                  <li key={task.text}>
                    <Link
                      href={task.href}
                      className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                    >
                      <ClipboardList className="size-4 shrink-0 text-amber-600" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{task.text}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{task.detail}</p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-700">
                        {task.cta} <ChevronRight className="size-3.5" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="overview-programs">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="overview-programs" className="text-sm font-semibold text-slate-900">
              Chương trình học sinh đang nhận
            </h2>
            <Link href="/admin/roadmaps" className="text-xs font-semibold text-blue-700">
              Chi tiết
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {overview.programs.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-600">
                Chưa có chương trình nào có bài đang mở. Học sinh đăng ký sẽ thấy trang trống.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100" data-testid="overview-programs">
                {overview.programs.map((program) => (
                  <li key={program.id} className="flex items-center gap-3 px-4 py-3">
                    <Route className="size-4 shrink-0 text-blue-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{program.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {program.chapterCount} chương · {program.lessonCount} bài ·{' '}
                        {program.lessonsWithPractice} bài có luyện tập
                      </p>
                    </div>
                    <p className="shrink-0 text-right text-xs text-slate-500">
                      <span className="block text-sm font-semibold text-slate-900">
                        {program.studentsPlaced}
                      </span>
                      học sinh
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section aria-labelledby="overview-flow">
        <h2 id="overview-flow" className="mb-2 text-sm font-semibold text-slate-900">
          Nội dung đi đến học sinh thế nào
        </h2>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW.map((step, index) => (
            <li key={step.href}>
              <Link
                href={step.href}
                className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300"
              >
                <span className="text-[11px] font-bold text-blue-700">Bước {index + 1}</span>
                <span className="mt-1 text-sm font-semibold text-slate-900">{step.title}</span>
                <span className="mt-1 flex-1 text-xs leading-5 text-slate-500">{step.text}</span>
                <ArrowRight className="mt-2 size-4 text-slate-300 group-hover:text-slate-500" />
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
