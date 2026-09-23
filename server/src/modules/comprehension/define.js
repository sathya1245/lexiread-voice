/**
 * Word definition module.
 *
 * Order of preference:
 *   1. offline school-term knowledge (works with no internet, kid-friendly),
 *   2. the free dictionary API (dictionaryapi.dev — no key, no cost),
 *   3. a morphological fallback that explains the word from its ending.
 *
 * Every result also carries the same meaning rewritten for the complexity
 * slider: age 5 / 8 / 12 / adult.
 */

import { analyzeWord, syllableCount, syllabify } from '@lexiread/core';
import { config } from '../../config.js';
import { LOCAL_DEFINITIONS, SUFFIX_HINTS } from '../../data/word-knowledge.js';
import { buildExplanation, simplifyText } from './simplify.js';

const cache = new Map();
const CACHE_LIMIT = 500;

/**
 * Circuit breaker for the dictionary API.
 *
 * Classrooms are often offline, and a blocked host makes every lookup sit
 * until its timeout — which would make the glossary crawl. After two failures
 * we stop calling out for a couple of minutes and answer from the built-in
 * word knowledge instead, so the panel stays instant either way.
 */
const breaker = { failures: 0, openUntil: 0 };

function dictionaryState() {
  if (Date.now() < breaker.openUntil) return 'paused';
  return 'ready';
}

function noteDictionaryResult(ok) {
  if (ok) {
    breaker.failures = 0;
    breaker.openUntil = 0;
    return;
  }
  breaker.failures += 1;
  if (breaker.failures >= 2) breaker.openUntil = Date.now() + 120000;
}

export const dictionaryStatus = () => ({
  state: dictionaryState(),
  failures: breaker.failures,
  retryInMs: Math.max(0, breaker.openUntil - Date.now()),
});

function remember(word, value) {
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(word, value);
  return value;
}

async function fetchDictionary(word) {
  if (dictionaryState() !== 'ready') return null;
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(config.dictionaryTimeoutMs) });
    if (!res.ok) {
      noteDictionaryResult(false);
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) {
      // A real "no entry" answer: the API is healthy, the word is just unknown.
      noteDictionaryResult(true);
      return null;
    }
    noteDictionaryResult(true);
    return data;
  } catch {
    noteDictionaryResult(false);
    return null;
  }
}

function suffixFallback(word) {
  const info = analyzeWord(word);
  for (const [suffix, meaning] of SUFFIX_HINTS) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
      return {
        pos: 'word',
        definition: `A word ending in "-${suffix}" — usually ${meaning}.`,
        simple: `This word ends in "-${suffix}", which usually means ${meaning}.`,
      };
    }
  }
  const beats = syllabify(word).join(' - ');
  return {
    pos: 'word',
    definition: `No dictionary meaning was available for this word. It has ${info.syllables} syllable${info.syllables === 1 ? '' : 's'}: ${beats}.`,
    simple: `Say it in ${info.syllables} beat${info.syllables === 1 ? '' : 's'}: ${beats}.`,
  };
}

function localEntry(word) {
  const entry = LOCAL_DEFINITIONS[word];
  if (!entry) return null;
  const [pos, kid, mid, grown] = entry;
  return { pos, kid, mid, grown };
}

/**
 * @param {string} rawWord
 * @returns {Promise<{word:string, found:boolean, source:string, meanings:Array, explanations:object, syllables:string[], phonics:object}>}
 */
export async function defineWord(rawWord) {
  const word = String(rawWord || '').toLowerCase().replace(/[^a-z'-]/g, '');
  if (!word) {
    return { word: '', found: false, source: 'none', meanings: [], explanations: {}, syllables: [], phonics: null };
  }
  if (cache.has(word)) return cache.get(word);

  const phonics = analyzeWord(word);
  const syllables = syllabify(word);
  const local = localEntry(word);
  const base = {
    word,
    syllables,
    syllableCount: syllableCount(word),
    phonics,
    meanings: [],
    explanations: {},
    source: 'none',
    found: false,
  };

  if (local) {
    const explanations = {
      '5': buildExplanation(local.kid, 5),
      '8': buildExplanation(local.kid, 8),
      '12': buildExplanation(local.mid, 12),
      adult: buildExplanation(local.grown || local.mid, 'adult'),
    };
    return remember(word, {
      ...base,
      found: true,
      source: 'offline',
      pos: local.pos,
      meanings: [
        { pos: local.pos, definition: local.mid, simple: local.kid },
        { pos: local.pos, definition: local.grown || local.mid, simple: local.mid },
      ],
      explanations,
    });
  }

  const api = await fetchDictionary(word);

  if (api) {
    const entry = api[0];
    const meanings = [];
    for (const m of entry.meanings || []) {
      for (const d of m.definitions || []) {
        meanings.push({
          pos: m.partOfSpeech,
          definition: d.definition,
          example: d.example || null,
          synonyms: (d.synonyms || []).slice(0, 4),
        });
      }
    }
    if (meanings.length) {
      const trimmed = meanings.slice(0, 6);
      const primary = trimmed[0].definition;
      const explanations = {
        '5': simplifyText(primary, 5).text,
        '8': simplifyText(primary, 8).text,
        '12': simplifyText(primary, 12).text,
        adult: primary,
      };
      return remember(word, {
        ...base,
        found: true,
        source: 'dictionary',
        pos: trimmed[0].pos,
        phonetic: entry.phonetic || entry.phonetics?.find((p) => p.text)?.text || null,
        origin: entry.origin || null,
        meanings: trimmed,
        explanations,
      });
    }
  }

  return remember(word, fallbackDefinition(word));
}

/** Instant, offline-only definition (used when the API is slow or blocked). */
export function fallbackDefinition(rawWord) {
  const word = String(rawWord || '').toLowerCase().replace(/[^a-z'-]/g, '');
  const phonics = analyzeWord(word);
  const fb = suffixFallback(word);
  const parts = syllabify(word);
  return {
    word,
    found: false,
    source: 'offline',
    pos: fb.pos,
    syllables: parts,
    syllableCount: syllableCount(word),
    phonics,
    meanings: [{ pos: fb.pos, definition: fb.definition, simple: fb.simple }],
    explanations: {
      '5': buildExplanation(fb.simple, 5),
      '8': buildExplanation(fb.simple, 8),
      '12': buildExplanation(fb.definition, 12),
      adult: buildExplanation(fb.definition, 'adult'),
    },
  };
}

export function clearDefinitionCache() {
  cache.clear();
  breaker.failures = 0;
  breaker.openUntil = 0;
}
