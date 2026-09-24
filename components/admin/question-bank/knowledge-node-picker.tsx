'use client';

import * as React from 'react';
import { AlertCircle, Check, ChevronsUpDown, Folder, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type {
  KnowledgeTreeNode,
  KnowledgeTreeReadModel,
} from '@/lib/knowledge-tree/knowledge-tree-types';
import { isAttachableKnowledgeNode } from '@/lib/question-bank/qb-knowledge-utils';
import { cn } from '@/lib/utils';

interface KnowledgeNodePickerProps {
  value?: string;
  onChange: (nodeId: string, nodePath: string) => void;
  placeholder?: string;
  className?: string;
}

export function KnowledgeNodePicker({
  value,
  onChange,
  placeholder = 'Chọn mục kiến thức...',
  className,
}: KnowledgeNodePickerProps) {
  const [data, setData] = React.useState<KnowledgeTreeReadModel | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  const loadTree = React.useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/knowledge-tree', { signal });
      if (!response.ok) {
        let message = `Không thể tải cây kiến thức (HTTP ${response.status}).`;
        try {
          const payload = (await response.json()) as { error?: unknown };
          if (typeof payload.error === 'string' && payload.error.trim()) {
            message = payload.error;
          }
        } catch {
          // Keep the status-based fallback when the response is not JSON.
        }
        throw new Error(message);
      }

      const payload = (await response.json()) as KnowledgeTreeReadModel;
      if (!payload?.tree || !Array.isArray(payload.tree.nodes)) {
        throw new Error('Dữ liệu cây kiến thức không hợp lệ.');
      }
      setData(payload);
    } catch (loadError: unknown) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      setData(null);
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải cây kiến thức.');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => void loadTree(controller.signal), 0);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadTree]);

  const nodes = React.useMemo<KnowledgeTreeNode[]>(() => data?.tree.nodes ?? [], [data]);
  const nodeMap = React.useMemo(
    () => new Map<string, KnowledgeTreeNode>(nodes.map((node) => [node.id, node])),
    [nodes]
  );

  const getBreadcrumb = React.useCallback(
    (nodeId: string): string[] => {
      const breadcrumb: string[] = [];
      const visited = new Set<string>();
      let currentId: string | null = nodeId;

      while (currentId && nodeMap.has(currentId) && !visited.has(currentId)) {
        visited.add(currentId);
        const node: KnowledgeTreeNode = nodeMap.get(currentId)!;
        breadcrumb.unshift(node.title);
        currentId = node.parentId;
      }
      return breadcrumb;
    },
    [nodeMap]
  );

  const getPathString = React.useCallback(
    (nodeId: string) => getBreadcrumb(nodeId).join(' › '),
    [getBreadcrumb]
  );

  const selectableNodes = React.useMemo(() => nodes.filter(isAttachableKnowledgeNode), [nodes]);
  const filteredNodes = React.useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('vi');
    if (!query) return selectableNodes;
    return selectableNodes.filter((node) => {
      const titleMatch = node.title.toLocaleLowerCase('vi').includes(query);
      const pathMatch = getPathString(node.id).toLocaleLowerCase('vi').includes(query);
      return titleMatch || pathMatch;
    });
  }, [getPathString, searchQuery, selectableNodes]);

  const selectedPathString = value && nodeMap.has(value) ? getPathString(value) : '';

  return (
    <>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        aria-invalid={Boolean(error)}
        className={cn(
          'h-auto min-h-10 w-full justify-between bg-white py-2 text-left font-normal',
          className,
          !value && 'text-slate-500'
        )}
        onClick={() => setOpen(true)}
      >
        <span className="line-clamp-2 pr-2">
          {value && selectedPathString ? selectedPathString : placeholder}
        </span>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-[500px]">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>Chọn mục kiến thức</DialogTitle>
          </DialogHeader>
          <div className="flex h-[400px] flex-col">
            <div className="flex items-center border-b bg-slate-50 px-4 py-3">
              <Search className="mr-2 size-4 shrink-0 opacity-50" />
              <Input
                placeholder="Tìm theo tên hoặc đường dẫn..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-8 border-0 bg-transparent px-0 shadow-none outline-none focus-visible:ring-0"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  Đang tải cây kiến thức...
                </div>
              ) : error ? (
                <div className="m-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 border-red-200 bg-white"
                    onClick={() => void loadTree()}
                  >
                    <RotateCcw className="mr-2 size-4" />
                    Thử tải lại
                  </Button>
                </div>
              ) : filteredNodes.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  Không tìm thấy mục kiến thức phù hợp.
                </div>
              ) : (
                filteredNodes.map((node) => {
                  const path = getPathString(node.id);
                  const isSelected = value === node.id;
                  return (
                    <button
                      type="button"
                      key={node.id}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100',
                        isSelected && 'bg-blue-50 font-medium text-blue-900'
                      )}
                      onClick={() => {
                        onChange(node.id, path);
                        setOpen(false);
                      }}
                    >
                      <Folder className="size-4 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 overflow-hidden">
                        <span className="block truncate text-[15px]">{node.title}</span>
                        {node.parentId && (
                          <span className="mt-0.5 block truncate text-xs font-normal text-slate-500">
                            {path}
                          </span>
                        )}
                      </span>
                      {isSelected && <Check className="size-4 shrink-0 text-blue-600" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
