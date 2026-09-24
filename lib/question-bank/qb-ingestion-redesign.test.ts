import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { mergeSheetRows, parseExcelWorkbook } from './qb-excel-parser';
import { buildColumnMappings, parseCsv } from './qb-import';
import { computeQuestionFingerprints } from './qb-hash';
import { validateForImportCandidate } from './qb-validation';
import type { QuestionType } from './qb-types';

function workbookBuffer(sheets: Record<string, unknown[][]>): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

describe('workbook ingestion', () => {
  it('parses the two-sheet legacy template', () => {
    const parsed = parseExcelWorkbook(
      workbookBuffer({
        TRAC_NGHIEM: [
          ['stem', 'option_a', 'option_b', 'correct_answer'],
          ['2 + 2?', '3', '4', 'B'],
        ],
        TU_LUAN: [
          ['stem', 'correct_answer'],
          ['Explain the result', 'Because arithmetic'],
        ],
      })
    );
    expect(parsed.structureErrors).toEqual([]);
    expect(mergeSheetRows(parsed)).toHaveLength(2);
    expect(mergeSheetRows(parsed)[1].question_type).toBe('SHORT_ANSWER');
  });

  it('parses a simplified flat workbook without requiring legacy sheet names', () => {
    const parsed = parseExcelWorkbook(
      workbookBuffer({
        Questions: [
          ['stem', 'question_type', 'correct_answer'],
          ['Sky?', 'SHORT_ANSWER', 'Blue'],
        ],
      })
    );
    expect(parsed.structureErrors).toEqual([]);
    expect(mergeSheetRows(parsed)[0].stem).toBe('Sky?');
  });

  it('ignores the Guide sheet and maps primaryKnowledgeNodeId correctly', () => {
    const parsed = parseExcelWorkbook(
      workbookBuffer({
        Guide: [
          ['Field', 'Instructions'],
          ['stem', 'Required'],
        ],
        Questions: [
          ['stem', 'primaryKnowledgeNodeId'],
          ['Question', 'knowledge-node-1'],
        ],
      })
    );
    expect(mergeSheetRows(parsed)).toHaveLength(1);
    expect(buildColumnMappings(['primaryKnowledgeNodeId'])[0].targetField).toBe(
      'knowledge_node_id'
    );
  });

  it('reports and ignores styled blank rows instead of treating them as questions', () => {
    const sheet = XLSX.utils.aoa_to_sheet([['stem'], ['Question'], []]);
    sheet['A3'] = { t: 's', v: '', s: { font: { bold: true } } };
    sheet['!ref'] = 'A1:A3';
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Questions');
    const parsed = parseExcelWorkbook(
      Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
    );
    expect(mergeSheetRows(parsed)).toHaveLength(1);
    expect(parsed.issues.some((issue) => issue.code === 'BLANK_STYLED_ROW')).toBe(true);
  });
});

describe('CSV ingestion', () => {
  it('preserves quoted multiline cells and escaped quotes', () => {
    const rows = parseCsv('stem,correct_answer\r\n"Line one\nLine ""two""",A');
    expect(rows).toEqual([{ stem: 'Line one\nLine "two"', correct_answer: 'A' }]);
  });
});

describe('strict import candidate validation', () => {
  const cases: Array<{
    type: QuestionType;
    options: Array<{ key: string; content: string }>;
    answer: string;
  }> = [
    {
      type: 'MULTIPLE_CHOICE_SINGLE',
      options: [
        { key: 'A', content: '1' },
        { key: 'B', content: '2' },
      ],
      answer: 'A',
    },
    {
      type: 'MULTIPLE_CHOICE_MULTIPLE',
      options: [
        { key: 'A', content: '1' },
        { key: 'B', content: '2' },
      ],
      answer: 'A,B',
    },
    { type: 'TRUE_FALSE', options: [], answer: 'TRUE' },
    { type: 'SHORT_ANSWER', options: [], answer: 'accepted' },
    { type: 'NUMERIC', options: [], answer: '3.14' },
  ];

  it.each(cases)('accepts a structurally valid $type candidate', ({ type, options, answer }) => {
    const result = validateForImportCandidate({
      stem: 'Question',
      questionType: type,
      options,
      correctAnswer: answer,
      primaryKnowledgeNodeId: 'node-1',
      primaryKnowledgeNodeActive: true,
      source: { sourceType: 'PUBLIC_DOCUMENT', rightsStatus: 'REVIEW_REQUIRED' },
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.map((warning) => warning.code)).toContain('RIGHTS_REVIEW_REQUIRED');
  });

  it('blocks missing mappings and answers that do not reference an option', () => {
    const result = validateForImportCandidate({
      stem: 'Question',
      questionType: 'MULTIPLE_CHOICE_SINGLE',
      options: [
        { key: 'A', content: 'One' },
        { key: 'B', content: 'Two' },
      ],
      correctAnswer: 'C',
    });
    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(['ANSWER_NOT_IN_OPTIONS', 'MISSING_PRIMARY_KNOWLEDGE_NODE'])
    );
  });
});

describe('SHA-256 exact fingerprints', () => {
  it('normalizes exact content at stem, stem+options, and full levels', () => {
    const one = computeQuestionFingerprints('  Same  stem ', [{ key: 'A', content: ' Yes ' }], 'A');
    const two = computeQuestionFingerprints('same stem', [{ key: 'A', content: 'yes' }], 'a');
    expect(one).toEqual(two);
    expect(one.full).toMatch(/^[0-9a-f]{64}$/);
  });
});
