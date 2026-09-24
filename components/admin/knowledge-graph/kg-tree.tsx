'use client';

import { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Book,
  GraduationCap,
  FolderTree,
  Lightbulb,
  MoreHorizontal,
  Plus,
  Trash2,
  Search,
  X,
} from 'lucide-react';
import { KgNode, KgSubject, KgGrade, KgDomain, KgConcept } from '@/lib/knowledge-graph/kg-types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface KnowledgeGraphTreeProps {
  subjects: KgSubject[];
  selectedNodeId?: string;
  onSelect: (node: KgNode) => void;
  onCreateChild: (parentId: string | null, type: string, title: string) => void;
  onDelete: (nodeId: string, force: boolean) => void;
  onReorder?: (nodeId: string, newOrder: number) => void;
}

export function KnowledgeGraphTree({
  subjects,
  selectedNodeId,
  onSelect,
  onCreateChild,
  onDelete,
}: KnowledgeGraphTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'SUBJECT':
        return <Book className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
      case 'GRADE':
        return <GraduationCap className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
      case 'DOMAIN':
        return <FolderTree className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      case 'CONCEPT':
        return <Lightbulb className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
      default:
        return null;
    }
  };

  const getChildType = (type: string) => {
    switch (type) {
      case 'SUBJECT':
        return 'GRADE';
      case 'GRADE':
        return 'DOMAIN';
      case 'DOMAIN':
        return 'CONCEPT';
      default:
        return null;
    }
  };

  const getChildLabel = (type: string) => {
    switch (type) {
      case 'SUBJECT':
        return 'Grade';
      case 'GRADE':
        return 'Domain';
      case 'DOMAIN':
        return 'Concept';
      default:
        return '';
    }
  };

  // Simple search filtering
  const searchMatch = (node: KgNode) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (node.title.toLowerCase().includes(q)) return true;
    if (node.type === 'CONCEPT') {
      const c = node as KgConcept;
      if (c.aliases?.some((a) => a.toLowerCase().includes(q))) return true;
    }
    return false;
  };

  const hasMatchingDescendant = (node: KgNode): boolean => {
    if (!searchQuery) return true;
    if (searchMatch(node)) return true;

    if (node.type === 'SUBJECT') {
      return (node as KgSubject).grades.some((g) => hasMatchingDescendant(g));
    }
    if (node.type === 'GRADE') {
      return (node as KgGrade).domains.some((d) => hasMatchingDescendant(d));
    }
    if (node.type === 'DOMAIN') {
      return (node as KgDomain).concepts.some((c) => hasMatchingDescendant(c));
    }
    return false;
  };

  const renderNode = (node: KgNode, level: number = 0) => {
    // Hide archived by default unless toggled or searched
    if (node.status === 'ARCHIVED' && node.type === 'CONCEPT') {
      if (!showArchived && !searchQuery) return null;
    }

    // If searching, hide branches that don't match
    if (searchQuery && !hasMatchingDescendant(node)) {
      return null;
    }

    // Auto-expand if searching and matching
    const isExpanded = searchQuery ? true : expandedIds.has(node.id);
    const isSelected = selectedNodeId === node.id;
    const hasChildren =
      (node.type === 'SUBJECT' && (node as KgSubject).grades.length > 0) ||
      (node.type === 'GRADE' && (node as KgGrade).domains.length > 0) ||
      (node.type === 'DOMAIN' && (node as KgDomain).concepts.length > 0);

    const childType = getChildType(node.type);
    const childLabel = getChildLabel(node.type);

    // Highlight matched text if searching
    const isDirectMatch = searchQuery && searchMatch(node);

    return (
      <div key={node.id} className="select-none relative">
        <div
          className={cn(
            'group flex items-center justify-between py-[5px] pr-2 rounded-md cursor-pointer text-[13px] hover:bg-slate-100 transition-colors my-[1px]',
            isSelected && 'bg-blue-50/80 hover:bg-blue-100 text-blue-700 font-medium'
          )}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => onSelect(node)}
        >
          {/* Left indicator line for active state */}
          {isSelected && (
            <div className="absolute left-0 top-[3px] bottom-[3px] w-[3px] bg-blue-600 rounded-r-md" />
          )}

          <div className="flex items-center gap-1.5 overflow-hidden w-full">
            <div
              className={cn(
                'w-4 h-4 flex items-center justify-center opacity-40 hover:opacity-100 cursor-pointer shrink-0 transition-opacity',
                !hasChildren && 'invisible'
              )}
              onClick={(e) => toggleExpand(node.id, e)}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </div>
            {getIcon(node.type)}
            <span
              className={cn(
                'truncate flex-1 ml-1',
                isDirectMatch && 'text-blue-600 font-medium',
                node.status === 'DRAFT' && 'opacity-70'
              )}
            >
              {node.title}
            </span>
          </div>

          {/* Context Menu equivalent - visible only on hover */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none">
                <div
                  className="p-1 rounded hover:bg-slate-200 text-slate-500"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 text-[13px] shadow-md border-slate-200"
              >
                {childType && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateChild(node.id, childType, `New ${childLabel}`);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 mr-2 text-slate-500" /> Thêm {childLabel}
                  </DropdownMenuItem>
                )}
                {childType && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-700 focus:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(node.id, true);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Xóa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Render children with indentation guide */}
        {isExpanded && hasChildren && (
          <div className="relative">
            {/* Vertical indent guide */}
            <div
              className="absolute top-0 bottom-0 border-l border-slate-200"
              style={{ left: `${level * 16 + 15}px` }}
            />
            {node.type === 'SUBJECT' &&
              (node as KgSubject).grades.map((child) => renderNode(child, level + 1))}
            {node.type === 'GRADE' &&
              (node as KgGrade).domains.map((child) => renderNode(child, level + 1))}
            {node.type === 'DOMAIN' &&
              (node as KgDomain).concepts.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search and Toggle */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm p-2 border-b border-slate-100 z-10 flex flex-col gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm hoặc từ khóa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <X
              className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600"
              onClick={() => setSearchQuery('')}
            />
          )}
        </div>
        <label className="flex items-center gap-1.5 px-1 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
          />
          <span className="text-[11px] text-slate-500 font-medium">Hiển thị mục đã lưu trữ</span>
        </label>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {subjects.map((subj) => renderNode(subj, 0))}
      </div>
    </div>
  );
}
