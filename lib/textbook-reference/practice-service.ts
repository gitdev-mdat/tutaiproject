import 'server-only';

import { childrenOf, knowledgeBreadcrumb } from '@/lib/knowledge-tree/knowledge-tree';
import { readKnowledgeArticles } from '@/lib/knowledge-tree/knowledge-article-storage';
import { readKnowledgeTree } from '@/lib/knowledge-tree/knowledge-tree-storage';
import { getLessonPublicationState } from '@/lib/knowledge-tree/learning-visibility';
import { practiceQuestionState, type PracticeQuestionState } from '@/lib/practice/practice-rules';
import {
  deriveHierarchyContext,
  isAttachableKnowledgeNode,
} from '@/lib/question-bank/qb-knowledge-utils';
import {
  appendAuditEntry,
  listQuestions,
  updateQuestionsLocked,
} from '@/lib/question-bank/qb-storage';
import type { Question, RightsStatus } from '@/lib/question-bank/qb-types';
import { formatSpan } from './lesson-coverage';
import { mapPrintedPage } from './page-mapping';
import {
  applyTextbookImport,
  textbookExternalId,
  type TextbookImportOutcome,
} from './practice-import';
import { practiceSetsForLesson, type PracticeSet } from './practice-sources';
import { exercisePracticeView, type ExercisePracticeView } from './practice-state';
import {
  getTextbookArtifact,
  getTextbookDocument,
  listTextbookArtifacts,
  listTextbookJobs,
  listTextbookMappings,
  updateExercisePractice,
} from './repository';
import { assessSolution, proposeSolutions, solutionProblemTypes } from './solution-matching';
import type { ExerciseChoice, TextbookArtifact, TextbookExtractionJob } from './types';

/**
 * The Admin workspace that turns a lesson's textbook exercises into Question
 * Bank questions: find the printed solutions, confirm or correct the pairing,
 * then import. Every decision is the Admin's; the matcher only suggests.
 */

export interface PracticeLessonOption {
  id: string;
  title: string;
}

export interface PracticeSetView {
  documentId: string;
  documentTitle: string;
  entryId: string;
  heading: string;
  chapterHeading: string | null;
  problemType: string | null;
  pages: string;
  lesson: PracticeSet['lesson'];
  ambiguousLessonIds: string[];
  /** The set's own pages, for extracting its questions here. */
  chunks: ExtractionChunk[];
  solutionSources: Array<{
    entryId: string;
    heading: string;
    pages: string;
    reason: string;
    chunks: ExtractionChunk[];
  }>;
  exercises: Array<ExercisePracticeView & { question: ImportedQuestion | null }>;
}

export interface ExtractionChunk {
  pages: number[];
  extracted: boolean;
  job: Pick<TextbookExtractionJob, 'id' | 'status' | 'error'> | null;
}

export interface ImportedQuestion {
  id: string;
  code: string;
  editorialStatus: Question['editorialStatus'];
  practiceState: PracticeQuestionState;
  lessonId: string | null;
}

export interface LessonPracticeWorkspace {
  lesson: { id: string; title: string; path: string[]; published: boolean };
  lessons: PracticeLessonOption[];
  sets: PracticeSetView[];
  counts: {
    extracted: number;
    solutionsConfirmed: number;
    needsReview: number;
    eligible: number;
    imported: number;
    assignedHere: number;
    availableToStudents: number;
  };
  pageLayouts: Record<string, Record<number, { pdfPage: number; position: string }>>;
  /** Every extracted solution of the sets' chapters, for "choose another solution". */
  solutions: Record<
    string,
    Array<
      Pick<
        TextbookArtifact,
        'id' | 'title' | 'content' | 'printedPages' | 'questionNumber' | 'answerChoice'
      >
    >
  >;
}

