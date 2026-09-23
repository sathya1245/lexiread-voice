import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExplanation, simplifySentence, simplifyText } from '../src/modules/comprehension/simplify.js';
import { summarize, difficultyLabel } from '../src/modules/comprehension/summarize.js';
import { cleanExtractedText, textStats } from '../src/modules/extract/text.js';
import { itemsToText } from '../src/modules/extract/pdf.js';
import { checkWriting } from '../src/modules/writing/checks.js';
import { generatePracticeGame } from '../src/modules/games/generate.js';
import { analyzeReadingPatterns, PATTERN_DISCLAIMER } from '../src/modules/nlp/analyze.js';
import { buildWeeklySummary } from '../src/modules/reports/weekly.js';

const ARTICLE = `Photosynthesis is the process by which green plants convert light energy into chemical energy.
Plants use chlorophyll to capture sunlight in their leaves. The energy is stored as glucose, which the plant uses to grow.
Carbon dioxide enters the leaves through tiny openings and water is drawn up from the roots.
Oxygen is released as a by-product of this reaction, which is why forests are important for the atmosphere.
Without photosynthesis there would be no food chain on Earth.`;

test('simplifySentence shortens and swaps hard words', () => {
  const out = simplifySentence(
    'It is important to note that students must utilize a calculator in order to determine the answer',
    8
  );
  assert.ok(out.text.split(/\s+/).length <= 14);
  assert.ok(!/utilize/i.test(out.text));
  assert.ok(out.text.endsWith('.'));
});

test('the complexity slider produces different text per level', () => {
  const sentence = 'Photosynthesis is a fundamental process, which additionally requires carbon dioxide, because plants need it to grow.';
  const five = simplifyText(sentence, 5).text;
  const twelve = simplifyText(sentence, 12).text;
  const adult = simplifyText(sentence, 'adult').text;
  assert.equal(adult, sentence);
  assert.ok(five.split(/\s+/).length < twelve.split(/\s+/).length);
  assert.ok(simplifyText(sentence, 5).changes.length >= 1);
});

test('simplifyText keeps list structure', () => {
  const list = '- First point about the topic\n- Second point about the topic';
  const out = simplifyText(list, 8).text;
  assert.ok(out.split('\n').length === 2);
});

test('buildExplanation frames each level', () => {
  assert.match(buildExplanation('the way plants make food', 5), /^Think of it like this:/);
  assert.match(buildExplanation('the way plants make food', 'adult'), /plants make food/);
});

test('summarize returns ordered key points and topic words', () => {
  const s = summarize(ARTICLE);
  assert.ok(s.keyPoints.length >= 3);
  assert.ok(s.keyPoints.length <= 6);
  const wis = s.keyPoints.map((k) => k.wi);
  assert.deepEqual(wis, [...wis].sort((a, b) => a - b));
  assert.ok(s.topicWords.some((t) => t.word.startsWith('photosynth')));
  assert.ok(s.stats.words > 60);
  assert.equal(typeof s.difficulty.label, 'string');
});

test('summarize copes with tiny text', () => {
  const s = summarize('Too short.');
  assert.deepEqual(s.keyPoints, []);
  assert.ok(s.notes.length >= 1);
});

test('difficulty label responds to vocabulary', () => {
  assert.equal(difficultyLabel('The cat sat on the mat. The dog ran.').level, 'easy');
  const hard = difficultyLabel(
    'Photosynthesis and chlorophyll facilitate the transformation of electromagnetic radiation into biochemical energy.'
  );
  assert.ok(['challenging', 'hard'].includes(hard.level));
});

test('text cleanup repairs hyphenated wraps and controls', () => {
  const messy = 'photo-\nsynthesis\u0000 happens\nin plants.\n\n\n\nThe end.';
  const clean = cleanExtractedText(messy);
  assert.ok(clean.includes('photosynthesis happens'));
  assert.equal(clean.includes('\u0000'), false);
  assert.ok(!clean.includes('\n\n\n'));
});

test('textStats counts words and reading time', () => {
  const stats = textStats('One two three. Four five six.');
  assert.equal(stats.words, 6);
  assert.equal(stats.sentences, 2);
  assert.ok(stats.readingMinutes >= 1);
});

