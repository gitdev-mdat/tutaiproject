'use client';

import { BookOpen, ChevronRight, GitBranch, Network, Target } from 'lucide-react';
import type { KgDocument } from '@/lib/knowledge-graph/kg-types';
import {
  buildGraphOrientationModel,
  relationshipLabel,
} from '@/lib/knowledge-graph/graph-orientation';

export function KnowledgeGraphOrientation({ data }: { data: KgDocument }) {
  const model = buildGraphOrientationModel({ graph: data });
  const conceptById = new Map(model.canonicalConcepts.map((concept) => [concept.id, concept]));

  return (
    <section
      className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-5"
      data-testid="knowledge-graph-orientation-view"
    >
      <div className="max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-blue-700">
          Định hướng Knowledge Graph
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
          Tôi đang nhìn cái gì?
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Knowledge Graph của Tú Tài là mô hình hỗn hợp: Môn học, khối lớp và miền kiến thức tạo cấu
          trúc phân loại; Concept tạo mạng kiến thức bằng các quan hệ Concept-to-Concept.
        </p>

        <div
          className="mt-6 flex flex-wrap items-center gap-2"
          aria-label="Cấu trúc phân loại canonical"
        >
          {[model.subject?.title, model.grade?.title, model.domain?.title]
            .filter(Boolean)
            .map((title, index) => (
              <div key={title} className="contents">
                {index > 0 && <ChevronRight className="size-4 text-slate-400" />}
                <div
                  className={`rounded-lg border px-4 py-3 ${index === 2 ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {index === 0 ? 'Môn học' : index === 1 ? 'Khối lớp' : 'Miền kiến thức'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{title}</p>
                </div>
              </div>
            ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-lg border border-slate-200 p-4">
            <BookOpen className="size-5 text-slate-500" />
            <h3 className="mt-3 font-bold text-slate-900">Nguồn tài liệu</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Mapping và provenance; không phải node trong graph lõi.
            </p>
          </article>
          <article className="rounded-lg border-2 border-blue-300 bg-blue-50 p-4">
            <GitBranch className="size-5 text-blue-700" />
            <h3 className="mt-3 font-bold text-blue-950">Concept</h3>
            <p className="mt-1 text-xs leading-5 text-blue-800">
              Định danh kiến thức chính và là hai đầu mút của quan hệ graph.
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 p-4">
            <Target className="size-5 text-slate-500" />
            <h3 className="mt-3 font-bold text-slate-900">Mục tiêu học tập</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Đối tượng riêng gắn vào Concept qua conceptId.
            </p>
          </article>
        </div>

        <div className="mt-8 rounded-lg border border-slate-200 bg-[#FAFBFD] p-5">
          <div className="flex items-center gap-2">
            <Network className="size-5 text-blue-700" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">
                Mạng Concept đang lưu
              </p>
              <h3 className="text-lg font-bold text-slate-950">
                Quan hệ thực tế trong dữ liệu hiện tại
              </h3>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {model.canonicalConcepts.map((concept) => (
              <article
                key={concept.id}
                className="rounded-lg border border-slate-300 bg-white px-4 py-3"
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Concept canonical
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{concept.title}</p>
              </article>
            ))}
          </div>
          <div className="mt-5 space-y-2">
            {model.relationships.map((relationship) => (
              <div
                key={relationship.id}
                className="flex flex-wrap items-center gap-2 text-xs text-slate-600"
              >
                <span className="font-semibold text-slate-900">
                  {conceptById.get(relationship.sourceConceptId)?.title}
                </span>
                <span className="h-px w-7 bg-slate-500" />
                <span>{relationship.label}</span>
                <ChevronRight className="size-3" />
                <span className="font-semibold text-slate-900">
                  {conceptById.get(relationship.targetConceptId)?.title}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-slate-200 pt-3 text-xs text-slate-600">
            <strong>Quan hệ đang có trong dữ liệu:</strong>{' '}
            {model.persistedRelationshipTypes.map(relationshipLabel).join(', ') || 'Chưa có'}.
            <span className="ml-2 text-slate-500">
              PART_OF, RELATED và EQUIVALENT có trong schema nhưng chưa xuất hiện trong graph
              persisted hiện tại.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
