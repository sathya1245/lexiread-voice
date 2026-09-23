/**
 * Text-to-speech (narrated mode) with word-sync highlighting.
 *
 * Uses the browser's own SpeechSynthesis. Word boundaries are reported by
 * Chrome/Edge/Safari through `onboundary`; where that is unreliable we fall
 * back to a timing estimate so the highlight still tracks the voice.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { wordAtChar } from '../../lib/wordOffsets.js';

export function useTts({ text = '', wordOffsets = [], onChangeWord, onFinish, rate = 0.95, pitch = 1, voiceURI = null } = {}) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [voices, setVoices] = useState([]);
  const [currentWord, setCurrentWord] = useState(null);
  const boundarySeenRef = useRef(false);
  const estimateTimerRef = useRef(null);
  const baseOffsetRef = useRef(0);
  const startRef = useRef(0);
  const callbacks = useRef({ onChangeWord, onFinish });
  callbacks.current = { onChangeWord, onFinish };
  const settings = useRef({ rate, pitch, voiceURI });
  settings.current = { rate, pitch, voiceURI };
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    if (!supported) return undefined;
    const load = () => setVoices(window.speechSynthesis.getVoices() || []);
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
    const timer = setTimeout(load, 400);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', load);
      clearTimeout(timer);
    };
  }, [supported]);

  const englishVoices = useMemo(
    () => voices.filter((v) => /^en/i.test(v.lang)).sort((a, b) => a.name.localeCompare(b.name)),
    [voices]
  );

  const clearEstimate = () => {
    if (estimateTimerRef.current) clearInterval(estimateTimerRef.current);
    estimateTimerRef.current = null;
  };

  const stop = useCallback(() => {
    if (!supported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* nothing speaking */
    }
    clearEstimate();
    setSpeaking(false);
    setPaused(false);
    setCurrentWord(null);
  }, [supported]);

  const startEstimateFallback = useCallback(() => {
    if (estimateTimerRef.current) return;
    const startedAt = Date.now();
    const startWord = wordAtChar(wordOffsets, baseOffsetRef.current);
    estimateTimerRef.current = setInterval(() => {
      const { rate: r } = settings.current;
      // ~170 words per minute at rate 1, adjusted by the user's speed.
      const wordsSpoken = ((Date.now() - startedAt) / 60000) * 170 * r;
      const wi = startWord + Math.floor(wordsSpoken);
      setCurrentWord(wi);
      callbacks.current.onChangeWord?.(wi);
    }, 220);
  }, [wordOffsets]);

  const speakFrom = useCallback(
    (fromWord = 0) => {
      if (!supported || !textRef.current.trim()) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      clearEstimate();
      const offset = wordOffsets[fromWord] ?? 0;
      baseOffsetRef.current = offset;
      const utter = new SpeechSynthesisUtterance(textRef.current.slice(offset));
      utter.rate = settings.current.rate;
      utter.pitch = settings.current.pitch;
      utter.lang = 'en-US';
      const voice = englishVoices.find((v) => v.voiceURI === settings.current.voiceURI);
      if (voice) utter.voice = voice;

      boundarySeenRef.current = false;
      startRef.current = Date.now();
      utter.onstart = () => {
        setSpeaking(true);
        setPaused(false);
        setCurrentWord(fromWord);
        callbacks.current.onChangeWord?.(fromWord);
      };
      utter.onboundary = (event) => {
        if (event.name && event.name !== 'word') return;
        boundarySeenRef.current = true;
        clearEstimate();
        const wi = wordAtChar(wordOffsets, baseOffsetRef.current + (event.charIndex || 0));
        setCurrentWord(wi);
        callbacks.current.onChangeWord?.(wi);
      };
      utter.onend = () => {
        clearEstimate();
        setSpeaking(false);
        setPaused(false);
        setCurrentWord(null);
        callbacks.current.onFinish?.();
      };
      utter.onerror = (event) => {
        if (event?.error === 'interrupted' || event?.error === 'canceled') return;
        clearEstimate();
        setSpeaking(false);
      };

      synth.speak(utter);
      // Safari/iOS often never fire onboundary: start the timing estimate.
      setTimeout(() => {
        if (!boundarySeenRef.current && window.speechSynthesis.speaking) startEstimateFallback();
      }, 1400);
    },
    [englishVoices, startEstimateFallback, supported, wordOffsets]
  );

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setPaused(true);
    clearEstimate();
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
    setPaused(false);
  }, [supported]);

  useEffect(() => () => {
    clearEstimate();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  return {
    supported,
    speaking,
    paused,
    currentWord,
    voices: englishVoices,
    speakFrom,
    pause,
    resume,
    stop,
  };
}

/** One-off utterance for a single word ("tap to hear this word"). */
export function speakWord(word, { rate = 0.85, pitch = 1, voiceURI = null } = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !word) return false;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(String(word));
    utter.rate = rate;
    utter.pitch = pitch;
    utter.lang = 'en-US';
    const voice = (synth.getVoices() || []).find((v) => v.voiceURI === voiceURI);
    if (voice) utter.voice = voice;
    synth.speak(utter);
    return true;
  } catch {
    return false;
  }
}

export function speakSequence(parts, { rate = 0.9, gapMs = 260 } = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  parts.forEach((part, index) => {
    const utter = new SpeechSynthesisUtterance(String(part));
    utter.rate = rate;
    utter.lang = 'en-US';
    if (index > 0) {
      // A short pause between syllable beats helps the reader hear the pieces.
      const start = utter.onstart;
      utter.onstart = (e) => {
        start?.(e);
      };
    }
    synth.speak(utter);
    if (gapMs > 0) synth.speak(new SpeechSynthesisUtterance(', '));
  });
  return true;
}
