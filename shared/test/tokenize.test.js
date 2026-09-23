import test from 'node:test';
import assert from 'node:assert/strict';
import { sentenceAt, splitSentences, tokenize, wordsToText } from '../tokenize.js';

test('tokenize keeps original spacing and punctuation', () => {
  const t = tokenize('The cat sat.\n\nDogs run!');
  assert.equal(t.text, 'The cat sat.\n\nDogs run!');
  const rebuilt = t.segments.map((s) => s.text).join('');
  assert.equal(rebuilt, t.text);
});

test('tokenize numbers words and sentences', () => {
  const t = tokenize('The cat sat on the mat. The dog ran fast!');
  assert.equal(t.words.length, 10);
  assert.equal(t.words[0].clean, 'the');
  assert.equal(t.words[9].clean, 'fast');
  assert.equal(t.sentences.length, 2);
  assert.equal(t.sentences[0].wStart, 0);
  assert.equal(t.sentences[0].wEnd, 5);
  assert.equal(t.sentences[0].text, 'The cat sat on the mat.');
  assert.equal(t.sentences[1].wStart, 6);
  assert.equal(t.sentences[1].wEnd, 9);
});

test('tokenize understands paragraphs', () => {
  const t = tokenize('First para here.\n\nSecond para here.');
  assert.equal(t.paragraphs.length, 2);
  assert.equal(t.words[0].paragraph, 0);
  assert.equal(t.words[t.words.length - 1].paragraph, 1);
  assert.deepEqual(
    { wStart: t.paragraphs[0].wStart, wEnd: t.paragraphs[0].wEnd },
    { wStart: 0, wEnd: 2 }
  );
  assert.equal(t.paragraphs[1].wStart, 3);
  assert.equal(t.paragraphs[1].wEnd, 5);
});

test('tokenize does not split decimals or abbreviations', () => {
  const t = tokenize('It cost 3.5 dollars. The U.S. is big.');
  assert.equal(t.sentences.length, 2);
  assert.equal(t.sentences[0].text, 'It cost 3.5 dollars.');
  assert.equal(t.sentences[1].text, 'The U.S. is big.');
  assert.equal(t.words.length, 10);
});

test('sentenceAt finds the containing sentence', () => {
  const t = tokenize('The cat sat on the mat. The dog ran fast!');
  assert.equal(sentenceAt(t.sentences, 3).si, 0);
  assert.equal(sentenceAt(t.sentences, 8).si, 1);
  assert.equal(sentenceAt(t.sentences, 99).si, 1);
});

test('wordsToText rebuilds a range', () => {
  const t = tokenize('The cat sat on the mat.');
  assert.equal(wordsToText(t.words, 1, 3), 'cat sat on');
});

test('splitSentences handles newlines and multiple terminators', () => {
  const out = splitSentences('One. Two!\n\nThree?');
  assert.deepEqual(out, ['One.', 'Two!', 'Three?']);
});
