'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Eye, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ROADMAP_CONTENT_CATALOG,
  ROADMAP_STUDENT_FIXTURES,
  activityLabel,
  countRoadmapSteps,
  createEmptyRoadmap,
  roadmapDefinitionService,
  type RoadmapDefinition,
  type RoadmapDefinitionStep,
} from '../lib/roadmap-definition';

export function AdminRoadmapList() {
  const [items, setItems] = React.useState<RoadmapDefinition[]>([]);
  React.useEffect(() => {
    void roadmapDefinitionService.list().then(setItems);
  }, []);
  async function toggle(item: RoadmapDefinition) {
    await roadmapDefinitionService.publish(item.id, item.status !== 'published');
    setItems(await roadmapDefinitionService.list());
  }
  return (
    <div className="space-y-5">
      <header className="flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">Lộ trình học</h1>
          <p className="mt-1 text-sm text-slate-500">
            Thiết kế hành trình dùng chung và xem trước trải nghiệm học sinh.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/admin/roadmaps/new" />}>
          <Plus /> Tạo lộ trình
        </Button>
      </header>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="border-b bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Tên lộ trình</th>
              <th className="px-3 py-3">Môn / Lớp</th>
              <th className="px-3 py-3">Mục tiêu</th>
              <th className="px-3 py-3">Cấu trúc</th>
              <th className="px-3 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    className="font-semibold text-blue-700 hover:underline"
                    href={`/admin/roadmaps/${item.id}`}
                  >
                    {item.name}
                  </Link>
                  <p className="text-xs text-slate-400">
                    Cập nhật {new Intl.DateTimeFormat('vi-VN').format(new Date(item.updatedAt))}
                  </p>
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {item.subject} · Lớp {item.grade}
                </td>
                <td className="max-w-56 px-3 py-3 text-xs text-slate-600">{item.target}</td>
                <td className="px-3 py-3 text-xs text-slate-600">
                  {item.stages.length} giai đoạn · {countRoadmapSteps(item)} bước
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded-md border px-2 py-1 text-xs font-semibold ${item.status === 'published' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                  >
                    {item.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    nativeButton={false}
                    render={<Link href={`/admin/roadmaps/${item.id}?preview=1`} />}
                  >
                    <Eye /> Xem trước
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void toggle(item)}>
                    {item.status === 'published' ? 'Gỡ xuất bản' : 'Xuất bản'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const newStep = (index: number): RoadmapDefinitionStep => ({
  id: `step-${Date.now()}`,
  order: index + 1,
  title: 'Hoạt động mới',
  type: 'lesson',
  required: true,
  estimatedMinutes: 15,
  prerequisiteStepIds: [],
  unlock: 'after_prerequisites',
  completion: 'content_completed',
});

export function AdminRoadmapEditor({
  roadmapId,
  initialPreview = false,
}: {
  roadmapId?: string;
  initialPreview?: boolean;
}) {
  const [item, setItem] = React.useState<RoadmapDefinition | null>(null);
  const [preview, setPreview] = React.useState(initialPreview);
  const [fixture, setFixture] = React.useState(ROADMAP_STUDENT_FIXTURES[1].id);
  const [notice, setNotice] = React.useState('');
  const [persisted, setPersisted] = React.useState(Boolean(roadmapId));
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    void (
      roadmapId ? roadmapDefinitionService.get(roadmapId) : Promise.resolve(createEmptyRoadmap())
    ).then(setItem);
  }, [roadmapId]);
  if (!item) return <p className="text-sm text-slate-500">Đang tải lộ trình…</p>;
  const issues = roadmapDefinitionService.validate(item);
  const simulation = roadmapDefinitionService.simulate(
    item,
    ROADMAP_STUDENT_FIXTURES.find((x) => x.id === fixture)!
  );
  const change = (patch: Partial<RoadmapDefinition>) => setItem({ ...item, ...patch });
  async function save() {
    if (!item) return null;
    setSaving(true);
    try {
      const saved = persisted
        ? await roadmapDefinitionService.update(item)
        : await roadmapDefinitionService.create(item);
      setItem(saved);
      setPersisted(true);
      setNotice('Đã lưu bản nháp trong phiên làm việc.');
      if (!persisted) history.replaceState(null, '', `/admin/roadmaps/${saved.id}`);
      return saved;
    } catch {
      setNotice('Không thể lưu lộ trình. Vui lòng thử lại.');
      return null;
    } finally {
      setSaving(false);
    }
  }
  async function publish() {
    if (issues.length) {
      setNotice('Cần xử lý các lỗi kiểm tra trước khi xuất bản.');
      return;
    }
    const draft = await save();
    if (!draft) return;
    try {
      const saved = await roadmapDefinitionService.publish(draft.id, draft.status !== 'published');
      setItem(saved);
      setNotice(saved.status === 'published' ? 'Đã xuất bản lộ trình.' : 'Đã chuyển về bản nháp.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể đổi trạng thái lộ trình.');
    }
  }
  function updateStage(
    stageId: string,
    updater: (stage: RoadmapDefinition['stages'][number]) => RoadmapDefinition['stages'][number]
  ) {
    if (!item) return;
    change({ stages: item.stages.map((s) => (s.id === stageId ? updater(s) : s)) });
  }
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <Link href="/admin/roadmaps" className="text-xs font-medium text-blue-700">
            ← Danh sách lộ trình
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-900">
            {roadmapId ? 'Chỉnh sửa lộ trình' : 'Tạo lộ trình'}
          </h1>
        </div>
        <Button variant="outline" onClick={() => setPreview(!preview)}>
          <Eye /> {preview ? 'Quay lại chỉnh sửa' : 'Xem trước'}
        </Button>
        <Button variant="outline" disabled={saving} onClick={() => void save()}>
          <Save /> {saving ? 'Đang lưu…' : 'Lưu nháp'}
        </Button>
        <Button disabled={saving} onClick={() => void publish()}>
          {item.status === 'published' ? 'Gỡ xuất bản' : 'Xuất bản'}
        </Button>
      </header>
      {notice && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
          {notice}
        </div>
      )}
      {preview ? (
        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <aside className="rounded-lg border bg-white p-4">
            <label className="text-xs font-semibold text-slate-700">Tình huống mô phỏng</label>
            <select
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={fixture}
              onChange={(e) => setFixture(e.target.value)}
            >
              {ROADMAP_STUDENT_FIXTURES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <p className="mt-5 text-xs text-slate-500">Tiến độ tổng thể</p>
            <p className="mt-1 text-3xl font-bold text-blue-700">{simulation.overallProgress}%</p>
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${simulation.overallProgress}%` }}
              />
            </div>
          </aside>
          <main className="space-y-4">
            {simulation.stages.map((stage) => (
              <section key={stage.id} className="rounded-lg border bg-white p-4">
                <div className="flex items-center">
                  <div className="flex-1">
                    <h2 className="font-semibold text-slate-900">{stage.title}</h2>
                    <p className="text-xs text-slate-500">Hoàn thành {stage.progress}%</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {stage.steps.map((step) => (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 rounded-lg border p-3 ${step.state === 'current' ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}
                    >
                      <span
                        className={`size-2 rounded-full ${step.state === 'completed' ? 'bg-emerald-500' : step.state === 'current' ? 'bg-blue-600' : step.state === 'next' ? 'bg-amber-500' : 'bg-slate-300'}`}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">{step.title}</p>
                        <p className="text-xs text-slate-500">
                          {activityLabel[step.type]} · {step.estimatedMinutes} phút{' '}
                          {!step.required && '· Tự chọn'}
                        </p>
                      </div>
                      {step.recommended && (
                        <span className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                          Nên học
                        </span>
                      )}
                      <span className="text-xs font-medium text-slate-500">
                        {
                          {
                            completed: 'Hoàn thành',
                            current: 'Đang học',
                            next: 'Tiếp theo',
                            locked: 'Đã khóa',
                          }[step.state]
                        }
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </main>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <main className="space-y-4">
            <section className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">
                Tên lộ trình
                <Input
                  className="mt-1"
                  value={item.name}
                  onChange={(e) => change({ name: e.target.value })}
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Mục tiêu
                <Input
                  className="mt-1"
                  value={item.target}
                  onChange={(e) => change({ target: e.target.value })}
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Môn học
                <Input
                  className="mt-1"
                  value={item.subject}
                  onChange={(e) => change({ subject: e.target.value })}
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Lớp
                <Input
                  className="mt-1"
                  type="number"
                  min={1}
                  max={12}
                  value={item.grade}
                  onChange={(e) => change({ grade: Number(e.target.value) })}
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Điểm mục tiêu
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={item.targetScore ?? ''}
                  onChange={(e) =>
                    change({
                      targetScore: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                />
              </label>
            </section>
            {item.stages.map((stage) => (
              <section key={stage.id} className="rounded-lg border bg-white p-4">
                <div className="flex gap-2">
                  <Input
                    value={stage.title}
                    onChange={(e) =>
                      updateStage(stage.id, (s) => ({ ...s, title: e.target.value }))
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Xóa giai đoạn"
                    onClick={() =>
                      change({
                        stages: item.stages
                          .filter((s) => s.id !== stage.id)
                          .map((s, index) => ({ ...s, order: index + 1 })),
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="mt-4 space-y-3">
                  {stage.steps.map((step, index) => (
                    <div key={step.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-xs text-slate-400">{index + 1}</span>
                        <Input
                          value={step.title}
                          onChange={(e) =>
                            updateStage(stage.id, (s) => ({
                              ...s,
                              steps: s.steps.map((x) =>
                                x.id === step.id ? { ...x, title: e.target.value } : x
                              ),
                            }))
                          }
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={!index}
                          aria-label="Lên"
                          onClick={() =>
                            updateStage(stage.id, (s) => {
                              const a = [...s.steps];
                              [a[index - 1], a[index]] = [a[index], a[index - 1]];
                              return { ...s, steps: a.map((x, i) => ({ ...x, order: i + 1 })) };
                            })
                          }
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={index === stage.steps.length - 1}
                          aria-label="Xuống"
                          onClick={() =>
                            updateStage(stage.id, (s) => {
                              const a = [...s.steps];
                              [a[index + 1], a[index]] = [a[index], a[index + 1]];
                              return { ...s, steps: a.map((x, i) => ({ ...x, order: i + 1 })) };
                            })
                          }
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Xóa"
                          onClick={() =>
                            updateStage(stage.id, (s) => ({
                              ...s,
                              steps: s.steps
                                .filter((x) => x.id !== step.id)
                                .map((x, i) => ({ ...x, order: i + 1 })),
                            }))
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-4">
                        <select
                          className="rounded-md border px-2 py-2 text-xs"
                          value={step.type}
                          onChange={(e) =>
                            updateStage(stage.id, (s) => ({
                              ...s,
                              steps: s.steps.map((x) =>
                                x.id === step.id
                                  ? {
                                      ...x,
                                      type: e.target.value as RoadmapDefinitionStep['type'],
                                      contentRef: undefined,
                                    }
                                  : x
                              ),
                            }))
                          }
                        >
                          {Object.entries(activityLabel).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                        <select
                          className="rounded-md border px-2 py-2 text-xs"
                          value={
                            step.contentRef ? `${step.contentRef.type}:${step.contentRef.id}` : ''
                          }
                          onChange={(e) => {
                            const c = ROADMAP_CONTENT_CATALOG.find(
                              (c) => `${c.type}:${c.id}` === e.target.value
                            );
                            updateStage(stage.id, (s) => ({
                              ...s,
                              steps: s.steps.map((x) =>
                                x.id === step.id
                                  ? { ...x, contentRef: c && { type: c.type, id: c.id } }
                                  : x
                              ),
                            }));
                          }}
                        >
                          <option value="">Chọn nội dung…</option>
                          {ROADMAP_CONTENT_CATALOG.filter(
                            (c) =>
                              c.type ===
                              (step.type === 'practice' || step.type === 'review'
                                ? 'practice_set'
                                : step.type)
                          ).map((c) => (
                            <option key={c.id} value={`${c.type}:${c.id}`}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                        <select
                          className="rounded-md border px-2 py-2 text-xs"
                          value={step.prerequisiteStepIds[0] ?? ''}
                          onChange={(e) =>
                            updateStage(stage.id, (s) => ({
                              ...s,
                              steps: s.steps.map((x) =>
                                x.id === step.id
                                  ? {
                                      ...x,
                                      prerequisiteStepIds: e.target.value ? [e.target.value] : [],
                                    }
                                  : x
                              ),
                            }))
                          }
                        >
                          <option value="">Không có tiên quyết</option>
                          {item.stages
                            .flatMap((s) => s.steps)
                            .filter((x) => x.id !== step.id)
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.title}
                              </option>
                            ))}
                        </select>
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={step.required}
                            onChange={(e) =>
                              updateStage(stage.id, (s) => ({
                                ...s,
                                steps: s.steps.map((x) =>
                                  x.id === step.id ? { ...x, required: e.target.checked } : x
                                ),
                              }))
                            }
                          />{' '}
                          Bắt buộc
                        </label>
                      </div>
                      <details className="mt-3 border-t border-slate-100 pt-3">
                        <summary className="cursor-pointer text-xs font-semibold text-blue-700">
                          Thiết lập nâng cao
                        </summary>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <label className="text-xs text-slate-600">
                            Thời lượng (phút)
                            <Input
                              className="mt-1"
                              type="number"
                              min={1}
                              value={step.estimatedMinutes}
                              onChange={(e) =>
                                updateStage(stage.id, (s) => ({
                                  ...s,
                                  steps: s.steps.map((x) =>
                                    x.id === step.id
                                      ? { ...x, estimatedMinutes: Number(e.target.value) }
                                      : x
                                  ),
                                }))
                              }
                            />
                          </label>
                          <label className="text-xs text-slate-600">
                            Mở khóa
                            <select
                              className="mt-1 w-full rounded-md border px-2 py-2"
                              value={step.unlock}
                              onChange={(e) =>
                                updateStage(stage.id, (s) => ({
                                  ...s,
                                  steps: s.steps.map((x) =>
                                    x.id === step.id
                                      ? {
                                          ...x,
                                          unlock: e.target.value as RoadmapDefinitionStep['unlock'],
                                        }
                                      : x
                                  ),
                                }))
                              }
                            >
                              <option value="after_prerequisites">Sau điều kiện tiên quyết</option>
                              <option value="always">Luôn mở</option>
                            </select>
                          </label>
                          <label className="text-xs text-slate-600">
                            Hoàn thành khi
                            <select
                              className="mt-1 w-full rounded-md border px-2 py-2"
                              value={step.completion}
                              onChange={(e) =>
                                updateStage(stage.id, (s) => ({
                                  ...s,
                                  steps: s.steps.map((x) =>
                                    x.id === step.id
                                      ? {
                                          ...x,
                                          completion: e.target
                                            .value as RoadmapDefinitionStep['completion'],
                                        }
                                      : x
                                  ),
                                }))
                              }
                            >
                              <option value="content_completed">Hoàn thành nội dung</option>
                              <option value="minimum_score">Đạt điểm tối thiểu</option>
                            </select>
                          </label>
                          {step.completion === 'minimum_score' && (
                            <label className="text-xs text-slate-600">
                              Điểm tối thiểu (%)
                              <Input
                                className="mt-1"
                                type="number"
                                min={1}
                                max={100}
                                value={step.minimumScore ?? 70}
                                onChange={(e) =>
                                  updateStage(stage.id, (s) => ({
                                    ...s,
                                    steps: s.steps.map((x) =>
                                      x.id === step.id
                                        ? { ...x, minimumScore: Number(e.target.value) }
                                        : x
                                    ),
                                  }))
                                }
                              />
                            </label>
                          )}
                          <label className="text-xs text-slate-600">
                            Nhãn gợi ý
                            <Input
                              className="mt-1"
                              value={step.recommendationTag ?? ''}
                              onChange={(e) =>
                                updateStage(stage.id, (s) => ({
                                  ...s,
                                  steps: s.steps.map((x) =>
                                    x.id === step.id
                                      ? { ...x, recommendationTag: e.target.value || undefined }
                                      : x
                                  ),
                                }))
                              }
                            />
                          </label>
                          <label className="flex items-end gap-2 pb-2 text-xs">
                            <input
                              type="checkbox"
                              checked={Boolean(step.milestone)}
                              onChange={(e) =>
                                updateStage(stage.id, (s) => ({
                                  ...s,
                                  steps: s.steps.map((x) =>
                                    x.id === step.id ? { ...x, milestone: e.target.checked } : x
                                  ),
                                }))
                              }
                            />{' '}
                            Cột mốc
                          </label>
                        </div>
                      </details>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateStage(stage.id, (s) => ({
                        ...s,
                        steps: [...s.steps, newStep(s.steps.length)],
                      }))
                    }
                  >
                    <Plus /> Thêm hoạt động
                  </Button>
                </div>
              </section>
            ))}
            <Button
              variant="outline"
              onClick={() =>
                change({
                  stages: [
                    ...item.stages,
                    {
                      id: `stage-${Date.now()}`,
                      order: item.stages.length + 1,
                      title: `Giai đoạn ${item.stages.length + 1}`,
                      steps: [],
                    },
                  ],
                })
              }
            >
              <Plus /> Thêm giai đoạn
            </Button>
          </main>
          <aside>
            <div className="sticky top-4 rounded-lg border bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Kiểm tra trước xuất bản</h2>
              {issues.length ? (
                <ul className="mt-3 space-y-2 text-xs text-red-700">
                  {issues.map((x, i) => (
                    <li key={`${x.path}-${i}`}>• {x.message}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-emerald-700">
                  Lộ trình hợp lệ và sẵn sàng xuất bản.
                </p>
              )}
              <p className="mt-4 text-xs text-slate-500">
                {item.stages.length} giai đoạn · {countRoadmapSteps(item)} hoạt động
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
