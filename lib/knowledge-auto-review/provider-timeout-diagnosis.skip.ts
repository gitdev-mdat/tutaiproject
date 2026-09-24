import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiProviderError, type KnowledgeAutoReviewInput } from '@/lib/ai/ai-types';
import {
  DEFAULT_KNOWLEDGE_REVIEW_PROVIDER_TIMEOUT_MS,
  executeWithAbortableProviderTimeout,
  knowledgeReviewProviderTimeoutMs,
} from '@/lib/ai/provider-timeout';
import { GeminiKnowledgeReviewProvider } from '@/lib/ai/providers/gemini-provider';

const { generateContentMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
}));

vi.mock('@/lib/ai/gemini-client', () => ({
  gemini: {
    models: {
      generateContent: generateContentMock,
    },
  },
}));

describe('Knowledge Auto-Review provider timeout', () => {
  afterEach(() => {
    vi.useRealTimers();
    generateContentMock.mockReset();
  });

  it('uses a 120-second infrastructure default and accepts a positive override', () => {
    expect(DEFAULT_KNOWLEDGE_REVIEW_PROVIDER_TIMEOUT_MS).toBe(120_000);
    expect(knowledgeReviewProviderTimeoutMs(undefined)).toBe(120_000);
    expect(knowledgeReviewProviderTimeoutMs('90000')).toBe(90_000);
    expect(knowledgeReviewProviderTimeoutMs('invalid')).toBe(120_000);
    expect(knowledgeReviewProviderTimeoutMs('0')).toBe(120_000);
  });

  it('returns a provider result below the deadline and clears the abort timer', async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    let calls = 0;
    const result = executeWithAbortableProviderTimeout((signal) => {
      calls += 1;
      capturedSignal = signal;
      return new Promise<string>((resolve) => setTimeout(() => resolve('ok'), 99));
    }, 100);

    await vi.advanceTimersByTimeAsync(99);
    await expect(result).resolves.toBe('ok');
    expect(calls).toBe(1);
    expect(capturedSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(capturedSignal?.aborted).toBe(false);
  });

  it('allows a result scheduled at the deadline before the local timer', async () => {
    vi.useFakeTimers();
    const result = executeWithAbortableProviderTimeout(
      () => new Promise<string>((resolve) => setTimeout(() => resolve('edge'), 100)),
      100
    );

    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe('edge');
  });

  it('classifies an above-deadline provider as TIMEOUT and propagates abort', async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    let abortReason: unknown;
    let calls = 0;
    const result = executeWithAbortableProviderTimeout((signal) => {
      calls += 1;
      capturedSignal = signal;
      signal.addEventListener('abort', () => {
        abortReason = signal.reason;
      });
      return new Promise<string>((resolve) => setTimeout(() => resolve('late'), 101));
    }, 100);
    const rejection = expect(result).rejects.toMatchObject({
      code: 'TIMEOUT',
      message: 'Gemini request timed out',
      retryable: true,
    });

    await vi.advanceTimersByTimeAsync(100);
    await rejection;
    expect(calls).toBe(1);
    expect(capturedSignal?.aborted).toBe(true);
    expect(abortReason).toBeInstanceOf(AiProviderError);
  });

  it('still enforces the deadline if a provider ignores the abort signal', async () => {
    vi.useFakeTimers();
    const result = executeWithAbortableProviderTimeout(
      () => new Promise<string>((resolve) => setTimeout(() => resolve('ignored'), 200)),
      100
    );
    const rejection = expect(result).rejects.toMatchObject({
      code: 'TIMEOUT',
      retryable: true,
    });

    await vi.advanceTimersByTimeAsync(100);
    await rejection;
  });

  it('passes the abort signal into the Gemini SDK and invokes it only once', async () => {
    vi.useFakeTimers();
    let sdkSignal: AbortSignal | undefined;
    generateContentMock.mockImplementation(
      (request: { config?: { abortSignal?: AbortSignal } }) => {
        sdkSignal = request.config?.abortSignal;
        return new Promise((_resolve, reject) => {
          sdkSignal?.addEventListener('abort', () => reject(sdkSignal?.reason), { once: true });
        });
      }
    );
    const provider = new GeminiKnowledgeReviewProvider('gemini-3.5-flash', 100);
    const result = provider.reviewKnowledgeCandidates({
      semanticRecords: [],
      existingConceptCandidates: [],
    } as unknown as KnowledgeAutoReviewInput);
    const rejection = expect(result).rejects.toMatchObject({
      code: 'TIMEOUT',
      retryable: true,
    });

    await vi.advanceTimersByTimeAsync(100);
    await rejection;
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    expect(sdkSignal?.aborted).toBe(true);
  });
});
