import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  buildColumnMappings,
  parseCsv,
  parseJsonRows,
  previewRow,
  rowToPartialQuestion,
} from '@/lib/question-bank/qb-import';
import { computeQuestionFingerprints } from '@/lib/question-bank/qb-hash';
import { mergeSheetRows, parseExcelWorkbook } from '@/lib/question-bank/qb-excel-parser';
import type {
  ColumnMapping,
  ImportDefaults,
  ImportFormat,
  ImportRowPreview,
  ImportTargetField,
} from '@/lib/question-bank/qb-types';
import { createStructuredImportSession } from '@/lib/content-import/storage';
import type { QuestionCandidate } from '@/lib/content-import/types';
import { readKnowledgeTree } from '@/lib/knowledge-tree/knowledge-tree-storage';

interface PreviewRequestBody {
  content: string;
  format: 'CSV' | 'JSON';
  fileName?: string;
  mappings?: ColumnMapping[];
  defaults?: ImportDefaults;
}

const DEFAULT_DEFAULTS: ImportDefaults = {
  accessTier: 'OPEN',
  editorialStatus: 'DRAFT',
  sourceType: 'PUBLIC_DOCUMENT',
  rightsStatus: 'REVIEW_REQUIRED',
};

function mappedRow(row: Record<string, unknown>, mappings: ColumnMapping[]) {
  const mapped = {} as Record<ImportTargetField, string>;
  for (const mapping of mappings) {
    if (mapping.targetField) mapped[mapping.targetField] = String(row[mapping.sourceColumn] ?? '');
  }
  return mapped;
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    let rawRows: Array<Record<string, unknown>> = [];
    let defaults = DEFAULT_DEFAULTS;
    let mappings: ColumnMapping[] = [];
    let format: ImportFormat;
    let fileName: string;
    let fileIssues: Array<{
      sheet?: string;
      row: number;
      severity: 'ERROR' | 'WARNING';
      code: string;
      message: string;
    }> = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No file was uploaded.' }, { status: 400 });
      }
      format = 'XLSX';
      fileName = file.name;
      const parsed = parseExcelWorkbook(Buffer.from(await file.arrayBuffer()));
      if (parsed.structureErrors.length > 0) {
        return NextResponse.json({ error: parsed.structureErrors.join(' ') }, { status: 400 });
      }
      rawRows = mergeSheetRows(parsed);
      fileIssues = parsed.issues;
    } else {
      const body = (await request.json()) as PreviewRequestBody;
      format = body.format;
      fileName = body.fileName || `import.${body.format.toLowerCase()}`;
      defaults = { ...DEFAULT_DEFAULTS, ...body.defaults, editorialStatus: 'DRAFT' };
      mappings = body.mappings ?? [];
      if (!body.content?.trim()) {
        return NextResponse.json({ error: 'File content is empty.' }, { status: 400 });
      }
      rawRows =
        format === 'CSV'
          ? (parseCsv(body.content) as Array<Record<string, unknown>>)
          : parseJsonRows(body.content);
    }

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'The file contains no question rows.' }, { status: 400 });
    }
    if (rawRows.length > 5000) {
      return NextResponse.json(
        { error: 'The 5,000 row import limit was exceeded.' },
        { status: 400 }
      );
    }

    const firstRow = rawRows[0];
    const headers = Object.keys(firstRow).filter((key) => !key.startsWith('_'));
    const effectiveMappings =
      mappings.length > 0
        ? mappings
        : buildColumnMappings(headers, firstRow as Record<string, string>);
    const tree = await readKnowledgeTree();
    const seenFingerprints = new Set<string>();
    const candidates: QuestionCandidate[] = [];

    const previews: ImportRowPreview[] = [];
    for (let index = 0; index < rawRows.length; index += 1) {
      const row = rawRows[index];
      const mapped = mappedRow(row, effectiveMappings);
      const rowIndex = typeof row._rowIndex === 'number' ? row._rowIndex : index + 2;
      let preview = await previewRow(mapped, defaults, rowIndex, tree);
      const partial = rowToPartialQuestion(mapped, defaults, tree);
      if (partial.stem && partial.options && partial.correctAnswer) {
        const fingerprints = computeQuestionFingerprints(
          partial.stem,
          partial.options,
          partial.correctAnswer
        );
        if (
          seenFingerprints.has(fingerprints.stem) ||
          seenFingerprints.has(fingerprints.stemAndOptions) ||
          seenFingerprints.has(fingerprints.full)
        ) {
          preview = {
            ...preview,
            status: 'DUPLICATE',
            warnings: [
              ...preview.warnings,
              {
                code: 'DUPLICATE_IN_BATCH',
                message: 'Duplicate of an earlier candidate in this batch.',
              },
            ],
          };
        } else {
          seenFingerprints.add(fingerprints.stem);
          seenFingerprints.add(fingerprints.stemAndOptions);
          seenFingerprints.add(fingerprints.full);
        }
      }
      previews.push(preview);
      const reviewLevel =
        preview.status === 'ERROR' || preview.status === 'DUPLICATE'
          ? 'BLOCKING'
          : preview.status === 'WARNING'
            ? 'REVIEW'
            : 'READY';
      candidates.push({
        id: uuidv4(),
        number: index + 1,
        sourcePageIds: [],
        questionType: partial.questionType ?? 'MULTIPLE_CHOICE_SINGLE',
        content: partial.stem ?? '',
        options: partial.options ?? [],
        statements: [],
        correctAnswer: partial.correctAnswer ?? '',
        detectedSelectedAnswer: '',
        explanation: partial.explanation ?? '',
        sharedContext: '',
        questionAssetDescription: '',
        subjectId: partial.subjectId,
        grade: partial.grade,
        chapter: partial.chapterId ?? '',
        lesson: partial.lessonId ?? '',
        concept: partial.primaryKnowledgeNodeId ?? '',
        primaryKnowledgeNodeId: partial.primaryKnowledgeNodeId,
        difficulty: partial.difficulty ?? 'INTERMEDIATE',
        status: reviewLevel === 'BLOCKING' ? 'WARNING' : 'UNREVIEWED',
        fieldConfidence: {
          content: partial.stem ? 'HIGH' : 'UNCERTAIN',
          options: (partial.options?.length ?? 0) > 0 ? 'HIGH' : 'REVIEW',
          answer: partial.correctAnswer ? 'HIGH' : 'UNCERTAIN',
          asset: 'HIGH',
          classification: partial.primaryKnowledgeNodeId ? 'HIGH' : 'UNCERTAIN',
        },
        warnings: [],
        updatedAt: new Date().toISOString(),
        stagedQuestion: {
          ...partial,
          editorialStatus: 'DRAFT',
          source: partial.source ?? {
            sourceType: 'PUBLIC_DOCUMENT',
            rightsStatus: 'REVIEW_REQUIRED',
          },
        },
        reviewLevel,
        validationErrors: preview.errors,
      });
    }

    const session = await createStructuredImportSession({
      fileName,
      format: format as 'XLSX' | 'CSV' | 'JSON',
      rawRows,
      mappings: effectiveMappings,
      defaults,
      candidates,
    });
    const rowIssues = previews.flatMap((preview) => [
      ...preview.errors.map((issue) => ({
        row: preview.rowIndex,
        severity: 'ERROR' as const,
        ...issue,
      })),
      ...preview.warnings.map((issue) => ({
        row: preview.rowIndex,
        severity: 'WARNING' as const,
        ...issue,
      })),
    ]);

    return NextResponse.json({
      sessionId: session.id,
      totalRows: previews.length,
      previewedRows: previews.length,
      validRows: previews.filter((preview) => preview.status === 'VALID').length,
      warningRows: previews.filter((preview) => preview.status === 'WARNING').length,
      errorRows: previews.filter(
        (preview) => preview.status === 'ERROR' || preview.status === 'DUPLICATE'
      ).length,
      mappings: effectiveMappings,
      previews,
      issues: [...fileIssues, ...rowIssues],
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Preview failed.' },
      { status: 400 }
    );
  }
}
