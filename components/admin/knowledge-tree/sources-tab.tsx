'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import type { KnowledgeSource } from '@/lib/knowledge-tree/knowledge-tree-types';
import { getSourceStatusLabel } from '@/lib/knowledge-tree/knowledge-source';
import { SourceImportDialog } from './source-import-dialog';

interface SourcesTabProps {
  nodeTitle: string;
  sources: KnowledgeSource[];
  onAttachSource: (
    input: Omit<KnowledgeSource, 'id' | 'scopeNodeId' | 'createdAt'>
  ) => Promise<void>;
  onRemoveSource: (id: string) => Promise<void>;
}

export function SourcesTab({
  nodeTitle,
  sources,
  onAttachSource,
  onRemoveSource,
}: SourcesTabProps) {
  const [isImportOpen, setIsImportOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Nguồn tài liệu</h2>
          <p className="mt-1 text-sm text-slate-500">
            Tài liệu được thêm tại đây sẽ áp dụng cho <strong>{nodeTitle}</strong> và toàn bộ mục
            con.
          </p>
        </div>
        <Button onClick={() => setIsImportOpen(true)} className="gap-2">
          <Plus className="size-4" /> Thêm tài liệu
        </Button>
      </div>

      {sources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Chưa có nguồn tài liệu.</h3>
          <Button onClick={() => setIsImportOpen(true)} variant="outline">
            Thêm tài liệu
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Tên tài liệu</th>
                <th className="px-4 py-3 font-medium">Định dạng</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sources.map((source) => (
                <tr key={source.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{source.name}</td>
                  <td className="px-4 py-3 text-slate-500">{source.sourceType}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        source.status === 'ATTACHED'
                          ? 'bg-slate-100 text-slate-700'
                          : source.status === 'ANALYZED'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {getSourceStatusLabel(source.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => onRemoveSource(source.id)}
                    >
                      <Trash2 className="size-4 mr-1" /> Gỡ
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SourceImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        scopeNodeTitle={nodeTitle}
        onAttach={onAttachSource}
      />
    </div>
  );
}
