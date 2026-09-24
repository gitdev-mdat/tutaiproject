'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  COGNITIVE_LEVEL_LABELS,
  COGNITIVE_LEVEL_VALUES,
  DIFFICULTY_LABELS,
  DIFFICULTY_VALUES,
  KNOWLEDGE_COVERAGE_LABELS,
  KNOWLEDGE_COVERAGE_VALUES,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_VALUES,
  type CognitiveLevel,
  type Difficulty,
  type KnowledgeCoverage,
  type QuestionOption,
  type TrueFalseStatement,
  type QuestionType,
} from '@/lib/question-bank/qb-types';
import { cn } from '@/lib/utils';
import { KnowledgeNodePicker } from './knowledge-node-picker';

interface ApiValidationDetail {
  field?: string;
  message?: string;
}

interface ApiErrorPayload {
  error?: string;
  details?: ApiValidationDetail[];
  existingId?: string;
  existingCode?: string;
}

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'] as const;

function initialAnswers(): Record<QuestionType, string> {
  return {
    MULTIPLE_CHOICE_SINGLE: '',
    MULTIPLE_CHOICE_MULTIPLE: '',
    TRUE_FALSE: '',
    SHORT_ANSWER: '',
    NUMERIC: '',
  };
}

export function QuestionBankNewClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [duplicate, setDuplicate] = React.useState<ApiErrorPayload | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  const [questionType, setQuestionType] = React.useState<QuestionType>('MULTIPLE_CHOICE_SINGLE');
  const [stem, setStem] = React.useState('');
  const [options, setOptions] = React.useState<QuestionOption[]>([
    { key: 'A', content: '' },
    { key: 'B', content: '' },
    { key: 'C', content: '' },
    { key: 'D', content: '' },
  ]);
  const [answersByType, setAnswersByType] =
    React.useState<Record<QuestionType, string>>(initialAnswers);
  const [explanation, setExplanation] = React.useState('');
  const [solutionGuidance, setSolutionGuidance] = React.useState('');

  const [primaryKnowledgeNodeId, setPrimaryKnowledgeNodeId] = React.useState('');
  const [knowledgeCoverage, setKnowledgeCoverage] = React.useState<KnowledgeCoverage>('FOCUS');
  const [cognitiveLevel, setCognitiveLevel] = React.useState<CognitiveLevel>('COMPREHENSION');
  const [difficulty, setDifficulty] = React.useState<Difficulty>('INTERMEDIATE');

  const correctAnswer = answersByType[questionType];
  const isChoiceQuestion =
    questionType === 'MULTIPLE_CHOICE_SINGLE' || questionType === 'MULTIPLE_CHOICE_MULTIPLE';

  const setCorrectAnswer = (value: string) => {
    setAnswersByType((current) => ({ ...current, [questionType]: value }));
  };

  const fieldError = (...fieldNames: string[]) => {
    for (const fieldName of fieldNames) {
      const exact = fieldErrors[fieldName]?.[0];
      if (exact) return exact;
      const nested = Object.entries(fieldErrors).find(([key]) => key.startsWith(`${fieldName}.`));
      if (nested?.[1][0]) return nested[1][0];
    }
    return undefined;
  };

  const handleOptionChange = (index: number, value: string) => {
    setOptions((current) =>
      current.map((option, optionIndex) =>
        optionIndex === index ? { ...option, content: value } : option
      )
    );
  };

  const handleAddOption = () => {
    setOptions((current) => {
      if (current.length >= OPTION_KEYS.length) return current;
      return [...current, { key: OPTION_KEYS[current.length], content: '' }];
    });
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;

    const remaining = options.filter((_, optionIndex) => optionIndex !== index);
    const keyMap = new Map(
      remaining.map((option, optionIndex) => [option.key, OPTION_KEYS[optionIndex]])
    );
    setOptions(
      remaining.map((option, optionIndex) => ({ ...option, key: OPTION_KEYS[optionIndex] }))
    );
    setAnswersByType((current) => {
      const single = keyMap.get(current.MULTIPLE_CHOICE_SINGLE) ?? '';
      const multiple = current.MULTIPLE_CHOICE_MULTIPLE.split(',')
        .filter(Boolean)
        .map((key) => keyMap.get(key))
        .filter((key): key is (typeof OPTION_KEYS)[number] => Boolean(key))
        .sort()
        .join(',');
      return {
        ...current,
        MULTIPLE_CHOICE_SINGLE: single,
        MULTIPLE_CHOICE_MULTIPLE: multiple,
      };
    });
  };

  const toggleMultipleAnswer = (key: string) => {
    const selected = new Set(correctAnswer.split(',').filter(Boolean));
    if (selected.has(key)) selected.delete(key);
    else selected.add(key);
    setCorrectAnswer([...selected].sort().join(','));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setDuplicate(null);
    setFieldErrors({});

    try {
      const response = await fetch('/api/question-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stem,
          questionType,
          options: isChoiceQuestion ? options : [],
          correctAnswer: questionType === 'TRUE_FALSE'
            ? trueFalseStatements.map((statement) => statement.isTrue ? 'TRUE' : 'FALSE').join(',')
            : correctAnswer,
          trueFalseStatements,
          explanation,
          solutionGuidance: questionType === 'SHORT_ANSWER' ? solutionGuidance : '',
          primaryKnowledgeNodeId,
          knowledgeCoverage,
          cognitiveLevel,
          difficulty,
        }),
      });

      let payload: ApiErrorPayload = {};
      try {
        payload = (await response.json()) as ApiErrorPayload;
      } catch {
        // A status-based message is shown below when the response has no JSON body.
      }

      if (!response.ok) {
        if (response.status === 409 && payload.error === 'DUPLICATE_QUESTION') {
          setDuplicate(payload);
          setError('Câu hỏi này đã có trong ngân hàng. Nội dung bạn nhập vẫn được giữ nguyên.');
          return;
        }

        const nextFieldErrors: Record<string, string[]> = {};
        payload.details?.forEach((detail) => {
          if (!detail.field || !detail.message) return;
          nextFieldErrors[detail.field] = [
            ...(nextFieldErrors[detail.field] ?? []),
            detail.message,
          ];
        });
        setFieldErrors(nextFieldErrors);
        setError(
          payload.details?.find((detail) => detail.message)?.message ||
            (typeof payload.error === 'string' ? payload.error : '') ||
            `Không thể lưu câu hỏi (HTTP ${response.status}).`
        );
        return;
      }

      router.push('/admin/question-bank');
      router.refresh();
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? `Không thể kết nối máy chủ: ${submitError.message}`
          : 'Không thể kết nối máy chủ. Vui lòng thử lại.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const answerError = fieldError('correctAnswer');
  const optionsError = fieldError('options');

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-6xl">
      {error && (
        <div
          role="alert"
          className={cn(
            'mb-6 rounded-lg border p-4 text-sm',
            duplicate
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-red-200 bg-red-50 text-red-700'
          )}
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p>{error}</p>
              {duplicate && (
                <p className="mt-1 font-medium">
                  Câu hiện có: {duplicate.existingCode ?? duplicate.existingId ?? 'không rõ mã'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex flex-1 flex-col gap-6">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Nội dung câu hỏi</h2>
            <div className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="question-type">Loại câu hỏi</Label>
                <select
                  id="question-type"
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  value={questionType}
                  onChange={(event) => setQuestionType(event.target.value as QuestionType)}
                  aria-invalid={Boolean(fieldError('questionType'))}
                >
                  {QUESTION_TYPE_VALUES.map((type) => (
                    <option key={type} value={type}>
                      {QUESTION_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="question-stem">
                  Câu hỏi <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="question-stem"
                  rows={4}
                  placeholder="Nhập nội dung câu hỏi..."
                  value={stem}
                  onChange={(event) => setStem(event.target.value)}
                  aria-invalid={Boolean(fieldError('stem'))}
                />
                {fieldError('stem') && <p className="text-xs text-red-600">{fieldError('stem')}</p>}
              </div>

              {isChoiceQuestion && (
                <div className="grid gap-3 rounded-lg border bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="font-semibold">Các phương án (A–E)</Label>
                    <span className="text-xs text-slate-500">Chọn đáp án đúng bên trái</span>
                  </div>
                  {options.map((option, index) => {
                    const optionError = fieldError(
                      `options.${index}.content`,
                      `options.${index}.key`
                    );
                    const checked = correctAnswer.split(',').includes(option.key);
                    return (
                      <div key={option.key} className="grid gap-1">
                        <div className="flex items-start gap-3">
                          <label
                            className="flex min-h-10 items-center gap-2"
                            aria-label={`Đánh dấu phương án ${option.key} là đáp án đúng`}
                          >
                            <input
                              type={
                                questionType === 'MULTIPLE_CHOICE_SINGLE' ? 'radio' : 'checkbox'
                              }
                              name={
                                questionType === 'MULTIPLE_CHOICE_SINGLE'
                                  ? 'correct-answer'
                                  : undefined
                              }
                              className="size-4"
                              checked={checked}
                              onChange={() =>
                                questionType === 'MULTIPLE_CHOICE_SINGLE'
                                  ? setCorrectAnswer(option.key)
                                  : toggleMultipleAnswer(option.key)
                              }
                            />
                            <span className="w-4 text-sm font-semibold">{option.key}</span>
                          </label>
                          <Input
                            aria-label={`Nội dung phương án ${option.key}`}
                            placeholder={`Phương án ${option.key}...`}
                            value={option.content}
                            onChange={(event) => handleOptionChange(index, event.target.value)}
                            aria-invalid={Boolean(optionError)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-slate-400 hover:text-red-600"
                            onClick={() => handleRemoveOption(index)}
                            disabled={options.length <= 2}
                            aria-label={`Xóa phương án ${option.key}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        {optionError && <p className="pl-10 text-xs text-red-600">{optionError}</p>}
                      </div>
                    );
                  })}
                  {(answerError || optionsError) && (
                    <p className="text-xs text-red-600">{answerError ?? optionsError}</p>
                  )}
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddOption}
                      disabled={options.length >= OPTION_KEYS.length}
                    >
                      <Plus className="mr-2 size-4" />
                      {options.length >= OPTION_KEYS.length
                        ? 'Đã đủ 5 phương án'
                        : 'Thêm phương án'}
                    </Button>
                  </div>
                </div>
              )}

              {questionType === 'TRUE_FALSE' && (
                <div className="grid gap-3 rounded-lg border bg-slate-50 p-4">
                  <div>
                    <Label className="font-semibold">Các mệnh đề Đúng / Sai</Label>
                    <p className="mt-1 text-xs text-slate-500">Mỗi mệnh đề có đáp án riêng.</p>
                  </div>
                  {trueFalseStatements.map((statement, index) => (
                    <div key={statement.id} className="grid gap-1 sm:grid-cols-[1fr_150px]">
                      <Input
                        aria-label={`Mệnh đề ${index + 1}`}
                        placeholder={`Mệnh đề ${index + 1}`}
                        value={statement.content}
                        onChange={(event) => setTrueFalseStatements((current) => current.map((item) => item.id === statement.id ? { ...item, content: event.target.value } : item))}
                      />
                      <div className="grid grid-cols-2 gap-1">
                        <Button type="button" size="sm" variant={statement.isTrue ? 'default' : 'outline'} onClick={() => setTrueFalseStatements((current) => current.map((item) => item.id === statement.id ? { ...item, isTrue: true } : item))}>Đúng</Button>
                        <Button type="button" size="sm" variant={!statement.isTrue ? 'default' : 'outline'} onClick={() => setTrueFalseStatements((current) => current.map((item) => item.id === statement.id ? { ...item, isTrue: false } : item))}>Sai</Button>
                      </div>
                    </div>
                  ))}
                  {fieldError('trueFalseStatements') && <p className="text-xs text-red-600">{fieldError('trueFalseStatements')}</p>}
                </div>
              )}

              {questionType === 'SHORT_ANSWER' && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="reference-answer">
                      Đáp án tham khảo <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="reference-answer"
                      rows={5}
                      placeholder="Nhập đáp án tham khảo; có thể trình bày nhiều dòng cho câu tự luận..."
                      value={correctAnswer}
                      onChange={(event) => setCorrectAnswer(event.target.value)}
                      aria-invalid={Boolean(answerError)}
                    />
                    {answerError && <p className="text-xs text-red-600">{answerError}</p>}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="solution-guidance">Hướng dẫn giải từng bước</Label>
                    <Textarea
                      id="solution-guidance"
                      rows={5}
                      placeholder="Bước 1...&#10;Bước 2..."
                      value={solutionGuidance}
                      onChange={(event) => setSolutionGuidance(event.target.value)}
                      aria-invalid={Boolean(fieldError('solutionGuidance'))}
                    />
                    {fieldError('solutionGuidance') && (
                      <p className="text-xs text-red-600">{fieldError('solutionGuidance')}</p>
                    )}
                  </div>
                </>
              )}

              {questionType === 'NUMERIC' && (
                <div className="grid gap-2">
                  <Label htmlFor="numeric-answer">
                    Đáp án số <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="numeric-answer"
                    type="text"
                    inputMode="decimal"
                    placeholder="Ví dụ: -3.5"
                    value={correctAnswer}
                    onChange={(event) => setCorrectAnswer(event.target.value)}
                    aria-invalid={Boolean(answerError)}
                  />
                  {answerError && <p className="text-xs text-red-600">{answerError}</p>}
                </div>
              )}

              {questionType !== 'SHORT_ANSWER' && (
                <div className="grid gap-2 pt-1">
                  <Label htmlFor="explanation">Lời giải / Giải thích</Label>
                  <Textarea
                    id="explanation"
                    rows={4}
                    placeholder="Giải thích chi tiết các bước làm..."
                    value={explanation}
                    onChange={(event) => setExplanation(event.target.value)}
                    aria-invalid={Boolean(fieldError('explanation'))}
                  />
                  {fieldError('explanation') && (
                    <p className="text-xs text-red-600">{fieldError('explanation')}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-6 lg:w-80">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Phân loại & Thuộc tính</h2>
            <div className="grid gap-5">
              <div className="grid gap-2">
                <Label>
                  Kiến thức chính <span className="text-red-500">*</span>
                </Label>
                <KnowledgeNodePicker
                  value={primaryKnowledgeNodeId}
                  onChange={(id) => setPrimaryKnowledgeNodeId(id)}
                />
                {fieldError('primaryKnowledgeNodeId') ? (
                  <p className="text-xs text-red-600">{fieldError('primaryKnowledgeNodeId')}</p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Môn học, lớp và chương được suy ra từ mục kiến thức này.
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="knowledge-coverage">Mức bao phủ</Label>
                <select
                  id="knowledge-coverage"
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  value={knowledgeCoverage}
                  onChange={(event) =>
                    setKnowledgeCoverage(event.target.value as KnowledgeCoverage)
                  }
                  aria-invalid={Boolean(fieldError('knowledgeCoverage'))}
                >
                  {KNOWLEDGE_COVERAGE_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {KNOWLEDGE_COVERAGE_LABELS[value]}
                    </option>
                  ))}
                </select>
                {fieldError('knowledgeCoverage') && (
                  <p className="text-xs text-red-600">{fieldError('knowledgeCoverage')}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="difficulty">Độ khó</Label>
                <select
                  id="difficulty"
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value as Difficulty)}
                  aria-invalid={Boolean(fieldError('difficulty'))}
                >
                  {DIFFICULTY_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {DIFFICULTY_LABELS[value]}
                    </option>
                  ))}
                </select>
                {fieldError('difficulty') && (
                  <p className="text-xs text-red-600">{fieldError('difficulty')}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cognitive-level">Mức độ tư duy</Label>
                <select
                  id="cognitive-level"
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  value={cognitiveLevel}
                  onChange={(event) => setCognitiveLevel(event.target.value as CognitiveLevel)}
                  aria-invalid={Boolean(fieldError('cognitiveLevel'))}
                >
                  {COGNITIVE_LEVEL_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {COGNITIVE_LEVEL_LABELS[value]}
                    </option>
                  ))}
                </select>
                {fieldError('cognitiveLevel') && (
                  <p className="text-xs text-red-600">{fieldError('cognitiveLevel')}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => router.back()}
              disabled={submitting}
            >
              Hủy
            </Button>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Đang lưu...' : error ? 'Thử lưu lại' : 'Lưu câu hỏi'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
