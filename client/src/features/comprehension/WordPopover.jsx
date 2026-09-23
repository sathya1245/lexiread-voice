/**
 * The word card.
 *
 * Tap any word in the reading view and this opens: a plain-language meaning,
 * the word split into beats you can hear one at a time, the "Explain Like I'm
 * ___" slider, and a way to mark the word as tricky for later practice.
 */

import { useEffect, useState } from 'react';
import { analyzeWord, syllabify } from '@lexiread/core';
import { api } from '../../lib/api.js';
import { Alert, Button, Pill, Spinner } from '../../components/ui.jsx';
import { speakSequence, speakWord } from '../tts/useTts.js';
import { ComplexitySlider } from './ComplexitySlider.jsx';

export function WordPopover({ word, onClose, onMarkDifficult, speech = {}, onWordLoaded }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!word) return undefined;
    let cancelled = false;
    setStatus('loading');
    setError(null);
    const local = {
      word,
      syllables: syllabify(word),
      phonics: analyzeWord(word),
      meanings: [],
      explanations: {},
      source: 'none',
    };
    setData(local);
    api
      .get(`/dictionary/${encodeURIComponent(word)}`)
      .then((result) => {
        if (cancelled) return;
        setData({ ...local, ...result });
        setStatus('ready');
        onWordLoaded?.(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setStatus('ready');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word]);

  if (!word) return null;

  const syllables = data?.syllables?.length ? data.syllables : [word];
  const primary = data?.meanings?.[0];
  const meaning = data?.explanations?.['8'] || primary?.simple || primary?.definition || '';

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={`Meaning of ${word}`}
      className="lr-rise fixed inset-x-3 bottom-3 z-40 mx-auto max-w-2xl rounded-2xl border border-[var(--lr-rule)] bg-[var(--lr-surface)] p-4 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{word}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {syllables.map((part) => (
              <Pill key={part} tone="accent">
                {part}
              </Pill>
            ))}
            {data?.phonics?.digraphs?.length ? <Pill>{data.phonics.digraphs.join(', ')} sound</Pill> : null}
            {data?.phonics?.reversalRisk ? <Pill>b / d / p / q letters</Pill> : null}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close word card">
          ✕
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="soft" onClick={() => speakWord(word, speech)}>
          🔊 Hear the word
        </Button>
        <Button size="sm" variant="soft" onClick={() => speakSequence(syllables, { rate: speech.rate || 0.9 })}>
          🥁 Hear it in beats
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onMarkDifficult?.(word)}>
          🔖 Mark as tricky
        </Button>
      </div>

      <div className="mt-3">
        {status === 'loading' ? (
          <Spinner label="Looking up the meaning…" />
        ) : (
          <div className="space-y-2">
            {data?.phonetic ? <p className="text-sm text-[var(--lr-ink-soft)]">Said: {data.phonetic}</p> : null}
            {primary?.pos ? <p className="text-xs font-bold uppercase tracking-wide text-[var(--lr-ink-soft)]">{primary.pos}</p> : null}
            <p className="text-base leading-relaxed">{meaning}</p>
            {primary?.example ? <p className="text-sm italic text-[var(--lr-ink-soft)]">“{primary.example}”</p> : null}
            {data && data.found === false ? (
              <Alert tone="gentle">
                A dictionary meaning was not available, so this is worked out from how the word is built. Tap “Hear it
                in beats” to sound it out.
              </Alert>
            ) : null}
            {error ? <Alert tone="gentle">{error}</Alert> : null}
          </div>
        )}
      </div>

      {meaning ? (
        <ComplexitySlider className="mt-3" text={meaning} initial={8} label="Explain like" />
      ) : null}
    </div>
  );
}
