/**
 * Turns an admin-authored article into a lesson journey: a short sequence of
 * stages a student works through one at a time.
 *
 *   problem → idea → demonstration → worked example → try it → traps → wrap-up
 *
 * The stages are derived from the saved blocks only. Which stages exist, and
 * how many ideas the explanation is split into, follows the content: a lesson
 * with no example has no example stage, an explanation without its own labels
 * stays in short paragraphs. Nothing here invents content; maths for the
 * graph comes from the GRAPH block via `function-model.ts`.
 */

import { parseFunction, sameFunction, type RationalFunction } from '@/lib/learning/function-model';
import type { KnowledgeArticleBlock } from './knowledge-tree-types';

const LIST_MARKER = /^\s*(?:[-*•+]|\d+[.)])\s+/;

export function blockText(blocks: KnowledgeArticleBlock[], type: KnowledgeArticleBlock['type']) {
  return blocks
    .filter((block) => block.type === type)
    .map((block) => block.content.trim())
    .filter(Boolean)
    .join('\n\n');
}

/** Non-empty lines with any list marker removed. */
export function listItems(content: string): string[] {
  return content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(LIST_MARKER, '').trim())
    .filter(Boolean);
}

function paragraphs(content: string): string[] {
  return content
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

const words = (text: string) =>
  text
    .replace(/\$[^$]*\$/g, ' công_thức ')
    .split(/\s+/)
    .filter(Boolean).length;

// ─── Labels ──────────────────────────────────────────────────────────────────

/**
 * A paragraph that opens with its own label: "**Định nghĩa.** …", "## Định lí",
 * or the older "1. Khái niệm:" line. Returns the label and the rest.
 */
export function paragraphLabel(paragraph: string): { label: string; rest: string } | null {
  const bold = /^\*\*([^*\n]{1,80}?)\*\*\s*([.:])?\s*/.exec(paragraph);
  if (bold) {
    const inner = bold[1].trim();
    const punctuated = /[.:]$/.test(inner) || !!bold[2];
    if (punctuated) {
      return {
        label: inner.replace(/[.:]\s*$/, '').trim(),
        rest: paragraph.slice(bold[0].length).trim(),
      };
    }
  }
  const heading = /^#{1,4}\s+(.+)\n?/.exec(paragraph);
  if (heading) {
    return {
      label: heading[1].replace(/[.:]\s*$/, '').trim(),
      rest: paragraph.slice(heading[0].length).trim(),
    };
  }
  const numbered = /^\d+[.)]\s+([^\n]{1,80}?):\s*(?:\n|$)/.exec(paragraph);
  if (numbered) {
    return { label: numbered[1].trim(), rest: paragraph.slice(numbered[0].length).trim() };
  }
  return null;
}

export interface ConceptChunk {
  title: string | null;
  body: string;
}

/** About one screen of reading per idea when the author did not label the ideas. */
const UNLABELLED_CHUNK_WORDS = 90;

/** Splits the main explanation into the ideas the author labelled, or into short groups of paragraphs. */
export function splitConcepts(content: string): ConceptChunk[] {
  const parts = paragraphs(content);
  if (!parts.length) return [];
  const labelled = parts.some((part) => paragraphLabel(part));
  const chunks: ConceptChunk[] = [];
  if (labelled) {
    for (const part of parts) {
      const label = paragraphLabel(part);
      if (label) chunks.push({ title: label.label, body: label.rest });
      else if (chunks.length) {
        const last = chunks[chunks.length - 1];
        last.body = last.body ? `${last.body}\n\n${part}` : part;
      } else chunks.push({ title: null, body: part });
    }
    return chunks;
  }
  for (const part of parts) {
    const last = chunks[chunks.length - 1];
    if (last && words(last.body) + words(part) <= UNLABELLED_CHUNK_WORDS) {
      last.body = `${last.body}\n\n${part}`;
    } else chunks.push({ title: null, body: part });
  }
  return chunks;
}

// ─── Worked examples ─────────────────────────────────────────────────────────

export interface ExampleStep {
  /** "Bước 1" when the author numbered the step, otherwise null. */
  label: string | null;
  body: string;
}

export interface WorkedExample {
  title: string;
  problem: string;
  steps: ExampleStep[];
  /** The function the problem is about, when it is written as "$y = …$". */
  fn: RationalFunction | null;
}