async function lessonContext(lessonId: string) {
  const [tree, articles] = await Promise.all([readKnowledgeTree(), readKnowledgeArticles()]);
  const node = tree.nodes.find((item) => item.id === lessonId);
  if (!node || node.kind !== 'KNOWLEDGE') return null;
  return { tree, articles, node };
}

/** Everything the workspace shows for one lesson. Null when the lesson does not exist. */
export async function loadLessonPractice(
  lessonId: string
): Promise<LessonPracticeWorkspace | null> {
  const context = await lessonContext(lessonId);
  if (!context) return null;
  const { tree, articles, node } = context;
  const lessonMappings = (await listTextbookMappings({ knowledgeNodeId: lessonId })).filter(
    (mapping) => mapping.status === 'CONFIRMED'
  );
  const documentIds = [...new Set(lessonMappings.map((mapping) => mapping.documentId))];
  const [documents, mappings, artifacts, jobs, { questions }] = await Promise.all([
    Promise.all(documentIds.map((id) => getTextbookDocument(id))),
    Promise.all(documentIds.map((id) => listTextbookMappings({ documentId: id }))).then((r) =>
      r.flat()
    ),
    Promise.all(documentIds.map((id) => listTextbookArtifacts({ documentId: id }))).then((r) =>
      r.flat()
    ),
    Promise.all(documentIds.map((id) => listTextbookJobs({ documentId: id, limit: 200 }))).then(
      (r) => r.flat()
    ),
    listQuestions({ pageSize: 100_000 }),
  ]);
  const books = documents.flatMap((document) => (document ? [document] : []));
  const sets = practiceSetsForLesson({ lessonId, documents: books, mappings, artifacts });
  const byId = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const questionsByExternal = new Map(
    questions.filter((q) => q.externalId?.startsWith('textbook:')).map((q) => [q.externalId!, q])
  );
  const proposals = new Map(
    books.map((book) => [
      book.id,
      proposeSolutions(artifacts.filter((artifact) => artifact.documentId === book.id)),
    ])
  );

  // A page group is done once its job finished (even with nothing on it) or items exist there.
  const chunkView = (
    entryId: string,
    pages: number[],
    extractedPages: Set<number>
  ): ExtractionChunk => {
    const job =
      jobs.find(
        (item) =>
          item.kind === 'EXTRACT' &&
          item.entryIds.includes(entryId) &&
          item.printedPages.join() === pages.join()
      ) ?? null;
    return {
      pages,
      extracted: job?.status === 'COMPLETED' || pages.some((page) => extractedPages.has(page)),
      job: job ? { id: job.id, status: job.status, error: job.error } : null,
    };
  };

  const setViews: PracticeSetView[] = sets.map((set) => {
    const book = books.find((item) => item.id === set.documentId)!;
    const solutionsOf = (entryId: string) =>
      artifacts.filter(
        (a) => a.kind === 'SOLUTION' && a.entryId === entryId && a.documentId === book.id
      );
    return {
      documentId: book.id,
      documentTitle: book.title,
      entryId: set.entry.id,
      heading: set.entry.originalHeading,
      chapterHeading: set.chapter?.originalHeading ?? null,
      problemType: set.problemType,
      pages: formatSpan(set.span),
      lesson: set.lesson,
      ambiguousLessonIds: set.ambiguousLessonIds,
      chunks: set.chunks.map((pages) =>
        chunkView(
          set.entry.id,
          pages,
          new Set(
            artifacts
              .filter((a) => a.entryId === set.entry.id && a.documentId === book.id)
              .flatMap((a) => a.printedPages)
          )
        )
      ),
      solutionSources: set.solutionSources.map((source) => ({
        entryId: source.entry.id,
        heading: source.entry.originalHeading,
        pages: formatSpan(source.span),
        reason: source.reason,
        chunks: source.chunks.map((pages) =>
          chunkView(
            source.entry.id,
            pages,
            new Set(solutionsOf(source.entry.id).flatMap((a) => a.printedPages))
          )
        ),
      })),
      exercises: set.exerciseIds
        .map((id) => byId.get(id)!)
        .filter((exercise) => exercise.reviewStatus !== 'REJECTED')
        .sort((a, b) => Number(a.questionNumber ?? 0) - Number(b.questionNumber ?? 0))
        .map((exercise) => {
          const view = exercisePracticeView({
            exercise,
            proposal: proposals.get(book.id)?.get(exercise.id),
            artifactsById: byId,
            suggestion: set.lesson,
          });
          const question = questionsByExternal.get(textbookExternalId(exercise.id)) ?? null;
          return {
            ...view,
            question: question
              ? {
                  id: question.id,
                  code: question.code,
                  editorialStatus: question.editorialStatus,
                  practiceState: practiceQuestionState(question).state,
                  lessonId: question.primaryKnowledgeNodeId ?? null,
                }
              : null,
          };
        }),
    };
  });

  // Lessons the Admin may assign: this lesson's siblings in curriculum order, plus any linked lesson.
  const siblings = childrenOf(tree.nodes, node.parentId).filter(
    (item) => item.kind === 'KNOWLEDGE'
  );
  const linked = new Set(
    mappings.filter((m) => m.status === 'CONFIRMED').map((m) => m.knowledgeNodeId)
  );
  const lessons = [
    ...siblings,
    ...tree.nodes.filter(
      (item) => linked.has(item.id) && !siblings.some((sibling) => sibling.id === item.id)
    ),
  ]
    .filter((item) => isAttachableKnowledgeNode(item))
    .map((item) => ({ id: item.id, title: item.title }));

  const all = setViews.flatMap((set) => set.exercises);
  const imported = all.filter((exercise) => exercise.question);
  const pageLayouts: LessonPracticeWorkspace['pageLayouts'] = {};
  for (const book of books) {
    const pages = new Set(
      artifacts
        .filter(
          (artifact) =>
            artifact.documentId === book.id &&
            (artifact.kind === 'EXERCISE' || artifact.kind === 'SOLUTION')
        )
        .flatMap((artifact) => artifact.printedPages)
    );
    pageLayouts[book.id] = Object.fromEntries(
      [...pages].map((page) => {
        const location = mapPrintedPage(page, book.anchors, book.pageLayout);
        return [page, { pdfPage: location.pdfPage, position: location.position }];
      })
    );
  }
  return {
    lesson: {
      id: node.id,
      title: node.title,
      path: knowledgeBreadcrumb(tree.nodes, node.id)
        .slice(0, -1)
        .map((item) => item.title),
      published:
        getLessonPublicationState(tree.nodes, node.id, articles.articles[node.id]) === 'PUBLISHED',
    },
    lessons,
    sets: setViews,
    counts: {
      extracted: all.length,
      solutionsConfirmed: all.filter((e) => e.status === 'MATCHED' || e.status === 'ADMIN_VERIFIED')
        .length,
      needsReview: all.filter((e) => e.status === 'SUGGESTED' || e.status === 'NEEDS_CONFIRMATION')
        .length,
      eligible: all.filter((e) => !e.blockers.length && !e.question).length,
      imported: imported.length,
      assignedHere: imported.filter((e) => e.question!.lessonId === lessonId).length,
      availableToStudents: imported.filter(
        (e) => e.question!.lessonId === lessonId && e.question!.practiceState === 'IN_PRACTICE'
      ).length,
    },
    pageLayouts,
    solutions: Object.fromEntries(
      books.map((book) => {
        const chapters = new Set(
          sets.filter((set) => set.documentId === book.id).map((set) => set.chapter?.id)
        );
        return [
          book.id,
          artifacts
            .filter(
              (a) =>
                a.documentId === book.id &&
                a.kind === 'SOLUTION' &&
                a.reviewStatus !== 'REJECTED' &&
                chapters.has(a.exerciseSet?.chapterEntryId ?? undefined)
            )
            .sort(
              (a, b) =>
                (a.printedPages[0] ?? 0) - (b.printedPages[0] ?? 0) ||
                Number(a.questionNumber ?? 0) - Number(b.questionNumber ?? 0)
            )
            .map((a) => ({
              id: a.id,
              title: a.title,
              content: a.content,
              printedPages: a.printedPages,
              questionNumber: a.questionNumber,
              answerChoice: a.answerChoice,
            })),
        ];
      })
    ),
  };
}

