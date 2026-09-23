/**
 * Comprehension support panel: key points, glossary and a reading-difficulty
 * read-out. Every explanation carries the "Explain Like I'm ___" slider.
 */

import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Alert, Button, Pill, SectionTitle, SegmentedControl, Spinner } from '../../components/ui.jsx';
import { cx } from '../../lib/format.js';
import { speakWord } from '../tts/useTts.js';
import { ComplexitySlider } from './ComplexitySlider.jsx';

export function ComprehensionPanel({ documentId, text, speech, onJumpTo, onHearWord }) {
  const [tab, setTab] = useState('summary');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [openTerm, setOpenTerm] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    api
      .post('/summarize', { documentId, text: documentId ? undefined : text })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, text]);

  if (status === 'loading') {
    return (
      <div className="p-4">
        <Spinner label="Finding the main ideas…" />
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="p-4">
        <Alert tone="gentle" title="Could not build the summary">
          {error}
        </Alert>
      </div>
    );
  }

  const summary = data?.summary;
  const glossary = data?.glossary || [];

  return (
    <div className="space-y-3 p-1">
      <SegmentedControl
        label="Comprehension view"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'summary', label: 'Key points' },
          { value: 'glossary', label: `Glossary${glossary.length ? ` (${glossary.length})` : ''}` },
        ]}
      />

      {tab === 'summary' ? (
        <div className="space-y-3">
          {summary?.difficulty ? (
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="accent">{summary.difficulty.label}</Pill>
              <Pill>{summary.stats.words} words</Pill>
              <Pill>~{summary.stats.readingMinutes} min</Pill>
              <Pill>{summary.stats.avgWordsPerSentence} words per sentence</Pill>
            </div>
          ) : null}

          {summary?.keyPoints?.length ? (
            <>
              <SectionTitle hint="Each point is a sentence from your own text — tap Go to jump to it.">
                The main ideas
              </SectionTitle>
              <ol className="space-y-2">
                {summary.keyPoints.map((point, index) => (
                  <li
                    key={`${point.wi}-${index}`}
                    className="flex gap-3 rounded-xl border border-[var(--lr-rule)] bg-[var(--lr-surface)] p-3"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--lr-accent-soft)] text-sm font-bold"
                    >
                      {index + 1}
                    </span>
                    <div className="space-y-1.5">
                      <p className="text-[0.95rem] leading-relaxed">{point.text}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => onJumpTo?.(point.wi)}>
                          Go to it
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => speakWord(point.text, speech)}>
                          🔊 Read it to me
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <ComplexitySlider
                label="Explain these like I'm"
                text={summary.keyPoints.map((p) => p.text).join(' ')}
                initial={8}
              />
            </>
          ) : (
            <Alert tone="gentle">Not enough text yet for key points. Add a longer passage and try again.</Alert>
          )}

          {summary?.topicWords?.length ? (
            <div>
              <SectionTitle level={3} hint="The words this text keeps coming back to.">
                Word cloud (of ideas)
              </SectionTitle>
              <ul className="flex flex-wrap gap-1.5">
                {summary.topicWords.map((topic) => (
                  <li key={topic.word}>
                    <Pill>{topic.word}</Pill>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          {glossary.length === 0 ? (
            <Alert tone="gentle">No technical terms jumped out — this text uses everyday words.</Alert>
          ) : null}
          {glossary.map((term) => {
            const open = openTerm === term.term;
            return (
              <div key={term.term} className="rounded-xl border border-[var(--lr-rule)] bg-[var(--lr-surface)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-base">{term.term}</strong>
                    {term.isAcronym ? <Pill>short form</Pill> : null}
                    {term.syllables?.length > 1 ? <Pill>{term.syllables.length} beats</Pill> : null}
                    {term.count > 1 ? <Pill>used {term.count}×</Pill> : null}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-expanded={open}
                      onClick={() => setOpenTerm(open ? null : term.term)}
                    >
                      {open ? 'Less' : 'More'}
                    </Button>
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() => {
                        speakWord(term.term, speech);
                        onHearWord?.(term);
                      }}
                    >
                      🔊
                      <span className="sr-only">Hear {term.term}</span>
                    </Button>
                  </div>
                </div>
                <p className={cx('mt-1.5 text-[0.95rem] leading-relaxed')}>{term.short || term.definition}</p>
                {open ? (
                  <div className="mt-2 space-y-2">
                    {term.syllables?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {term.syllables.map((part) => (
                          <Pill key={part} tone="accent">
                            {part}
                          </Pill>
                        ))}
                      </div>
                    ) : null}
                    <ComplexitySlider text={term.definition || term.short} compact label="Explain like" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