const STEP = /^\s*(?:[-*•]\s*)?(?:\*\*)?(Bước\s*\d+)\s*[:.)]\s*(?:\*\*)?\s*(.*)$/i;
const EXAMPLE_LABEL = /^(?:\*\*)?\s*(Ví dụ\s*\d*)\s*[.:]?\s*(?:\*\*)?\s*[.:]?\s*/i;
const PROBLEM_LABEL = /^(?:\*\*)?\s*Đề bài\s*[.:]?\s*(?:\*\*)?\s*[.:]?\s*/i;
const SOLUTION_LABEL = /(?:\*\*)?\s*Lời giải\s*[.:]?\s*(?:\*\*)?\s*[.:]?\s*/i;

/** The first "$y = …$" or "$f(x) = …$" in a problem statement, parsed; null otherwise. */
export function problemFunction(problem: string): RationalFunction | null {
  for (const match of problem.matchAll(/\$([^$]+)\$/g)) {
    const formula = /^\s*(?:y|f\s*\(\s*x\s*\))\s*=\s*(.+)$/.exec(match[1]);
    if (!formula) continue;
    const parsed = parseFunction(formula[1]);
    if (parsed.ok) return parsed.fn;
  }
  return null;
}

function parseOneExample(text: string, index: number): WorkedExample {
  const lines = text.split('\n');
  const firstStep = lines.findIndex((line) => STEP.test(line));
  let title = `Ví dụ${index ? ` ${index + 1}` : ''}`;
  let body = text;
  const label = EXAMPLE_LABEL.exec(body);
  if (label) {
    title = label[1].trim();
    body = body.slice(label[0].length);
  }
  body = body.replace(PROBLEM_LABEL, '');

  let problem = '';
  const steps: ExampleStep[] = [];
  if (firstStep >= 0) {
    // "Bước 1: …" format: everything before the first step is the problem.
    const stepStart = body.split('\n').findIndex((line) => STEP.test(line));
    const before = body.split('\n').slice(0, stepStart).join('\n');
    const solutionAt = before.search(SOLUTION_LABEL);
    problem = (solutionAt >= 0 ? before.slice(0, solutionAt) : before).trim();
    const intro =
      solutionAt >= 0 ? before.slice(solutionAt).replace(SOLUTION_LABEL, '').trim() : '';
    if (intro) steps.push({ label: null, body: intro });
    for (const line of body.split('\n').slice(stepStart)) {
      const match = STEP.exec(line);
      if (match) steps.push({ label: match[1].replace(/\s+/, ' '), body: match[2].trim() });
      else if (steps.length) steps[steps.length - 1].body += `\n${line}`;
    }
  } else {
    // Paragraph format: the first paragraph is the problem, each later paragraph one step of reasoning.
    const parts = paragraphs(body);
    const first = parts.shift() ?? '';
    const solutionAt = first.search(SOLUTION_LABEL);
    if (solutionAt > 0) {
      problem = first.slice(0, solutionAt).trim();
      const rest = first.slice(solutionAt).replace(SOLUTION_LABEL, '').trim();
      if (rest) parts.unshift(rest);
    } else problem = first;
    for (const part of parts) {
      const cleaned = part.replace(new RegExp(`^${SOLUTION_LABEL.source}`, 'i'), '').trim();
      if (cleaned) steps.push({ label: null, body: cleaned });
    }
  }
  for (const step of steps) step.body = step.body.trim();
  return {
    title,
    problem: problem.trim(),
    steps: steps.filter((step) => step.body),
    fn: problemFunction(problem),
  };
}

/** One or more worked examples, split at "Ví dụ 1.", "Ví dụ 2." labels. */
export function parseExamples(content: string): WorkedExample[] {
  const text = content.replace(/\r\n?/g, '\n').trim();
  if (!text) return [];
  const parts = paragraphs(text);
  const groups: string[][] = [];
  for (const part of parts) {
    if (EXAMPLE_LABEL.test(part) || !groups.length) groups.push([part]);
    else groups[groups.length - 1].push(part);
  }
  return groups.map((group, index) => parseOneExample(group.join('\n\n'), index));
}

// ─── Reading time ────────────────────────────────────────────────────────────

/** About 130 words a minute for maths text, plus time for each example step and interaction. */
export function estimateReadingMinutes(blocks: KnowledgeArticleBlock[], interactions = 0): number {
  const total = blocks
    .filter((block) => !['TITLE', 'REFERENCES', 'GRAPH'].includes(block.type))
    .reduce((sum, block) => sum + words(block.content), 0);
  const steps = parseExamples(blockText(blocks, 'EXAMPLE')).reduce(
    (sum, example) => sum + example.steps.length,
    0
  );
  return Math.max(2, Math.round(total / 130 + steps / 2 + interactions));
}

