/**
 * Glossary generator.
 *
 * Finds the technical terms, names and acronyms a student is most likely to
 * stumble on, then explains each one — offline school-term knowledge first,
 * free dictionary API second, morphology last.
 *
 * Definitions are resolved in parallel against a hard deadline. Whatever has
 * not answered in time falls back to the offline word knowledge, so the panel
 * renders immediately even in a classroom with no internet at all.
 */

import { analyzeWord, tokenize } from '@lexiread/core';
import { defineWord, fallbackDefinition } from './define.js';
import { isStopword } from './summarize.js';

const TECHNICAL_SUFFIXES = [
  'ology', 'ologist', 'tion', 'sion', 'ment', 'ity', 'ism', 'graph', 'meter',
  'scope', 'phyll', 'synthesis', 'plasm',
];

function scoreTerm({ term, count, capitalized, acronym, firstSeen, totalWords }) {
  let score = 0;
  score += Math.log(1 + count) * 2.2;
  score += Math.min(term.length, 16) / 4;
  if (acronym) score += 2.4;
  if (capitalized) score += 1.1;
  if (TECHNICAL_SUFFIXES.some((s) => term.endsWith(s))) score += 1.3;
  if (analyzeWord(term).syllables >= 3) score += 1.0;
  // Terms appearing early are more likely to be introduced and reused later.
  if (firstSeen / Math.max(1, totalWords) < 0.25) score += 0.4;
  return score;
}

/** Resolve when the deadline passes, so the response never waits on the network. */
const untilDeadline = (ms) =>
  new Promise((resolve) => {
    setTimeout(() => resolve(null), Math.max(0, ms));
  });

function candidates(text) {
  const doc = tokenize(String(text ?? ''));
  const total = doc.words.length || 1;
  const seen = new Map();

  doc.words.forEach((w, index) => {
    const term = w.text;
    const lower = w.clean;
    if (lower.length < 4 || isStopword(lower) || /^\d+$/.test(lower)) return;
    const isSentenceStart = doc.sentences.some((s) => s.wStart === w.wi);
    const capitalized = /^[A-Z\u00C0-\u024F]/.test(term) && !isSentenceStart;
    const acronym = /^[A-Z]{2,5}$/.test(term);
    const technicalish =
      TECHNICAL_SUFFIXES.some((s) => lower.endsWith(s)) ||
      analyzeWord(lower).syllables >= 3 ||
      lower.length >= 9;
    if (!capitalized && !acronym && !technicalish) return;

    const key = capitalized || acronym ? term : lower;
    const entry = seen.get(key) || { term: key, count: 0, firstSeen: index, capitalized, acronym };
    entry.count += 1;
    seen.set(key, entry);
  });

  return [...seen.values()]
    .map((e) => ({ ...e, score: scoreTerm({ ...e, totalWords: total }) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * @param {string} text
 * @param {{maxTerms?: number, withDefinitions?: boolean, deadlineMs?: number}} [opts]
 */
export async function buildGlossary(text, { maxTerms = 10, withDefinitions = true, deadlineMs = 4000 } = {}) {
  const ranked = candidates(text);
  if (!withDefinitions) {
    return ranked.slice(0, maxTerms).map(({ term, count, score }) => ({ term, count, score: Number(score.toFixed(2)) }));
  }

  const deadline = Date.now() + deadlineMs;
  const resolved = await Promise.all(
    ranked.slice(0, maxTerms).map(async (entry) => {
      const remaining = deadline - Date.now();
      const definition = remaining <= 0
        ? fallbackDefinition(entry.term)
        : (await Promise.race([defineWord(entry.term).catch(() => null), untilDeadline(remaining)])) ||
          fallbackDefinition(entry.term);
      return { entry, definition };
    })
  );

  // Lead with terms we can actually explain, then by importance.
  resolved.sort((a, b) => Number(b.definition.found) - Number(a.definition.found) || b.entry.score - a.entry.score);

  return resolved.map(({ entry, definition }) => ({
    term: entry.term,
    count: entry.count,
    score: Number(entry.score.toFixed(2)),
    isName: entry.capitalized && !entry.acronym,
    isAcronym: entry.acronym,
    syllables: definition.syllables,
    pos: definition.pos || null,
    short: definition.meanings?.[0]?.simple || definition.meanings?.[0]?.definition || '',
    definition: definition.meanings?.[0]?.definition || '',
    explanations: definition.explanations || {},
    source: definition.source,
    found: definition.found,
  }));
}
