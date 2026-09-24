export class ProviderTimeoutError extends Error {
  readonly code = 'TIMEOUT';
  readonly retryable = true;

  constructor(message = 'Provider request timed out') {
    super(message);
    this.name = 'ProviderTimeoutError';
  }
}

export async function executeWithAbortableProviderTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const request = operation(controller.signal);
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutError = new ProviderTimeoutError();
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(timeoutError);
      controller.abort(timeoutError);
    }, timeoutMs);
  });

  try {
    return await Promise.race([request, timeout]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
