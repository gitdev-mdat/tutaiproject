import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Question } from '@/lib/question-bank/qb-types';
import corpus from './fixtures/math-book-3.json';
import { detectCalculatorMethod, fold } from './detect';
import { contentHash, generateGuide } from './generate';
import { evaluateExpr, parseLatex } from './latex';
import { solutionGuideFor } from './registry';
import { replay, screenText } from './fx570vn-plus';

const bank = corpus.questions;
const byNumber = (n: string) => bank.find((q) => q.questionNumber === n)!;
const solutions = corpus.artifacts.filter((a) => a.kind === 'SOLUTION');
const asQuestion = (q: (typeof bank)[number], extra: Partial<Question> = {}) =>
  ({ ...q, ...extra }) as unknown as Question;

/**
 * Hand labels, from reading every text of the snapshot: which explanations
 * contain a calculator method. Everything else must not be detected.
 */
const LABELLED_BANK = ['1', '2', '20'];
const LABELLED_SOLUTIONS = [
  'art-2aebbaed5cf8577995f75ef588263177',
  'art-eeb5204978fb1bfc066524b4a6573539',
  'art-549013333d7d65acdefdf72d03385fa1',
  'art-09bdd4e541a1885da5485b79f6a61fc0',
];

describe('detection over the real question bank snapshot (22 questions, 36 solutions)', () => {
  it('finds exactly the hand-labelled calculator methods: no false positive, no false negative', () => {
    const bankFound = bank
      .filter((q) => detectCalculatorMethod(q.explanation).present)
      .map((q) => q.questionNumber);
    expect(bankFound).toEqual(LABELLED_BANK);
    const solutionFound = solutions
      .filter((a) => detectCalculatorMethod(a.content).present)
      .map((a) => a.id);
    expect(solutionFound.sort()).toEqual([...LABELLED_SOLUTIONS].sort());
  });

  it('a calculator mentioned to say it is not needed is not a method (Dạng 2, Câu 13)', () => {
    const text = solutions.find((a) => a.content.includes('bấm máy thử'))!.content;
    const detection = detectCalculatorMethod(text);
    expect(detection.present).toBe(false);
    expect(detection.signals.some((signal) => signal.negated)).toBe(true);
  });

  it('classifies TABLE and reads the steps the source gives', () => {
    const q20 = detectCalculatorMethod(byNumber('20').explanation);
    expect(q20.operation).toBe('TABLE');
    expect(q20.model).toEqual({ id: null, name: null, brand: null });
    const ranges = q20.segments.flatMap((segment) =>
      segment.events.flatMap((event) =>
        event.kind === 'range' ? [[event.field, event.value?.text]] : []
      )
    );
    expect(ranges).toEqual([
      ['start', '-3'],
      ['end', '3'],
      ['step', '0.5'],
    ]);
    expect(
      q20.segments.filter((segment) => segment.figureMissing).map((segment) => segment.text)
    ).toEqual(['Nhập như sau:', 'Máy hiện:']);
    expect(q20.mathText).toBeNull();
  });

  it('splits the methods: the derivative method stays as text before the calculator section', () => {
    const q1 = detectCalculatorMethod(byNumber('1').explanation);
    expect(q1.mathText).toMatch(/^Tập xác định/);
    expect(q1.mathText).not.toMatch(/Cách 2/);
    expect(q1.segments[0].text).toBe('Cách 2: Sử dụng máy tính casio:');
  });

  it('flags OCR damage in the imported text', () => {
    expect(detectCalculatorMethod(byNumber('1').explanation).ocr.length).toBeGreaterThan(0);
    expect(detectCalculatorMethod(byNumber('20').explanation).ocr).toEqual([]);
  });

  it('reads Vietnamese without diacritics, line breaks and common OCR letter swaps', () => {
    expect(fold('Ấn ĐÚNG')).toBe('an dung');
    const messy =
      'Cach 2: dung may tinh\nNhap M0DE 7\nroi an 2 lan =\nStart? an\n-1 =\nEnd? 2 =\nStep? 0,5 =';
    const detection = detectCalculatorMethod(messy);
    expect(detection.operation).toBe('TABLE');
    expect(
      detection.segments.some((segment) =>
        segment.events.some((event) => event.kind === 'confirm-fg')
      )
    ).toBe(true);
    const step = detection.segments
      .flatMap((segment) => segment.events)
      .find((event) => event.kind === 'range' && event.field === 'step');
    expect(step).toMatchObject({ value: { text: '0.5' } });
    expect(detectCalculatorMethod('Bấm SHlFT SOLVE để tìm nghiệm.').operation).toBe('SOLVE');
  });

  it('names the model only when the text does', () => {
    expect(detectCalculatorMethod('Dùng máy tính fx-580VN X, bấm MODE 7').model.id).toBe(
      'fx-580VNX'
    );
    expect(detectCalculatorMethod('Dùng máy tính Casio fx 570VN Plus: MODE 7').model.id).toBe(
      'fx-570VN-PLUS'
    );
    expect(detectCalculatorMethod(byNumber('1').explanation).model).toEqual({
      id: null,
      name: null,
      brand: 'CASIO',
    });
  });
});

