'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { KgSubject, KgGrade, KgDomain, KnowledgeStatus } from '@/lib/knowledge-graph/kg-types';
import { AlertCircle } from 'lucide-react';

// --- Shared Components for Editors ---

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
      className="w-full bg-transparent border-none text-4xl font-extrabold tracking-tight text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0 p-0 mb-8"
    />
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: KnowledgeStatus;
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
        <option value="PUBLISHED">Đã xuất bản (Published)</option>
        <option value="ARCHIVED">Lưu trữ (Archived)</option>
      </select>
    </div>
  );
}

function StickyActionBar({
  isDirty,
  onSave,
  onCancel,
}: {
  isDirty: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (!isDirty) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3 bg-slate-900 text-white rounded-full shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-200">
      <div className="flex items-center gap-2 pr-4 border-r border-slate-700">
        <AlertCircle className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-medium">Unsaved changes</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onCancel}
        className="text-slate-300 hover:text-white hover:bg-slate-800 rounded-full"
      >
        Discard
      </Button>
      <Button
        size="sm"
        onClick={onSave}
        className="bg-white text-slate-900 hover:bg-slate-100 rounded-full px-6 font-semibold"
      >
        Save
      </Button>
    </div>
  );
}

// --- Subject Inspector ---

export function SubjectInspector({
  node,
  onSave,
}: {
  node: KgSubject;
  onSave: (u: Partial<KgSubject>) => void;
}) {
  const [title, setTitle] = useState(node.title);
  const [status, setStatus] = useState(node.status);

  const isDirty = title !== node.title || status !== node.status;

  const handleCancel = () => {
    setTitle(node.title);
    setStatus(node.status);
  };

  return (
    <div className="space-y-8 pb-32">
      <StickyActionBar
        isDirty={isDirty}
        onSave={() => onSave({ title, status })}
        onCancel={handleCancel}
      />
      <DocumentTitleInput value={title} onChange={setTitle} placeholder="Subject Name..." />
      <div className="space-y-4 max-w-2xl">
        <StatusSelect value={status} onChange={setStatus} />
      </div>
    </div>
  );
}

// --- Grade Inspector ---

export function GradeInspector({
  node,
  onSave,
}: {
  node: KgGrade;
  onSave: (u: Partial<KgGrade>) => void;
}) {
  const [title, setTitle] = useState(node.title);
  const [status, setStatus] = useState(node.status);

  const isDirty = title !== node.title || status !== node.status;

  const handleCancel = () => {
    setTitle(node.title);
    setStatus(node.status);
  };

  return (
    <div className="space-y-8 pb-32">
      <StickyActionBar
        isDirty={isDirty}
        onSave={() => onSave({ title, status })}
        onCancel={handleCancel}
      />
      <DocumentTitleInput value={title} onChange={setTitle} placeholder="Grade Name..." />
      <div className="space-y-4 max-w-2xl">
        <StatusSelect value={status} onChange={setStatus} />
      </div>
    </div>
  );
}

// --- Domain Inspector ---

export function DomainInspector({
  node,
  onSave,
}: {
  node: KgDomain;
  onSave: (u: Partial<KgDomain>) => void;
}) {
  const [title, setTitle] = useState(node.title);
  const [status, setStatus] = useState(node.status);

  const isDirty = title !== node.title || status !== node.status;

  const handleCancel = () => {
    setTitle(node.title);
    setStatus(node.status);
  };

  return (
    <div className="space-y-8 pb-32">
      <StickyActionBar
        isDirty={isDirty}
        onSave={() => onSave({ title, status })}
        onCancel={handleCancel}
      />
      <DocumentTitleInput value={title} onChange={setTitle} placeholder="Domain Name..." />
      <div className="space-y-4 max-w-2xl">
        <StatusSelect value={status} onChange={setStatus} />
      </div>
    </div>
  );
}

export { ConceptInspector } from './concept-inspector';
