/**
 * Passive reading-pattern insights.
 *
 * Turns the quiet stream of flags collected during voice-following sessions
 * into practice-focused patterns. Explicitly NOT diagnostic: every insight is
 * phrased as "words worth practising", never as a label for the reader, and
 * every payload carries the disclaimer the UI must display.
 */

import { analyzeWord, paceVariance, soundFamily, syllabify } from '@lexiread/core';

export const PATTERN_DISCLAIMER =
  'These are practice patterns from your own reading sessions, not a diagnosis. ' +
  'Share anything that worries you with a teacher or reading specialist.';

const WEIGHTS = {
  close: 2,      // sounded close — likely a real pronunciation wobble
  skipped: 1.6,  // word went missing (may also be the recogniser)
  difficult: 2.5, // the student tapped "this was hard"
  help: 0.8,     // asked to hear the word
  unclear: 0.4,  // recogniser doubt, weakest signal
};

const FAMILY_LABELS = {
  ph: 'words with the "ph" sound (as in phone)',
  gh: 'words with the "gh" sound (as in laugh, light)',
  th: 'words with "th"',
  sh: 'words with "sh"',
  ch: 'words with "ch"',
  wh: 'words with "wh"',
  ck: 'words ending in "ck"',
  ng: 'words ending in "ng"',
  qu: 'words with "qu"',
  ough: 'words with "ough" (tough stuff!)',
  igh: 'words with "igh"',
  tion: 'words ending in "-tion"',
  sion: 'words ending in "-sion"',
  'b/d/p/q letters': 'words with b, d, p or q letters',
  'multi-syllable': 'long, multi-syllable words',
  'short words': 'short everyday words',
};

const labelFor = (family) => FAMILY_LABELS[family] || `words with "${family}"`;

