/**
 * Writing assistant checks.
 *
 * Deliberately plain-spoken and never punitive: every issue is phrased as a
 * suggestion a friendly teacher would make, and each one carries a `severity`
 * of 'idea' | 'check' | 'fix' so the UI can show graduated, non-red cues. No
 * grammar jargon reaches the student.
 */

import { analyzeWord } from '@lexiread/core';
import { HOMOPHONE_HINTS, SPELLING_MAP } from '../../data/word-knowledge.js';

const WORD_RE = /[A-Za-z][A-Za-z'\u2019-]*/g;

function sentenceBounds(text) {
  const bounds = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if ('.!?'.includes(text[i])) {
      bounds.push({ start, end: i + 1 });
      start = i + 1;
    }
  }
  if (start < text.length) bounds.push({ start, end: text.length });
  return bounds;
}

const sentenceFor = (bounds, index) =>
  bounds.find((b) => index >= b.start && index <= b.end) || bounds[0] || { start: 0, end: 0 };

export function checkWriting(rawText) {
  const text = String(rawText ?? '');
  const issues = [];
  const bounds = sentenceBounds(text);

  const push = (issue) => {
    const s = sentenceFor(bounds, issue.index ?? 0);
    issues.push({
      ...issue,
      sentence: text.slice(s.start, s.end).trim().slice(0, 160),
      sentenceStart: s.start,
    });
  };

  // 1. Known misspellings (common school-age slips, with a plain explanation).
  let m;
  WORD_RE.lastIndex = 0;
  while ((m = WORD_RE.exec(text)) !== null) {
    const word = m[0];
    const fixed = SPELLING_MAP[word.toLowerCase()];
    if (fixed) {
      push({
        type: 'spelling',
        severity: 'fix',
        index: m.index,
        length: word.length,
        message: `"${word}" is usually spelled "${fixed}".`,
        suggestion: fixed,
      });
    }
  }

  // 2. The same word twice in a row.
  const repeatRe = /\b([A-Za-z']+)\s+\1\b/gi;
  while ((m = repeatRe.exec(text)) !== null) {
    push({
      type: 'repeat',
      severity: 'check',
      index: m.index,
      length: m[0].length,
      message: `"${m[1]} ${m[1]}" — the same word appears twice. One of them can go.`,
      suggestion: m[1],
    });
  }

  // 3. New sentences should start with a capital letter.
  const capitalRe = /([.!?])\s+([a-z])/g;
  while ((m = capitalRe.exec(text)) !== null) {
    push({
      type: 'capital',
      severity: 'check',
      index: m.index + 2,
      length: 1,
      message: `Start a new sentence with a capital letter — "${m[2].toUpperCase()}".`,
      suggestion: m[2].toUpperCase(),
    });
  }

  // 4. "i" on its own.
  const loneI = /(^|[\s("'])i(?=[\s.,!?)"']|$)/g;
  while ((m = loneI.exec(text)) !== null) {
    push({
      type: 'capital',
      severity: 'fix',
      index: m.index + m[1].length,
      length: 1,
      message: 'In English, the word "I" is always a capital letter.',
      suggestion: 'I',
    });
  }

  // 5. Very long sentences.
  for (const b of bounds) {
    const sentence = text.slice(b.start, b.end).trim();
    const words = sentence.split(/\s+/).filter(Boolean);
    if (words.length > 22) {
      push({
        type: 'long-sentence',
        severity: 'idea',
        index: b.start,
        length: sentence.length,
        message: `This sentence has ${words.length} words. Two shorter sentences are easier to follow.`,
        suggestion: null,
      });
    }
  }

  // 6. Homophones worth a second look (framed as a question, never an error).
  const lowered = text.toLowerCase();
  for (const { pair, hint } of HOMOPHONE_HINTS) {
    const used = pair.filter((p) => new RegExp(`\\b${p.replace("'", "['\u2019]?")}\\b`, 'i').test(lowered));
    if (used.length) {
      const idx = lowered.search(new RegExp(`\\b${used[0].replace("'", "['\u2019]?")}\\b`, 'i'));
      push({
        type: 'homophone',
        severity: 'idea',
        index: idx < 0 ? 0 : idx,
        length: used[0].length,
        message: hint,
        suggestion: null,
      });
    }
  }

  // 7. Spacing around punctuation.
  const spaceRe = /[,.;:](?=[A-Za-z])/g;
  while ((m = spaceRe.exec(text)) !== null) {
    push({
      type: 'spacing',
      severity: 'check',
      index: m.index,
      length: 1,
      message: `Put a space after "${m[0]}".`,
      suggestion: `${m[0]} `,
    });
  }

  // 8. Long stretches of capital letters.
  const shoutRe = /\b[A-Z]{6,}\b/g;
  while ((m = shoutRe.exec(text)) !== null) {
    push({
      type: 'capitals',
      severity: 'idea',
      index: m.index,
      length: m[0].length,
      message: 'Long words in capitals are harder to read — ordinary letters are kinder.',
      suggestion: m[0].charAt(0) + m[0].slice(1).toLowerCase(),
    });
  }

  const words = text.split(/\s+/).filter(Boolean);
  const sentences = bounds.filter((b) => text.slice(b.start, b.end).trim()).length || 1;
  const longWords = words.filter((w) => analyzeWord(w).syllables >= 3).length;

  return {
    issues: issues.slice(0, 40),
    counts: {
      total: issues.length,
      fix: issues.filter((i) => i.severity === 'fix').length,
      check: issues.filter((i) => i.severity === 'check').length,
      idea: issues.filter((i) => i.severity === 'idea').length,
    },
    stats: {
      words: words.length,
      sentences,
      avgSentenceLength: Math.round(words.length / sentences),
      longWordShare: Number((longWords / Math.max(1, words.length)).toFixed(2)),
    },
    encouragement:
      issues.filter((i) => i.severity === 'fix').length === 0
        ? 'Nice work — no spelling slips found. Ask a grown-up to read it with you if you want a second pair of eyes.'
        : 'Good start. Read each suggestion out loud with the Read back button.',
  };
}
