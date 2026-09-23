/**
 * Plain-language weekly summary.
 *
 * The dashboard shows numbers, but the thing a parent or teacher actually
 * reads is a short story: what was read, how it went, and five words to
 * practise together. No charts, no jargon, no score-shaming.
 */

import { PATTERN_DISCLAIMER } from '../nlp/analyze.js';

const ms = (n) => {
  const minutes = Math.round((n || 0) / 60000);
  if (minutes < 1) return 'less than a minute';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} hour${h === 1 ? '' : 's'}${m ? ` ${m} minutes` : ''}`;
};

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

const uniqueWordList = (words) => {
  const seen = new Set();
  const out = [];
  for (const w of words) {
    const key = String(w).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
};

/**
 * @param {object} args
 * @param {string} [args.name]
 * @param {Array}  args.sessions  sessions in the period (started_at, duration_ms, words_read, wpm_avg, document title)
 * @param {Array}  args.events    flag events in the period
 * @param {object} args.insights  output of analyzeReadingPatterns()
 * @param {number} [args.days]
 */
export function buildWeeklySummary({ name = 'your reader', sessions = [], events = [], insights = null, days = 7 } = {}) {
  const practice = (insights?.practiceWords || []).slice(0, 5);
  const totalMs = sessions.reduce((acc, s) => acc + (s.duration_ms || 0), 0);
  const totalWords = sessions.reduce((acc, s) => acc + (s.words_read || 0), 0);
  const paceSamples = sessions.map((s) => s.wpm_avg).filter((n) => Number.isFinite(n) && n > 0);
  const avgPace = paceSamples.length
    ? Math.round(paceSamples.reduce((a, b) => a + b, 0) / paceSamples.length)
    : null;
  const flagged = insights?.practiceWords?.length || 0;
  const titles = uniqueWordList(sessions.map((s) => s.title).filter(Boolean)).slice(0, 3);

  const lines = [];
  const highlights = [];

  if (!sessions.length) {
    return {
      headline: `No reading sessions yet this week`,
      paragraphs: [
        `${name} has not started a session in the last ${days} days. Ten minutes with one short article is plenty for a first run — try Voice mode so the reading pace stays with ${name}.`,
      ],
      practiceWords: [],
      highlights: [],
      stats: { sessions: 0, minutes: 0, words: 0, avgPace: null, flaggedWords: 0 },
      disclaimer: PATTERN_DISCLAIMER,
      empty: true,
    };
  }

  const sessionWord = sessions.length === 1 ? 'session' : 'sessions';
  lines.push(
    `This week ${name} finished ${sessions.length} reading ${sessionWord} — about ${ms(totalMs)} of reading${
      totalWords ? `, covering ${totalWords} words` : ''
    }.`
  );

  if (titles.length) {
    lines.push(`What was read: ${titles.join(', ')}${sessions.length > titles.length ? ', and more' : ''}.`);
  }

  if (avgPace) {
    const pace = insights?.pace;
    if (pace?.direction === 'up') {
      lines.push(
        `Reading pace improved: ${pace.firstWpm} to ${pace.lastWpm} words per minute across the week (now averaging ${avgPace}).`
      );
      highlights.push(`Pace up ${pace.delta} words per minute`);
    } else if (pace?.direction === 'down') {
      lines.push(
        `Pace averaged ${avgPace} words per minute, down from ${pace.firstWpm}. That usually means the texts got harder — worth re-reading one easy favourite to end the week on a win.`
      );
    } else {
      lines.push(`Reading pace held steady at about ${avgPace} words per minute.`);
    }
  }

  if (practice.length) {
    const families = uniqueWordList(practice.map((w) => w.familyLabel)).slice(0, 2);
    lines.push(
      `${name} paused or needed help most on ${practice
        .slice(0, 3)
        .map((w) => `"${w.word}"`)
        .join(', ')}${practice.length > 3 ? ` (and ${practice.length - 3} more)` : ''}${
        families.length ? ` — mostly ${families.join(' and ')}` : ''
      }.`
    );
    lines.push(
      `Five words to practise together: ${practice.map((w) => `"${w.word}"`).join(', ')}. Read each one out loud, then tap it in the reader to hear it, then use the practice game.`
    );
    highlights.push(`${plural(flagged, 'word')} logged for practice`);
  } else {
    lines.push('No words were flagged this week — very smooth reading.');
    highlights.push('No tricky words logged');
  }

  const reassurance = insights?.insights?.find((i) => i.kind === 'pace-variance');
  if (reassurance) lines.push(reassurance.detail);

  return {
    headline: `${plural(sessions.length, 'session')} · ${ms(totalMs)} · ${plural(flagged, 'word')} to practise`,
    paragraphs: lines,
    practiceWords: practice.map((w) => ({
      word: w.word,
      parts: w.parts,
      familyLabel: w.familyLabel,
      why: Object.keys(w.types || {})
        .map((t) => ({ close: 'sounded close', skipped: 'was skipped', difficult: 'was marked tricky', help: 'needed help', unclear: 'was unclear' }[t]))
        .filter(Boolean)
        .join(', '),
    })),
    highlights,
    stats: {
      sessions: sessions.length,
      minutes: Math.round(totalMs / 60000),
      words: totalWords,
      avgPace,
      flaggedWords: flagged,
    },
    disclaimer: PATTERN_DISCLAIMER,
    empty: false,
  };
}
