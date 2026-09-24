'use client';

import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { KnowledgeGraphTree } from './kg-tree';
import {
  SubjectInspector,
  GradeInspector,
  DomainInspector,
  ConceptInspector,
} from './kg-inspectors';
import {
  KgNode,
  KgSubject,
  KgGrade,
  KgDomain,
  KgConcept,
  KgDocument,
} from '@/lib/knowledge-graph/kg-types';
import {
  Loader2,
  Book,
  GraduationCap,
  FolderTree,
  Lightbulb,
  ChevronRight,
  Share2,
  Activity,
  ShieldCheck,
  FileDown,
  Database,
  Network,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImportManager } from './import/ImportManager';
import { KnowledgeGraphOrientation } from './knowledge-graph-orientation';

export function KnowledgeGraphManager() {
  const [activeTab, setActiveTab] = useState<'ORIENTATION' | 'EXPLORER' | 'IMPORT'>('ORIENTATION');

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') !== 'import') return;
    const timer = window.setTimeout(() => setActiveTab('IMPORT'), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const [data, setData] = useState<KgDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<KgNode | null>(null);

  // ... (keep loadData and useEffect)
  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/knowledge-graph');
      if (!res.ok) throw new Error('Failed to load Knowledge Graph');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      await loadData();
    }
    init();
  }, []);

  // Compute metrics
  const metrics = { subjects: 0, grades: 0, domains: 0, concepts: 0 };
  if (data) {
    for (const s of data.subjects) {
      metrics.subjects++;
      for (const g of s.grades) {
        metrics.grades++;
        for (const d of g.domains) {
          metrics.domains++;
          metrics.concepts += d.concepts.length;
        }
      }
    }
  }

  // Compute breadcrumbs for the selected node
  const getBreadcrumb = (): string[] | null => {
    if (!selectedNode || !data) return null;
    for (const s of data.subjects) {
      if (s.id === selectedNode.id) return [s.title];
      for (const g of s.grades) {
        if (g.id === selectedNode.id) return [s.title, g.title];
        for (const d of g.domains) {
          if (d.id === selectedNode.id) return [s.title, g.title, d.title];
          for (const c of d.concepts) {
            if (c.id === selectedNode.id) return [s.title, g.title, d.title, c.title];
          }
        }
      }
    }
    return null;
  };
  const breadcrumb = getBreadcrumb();

  const handleSelectNode = (node: KgNode) => setSelectedNode(node);

  const handleCreateChild = async (parentId: string | null, type: string, title: string) => {
    try {
      const res = await fetch('/api/knowledge-graph/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId, type, title }),
      });
      if (!res.ok) throw new Error('Failed to create node');
      await loadData();
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      }
    }
  };

  const handleDeleteNode = async (nodeId: string, force: boolean) => {
    try {
      const res = await fetch(`/api/knowledge-graph/nodes/${nodeId}?force=${force}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete node');
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null);
      }
      await loadData();
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      }
    }
  };

  const handleReorder = async (nodeId: string, newOrder: number) => {
    try {
      const res = await fetch(`/api/knowledge-graph/nodes/${nodeId}/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newOrder }),
      });
      if (!res.ok) throw new Error('Failed to reorder node');
      await loadData();
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      }
    }
  };

  const handleSaveNode = async (nodeId: string, updates: Partial<KgNode>) => {
    try {
      const res = await fetch(`/api/knowledge-graph/nodes/${nodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update node');
      const json = await res.json();
      if (selectedNode?.id === nodeId) {
        setSelectedNode(json.node);
      }
      await loadData();
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      }
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span className="text-sm font-medium">Loading Canonical Graph...</span>
      </div>
    );
  }

  if (activeTab === 'IMPORT') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 p-4">
        {/* Compact Navigation Bar */}
        <div className="flex items-center justify-between shrink-0 bg-white rounded-lg border border-slate-200 px-4 py-2.5 shadow-sm">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('ORIENTATION')}
              className="text-slate-500 hover:text-slate-900"
            >
              <Network className="w-4 h-4 mr-2" /> Định hướng
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('EXPLORER')}
              className="text-slate-500 hover:text-slate-900"
            >
              <Database className="w-4 h-4 mr-2" /> Graph Explorer
            </Button>
            <Button variant="secondary" size="sm" className="bg-blue-50 text-blue-700">
              <FileDown className="w-4 h-4 mr-2" /> Import Pipeline
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-white rounded-lg border border-slate-200 shadow-sm">
          <ImportManager />
        </div>
      </div>
    );
  }

  if (activeTab === 'ORIENTATION' && data) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 p-4">
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <Button variant="secondary" size="sm" className="bg-blue-50 text-blue-700">
            <Network className="mr-2 size-4" /> Định hướng
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setActiveTab('EXPLORER')}>
            <Database className="mr-2 size-4" /> Graph Explorer
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setActiveTab('IMPORT')}>
            <FileDown className="mr-2 size-4" /> Import Pipeline
          </Button>
        </div>
        <KnowledgeGraphOrientation data={data} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      {/* Ultra-compact Dashboard Bar */}
      <div className="flex items-center justify-between shrink-0 bg-white rounded-lg border border-slate-200 px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('ORIENTATION')}
              className="text-slate-500 hover:text-slate-900"
            >
              <Network className="w-4 h-4 mr-2" /> Định hướng
            </Button>
            <Button variant="secondary" size="sm" className="bg-blue-50 text-blue-700">
              <Database className="w-4 h-4 mr-2" /> Graph Explorer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('IMPORT')}
              className="text-slate-500 hover:text-slate-900"
            >
              <FileDown className="w-4 h-4 mr-2" /> Import Pipeline
            </Button>
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-4 text-[13px] font-medium text-slate-600">
            <span className="flex items-center gap-1.5">
              <Book className="w-3.5 h-3.5 text-slate-400" /> {metrics.subjects}
            </span>
            <span className="flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-slate-400" /> {metrics.grades}
            </span>
            <span className="flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5 text-slate-400" /> {metrics.domains}
            </span>
            <span className="flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-slate-400" /> {metrics.concepts}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[12px] text-slate-500">
          <span className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" /> All systems operational
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Auto-validated
          </span>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left panel: Graph Tree - WIDER */}
        <div className="w-[400px] flex flex-col bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden shrink-0">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="font-semibold text-[13px] text-slate-800 tracking-tight">
              Knowledge Explorer
            </h2>
            <div className="flex gap-2">
              {process.env.NODE_ENV === 'development' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px] px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                  onClick={async () => {
                    await fetch('/api/knowledge-graph/fixture', { method: 'POST' });
                    loadData();
                  }}
                >
                  Seed Fixture
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                onClick={() => handleCreateChild(null, 'SUBJECT', 'New Subject')}
              >
                + Subject
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {error && <div className="mb-4 text-red-500 text-sm px-2">{error}</div>}
            {data?.subjects?.length === 0 && !error ? (
              <div className="text-center text-sm text-slate-400 py-12 flex flex-col items-center">
                <FolderTree className="w-8 h-8 mb-3 opacity-20" />
                <p>The graph is empty.</p>
                <Button
                  variant="link"
                  onClick={() => handleCreateChild(null, 'SUBJECT', 'New Subject')}
                >
                  Create the first Subject
                </Button>
              </div>
            ) : (
              <KnowledgeGraphTree
                subjects={data?.subjects || []}
                selectedNodeId={selectedNode?.id}
                onSelect={handleSelectNode}
                onCreateChild={handleCreateChild}
                onDelete={handleDeleteNode}
                onReorder={handleReorder}
              />
            )}
          </div>
        </div>

        {/* Right panel: Inspector - DOCUMENT STYLE */}
        <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
          {selectedNode && breadcrumb ? (
            <div className="px-10 pt-8 pb-4 shrink-0">
              <div className="flex flex-wrap items-center text-[13px] text-slate-400 font-medium tracking-wide">
                {breadcrumb.map((crumb, idx) => (
                  <span key={idx} className="flex items-center mt-1">
                    <span
                      className={cn(
                        'transition-colors',
                        idx === breadcrumb.length - 1
                          ? 'text-slate-900 font-semibold'
                          : 'hover:text-slate-600 cursor-pointer'
                      )}
                    >
                      {crumb}
                    </span>
                    {idx < breadcrumb.length - 1 && (
                      <ChevronRight className="w-3.5 h-3.5 mx-1.5 opacity-40" />
                    )}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="px-10 pb-16 flex-1 overflow-y-auto">
            {!selectedNode ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 max-w-sm mx-auto text-center space-y-4">
                <div className="p-4 rounded-full bg-slate-50 border border-slate-100">
                  <Share2 className="w-8 h-8 text-blue-500 opacity-80" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700">Knowledge Graph Core</h3>
                <p className="text-sm leading-relaxed">
                  Select a node from the explorer to view and edit its document. This canonical
                  hierarchy drives all AI models, roadmaps, and content mappings.
                </p>
              </div>
            ) : (
              <div className="max-w-3xl pt-2">
                {selectedNode.type === 'SUBJECT' ? (
                  <SubjectInspector
                    key={selectedNode.id}
                    node={selectedNode as KgSubject}
                    onSave={(updates) => handleSaveNode(selectedNode.id, updates)}
                  />
                ) : selectedNode.type === 'GRADE' ? (
                  <GradeInspector
                    key={selectedNode.id}
                    node={selectedNode as KgGrade}
                    onSave={(updates) => handleSaveNode(selectedNode.id, updates)}
                  />
                ) : selectedNode.type === 'DOMAIN' ? (
                  <DomainInspector
                    key={selectedNode.id}
                    node={selectedNode as KgDomain}
                    onSave={(updates) => handleSaveNode(selectedNode.id, updates)}
                  />
                ) : (
                  <ConceptInspector
                    key={selectedNode.id}
                    node={selectedNode as KgConcept}
                    data={data!}
                    onSave={(updates) => handleSaveNode(selectedNode.id, updates)}
                    onRefresh={loadData}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