// ─── Stages ──────────────────────────────────────────────────────────────────

export type GraphLayer = 'predict' | 'values' | 'derivative';

export type JourneyStage =
  | {
      id: 'bat-dau';
      kind: 'hook';
      title: string;
      intro: string;
      graph: GraphLayer | null;
      /** Shown on the opening screen only when there is no graph to explore. */
      goals: string[];
    }
  | {
      id: `y-${number}`;
      kind: 'concept';
      title: string;
      body: string;
      graph: GraphLayer | null;
    }
  | { id: 'vi-du'; kind: 'example'; title: string; examples: WorkedExample[] }
  | { id: 'thu-suc'; kind: 'check'; title: string }
  | { id: 'bay'; kind: 'mistakes'; title: string; items: string[] }
  | {
      id: 'tong-ket';
      kind: 'finish';
      title: string;
      recap: string[];
      objectives: string[];
      references: string;
    };

export interface LessonJourney {
  stages: JourneyStage[];
  /** The GRAPH block's function, when it parses; null otherwise. */
  graphSource: string | null;
  minutes: number;
}

/**
 * Builds the stages for one article.
 * - `graphOk`: the GRAPH block parsed; only then do graph interactions appear.
 * - `checks`: number of quick-check questions available for this lesson.
 */
export function buildLessonJourney(
  blocks: KnowledgeArticleBlock[],
  options: { checks: number }
): LessonJourney {
  const graphText = blockText(blocks, 'GRAPH');
  const graphParsed = graphText ? parseFunction(graphText) : null;
  const graphOk = !!graphParsed?.ok;
  const intro = blockText(blocks, 'INTRO');
  const concepts = splitConcepts(blockText(blocks, 'MAIN_CONTENT'));
  const examples = parseExamples(blockText(blocks, 'EXAMPLE'));
  const mistakes = listItems(blockText(blocks, 'COMMON_MISTAKE'));
  const recap = listItems(blockText(blocks, 'RECAP'));
  const objectives = listItems(blockText(blocks, 'OBJECTIVE'));
  const references = blockText(blocks, 'REFERENCES');

  const stages: JourneyStage[] = [];
  if (intro || graphOk) {
    stages.push({
      id: 'bat-dau',
      kind: 'hook',
      title: graphOk ? 'Nhìn đồ thị, em thấy gì?' : 'Bài này nói về điều gì?',
      intro,
      graph: graphOk ? 'predict' : null,
      goals: graphOk ? [] : objectives,
    });
  }
  // The first idea is shown with values on the graph (x₁ < x₂ ⇒ compare y),
  // the second with the tangent and the sign of f′. Later ideas, usually a
  // procedure, lead straight into the worked example.
  concepts.forEach((chunk, index) => {
    const graph: GraphLayer | null = !graphOk
      ? null
      : concepts.length === 1
        ? 'derivative'
        : index === 0
          ? 'values'
          : index === 1
            ? 'derivative'
            : null;
    stages.push({
      id: `y-${index + 1}`,
      kind: 'concept',
      title: chunk.title ?? (concepts.length > 1 ? `Ý ${index + 1}` : 'Kiến thức chính'),
      body: chunk.body,
      graph,
    });
  });
  if (examples.length) {
    stages.push({
      id: 'vi-du',
      kind: 'example',
      title: examples.length > 1 ? 'Ví dụ mẫu' : 'Cùng làm một ví dụ',
      examples,
    });
  }
  if (options.checks > 0) stages.push({ id: 'thu-suc', kind: 'check', title: 'Đến lượt em' });
  if (mistakes.length)
    stages.push({ id: 'bay', kind: 'mistakes', title: 'Những bẫy hay gặp', items: mistakes });
  stages.push({ id: 'tong-ket', kind: 'finish', title: 'Tóm tắt', recap, objectives, references });

  const interactions = (graphOk ? 2 : 0) + options.checks;
  return {
    stages,
    graphSource: graphOk ? graphText : null,
    minutes: estimateReadingMinutes(blocks, interactions),
  };
}

/** True when an example is about exactly the lesson's graph function. */
export function exampleUsesGraph(example: WorkedExample, graphSource: string | null): boolean {
  if (!example.fn || !graphSource) return false;
  const graph = parseFunction(graphSource);
  return graph.ok && sameFunction(example.fn, graph.fn);
}