describe('the eight cases of the brief', () => {
  it('1. x/ln x: the reference lesson; the generator alone also gets level A and corrects SHIFT ×10ˣ', () => {
    expect(solutionGuideFor(asQuestion(byNumber('1')))?.origin).toBe('reference');
    const generated = generateGuide(byNumber('1'));
    expect(generated.level).toBe('A');
    const range = generated.steps.find((step) => step.id === 'range')!;
    expect(range.origin).toBe('CORRECTED');
    expect(range.keys).toEqual(['0', 'EQ', 'ALPHA', 'EXP', 'EQ', '0', 'DOT', '2', 'EQ']);
    expect(generated.warnings.map((warning) => warning.code)).toContain('KEY_CORRECTED');
    expect(range.checkpoint?.body).toMatch(/X = 0; 1/);
  });

  it('2. another TABLE question (Câu 20): level A from the stem function and the source range, values checked', () => {
    const guide = generateGuide(byNumber('20'));
    expect(guide.level).toBe('A');
    expect(guide.warnings.filter((warning) => warning.severity === 'review')).toEqual([]);
    const tutorial = guide.calculator!;
    const keys = tutorial.steps.flatMap((step) => step.keys);
    const state = replay(keys);
    expect(screenText(replay(tutorial.steps[1].keys, replay(tutorial.steps[0].keys)))).toBe(
      'f(X)=(2X−3)÷√(X²−1)'
    );
    const f = parseLatex('\\frac{2x - 3}{\\sqrt{x^2 - 1}}')!;
    for (const row of state.rows) {
      const expected = evaluateExpr(f, row.x);
      if (expected === null) expect(row.f).toBeNull();
      else expect(row.f).toBeCloseTo(expected, 9);
    }
    expect(state.rows.filter((row) => row.f === null).map((row) => row.x)).toEqual([
      -1, -0.5, 0, 0.5, 1,
    ]);
    expect(tutorial.conclusion[0]).toBe('F(X) giảm khi X đi từ −3 đến −1,5.');
    expect(tutorial.conclusion[1]).toBe('F(X) tăng khi X đi từ 1,5 đến 3.');
    expect(keys.length).toBeLessThan(60);
    expect(guide.steps.find((step) => step.id === 'enter-function')?.origin).toBe('FROM_QUESTION');
    // Visible to students as soon as the question is published: no warning needs review.
    expect(solutionGuideFor(asQuestion(byNumber('20')))?.level).toBe('A');
  });

  it('3. numerical equation solving (none in the bank: synthetic): level B, SHIFT SOLVE highlighted, no screen', () => {
    const guide = generateGuide({
      stem: 'Giải phương trình $x^3 - 3x + 1 = 0$.',
      explanation:
        'Cách 2: Dùng máy tính.\nNhập phương trình $x^3 - 3x + 1 = 0$, bấm SHIFT SOLVE.\nNhập giá trị ban đầu 0 rồi bấm =.\nMáy hiện:\n\nVậy phương trình có nghiệm gần 0,347.',
    });
    expect(guide.level).toBe('B');
    expect(guide.operation).toBe('SOLVE');
    const solve = guide.steps.find((step) => step.keys?.includes('CALC'))!;
    expect(solve.keys).toEqual(['SHIFT', 'CALC']);
    expect(guide.steps.some((step) => step.expect)).toBe(false);
    expect(guide.steps.find((step) => step.origin === 'MISSING')?.title).toMatch(/thiếu/);
  });

  it('4. CALC (synthetic): the stated result is checked against the formula, both ways', () => {
    const right = generateGuide({
      stem: 'Cho $f(x) = x^2 + 2x$. Tính $f(3)$.',
      explanation:
        'Dùng máy tính: nhập $f(x) = x^2 + 2x$, bấm CALC, nhập x = 3 rồi bấm =, được 15.',
    });
    expect(right.operation).toBe('CALC');
    expect(right.level).toBe('B');
    expect(right.steps[0].checkpoint).toMatchObject({ tone: 'observe' });
    const wrong = generateGuide({
      stem: 'Cho $f(x) = x^2 + 2x$. Tính $f(3)$.',
      explanation:
        'Dùng máy tính: nhập $f(x) = x^2 + 2x$, bấm CALC, nhập x = 3 rồi bấm =, được 16.',
    });
    expect(wrong.steps[0].checkpoint).toMatchObject({ tone: 'warning' });
    expect(wrong.warnings.find((warning) => warning.code === 'CALC_MISMATCH')?.severity).toBe(
      'review'
    );
  });

  it('5. a partial method (Câu 2: "tương tự bài 1"): proposed range, hidden until Admin accepts', () => {
    const q2 = asQuestion(byNumber('2'));
    const guide = generateGuide(q2);
    expect(guide.level).toBe('A');
    expect(guide.steps.find((step) => step.id === 'range')?.origin).toBe('PROPOSED');
    expect(guide.warnings.find((warning) => warning.code === 'RANGE_PROPOSED')?.severity).toBe(
      'review'
    );
    expect(guide.calculator!.conclusion[0]).toBe(
      'F(X) giảm khi X đi từ −0,8 đến 0, rồi tăng khi X đi từ 0 đến 1.'
    );
    expect(solutionGuideFor(q2)).toBeNull();
    expect(solutionGuideFor(q2, 'admin')?.admin?.visibleToStudents).toBe(false);
    const accepted = {
      ...q2,
      calculatorGuideReview: {
        status: 'ACCEPTED' as const,
        sourceHash: contentHash(q2),
        at: '2026-10-25T00:00:00Z',
      },
    };
    expect(solutionGuideFor(accepted)?.verification.status).toBe('ACCEPTED');
    // An edit of the question after the decision puts the guide back to review.
    expect(solutionGuideFor({ ...accepted, explanation: `${q2.explanation} ` })).toBeNull();
  });

  it('6. a wrong or incomplete key sequence: corrected when certain, otherwise held for review', () => {
    expect(
      generateGuide(byNumber('1')).notes.some(
        (note) => note.tone === 'error' && /ALPHA ×10ˣ/.test(note.text)
      )
    ).toBe(true);
    const c11 = solutions.find((a) => a.id === 'art-09bdd4e541a1885da5485b79f6a61fc0')!;
    const guide = generateGuide({
      stem: 'Tìm $m$ để hàm số $y = \\frac{\\sin x + m}{\\sin x - m}$ nghịch biến trên $\\left(\\frac{\\pi}{2}; \\pi\\right)$.',
      explanation: c11.content,
    });
    expect(guide.warnings.find((warning) => warning.code === 'ANGLE_UNIT')?.severity).toBe(
      'review'
    );
    expect(guide.steps[0].id).toBe('angle-unit');
  });

  it('7. no calculator method: no guide, and the original explanation stays the only solution', () => {
    for (const q of bank.filter((entry) => !LABELLED_BANK.includes(entry.questionNumber))) {
      expect(generateGuide(q).level, `Câu ${q.questionNumber}`).toBeNull();
      expect(solutionGuideFor(asQuestion(q), 'admin'), `Câu ${q.questionNumber}`).toBeNull();
    }
  });

  it('8. an unsupported function (sin, Dạng 2 Câu 11): level B with values computed from the formula', () => {
    const c11 = solutions.find((a) => a.id === 'art-09bdd4e541a1885da5485b79f6a61fc0')!;
    const guide = generateGuide({
      stem: 'Tìm $m$ để hàm số $y = \\frac{\\sin x + m}{\\sin x - m}$ nghịch biến trên $\\left(\\frac{\\pi}{2}; \\pi\\right)$.',
      explanation: c11.content,
    });
    expect(guide.level).toBe('B');
    expect(guide.functionLatex).toBe('$f(x) = \\frac{\\sin x + m}{\\sin x - m}$ (với m = 1)');
    const values = guide.steps.find((step) => step.id === 'values')!;
    expect(values.origin).toBe('COMPUTED');
    expect(values.values![0]).toEqual({ x: 'π/2', y: 'ERROR' });
    expect(values.values![5]).toEqual({ x: 'π', y: '−1' });
    expect(values.checkpoint?.title).toMatch(/tăng/);
    expect(guide.steps.find((step) => step.id === 'range')?.keys).toEqual([
      'SHIFT',
      'EXP',
      'DIVIDE',
      '2',
      'EQ',
      'SHIFT',
      'EXP',
      'EQ',
      'SHIFT',
      'EXP',
      'DIVIDE',
      '1',
      '0',
      'EQ',
    ]);
    expect(guide.calculator).toBeUndefined();
  });
});

