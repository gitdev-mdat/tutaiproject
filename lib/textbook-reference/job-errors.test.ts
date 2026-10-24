import { describe, expect, it } from 'vitest';
import { describeJobError } from './job-errors';

const gemini = (code: number, status: string, message = '') =>
  new Error(JSON.stringify({ error: { code, status, message } }));

describe('describeJobError', () => {
  it('treats HTTP 402 as a billing problem that retrying cannot fix', () => {
    const described = describeJobError(
      gemini(402, 'RESOURCE_EXHAUSTED', 'Prepayment credits are depleted.')
    );
    expect(described).toMatchObject({ code: 'BILLING', retryable: false });
    expect(described.message).toMatch(/thanh toán/);
    expect(described.message).not.toMatch(/HTTP|RESOURCE_EXHAUSTED/);
    expect(described.detail).toBe(
      'Gemini HTTP 402 RESOURCE_EXHAUSTED: Prepayment credits are depleted.'
    );
  });

  it('treats HTTP 429 as a temporary rate limit', () => {
    expect(describeJobError(gemini(429, 'RESOURCE_EXHAUSTED'))).toMatchObject({
      code: 'QUOTA',
      retryable: true,
    });
  });

  it('separates key, model and outage failures', () => {
    expect(describeJobError(gemini(403, 'PERMISSION_DENIED')).code).toBe('AUTH');
    expect(describeJobError(gemini(400, 'INVALID_ARGUMENT', 'API key not valid.')).code).toBe(
      'AUTH'
    );
    expect(describeJobError(gemini(404, 'NOT_FOUND')).code).toBe('MODEL');
    expect(describeJobError(gemini(503, 'UNAVAILABLE'))).toMatchObject({
      code: 'UNAVAILABLE',
      retryable: true,
    });
  });

  it('recognises timeouts, interruptions, checksum and output-limit errors', () => {
    expect(describeJobError(Object.assign(new Error('t'), { code: 'TIMEOUT' })).code).toBe(
      'TIMEOUT'
    );
    expect(describeJobError(Object.assign(new Error('i'), { code: 'INTERRUPTED' })).code).toBe(
      'INTERRUPTED'
    );
    const checksum = Object.assign(new Error('mismatch'), { name: 'TextbookChecksumError' });
    expect(describeJobError(checksum)).toMatchObject({ code: 'FILE', retryable: false });
    expect(
      describeJobError(
        new Error('Gemini response was cut off before it finished (output limit reached).')
      ).code
    ).toBe('OUTPUT_LIMIT');
  });

  it('keeps the real reason of an unknown error in the diagnostics, not the message', () => {
    const described = describeJobError(new Error('connect ECONNREFUSED'));
    expect(described.code).toBe('UNKNOWN');
    expect(described.detail).toContain('connect ECONNREFUSED');
    expect(described.message).not.toContain('ECONNREFUSED');
  });

  it('classifies an unusable answer and an unreadable scan instead of "unknown"', () => {
    const invalid = describeJobError(
      Object.assign(new Error('Gemini returned 0 items, none valid'), { code: 'INVALID_RESPONSE' })
    );
    expect(invalid).toMatchObject({ code: 'INVALID_RESPONSE', retryable: true });
    expect(invalid.message).not.toMatch(/Gemini returned/);
    expect(
      describeJobError(Object.assign(new Error('p.19 UNREADABLE'), { code: 'UNREADABLE' }))
    ).toMatchObject({ code: 'UNREADABLE', retryable: false });
  });
});
