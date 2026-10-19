import type { TextbookArtifact } from './types';

function numberedSegments(content: string): Array<{ number: number; content: string }> {
  const matches = [...content.matchAll(/(?:^|\n)\s*Câu\s+(\d+)\s*:/giu)];
  return matches.map((match, index) => {
    const start = (match.index ?? 0) + (match[0].startsWith('\n') ? 1 : 0);
    const next = matches[index + 1];
    return {
      number: Number(match[1]),
      content: content.slice(start, next?.index ?? content.length).trim(),
    };
  });
}

function expressionFingerprint(content: string, kind: TextbookArtifact['kind']): string | null {
  const expression =
    kind === 'EXERCISE'
      ? /\b(?:hàm số\s+)?y\s*=\s*([^\n.;?]+)/iu.exec(content)?.[1]
      : /y'\s*=\s*\(([^)]+)\)\s*'/iu.exec(content)?.[1];
  return (
    expression
      ?.replace(/\s+(?:nghịch biến|đồng biến|trên khoảng|trên các khoảng|trên R)\b.*$/iu, '')
      .replace(/\\(?:left|right)/g, '')
      .replace(/\s+/g, '')
      .replace(/[{}$]/g, '')
      .toLocaleLowerCase('vi') ?? null
  );
}

function artifactQuestionNumber(artifact: TextbookArtifact): string | null {
  return (
    /^Câu\s+(\d+)/u.exec(artifact.title)?.[1] ??
    /^(?:Lời giải\s+)?Câu\s+(\d+)\s*:/u.exec(artifact.content)?.[1] ??
    null
  );
}

export function verifiesSimplePolynomialDerivative(solution: string): boolean {
  const match = /y'\s*=\s*\(([^)]+)\)\s*'\s*=\s*([^\n]+)/iu.exec(solution);
  if (!match) return false;
  const parse = (source: string): Map<number, number> | null => {
    const terms = source.replace(/\s+/g, '').match(/[+-]?[^+-]+/g);
    if (!terms) return null;
    const polynomial = new Map<number, number>();
    for (const term of terms) {
      const variable = /^([+-]?)(\d+(?:\.\d+)?)?x(?:\^(\d+))?$/iu.exec(term);
      const constant = /^([+-]?\d+(?:\.\d+)?)$/u.exec(term);
      if (variable) {
        const sign = variable[1] === '-' ? -1 : 1;
        const coefficient = variable[2] ? Number(variable[2]) : 1;
        const power = variable[3] ? Number(variable[3]) : 1;
        polynomial.set(power, (polynomial.get(power) ?? 0) + sign * coefficient);
      } else if (constant) {
        polynomial.set(0, (polynomial.get(0) ?? 0) + Number(constant[1]));
      } else {
        return null;
      }
    }
    return polynomial;
  };
  const original = parse(match[1]);
  const reported = parse(match[2].replace(/[.;].*$/, ''));
  if (!original || !reported) return false;
  const expected = new Map<number, number>();
  for (const [power, coefficient] of original) {
    if (power > 0) expected.set(power - 1, (expected.get(power - 1) ?? 0) + power * coefficient);
  }
  return (
    new Set([...expected.keys(), ...reported.keys()]).size ===
    [...new Set([...expected.keys(), ...reported.keys()])].filter(
      (power) => Math.abs((expected.get(power) ?? 0) - (reported.get(power) ?? 0)) < 1e-9
    ).length
  );
}

/** Split numbered source sets into individual artifacts and link only matching formulas. */
export function splitAndLinkExercises(artifacts: TextbookArtifact[]): TextbookArtifact[] {
  const split = artifacts.flatMap((artifact) => {
    if (artifact.kind !== 'EXERCISE' && artifact.kind !== 'SOLUTION') return [artifact];
    const segments = numberedSegments(artifact.content);
    if (segments.length < 2) return [artifact];
    return segments.map((segment) => ({
      ...artifact,
      id: `${artifact.id}-q${segment.number}`,
      title: `Câu ${segment.number}`,
      content: segment.content,
      exerciseReference: artifact.kind === 'EXERCISE' ? `Câu ${segment.number}` : undefined,
      solutionReference: artifact.kind === 'SOLUTION' ? `Câu ${segment.number}` : undefined,
    }));
  });
  for (const artifact of split)
    artifact.verificationNotes = [...new Set(artifact.verificationNotes)];

  for (const exercise of split.filter((artifact) => artifact.kind === 'EXERCISE')) {
    const number = artifactQuestionNumber(exercise);
    if (!number) continue;
    const exerciseFormula = expressionFingerprint(exercise.content, 'EXERCISE');
    if (!exerciseFormula) continue;
    const matches = split.filter(
      (candidate) =>
        candidate.kind === 'SOLUTION' &&
        artifactQuestionNumber(candidate) === number &&
        expressionFingerprint(candidate.content, 'SOLUTION') === exerciseFormula
    );
    if (matches.length !== 1) continue;
    const solution = matches[0];
    exercise.pairedArtifactId = solution.id;
    exercise.solutionReference = solution.title;
    solution.pairedArtifactId = exercise.id;
    solution.exerciseReference = exercise.title;
    const note = `Source correspondence checked: same printed exercise number and function y=${exerciseFormula}.`;
    if (!exercise.verificationNotes.includes(note)) exercise.verificationNotes.push(note);
    if (!solution.verificationNotes.includes(note)) solution.verificationNotes.push(note);
  }
  for (const solution of split.filter((artifact) => artifact.kind === 'SOLUTION')) {
    if (verifiesSimplePolynomialDerivative(solution.content)) {
      const note =
        'Deterministic check passed: the reported derivative matches the simple polynomial derivative shown in the source. Human review is still required.';
      if (!solution.verificationNotes.includes(note)) solution.verificationNotes.push(note);
    }
  }
  return split;
}