describe('safety rules', () => {
  it('a model other than the fx-570VN PLUS family is never simulated as one', () => {
    const guide = generateGuide({
      stem: 'Cho hàm số $y = x^3 - 3x$.',
      explanation:
        'Cách 2: Dùng máy tính fx-580VN X, vào bảng giá trị. Start? -2 = End? 2 = Step? 0.5 =',
    });
    expect(guide.level).toBe('B');
    expect(guide.model.name).toBe('CASIO fx-580VNX');
    expect(guide.steps.some((step) => step.keys?.length)).toBe(false);
    expect(guide.calculator).toBeUndefined();
  });

  it('only a mention of the calculator: level C, held for review', () => {
    const guide = generateGuide({
      stem: 'Cho hàm số $y = x^2$.',
      explanation: 'Ta có thể dùng máy tính cầm tay để kiểm tra lại kết quả.',
    });
    expect(guide.level).toBe('C');
    expect(guide.warnings.find((warning) => warning.code === 'LOW_CONFIDENCE')?.severity).toBe(
      'review'
    );
    expect(
      solutionGuideFor({
        stem: 'Cho hàm số $y = x^2$.',
        explanation: 'Ta có thể dùng máy tính cầm tay để kiểm tra lại kết quả.',
      } as Question)
    ).toBeNull();
  });

  it('Admin can switch any guide off, the reference one included', () => {
    for (const q of [byNumber('1'), byNumber('20')]) {
      const question = asQuestion(q, {
        calculatorGuideReview: {
          status: 'DISABLED',
          sourceHash: contentHash(q),
          at: '2026-10-25T00:00:00Z',
        },
      });
      expect(solutionGuideFor(question)).toBeNull();
      expect(solutionGuideFor(question, 'admin')?.admin?.visibleToStudents).toBe(false);
    }
  });

  it('corrections change the instruction only, never the keys', () => {
    const q = byNumber('20');
    const question = asQuestion(q, {
      calculatorGuideReview: {
        status: 'ACCEPTED',
        sourceHash: contentHash(q),
        corrections: { range: 'Nhập Start −3, End 3, Step 0,5.' },
        at: '2026-10-25T00:00:00Z',
      },
    });
    const guide = solutionGuideFor(question)!;
    const range = guide.calculator!.steps.find((step) => step.id === 'range')!;
    expect(range.instruction).toBe('Nhập Start −3, End 3, Step 0,5.');
    expect(range.keys).toEqual(
      generateGuide(q).calculator!.steps.find((step) => step.id === 'range')!.keys
    );
  });

  it('no question id appears in the guide code', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const files = readdirSync(__dirname, { recursive: true, encoding: 'utf8' }).filter(
      (file) => file.endsWith('.ts') && !file.endsWith('.test.ts')
    );
    for (const file of files)
      expect(readFileSync(`${__dirname}/${file}`, 'utf8'), file).not.toMatch(
        /q-[0-9a-f]{8}-|Q-MAT-/
      );
  });
});

