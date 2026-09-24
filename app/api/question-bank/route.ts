import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { computeContentHash, generateQuestionCode } from '@/lib/question-bank/qb-hash';
import {
  deriveHierarchyContext,
  isAttachableKnowledgeNode,
} from '@/lib/question-bank/qb-knowledge-utils';
import {
  appendAuditEntry,
  getMetrics,
  getQuestionByContentHash,
  listQuestions,
  saveQuestion,
} from '@/lib/question-bank/qb-storage';
import type {
  Question,
  QuestionFilter,
  QuestionOption,
  QuestionType,
} from '@/lib/question-bank/qb-types';
import {
  validateForManualCreation,
  type ManualQuestionInput,
} from '@/lib/question-bank/qb-validation';
import { readKnowledgeTree } from '@/lib/knowledge-tree/knowledge-tree-storage';

interface NormalizedManualQuestion {
  stem: string;
  questionType: QuestionType;
  options: QuestionOption[];
  correctAnswer: string;
  explanation: string;
  solutionGuidance?: string;
  primaryKnowledgeNodeId: string;
  knowledgeCoverage: NonNullable<Question['knowledgeCoverage']>;
  cognitiveLevel: NonNullable<Question['cognitiveLevel']>;
  difficulty: Question['difficulty'];
}

function pickManualQuestionInput(body: Record<string, unknown>): ManualQuestionInput {
  return {
    stem: body.stem,
    questionType: body.questionType,
    options: body.options,
    trueFalseStatements: body.trueFalseStatements,
    correctAnswer: body.correctAnswer,
    explanation: body.explanation,
    solutionGuidance: body.solutionGuidance,
    primaryKnowledgeNodeId: body.primaryKnowledgeNodeId,
    knowledgeCoverage: body.knowledgeCoverage,
    cognitiveLevel: body.cognitiveLevel,
    difficulty: body.difficulty,
  };
}

