import ExcelJS, { type DataValidation } from 'exceljs';

type WorksheetWithRangeValidations = ExcelJS.Worksheet & {
  dataValidations: {
    add(range: string, validation: DataValidation): void;
  };
};

const QUESTION_HEADERS = [
  'external_id',
  'question_type',
  'stem',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'option_e',
  'correct_answer',
  'explanation',
  'primaryKnowledgeNodeId',
  'difficulty',
  'source_name',
  'source_page',
  'rights_status',
] as const;

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Tú Tài';
  workbook.created = new Date();

  const guide = workbook.addWorksheet('Guide', { views: [{ state: 'frozen', ySplit: 1 }] });
  guide.columns = [{ width: 24 }, { width: 88 }];
  guide.addRow(['Trường', 'Hướng dẫn']);
  guide.addRows([
    ['Bắt buộc', 'question_type, stem, correct_answer và primaryKnowledgeNodeId.'],
    [
      'Loại câu hỏi',
      'MULTIPLE_CHOICE_SINGLE, MULTIPLE_CHOICE_MULTIPLE, TRUE_FALSE, SHORT_ANSWER hoặc NUMERIC.',
    ],
    [
      'Phương án',
      'Câu trắc nghiệm cần ít nhất option_a và option_b. correct_answer dùng mã A–E; nhiều đáp án ngăn cách bằng dấu phẩy.',
    ],
    [
      'Kiến thức',
      'primaryKnowledgeNodeId phải là ID của một node kiến thức đang hoạt động. Môn, lớp, chương và bài được suy ra từ node này.',
    ],
    [
      'Tự sinh',
      'Mã câu hỏi, trạng thái DRAFT, thời điểm tạo và dấu vết lô nhập được Tú Tài tự động tạo.',
    ],
    [
      'Tùy chọn',
      'external_id, option_e, explanation, difficulty, source_name, source_page và rights_status.',
    ],
  ]);
  guide.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  guide.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  guide.eachRow((row) => {
    row.alignment = { vertical: 'top', wrapText: true };
  });

  const questions = workbook.addWorksheet('Questions', {
    views: [{ state: 'frozen', ySplit: 1 }],
  }) as WorksheetWithRangeValidations;
  questions.addRow([...QUESTION_HEADERS]);
  questions.autoFilter = { from: 'A1', to: `O1` };
  questions.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  questions.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' },
  };
  questions.getRow(1).alignment = { vertical: 'middle', wrapText: true };
  questions.columns = QUESTION_HEADERS.map((header) => ({
    key: header,
    width: header === 'stem' || header.startsWith('option_') || header === 'explanation' ? 34 : 22,
  }));
  questions.dataValidations.add('B2:B5001', {
    type: 'list',
    allowBlank: false,
    formulae: ['"MULTIPLE_CHOICE_SINGLE,MULTIPLE_CHOICE_MULTIPLE,TRUE_FALSE,SHORT_ANSWER,NUMERIC"'],
  });
  questions.dataValidations.add('L2:L5001', {
    type: 'list',
    allowBlank: true,
    formulae: ['"FOUNDATIONAL,INTERMEDIATE,ADVANCED,HIGH_DISCRIMINATION"'],
  });
  questions.dataValidations.add('O2:O5001', {
    type: 'list',
    allowBlank: true,
    formulae: ['"OWNED,PERMISSION_GRANTED,PUBLICLY_AVAILABLE,LICENSED,REVIEW_REQUIRED"'],
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="tu-tai-question-bank-template.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
