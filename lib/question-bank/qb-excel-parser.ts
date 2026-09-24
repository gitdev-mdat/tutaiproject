/** Deterministic parser for legacy and simplified question-bank workbooks. */

import * as XLSX from 'xlsx';

export interface WorkbookIssue {
  sheet: string;
  row: number;
  severity: 'WARNING' | 'ERROR';
  code: string;
  message: string;
}

export interface ParsedWorkbook {
  tracNghiem: Record<string, unknown>[];
  tuLuan: Record<string, unknown>[];
  structureErrors: string[];
  issues: WorkbookIssue[];
}

const LEGACY_SHEETS = ['TRAC_NGHIEM', 'TU_LUAN'] as const;
const INFORMATIONAL_SHEETS = new Set(['HUONG_DAN', 'DANH_MUC_KIEN_THUC', 'GUIDE']);

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function normalizeValue(key: string, value: unknown): unknown {
  if (typeof value !== 'string') return value ?? '';
  const trimmed = value.trim();
  return key === 'correct_answer' || key === 'dap_an_dung' ? trimmed.toUpperCase() : trimmed;
}

function parseSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  issues: WorkbookIssue[]
): Record<string, unknown>[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: true,
  });
  const headerIndex = matrix.findIndex((row) => row.some((cell) => String(cell ?? '').trim()));
  if (headerIndex < 0) {
    issues.push({
      sheet: sheetName,
      row: 1,
      severity: 'WARNING',
      code: 'EMPTY_SHEET',
      message: `Sheet "${sheetName}" does not contain tabular data.`,
    });
    return [];
  }

  const headers = matrix[headerIndex].map(normalizeHeader);
  const rows: Record<string, unknown>[] = [];
  for (let index = headerIndex + 1; index < matrix.length; index += 1) {
    const values = matrix[index];
    const meaningful = values.some((cell) => String(cell ?? '').trim().length > 0);
    if (!meaningful) {
      issues.push({
        sheet: sheetName,
        row: index + 1,
        severity: 'WARNING',
        code: 'BLANK_STYLED_ROW',
        message: 'Blank or styled-only row was ignored.',
      });
      continue;
    }
    const row: Record<string, unknown> = {
      _sheet: sheetName,
      _rowIndex: index + 1,
    };
    headers.forEach((header, columnIndex) => {
      if (header) row[header] = normalizeValue(header, values[columnIndex]);
    });
    rows.push(row);
  }
  return rows;
}

export function parseExcelWorkbook(buffer: Buffer): ParsedWorkbook {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellText: true, cellNF: false });
  const issues: WorkbookIssue[] = [];
  const hasLegacyLayout = LEGACY_SHEETS.every((name) => workbook.SheetNames.includes(name));

  if (hasLegacyLayout) {
    return {
      tracNghiem: parseSheet(workbook, 'TRAC_NGHIEM', issues),
      tuLuan: parseSheet(workbook, 'TU_LUAN', issues),
      structureErrors: [],
      issues,
    };
  }

  const dataSheets = workbook.SheetNames.filter(
    (name) => !INFORMATIONAL_SHEETS.has(name.toUpperCase())
  );
  if (dataSheets.length === 0) {
    return {
      tracNghiem: [],
      tuLuan: [],
      structureErrors: ['Workbook does not contain a question data sheet.'],
      issues,
    };
  }

  // Simplified templates use one flat sheet. Additional sheets are parsed as
  // part of the same staging batch instead of being silently discarded.
  return {
    tracNghiem: dataSheets.flatMap((name) => parseSheet(workbook, name, issues)),
    tuLuan: [],
    structureErrors: [],
    issues,
  };
}

export function mergeSheetRows(parsed: ParsedWorkbook): Record<string, unknown>[] {
  return [
    ...parsed.tracNghiem.map((row) => ({
      ...row,
      question_type: row.question_type || 'MULTIPLE_CHOICE_SINGLE',
    })),
    ...parsed.tuLuan.map((row) => ({
      ...row,
      question_type: row.question_type || 'SHORT_ANSWER',
    })),
  ];
}
