'use client';

/**
 * Optional, off by default: a soft two-note chime for a right answer and a
 * low note for a miss, synthesised with Web Audio (no audio files).
 */

const KEY = 'tutai:lesson-sound';

export function readSoundSetting(): boolean {
  try {
    return window.localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export function writeSoundSetting(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // Private mode: the setting lasts for this visit only.
  }
}

let context: AudioContext | null = null;

export function playChime(kind: 'correct' | 'miss' | 'complete') {
  try {
    const Audio =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return;
    context ??= new Audio();
    const notes =
      kind === 'correct' ? [660, 880] : kind === 'complete' ? [523, 659, 784, 1047] : [220];
    notes.forEach((frequency, index) => {
      const at = context!.currentTime + index * 0.09;
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      oscillator.type = kind === 'miss' ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.08, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      oscillator.connect(gain).connect(context!.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.25);
    });
  } catch {
    // Sound is a nicety; never let it break the lesson.
  }
}

/**
 * The reward sounds of the completion screen, small local files (no
 * hotlinking): public/sounds/lesson-complete.mp3 (a rising bell arpeggio,
 * 1.6 s) and public/sounds/streak-up.mp3 (a brighter lift, 1 s, only when a
 * new streak day is confirmed). Both were made for Tú Tài by
 * scripts/sounds/make-lesson-sounds.py, so there is no third-party licence;
 * replacing them is a file swap.
 *
 * A sound never overlaps itself: playing it again restarts it. The streak
 * accent lands on the tail of the completion bells, by design. The promise is
 * false when the browser blocked playback (autoplay rules); nothing else
 * changes.
 */
const REWARDS = {
  complete: '/sounds/lesson-complete.mp3',
  streak: '/sounds/streak-up.mp3',
} as const;

const playing: Partial<Record<keyof typeof REWARDS, HTMLAudioElement>> = {};

export async function playReward(kind: keyof typeof REWARDS): Promise<boolean> {
  try {
    playing[kind]?.pause();
    const audio = new Audio(REWARDS[kind]);
    audio.volume = kind === 'complete' ? 0.5 : 0.45;
    playing[kind] = audio;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

/** Fetches the reward sounds ahead of the last part, so they start on time. */
export function preloadRewards() {
  for (const src of Object.values(REWARDS)) {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = src;
  }
}
