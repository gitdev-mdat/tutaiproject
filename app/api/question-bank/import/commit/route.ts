import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  buildColumnMappings,
  commitImport,
  parseCsv,
  parseJsonRows,
} from '@/lib/question-bank/qb-import';
import type {
  ColumnMapping,
  ImportDefaults,
  ImportTargetField,
} from '@/lib/question-bank/qb-types';
import { requireImportSession, saveImportSession } from '@/lib/content-import/storage';
import type { QuestionCandidate } from '@/lib/content-import/types';

interface CommitRequestBody {
  sessionId?: string;
  idempotencyKey: string;
  fileName?: string;
  format?: 'CSV' | 'JSON';
  content?: string;
  mappings?: ColumnMapping[];
  defaults?: ImportDefaults;
  allowPartial: boolean;
  conflictActions?: Record<string, 'SKIP' | 'UPDATE' | 'CREATE_COPY'>;
}

function candidateToMapped(candidate: QuestionCandidate): Record<ImportTargetField, string> {
  const question = candidate.stagedQuestion ?? {};
  return {
    external_id: question.externalId ?? '',
    subject: candidate.subjectId ?? question.subjectId ?? '',
    grade: String(candidate.grade ?? question.grade ?? ''),
    chapter: candidate.chapter || question.chapterId || '',
    lesson: candidate.lesson || question.lessonId || '',
    topic: question.topicId ?? '',
    concept_codes: (question.conceptCodes ?? []).join(','),
    skill_codes: (question.skillCodes ?? []).join(','),
    difficulty: candidate.difficulty,
    question_type: candidate.questionType,
    stem: candidate.content,
    option_a: candidate.options.find((option) => option.key.toUpperCase() === 'A')?.content ?? '',
    option_b: candidate.options.find((option) => option.key.toUpperCase() === 'B')?.content ?? '',
    option_c: candidate.options.find((option) => option.key.toUpperCase() === 'C')?.content ?? '',
    option_d: candidate.options.find((option) => option.key.toUpperCase() === 'D')?.content ?? '',
    option_e: candidate.options.find((option) => option.key.toUpperCase() === 'E')?.content ?? '',
    correct_answer: candidate.correctAnswer,
    explanation: candidate.explanation,
    access_tier: question.accessTier ?? 'OPEN',
    usage_contexts: (question.usageContexts ?? []).join(','),
    roadmap_eligible: String(question.roadmapEligible ?? false),
    roadmap_purpose: question.roadmapPurpose ?? '',
    prerequisite_concept_codes: (question.prerequisiteConceptCodes ?? []).join(','),
    estimated_time_seconds: String(question.estimatedTimeSeconds ?? ''),
    is_special: String(question.isSpecial ?? false),
    special_reason: question.specialReason ?? '',
    source_type: question.source?.sourceType ?? 'PUBLIC_DOCUMENT',
    source_name: question.source?.sourceName ?? '',
    source_year: String(question.source?.sourceYear ?? ''),
    source_page: question.source?.sourcePage ?? '',
    rights_status: question.source?.rightsStatus ?? 'REVIEW_REQUIRED',
    editorial_status: 'DRAFT',
    knowledge_path: '',
    knowledge_node_id: candidate.primaryKnowledgeNodeId ?? question.primaryKnowledgeNodeId ?? '',
    knowledge_coverage: question.knowledgeCoverage ?? '',
    related_knowledge: (question.relatedKnowledgeNodeIds ?? []).join(','),
    cognitive_level: question.cognitiveLevel ?? '',
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CommitRequestBody;
    if (!body.idempotencyKey) {
      return NextResponse.json({ error: 'idempotencyKey is required.' }, { status: 400 });
    }

    let rawRows: Array<Record<string, unknown>>;
    let mappings: ColumnMapping[];
    let defaults: ImportDefaults;
    let fileName: string;
    let format: 'XLSX' | 'CSV' | 'JSON';
    let session = null;
    let stagedRows: Array<Record<ImportTargetField, string>> | null = null;

    if (body.sessionId) {
      session = await requireImportSession(body.sessionId);
      if (!session.structuredData) {
        return NextResponse.json(
          { error: 'This session is not a structured import.' },
          { status: 400 }
        );
      }
      if (session.status === 'COMPLETED') {
        return NextResponse.json(
          { error: 'This import session has already been committed.' },
          { status: 409 }
        );
      }
      ({ rawRows, mappings, defaults, fileName, format } = session.structuredData as {
        rawRows: Array<Record<string, unknown>>;
        mappings: ColumnMapping[];
        defaults: ImportDefaults;
        fileName: string;
        format: 'XLSX' | 'CSV' | 'JSON';
      });
      stagedRows = session.candidates
        .filter((candidate) => candidate.status !== 'SKIPPED')
        .map(candidateToMapped);
    } else {
      // Backward-compatible path for existing API clients. New UI clients always
      // commit a persisted session so the preview payload cannot diverge.
      if (!body.content?.trim() || !body.format) {
        return NextResponse.json({ error: 'A persisted sessionId is required.' }, { status: 400 });
      }
      format = body.format;
      fileName = body.fileName ?? `import.${format.toLowerCase()}`;
      rawRows =
        format === 'CSV'
          ? (parseCsv(body.content) as Array<Record<string, unknown>>)
          : parseJsonRows(body.content);
      mappings = body.mappings ?? [];
      defaults = body.defaults ?? {};
    }

    if (rawRows.length === 0 || rawRows.length > 5000) {
      return NextResponse.json({ error: 'The staged row count is invalid.' }, { status: 400 });
    }
    const headers = Object.keys(rawRows[0]).filter((key) => !key.startsWith('_'));
    const effectiveMappings = mappings.length > 0 ? mappings : buildColumnMappings(headers);
    const rows = stagedRows
      ? stagedRows.map((row, index) => {
          const externalId = row.external_id ?? '';
          return {
            mapped: row,
            conflictAction:
              body.conflictActions?.[externalId] ?? body.conflictActions?.[String(index)] ?? 'SKIP',
          };
        })
      : rawRows.map((row, index) => {
          const mapped = {} as Record<ImportTargetField, string>;
          for (const mapping of effectiveMappings) {
            if (mapping.targetField) {
              mapped[mapping.targetField] = String(row[mapping.sourceColumn] ?? '');
            }
          }
          const externalId = mapped.external_id ?? '';
          return {
            mapped,
            conflictAction:
              body.conflictActions?.[externalId] ?? body.conflictActions?.[String(index)] ?? 'SKIP',
          };
        });

    const result = await commitImport({
      jobId: session?.id ?? uuidv4(),
      idempotencyKey: body.idempotencyKey,
      fileName,
      format,
      rows,
      defaults: { ...defaults, editorialStatus: 'DRAFT' },
      allowPartial: body.allowPartial,
      actor: 'admin',
    });

    if (session) {
      session.status = result.failedCount === 0 ? 'COMPLETED' : 'REVIEW_REQUIRED';
      session.currentStep = result.failedCount === 0 ? 5 : 4;
      if (result.failedCount === 0) {
        session.candidates = session.candidates.map((candidate) => ({
          ...candidate,
          status: candidate.reviewLevel === 'BLOCKING' ? candidate.status : 'APPROVED',
          updatedAt: new Date().toISOString(),
        }));
      }
      await saveImportSession(session);
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed.' },
      { status: 400 }
    );
  }
}
