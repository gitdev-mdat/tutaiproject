'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, GripVertical, FileText } from 'lucide-react';
import type { KnowledgeTreeNode } from '@/lib/knowledge-tree/knowledge-tree-types';
import { KNOWLEDGE_NODE_TYPE_LABELS } from '@/lib/knowledge-tree/knowledge-node-types';

interface ChildrenTabProps {
  childrenNodes: KnowledgeTreeNode[];
  onAddChild: () => void;
  onOpenNode: (id: string) => void;
}

export function ChildrenTab({ childrenNodes, onAddChild, onOpenNode }: ChildrenTabProps) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Mục con</h2>
        <Button onClick={onAddChild} className="gap-2">
          <Plus className="size-4" /> Thêm mục con
        </Button>
      </div>

      {childrenNodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Chưa có mục con</h3>
          <p className="mt-1 text-sm text-slate-500 mb-4">
            Tạo mục con đầu tiên để tiếp tục xây dựng cây kiến thức.
          </p>
          <Button onClick={onAddChild} variant="outline">
            Thêm mục con
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="w-10 px-2 py-3"></th>
                <th className="px-4 py-3 font-medium">Tên mục</th>
                <th className="px-4 py-3 font-medium">Phân loại</th>
                <th className="px-4 py-3 font-medium">Nội dung</th>
                <th className="px-4 py-3 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {childrenNodes.map((node) => (
                <tr key={node.id} className="group hover:bg-slate-50">
                  <td className="px-2 py-3 text-center">
                    <button className="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing">
                      <GripVertical className="mx-auto size-4" />
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <button
                      onClick={() => onOpenNode(node.id)}
                      className="hover:text-blue-600 hover:underline"
                    >
                      {node.title}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {node.nodeType ? KNOWLEDGE_NODE_TYPE_LABELS[node.nodeType] : 'Chưa phân loại'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {node.hasLearningContent ? (
                      <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">
                        <FileText className="size-3" /> Có bài viết
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => onOpenNode(node.id)}>
                      Mở
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
