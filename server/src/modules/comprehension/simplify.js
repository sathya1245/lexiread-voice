/**
 * "Explain Like I'm ___" complexity engine.
 *
 * A deterministic, offline rule-based rewriter — no model, no API, no cost and
 * no hallucinated facts. For each target level it:
 *   1. swaps hard words for everyday ones (SIMPLE_SWAP),
 *   2. splits long sentences and drops trailing clauses,
 *   3. trims polite padding ("in order to", "it is important to note that"),
 *   4. keeps the order and the meaning of the original sentences.
 *
 * Sentence length, clause count and the swap dictionary all vary per level, so
 * age 5 output is short and concrete while "adult" keeps the original wording.
 */

import { COMMON_WORDS, SIMPLE_SWAP } from '../../data/word-knowledge.js';

export const LEVELS = [5, 8, 12, 'adult'];
export const LEVEL_LABELS = {
  5: 'age 5 — very simple',
  8: 'age 8 — simple',
  12: 'age 12 — clear',
  adult: 'adult — full wording',
};

const SETTINGS = {
  5: { maxWords: 9, maxClauses: 2, swap: true, dropParenthetical: true, prefix: '' },
  8: { maxWords: 14, maxClauses: 3, swap: true, dropParenthetical: true, prefix: '' },
  12: { maxWords: 20, maxClauses: 4, swap: true, dropParenthetical: true, prefix: '' },
  adult: { maxWords: 40, maxClauses: 8, swap: false, dropParenthetical: false, prefix: '' },
};

const PADDING = [
  [/it is important to note that\s*/gi, ''],
  [/it should be noted that\s*/gi, ''],
  [/in order to\b/gi, 'to'],
  [/due to the fact that\b/gi, 'because'],
  [/at this point in time\b/gi, 'now'],
  [/a large number of\b/gi, 'many'],
  [/the vast majority of\b/gi, 'most'],
  [/as a matter of fact\b/gi, 'in fact'],
  [/with regard to\b/gi, 'about'],
  [/in the event that\b/gi, 'if'],
  [/prior to\b/gi, 'before'],
  [/subsequent to\b/gi, 'after'],
  [/utilize\b/gi, 'use'],
];

const CONNECTIVE_STARTS = [
  'however', 'moreover', 'furthermore', 'nevertheless', 'consequently',
  'additionally', 'therefore', 'thus', 'hence', 'in addition', 'as a result',
];

function matchCase(source, replacement) {
  if (!replacement) return replacement;
  if (source === source.toUpperCase() && source.length > 1) return replacement.toUpperCase();
  if (source[0] === source[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function swapWords(text, changes) {
  return text.replace(/[A-Za-z][A-Za-z'-]*/g, (token) => {
    const lower = token.toLowerCase();
    const alt = SIMPLE_SWAP[lower];
    if (!alt) return token;
    changes.push({ from: token, to: alt });
    return matchCase(token, alt);
  });
}

function stripPadding(text, level) {
  let out = text;
  for (const [re, to] of PADDING) {
    if (level === 'adult' && to === '') continue;
    out = out.replace(re, to);
  }
  for (const start of CONNECTIVE_STARTS) {
    const re = new RegExp(`^${start},\\s*`, 'i');
    if (level !== 'adult' && re.test(out)) out = out.replace(re, '');
  }
  return out;
}

function splitClauses(sentence) {
  // Split on commas/semicolons and on "and/but/because/which/that" when they
  // introduce a second full clause.
  return sentence
    .split(/[,;]|\s+(?=(?:and|but|because|so|which|who|while|although|whereas|therefore)\b)/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function trimToWordBudget(clauses, maxWords) {
  const kept = [];
  let used = 0;
  for (const clause of clauses) {
    const count = clause.split(/\s+/).filter(Boolean).length;
    if (kept.length && used + count > maxWords) break;
    kept.push(clause);
    used += count;
  }
  return kept;
}

function tidy(text) {
  return text
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/^\s*[,;]\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .trim();
}

function sentenceCase(text) {
  if (!text) return text;
  return text[0].toUpperCase() + text.slice(1);
}

export function simplifySentence(sentence, level = 8) {
  const cfg = SETTINGS[level] ?? SETTINGS[8];
  const changes = [];
  let out = String(sentence).trim();
  if (!out) return { text: '', changes };

  out = stripPadding(out, level);
  if (cfg.dropParenthetical) out = out.replace(/\([^)]*\)/g, ' ');
  if (cfg.swap) out = swapWords(out, changes);

  let clauses = splitClauses(out);
  if (clauses.length > cfg.maxClauses) clauses = clauses.slice(0, cfg.maxClauses);
  clauses = trimToWordBudget(clauses, cfg.maxWords);
  out = tidy(clauses.join(', '));
  out = sentenceCase(out);
  if (out && !/[.!?]$/.test(out)) out += '.';
  return { text: out, changes };
}

/** Rewrite a definition or a short passage at the requested level. */
export function simplifyText(text, level = 8) {
  const cfg = SETTINGS[level] ?? SETTINGS[8];
  const source = String(text ?? '').trim();
  if (!source) return { text: '', level, changes: [], notes: [] };
  if (level === 'adult') {
    return { text: source, level, changes: [], notes: ['Original wording kept.'] };
  }

  const notes = [];
  const changes = [];
  const paragraphs = source.split(/\n{2,}/);

  const rewritten = paragraphs.map((para) => {
    const lines = para.split('\n').filter((l) => l.trim());
    const isList = lines.length > 1 && lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l));
    if (isList) {
      return lines
        .map((line) => {
          const marker = line.match(/^\s*([-*•]|\d+[.)])\s+/)[0];
          const body = line.slice(marker.length);
          const res = simplifySentence(body, level);
          changes.push(...res.changes);
          return `${marker.trim()} ${res.text}`;
        })
        .join('\n');
    }
    const sentences = para.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
    const out = sentences.map((s) => {
      const res = simplifySentence(s, level);
      changes.push(...res.changes);
      return res.text;
    });
    return out.join(' ');
  });

  const words = rewritten.join(' ').split(/\s+/).filter(Boolean);
  const hard = words.filter((w) => !COMMON_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, '')));
  if (hard.length / Math.max(1, words.length) > 0.35) {
    notes.push('Some words here are still advanced — tap any word for its meaning.');
  }

  return {
    text: rewritten.join('\n\n'),
    level,
    changes: dedupeChanges(changes),
    notes,
    label: LEVEL_LABELS[level],
    stats: {
      words: words.length,
      edited: changes.length,
    },
  };
}

function dedupeChanges(changes) {
  const seen = new Map();
  for (const c of changes) {
    const key = `${c.from.toLowerCase()}→${c.to.toLowerCase()}`;
    seen.set(key, c);
  }
  return [...seen.values()];
}

/**
 * Build a single explanation string for the slider. When the source text is a
 * short kid-friendly line (offline glossary entry) we add a framing phrase
 * instead of mangling it.
 */
export function buildExplanation(text, level) {
  const source = String(text ?? '').trim().replace(/\.$/, '');
  if (!source) return '';
  if (level === 5) {
    const simple = simplifySentence(source, 5).text.replace(/\.$/, '');
    return `Think of it like this: ${simple}.`;
  }
  if (level === 8) {
    const simple = simplifySentence(source, 8).text;
    return simplifySentence(source, 8).text.length < source.length ? simple : `${source}.`;
  }
  if (level === 12) {
    const mid = simplifySentence(source, 12).text;
    return mid.length > source.length + 8 ? `${source}.` : mid;
  }
  return `${source}.`;
}
