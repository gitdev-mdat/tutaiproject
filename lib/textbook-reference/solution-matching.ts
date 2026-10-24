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

function normalizeExpression(source: string): string {
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

type Polynomial = Map<number, number>;

function polynomialOf(source: string): Polynomial | null {
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

function derivative(polynomial: Polynomial): Polynomial {
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

export interface SolutionMatch {
  exerciseId: string;
  solutionId: string;
  answerChoice: string | null;
  note: string;
}

const open = (artifact: TextbookArtifact) =>
  artifact.reviewStatus !== 'REJECTED' && !artifact.pairedArtifactId;

/**
 * Proposes pairs among a book's artifacts. Only an unambiguous candidate is
 * paired: two solutions that both fit one question (or one solution that fits
 * two questions) leave everything unresolved.
 */
export function matchSolutions(artifacts: TextbookArtifact[]): {
  matches: SolutionMatch[];
  /** Exercises with a same-number solution in scope that could not be verified. */
  unverified: Array<{ exerciseId: string; solutionIds: string[] }>;
} {
  const exercises = artifacts.filter((item) => item.kind === 'EXERCISE' && open(item));
  const solutions = artifacts.filter((item) => item.kind === 'SOLUTION' && open(item));
  const sameScope = (exercise: TextbookArtifact, solution: TextbookArtifact) =>
    exercise.documentId === solution.documentId &&
    !!exercise.exerciseSet?.chapterEntryId &&
    exercise.exerciseSet.chapterEntryId === solution.exerciseSet?.chapterEntryId &&
    !!exercise.exerciseSet.problemType &&
    exercise.exerciseSet.problemType === solution.exerciseSet?.problemType &&
    !!exercise.questionNumber &&
    exercise.questionNumber === solution.questionNumber;
  const proposals = exercises.map((exercise) => {
    const inScope = solutions.filter((solution) => sameScope(exercise, solution));
    const verified = inScope
      .map((solution) => ({
        solution,
        check: statementMatches(exercise.content, solution.content),
      }))
      .filter((candidate) => candidate.check.ok);
    return { exercise, inScope, verified };
  });
  const claims = new Map<string, number>();
  for (const proposal of proposals)
    if (proposal.verified.length === 1)
      claims.set(
        proposal.verified[0].solution.id,
        (claims.get(proposal.verified[0].solution.id) ?? 0) + 1
      );
  const matches: SolutionMatch[] = [];
  const unverified: Array<{ exerciseId: string; solutionIds: string[] }> = [];
  for (const { exercise, inScope, verified } of proposals) {
    if (verified.length === 1 && claims.get(verified[0].solution.id) === 1) {
      const { solution, check } = verified[0];
      matches.push({
        exerciseId: exercise.id,
        solutionId: solution.id,
        answerChoice: solution.answerChoice ?? null,
        note: `Đã ghép lời giải: cùng chương, ${exercise.exerciseSet?.problemType}, Câu ${exercise.questionNumber}, ${check.how} (đề tr. ${exercise.printedPages.join(', ')}, lời giải tr. ${solution.printedPages.join(', ')}).`,
      });
    } else if (inScope.length > 0) {
      unverified.push({ exerciseId: exercise.id, solutionIds: inScope.map((item) => item.id) });
    }
  }
  return { matches, unverified };
}

/** Applies matches to in-memory artifacts (the repository persists the same fields). */
export function applySolutionMatch(
  exercise: TextbookArtifact,
  solution: TextbookArtifact,
  match: SolutionMatch
) {
  exercise.pairedArtifactId = solution.id;
  exercise.solutionReference = `${solution.title} (tr. ${solution.printedPages.join(', ')})`;
  exercise.solutionStatus = 'MATCHED';
  exercise.answer = {
    status: 'FROM_SOLUTION',
    choice: match.answerChoice,
    solutionArtifactId: solution.id,
  };
  solution.pairedArtifactId = exercise.id;
  solution.exerciseReference = `${exercise.title} (tr. ${exercise.printedPages.join(', ')})`;
  for (const artifact of [exercise, solution])
    if (!artifact.verificationNotes.includes(match.note))
      artifact.verificationNotes.push(match.note);
}
