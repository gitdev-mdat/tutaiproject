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
