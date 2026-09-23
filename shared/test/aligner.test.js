import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptanceThreshold,
  alignTranscript,
  createPaceTracker,
  isMatch,
  matchScore,
  nextHelpOffer,
  paceVariance,
  spokenTokens,
} from '../aligner.js';
import { tokenize } from '../tokenize.js';

const doc = (text) => tokenize(text).words;

function align(text, transcript, cursor = 0) {
  return alignTranscript({ spoken: spokenTokens(transcript), words: doc(text), cursor });
}

test('exact reading advances the cursor word by word', () => {
  const r = align('The cat sat on the mat.', 'the cat sat');
  assert.equal(r.accepted, true);
  assert.deepEqual(r.matches.map((m) => m.wi), [0, 1, 2]);
  assert.equal(r.cursor, 3);
  assert.deepEqual(r.skipped, []);
});

test('reading part of a long paragraph still registers (no trailing penalty)', () => {
  const text = 'Photosynthesis converts light energy into chemical energy stored in glucose molecules inside plants.';
  const r = align(text, 'photosynthesis converts light energy into chemical');
  assert.equal(r.accepted, true);
  assert.equal(r.cursor, 6);
});

test('a genuinely skipped word is reported, not silently swallowed', () => {
  const r = align('The cat sat on the mat.', 'the cat sat mat');
  assert.equal(r.accepted, true);
  assert.deepEqual(r.skippedIndexes, [3, 4]);
  assert.equal(r.skipped[0].text, 'on');
  // short function words are flagged with low confidence (recognizers drop them)
  assert.equal(r.skipped[0].confidence, 'low');
  assert.equal(r.cursor, 6);
});

test('a long skipped word is high confidence', () => {
  const r = align(
    'Plants use chlorophyll to capture sunlight.',
    'plants use to capture sunlight'
  );
  assert.equal(r.accepted, true);
  assert.deepEqual(r.skipped.map((s) => s.text), ['chlorophyll']);
  assert.equal(r.skipped[0].confidence, 'high');
});

test('mispronounced long word still matches, flagged as close', () => {
  const text = 'Photosynthesis is important for plants.';
  const r = align(text, 'fotosinthesis is important');
  assert.equal(r.accepted, true);
  assert.equal(r.matches[0].wi, 0);
  assert.equal(r.matches[0].status, 'close');
  assert.equal(r.matches[0].spoken, 'fotosinthesis');
  assert.deepEqual(r.skipped, []);
});

test('short words do not cross-match', () => {
  assert.equal(isMatch('mat', 'cat'), false);
  assert.equal(isMatch('cat', 'cat'), true);
  assert.equal(isMatch('and', 'end'), false);
  assert.ok(acceptanceThreshold('cat') > acceptanceThreshold('photosynthesis'));
});

test('filler words are ignored without flagging document words', () => {
  const r = align('The cat sat on the mat.', 'um the cat sat');
  assert.equal(r.accepted, true);
  assert.deepEqual(r.matches.map((m) => m.wi), [0, 1, 2]);
  assert.deepEqual(r.skipped, []);
});

test('jumping ahead to a distant matching word is rejected', () => {
  const r = align('The cat sat on the mat today.', 'mat', 0);
  assert.equal(r.accepted, false);
  assert.equal(r.cursor, 0);
});

test('a single word read at the cursor is accepted', () => {
  const r = align('The cat sat on the mat.', 'the');
  assert.equal(r.accepted, true);
  assert.equal(r.cursor, 1);
});

test('stumbling by repeating a word does not skip the document', () => {
  const r = align('The cat sat on the mat.', 'the the cat', 1);
  assert.equal(r.accepted, true);
  assert.ok(r.matches.some((m) => m.wi === 1), 'the read word is recognised');
  assert.deepEqual(r.skipped, []);
  assert.equal(r.cursor, 2);
});

test('repeats of the same word resolve in order', () => {
  const r = align('the the the the', 'the the');
  assert.equal(r.accepted, true);
  assert.deepEqual(r.matches.map((m) => m.wi), [0, 1]);
  assert.equal(r.cursor, 2);
});

test('gibberish does not move the cursor', () => {
  const r = align('Photosynthesis converts light energy.', 'zzz qqq');
  assert.equal(r.accepted, false);
  assert.equal(r.cursor, 0);
});

test('cursor behind a lookback window can still re-match', () => {
  // The student repeats the previous sentence's last word.
  const r = align('The cat sat on the mat.', 'mat', 6);
  assert.equal(r.accepted, true);
  assert.deepEqual(r.matches.map((m) => m.wi), [5]);
  assert.equal(r.cursor, 6);
  assert.equal(r.progressed, false);
});

test('matchScore is symmetric and bounded', () => {
  assert.equal(matchScore('water', 'water'), 1);
  assert.ok(matchScore('water', 'wader') > 0.5);
  assert.ok(matchScore('water', 'banana') < 0.4);
});

test('pace tracker reports words per minute over a rolling window', () => {
  const pace = createPaceTracker({ windowMs: 30000 });
  const t0 = 1_000_000;
  assert.equal(pace.wpm(t0), null);
  pace.add(20, t0);
  pace.add(20, t0 + 15000);
  // 40 words over 15s => 160 wpm
  assert.equal(pace.wpm(t0 + 15000), 160);
  // old samples age out
  assert.equal(pace.wpm(t0 + 60_000), null);
});

test('help offer fires once after a stall', () => {
  const t0 = 5_000_000;
  assert.equal(nextHelpOffer({ cursor: 4, lastProgressAt: t0, now: t0 + 1000 }), null);
  assert.deepEqual(
    nextHelpOffer({ cursor: 4, lastProgressAt: t0, now: t0 + 5000 }),
    { wi: 4, idle: 5000 }
  );
  assert.equal(nextHelpOffer({ cursor: 4, lastProgressAt: t0, now: t0 + 9000, alreadyOffered: 4 }), null);
  assert.deepEqual(
    nextHelpOffer({ cursor: 5, lastProgressAt: t0, now: t0 + 9000, alreadyOffered: 4 }),
    { wi: 5, idle: 9000 }
  );
});

test('pace variance measures fluency consistency', () => {
  assert.equal(paceVariance([1, 2]), null);
  const steady = paceVariance([1000, 1000, 1000, 1000, 1000]);
  assert.equal(steady.meanMs, 1000);
  assert.equal(steady.stdevMs, 0);
  const jumpy = paceVariance([300, 2500, 400, 3000, 600]);
  assert.ok(jumpy.coefficient > 0.6);
});
