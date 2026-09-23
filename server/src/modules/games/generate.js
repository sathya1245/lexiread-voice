/**
 * Personalized practice mini-game generator.
 *
 * Everything in the game comes from the student's own flagged words — never a
 * generic word list. Three round types, all keyboard- and screen-reader
 * friendly (tap/click or Enter, no drag-only interaction):
 *
 *  - `match`  : pair each practice word with its meaning,
 *  - `beats`  : tap the word's syllable beats in order,
 *  - `family` : find the word that shares the tricky sound.
 *
 * Deterministic: the same flagged words always produce the same game, which
 * makes it cacheable and testable.
 */

import { analyzeWord, syllabify } from '@lexiread/core';

/** Small deterministic PRNG so a given word list always yields one game. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashWords(words) {
  let h = 2166136261;
  for (const w of words) {
    for (const ch of String(w)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  }
  return h >>> 0;
}

function shuffle(list, rnd) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function hintFor(word, definition) {
  if (definition?.short) return definition.short;
  if (definition?.definition) return definition.definition;
  const info = analyzeWord(word);
  const parts = syllabify(word);
  const bits = [];
  if (parts.length > 1) bits.push(`${parts.length} beats: ${parts.join(' - ')}`);
  if (info.digraphs.length) bits.push(`has the "${info.digraphs[0]}" sound`);
  if (info.blends.length) bits.push(`starts a "${info.blends[0]}" blend`);
  return bits.length ? bits.join(' · ') : `starts with "${word[0]}"`;
}

/**
 * @param {object} args
 * @param {Array} args.practiceWords from nlp/analyze practiceWordsFrom()
 * @param {Map<string, object>} [args.definitions] word -> definition result
 */
export function generatePracticeGame({ practiceWords = [], definitions = new Map(), maxWords = 6 } = {}) {
  const picked = practiceWords
    .filter((w) => w && w.word && String(w.word).length > 1)
    .slice(0, maxWords);

  if (!picked.length) {
    return {
      title: 'Practice game',
      subtitle: 'Finish a voice-following reading session and your own tricky words will show up here.',
      rounds: [],
      empty: true,
    };
  }

  const rnd = mulberry32(hashWords(picked.map((w) => w.word)));
  const rounds = [];

  // Round 1 — word to meaning.
  const pairs = picked
    .slice(0, 4)
    .map((w) => ({
      word: w.word,
      hint: hintFor(w.word, definitions.get(w.word.toLowerCase()) || definitions.get(w.word)),
      syllables: w.syllables ?? analyzeWord(w.word).syllables,
    }));
  if (pairs.length >= 2) {
    rounds.push({
      id: 'match',
      type: 'match',
      title: 'Match each word to its meaning',
      prompt: 'Tap a word, then tap the meaning that fits.',
      pairs,
      words: shuffle(pairs.map((p) => p.word), rnd),
      meanings: shuffle(pairs.map((p) => ({ word: p.word, hint: p.hint })), rnd),
    });
  }

  // Round 2 — syllable beats.
  const beatWords = picked
    .map((w) => ({ word: w.word, parts: w.parts || syllabify(w.word) }))
    .filter((b) => b.parts.length >= 2)
    .slice(0, 4);
  if (beatWords.length) {
    rounds.push({
      id: 'beats',
      type: 'beats',
      title: 'Tap the beats',
      prompt: 'Tap the word parts in the right order to build the word.',
      items: beatWords.map((b) => ({
        word: b.word,
        parts: b.parts,
        shuffled: shuffle(b.parts, rnd),
      })),
    });
  }

  // Round 3 — find the word with the tricky sound.
  const byFamily = new Map();
  for (const w of picked) {
    const family = w.family || analyzeWord(w.word).digraphs[0] || null;
    if (!family) continue;
    if (!byFamily.has(family)) byFamily.set(family, []);
    byFamily.get(family).push(w.word);
  }
  const familyEntries = [...byFamily.entries()].sort((a, b) => b[1].length - a[1].length);
  if (familyEntries.length) {
    const [family, familyWords] = familyEntries[0];
    const others = picked.map((w) => w.word).filter((w) => !familyWords.includes(w));
    rounds.push({
      id: 'family',
      type: 'family',
      title: `Find the word with the "${family}" sound`,
      prompt: familyWords.length > 1
        ? 'More than one answer can fit — tap them all.'
        : 'Tap the word that has it.',
      family,
      answers: familyWords,
      options: shuffle([...new Set([...familyWords, ...others])].slice(0, 6), rnd),
    });
  }

  const distinct = picked.length;
  return {
    title: `Practice your ${distinct} tricky word${distinct === 1 ? '' : 's'}`,
    subtitle: 'These are the words from your own reading sessions — not a random list.',
    words: picked.map((w) => ({
      word: w.word,
      occurrences: w.occurrences ?? null,
      familyLabel: w.familyLabel ?? null,
      parts: w.parts ?? syllabify(w.word),
    })),
    rounds,
    empty: false,
  };
}
