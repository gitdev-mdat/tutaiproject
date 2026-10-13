'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import {
  FeedbackPanel,
  QuestionBody,
  TYPE_HINT,
  isComplete,
  type Answer,
} from '@/features/lessons/components/practice-session';
import type { PracticeFeedback, PracticeQuestion } from '@/lib/practice/grading';
import { InlineText } from './rich-text';

/**
 * Quick questions inside the lesson, taken from the lesson's own published
 * practice questions. The server grades each answer and returns the admin's
 * worked solution; nothing is stored, so this is a check, not a score.
 */
export function QuickCheck({
  lessonId,
  questions,
  onAnswered,
}: {
  lessonId: string;
  questions: PracticeQuestion[];
  /** Called with the number of questions answered so far. */
  onAnswered?: (count: number) => void;
}) {
  const [feedback, setFeedback] = React.useState<Record<string, PracticeFeedback>>({});
  const answered = Object.keys(feedback).length;
  React.useEffect(() => {
    if (answered) onAnswered?.(answered);
  }, [answered, onAnswered]);

  return (
    <ol className="space-y-6">
      {questions.map((question, index) => (
        <li key={question.id}>
          <CheckQuestion
            lessonId={lessonId}
            question={question}
            number={questions.length > 1 ? index + 1 : null}
            feedback={feedback[question.id]}
            onFeedback={(result) =>
              setFeedback((current) => ({ ...current, [question.id]: result }))
            }
          />
        </li>
      ))}
    </ol>
  );
}

function CheckQuestion({
  lessonId,
  question,
  number,
  feedback,
  onFeedback,
}: {
  lessonId: string;
  question: PracticeQuestion;
  number: number | null;
  feedback: PracticeFeedback | undefined;
  onFeedback: (feedback: PracticeFeedback) => void;
}) {
  const [answer, setAnswer] = React.useState<Answer>(undefined);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const feedbackId = `check-feedback-${question.id}`;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/student/lessons/${encodeURIComponent(lessonId)}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, response: answer }),
      });
      const body = (await response.json().catch(() => ({}))) as PracticeFeedback & {
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? 'Chưa chấm được câu này. Em thử lại nhé.');
      onFeedback(body);
      window.requestAnimationFrame(() => document.getElementById(feedbackId)?.focus());
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="quick-check" data-answered={!!feedback}>
      <p className="text-[13px] font-semibold text-slate-500">
        {number ? `Câu ${number} · ` : ''}
        {TYPE_HINT[question.type]}
      </p>
      <div className="mt-1.5 text-[17px] font-medium leading-8 text-[#091224]">
        <InlineText text={question.stem} />
      </div>
      <div className="mt-4">
        <QuestionBody
          question={question}
          answer={answer}
          setAnswer={setAnswer}
          feedback={feedback}
        />
      </div>
      {!feedback && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!isComplete(question, answer) || busy}
            onClick={() => void submit()}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#091224] px-5 text-[15px] font-bold text-white transition hover:bg-[#1c2740] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
            data-testid="check-submit"
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Kiểm tra
          </button>
          {error && (
            <p role="alert" className="text-sm font-medium text-rose-700">
              {error}
            </p>
          )}
        </div>
      )}
      {feedback && <FeedbackPanel feedback={feedback} id={feedbackId} />}
    </div>
  );
}
