import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeWord,
  isHapticBragWord,
  normalizeWord,
  similarity,
  soundKey,
  splitWords,
  syllableCount,
  syllabify,
} from '../phonics.js';

test('normalizeWord strips punctuation and case', () => {
  assert.equal(normalizeWord('Photosynthesis,'), 'photosynthesis');
  assert.equal(normalizeWord('don’t'), "don't");
  assert.equal(normalizeWord('“Hello”'), 'hello');
});

test('syllableCount handles common words', () => {
  assert.equal(syllableCount('cat'), 1);
  assert.equal(syllableCount('photosynthesis'), 5);
  assert.equal(syllableCount('water'), 2);
  assert.equal(syllableCount('because'), 2);
  assert.equal(syllableCount('strength'), 1);
});

test('soundKey collapses phonetic equivalents', () => {
  assert.equal(soundKey('photosynthesis'), soundKey('fotosynthesis'));
  assert.equal(soundKey('phone'), soundKey('fone'));
  assert.equal(soundKey('knight'), soundKey('nite'));
  assert.equal(soundKey('back'), soundKey('bak'));
});

test('similarity accepts mispronunciations but rejects unrelated words', () => {
  assert.equal(similarity('photosynthesis', 'photosynthesis'), 1);
  assert.ok(similarity('fotosinthesis', 'photosynthesis') > 0.8, 'mispronunciation should still match');
  assert.ok(similarity('cat', 'mat') < 0.7, 'short words are only loosely similar');
  assert.ok(similarity('cat', 'cat') === 1);
  assert.ok(similarity('because', 'becase') > 0.75);
});

test('analyzeWord flags hard words', () => {
  const photo = analyzeWord('photosynthesis');
  assert.equal(photo.syllables, 5);
  assert.ok(photo.digraphs.includes('ph'));
  assert.equal(photo.isHard, true);

  const cat = analyzeWord('cat');
  assert.equal(cat.isHard, false);
  assert.equal(cat.difficulty, 0);

  const blend = analyzeWord('streaming');
  assert.ok(blend.blends.includes('str'));
});

test('reversal risk detection', () => {
  assert.equal(analyzeWord('bog').reversalRisk, true);
  assert.equal(analyzeWord('said').reversalRisk, true);
  assert.equal(analyzeWord('tree').reversalRisk, false);
});

test('isHapticBragWord celebrates hard words only', () => {
  assert.equal(isHapticBragWord('photosynthesis'), true);
  assert.equal(isHapticBragWord('elephant'), true);
  assert.equal(isHapticBragWord('cat'), false);
});

test('syllabify splits words into pronounceable chunks', () => {
  assert.deepEqual(syllabify('cat'), ['cat']);
  assert.deepEqual(syllabify('water'), ['wa', 'ter']);
  assert.deepEqual(syllabify('photosynthesis'), ['pho', 'to', 'syn', 'the', 'sis']);
  assert.ok(syllabify('elephant').length >= 3);
});

test('splitWords keeps letters from non-latin scripts out of the word list', () => {
  assert.deepEqual(splitWords('Two words, then 3 numbers.'), ['Two', 'words', 'then', '3', 'numbers']);
});
