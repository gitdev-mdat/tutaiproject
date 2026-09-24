'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, FolderTree, BookOpen } from 'lucide-react';
import type {
  KnowledgeTreeNode,
  KnowledgeArticle,
  KnowledgeSource,
} from '@/lib/knowledge-tree/knowledge-tree-types';
import { KNOWLEDGE_NODE_TYPE_LABELS } from '@/lib/knowledge-tree/knowledge-node-types';

interface NodeOverviewTabProps {
  node: KnowledgeTreeNode;
  parentPath: string;
  childrenCount: number;
  sources: KnowledgeSource[];
  article: KnowledgeArticle | null;
  onNavigateTab: (tabId: string) => void;
  onEnableContent: () => void;
}

export function NodeOverviewTab({
  node,
  parentPath,
  childrenCount,
  sources,
  article,
  onNavigateTab,
  onEnableContent,
}: NodeOverviewTabProps) {
  return (
    <div className="p-6">
      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Info */}
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Thông tin chung</h2>

            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-slate-500">Vị trí</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">{parentPath}</dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-slate-500">Loại</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {node.nodeType ? KNOWLEDGE_NODE_TYPE_LABELS[node.nodeType] : 'Chưa phân loại'}
                </dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500">Mô tả ngắn</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {node.description || (
                    <span className="text-slate-400 italic">Không có mô tả</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Nội dung học</h2>
              <Button variant="ghost" size="sm" onClick={() => onNavigateTab('article')}>
                Mở trình soạn thảo
              </Button>
            </div>

            {node.hasLearningContent ? (
              <div className="flex items-center gap-4 rounded-lg bg-blue-50 p-4 border border-blue-100">
                <div className="rounded-full bg-blue-100 p-2 text-blue-600">
                  <FileText className="size-5" />
                </div>
                <div>
                  <div className="font-semibold text-blue-900">
                    {article
                      ? article.status === 'PUBLISHED'
                        ? 'Đã xuất bản'
                        : 'Bản nháp'
                      : 'Chưa có nội dung'}
                  </div>
                  <div className="text-sm text-blue-700 mt-1">
                    {article
                      ? 'Nội dung đã được tạo, bạn có thể tiếp tục chỉnh sửa.'
                      : 'Mục này đã bật tính năng bài viết, nhưng chưa có nội dung.'}
                  </div>
                </div>
                <Button className="ml-auto" size="sm" onClick={() => onNavigateTab('article')}>
                  {article ? 'Tiếp tục soạn thảo' : 'Bắt đầu soạn thảo'}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 p-8 text-center bg-slate-50">
                <p className="text-sm text-slate-500">
                  Mục này hiện chỉ đóng vai trò tổ chức cây. Bạn có thể bật tính năng nội dung để
                  soạn thảo bài giảng.
                </p>
                <Button className="mt-4" variant="outline" onClick={onEnableContent}>
                  Tạo nội dung học
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-4">
          <button
            className="w-full text-left rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300 transition-colors group"
            onClick={() => onNavigateTab('children')}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-100 p-2 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600">
                <FolderTree className="size-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{childrenCount}</div>
                <div className="text-xs font-medium text-slate-500 uppercase">Mục con</div>
              </div>
            </div>
          </button>

          <button
            className="w-full text-left rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300 transition-colors group"
            onClick={() => onNavigateTab('sources')}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-100 p-2 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600">
                <BookOpen className="size-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{sources.length}</div>
                <div className="text-xs font-medium text-slate-500 uppercase">Nguồn tài liệu</div>
              </div>
            </div>
            {sources.length === 0 && (
              <p className="mt-3 text-xs text-slate-500">
                Thêm tài liệu để AI có thể hỗ trợ biên soạn nội dung.
              </p>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
