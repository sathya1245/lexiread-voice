/**
 * LexiRead shared phonics helpers.
 *
 * Pure functions, no dependencies. Used by:
 *  - the voice-following aligner (fuzzy word matching),
 *  - the "hard word" detection that drives haptic feedback,
 *  - the passive reading-pattern insights and the mini-game generator.
 *
 * Deliberately rule-based (no paid APIs, works offline) and language-pluggable:
 * a future Indic-language module can supply its own syllable/blend tables.
 */

export const VOWELS = 'aeiouy';

/** Consonant blends and digraphs that commonly trip up early readers. */
export const BLENDS = [
  'scr', 'spr', 'str', 'spl', 'thr', 'shr', 'squ', 'sch',
  'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'sc', 'sk',
  'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw',
];

export const DIGRAPHS = ['ph', 'gh', 'th', 'sh', 'ch', 'wh', 'ck', 'ng', 'qu'];

/** Vowel teams that behave unpredictably (the "ough"/"igh" family). */
export const TRICKY_TEAMS = ['ough', 'augh', 'eigh', 'igh', 'tion', 'sion', 'cious', 'tious'];

/** Letters that are commonly reversed or transposed by readers with dyslexia. */
export const REVERSAL_LETTERS = ['b', 'd', 'p', 'q', 'g'];

const LETTER_ALIASES = {
  '’': "'",
  '‘': "'",
  '`': "'",
  '‐': '-',
  '–': '-',
  '—': '-',
};

