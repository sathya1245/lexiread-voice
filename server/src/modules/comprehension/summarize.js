/**
 * Key-points summarizer.
 *
 * Extractive and fully offline: it scores the document's own sentences by
 * content-word frequency, position and shape, then returns the best few in
 * reading order. Nothing is invented — every key point is a sentence the
 * student will actually meet in the text, which matters when the reader may
 * need to find it again.
 */

import { analyzeWord, sentenceAt, tokenize } from '@lexiread/core';
import { COMMON_WORDS } from '../../data/word-knowledge.js';

const EXTRA_STOPWORDS = new Set([
  'also', 'however', 'therefore', 'thus', 'hence', 'example', 'figure', 'table',
  'page', 'chapter', 'called', 'known', 'using', 'used', 'uses', 'many', 'much',
  'often', 'usually', 'different', 'important', 'because', 'which', 'would',
  'could', 'should', 'these', 'those', 'there', 'their', 'other', 'first',
  'second', 'third', 'next', 'then', 'when', 'where', 'while', 'about', 'every',
]);

export const isStopword = (w) => COMMON_WORDS.has(w) || EXTRA_STOPWORDS.has(w);

function contentWords(text) {
  return (text.toLowerCase().match(/[a-z][a-z'-]+/g) || []).filter(
    (w) => w.length > 2 && !isStopword(w)
  );
}

export function difficultyLabel(text) {
  const words = text.match(/[A-Za-z\u00C0-\u024F']+/g) || [];
  if (!words.length) return { level: 'unknown', label: 'Not enough text to tell' };
  const syllables = words.reduce((acc, w) => acc + Math.max(1, analyzeWord(w).syllables), 0);
  const perWord = syllables / words.length;
  const longWords = words.filter((w) => w.length >= 9).length / words.length;
  const score = perWord * 0.6 + longWords * 1.4;
  if (score < 1.45) return { level: 'easy', label: 'Easy to read on your own', score: Number(score.toFixed(2)) };
  if (score < 1.75) return { level: 'steady', label: 'Comfortable — a good stretch', score: Number(score.toFixed(2)) };
  if (score < 2.05) return { level: 'challenging', label: 'Challenging — take it slowly', score: Number(score.toFixed(2)) };
  return { level: 'hard', label: 'Hard — read it with someone or use Listen mode', score: Number(score.toFixed(2)) };
}

/**
 * @param {string} text
 * @param {{maxPoints?: number}} [opts]
 */
export function summarize(text, { maxPoints } = {}) {
  const source = String(text ?? '');
  const doc = tokenize(source);
  const sentences = doc.sentences.filter((s) => s.text.trim().split(/\s+/).length >= 4);

  if (!sentences.length) {
    return {
      keyPoints: [],
      topicWords: [],
      title: '',
      stats: { words: doc.words.length, sentences: 0 },
      difficulty: difficultyLabel(source),
      notes: ['Add a bit more text and a summary will appear.'],
    };
  }

  const freq = new Map();
  for (const s of sentences) {
    for (const w of contentWords(s.text)) freq.set(w, (freq.get(w) || 0) + 1);
  }
  const docs = sentences.length;
  const idf = (w) => 1 + Math.log(docs / (1 + (freq.get(w) || 0)));

  const scored = sentences.map((s, index) => {
    const words = contentWords(s.text);
    const unique = new Set(words);
    let score = 0;
    for (const w of unique) score += (freq.get(w) || 1) * idf(w);
    score /= Math.sqrt(Math.max(4, words.length));
    if (index === 0) score += 1.6;
    if (index === 1) score += 0.6;
    if (index === sentences.length - 1) score += 0.7;
    if (/\b\d/.test(s.text)) score += 0.35;
    if (/\b(is|are|means|refers to|because|therefore|so)\b/i.test(s.text)) score += 0.3;
    const wordSpan = s.wEnd - s.wStart;
    if (wordSpan > 45) score -= 0.8;
    if (s.text.length < 30) score -= 0.4;
    return { ...s, score, index };
  });

  const count = maxPoints ?? Math.min(6, Math.max(3, Math.round(sentences.length / 5) + 2));
  const chosen = [...scored].sort((a, b) => b.score - a.score).slice(0, count);
  const keyPoints = chosen
    .sort((a, b) => a.index - b.index)
    .map((s) => ({ text: s.text.trim(), wi: s.wStart, score: Number(s.score.toFixed(2)) }));

  const topicWords = [...freq.entries()]
    .map(([word, count2]) => ({
      word,
      count: count2,
      score: Number((count2 * idf(word) * (1 + Math.min(word.length, 12) / 24)).toFixed(2)),
      syllables: analyzeWord(word).syllables,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const headline = [...scored].sort((a, b) => b.score - a.score)[0];
  const totalWords = doc.words.length;

  return {
    title: headline ? headline.text.split(/(?<=[.!?])/)[0].slice(0, 90) : '',
    keyPoints,
    topicWords,
    stats: {
      words: totalWords,
      sentences: sentences.length,
      paragraphs: doc.paragraphs.length,
      readingMinutes: Math.max(1, Math.round(totalWords / 110)),
      avgWordsPerSentence: Math.round(
        sentences.reduce((acc, s) => acc + s.text.split(/\s+/).length, 0) / sentences.length
      ),
    },
    difficulty: difficultyLabel(source),
    notes: [],
  };
}

/** Convenience for the reading room: which sentence is the student on? */
export function sentenceForWord(text, wi) {
  const doc = tokenize(text);
  const s = sentenceAt(doc.sentences, wi);
  return s ? { text: s.text, wStart: s.wStart, wEnd: s.wEnd } : null;
}
