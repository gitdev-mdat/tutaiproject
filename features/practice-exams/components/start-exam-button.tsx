'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { examAttemptHref } from '../lib/links';

/** Starts (or resumes) the exam on the server, then opens the attempt. */
export function StartExamButton({
  examId,
  label,
  plus,
}: {
  examId: string;
  label: string;
  plus: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/student/exams/${encodeURIComponent(examId)}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const body = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!response.ok || !body.id)
        throw new Error(body.error ?? 'Không bắt đầu được. Em thử lại nhé.');
      router.push(examAttemptHref(body.id));
    } catch (cause) {
      setError((cause as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy}
        className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-bold disabled:opacity-60 ${
          plus
            ? 'bg-[#0A1F5C] text-white hover:bg-[#15307A]'
            : 'bg-[#0052FF] text-white hover:bg-[#0044CC]'
        }`}
        data-testid="exam-start"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {label}
        {!busy && <ArrowRight className="size-4" aria-hidden="true" />}
      </button>
      {error && (
        <p
          className="text-sm font-medium text-rose-700"
          role="alert"
          data-testid="exam-start-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}
