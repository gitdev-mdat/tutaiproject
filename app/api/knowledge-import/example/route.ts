import { NextResponse } from 'next/server';

export async function GET() {
  const example = {
    schemaVersion: '1.0',
    source: {
      title: 'Pilot Toán 12',
      organization: 'Tú Tài',
      version: '2026-pilot',
    },
    subjects: [
      {
        sourceKey: 'math',
        title: 'Toán học',
        grades: [
          {
            sourceKey: 'math-12',
            title: 'Lớp 12',
            gradeNumber: 12,
            domains: [
              {
                sourceKey: 'calculus',
                title: 'Nguyên hàm và tích phân',
                description: '',
              },
            ],
          },
        ],
      },
    ],
    concepts: [
      {
        sourceKey: 'antiderivative',
        title: 'Nguyên hàm',
        aliases: ['Nguyên hàm của hàm số'],
        primaryDomainSourceKey: 'calculus',
        shortDescription: '',
        detailedDescription: '',
        learningObjectives: [
          {
            sourceKey: 'antiderivative-remember-1',
            bloomLevel: 'REMEMBER',
            statement: 'Nhận biết được một hàm số là nguyên hàm của hàm số đã cho.',
            order: 1,
          },
        ],
      },
      {
        sourceKey: 'integral',
        title: 'Tích phân',
        aliases: [],
        primaryDomainSourceKey: 'calculus',
        learningObjectives: [
          {
            sourceKey: 'integral-understand-1',
            bloomLevel: 'UNDERSTAND',
            statement: 'Hiểu ý nghĩa hình học của tích phân.',
          },
        ],
      },
      {
        sourceKey: 'substitution-method',
        title: 'Phương pháp đổi biến',
        aliases: [],
        primaryDomainSourceKey: 'calculus',
      },
      {
        // Suspicious action-oriented Concept
        sourceKey: 'solve-antiderivative',
        title: 'Giải bài tập nguyên hàm cơ bản',
        primaryDomainSourceKey: 'calculus',
      },
    ],
    relations: [
      {
        sourceKey: 'rel-1',
        type: 'PREREQUISITE',
        sourceConceptSourceKey: 'antiderivative',
        targetConceptSourceKey: 'substitution-method',
      },
    ],
  };

  return NextResponse.json(example);
}
