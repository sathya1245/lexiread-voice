/**
 * Practice mini-game built from the student's own flagged words.
 *
 * Three round types, all tap/click/keyboard based (never drag-only):
 *   match  — pair the word with its meaning,
 *   beats  — tap the syllable beats in order,
 *   family — find the word with the tricky sound.
 *
 * Feedback is encouraging: a mismatch simply un-selects and the student tries
 * again, with a haptic "gentle" buzz and a soft colour change.
 */

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Pill, ProgressBar, SectionTitle } from '../../components/ui.jsx';
import { cx } from '../../lib/format.js';
import { HAPTIC, buzz } from '../../lib/haptics.js';
import { speakSequence, speakWord } from '../tts/useTts.js';

function MatchRound({ round, speech }) {
  const [selectedWord, setSelectedWord] = useState(null);
  const [matched, setMatched] = useState(() => new Set());
  const [shake, setShake] = useState(null);

  const tryMatch = (meaningWord) => {
    if (!selectedWord) return;
    if (meaningWord === selectedWord) {
      const next = new Set(matched).add(selectedWord);
      setMatched(next);
      setSelectedWord(null);
      buzz(HAPTIC.hardWord);
    } else {
      setShake(meaningWord);
      setTimeout(() => setShake(null), 500);
      buzz(HAPTIC.gentle);
    }
  };

  const done = matched.size === round.pairs.length;

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{round.prompt}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <ul className="space-y-2" aria-label="Practice words">
          {round.words.map((word) => {
            const isMatched = matched.has(word);
            return (
              <li key={word}>
                <button
                  type="button"
                  aria-pressed={selectedWord === word}
                  disabled={isMatched}
                  onClick={() => {
                    setSelectedWord(word);
                    speakWord(word, speech);
                  }}
                  className={cx(
                    'w-full rounded-xl border p-3 text-left font-bold transition-colors',
                    isMatched
                      ? 'border-[var(--lr-accent)] bg-[var(--lr-read)] text-[var(--lr-read-ink)]'
                      : selectedWord === word
                        ? 'border-[var(--lr-accent)] bg-[var(--lr-accent-soft)]'
                        : 'border-[var(--lr-rule)] bg-[var(--lr-surface)]'
                  )}
                >
                  {isMatched ? '✓ ' : ''}
                  {word}
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="space-y-2" aria-label="Meanings">
          {round.meanings.map((meaning) => {
            const isMatched = matched.has(meaning.word);
            return (
              <li key={meaning.word}>
                <button
                  type="button"
                  disabled={isMatched}
                  onClick={() => tryMatch(meaning.word)}
                  className={cx(
                    'w-full rounded-xl border p-3 text-left text-sm transition-colors',
                    isMatched
                      ? 'border-[var(--lr-accent)] bg-[var(--lr-read)] text-[var(--lr-read-ink)]'
                      : shake === meaning.word
                        ? 'border-[var(--lr-flag-close)] bg-[var(--lr-surface-2)]'
                        : 'border-[var(--lr-rule)] bg-[var(--lr-surface)]'
                  )}
                >
                  {meaning.hint}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {done ? (
        <p role="status" className="rounded-xl bg-[var(--lr-read)] p-3 text-sm font-semibold text-[var(--lr-read-ink)]">
          ✓ All matched — read each word out loud one more time while it is still fresh.
        </p>
      ) : null}
    </div>
  );
}

function BeatsRound({ round, speech }) {
  const [progress, setProgress] = useState({});
  const [notice, setNotice] = useState(null);

  const build = (item, index) => {
    const current = progress[index] || [];
    return current.map((i) => item.shuffled[i]).join(' · ');
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{round.prompt}</p>
      <ul className="space-y-3">
        {round.items.map((item, index) => {
          const chosen = progress[index] || [];
          const parts = item.parts;
          const complete = chosen.length === parts.length && chosen.map((i) => item.shuffled[i]).join('') === parts.join('');
          const full = chosen.length >= parts.length;
          return (
            <li key={item.word} className="rounded-xl border border-[var(--lr-rule)] bg-[var(--lr-surface)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">
                  {item.word}{' '}
                  <span className="text-xs font-normal text-[var(--lr-ink-soft)]">
                    ({parts.length} beats)
                  </span>
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => speakWord(item.word, speech)}>
                    🔊 Hear it
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => speakSequence(parts, { rate: 0.85 })}>
                    🥁 Hear the beats
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2" aria-label={`Beats for ${item.word}`}>
                {item.shuffled.map((part, partIndex) => {
                  const used = chosen.includes(partIndex);
                  return (
                    <button
                      key={`${part}-${partIndex}`}
                      type="button"
                      disabled={used || complete}
                      onClick={() => {
                        const next = [...chosen, partIndex];
                        setProgress((current) => ({ ...current, [index]: next }));
                        const guess = next.map((i) => item.shuffled[i]).join('');
                        const expected = parts.slice(0, next.length).join('');
                        if (guess !== expected) {
                          setNotice(`Not quite — try ${parts[0]} first.`);
                          buzz(HAPTIC.gentle);
                        } else if (next.length === parts.length) {
                          setNotice('That is it! Say it once more, slowly.');
                          buzz(HAPTIC.hardWord);
                        }
                      }}
                      className={cx(
                        'rounded-xl border px-3 py-2 text-sm font-semibold',
                        used ? 'border-[var(--lr-accent)] bg-[var(--lr-read)] text-[var(--lr-read-ink)]' : 'border-[var(--lr-rule)]'
                      )}
                    >
                      {part}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-sm" aria-live="polite">
                {complete ? (
                  <span className="font-semibold">✓ {parts.join(' · ')}</span>
                ) : (
                  <>Building: {build(item, index) || '—'}</>
                )}
              </p>
              {full && !complete ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => {
                    setProgress((current) => ({ ...current, [index]: [] }));
                    setNotice(null);
                  }}
                >
                  Try that one again
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {notice ? (
        <p role="status" className="text-sm text-[var(--lr-ink-soft)]">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

function FamilyRound({ round, speech }) {
  const [picked, setPicked] = useState(() => new Set());
  const correct = useMemo(() => new Set(round.answers), [round.answers]);

  const toggle = (word) => {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(word)) next.delete(word);
      else {
        next.add(word);
        if (correct.has(word)) buzz(HAPTIC.hardWord);
        else buzz(HAPTIC.gentle);
      }
      return next;
    });
    speakWord(word, speech);
  };

  const foundAll = [...correct].every((word) => picked.has(word));

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{round.prompt}</p>
      <ul className="flex flex-wrap gap-2">
        {round.options.map((word) => {
          const isCorrect = correct.has(word);
          const isPicked = picked.has(word);
          return (
            <li key={word}>
              <button
                type="button"
                aria-pressed={isPicked}
                onClick={() => toggle(word)}
                className={cx(
                  'rounded-xl border px-3 py-2 font-semibold',
                  isPicked && isCorrect
                    ? 'border-[var(--lr-accent)] bg-[var(--lr-read)] text-[var(--lr-read-ink)]'
                    : isPicked
                      ? 'border-[var(--lr-flag-close)] bg-[var(--lr-surface-2)]'
                      : 'border-[var(--lr-rule)] bg-[var(--lr-surface)]'
                )}
              >
                {isPicked && isCorrect ? '✓ ' : ''}
                {word}
              </button>
            </li>
          );
        })}
      </ul>
      {foundAll ? (
        <p role="status" className="text-sm font-semibold">
          ✓ Found them all. Notice how your mouth moves for “{round.family}” in each one.
        </p>
      ) : (
        <p className="text-sm text-[var(--lr-ink-soft)]">
          Tap each word to hear it, then keep the ones that share the sound.
        </p>
      )}
    </div>
  );
}

export function PracticeGame({ game, speech, onReload, loading }) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    setRoundIndex(0);
    setFinished(false);
  }, [game]);

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-[var(--lr-ink-soft)]">Building a game from the words you found tricky…</p>
      </Card>
    );
  }
  if (!game || game.empty) {
    return (
      <Card>
        <SectionTitle level={2} hint={game?.subtitle || 'Read something in voice mode first.'}>
          Practice game
        </SectionTitle>
        <p className="text-sm text-[var(--lr-ink-soft)]">
          Your own tricky words become a game here. Nothing generic — it uses exactly the words that slowed you down.
        </p>
      </Card>
    );
  }

  const round = game.rounds[roundIndex];
  const last = roundIndex >= game.rounds.length - 1;

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle level={2} hint={game.subtitle}>
          {game.title}
        </SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Pill tone="accent">
            Round {Math.min(roundIndex + 1, game.rounds.length)} of {game.rounds.length}
          </Pill>
          <Button size="sm" variant="ghost" onClick={onReload} disabled={loading}>
            Rebuild
          </Button>
        </div>
      </div>

      <ProgressBar value={((roundIndex + (finished ? 1 : 0)) / Math.max(1, game.rounds.length)) * 100} label="Game progress" />

      {finished ? (
        <div className="space-y-2">
          <p className="font-semibold">🎉 All rounds done — that is real practice.</p>
          <ul className="flex flex-wrap gap-2">
            {game.words.map((word) => (
              <li key={word.word}>
                <Button size="sm" variant="soft" onClick={() => speakWord(word.word, speech)}>
                  🔊 {word.word}
                </Button>
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            onClick={() => {
              setFinished(false);
              setRoundIndex(0);
            }}
          >
            Play again
          </Button>
        </div>
      ) : round ? (
        <>
          <h3 className="text-base font-bold">{round.title}</h3>
          {round.type === 'match' ? <MatchRound round={round} speech={speech} /> : null}
          {round.type === 'beats' ? <BeatsRound round={round} speech={speech} /> : null}
          {round.type === 'family' ? <FamilyRound round={round} speech={speech} /> : null}
          <div className="flex flex-wrap justify-between gap-2 border-t border-[var(--lr-rule)] pt-3">
            <Button
              variant="ghost"
              disabled={roundIndex === 0}
              onClick={() => setRoundIndex((index) => Math.max(0, index - 1))}
            >
              ← Previous round
            </Button>
            <Button
              onClick={() => {
                if (last) setFinished(true);
                else setRoundIndex((index) => index + 1);
              }}
            >
              {last ? 'Finish' : 'Next round →'}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-[var(--lr-ink-soft)]">No rounds yet — read a little and try again.</p>
      )}
    </Card>
  );
}
