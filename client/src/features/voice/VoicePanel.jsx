/**
 * Voice-following control panel.
 *
 * Encouraging, never punitive: the pace meter celebrates progress, the help
 * chip is quiet and optional, and no error is ever shown in red with an X.
 */

import { Alert, Button, Pill, ProgressBar } from '../../components/ui.jsx';
import { cx, formatDuration } from '../../lib/format.js';

function PaceMeter({ wpm, peak, wordsRead }) {
  const band = wpm == null ? 'unknown' : wpm < 40 ? 'steady' : wpm < 90 ? 'flowing' : 'flying';
  const labels = {
    unknown: 'Waiting for your voice',
    steady: 'Steady reading',
    flowing: 'Nice flow',
    flying: 'Fast and smooth',
  };
  return (
    <div className="flex items-center gap-3" aria-live="off">
      <div className="text-center">
        <p className="text-2xl font-bold tabular-nums leading-none">{wpm ?? '–'}</p>
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--lr-ink-soft)]">words/min</p>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{labels[band]}</p>
        <p className="text-xs text-[var(--lr-ink-soft)]">
          {wordsRead} words read{peak ? ` · best ${peak} wpm` : ''}
        </p>
      </div>
    </div>
  );
}

export function VoicePanel({
  supported,
  listening,
  onStart,
  onStop,
  wpm,
  peakWpm,
  wordsRead,
  elapsedMs,
  progress,
  totalWords,
  statusText,
  helpWord,
  onHearHelp,
  onDismissHelp,
  micError,
  onTapMode,
  showLegend,
  flags,
  haptics,
  stuckMs,
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {listening ? (
            <Button onClick={onStop} variant="danger" size="lg">
              <span aria-hidden="true">■</span> Stop listening
            </Button>
          ) : (
            <Button onClick={onStart} size="lg" disabled={!supported}>
              <span aria-hidden="true">🎙️</span> Start reading out loud
            </Button>
          )}
          <Button variant="secondary" size="lg" onClick={onTapMode}>
            Tap each word instead
          </Button>
        </div>
        <PaceMeter wpm={wpm} peak={peakWpm} wordsRead={wordsRead} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-xs text-[var(--lr-ink-soft)]">
          <span aria-live="polite">{statusText}</span>
          <span className="tabular-nums">
            {totalWords ? `${wordsRead}/${totalWords} words · ` : ''}
            {formatDuration(elapsedMs)}
          </span>
        </div>
        <ProgressBar value={progress} label="Reading progress" />
      </div>

      {helpWord ? (
        <div className="lr-rise flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--lr-accent)] bg-[var(--lr-accent-soft)] p-3">
          <p className="text-sm font-semibold">
            Take your time. Want to hear <span className="underline decoration-dotted">{helpWord.word}</span> first?
          </p>
          <Button size="sm" onClick={() => onHearHelp(helpWord)}>
            🔊 Tap to hear this word
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismissHelp}>
            I've got it
          </Button>
        </div>
      ) : null}

      {micError ? (
        <Alert tone="gentle" title="Microphone">
          <p>{micError}</p>
        </Alert>
      ) : null}

      {!supported ? (
        <Alert tone="gentle" title="Listening needs Chrome, Edge or Android Chrome">
          <p>
            You can still read here: tap each word as you say it and LexiRead will follow your taps, flag tricky
            words and keep the same practice history.
          </p>
        </Alert>
      ) : null}

      <p className={cx('text-xs text-[var(--lr-ink-soft)]')}>
        Quiet help after {Math.round(stuckMs / 1000)}s · {haptics ? 'haptics on' : 'haptics off'} · press{' '}
        <kbd className="rounded bg-[var(--lr-surface-2)] px-1">H</kbd> to hear the word your cursor is on.
      </p>

    </div>
  );
}