test('itemsToText rebuilds lines from pdf text items', () => {
  const text = itemsToText([
    { str: 'Hello', transform: [12, 0, 0, 12, 50, 700], width: 30 },
    { str: 'world', transform: [12, 0, 0, 12, 84, 700], width: 30, hasEOL: true },
    { str: 'Second', transform: [12, 0, 0, 12, 50, 680], width: 40 },
    { str: 'line', transform: [12, 0, 0, 12, 94, 680], width: 20 },
  ]);
  assert.equal(text, 'Hello world\nSecond line');
});

const PRACTICE = [
  { word: 'photosynthesis', weight: 6, occurrences: 3, syllables: 5, family: 'ph', familyLabel: 'words with the "ph" sound', parts: ['pho', 'to', 'syn', 'the', 'sis'], types: { close: 2, difficult: 1 } },
  { word: 'chlorophyll', weight: 4, occurrences: 2, syllables: 3, family: 'ph', familyLabel: 'words with the "ph" sound', parts: ['chlo', 'ro', 'phyll'], types: { close: 1 } },
  { word: 'glucose', weight: 3, occurrences: 2, syllables: 2, family: 'multi-syllable', familyLabel: 'long, multi-syllable words', parts: ['glu', 'cose'], types: { skipped: 2 } },
  { word: 'atmosphere', weight: 2.6, occurrences: 2, syllables: 3, family: 'multi-syllable', familyLabel: 'long, multi-syllable words', parts: ['at', 'mos', 'phere'], types: { help: 1 } },
];

test('practice words build a match round from real errors', () => {
  const game = generatePracticeGame({
    practiceWords: PRACTICE,
    definitions: new Map([['photosynthesis', { short: 'how plants make food' }]]),
  });
  assert.equal(game.empty, false);
  const match = game.rounds.find((r) => r.type === 'match');
  assert.ok(match.pairs.length >= 2);
  assert.ok(match.pairs.some((p) => p.hint.includes('plants')), 'uses the supplied definition');
  assert.ok(match.words.length === match.meanings.length);
});

test('game is deterministic for the same input', () => {
  const a = generatePracticeGame({ practiceWords: PRACTICE });
  const b = generatePracticeGame({ practiceWords: PRACTICE });
  assert.deepEqual(a, b);
});

test('game includes beats and family rounds', () => {
  const game = generatePracticeGame({ practiceWords: PRACTICE });
  assert.ok(game.rounds.some((r) => r.type === 'beats'));
  const family = game.rounds.find((r) => r.type === 'family');
  assert.ok(family.answers.includes('photosynthesis'));
  assert.ok(family.options.length >= 2);
});

test('game degrades gracefully with no flagged words', () => {
  const game = generatePracticeGame({ practiceWords: [] });
  assert.equal(game.empty, true);
  assert.deepEqual(game.rounds, []);
});

test('reading-pattern insights are practice-focused and non-diagnostic', () => {
  const events = [
    { type: 'close', word: 'photosynthesis', session_id: 's1', created_at: '2026-01-01T10:00:00Z' },
    { type: 'close', word: 'photosynthesis', session_id: 's2', created_at: '2026-01-02T10:00:00Z' },
    { type: 'difficult', word: 'chlorophyll', session_id: 's2', created_at: '2026-01-02T10:05:00Z' },
    { type: 'skipped', word: 'glucose', session_id: 's2', created_at: '2026-01-02T10:06:00Z' },
    { type: 'help', word: 'because', session_id: 's2', created_at: '2026-01-02T10:07:00Z' },
    { type: 'difficult', word: 'bog', session_id: 's2', created_at: '2026-01-02T10:08:00Z' },
  ];
  const sessions = [
    { id: 's1', started_at: '2026-01-01T10:00:00Z', wpm_avg: 55, duration_ms: 600000, words_read: 300, title: 'Plants' },
    { id: 's2', started_at: '2026-01-02T10:00:00Z', wpm_avg: 72, duration_ms: 900000, words_read: 500, title: 'Plants' },
  ];
  const intervals = [200, 3000, 400, 3200, 500, 2800];
  const insights = analyzeReadingPatterns({ events, sessions, intervals, name: 'Aditi' });

  assert.equal(insights.disclaimer, PATTERN_DISCLAIMER);
  assert.match(insights.disclaimer, /not a diagnosis/i);
  assert.equal(insights.practiceWords[0].word, 'photosynthesis');
  assert.ok(insights.insights.some((i) => i.kind === 'sound-family' && /ph/.test(i.title)));
  assert.ok(insights.insights.some((i) => i.kind === 'letter-shapes'));
  assert.equal(insights.pace.direction, 'up');
  assert.ok(insights.fluency.coefficient > 0.6);
  assert.ok(
    insights.insights.some((i) => i.kind === 'pace-variance'),
    'uneven reading speed produces a gentle rhythm suggestion'
  );
  for (const insight of insights.insights) {
    assert.ok(!/dyslexi|disorder|diagnos/i.test(insight.title), 'insights must not label the reader');
  }
});

