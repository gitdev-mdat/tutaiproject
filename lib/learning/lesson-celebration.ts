/**
 * When the end of a lesson celebrates. The celebration (a short firework and
 * the completion bells) belongs to one moment: the student finishing the last
 * part for the first time. It is never replayed: not on a refresh, not when the
 * lesson is reopened, not when the student steps back a part and returns to
 * the end. A learned lesson opens on a calm summary instead.
 */

export interface Celebration {
  /** 0 for none; any other value is the one play of this page view. */
  run: number;
  /** When it started (Date.now()), to time the streak after the fireworks. */
  at: number;
}

export const NO_CELEBRATION: Celebration = { run: 0, at: 0 };

/**
 * Whether moving on to part `next` finishes the lesson for the first time:
 * it is the last part, it was not open yet, the lesson was not already
 * learned (saved progress), and this page view has not celebrated before.
 */
export function isFirstCompletion({
  next,
  last,
  opened,
  learned,
  celebrated,
}: {
  next: number;
  last: number;
  opened: number;
  learned: boolean;
  celebrated: boolean;
}): boolean {
  return next === last && next > opened && !learned && !celebrated;
}

/**
 * The celebration once the student shows part `index`. It is spent as soon as
 * they leave the last part, so coming back finds the calm summary.
 */
export function afterNavigation(
  celebration: Celebration,
  index: number,
  last: number
): Celebration {
  return index === last ? celebration : NO_CELEBRATION;
}

/**
 * The lesson sound (answer chimes and the completion bells) is on unless the
 * student turned it off on this device (the stored value `'off'`). Browsers may still block it before any
 * interaction; finishing a part is a click, so in practice it plays.
 */
export function soundSettingOn(stored: string | null): boolean {
  return stored !== 'off';
}