// ─── Admin decisions ────────────────────────────────────────────────────────

export class PracticeRequestError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 409 | 422 = 422,
    /** Evidence against a pairing the Admin has to acknowledge before confirming it. */
    readonly conflicts?: string[]
  ) {
    super(message);
    this.name = 'PracticeRequestError';
  }
}

async function decide(
  exerciseId: string,
  change: Parameters<typeof updateExercisePractice>[1]
): Promise<TextbookArtifact> {
  const result = await updateExercisePractice(exerciseId, change);
  if ('error' in result) throw new PracticeRequestError(result.error, result.status);
  return result.artifact;
}

/**
 * The Admin confirms that this printed solution belongs to this question; its
 * answer becomes the book's. A pairing with evidence against it (another number,
 * another problem type, another function, a failed check) is refused until the
 * Admin acknowledges each point, whether the matcher proposed it or not.
 */
export async function confirmSolution(
  exerciseId: string,
  solutionId: string,
  actor: string,
  acknowledged: string[] = []
) {
  const [solution, current] = await Promise.all([
    getTextbookArtifact(solutionId),
    getTextbookArtifact(exerciseId),
  ]);
  if (!solution || solution.kind !== 'SOLUTION')
    throw new PracticeRequestError('Không tìm thấy lời giải.', 404);
  if (!current || current.kind !== 'EXERCISE')
    throw new PracticeRequestError('Không tìm thấy câu hỏi.', 404);
  if (!solution.answerChoice)
    throw new PracticeRequestError(
      'Lời giải này không ghi phương án đúng. Nếu bạn đã tự giải, dùng “Tự giải và ghi nhận đáp án”.'
    );
  const artifacts = await listTextbookArtifacts({ documentId: solution.documentId });
  // Checked again under the row lock below; here so this refusal comes first.
  if (
    artifacts.some(
      (artifact) =>
        artifact.id !== exerciseId &&
        artifact.practice?.verification?.solutionArtifactId === solutionId
    )
  )
    throw new PracticeRequestError('Lời giải này đã được xác nhận cho một câu khác.', 409);
  const solutions = artifacts.filter(
    (artifact) => artifact.kind === 'SOLUTION' && artifact.reviewStatus !== 'REJECTED'
  );
  const type = solutionProblemTypes(solutions).get(solution.id) ?? {
    problemType: null,
    inferred: false,
  };
  const { conflicts } = assessSolution(current, solution, type).candidate;
  const open = conflicts.filter((conflict) => !acknowledged.includes(conflict));
  if (open.length)
    throw new PracticeRequestError(
      'Lời giải này chưa khớp hoàn toàn với đề. Đối chiếu trang sách rồi xác nhận từng điểm.',
      409,
      open
    );
  return decide(exerciseId, async (exercise, confirmedElsewhere) => {
    if (solution.documentId !== exercise.documentId) return { error: 'Lời giải thuộc sách khác.' };
    if (await confirmedElsewhere(solutionId))
      return { error: 'Lời giải này đã được xác nhận cho một câu khác.' };
    if (!(exercise.choices ?? []).some((choice) => choice.label === solution.answerChoice))
      return { error: `Phương án ${solution.answerChoice} không có trong đề.` };
    const previous = exercise.practice?.verification?.solutionArtifactId;
    if (previous && previous !== solutionId) return { error: 'Bỏ xác nhận lời giải cũ trước.' };
    const practice = {
      ...exercise.practice,
      rejectedSolutionIds: (exercise.practice?.rejectedSolutionIds ?? []).filter(
        (id) => id !== solutionId
      ),
      verification: {
        method: 'TEXTBOOK_SOLUTION' as const,
        answer: solution.answerChoice!,
        solutionArtifactId: solutionId,
        ...(conflicts.length ? { acknowledgedConflicts: conflicts } : {}),
        by: actor,
        at: new Date().toISOString(),
      },
    };
    return {
      practice,
      fields: {
        solutionStatus: 'MATCHED',
        answer: {
          status: 'FROM_SOLUTION',
          choice: solution.answerChoice!,
          solutionArtifactId: solutionId,
        },
        pairedArtifactId: solutionId,
        solutionReference: `${solution.title} (tr. ${solution.printedPages.join(', ')})`,
      },
      solution: { id: solutionId, paired: true },
    };
  });
}

