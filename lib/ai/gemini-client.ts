import 'server-only';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    '[Gemini] GEMINI_API_KEY is not configured. ' +
      'Set it in .env.local (server-side only). ' +
      'Never expose it via NEXT_PUBLIC_* variables.'
  );
}

/**
 * Shared server-side Gemini client.
 *
 * USAGE RULES:
 *   - Only import this file in Server Components, Route Handlers, or Server Actions.
 *   - Never import inside 'use client' files — the `server-only` guard will throw at build time.
 *
 * @example
 * import { gemini } from '@/lib/ai/gemini-client';
 * const response = await gemini.models.generateContent({ model: 'gemini-2.5-flash', ... });
 */
export const gemini = new GoogleGenAI({ apiKey });
