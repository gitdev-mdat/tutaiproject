'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type {
  KnowledgeTreeNode,
  KnowledgeArticle,
  KnowledgeSource,
} from '@/lib/knowledge-tree/knowledge-tree-types';
import { ChildrenTab } from './children-tab';
import { SourcesTab } from './sources-tab';
import { ArticleTab } from './article-tab';

interface NodeWorkspaceProps {
  node: KnowledgeTreeNode;
  parentPath: string;
  childrenNodes: KnowledgeTreeNode[];
  sources: KnowledgeSource[];
  article: KnowledgeArticle | null;
  onAddChild: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenNode: (id: string) => void;
  onAttachSource: (
    input: Omit<KnowledgeSource, 'id' | 'scopeNodeId' | 'createdAt'>
  ) => Promise<void>;
  onRemoveSource: (id: string) => Promise<void>;
  onEnableContent: () => void;
  onSaveArticle: (article: Partial<KnowledgeArticle>) => Promise<void>;
}

export function NodeWorkspace({
  node,
  parentPath,
  childrenNodes,
  sources,
  article,
  onAddChild,
  onEdit,
  onDelete,
  onOpenNode,
  onAttachSource,
  onRemoveSource,
  onEnableContent,
  onSaveArticle,
}: NodeWorkspaceProps) {
  const [activeTab, setActiveTab] = React.useState('children');

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <span>{parentPath}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">{node.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            Chỉnh sửa
          </Button>
          <Button size="sm" onClick={onAddChild}>
            Thêm mục con
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 bg-white border border-slate-200 shadow-md"
            >
              <DropdownMenuItem onClick={onEdit}>Chỉnh sửa thông tin</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-100" />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-red-600 focus:text-red-700 focus:bg-red-50"
              >
                <Trash2 className="size-4 mr-2" /> Xóa mục này
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Navigation */}
      <nav className="flex shrink-0 gap-6 border-b border-slate-200 px-6 text-sm font-medium">
        {[
          { id: 'children', label: 'Mục con' },
          { id: 'article', label: 'Nội dung học' },
          { id: 'sources', label: 'Nguồn tài liệu' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 py-3 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'children' && (
          <ChildrenTab
            childrenNodes={childrenNodes}
            onAddChild={onAddChild}
            onOpenNode={onOpenNode}
          />
        )}
        {activeTab === 'article' && (
          <ArticleTab
            hasLearningContent={!!node.hasLearningContent}
            onEnableContent={onEnableContent}
            article={article}
            onSaveArticle={onSaveArticle}
          />
        )}
        {activeTab === 'sources' && (
          <SourcesTab
            nodeTitle={node.title}
            sources={sources}
            onAttachSource={onAttachSource}
            onRemoveSource={onRemoveSource}
          />
        )}
      </div>
    </div>
  );
}