describe('coverage of the snapshot', () => {
  it('is reported per source and per level', () => {
    const rows = [
      ...bank.map((q) => ({
        kind: 'question',
        label: `Câu ${q.questionNumber} (${q.code})`,
        guide: generateGuide(q),
        question: asQuestion(q),
      })),
      ...solutions
        .filter((a) => !bank.some((q) => q.explanation === a.content))
        .map((a) => ({
          kind: 'solution-only',
          label: `Lời giải ${a.title} tr. ${a.printedPages.join(',')}`,
          guide: generateGuide({ stem: '', explanation: a.content }),
          question: null,
        })),
    ];
    const report = rows
      .filter((row) => row.guide.detection.present)
      .map((row) => ({
        kind: row.kind,
        label: row.label,
        operation: row.guide.operation,
        level: row.question
          ? (solutionGuideFor(row.question, 'admin')?.level ?? null)
          : row.guide.level,
        origin: row.question ? solutionGuideFor(row.question, 'admin')?.origin : 'generated',
        visibleToStudents: row.question ? !!solutionGuideFor(row.question) : null,
        review: row.guide.warnings
          .filter((warning) => warning.severity === 'review')
          .map((warning) => warning.code),
        info: row.guide.warnings
          .filter((warning) => warning.severity === 'info')
          .map((warning) => warning.code),
        steps: row.guide.calculator?.steps.length ?? row.guide.steps.length,
        keys: row.guide.calculator?.steps.reduce((sum, step) => sum + step.keys.length, 0) ?? 0,
      }));
    const summary = {
      inspected: { questions: bank.length, solutions: solutions.length },
      withCalculatorMethod: report.length,
      questionsWithCalculatorMethod: report.filter((row) => row.kind === 'question').length,
      levels: {
        A: report.filter((row) => row.level === 'A').length,
        B: report.filter((row) => row.level === 'B').length,
        C: report.filter((row) => row.level === 'C').length,
      },
      needsReview: report.filter((row) => row.review.length).length,
      report,
    };
    expect(summary.questionsWithCalculatorMethod).toBe(3);
    // Dạng 2 Câu 11 has no question in the bank yet: without its stem there is no function, so C.
    expect(summary.levels).toEqual({ A: 3, B: 0, C: 1 });
    if (process.env.WRITE_COVERAGE)
      writeFileSync(process.env.WRITE_COVERAGE, JSON.stringify(summary, null, 2));
  });
});