/** The Admin says this solution is not this question's: never suggested for it again. */
export async function rejectSolution(exerciseId: string, solutionId: string) {
  return decide(exerciseId, (exercise) => {
    if (exercise.practice?.verification?.solutionArtifactId === solutionId)
      return { error: 'Lời giải này đang được xác nhận: bỏ xác nhận trước.' };
    return {
      practice: {
        ...exercise.practice,
        rejectedSolutionIds: [
          ...new Set([...(exercise.practice?.rejectedSolutionIds ?? []), solutionId]),
        ],
      },
    };
  });
}

/** Withdraws a confirmation or an Admin answer; the suggestions come back. */
export async function clearVerification(exerciseId: string) {
  return decide(exerciseId, (exercise) => {
    const verification = exercise.practice?.verification;
    if (!verification) return { practice: exercise.practice ?? {} };
    const { verification: _removed, ...practice } = exercise.practice!;
    void _removed;
    return {
      practice,
      fields: {
        solutionStatus: 'UNRESOLVED',
        answer: { status: 'UNRESOLVED' },
        pairedArtifactId: undefined,
        solutionReference: undefined,
      },
      ...(verification.solutionArtifactId
        ? { solution: { id: verification.solutionArtifactId, paired: false } }
        : {}),
    };
  });
}

