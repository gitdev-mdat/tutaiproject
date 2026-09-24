import type { CurriculumExamSet, Difficulty, ExamSet, ExamType } from './types';

function examTypeForScope(scope: CurriculumExamSet['scope']): ExamType {
  switch (scope) {
    case 'LESSON':
      return 'PRACTICE';
    case 'CHAPTER':
      return 'TOPIC';
    case 'SEMESTER':
      return 'FINAL';
    case 'NATIONAL':
      return 'THPT_NATIONAL';
  }
}

function difficultyFor(examSet: CurriculumExamSet): Difficulty {
  if (examSet.difficultyLabel === 'Nền tảng') return 'FOUNDATIONAL';
  if (examSet.difficultyLabel === 'Vận dụng') return 'ADVANCED';
  return 'INTERMEDIATE';
}

export function curriculumExamSetToDetail(examSet: CurriculumExamSet): ExamSet {
  const isSpecial = examSet.tier === 'SPECIAL';
  const difficulty = difficultyFor(examSet);

  return {
    id: examSet.id,
    slug: examSet.slug,
    title: examSet.title,
    description: examSet.description,
    subjectId: examSet.subjectId,
    grade: examSet.grade,
    examType: examTypeForScope(examSet.scope),
    difficulty,
    accessTier: examSet.access,
    sourceType: 'TUTAI_EDITORIAL',
    authorName: examSet.teacherOrSource ?? 'Tổ biên soạn Tú Tài',
    verifiedSource: true,
    examCount: 1,
    questionCount: examSet.questionCount,
    estimatedDuration: `${examSet.durationMinutes} phút`,
    tags: [examSet.difficultyLabel ?? 'Luyện tập', 'Toán 12'],
    exams: [
      {
        id: examSet.id,
        title: examSet.title,
        order: 1,
        difficulty,
        duration: `${examSet.durationMinutes} phút`,
        questionCount: examSet.questionCount,
        previewAvailable: examSet.access === 'FREE',
      },
    ],
    intendedFor: isSpecial
      ? [
          'đã làm quen với các đề tiêu chuẩn trong cùng phạm vi',
          'muốn nhận diện kiến thức trong cách diễn đạt hoặc ngữ cảnh mới',
          'muốn giảm bất ngờ khi dữ kiện được trình bày khác bài tập quen thuộc',
        ]
      : [
          'muốn luyện đúng phạm vi kiến thức đang học',
          'cần kiểm tra tiến độ trước khi chuyển sang phạm vi rộng hơn',
        ],
    features: isSpecial
      ? [
          {
            title: 'Cách diễn đạt ít gặp',
            description:
              'Kiến thức quen thuộc xuất hiện qua cách hỏi khác với bài luyện tập thông thường.',
          },
          {
            title: 'Dữ kiện và ngữ cảnh mới',
            description:
              'Cách trình bày dữ liệu giúp em luyện khả năng nhận diện thay vì chỉ ghi nhớ công thức.',
          },
        ]
      : undefined,
    specialTags: isSpecial
      ? [
          'Cách hỏi khác với bài tập quen thuộc',
          'Dữ kiện được trình bày theo hình thức ít gặp',
          'Phối hợp khái niệm trong ngữ cảnh mới',
        ]
      : undefined,
    isSpecial,
    specialReason: isSpecial ? 'UNCOMMON_QUESTION_PATTERNS' : undefined,
    previewEnabled: examSet.access === 'FREE',
    published: true,
  };
}
