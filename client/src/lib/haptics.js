/**
 * Haptic phonics feedback (Vibration API — mobile browsers).
 *
 * The cue is a *reward*, never a correction: a word read correctly gets a
 * short double tap, and hard words (consonant blends, digraphs, three or more
 * syllables) get a slightly longer, distinct pattern so the student can feel
 * the difference between "good" and "great".
 */

let enabled = true;

export function setHapticsEnabled(value) {
  enabled = Boolean(value);
}

export function hapticsSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** Returns true when a pattern was actually sent to the device. */
export function buzz(pattern) {
  if (!enabled || !hapticsSupported()) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export const HAPTIC = {
  /** Every correctly read word — a tiny acknowledgement. */
  word: 10,
  /** A hard word read correctly — the celebration pattern. */
  hardWord: [16, 40, 16, 40, 26],
  /** A word read after asking for help. */
  helped: [30],
  /** Something needs attention, but gently. */
  gentle: [8, 60, 8],
};
