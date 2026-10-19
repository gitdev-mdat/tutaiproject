import { describe, expect, it } from 'vitest';
import { splitAndLinkExercises, verifiesSimplePolynomialDerivative } from './artifact-linking';
import type { TextbookArtifact } from './types';

function artifact(kind: TextbookArtifact['kind'], id: string, content: string): TextbookArtifact {
  return {
    id,
    documentId: 'doc',
    entryId: 'entry',
    kind,
    title: 'group',
    content,
    mathematicalNotation: [],
    printedPages: [19],
    pdfPages: [10],
    reviewStatus: 'NEEDS_REVIEW',
    verificationNotes: [],
    extractionKey: 'key',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('textbook exercise links', () => {
  it('splits numbered items and links only a matching numbered formula', () => {
    const results = splitAndLinkExercises([
      artifact(
        'EXERCISE',
        'exercise',
        'Câu 1: Cho hàm số y = x / ln x. Chọn đáp án.\n\nCâu 2: Cho hàm số y = x + 1.'
      ),
      artifact(
        'SOLUTION',
        'solution',
        "Câu 1: Đáp án D. y' = (x/ln x)' = (ln x - 1)/(ln x)^2.\n\nCâu 2: Đáp án A. y' = (x + 2)'."
      ),
    ]);
    const question = results.find((item) => item.kind === 'EXERCISE' && item.title === 'Câu 1')!;
    const solution = results.find((item) => item.kind === 'SOLUTION' && item.title === 'Câu 1')!;
    const unrelated = results.find((item) => item.kind === 'EXERCISE' && item.title === 'Câu 2')!;
    expect(question.pairedArtifactId).toBe(solution.id);
    expect(solution.pairedArtifactId).toBe(question.id);
    expect(unrelated.pairedArtifactId).toBeUndefined();
  });

  it('trims a problem statement after the function formula before comparing solutions', () => {
    const results = splitAndLinkExercises([
      artifact(
        'EXERCISE',
        'exercise',
        'Câu 3: Hỏi hàm số y = x^3 + 3x^2 - 4 nghịch biến trên khoảng nào?'
      ),
      artifact(
        'SOLUTION',
        'solution',
        "Lời giải Câu 3: Đáp án A. y' = (x^3 + 3x^2 - 4)' = 3x^2 + 6x."
      ),
    ]);
    expect(results[0].pairedArtifactId).toBe(results[1].id);
    expect(results[1].pairedArtifactId).toBe(results[0].id);
  });

  it('does not pair the same question number when the function differs', () => {
    const results = splitAndLinkExercises([
      artifact(
        'EXERCISE',
        'exercise',
        'Câu 1: Cho hàm số y = (e^x - m - 2)/(e^x - m^2) đồng biến trên khoảng đã cho.'
      ),
      artifact('SOLUTION', 'solution', "Câu 1: Đáp án D. y' = (x/ln x)' = (ln x - 1)/(ln x)^2."),
    ]);
    expect(results[0].pairedArtifactId).toBeUndefined();
    expect(results[1].pairedArtifactId).toBeUndefined();
  });

  it('checks a simple polynomial derivative without approving the artifact', () => {
    expect(verifiesSimplePolynomialDerivative("Câu 3: y' = (x^3 + 3x^2 - 4)' = 3x^2 + 6x.")).toBe(
      true
    );
    expect(verifiesSimplePolynomialDerivative("Câu 3: y' = (x^3 + 3x^2 - 4)' = 3x^2 + 5x.")).toBe(
      false
    );
  });

  it('is idempotent when the same source artifacts are linked again', () => {
    const source = [
      artifact(
        'EXERCISE',
        'exercise',
        'Câu 3: Cho hàm số y = x^3 + 3x^2 - 4 nghịch biến trên khoảng nào?'
      ),
      artifact('SOLUTION', 'solution', "Câu 3: y' = (x^3 + 3x^2 - 4)' = 3x^2 + 6x."),
    ];
    const once = splitAndLinkExercises(source);
    const twice = splitAndLinkExercises(once);
    expect(twice).toEqual(once);
  });
});