/** Lowercase + strip punctuation, keeping internal apostrophes and hyphens. */
export function normalizeWord(raw) {
  if (!raw) return '';
  let s = String(raw).toLowerCase();
  for (const [from, to] of Object.entries(LETTER_ALIASES)) s = s.split(from).join(to);
  s = s.replace(/[^a-z0-9'\-\s]/g, '');
  return s.replace(/^['\-]+|['\-]+$/g, '').trim();
}

/**
 * Coarse phonetic key: both the written word and a misheard transcript of it
 * collapse to (roughly) the same key, which makes fuzzy matching far more
 * forgiving than raw edit distance for emerging readers.
 */
export function soundKey(raw) {
  let s = normalizeWord(raw).replace(/[^a-z]/g, '');
  if (!s) return '';
  const rules = [
    [/^kn/, 'n'], [/^wr/, 'r'], [/^gn/, 'n'], [/^ps/, 's'],
    [/^x/, 'z'],
    [/tion|sion|cian/, 'shn'],
    [/ough|augh/, 'o'],
    [/ight/, 'it'],
    [/eigh/, 'a'],
    [/ph/g, 'f'],
    [/gh/g, 'g'],
    [/ck/g, 'k'],
    [/qu/g, 'kw'],
    [/wh/g, 'w'],
    [/x/g, 'ks'],
    [/z/g, 's'],
    [/v/g, 'f'],
    [/j/g, 'g'],
    [/c(?=[eiy])/g, 's'],
    [/c/g, 'k'],
    [/(?<=k)k/g, ''],
  ];
  for (const [re, to] of rules) s = s.replace(re, to);
  // collapse doubled letters
  s = s.replace(/(.)\1+/g, '$1');
  // drop a silent trailing e
  if (s.length > 3 && s.endsWith('e')) s = s.slice(0, -1);
  // collapse vowel runs but keep which vowel family started the run
  s = s.replace(/[aeiou]{2,}/g, (m) => m[0]);
  s = s.replace(/(.)\1+/g, '$1');
  return s;
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  let cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** 0..1 similarity combining spelling and sound. */
export function similarity(a, b) {
  const x = normalizeWord(a);
  const y = normalizeWord(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const len = Math.max(x.length, y.length);
  const spelling = 1 - levenshtein(x, y) / len;
  const kx = soundKey(x);
  const ky = soundKey(y);
  const sound = kx && ky ? 1 - levenshtein(kx, ky) / Math.max(kx.length, ky.length) : 0;
  // a shared sound key counts for a lot, but spelling still has to be in the ballpark
  const blended = Math.max(spelling, sound * 0.94);
  // short words must match almost exactly, otherwise "cat" swallows "cap"/"can"
  if (len <= 4) return Math.min(blended, spelling);
  return blended;
}

const WORD_RE = /[A-Za-z0-9\u00C0-\u024F']+/g;

export function splitWords(text) {
  return String(text || '').match(WORD_RE) || [];
}

/** Count syllables with the classic vowel-group heuristic (min 1 for a word). */
export function syllableCount(raw) {
  const w = normalizeWord(raw).replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  let s = w
    .replace(/(?:[^laeiouy])es$|ed$|[^laeiouy]e$/, '')
    .replace(/^y/, '');
  const groups = s.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** True when the word contains a b/d/p/q-style reversal risk. */
export function hasReversalRisk(raw) {
  const w = normalizeWord(raw);
  if (!w) return false;
  return REVERSAL_LETTERS.some((l) => w.includes(l));
}

/**
 * Cheap syllable split used by the mini-game and hints ("pho-to-syn-the-sis").
 * Not linguistically perfect — it is a practice aid, not a dictionary.
 */
/**
 * Syllable split used by the mini-game hints ("pho-to-syn-the-sis").
 * Rule: keep the consonant immediately before each vowel group as the onset of
 * the new syllable, which matches how most English words break. Not
 * linguistically perfect — it is a practice aid, not a dictionary.
 */
export function syllabify(raw) {
  const w = normalizeWord(raw).replace(/[^a-z]/g, '');
  if (!w) return [String(raw)];
  const isVowel = (c) => VOWELS.includes(c);
  const cuts = [];
  let seenVowel = false;
  let prevGroupEnd = 0;
  let i = 0;
  while (i < w.length) {
    if (!isVowel(w[i])) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < w.length && isVowel(w[j])) j += 1;
    const cluster = i - prevGroupEnd;
    // Single consonant before the vowel starts the new syllable ("wa-ter");
    // a cluster splits so the first consonant stays behind ("mon-ster").
    if (seenVowel && cluster >= 1) cuts.push(cluster === 1 ? i - 1 : prevGroupEnd + 1);
    seenVowel = true;
    prevGroupEnd = j;
    i = j;
  }
  const parts = [];
  let start = 0;
  for (const cut of cuts) {
    if (cut > start) parts.push(w.slice(start, cut));
    start = cut;
  }
  if (start < w.length) parts.push(w.slice(start));
  return parts.length ? parts : [String(raw)];
}

/** Everything the reader needs to know about how hard a word is. */
export function analyzeWord(raw) {
  const word = normalizeWord(raw);
  const syllables = syllableCount(raw);
  const lower = word;
  const blends = new Set();
  for (const b of BLENDS) if (lower.includes(b)) blends.add(b);
  const digraphs = [];
  for (const d of DIGRAPHS) if (lower.includes(d)) digraphs.push(d);
  const teams = [];
  for (const t of TRICKY_TEAMS) if (lower.includes(t)) teams.push(t);
  const longVowelTeams = lower.match(/[aeiou]{3,}/g) || [];
  const difficulty = Math.min(
    3,
    (syllables >= 3 ? 2 : syllables === 2 ? 1 : 0) +
      (digraphs.length ? 1 : 0) +
      (teams.length ? 1 : 0) +
      (longVowelTeams.length ? 1 : 0) +
      (word.length >= 9 ? 1 : 0)
  );
  return {
    word,
    syllables,
    blends: [...blends],
    digraphs,
    teams,
    longVowelTeams,
    reversalRisk: hasReversalRisk(word),
    length: word.length,
    difficulty,
    /** Worth a celebratory haptic buzz / highlight when read correctly. */
    isHard: syllables >= 3 || digraphs.length > 0 || blends.length > 0 || teams.length > 0,
  };
}

/** Convenience for the haptic-feedback module. */
export function isHapticBragWord(raw) {
  const info = analyzeWord(raw);
  return info.syllables >= 3 || info.digraphs.length > 0 || info.blends.length >= 1 && info.length >= 6;
}

/** Does this word look like it is part of the same "ph/gh" practice family? */
export function soundFamily(raw) {
  const info = analyzeWord(raw);
  if (info.digraphs.length) return info.digraphs[0];
  if (info.teams.length) return info.teams[0];
  if (info.blends.length) return info.blends[0];
  if (info.syllables >= 3) return 'multi-syllable';
  if (info.reversalRisk) return 'b/d/p/q letters';
  return 'short words';
}
