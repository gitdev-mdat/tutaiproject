/**
 * Static message loader for Vietnamese (vi) locale.
 * All user-facing Vietnamese strings must be accessed through this module.
 * This avoids hard-coding strings in page and component files.
 *
 * Usage:
 *   import { msg } from '@/messages/vi'
 *   <h1>{msg.home.hero.headline}</h1>
 *
 * For runtime locale switching, extend this pattern with
 * a locale parameter and a lookup map (e.g., Next.js App Router i18n).
 */

import homeMessages from './home.json';

const localeMessages = {
  vi: homeMessages,
} as const;

type Locale = keyof typeof localeMessages;
export const supportedLocales: Locale[] = ['vi'];
export const defaultLocale: Locale = 'vi';

/**
 * Get a nested message value by dot-notation path.
 * Throws if the key is not found in development.
 */
export function msg(key: string, locale: Locale = defaultLocale): string {
  const keys = key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = localeMessages[locale];
  for (const k of keys) {
    if (value == null || typeof value !== 'object') {
      throw new Error(`[messages] Key not found: "${key}"`);
    }
    value = value[k];
  }
  if (typeof value !== 'string') {
    throw new Error(`[messages] Key "${key}" is not a string (got: ${typeof value})`);
  }
  return value;
}

/**
 * Get a full section object by top-level key (e.g. "home.hero").
 * Returns the nested object directly — callers can destructure.
 */
export function msgSection(key: string, locale: Locale = defaultLocale): Record<string, unknown> {
  const keys = key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = localeMessages[locale];
  for (const k of keys) {
    if (value == null || typeof value !== 'object') {
      throw new Error(`[messages] Section not found: "${key}"`);
    }
    value = value[k];
  }
  if (typeof value !== 'object' || value === null) {
    throw new Error(`[messages] Section "${key}" is not an object`);
  }
  return value as Record<string, unknown>;
}

export { localeMessages as messages };
