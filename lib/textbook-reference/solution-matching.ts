import { checkMonotonicityAnswer } from './math-checks';
import type { TextbookArtifact } from './types';

/**
 * Pairs extracted questions with solutions printed elsewhere in the book (this
 * one prints "Bài tập rèn luyện kỹ năng" and "Hướng dẫn giải chi tiết" pages
 * apart, and restarts "Câu 1" in every set). A pair needs all of: same book,
 * same chapter, same problem type, same printed question number, and a
 * mathematical check that the solution is about the same statement. Anything
 * less stays unresolved; a number alone never pairs.
 */

const mathSegments = (text: string) =>
  [...text.matchAll(/\$([^$]+)\$/g)]
    .map((match) => match[1])
    .concat(text.includes('$') ? [] : [text]);

export function normalizeExpression(source: string): string {
  return source
    .replace(/\\(?:left|right|displaystyle)/g, '')
    .replace(/\\dfrac|\\tfrac/g, '\\frac')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/[{}\s]/g, '')
    .replace(/\\/g, '')
    .replace(/[.,;:]+$/, '')
    .toLocaleLowerCase('vi');
}

/** The function an exercise defines: the right side of its first "y = …" or "f(x) = …". */
export function definedFunction(text: string): string | null {
  for (const segment of mathSegments(text)) {
    const match = /(?:^|[^'a-z])(?:y|f\(x\))\s*=\s*([^=]+?)(?:\s*$|\s*(?:,|;|\.\s))/iu.exec(
      segment.replace(/\\left|\\right/g, '')
    );
    if (match && /x/.test(match[1])) return normalizeExpression(match[1]);
  }
  return null;
}

export type Polynomial = Map<number, number>;

export function polynomialOf(source: string): Polynomial | null {
  const expression = normalizeExpression(source).replace(/\*/g, '');
  if (!expression || /[^0-9x^+\-()/.]/.test(expression)) return null;
  const terms = expression.match(/[+-]?[^+-]+/g);
  if (!terms) return null;
  const polynomial: Polynomial = new Map();
  for (const term of terms) {
    const match =
      /^([+-]?)(?:\((\d+)\)\/\((\d+)\)|(\d+(?:\.\d+)?)(?:\/(\d+))?)?(x(?:\^(\d+))?)?$/.exec(term);
    if (!match || (!match[2] && !match[4] && !match[6])) return null;
    const sign = match[1] === '-' ? -1 : 1;
    const coefficient = match[2]
      ? Number(match[2]) / Number(match[3])
      : match[4]
        ? Number(match[4]) / (match[5] ? Number(match[5]) : 1)
        : 1;
    const power = match[6] ? (match[7] ? Number(match[7]) : 1) : 0;
    polynomial.set(power, (polynomial.get(power) ?? 0) + sign * coefficient);
  }
  return polynomial;
}

function samePolynomial(a: Polynomial, b: Polynomial) {
  const powers = new Set([...a.keys(), ...b.keys()]);
  return [...powers].every((power) => Math.abs((a.get(power) ?? 0) - (b.get(power) ?? 0)) < 1e-9);
}

export function derivative(polynomial: Polynomial): Polynomial {
  const result: Polynomial = new Map();
  for (const [power, coefficient] of polynomial)
    if (power > 0) result.set(power - 1, (result.get(power - 1) ?? 0) + power * coefficient);
  return result;
}

/** Derivatives a solution states: "y' = Q" (first equality), or "y' = (P)' = Q". */
function statedDerivatives(text: string): string[] {
  const found: string[] = [];
  for (const segment of mathSegments(text)) {
    const clean = segment.replace(/\\left|\\right/g, '').replace(/\\prime/g, "'");
    for (const match of clean.matchAll(/(?:y|f)\s*'(?:\(x\))?\s*=\s*([^=]+)(?:=\s*([^=]+))?/giu)) {
      const first = match[1].trim();
      // "(P)' = Q": the stated derivative is Q.
      if (/^\(.*\)\s*'$/.test(first) && match[2]) found.push(match[2]);
      else found.push(first);
    }
  }
  return found;
}

/**
 * True when the solution demonstrably concerns the exercise's statement: it
 * restates the same function, or the derivative it computes is that function's.
 */
export function statementMatches(
  exercise: string,
  solution: string
): { ok: boolean; how?: string } {
  const fn = definedFunction(exercise);
  if (!fn) return { ok: false };
  const restated = definedFunction(solution);
  if (restated && restated === fn) return { ok: true, how: `cùng hàm số y = ${fn}` };
  // "(P)'" or "[P]'": the book writes the derivative of the exercise's function.
  const bracketed = solution.replace(/\\left|\\right/g, '').replace(/\[([^[\]]+)\]'/g, "($1)'");
  if (bracketed.includes(`(${fn})'`) || normalizeExpression(bracketed).includes(`(${fn})'`))
    return { ok: true, how: `lời giải lấy đạo hàm của y = ${fn}` };
  const polynomial = polynomialOf(fn);
  if (!polynomial) return { ok: false };
  const expected = derivative(polynomial);
  for (const stated of statedDerivatives(solution)) {
    const reported = polynomialOf(stated);
    if (reported && samePolynomial(expected, reported))
      return { ok: true, how: `đạo hàm trong lời giải đúng là đạo hàm của y = ${fn}` };
  }
  return { ok: false };
}

export interface SolutionCandidate {
  solutionId: string;
  /** STRONG: same set, type and number, and the solution's mathematics is about this statement. */
  strength: 'STRONG' | 'WEAK';
  evidence: string[];
  conflicts: string[];
  answerChoice: string | null;
}

export interface SolutionProposal {
  status: 'SUGGESTED' | 'NEEDS_CONFIRMATION' | 'UNRESOLVED';
  candidates: SolutionCandidate[];
}

export type TypeInfo = { problemType: string | null; inferred: boolean };

/**
 * The problem type of each solution. A solution whose own heading was not on
 * its page ("Câu 12" on p. 30, under the "Dạng 1" heading printed on p. 29)
 * takes the type its section's numbering implies: within one "Hướng dẫn giải"
 * section numbers run on until a new "Dạng" restarts them at 1. Anything that
 * does not follow from the printed order stays unknown.
 */
export function solutionProblemTypes(solutions: TextbookArtifact[]): Map<string, TypeInfo> {
  const result = new Map<string, TypeInfo>();
  const sections = new Map<string, TextbookArtifact[]>();
  for (const solution of solutions) {
    const key = `${solution.documentId}\0${solution.entryId}`;
    sections.set(key, [...(sections.get(key) ?? []), solution]);
  }
  for (const items of sections.values()) {
    const pages = [...new Set(items.map((item) => item.printedPages[0] ?? 0))].sort(
      (a, b) => a - b
    );
    let carried = null as { type: string; max: number } | null;
    for (const page of pages) {
      const onPage = items.filter((item) => (item.printedPages[0] ?? 0) === page);
      const number = (item: TextbookArtifact) => Number(item.questionNumber ?? Number.NaN);
      const explicitTypes = new Set(
        onPage.flatMap((item) =>
          item.exerciseSet?.problemType ? [item.exerciseSet.problemType] : []
        )
      );
      const newTypes = [...explicitTypes].filter((type) => type !== carried?.type);
      for (const item of onPage) {
        if (item.exerciseSet?.problemType) {
          result.set(item.id, { problemType: item.exerciseSet.problemType, inferred: false });
          continue;
        }
        const n = number(item);
        let type: string | null = null;
        if (!newTypes.length) type = carried?.type ?? null;
        else if (newTypes.length === 1 && !carried) type = newTypes[0];
        else if (newTypes.length === 1 && carried && Number.isFinite(n))
          type = n > carried.max ? carried.type : newTypes[0];
        result.set(item.id, { problemType: type, inferred: type !== null });
      }
      const last: string | null | undefined =
        newTypes.length === 1 ? newTypes[0] : newTypes.length ? null : carried?.type;
      if (!last) {
        carried = null;
        continue;
      }
      const numbers = onPage
        .filter((item) => result.get(item.id)?.problemType === last)
        .map(number)
        .filter(Number.isFinite);
      carried = { type: last, max: Math.max(carried?.type === last ? carried.max : 0, ...numbers) };
    }
  }
  return result;
}

const LETTERS = /(?:đáp án|chọn)\s*:?\s*([A-D])\b/giu;

/**
 * The evidence for and against one exercise–solution pair, whoever proposed it:
 * the matcher, or an Admin choosing another solution by hand.
 */
export function assessSolution(
  exercise: TextbookArtifact,
  solution: TextbookArtifact,
  type: TypeInfo
): {
  candidate: SolutionCandidate;
  sameNumber: boolean;
  statementMatches: boolean;
  relation: 'SAME' | 'SAME_INFERRED' | 'UNKNOWN' | 'DIFFERENT';
} {
  const ownType = exercise.exerciseSet?.problemType ?? null;
  const sameNumber =
    !!exercise.questionNumber && exercise.questionNumber === solution.questionNumber;
  const statement = statementMatches(exercise.content, solution.content);
  const relation =
    !ownType || !type.problemType
      ? 'UNKNOWN'
      : ownType !== type.problemType
        ? 'DIFFERENT'
        : type.inferred
          ? 'SAME_INFERRED'
          : 'SAME';
  const evidence = [`Cùng sách và cùng chương (lời giải tr. ${solution.printedPages.join(', ')})`];
  const conflicts: string[] = [];
  if (sameNumber) evidence.push(`Cùng số Câu ${exercise.questionNumber}`);
  else
    conflicts.push(
      `Khác số câu: đề Câu ${exercise.questionNumber ?? '?'}, lời giải Câu ${solution.questionNumber ?? '?'}`
    );
  if (relation === 'SAME') evidence.push(`Cùng ${ownType} (theo tiêu đề in trên trang lời giải)`);
  else if (relation === 'SAME_INFERRED')
    evidence.push(`Cùng ${ownType} (suy ra từ thứ tự đánh số trong phần lời giải)`);
  else if (relation === 'DIFFERENT')
    conflicts.push(`Lời giải thuộc ${type.problemType}, đề thuộc ${ownType}`);
  else conflicts.push('Chưa xác định được lời giải thuộc dạng nào');
  if (statement.ok) evidence.push(`Khớp nội dung toán: ${statement.how}`);
  else {
    const own = definedFunction(exercise.content);
    const other = definedFunction(solution.content);
    if (own && other && own !== other) conflicts.push(`Lời giải nói về hàm số khác: y = ${other}`);
    else
      conflicts.push(
        'Chưa đối chiếu được nội dung toán: lời giải không nhắc lại hàm số hay đạo hàm của đề'
      );
  }
  const answer = solution.answerChoice ?? null;
  const labels = new Set((exercise.choices ?? []).map((choice) => choice.label));
  if (!answer) conflicts.push('Lời giải không ghi phương án đúng');
  else if (labels.size && !labels.has(answer as never))
    conflicts.push(`Phương án ${answer} không có trong đề`);
  const letters = new Set([...solution.content.matchAll(LETTERS)].map((m) => m[1].toUpperCase()));
  if (answer && [...letters].some((letter) => letter !== answer))
    conflicts.push(`Lời giải ghi nhiều phương án: ${[...letters].join(', ')}`);
  const check = checkMonotonicityAnswer(exercise.content, exercise.choices, answer);
  if (check.status === 'CONFIRMED') evidence.push(check.note);
  else if (check.status === 'CONFLICT') conflicts.push(check.note);
  else if (check.status === 'AMBIGUOUS') evidence.push(check.note);
  return {
    sameNumber,
    statementMatches: statement.ok,
    relation,
    candidate: {
      solutionId: solution.id,
      strength:
        sameNumber &&
        (relation === 'SAME' || relation === 'SAME_INFERRED') &&
        statement.ok &&
        !conflicts.length
          ? 'STRONG'
          : 'WEAK',
      evidence,
      conflicts,
      answerChoice: answer,
    },
  };
}

/**
 * Candidate solutions for every open exercise of a book, with the evidence for
 * and against each. Scope is the same book and chapter; a candidate needs the
 * same printed number or a solution about the same statement, and a number alone
 * never makes a candidate strong. Admin rejections and solutions already
 * confirmed for another question are left out. Nothing is stored here.
 */
export function proposeSolutions(artifacts: TextbookArtifact[]): Map<string, SolutionProposal> {
  const exercises = artifacts.filter(
    (item) => item.kind === 'EXERCISE' && item.reviewStatus !== 'REJECTED'
  );
  const solutions = artifacts.filter(
    (item) => item.kind === 'SOLUTION' && item.reviewStatus !== 'REJECTED'
  );
  const types = solutionProblemTypes(solutions);
  const confirmedFor = new Map<string, string>();
  for (const exercise of exercises) {
    const id = exercise.practice?.verification?.solutionArtifactId;
    if (id) confirmedFor.set(id, exercise.id);
  }
  const proposals = new Map<string, SolutionProposal>();
  for (const exercise of exercises) {
    const set = exercise.exerciseSet;
    const rejected = new Set(exercise.practice?.rejectedSolutionIds ?? []);
    const candidates: SolutionCandidate[] = [];
    for (const solution of solutions) {
      if (
        solution.documentId !== exercise.documentId ||
        !set?.chapterEntryId ||
        solution.exerciseSet?.chapterEntryId !== set.chapterEntryId ||
        rejected.has(solution.id) ||
        (confirmedFor.has(solution.id) && confirmedFor.get(solution.id) !== exercise.id)
      )
        continue;
      const type = types.get(solution.id) ?? { problemType: null, inferred: false };
      const assessment = assessSolution(exercise, solution, type);
      if (!assessment.sameNumber && !assessment.statementMatches) continue;
      if (assessment.relation === 'DIFFERENT' && !assessment.statementMatches) continue;
      candidates.push(assessment.candidate);
    }
    candidates.sort(
      (a, b) =>
        Number(b.strength === 'STRONG') - Number(a.strength === 'STRONG') ||
        a.conflicts.length - b.conflicts.length
    );
    proposals.set(exercise.id, {
      status: candidates.length ? 'NEEDS_CONFIRMATION' : 'UNRESOLVED',
      candidates,
    });
  }
  // A suggestion needs exactly one strong candidate that no other question also claims strongly.
  const strongClaims = new Map<string, number>();
  for (const proposal of proposals.values())
    for (const candidate of proposal.candidates)
      if (candidate.strength === 'STRONG')
        strongClaims.set(candidate.solutionId, (strongClaims.get(candidate.solutionId) ?? 0) + 1);
  for (const proposal of proposals.values()) {
    const strong = proposal.candidates.filter((candidate) => candidate.strength === 'STRONG');
    if (strong.length === 1 && strongClaims.get(strong[0].solutionId) === 1)
      proposal.status = 'SUGGESTED';
  }
  return proposals;
}
