'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, CloudUpload, PartyPopper } from 'lucide-react';
import {
  WORK_ITEM_ORDER,
  type WorkItem,
  type WorkItemKind,
} from '@/lib/knowledge-tree/content-studio';

const GROUPS: Record<WorkItemKind, { title: string; hint: string; verb: string; dot: string }> = {
  READY: {
    title: 'Sẵn sàng hiển thị',
    hint: 'Đủ nội dung, chỉ cần xem lại rồi bật hiển thị.',
    verb: 'Xem lại',
    dot: 'bg-blue-500',
  },
  DRAFT: {
    title: 'Bản nháp còn thiếu',
    hint: 'Chưa đủ Mục tiêu, Nội dung chính hoặc Ví dụ.',
    verb: 'Soạn tiếp',
    dot: 'bg-amber-500',
  },
  NO_ARTICLE: {
    title: 'Chưa có bài',
    hint: 'Kiến thức chưa có bài học nào.',
    verb: 'Soạn bài',
    dot: 'border border-slate-300 bg-white',
  },
  EMPTY_CHAPTER: {
    title: 'Chương chưa có kiến thức',
    hint: 'Học sinh chưa có gì để học trong chương này.',
    verb: 'Thêm',
    dot: 'bg-slate-300',
  },
};

const PER_GROUP = 4;

interface Props {
  items: WorkItem[];
  migration: { nodes: number; articles: number; onOpen: () => void } | null;
  onOpenLesson: (nodeId: string) => void;
  onAddToChapter: (chapterId: string) => void;
  onShowAll: (kind: Exclude<WorkItemKind, 'EMPTY_CHAPTER'>) => void;
}

/** "What should I do next?" — derived from lesson states, nothing is stored. */
export function WorkQueue({ items, migration, onOpenLesson, onAddToChapter, onShowAll }: Props) {
  // Collapsed by default below lg so the explorer stays reachable on phones.
  const [expanded, setExpanded] = React.useState(false);
  const total = items.length + (migration ? 1 : 0);
  const groups = WORK_ITEM_ORDER.map((kind) => ({
    kind,
    items: items.filter((item) => item.kind === kind),
  })).filter((group) => group.items.length);

  // Below lg, the collapsed queue shows only the first two items of the first group.
  const canExpand = groups.length > 1 || !!migration || (groups[0]?.items.length ?? 0) > 2;

  const open = (item: WorkItem) =>
    item.kind === 'EMPTY_CHAPTER' ? onAddToChapter(item.chapterId) : onOpenLesson(item.nodeId);

  return (
    <section
      aria-labelledby="work-queue-title"
      className="rounded-xl border border-slate-200 bg-white"
    >
      <div className="flex items-center gap-2 px-4 pb-2 pt-3">
        <h2 id="work-queue-title" className="flex-1 text-sm font-semibold text-slate-900">
          Việc cần làm
          {total > 0 && (
            <span className="ml-1.5 font-normal tabular-nums text-slate-400">{total}</span>
          )}
        </h2>
        {canExpand && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="work-queue-list"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-blue-700 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden"
          >
            {expanded ? 'Thu gọn' : 'Xem tất cả'}
            <ChevronDown
              className={`size-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {total === 0 ? (
        <p className="flex items-start gap-2 px-4 pb-4 text-sm leading-6 text-slate-600">
          <PartyPopper className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
          Không còn việc nào ở lớp này. Mọi kiến thức đều đang hiển thị cho học sinh.
        </p>
      ) : (
        <div id="work-queue-list" className="pb-2">
          {migration && (
            <button
              type="button"
              onClick={migration.onOpen}
              className="mx-2 mb-1 flex w-[calc(100%-1rem)] items-start gap-2.5 rounded-lg bg-amber-50 px-2.5 py-2 text-left text-sm text-amber-950 outline-none hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <CloudUpload className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
              <span className="min-w-0 flex-1 leading-5">
                <span className="block font-medium">Dữ liệu cũ chưa chuyển</span>
                <span className="block text-xs text-amber-800">
                  {migration.nodes} mục, {migration.articles} bài chỉ có trên trình duyệt này
                </span>
              </span>
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
            </button>
          )}
          {groups.map((group, groupIndex) => {
            const meta = GROUPS[group.kind];
            const shown = group.items.slice(0, PER_GROUP);
            const rest = group.items.length - shown.length;
            // On small screens only the first group is visible until expanded.
            const hiddenOnMobile = !expanded && (groupIndex > 0 || !!migration);
            return (
              <div key={group.kind} className={hiddenOnMobile ? 'hidden lg:block' : undefined}>
                <h3 className="flex items-center gap-2 px-4 pb-1 pt-2 text-xs font-semibold text-slate-500">
                  <span aria-hidden="true" className={`size-2 rounded-full ${meta.dot}`} />
                  {meta.title}
                  <span className="font-normal tabular-nums text-slate-400">
                    {group.items.length}
                  </span>
                </h3>
                <p className="sr-only">{meta.hint}</p>
                <ul>
                  {shown.map((item, itemIndex) => (
                    <li
                      key={`${item.kind}-${item.nodeId}`}
                      className={!expanded && itemIndex >= 2 ? 'hidden lg:block' : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => open(item)}
                        className="group flex w-full items-center gap-3 px-4 py-1.5 text-left outline-none hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-slate-800">
                            {item.title}
                          </span>
                          {item.kind !== 'EMPTY_CHAPTER' && (
                            <span className="block truncate text-xs text-slate-400">
                              {item.chapterTitle}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs font-medium text-blue-700 opacity-70 group-hover:opacity-100">
                          {meta.verb}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {rest > 0 && group.kind !== 'EMPTY_CHAPTER' && (
                  <button
                    type="button"
                    onClick={() => onShowAll(group.kind as Exclude<WorkItemKind, 'EMPTY_CHAPTER'>)}
                    className={`mx-4 mb-1 mt-0.5 rounded text-xs ${expanded ? 'inline-block' : 'hidden lg:inline-block'} font-medium text-slate-500 outline-none hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500`}
                  >
                    + {rest} mục khác
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
