/**
 * Thin, defensive wrapper around the browser SpeechRecognition API.
 *
 * Chrome, Edge and Android Chrome expose it (webkit-prefixed); Firefox and
 * desktop Safari do not. The hook reports support so the UI can offer the
 * tap-to-read fallback instead of failing silently.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useSpeechRecognition({ lang = 'en-US', onResult, onEnd, onError, onStart } = {}) {
  const [supported] = useState(() => Boolean(getSpeechRecognitionCtor()));
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const wantListeningRef = useRef(false);
  const handlers = useRef({ onResult, onEnd, onError, onStart });
  handlers.current = { onResult, onEnd, onError, onStart };

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
    setListening(false);
  }, []);

  const start = useCallback(
    (options = {}) => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        setError('This browser cannot listen to speech. Use Chrome or Edge, or tap the words as you read.');
        return false;
      }
      stop();
      const rec = new Ctor();
      rec.lang = options.lang || lang;
      rec.continuous = options.continuous ?? true;
      rec.interimResults = options.interimResults ?? true;
      rec.maxAlternatives = 1;

      rec.onresult = (event) => handlers.current.onResult?.(event);
      rec.onerror = (event) => {
        const code = event?.error;
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setError('The microphone is blocked. Allow microphone access for this page, or tap the words as you read.');
          wantListeningRef.current = false;
          setListening(false);
        } else if (code === 'no-speech') {
          // entirely normal while a student thinks — stay quiet
        } else if (code === 'audio-capture') {
          setError('No microphone was found. You can still tap each word as you read it.');
        } else if (code !== 'aborted') {
          setError(`Listening stopped (${code || 'unknown'}). Tap Listen to try again.`);
        }
        handlers.current.onError?.(event);
      };
      rec.onend = () => {
        handlers.current.onEnd?.(wantListeningRef.current);
        // Some browsers end the stream after a pause; restart if the student
        // is still in a listening session.
        if (wantListeningRef.current) {
          setTimeout(() => {
            if (!wantListeningRef.current) return;
            try {
              rec.start();
              setListening(true);
            } catch {
              /* already restarting */
            }
          }, 250);
        } else {
          setListening(false);
        }
      };

      recognitionRef.current = rec;
      wantListeningRef.current = true;
      setError(null);
      try {
        rec.start();
        setListening(true);
        handlers.current.onStart?.();
        return true;
      } catch (err) {
        setError('Could not start listening. Tap Listen to try again.');
        return false;
      }
    },
    [lang, stop]
  );

  useEffect(() => () => stop(), [stop]);

  return { supported, listening, error, start, stop, setError };
}
