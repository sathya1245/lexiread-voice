/**
 * LexiRead voice-following aligner.
 *
 * The student reads out loud; the browser's SpeechRecognition hands us a stream
 * of (often messy, often wrong) words. This module answers one question,
 * continuously and cheaply: *which word of the document did the student just
 * read?*
 *
 * Approach: an anchored sequence alignment (dynamic programming, the same
 * recurrence as edit distance) between the tail of the spoken transcript and a
 * window of upcoming document words near the current cursor. Alignment — rather
 * than a greedy "find the next equal word" — is what makes it forgiving of
 * repeated words, skipped words, stumbles and recognizer mistakes.
 *
 * Design notes:
 *  - Acceptance thresholds scale with word length: short words must match
 *    almost exactly, otherwise "cat" would swallow "can" and "cap".
 *  - Words after the student's last match are free (no penalty), so reading
 *    part of a long paragraph still registers progress.
 *  - A skipped document word is reported with a confidence hint instead of
 *    being called a mistake, because a dropped recognizer token is
 *    indistinguishable from a genuinely skipped word.
 *
 * Pure functions only, so it is unit-testable outside the browser.
 */

import { normalizeWord, similarity } from './phonics.js';

export const DEFAULT_ALIGN_OPTIONS = {
  /** How far ahead of the cursor we look for the student's next word. */
  windowSize: 12,
  /** How far behind the cursor a word may still be matched (stumbles/re-reads). */
  lookback: 2,
  /** Floor for the similarity required to accept a match. */
  minScore: 0.5,
  /** Cost of declaring a document word skipped (higher => fewer false skips). */
  skipPenalty: 0.3,
  /** Total alignment score required before we believe any of it. */
  minAlignmentScore: 0.85,
  /** Max spoken tokens considered in one alignment pass. */
  maxSpoken: 14,
  /** Score at or above which a match counts as clearly read. */
  exactThreshold: 0.92,
};

/**
 * Similarity needed for a spoken token to count as the given document word.
 * Short words get a much stricter bar.
 */
export function acceptanceThreshold(expected) {
  const len = normalizeWord(expected).length;
  if (len <= 1) return 1;
  if (len <= 3) return 0.99;
  if (len <= 4) return 0.85;
  if (len <= 6) return 0.7;
  return 0.6;
}

export function cleanSpoken(token) {
  return normalizeWord(token);
}

export function spokenTokens(transcript) {
  return String(transcript || '')
    .split(/\s+/)
    .map(cleanSpoken)
    .filter(Boolean);
}

/** Similarity between a spoken token and a document word (0..1). */
export function matchScore(spoken, expected) {
  return similarity(spoken, expected);
}

export function isMatch(spoken, expected, options = {}) {
  const opts = { ...DEFAULT_ALIGN_OPTIONS, ...options };
  const need = Math.max(opts.minScore, acceptanceThreshold(expected));
  return matchScore(spoken, expected) >= need;
}

/** Best single word in the window for a spoken token (diagnostics + hints). */
export function bestMatchInWindow(spoken, words, cursor, options = {}) {
  const { windowSize, lookback } = { ...DEFAULT_ALIGN_OPTIONS, ...options };
  const from = Math.max(0, cursor - lookback);
  const to = Math.min(words.length - 1, cursor + windowSize);
  let best = null;
  for (let t = from; t <= to; t++) {
    const score = matchScore(spoken, words[t]?.clean ?? words[t]);
    if (!best || score > best.score) best = { wi: t, score };
  }
  if (best) best.text = words[best.wi]?.text ?? words[best.wi];
  return best;
}

function emptyResult(cursor, score = 0) {
  return {
    accepted: false,
    cursor,
    progressed: false,
    matches: [],
    skipped: [],
    closeMatches: [],
    skippedIndexes: [],
    consumeThrough: -1,
    score,
  };
}

/**
 * Align the spoken transcript against the document window.
 *
 * @param {object} args
 * @param {string[]} args.spoken   cleaned spoken tokens, oldest first
 * @param {Array<{clean:string,text:string}>} args.words document words
 * @param {number} args.cursor     index of the next expected word
 * @returns {{
 *   accepted: boolean, cursor: number, progressed: boolean, score: number,
 *   matches: Array<{wi:number,text:string,spoken:string,spokenIndex:number,score:number,status:'exact'|'close'}>,
 *   skipped: Array<{wi:number,text:string,confidence:'high'|'low'}>,
 *   skippedIndexes: number[], closeMatches: number[], consumeThrough: number
 * }}
 */