function aggregateWords(events) {
  const map = new Map();
  for (const e of events) {
    const word = String(e.word || '').trim();
    if (!word) continue;
    const key = word.toLowerCase();
    const entry = map.get(key) || {
      word,
      count: 0,
      types: {},
      sessions: new Set(),
      heard: [],
      lastAt: e.created_at || null,
      syllables: analyzeWord(word).syllables,
      family: soundFamily(word),
      phonics: analyzeWord(word),
    };
    const weight = WEIGHTS[e.type] ?? 1;
    entry.count += weight;
    entry.types[e.type] = (entry.types[e.type] || 0) + 1;
    if (e.session_id) entry.sessions.add(e.session_id);
    if (e.heard) entry.heard.push(e.heard);
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function practiceWordsFrom(events, limit = 12) {
  return aggregateWords(events)
    .slice(0, limit)
    .map((e) => ({
      word: e.word,
      weight: Number(e.count.toFixed(2)),
      occurrences: Object.values(e.types).reduce((a, b) => a + b, 0),
      types: e.types,
      sessions: e.sessions.size,
      syllables: e.syllables,
      family: e.family,
      familyLabel: labelFor(e.family),
      parts: syllabify(e.word),
      reversalRisk: e.phonics.reversalRisk,
      heard: [...new Set(e.heard)].slice(0, 3),
    }));
}

function familyTable(words) {
  const table = new Map();
  for (const w of words) {
    const entry = table.get(w.family) || { family: w.family, label: w.familyLabel, words: [], weight: 0 };
    entry.words.push(w.word);
    entry.weight += w.weight;
    table.set(w.family, entry);
  }
  return [...table.values()]
    .map((f) => ({ ...f, weight: Number(f.weight.toFixed(2)), words: f.words.slice(0, 8) }))
    .sort((a, b) => b.weight - a.weight);
}

function paceTrend(sessions) {
  const withPace = sessions
    .filter((s) => Number.isFinite(s.wpm_avg) && s.wpm_avg > 0)
    .sort((a, b) => String(a.started_at).localeCompare(String(b.started_at)));
  if (withPace.length < 2) {
    return { direction: 'unknown', firstWpm: withPace[0]?.wpm_avg ?? null, lastWpm: withPace[0]?.wpm_avg ?? null, delta: 0 };
  }
  const half = Math.max(1, Math.floor(withPace.length / 2));
  const firstAvg = withPace.slice(0, half).reduce((a, s) => a + s.wpm_avg, 0) / half;
  const restAvg = withPace.slice(half).reduce((a, s) => a + s.wpm_avg, 0) / (withPace.length - half);
  const delta = restAvg - firstAvg;
  const direction = delta > 5 ? 'up' : delta < -5 ? 'down' : 'steady';
  return {
    direction,
    firstWpm: Math.round(firstAvg),
    lastWpm: Math.round(restAvg),
    delta: Math.round(delta),
    samples: withPace.length,
  };
}

/**
 * @param {object} input
 * @param {Array} input.events   flag events (type/word/word_index/heard/at_ms/session_id)
 * @param {Array} input.intervals inter-word gaps in ms
 * @param {Array} input.sessions  reading sessions with wpm_avg
 * @param {string} [input.name]
 */
export function analyzeReadingPatterns({ events = [], intervals = [], sessions = [], name = 'your reader' } = {}) {
  const words = practiceWordsFrom(events);
  const families = familyTable(words);
  const pace = paceTrend(sessions);
  const fluency = paceVariance(intervals.map((i) => (typeof i === 'number' ? i : i.ms)));

  const insights = [];

  if (families.length) {
    const top = families[0];
    insights.push({
      kind: 'sound-family',
      title: `Practice the ${labelFor(top.family)}`,
      detail: `${top.words.slice(0, 5).join(', ')} came up ${top.words.length} time${top.words.length === 1 ? '' : 's'} as trickier words.`,
      words: top.words,
      tone: 'encouraging',
    });
  }

  const longs = words.filter((w) => w.syllables >= 3);
  if (longs.length >= 2) {
    insights.push({
      kind: 'long-words',
      title: 'Longer words take more time — that is normal',
      detail: `Words like ${longs.slice(0, 4).map((w) => `"${w.word}"`).join(', ')} are the ones that slowed reading down. Tap to hear each one, then read it in beats: ${longs[0].parts.join(' - ')}.`,
      words: longs.map((w) => w.word),
      tone: 'encouraging',
    });
  }

  const reversals = words.filter((w) => w.reversalRisk);
  if (reversals.length >= 2) {
    insights.push({
      kind: 'letter-shapes',
      title: 'Watch the b / d / p / q letter shapes',
      detail: `Several words being flagged contain b, d, p or q: ${reversals.slice(0, 5).map((w) => `"${w.word}"`).join(', ')}. Tracing them in the air with a finger often helps.`,
      words: reversals.map((w) => w.word),
      tone: 'encouraging',
    });
  }

  const repeatOffenders = words.filter((w) => w.sessions >= 2);
  if (repeatOffenders.length) {
    insights.push({
      kind: 'repeat-words',
      title: 'The same words keep showing up',
      detail: `${repeatOffenders.slice(0, 5).map((w) => `"${w.word}"`).join(', ')} appeared in more than one reading session — they are worth five minutes this week.`,
      words: repeatOffenders.map((w) => w.word),
      tone: 'encouraging',
    });
  }

  if (fluency && fluency.coefficient > 0.6) {
    insights.push({
      kind: 'pace-variance',
      title: 'Reading speed goes up and down',
      detail: `Some words were read in about ${Math.round(fluency.meanMs / 100) / 10}s and others took much longer. Reading together in a steady rhythm can help smooth this out.`,
      tone: 'encouraging',
    });
  }

  if (pace.direction === 'up') {
    insights.push({
      kind: 'pace-trend',
      title: 'Reading pace is picking up',
      detail: `Average pace went from ${pace.firstWpm} to ${pace.lastWpm} words per minute across recent sessions.`,
      tone: 'celebrating',
    });
  } else if (pace.direction === 'down') {
    insights.push({
      kind: 'pace-trend',
      title: 'Pace dipped a little',
      detail: `Average pace went from ${pace.firstWpm} to ${pace.lastWpm} words per minute. That usually means the text got harder, not that reading got worse.`,
      tone: 'reassuring',
    });
  }

  if (!insights.length) {
    insights.push({
      kind: 'starting',
      title: 'No patterns yet',
      detail: `Once ${name} finishes a voice-following reading session, gentle practice ideas will appear here.`,
      tone: 'encouraging',
    });
  }

  return {
    name,
    disclaimer: PATTERN_DISCLAIMER,
    practiceWords: words,
    families,
    pace,
    fluency,
    insights,
    totals: {
      events: events.length,
      distinctWords: words.length,
      flaggedSessions: new Set(events.map((e) => e.session_id)).size,
    },
  };
}