function normalizeManualQuestion(input: ManualQuestionInput): NormalizedManualQuestion {
  const questionType = input.questionType as QuestionType;
  const isChoice =
    questionType === 'MULTIPLE_CHOICE_SINGLE' || questionType === 'MULTIPLE_CHOICE_MULTIPLE';
  const options = isChoice
    ? (input.options as QuestionOption[]).map((option) => ({
        key: option.key,
        content: option.content.trim(),
      }))
    : [];

  let correctAnswer = String(input.correctAnswer).trim();
  if (questionType === 'MULTIPLE_CHOICE_MULTIPLE') {
    correctAnswer = correctAnswer
      .split(',')
      .map((key) => key.trim().toUpperCase())
      .sort()
      .join(',');
  } else if (questionType === 'NUMERIC') {
    correctAnswer = correctAnswer.replace(',', '.');
  }

  const solutionGuidance = (input.solutionGuidance as string | undefined)?.trim();
  return {
    stem: (input.stem as string).trim(),
    questionType,
    options,
    ...(questionType === 'TRUE_FALSE'
      ? { trueFalseStatements: input.trueFalseStatements as Question['trueFalseStatements'] }
      : {}),
    correctAnswer,
    explanation: (input.explanation as string | undefined)?.trim() ?? '',
    ...(solutionGuidance ? { solutionGuidance } : {}),
    primaryKnowledgeNodeId: (input.primaryKnowledgeNodeId as string).trim(),
    knowledgeCoverage: input.knowledgeCoverage as NormalizedManualQuestion['knowledgeCoverage'],
    cognitiveLevel: input.cognitiveLevel as NormalizedManualQuestion['cognitiveLevel'],
    difficulty: input.difficulty as Question['difficulty'],
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const p = url.searchParams;
    const filter: QuestionFilter = {
      search: p.get('search') ?? undefined,
      subjectId: (p.get('subjectId') ?? undefined) as QuestionFilter['subjectId'],
      grade: p.get('grade') ? (Number(p.get('grade')) as QuestionFilter['grade']) : undefined,
      chapterId: p.get('chapterId') ?? undefined,
      lessonId: p.get('lessonId') ?? undefined,
      questionType: (p.get('questionType') ?? undefined) as QuestionFilter['questionType'],
      difficulty: (p.get('difficulty') ?? undefined) as QuestionFilter['difficulty'],
      accessTier: (p.get('accessTier') ?? undefined) as QuestionFilter['accessTier'],
      usageContext: (p.get('usageContext') ?? undefined) as QuestionFilter['usageContext'],
      editorialStatus: (p.get('editorialStatus') ?? undefined) as QuestionFilter['editorialStatus'],
      roadmapEligible: p.has('roadmapEligible') ? p.get('roadmapEligible') === 'true' : undefined,
      isSpecial: p.has('isSpecial') ? p.get('isSpecial') === 'true' : undefined,
      sourceType: (p.get('sourceType') ?? undefined) as QuestionFilter['sourceType'],
      importOrigin: (p.get('importOrigin') ?? undefined) as QuestionFilter['importOrigin'],
      page: p.get('page') ? Number(p.get('page')) : 1,
      pageSize: p.get('pageSize') ? Number(p.get('pageSize')) : 50,
    };

    return NextResponse.json(await listQuestions(filter));
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET_metrics() {
  try {
    return NextResponse.json(await getMetrics());
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: 'INVALID_REQUEST_BODY' }, { status: 400 });
  }

  const manualInput = pickManualQuestionInput(parsedBody as Record<string, unknown>);
  const validation = validateForManualCreation(manualInput);
  if (!validation.valid) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: validation.errors },
      { status: 422 }
    );
  }

  try {
    const input = normalizeManualQuestion(manualInput);
    const tree = await readKnowledgeTree();
    const selectedNode = tree.nodes.find((node) => node.id === input.primaryKnowledgeNodeId);
    if (!isAttachableKnowledgeNode(selectedNode)) {
      return NextResponse.json(
        {
          error: 'INVALID_KNOWLEDGE_PLACEMENT',
          details: [
            {
              code: 'KNOWLEDGE_NODE_NOT_ATTACHABLE',
              message:
                'Mục kiến thức đã chọn không tồn tại, đã lưu trữ hoặc không thể gắn câu hỏi.',
              field: 'primaryKnowledgeNodeId',
            },
          ],
        },
        { status: 422 }
      );
    }

    const hierarchy = deriveHierarchyContext(input.primaryKnowledgeNodeId, tree);
    if (!hierarchy.subjectId || !hierarchy.grade) {
      return NextResponse.json(
        {
          error: 'INVALID_KNOWLEDGE_ANCESTRY',
          details: [
            {
              code: 'UNRESOLVABLE_KNOWLEDGE_ANCESTRY',
              message: 'Không thể xác định môn học và lớp từ cây kiến thức đã chọn.',
              field: 'primaryKnowledgeNodeId',
            },
          ],
        },
        { status: 422 }
      );
    }

    const contentHash = computeContentHash(input.stem, input.options, input.correctAnswer);
    const duplicate = await getQuestionByContentHash(contentHash);
    if (duplicate) {
      return NextResponse.json(
        {
          error: 'DUPLICATE_QUESTION',
          existingId: duplicate.id,
          existingCode: duplicate.code,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const question: Question = {
      id: `q-${uuidv4()}`,
      code: generateQuestionCode(hierarchy.subjectId),
      stem: input.stem,
      questionType: input.questionType,
      options: input.options,
      trueFalseStatements: input.trueFalseStatements,
      correctAnswer: input.correctAnswer,
      explanation: input.explanation,
      solutionGuidance: input.solutionGuidance,
      subjectId: hierarchy.subjectId,
      grade: hierarchy.grade,
      chapterId: hierarchy.chapterId,
      lessonId: hierarchy.lessonId,
      topicId: hierarchy.topicId,
      primaryKnowledgeNodeId: input.primaryKnowledgeNodeId,
      knowledgeCoverage: input.knowledgeCoverage,
      relatedKnowledgeNodeIds: [],
      cognitiveLevel: input.cognitiveLevel,
      conceptCodes: [],
      skillCodes: [],
      difficulty: input.difficulty,
      accessTier: 'OPEN',
      usageContexts: [],
      editorialStatus: 'DRAFT',
      isSpecial: false,
      roadmapEligible: false,
      prerequisiteConceptCodes: [],
      source: { sourceType: 'ORIGINAL', rightsStatus: 'OWNED' },
      contentHash,
      examSetIds: [],
      createdAt: now,
      updatedAt: now,
      importOrigin: 'MANUAL',
    };

    await saveQuestion(question);
    await appendAuditEntry({
      id: `audit-${uuidv4()}`,
      questionId: question.id,
      action: 'CREATED',
      actor: 'Admin',
      timestamp: now,
      note: 'Tạo câu hỏi thủ công',
    });

    return NextResponse.json({ question }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
