import { Metadata } from 'next';
import { KnowledgeGraphManager } from '@/components/admin/knowledge-graph/kg-manager';

export const metadata: Metadata = {
  title: 'Knowledge Graph (Legacy) | Tú Tài Admin',
};

export default function KnowledgeGraphPage() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <header
        data-testid="admin-context-header"
        className="flex h-[var(--admin-context-header-height)] shrink-0 items-center border-b border-slate-200 bg-white px-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:px-6"
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
            Legacy / công cụ phụ
          </p>
          <h1 className="text-[15px] font-bold tracking-tight text-slate-900">Knowledge Graph</h1>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        <KnowledgeGraphManager />
      </div>
    </div>
  );
}