/** The Admin solved the question independently: recorded as its own method, never as the book's answer. */
export async function verifyByAdmin(
  exerciseId: string,
  input: { answer: string; explanation: string },
  actor: string
) {
  return decide(exerciseId, (exercise) => {
    const choices = exercise.practice?.draft?.choices ?? exercise.choices ?? [];
    if (!choices.some((choice) => choice.label === input.answer))
      return { error: `Phương án ${input.answer} không có trong đề.` };
    const at = new Date().toISOString();
    const draft = exercise.practice?.draft;
    return {
      practice: {
        ...exercise.practice,
        verification: {
          method: 'ADMIN_SOLVED' as const,
          answer: input.answer,
          solutionArtifactId: null,
          by: actor,
          at,
        },
        draft: {
          stem: draft?.stem ?? exerciseStem(exercise),
          choices,
          explanation: input.explanation.trim(),
          by: actor,
          at,
        },
      },
      fields: {
        solutionStatus: 'ADMIN_VERIFIED',
        answer: { status: 'ADMIN_VERIFIED', choice: input.answer },
      },
      ...(exercise.practice?.verification?.solutionArtifactId
        ? { solution: { id: exercise.practice.verification.solutionArtifactId, paired: false } }
        : {}),
    };
  });
}

function exerciseStem(exercise: TextbookArtifact) {
  return exercisePracticeView({
    exercise: { ...exercise, practice: { ...exercise.practice, draft: undefined } },
    proposal: undefined,
    artifactsById: new Map(),
    suggestion: null,
  }).stem;
}