export function alignTranscript({ spoken, words, cursor = 0, options = {} }) {
  const opts = { ...DEFAULT_ALIGN_OPTIONS, ...options };
  if (!words?.length || !spoken?.length) return emptyResult(cursor);

  const tokens = spoken.slice(-opts.maxSpoken).filter(Boolean);
  if (!tokens.length) return emptyResult(cursor);

  const t0 = Math.max(0, cursor - opts.lookback);
  const t1 = Math.min(words.length - 1, cursor + opts.windowSize);
  if (t1 < t0) return emptyResult(cursor);
  const cols = t1 - t0 + 1;
  const rows = tokens.length;
  const wordAt = (t) => words[t]?.clean ?? words[t] ?? '';
  const NEG = -1e9;

  // dp[s][t]: best score using the first s spoken tokens and the first t words
  // of the window. Ways[s][t] records which branch produced it.
  const dp = Array.from({ length: rows + 1 }, () => new Float64Array(cols + 1));
  const ways = Array.from({ length: rows + 1 }, () => new Uint8Array(cols + 1)); // 0 match, 1 skip spoken, 2 skip word

  for (let t = 1; t <= cols; t++) {
    dp[0][t] = dp[0][t - 1] - opts.skipPenalty;
    ways[0][t] = 2;
  }
  for (let s = 1; s <= rows; s++) {
    dp[s][0] = 0;
    ways[s][0] = 1;
  }

  for (let s = 1; s <= rows; s++) {
    for (let t = 1; t <= cols; t++) {
      const expected = wordAt(t0 + t - 1);
      const score = matchScore(tokens[s - 1], expected);
      const need = Math.max(opts.minScore, acceptanceThreshold(expected));
      const matchVal = score >= need ? dp[s - 1][t - 1] + score : NEG;
      const skipSpokenVal = dp[s - 1][t];
      const skipWordVal = dp[s][t - 1] - opts.skipPenalty;
      let best = skipSpokenVal;
      let dir = 1;
      if (skipWordVal > best) {
        best = skipWordVal;
        dir = 2;
      }
      if (matchVal > best) {
        best = matchVal;
        dir = 0;
      }
      dp[s][t] = best;
      ways[s][t] = dir;
    }
  }

  // Free end: words after the last match must not be penalised, so pick the
  // window column that maximises the score and backtrack from there.
  let tEnd = 0;
  let bestScore = dp[rows][0];
  for (let t = 1; t <= cols; t++) {
    if (dp[rows][t] > bestScore) {
      bestScore = dp[rows][t];
      tEnd = t;
    }
  }

  let s = rows;
  let t = tEnd;
  const matches = [];
  const closeMatches = [];
  while (s > 0 || t > 0) {
    const dir = s === 0 ? 2 : t === 0 ? 1 : ways[s][t];
    if (dir === 0) {
      const wi = t0 + t - 1;
      const score = matchScore(tokens[s - 1], wordAt(wi));
      const status = score >= opts.exactThreshold ? 'exact' : 'close';
      matches.push({
        wi,
        text: words[wi]?.text ?? wordAt(wi),
        spoken: tokens[s - 1],
        spokenIndex: s - 1,
        score,
        status,
      });
      if (status === 'close') closeMatches.push(wi);
      s -= 1;
      t -= 1;
    } else if (dir === 1) {
      s -= 1;
    } else {
      t -= 1;
    }
  }
  matches.reverse();
  closeMatches.sort((a, b) => a - b);

  if (!matches.length) return emptyResult(cursor, Math.max(0, bestScore));

  const total = matches.reduce((acc, m) => acc + m.score, 0);
  const first = matches[0].wi;
  const last = matches[matches.length - 1];

  const accept = total >= opts.minAlignmentScore && first <= cursor + opts.lookback + 1;
  if (!accept) return emptyResult(cursor, total);

  const matchedSet = new Set(matches.map((m) => m.wi));
  const skipped = [];
  for (let wi = Math.min(cursor, first); wi < last.wi; wi++) {
    if (matchedSet.has(wi)) continue;
    const text = words[wi]?.text ?? wordAt(wi);
    const clean = wordAt(wi);
    skipped.push({
      wi,
      text,
      // Single short function words ("on", "the", "a") are the ones a
      // recognizer most often swallows, so we flag them as low confidence
      // rather than treating them as a reading error.
      confidence: clean.length >= 5 ? 'high' : 'low',
    });
  }

  return {
    accepted: true,
    cursor: Math.max(cursor, last.wi + 1),
    progressed: last.wi + 1 > cursor,
    matches,
    skipped,
    skippedIndexes: skipped.map((s2) => s2.wi),
    closeMatches,
    consumeThrough: last.spokenIndex,
    score: total,
  };
}

/**
 * Rolling reading-pace tracker (words per minute). Time-stamped progress
 * events keep it honest during pauses and re-reads.
 */
export function createPaceTracker({ windowMs = 30000 } = {}) {
  let samples = [];
  return {
    add(count, now = Date.now()) {
      if (count <= 0) return;
      samples.push({ t: now, c: count });
      this.prune(now);
    },
    prune(now = Date.now()) {
      samples = samples.filter((s) => now - s.t <= windowMs);
    },
    /** Words per minute over the rolling window, null when nothing recent. */
    wpm(now = Date.now()) {
      this.prune(now);
      if (!samples.length) return null;
      const total = samples.reduce((acc, s) => acc + s.c, 0);
      const span = Math.max(6000, now - samples[0].t);
      return Math.round((total / span) * 60000);
    },
    reset() {
      samples = [];
    },
    get sampleCount() {
      return samples.length;
    },
  };
}

/**
 * "The student is stuck" detection: no forward progress for a while while the
 * microphone is live. Returns the word we should offer to pronounce, once.
 */
export function nextHelpOffer({
  cursor,
  lastProgressAt,
  now = Date.now(),
  stuckMs = 3500,
  alreadyOffered = null,
}) {
  if (cursor == null) return null;
  const idle = now - lastProgressAt;
  if (idle < stuckMs) return null;
  if (alreadyOffered === cursor) return null;
  return { wi: cursor, idle };
}

/** Variance of inter-word intervals — a gentle signal of reading fluency. */
export function paceVariance(intervals) {
  const xs = (intervals || []).filter((n) => Number.isFinite(n) && n >= 0 && n < 30000);
  if (xs.length < 4) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (mean <= 0) return null;
  const varr = xs.reduce((acc, x) => acc + (x - mean) ** 2, 0) / xs.length;
  return {
    meanMs: Math.round(mean),
    stdevMs: Math.round(Math.sqrt(varr)),
    coefficient: Number((Math.sqrt(varr) / mean).toFixed(3)),
  };
}

/** Nearest document word to what the recognizer heard (for flag explanations). */
export function nearestWord(heard, words, cursor = 0, radius = 6) {
  const b = bestMatchInWindow(heard, words, cursor, { windowSize: radius, lookback: radius });
  return b && b.score >= 0.35 ? b : null;
}
