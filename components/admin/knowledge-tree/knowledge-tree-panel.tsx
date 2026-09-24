'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FolderTree,
  FileText,
  ChevronRight,
  ChevronDown,
  Download,
  Search,
  Plus,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { KnowledgeTreeNode } from '@/lib/knowledge-tree/knowledge-tree-types';
import { isOrganizationalNodeType } from '@/lib/knowledge-tree/knowledge-node-types';
import { useAdminWorkspace } from '../admin-workspace-context';

interface KnowledgeTreePanelProps {
  treeNodes: KnowledgeTreeNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onCreateRoot: () => void;
  onCreateChild?: (parentId: string) => void;
  onImportTree: () => void;
}

export function KnowledgeTreePanel({
  treeNodes,
  selectedNodeId,
  onSelectNode,
  onCreateRoot,
  onCreateChild,
  onImportTree,
}: KnowledgeTreePanelProps) {
  const { treePanelWidth, setTreePanelWidth, treePanelCollapsed } = useAdminWorkspace();
  const [search, setSearch] = React.useState('');
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.pageX;
      const startWidth = treePanelWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.pageX - startX;
        setTreePanelWidth(startWidth + delta);
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [treePanelWidth, setTreePanelWidth]
  );

  React.useEffect(() => {
    if (selectedNodeId) {
      // Find path to root
      const findPath = (id: string): string[] => {
        const node = treeNodes.find((n) => n.id === id);
        if (!node || !node.parentId) return [];
        return [...findPath(node.parentId), node.parentId];
      };

      const parents = findPath(selectedNodeId);
      if (parents.length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setExpanded((prev) => {
          const next = { ...prev };
          let changed = false;
          parents.forEach((pId) => {
            if (!next[pId]) {
              next[pId] = true;
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      }
    }
  }, [selectedNodeId, treeNodes]);

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const rootNodes = treeNodes.filter((n) => n.parentId === null).sort((a, b) => a.order - b.order);
  const getChildren = (parentId: string) =>
    treeNodes.filter((n) => n.parentId === parentId).sort((a, b) => a.order - b.order);

  const renderNode = (node: KnowledgeTreeNode, depth: number) => {
    const children = getChildren(node.id);
    const hasChildren = children.length > 0;
    const isExpanded = expanded[node.id];
    const isSelected = selectedNodeId === node.id;
    const isFolder = isOrganizationalNodeType(node.nodeType);

    if (
      search &&
      !node.title.toLowerCase().includes(search.toLowerCase()) &&
      !children.some((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    ) {
      return null;
    }

    return (
      <div key={node.id}>
        <div
          className={`group flex items-center gap-1 cursor-pointer py-1.5 px-2 hover:bg-slate-100 ${
            isSelected ? 'bg-blue-50 text-blue-900 font-medium' : 'text-slate-700'
          }`}
          style={{ paddingLeft: `${depth * 1 + 0.5}rem` }}
          onClick={() => onSelectNode(node.id)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => toggleExpand(e, node.id)}
              className="p-0.5 rounded hover:bg-slate-200 text-slate-400 shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
            </button>
          ) : (
            <div className="w-4 shrink-0" />
          )}

          {isFolder ? (
            <FolderTree
              className={`size-3.5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}
            />
          ) : (
            <FileText
              className={`size-3.5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}
            />
          )}

          <span className="truncate text-sm select-none flex-1">{node.title}</span>

          {/* Hover actions */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center shrink-0 pr-1">
            {onCreateChild && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((prev) => ({ ...prev, [node.id]: true })); // Expand when creating child
                  onCreateChild(node.id);
                }}
                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                title="Thêm mục con"
              >
                <Plus className="size-3.5" />
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded focus:outline-none">
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40 bg-white">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectNode(node.id);
                  }}
                >
                  Chỉnh sửa
                </DropdownMenuItem>
                {onCreateChild && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded((prev) => ({ ...prev, [node.id]: true }));
                      onCreateChild(node.id);
                    }}
                  >
                    Thêm mục con
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>{children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  if (treePanelCollapsed) return null;

  return (
    <div
      className="relative flex h-full shrink-0 flex-col border-r border-slate-200 bg-slate-50/50"
      style={{ width: treePanelWidth }}
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Cây chương trình</h2>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
            {treeNodes.length}
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 text-xs" onClick={onCreateRoot}>
            <Plus className="mr-1 size-3" /> Thêm gốc
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={onImportTree}>
            <Download className="mr-1 size-3" /> Nhập
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-8 pl-8 text-xs bg-white"
            placeholder="Tìm kiếm mục..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {rootNodes.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-slate-500 mb-4">Chưa có cây chương trình.</p>
            <Button size="sm" onClick={onCreateRoot}>
              Tạo mục đầu tiên
            </Button>
          </div>
        ) : (
          rootNodes.map((node) => renderNode(node, 0))
        )}
      </div>

      <div
        className="absolute bottom-0 right-0 top-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
