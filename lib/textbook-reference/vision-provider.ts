import 'server-only';

import { executeWithAbortableProviderTimeout } from '@/lib/ai/provider-timeout';

/** One multimodal call: page images plus an instruction, answered as JSON text. */
export type VisionProvider = (request: {
  model: string;
  prompt: string;
  images: Buffer[];
  schema: object;
}) => Promise<{ text: string; usage?: { input?: number; output?: number } }>;

export const geminiVisionProvider: VisionProvider = async ({ model, prompt, images, schema }) => {
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
          maxOutputTokens: 8192,
          abortSignal: signal,
        },
      }),
    120_000
  );
  const usage = (
    response as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }
  ).usageMetadata;
  return {
    text: (response as { text?: string }).text ?? '',
    usage: usage ? { input: usage.promptTokenCount, output: usage.candidatesTokenCount } : undefined,
  };
};

export function visionProviderFor(env = process.env): VisionProvider {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured for the textbook worker.');
  return geminiVisionProvider;
}