test('weekly summary is plain language and names practice words', () => {
  const insights = analyzeReadingPatterns({
    events: [
      { type: 'close', word: 'photosynthesis', session_id: 's1' },
      { type: 'difficult', word: 'chlorophyll', session_id: 's1' },
    ],
    sessions: [
      { id: 's1', started_at: '2026-01-01T10:00:00Z', wpm_avg: 60, duration_ms: 600000, words_read: 300, title: 'Plants' },
      { id: 's2', started_at: '2026-01-02T10:00:00Z', wpm_avg: 70, duration_ms: 600000, words_read: 400, title: 'Rivers' },
    ],
    name: 'Aditi',
  });
  const summary = buildWeeklySummary({
    name: 'Aditi',
    sessions: [
      { id: 's1', started_at: '2026-01-01T10:00:00Z', wpm_avg: 60, duration_ms: 600000, words_read: 300, title: 'Plants' },
      { id: 's2', started_at: '2026-01-02T10:00:00Z', wpm_avg: 70, duration_ms: 600000, words_read: 400, title: 'Rivers' },
    ],
    insights,
    days: 7,
  });
  assert.match(summary.paragraphs.join(' '), /Aditi/);
  assert.match(summary.paragraphs.join(' '), /photosynthesis/);
  assert.equal(summary.practiceWords.length, 2);
  assert.ok(summary.stats.minutes === 20);
  assert.ok(!/chart|score|%/.test(summary.paragraphs.join(' ')));
});

test('weekly summary handles an empty week kindly', () => {
  const summary = buildWeeklySummary({ name: 'Ravi', sessions: [], insights: { practiceWords: [] } });
  assert.equal(summary.empty, true);
  assert.match(summary.headline, /No reading sessions yet/);
  assert.match(summary.paragraphs[0], /Ravi/);
});

test('writing checks give graded, plain-spoken suggestions', () => {
  const result = checkWriting(
    'i think teh cat sat on the the mat. This sentence has many words and it keeps going and going and going and going and going and going and going and going because it never stops and that makes it quite hard to follow for a reader,which is a problem'
  );
  assert.ok(result.counts.total >= 3);
  assert.ok(result.issues.some((i) => i.type === 'spelling' && i.suggestion === 'the'));
  assert.ok(result.issues.some((i) => i.type === 'capital'));
  assert.ok(result.issues.some((i) => i.type === 'repeat'));
  assert.ok(result.issues.some((i) => i.type === 'long-sentence' && i.severity === 'idea'));
  assert.ok(result.issues.every((i) => i.severity !== 'error'), 'no alarming severity levels');
  for (const issue of result.issues) {
    assert.ok(!/grammar|syntax|morpholog/i.test(issue.message), 'no grammar jargon');
  }
  assert.match(result.encouragement, /^[A-Z]/);
});

test('writing checks stay quiet on clean text', () => {
  const result = checkWriting('The cat sat on the mat. Then the dog ran away.');
  assert.equal(result.counts.fix, 0);
  assert.ok(result.counts.total <= 2);
});
