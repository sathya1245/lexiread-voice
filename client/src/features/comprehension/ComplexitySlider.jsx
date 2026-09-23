/**
 * "Explain Like I'm ___" — the complexity slider.
 *
 * Works on any explanation the app produces (a word's meaning, a summary, a
 * glossary entry). Levels are age 5 / 8 / 12 / adult; the text regenerates
 * through the server's offline rule-based simplifier, so different levels
 * genuinely read differently rather than just being relabelled.
 */

import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';
import { Pill } from '../../components/ui.jsx';
import { cx } from '../../lib/format.js';

export const LEVELS = [
  { value: 5, label: 'Age 5', hint: 'Very short, very concrete' },
  { value: 8, label: 'Age 8', hint: 'Simple everyday words' },
  { value: 12, label: 'Age 12', hint: 'Clear but complete' },
  { value: 'adult', label: 'Adult', hint: 'The full original wording' },
];

/** Client-side fallback so the slider still works if the server is unreachable. */
function localSimplify(text, level) {
  if (level === 'adult') return text;
  const sentences = String(text)
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  const limit = level === 5 ? 9 : level === 8 ? 14 : 20;
  return sentences
    .map((sentence) =>
      sentence
        .split(/[,;]|\s+(?=and |but |because |which )/i)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, level === 5 ? 2 : level === 8 ? 3 : 4)
        .join(', ')
    )
    .map((s) => {
      const words = s.split(/\s+/);
      const trimmed = words.length > limit ? `${words.slice(0, limit).join(' ')}` : s;
      return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
    })
    .join(' ');
}

export function ComplexitySlider({
  text,
  label = 'Explain like',
  onChange,
  initial = 8,
  compact = false,
  className,
}) {
  const [level, setLevel] = useState(initial);
  const [value, setValue] = useState(text || '');
  const [pending, setPending] = useState(false);
  const [source, setSource] = useState('original');
  const requestId = useRef(0);

  useEffect(() => {
    setValue(text || '');
    setLevel(initial);
    setSource('original');
  }, [text, initial]);

  useEffect(() => {
    if (!text) return undefined;
    if (level === initial && source === 'original') return undefined;
    let cancelled = false;
    const id = ++requestId.current;
    setPending(true);
    api
      .post('/simplify', { text, level })
      .then(({ result }) => {
        if (cancelled || id !== requestId.current) return;
        setValue(result?.text || localSimplify(text, level));
        setSource('server');
      })
      .catch(() => {
        if (cancelled || id !== requestId.current) return;
        setValue(localSimplify(text, level));
        setSource('local');
      })
      .finally(() => {
        if (!cancelled && id === requestId.current) setPending(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, text]);

  useEffect(() => {
    onChange?.({ level, text: value });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cx('rounded-xl border border-[var(--lr-rule)] bg-[var(--lr-surface-2)] p-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-[var(--lr-ink-soft)]">{label}</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Explanation reading level">
          {LEVELS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={level === option.value}
              title={option.hint}
              onClick={() => setLevel(option.value)}
              className={cx(
                'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                level === option.value
                  ? 'bg-[var(--lr-accent)] text-[var(--lr-accent-ink)]'
                  : 'bg-[var(--lr-surface)] text-[var(--lr-ink-soft)] hover:text-[var(--lr-ink)]'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <p
        aria-live="polite"
        className={cx('mt-2 text-[0.95rem] leading-relaxed', compact ? 'text-sm' : '')}
      >
        {pending ? <span className="text-[var(--lr-ink-soft)]">Rewriting…</span> : value}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <Pill>{LEVELS.find((l) => l.value === level)?.hint}</Pill>
        {source === 'local' ? <Pill>worked offline</Pill> : null}
      </div>
    </div>
  );
}
