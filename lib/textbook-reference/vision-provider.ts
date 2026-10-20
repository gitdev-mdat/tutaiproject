import 'server-only';

import { executeWithAbortableProviderTimeout } from '@/lib/ai/provider-timeout';

/** One multimodal call: page images plus an instruction, answered as JSON text. */
export type VisionProvider = (request: {
  model: string;
  prompt: string;
  images: Buffer[];
  schema: object;
  /** Output budget; a long table of contents needs more than an extraction batch. */
  maxOutputTokens?: number;
}) => Promise<{ text: string; usage?: { input?: number; output?: number } }>;

export const geminiVisionProvider: VisionProvider = async ({
  model,
  prompt,
  images,
  schema,
  maxOutputTokens = 8192,
}) => {
  const { gemini } = await import('@/lib/ai/gemini-client');
  const response = await executeWithAbortableProviderTimeout(
    (signal) =>
      gemini.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              ...images.map((bytes) => ({
                inlineData: { mimeType: 'image/png', data: bytes.toString('base64') },
              })),
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          temperature: 0.1,
          maxOutputTokens,
          abortSignal: signal,
        },
      }),
    120_000
  );
  const usage = (
    response as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }
  ).usageMetadata;
  const finishReason = (response as { candidates?: Array<{ finishReason?: string }> }).candidates?.[0]
    ?.finishReason;
  if (finishReason === 'MAX_TOKENS')
    throw new Error('Gemini response was cut off before it finished (output limit reached).');
  return {
    text: (response as { text?: string }).text ?? '',
    usage: usage
      ? { input: usage.promptTokenCount, output: usage.candidatesTokenCount }
      : undefined,
  };
};

export function visionProviderFor(env = process.env): VisionProvider {
  if (!env.GEMINI_API_KEY)
    throw new Error('GEMINI_API_KEY is not configured for the textbook worker.');
  return geminiVisionProvider;
}
