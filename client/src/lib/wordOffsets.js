/**
 * Maps word indexes to character offsets in the raw document text.
 * Speech synthesis reports progress as a character index, so this bridge is
 * what makes word-sync highlighting line up with what is being spoken.
 */

export function buildWordOffsets(doc) {
  const offsets = new Array(doc?.words?.length || 0).fill(0);
  if (!doc?.segments) return offsets;
  let pos = 0;
  for (const seg of doc.segments) {
    if (seg.type === 'word' && Number.isInteger(seg.wi)) offsets[seg.wi] = pos;
    pos += seg.text.length;
  }
  return offsets;
}

/** Which word starts at (or just before) a character index. */
export function wordAtChar(offsets, charIndex) {
  if (!offsets?.length) return 0;
  let lo = 0;
  let hi = offsets.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] <= charIndex) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/** Estimated word at a character position, used by the timer-based fallback. */
export function estimateWordFromText(words, spokenChars) {
  let total = 0;
  for (let i = 0; i < words.length; i += 1) {
    total += words[i].text.length + 1;
    if (total >= spokenChars) return i;
  }
  return Math.max(0, words.length - 1);
}
