'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { QuestionPrompt } from '@/components/shared/question-content-renderer';
import { withSolutionGuide } from '@/lib/calculator-tutor/registry';
import {
  gradePracticeResponse,
  type PracticeFeedback,
  parsePracticeResponse,
  toPracticeFeedback,
  toPracticeQuestion,
} from '@/lib/practice/grading';
import {
  isComplete,
  QuestionBody,
  FeedbackPanel,
  TYPE_HINT,
  type Answer,
} from '@/features/lessons/components/practice-session';
import type { Question } from '@/lib/question-bank/qb-types';

/**
 * The Student question renderer, answer interaction and feedback, in memory:
 * the Admin sees exactly what a student would, and nothing is stored.
 */
export function StudentPreview({
  questions,
  onClose,
}: {
  questions: Question[];
  onClose: () => void;
}) {
  const [index, setIndex] = React.useState(0);
  const [answer, setAnswer] = React.useState<Answer>();
  const [feedback, setFeedback] = React.useState<PracticeFeedback>();
  const question = questions[index];
  const practiceQuestion = toPracticeQuestion(question);

  function checkAnswer() {
    try {
      const response = parsePracticeResponse(question, answer);
      setFeedback(
        withSolutionGuide(
          toPracticeFeedback(question, response, gradePracticeResponse(question, response)),
          question,
          'admin'
        )
      );
    } catch {
      setFeedback(undefined);
    }
  }

  function move(next: number) {
    setIndex(next);
    setAnswer(undefined);
    setFeedback(undefined);
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-3 sm:p-6"
      data-testid="student-preview"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Xem trước như học sinh"
        className="mx-auto my-4 w-full max-w-3xl rounded-2xl bg-slate-50 shadow-2xl sm:my-8"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-semibold text-blue-700">Xem trước như học sinh</p>
            <p className="text-xs text-slate-500">
              Bản xem thử không tạo lượt làm hay lưu tiến độ.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng xem trước"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="p-4 sm:p-6">
          {questions.length > 1 && (
            <label className="mb-4 block text-xs font-semibold text-slate-600">
              Câu hỏi
              <select
                value={index}
                onChange={(event) => move(Number(event.target.value))}
                className="ml-2 h-9 max-w-[75%] rounded-lg border border-slate-300 bg-white px-2 text-sm"
                data-testid="preview-question-select"
              >
                {questions.map((entry, i) => (
                  <option key={entry.id} value={i}>
                    {entry.textbookSource?.questionNumber
                      ? `Câu ${entry.textbookSource.questionNumber} · ${entry.code}`
                      : entry.code}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div
            className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
            data-testid="preview-practice-question"
          >
            <p className="text-[13px] font-semibold text-blue-700">
              {TYPE_HINT[practiceQuestion.type]}
            </p>
            <div className="mt-2 text-[17px] font-semibold leading-8 text-slate-900 sm:text-lg">
              <QuestionPrompt
                questionId={practiceQuestion.id}
                stem={practiceQuestion.stem}
                content={practiceQuestion.content}
              />
            </div>
            <div className="mt-5">
              <QuestionBody
                question={practiceQuestion}
                answer={answer}
                feedback={feedback}
                setAnswer={setAnswer}
              />
            </div>
            {feedback && <FeedbackPanel feedback={feedback} audience="admin" />}
          </div>
          <div className="mt-4 flex flex-col-reverse justify-between gap-2 sm:flex-row">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => move(index - 1)}
                className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold disabled:opacity-40"
              >
                Câu trước
              </button>
              <button
                type="button"
                disabled={index === questions.length - 1}
                onClick={() => move(index + 1)}
                className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold disabled:opacity-40"
              >
                Câu tiếp
              </button>
            </div>
            {!feedback && (
              <button
                type="button"
                disabled={!isComplete(practiceQuestion, answer)}
                onClick={checkAnswer}
                className="h-11 rounded-xl bg-blue-700 px-5 text-sm font-bold text-white disabled:bg-slate-300"
                data-testid="preview-submit"
              >
                Kiểm tra câu trả lời
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
