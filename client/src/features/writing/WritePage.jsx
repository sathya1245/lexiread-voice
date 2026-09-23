/**
 * Writing helper.
 *
 * Type or dictate a sentence, then check it. Suggestions are phrased the way a
 * friendly teacher would say them — no grammar jargon, no red crosses — and
 * each fix can be applied with one tap. "Read back my writing" uses the same
 * speech system as Listen mode.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api.js';
import { Alert, Button, Card, Pill, SectionTitle, Spinner, TextArea } from '../../components/ui.jsx';
import { cx } from '../../lib/format.js';
import { usePrefs } from '../../state/PrefsContext.jsx';
import { getSpeechRecognitionCtor } from '../voice/useSpeechRecognition.js';
import { speakWord } from '../tts/useTts.js';

const SEVERITY = {
  fix: { label: 'Worth fixing', className: 'border-l-4 border-[var(--lr-flag-close)]' },
  check: { label: 'Have a look', className: 'border-l-4 border-[var(--lr-flag-skip)]' },
  idea: { label: 'Idea', className: 'border-l-4 border-[var(--lr-flag-hard)]' },
};

export function WritePage() {
  const { prefs } = usePrefs();
  const [text, setText] = useState('');
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [dictating, setDictating] = useState(false);
  const [draft, setDraft] = useState('');
  const recognitionRef = useRef(null);
  const textRef = useRef(text);
  textRef.current = text;

  const dictationSupported = Boolean(getSpeechRecognitionCtor());

  const startDictation = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError('This browser cannot turn speech into text. Chrome and Edge can.');
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (event) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (finalText) {
        setText((current) => `${current}${current && !/\s$/.test(current) ? ' ' : ''}${finalText.trim()}`);
        setDraft('');
      } else {
        setDraft(interim);
      }
    };
    rec.onerror = (event) => {
      if (event.error === 'not-allowed') setError('The microphone is blocked. Allow access, then try again.');
    };
    rec.onend = () => setDictating(false);
    recognitionRef.current = rec;
    rec.start();
    setDictating(true);
    setError(null);
  }, []);

  const stopDictation = useCallback(() => {
    recognitionRef.current?.stop();
    setDictating(false);
    setDraft('');
  }, []);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const runCheck = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post('/writing/check', { text });
      setCheck(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [text]);

  const applySuggestion = useCallback((issue) => {
    if (!issue.suggestion) return;
    setText((current) => {
      const before = current.slice(0, issue.index);
      const after = current.slice(issue.index + issue.length);
      return `${before}${issue.suggestion}${after}`;
    });
    setCheck(null);
  }, []);

  const words = useMemo(() => text.split(/\s+/).filter(Boolean).length, [text]);
  const paragraphs = useMemo(() => text.split(/\n{2,}/).filter((p) => p.trim()), [text]);

  return (
    <div className="mx-auto max-w-4xl px-3 py-6 sm:px-4">
      <SectionTitle
        level={1}
        hint="Write or dictate your answer, then check it and hear it back. Nothing is marked as wrong — you get suggestions."
      >
        Writing helper
      </SectionTitle>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card className="space-y-3">
          <label htmlFor="writing-box" className="text-sm font-semibold">
            My writing
          </label>
          <TextArea
            id="writing-box"
            rows={12}
            value={draft ? `${text}${text && !/\s$/.test(text) ? ' ' : ''}${draft}` : text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Start typing, or tap Dictate and speak."
            className="min-h-[16rem] text-[1.05rem]"
          />
          <div className="flex flex-wrap items-center gap-2">
            {dictating ? (
              <Button variant="danger" onClick={stopDictation}>
                ■ Stop dictating
              </Button>
            ) : (
              <Button variant="secondary" onClick={startDictation} disabled={!dictationSupported}>
                🎙️ Dictate
              </Button>
            )}
            <Button onClick={runCheck} disabled={busy || !text.trim()}>
              ✓ Check my writing
            </Button>
            <Button
              variant="soft"
              onClick={() => speakWord(text, { rate: prefs.speechRate, pitch: prefs.speechPitch, voiceURI: prefs.voiceURI })}
              disabled={!text.trim()}
            >
              🔊 Read back my writing
            </Button>
            <Button variant="ghost" onClick={() => setText('')} disabled={!text}>
              Clear
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--lr-ink-soft)]">
            <Pill>{words} words</Pill>
            <Pill>{paragraphs.length} paragraph{paragraphs.length === 1 ? '' : 's'}</Pill>
            {dictating ? <Pill tone="accent">Listening… speak naturally</Pill> : null}
            {!dictationSupported ? <Pill>Dictation needs Chrome or Edge</Pill> : null}
          </div>
          {error ? <Alert tone="warning">{error}</Alert> : null}
        </Card>

        <div className="space-y-3">
          {busy ? (
            <Card>
              <Spinner label="Looking over your writing…" />
            </Card>
          ) : null}

          {check ? (
            <>
              <Card>
                <SectionTitle level={2}>How it reads</SectionTitle>
                <p className="text-sm leading-relaxed">{check.encouragement}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Pill tone="accent">{check.counts.total} suggestion{check.counts.total === 1 ? '' : 's'}</Pill>
                  <Pill>{check.stats.avgSentenceLength} words per sentence</Pill>
                  {check.stats.longWordShare > 0.2 ? <Pill>lots of long words</Pill> : null}
                </div>
              </Card>

              {check.issues.length === 0 ? (
                <Alert tone="gentle" title="Looking good">
                  Nothing jumped out. Read it aloud with the Read back button — your ears often catch what eyes miss.
                </Alert>
              ) : (
                <ul className="space-y-2">
                  {check.issues.map((issue, index) => {
                    const style = SEVERITY[issue.severity] || SEVERITY.idea;
                    return (
                      <li
                        key={`${issue.type}-${issue.index}-${index}`}
                        className={cx('rounded-xl border border-[var(--lr-rule)] bg-[var(--lr-surface)] p-3', style.className)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--lr-ink-soft)]">
                              {style.label} · {issue.type.replace('-', ' ')}
                            </p>
                            <p className="mt-1 text-sm leading-relaxed">{issue.message}</p>
                            {issue.sentence ? (
                              <p className="mt-1 text-xs italic text-[var(--lr-ink-soft)]">
                                …{issue.sentence.slice(0, 90)}…
                              </p>
                            ) : null}
                          </div>
                          {issue.suggestion ? (
                            <Button size="sm" variant="soft" onClick={() => applySuggestion(issue)}>
                              Use “{issue.suggestion.trim()}”
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <Alert tone="gentle" title="What happens when you check">
              LexiRead looks for common spelling slips, doubled words, missing capital letters, long sentences and
              sound-alike words. You stay in charge of every change.
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
