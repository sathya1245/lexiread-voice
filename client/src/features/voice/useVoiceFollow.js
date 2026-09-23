/**
 * Voice-Following Guided Reading.
 *
 * The student reads out loud; the app listens and follows *their* pace. This
 * hook owns the whole loop:
 *
 *   speech events -> delta tokens -> shared aligner -> cursor + flags -> UI
 *
 * Design decisions worth knowing:
 *  - Only the *new* words of each recognition result are processed (the delta
 *    against the previous transcript for that result index). Interim results
 *    therefore advance the highlight immediately, and when the recogniser
 *    replaces them with the final version nothing is counted twice.
 *  - Matching happens in the shared aligner (@lexiread/core), so the browser
 *    and the server agree on what "read" and "flagged" mean.
 *  - Errors are soft: a word read approximately gets a dotted underline, a
 *    missed word gets a dashed underline, and nothing ever interrupts reading.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  alignTranscript,
  createPaceTracker,
  isHapticBragWord,
  nextHelpOffer,
  spokenTokens,
} from '@lexiread/core';
import { HAPTIC, buzz } from '../../lib/haptics.js';
import { useSpeechRecognition } from './useSpeechRecognition.js';

const MAX_PENDING = 16;
const FLAG_BATCH_LIMIT = 400;

const commonPrefix = (a, b) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
};

export function useVoiceFollow({
  words = [],
  sentences = [],
  enabled = false,
  lang = 'en-US',
  stuckMs = 3500,
  haptics = true,
  onFlag,
  onProgress,
  onStuck,
} = {}) {
  const [cursor, setCursor] = useState(0);
  const [flags, setFlags] = useState(() => new Map());
  const [wpm, setWpm] = useState(null);
  const [wordsRead, setWordsRead] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [helpWord, setHelpWord] = useState(null);
  const [lastHeard, setLastHeard] = useState(null);
  const [recentFlash, setRecentFlash] = useState(null);
  const [tapMode, setTapMode] = useState(false);

  const wordsRef = useRef(words);
  wordsRef.current = words;
  const cursorRef = useRef(0);
  const pendingRef = useRef([]);
  const transcriptRef = useRef(new Map());
  const lastProgressAtRef = useRef(Date.now());
  const trackerRef = useRef(createPaceTracker({ windowMs: 30000 }));
  const intervalsRef = useRef([]);
  const lastIntervalAtRef = useRef(null);
  const flagsRef = useRef(new Map());
  const queueRef = useRef([]);
  const offeredRef = useRef(null);
  const wordsReadRef = useRef(0);
  const startedAtRef = useRef(null);
  const peakRef = useRef(null);
  const callbacks = useRef({ onFlag, onProgress, onStuck });
  callbacks.current = { onFlag, onProgress, onStuck };

  const sentenceFor = useCallback(
    (wi) => sentences.find((s) => wi >= s.wStart && wi <= s.wEnd) || null,
    [sentences]
  );

  const recordFlag = useCallback((flag) => {
    if (flagsRef.current.has(flag.wi) && flagsRef.current.get(flag.wi).type === flag.type) return;
    flagsRef.current = new Map(flagsRef.current).set(flag.wi, flag);
    setFlags(flagsRef.current);
    queueRef.current.push(flag);
    if (queueRef.current.length > FLAG_BATCH_LIMIT) queueRef.current = queueRef.current.slice(-FLAG_BATCH_LIMIT);
    callbacks.current.onFlag?.(flag);
  }, []);

  const noteInterval = useCallback((now) => {
    const last = lastIntervalAtRef.current;
    if (last != null) {
      const gap = now - last;
      if (gap > 60 && gap < 30000) {
        intervalsRef.current.push(gap);
        if (intervalsRef.current.length > 600) intervalsRef.current = intervalsRef.current.slice(-600);
      }
    }
    lastIntervalAtRef.current = now;
  }, []);

  /** Commit an alignment result to state + flags. */
  const applyAlignment = useCallback(
    (result, now) => {
      if (!result.accepted) return false;
      // The session clock starts with the first word, however it was read.
      if (!startedAtRef.current) startedAtRef.current = now;
      const matchesByWord = new Map(result.matches.map((m) => [m.wi, m]));

      for (const m of result.matches) {
        if (m.status === 'close') {
          recordFlag({ wi: m.wi, type: 'close', word: m.text, heard: m.spoken, atMs: now - (startedAtRef.current || now) });
        }
        if (haptics && isHapticBragWord(m.text)) buzz(HAPTIC.hardWord);
        else if (haptics) buzz(HAPTIC.word);
      }
      for (const skip of result.skipped) {
        recordFlag({
          wi: skip.wi,
          type: skip.confidence === 'high' ? 'skipped' : 'unclear',
          word: skip.text,
          confidence: skip.confidence,
          atMs: now - (startedAtRef.current || now),
        });
      }

      cursorRef.current = result.cursor;
      setCursor(result.cursor);
      lastProgressAtRef.current = now;
      offeredRef.current = null;
      setHelpWord(null);
      const advanced = result.matches.length;
      wordsReadRef.current += advanced;
      setWordsRead(wordsReadRef.current);
      trackerRef.current.add(advanced, now);
      noteInterval(now);
      const nextWpm = trackerRef.current.wpm(now);
      if (nextWpm) {
        setWpm(nextWpm);
        peakRef.current = Math.max(peakRef.current || 0, nextWpm);
      }
      const lastMatch = result.matches[result.matches.length - 1];
      setLastHeard(lastMatch?.spoken || null);
      setRecentFlash({ wi: lastMatch.wi, at: now });
      const sentence = sentenceFor(result.cursor);
      callbacks.current.onProgress?.({
        cursor: result.cursor,
        wordsRead: wordsReadRef.current,
        wpm: nextWpm,
        sentence,
        lastWord: matchesByWord.get(lastMatch.wi)?.text || null,
      });
      return true;
    },
    [haptics, noteInterval, recordFlag, sentenceFor]
  );

  /** Feed newly heard tokens through the aligner. */
  const consume = useCallback(
    (delta) => {
      if (!delta.length || !wordsRef.current.length) return;
      if (delta.length) setLastHeard(delta[delta.length - 1]);
      const spoken = [...pendingRef.current, ...delta].slice(-MAX_PENDING);
      const now = Date.now();
      const result = alignTranscript({ spoken, words: wordsRef.current, cursor: cursorRef.current });
      if (result.accepted) {
        const rest = spoken.slice(result.consumeThrough + 1);
        pendingRef.current = rest.slice(-MAX_PENDING);
        applyAlignment(result, now);
      } else {
        pendingRef.current = spoken.slice(-MAX_PENDING);
      }
    },
    [applyAlignment]
  );

  const onSpeechResult = useCallback(
    (event) => {
      const results = event.results;
      const startIndex = event.resultIndex ?? 0;
      for (let i = startIndex; i < results.length; i += 1) {
        const result = results[i];
        const transcript = result[0]?.transcript || '';
        const tokens = spokenTokens(transcript);
        const previous = transcriptRef.current.get(i) || [];
        const prefix = commonPrefix(previous, tokens);
        // Text shrinking (a corrected interim result) must not re-process words.
        const delta = tokens.length > previous.length ? tokens.slice(prefix) : [];
        if (result.isFinal) transcriptRef.current.set(i, tokens);
        else transcriptRef.current.set(i, tokens);
        if (delta.length) consume(delta);
      }
      // Forget transcripts for results the browser has discarded.
      for (const key of [...transcriptRef.current.keys()]) {
        if (key < startIndex - 2) transcriptRef.current.delete(key);
      }
    },
    [consume]
  );

  const recognition = useSpeechRecognition({
    lang,
    onResult: onSpeechResult,
    onStart: () => {
      startedAtRef.current = startedAtRef.current || Date.now();
      lastProgressAtRef.current = Date.now();
    },
  });

  const start = useCallback(() => {
    setTapMode(false);
    startedAtRef.current = Date.now();
    lastProgressAtRef.current = Date.now();
    lastIntervalAtRef.current = null;
    return recognition.start();
  }, [recognition]);

  const stop = useCallback(() => {
    recognition.stop();
  }, [recognition]);

  /* ---------------------------------------------------------------- */
  /* Stuck detection + live clocks                                     */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => {
      const now = Date.now();
      setElapsedMs(startedAtRef.current ? now - startedAtRef.current : 0);
      const next = trackerRef.current.wpm(now);
      if (next) setWpm(next);
      // Only offer help once reading has actually started, so a fresh page does
      // not immediately suggest the student is stuck on the first word.
      const armed = recognition.listening || wordsReadRef.current > 0;
      if (!armed) return;
      const offer = nextHelpOffer({
        cursor: cursorRef.current,
        lastProgressAt: lastProgressAtRef.current,
        now,
        stuckMs,
        alreadyOffered: offeredRef.current,
      });
      if (offer) {
        offeredRef.current = offer.wi;
        const word = wordsRef.current[offer.wi];
        if (word) {
          setHelpWord({ wi: offer.wi, word: word.text, idle: offer.idle });
          callbacks.current.onStuck?.(offer);
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [enabled, stuckMs, recognition.listening]);

  useEffect(() => {
    if (recentFlash) {
      const id = setTimeout(() => setRecentFlash(null), 900);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [recentFlash]);

  /* ---------------------------------------------------------------- */
  /* Manual controls (tap-to-read fallback + corrections)              */
  /* ---------------------------------------------------------------- */

  /** Advance the cursor by hand — used by tap-to-read and "I read it" taps. */
  const markWordRead = useCallback(
    (wi, { type = 'manual', word } = {}) => {
      const now = Date.now();
      if (!startedAtRef.current) startedAtRef.current = now;
      const target = Math.max(cursorRef.current, wi);
      const advanced = target - cursorRef.current + 1;
      cursorRef.current = target + 1;
      setCursor(target + 1);
      wordsReadRef.current += Math.max(1, advanced);
      setWordsRead(wordsReadRef.current);
      trackerRef.current.add(Math.max(1, advanced), now);
      noteInterval(now);
      lastProgressAtRef.current = now;
      offeredRef.current = null;
      setHelpWord(null);
      const wpmNow = trackerRef.current.wpm(now);
      if (wpmNow) setWpm(wpmNow);
      setRecentFlash({ wi: target, at: now });
      if (type !== 'manual' && type !== 'read') {
        const text = word || wordsRef.current[wi]?.text || '';
        recordFlag({ wi: target, type, word: text, atMs: now - (startedAtRef.current || now) });
      }
      const sentence = sentenceFor(cursorRef.current);
      callbacks.current.onProgress?.({
        cursor: cursorRef.current,
        wordsRead: wordsReadRef.current,
        wpm: trackerRef.current.wpm(now),
        sentence,
      });
      return cursorRef.current;
    },
    [noteInterval, recordFlag, sentenceFor]
  );

  const markDifficult = useCallback(
    (wi, word) => {
      recordFlag({ wi, type: 'difficult', word, atMs: Date.now() - (startedAtRef.current || Date.now()) });
      buzz(HAPTIC.gentle);
    },
    [recordFlag]
  );

  const setCursorTo = useCallback((wi) => {
    cursorRef.current = Math.max(0, wi);
    setCursor(cursorRef.current);
    pendingRef.current = [];
    transcriptRef.current.clear();
    lastProgressAtRef.current = Date.now();
    offeredRef.current = null;
    setHelpWord(null);
  }, []);

  const dismissHelp = useCallback(() => {
    offeredRef.current = cursorRef.current;
    setHelpWord(null);
  }, []);

  const reset = useCallback(() => {
    cursorRef.current = 0;
    wordsReadRef.current = 0;
    pendingRef.current = [];
    transcriptRef.current.clear();
    flagsRef.current = new Map();
    intervalsRef.current = [];
    lastIntervalAtRef.current = null;
    startedAtRef.current = null;
    trackerRef.current.reset();
    peakRef.current = null;
    setCursor(0);
    setWordsRead(0);
    setWpm(null);
    setFlags(new Map());
    setHelpWord(null);
    setElapsedMs(0);
    setLastHeard(null);
    recognition.setError?.(null);
  }, [recognition]);

  /** Drain queued flags for the server (called on a timer and at session end). */
  const drainFlags = useCallback(() => {
    const out = queueRef.current;
    queueRef.current = [];
    return out.map((f) => ({
      type: f.type,
      word: f.word,
      wordIndex: f.wi,
      confidence: f.confidence ?? null,
      heard: f.heard ?? null,
      atMs: Number.isFinite(f.atMs) ? f.atMs : null,
    }));
  }, []);

  const drainIntervals = useCallback(() => {
    const out = intervalsRef.current;
    intervalsRef.current = [];
    return out;
  }, []);

  const supported = recognition.supported;
  const progress = words.length ? Math.min(100, Math.round((cursor / words.length) * 100)) : 0;

  return useMemo(
    () => ({
      supported,
      listening: recognition.listening,
      micError: recognition.error,
      setMicError: recognition.setError,
      start,
      stop,
      cursor,
      cursorRef,
      flags,
      flagsRef,
      wpm,
      wordsRead,
      elapsedMs,
      peakWpm: peakRef.current,
      helpWord,
      dismissHelp,
      lastHeard,
      recentFlash,
      progress,
      tapMode,
      setTapMode,
      markWordRead,
      markDifficult,
      setCursorTo,
      reset,
      drainFlags,
      drainIntervals,
      statusText: recognition.listening
        ? 'Listening — read at your own pace'
        : wordsReadRef.current > 0 || tapMode
          ? 'Tapping along — every word you tap counts as read'
          : supported
            ? 'Ready when you are'
            : 'Listening is not available in this browser — tap words as you read',
    }),
    [
      cursor,
      tapMode,
      dismissHelp,
      drainFlags,
      drainIntervals,
      elapsedMs,
      flags,
      helpWord,
      lastHeard,
      markDifficult,
      markWordRead,
      progress,
      recentFlash,
      recognition.error,
      recognition.listening,
      recognition.setError,
      reset,
      setCursorTo,
      start,
      stop,
      supported,
      tapMode,
      wpm,
      wordsRead,
    ]
  );
}