/** Saves corrected notation, choices and explanation; nothing is published or imported. */
export async function saveExerciseDraft(
  exerciseId: string,
  input: { stem: string; choices: ExerciseChoice[]; explanation: string },
  actor: string
) {
  for (const text of [input.stem, ...input.choices.map((choice) => choice.text)])
    if (!text.trim()) throw new PracticeRequestError('Đề và các phương án không được để trống.');
  return decide(exerciseId, (exercise) => {
    const labels = (exercise.choices ?? []).map((choice) => choice.label).join();
    if (input.choices.map((choice) => choice.label).join() !== labels)
      return { error: 'Giữ nguyên các phương án A–D như trong sách; chỉ sửa nội dung.' };
    return {
      practice: {
        ...exercise.practice,
        draft: {
          stem: input.stem.trim(),
          choices: input.choices.map((choice) => ({
            label: choice.label,
            text: choice.text.trim(),
          })),
          explanation: input.explanation.trim(),
          by: actor,
          at: new Date().toISOString(),
        },
      },
    };
  });
}

/** Assigns exercises to a lesson (overriding the suggestion). The lesson must be a real Knowledge Tree lesson. */
export async function assignLesson(exerciseIds: string[], lessonId: string, actor: string) {
  const tree = await readKnowledgeTree();
  if (!isAttachableKnowledgeNode(tree.nodes.find((node) => node.id === lessonId)))
    throw new PracticeRequestError('Bài học không tồn tại hoặc đã lưu trữ.', 404);
  const at = new Date().toISOString();
  for (const id of exerciseIds)
    await decide(id, (exercise) => ({
      practice: { ...exercise.practice, lesson: { lessonId, by: actor, at } },
    }));
}

/**
 * Imports verified exercises as DRAFT questions of the existing Question Bank,
 * under the bank's lock. Each exercise's lesson decides the question's place in
 * the Knowledge Tree; the bank's own review then publishes it.
 */
export async function importExercises(
  lessonId: string,
  exerciseIds: string[],
  rights: RightsStatus,
  actor: string
): Promise<TextbookImportOutcome[]> {
  const workspace = await loadLessonPractice(lessonId);
  if (!workspace) throw new PracticeRequestError('Không tìm thấy bài học.', 404);
  const tree = await readKnowledgeTree();
  const wanted = new Set(exerciseIds);
  const items = workspace.sets.flatMap((set) =>
    set.exercises
      .filter((exercise) => wanted.has(exercise.id))
      .map((view) => ({
        view,
        documentTitle: set.documentTitle,
        solutionPages: view.confirmedSolution?.printedPages ?? [],
        hierarchy: view.lesson ? deriveHierarchyContext(view.lesson.lessonId, tree) : {},
      }))
  );
  const missing = exerciseIds.filter((id) => !items.some((item) => item.view.id === id));
  const now = new Date().toISOString();
  const { outcomes, audits } = await updateQuestionsLocked((questions) => {
    const applied = applyTextbookImport(questions, items, { rights, actor, now });
    return { questions: applied.questions, result: applied };
  });
  for (const entry of audits) await appendAuditEntry(entry);
  // The stable exercise → question mapping, kept on the exercise as well.
  for (const outcome of outcomes)
    if (outcome.questionId && (outcome.result === 'CREATED' || outcome.result === 'UPDATED')) {
      const item = items.find((candidate) => candidate.view.id === outcome.exerciseId)!;
      await decide(outcome.exerciseId, (exercise) => ({
        practice: {
          ...exercise.practice,
          imported: {
            questionId: outcome.questionId!,
            lessonId: item.view.lesson!.lessonId,
            by: actor,
            at: now,
          },
        },
      }));
    }
  return [
    ...outcomes,
    ...missing.map((id) => ({
      exerciseId: id,
      questionNumber: null,
      result: 'SKIPPED' as const,
      reason: 'Câu này không thuộc phần bài tập của bài đang mở.',
    })),
  ];
}
