'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { KgConcept, KgDocument, BloomLevel, KnowledgeStatus } from '@/lib/knowledge-graph/kg-types';
import { Network, Target, Link2, AlertCircle, Trash2, X, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { walkKgNodes } from '@/lib/knowledge-graph/kg-utils';

// --- SHARED COMPONENTS ---

function DocumentTitleInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-transparent border-none text-4xl font-extrabold tracking-tight text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0 p-0 mb-4"
    />
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: KnowledgeStatus) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <Label className="w-24 text-slate-500 font-medium">Trạng thái</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as KnowledgeStatus)}
        className="h-8 rounded-md border-transparent hover:border-slate-200 bg-slate-50 hover:bg-slate-100 px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer transition-colors"
      >
        <option value="DRAFT">Nháp (Draft)</option>
        <option value="PROPOSED">Đề xuất (Proposed)</option>
        <option value="PUBLISHED">Đã xuất bản (Published)</option>
        <option value="ARCHIVED">Lưu trữ (Archived)</option>
      </select>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  comingSoon,
  action,
}: {
  icon: React.ElementType;
  title: string;
  comingSoon?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4 mt-12 border-b border-slate-100 pb-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <h3 className="font-semibold text-slate-800 tracking-tight">{title}</h3>
        {comingSoon && (
          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 ml-2">
            Coming Soon
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

function StickyActionBar({
  isDirty,
  onSave,
  onCancel,
  isSaving,
  error,
}: {
  isDirty: boolean;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  error: string | null;
}) {
  if (!isDirty && !error) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3 bg-slate-900 text-white rounded-full shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-200">
      <div className="flex items-center gap-2 pr-4 border-r border-slate-700">
        <AlertCircle className={cn('w-4 h-4', error ? 'text-red-400' : 'text-amber-400')} />
        <span className="text-sm font-medium">{error || 'Có thay đổi chưa lưu'}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onCancel}
        disabled={isSaving}
        className="text-slate-300 hover:text-white hover:bg-slate-800 rounded-full"
      >
        Hủy bỏ
      </Button>
      <Button
        size="sm"
        onClick={onSave}
        disabled={isSaving}
        className="bg-white text-slate-900 hover:bg-slate-100 rounded-full px-6 font-semibold"
      >
        {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
      </Button>
    </div>
  );
}

// --- MAIN INSPECTOR ---

export function ConceptInspector({
  node,
  data,
  onSave,
  onRefresh,
}: {
  node: KgConcept;
  data: KgDocument;
  onSave: (u: Partial<KgConcept>) => Promise<void>;
  onRefresh: () => void;
}) {
  const [title, setTitle] = useState(node.title);
  const [status, setStatus] = useState<KnowledgeStatus>(node.status);
  const [shortDescription, setShortDescription] = useState(node.shortDescription || '');
  const [detailedDescription, setDetailedDescription] = useState(node.detailedDescription || '');
  const [aliases, setAliases] = useState<string[]>(node.aliases || []);
  const [aliasInput, setAliasInput] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Objective State
  const [newObjective, setNewObjective] = useState('');
  const [newBloom, setNewBloom] = useState<BloomLevel>('UNDERSTAND');

  // New Relation State
  const [newRelTarget, setNewRelTarget] = useState('');
  const [newRelType, setNewRelType] = useState<'PREREQUISITE_OF' | 'REQUIRES'>('REQUIRES');

  const isDirty =
    title !== node.title ||
    status !== node.status ||
    shortDescription !== (node.shortDescription || '') ||
    detailedDescription !== (node.detailedDescription || '') ||
    JSON.stringify(aliases) !== JSON.stringify(node.aliases || []);

  const handleCancel = () => {
    setTitle(node.title);
    setStatus(node.status);
    setShortDescription(node.shortDescription || '');
    setDetailedDescription(node.detailedDescription || '');
    setAliases(node.aliases || []);
    setError(null);
  };

  const handleSaveNode = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave({ title, status, shortDescription, detailedDescription, aliases });
    } catch (error: unknown) {
      const err = error as Error;
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Objectives
  const conceptObjectives = useMemo(() => {
    return data.learningObjectives
      .filter((o) => o.conceptId === node.id)
      .sort((a, b) => a.order - b.order);
  }, [data.learningObjectives, node.id]);

  const handleAddObjective = async () => {
    if (!newObjective.trim()) return;
    try {
      const res = await fetch(`/api/knowledge-graph/concepts/${node.id}/objectives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statement: newObjective, bloomLevel: newBloom, status: 'DRAFT' }),
      });
      if (!res.ok) {
        const r = await res.json();
        throw new Error(r.error);
      }
      setNewObjective('');
      onRefresh();
    } catch (error: unknown) {
      const err = error as Error;
      alert(err.message);
    }
  };

  const handleDeleteObjective = async (id: string) => {
    if (!confirm('Xóa mục tiêu học tập này?')) return;
    try {
      await fetch(`/api/knowledge-graph/objectives/${id}`, { method: 'DELETE' });
      onRefresh();
    } catch (error: unknown) {
      const err = error as Error;
      alert(err.message);
    }
  };

  // Relations
  const related = useMemo(() => {
    return data.conceptRelations.filter(
      (r) => r.sourceConceptId === node.id || r.targetConceptId === node.id
    );
  }, [data.conceptRelations, node.id]);

  const prerequisites = related.filter(
    (r) => r.type === 'PREREQUISITE' && r.targetConceptId === node.id
  );
  const prerequisiteOf = related.filter(
    (r) => r.type === 'PREREQUISITE' && r.sourceConceptId === node.id
  );

  // Helper to find concept title
  const getConceptTitle = (id: string) => {
    for (const { node: n } of walkKgNodes(data)) {
      if (n.id === id) return n.title;
    }
    return 'Unknown Concept';
  };

  // Helper for all concepts (for picker)
  const allConcepts = useMemo(() => {
    const list: KgConcept[] = [];
    for (const { node: n } of walkKgNodes(data)) {
      if (n.type === 'CONCEPT') list.push(n as KgConcept);
    }
    return list;
  }, [data]);

  const handleAddRelation = async () => {
    if (!newRelTarget) return;
    try {
      const payload = {
        sourceConceptId: newRelType === 'REQUIRES' ? newRelTarget : node.id,
        targetConceptId: newRelType === 'REQUIRES' ? node.id : newRelTarget,
        type: 'PREREQUISITE',
        status: 'PUBLISHED',
      };
      const res = await fetch(`/api/knowledge-graph/relations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const r = await res.json();
        throw new Error(r.error);
      }
      setNewRelTarget('');
      onRefresh();
    } catch (error: unknown) {
      const err = error as Error;
      alert(err.message);
    }
  };

  const handleDeleteRelation = async (id: string) => {
    try {
      await fetch(`/api/knowledge-graph/relations/${id}`, { method: 'DELETE' });
      onRefresh();
    } catch (error: unknown) {
      const err = error as Error;
      alert(err.message);
    }
  };

  return (
    <div className="pb-32">
      <StickyActionBar
        isDirty={isDirty}
        onSave={handleSaveNode}
        onCancel={handleCancel}
        isSaving={isSaving}
        error={error}
      />

      <div className="flex items-center justify-between mb-4">
        <div className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100 flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          ID: {node.id}
        </div>
        <div className="text-[11px] text-slate-400">
          Last updated: {new Date(node.updatedAt).toLocaleString()}
        </div>
      </div>

      <DocumentTitleInput value={title} onChange={setTitle} placeholder="Tên khái niệm..." />

      <div className="space-y-6 max-w-2xl">
        <StatusSelect value={status} onChange={setStatus} />

        <div className="space-y-1">
          <Label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Từ khóa (Aliases)
          </Label>
          <div className="flex flex-wrap gap-2 items-center min-h-8 p-1.5 bg-slate-50 rounded-md border border-slate-100 focus-within:border-slate-300 transition-colors">
            {aliases.map((alias) => (
              <Badge
                key={alias}
                variant="secondary"
                className="bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                {alias}
                <X
                  className="w-3 h-3 ml-1 cursor-pointer opacity-50 hover:opacity-100"
                  onClick={() => setAliases(aliases.filter((a) => a !== alias))}
                />
              </Badge>
            ))}
            <input
              type="text"
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && aliasInput.trim()) {
                  if (!aliases.includes(aliasInput.trim())) {
                    setAliases([...aliases, aliasInput.trim()]);
                  }
                  setAliasInput('');
                  e.preventDefault();
                }
              }}
              placeholder={aliases.length === 0 ? 'Nhập từ khóa và ấn Enter...' : 'Thêm...'}
              className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm min-w-[120px]"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Mô tả ngắn gọn
          </Label>
          <Textarea
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            placeholder="Tóm tắt nội dung khái niệm trong 1-2 câu..."
            className="min-h-[80px] resize-y bg-slate-50 border-slate-200 focus:bg-white text-[14px]"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Mô tả chi tiết (Markdown)
          </Label>
          <Textarea
            value={detailedDescription}
            onChange={(e) => setDetailedDescription(e.target.value)}
            placeholder="Viết mô tả chi tiết, hỗ trợ cú pháp Markdown..."
            className="min-h-[160px] resize-y bg-slate-50 border-slate-200 focus:bg-white text-[15px] leading-relaxed"
          />
        </div>
      </div>

      <div className="max-w-3xl">
        {/* --- LEARNING OBJECTIVES --- */}
        <SectionHeader icon={Target} title="Mục tiêu học tập (Learning Objectives)" />

        <div className="space-y-3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {conceptObjectives.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400 bg-slate-50">
              Chưa có mục tiêu học tập nào. Khái niệm này cần có mục tiêu để phục vụ việc tạo câu
              hỏi.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {conceptObjectives.map((obj) => (
                <div
                  key={obj.id}
                  className="flex gap-3 p-3 hover:bg-slate-50 transition-colors group"
                >
                  <div className="shrink-0 mt-0.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] uppercase font-bold tracking-wider',
                        obj.bloomLevel === 'REMEMBER' && 'bg-slate-100 text-slate-600',
                        obj.bloomLevel === 'UNDERSTAND' && 'bg-blue-50 text-blue-600',
                        obj.bloomLevel === 'APPLY' && 'bg-emerald-50 text-emerald-600',
                        obj.bloomLevel === 'ANALYZE' && 'bg-amber-50 text-amber-600',
                        obj.bloomLevel === 'EVALUATE' && 'bg-purple-50 text-purple-600',
                        obj.bloomLevel === 'CREATE' && 'bg-pink-50 text-pink-600'
                      )}
                    >
                      {obj.bloomLevel}
                    </Badge>
                  </div>
                  <div className="flex-1 text-sm text-slate-700 leading-relaxed">
                    {obj.statement}
                  </div>
                  <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:bg-red-50"
                      onClick={() => handleDeleteObjective(obj.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2 items-start">
            <select
              value={newBloom}
              onChange={(e) => setNewBloom(e.target.value as BloomLevel)}
              className="h-9 rounded-md border-slate-200 text-sm shrink-0"
            >
              <option value="REMEMBER">Nhận biết (Remember)</option>
              <option value="UNDERSTAND">Thông hiểu (Understand)</option>
              <option value="APPLY">Vận dụng (Apply)</option>
              <option value="ANALYZE">Phân tích (Analyze)</option>
              <option value="EVALUATE">Đánh giá (Evaluate)</option>
              <option value="CREATE">Sáng tạo (Create)</option>
            </select>
            <Input
              value={newObjective}
              onChange={(e) => setNewObjective(e.target.value)}
              placeholder="Thêm mục tiêu mới (VD: Học sinh giải thích được...)"
              className="h-9 text-sm flex-1 bg-white"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddObjective();
              }}
            />
            <Button
              size="sm"
              className="h-9 px-4 shrink-0"
              onClick={handleAddObjective}
              disabled={!newObjective.trim()}
            >
              Thêm
            </Button>
          </div>
        </div>

        {/* --- PREREQUISITES --- */}
        <SectionHeader icon={Network} title="Sự phụ thuộc (Prerequisites)" />

        <div className="grid grid-cols-2 gap-6">
          {/* Kiến thức cần học trước */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 font-medium text-xs uppercase tracking-wider text-slate-500">
              Kiến thức cần học trước
            </div>
            <div className="flex-1 p-2 space-y-1">
              {prerequisites.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-4">
                  Không có (Khái niệm gốc)
                </div>
              ) : (
                prerequisites.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-slate-50 group border border-transparent hover:border-slate-100"
                  >
                    <span className="text-sm text-slate-700">
                      {getConceptTitle(r.sourceConceptId)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500 opacity-0 group-hover:opacity-100"
                      onClick={() => handleDeleteRelation(r.id)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Kiến thức sử dụng Concept này */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 font-medium text-xs uppercase tracking-wider text-slate-500">
              Kiến thức phát triển từ đây
            </div>
            <div className="flex-1 p-2 space-y-1">
              {prerequisiteOf.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-4">
                  Chưa có khái niệm nào phụ thuộc
                </div>
              ) : (
                prerequisiteOf.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-slate-50 group border border-transparent hover:border-slate-100"
                  >
                    <span className="text-sm text-slate-700">
                      {getConceptTitle(r.targetConceptId)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500 opacity-0 group-hover:opacity-100"
                      onClick={() => handleDeleteRelation(r.id)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Add Relation Bar */}
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600 shrink-0">Thêm liên kết:</span>
          <select
            className="h-9 rounded-md border-slate-300 text-sm"
            value={newRelType}
            onChange={(e) => setNewRelType(e.target.value as 'REQUIRES' | 'PREREQUISITE_OF')}
          >
            <option value="REQUIRES">Cần học trước (Prerequisite)</option>
            <option value="PREREQUISITE_OF">Làm cơ sở cho (Prerequisite of)</option>
          </select>

          <select
            className="h-9 rounded-md border-slate-300 text-sm flex-1"
            value={newRelTarget}
            onChange={(e) => setNewRelTarget(e.target.value)}
          >
            <option value="">-- Chọn Khái niệm --</option>
            {allConcepts
              .filter((c) => c.id !== node.id && c.status !== 'ARCHIVED')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
          </select>
          <Button size="sm" onClick={handleAddRelation} disabled={!newRelTarget}>
            Liên kết
          </Button>
        </div>

        <div className="mt-10">
          <div>
            <SectionHeader icon={Link2} title="Provenance" />
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-800">Nguồn:</span>{' '}
                {node.provenance?.sourceType ?? 'MANUAL'}
              </p>
            </div>
          </div>
        </div>

        {/* --- FUTURE PLACEHOLDERS --- */}
        <div className="opacity-40 select-none pointer-events-none mt-16">
          <SectionHeader icon={Link2} title="Domain Membership (Phân bổ mở rộng)" comingSoon />
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 text-sm text-slate-400 font-medium">
            Primary: {node.primaryDomainId}. Tính năng thêm Secondary domains sẽ xuất hiện tại đây.
          </div>

          <div className="mt-4">
            <SectionHeader icon={Link2} title="Question Mapping" comingSoon />
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 text-sm text-slate-400 font-medium">
              0 questions mapped
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
