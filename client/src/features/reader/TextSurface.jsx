/**
 * The reading surface.
 *
 * Every word is its own element so the highlight can follow the student's
 * voice word by word. Accessibility notes:
 *  - The words stay real, readable text for screen readers (no fake buttons
 *    around them, which would flood the tab order).
 *  - Keyboard users get a reading cursor: ← / → move word by word, Enter opens
 *    the meaning, H hears the word. The focused word is announced politely.
 *  - Flags carry a tooltip and a legend, so nothing depends on colour alone.
 */

import { useEffect, useRef } from 'react';
import { bionicParts, cx } from '../../lib/format.js';

function flagClass(type) {
  switch (type) {
    case 'close':
      return 'lr-word-close';
    case 'skipped':
      return 'lr-word-skipped';
    case 'unclear':
      return 'lr-word-skipped';
    case 'difficult':
      return 'lr-word-hard';
    default:
      return '';
  }
}

function WordToken({ word, bionic, isRead, isCurrent, flag, isHelp, isActive, isFocused, onActivate, onFocus }) {
  const parts = bionic ? bionicParts(word.text) : null;
  return (
    <span
      data-wi={word.wi}
      className={cx(
        'lr-word',
        isRead && !isCurrent && 'lr-word-read',
        isCurrent && 'lr-word-current',
        flag && flagClass(flag.type),
        isHelp && 'lr-word-help lr-pulse',
        isActive && 'lr-word-read',
        isFocused && 'ring-2 ring-[var(--lr-accent)] ring-offset-1 ring-offset-transparent'
      )}
      title={
        flag
          ? {
              close: `Sounded close to "${flag.heard || ''}" — tap to hear it clearly`,
              skipped: 'This word was missed — tap to hear it',
              unclear: 'Not clear enough to be sure — tap to hear it',
              difficult: 'You marked this word as tricky',
              manual: 'Marked as read',
            }[flag.type]
          : undefined
      }
      onClick={onActivate}
      onMouseEnter={onFocus}
    >
      {parts ? (
        <span className="lr-bionic">
          <b>{parts.head}</b>
          {parts.tail}
        </span>
      ) : (
        word.text
      )}
    </span>
  );
}

export function TextSurface({
  doc,
  bionic = false,
  readWords,
  cursor = 0,
  flags,
  helpWi = null,
  activeWi = null,
  focusWi = null,
  highlightSentence = false,
  currentSentence = null,
  autoScroll = true,
  scrollKey = 0,
  onWordClick,
  onFocusWord,
}) {
  const containerRef = useRef(null);
  const lastAutoScroll = useRef(0);

  useEffect(() => {
    if (!autoScroll || !containerRef.current) return;
    const now = Date.now();
    if (now - lastAutoScroll.current < 400) return;
    lastAutoScroll.current = now;
    const el = containerRef.current.querySelector(`[data-wi="${cursor}"]`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewport = window.innerHeight;
    // Only move the page when the word is drifting out of comfortable view.
    if (rect.top < viewport * 0.22 || rect.bottom > viewport * 0.74) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [cursor, autoScroll, scrollKey]);

  const sentenceRange = highlightSentence && currentSentence ? currentSentence : null;

  return (
    <div
      ref={containerRef}
      className="lr-surface pb-40 pt-2"
      tabIndex={0}
      role="group"
      aria-label="Reading text. Use left and right arrow keys to move through the words, Enter for the meaning of a word, and H to hear it."
    >
      {doc.paragraphs.map((para) => {
        const segments = doc.segments.slice(para.segStart, para.segEnd + 1);
        const inSentence =
          sentenceRange && para.wEnd >= sentenceRange.wStart && para.wStart <= sentenceRange.wEnd;
        return (
          <p
            key={para.pi}
            className={cx('mb-4', inSentence && 'bg-[var(--lr-accent-soft)] rounded-lg px-2 py-1')}
          >
            {segments.map((seg, index) => {
              if (seg.type !== 'word') {
                return (
                  <span key={`gap-${para.pi}-${index}`} className="whitespace-pre-wrap">
                    {seg.text.replace(/\n+/g, ' ')}
                  </span>
                );
              }
              const word = doc.words[seg.wi];
              if (!word) return null;
              return (
                <WordToken
                  key={`w-${seg.wi}`}
                  word={word}
                  bionic={bionic}
                  isRead={readWords?.has(seg.wi)}
                  isCurrent={seg.wi === cursor}
                  isActive={seg.wi === activeWi}
                  flag={flags?.get(seg.wi)}
                  isHelp={seg.wi === helpWi}
                  isFocused={seg.wi === focusWi}
                  onActivate={() => onWordClick?.(seg.wi)}
                  onFocus={() => onFocusWord?.(seg.wi)}
                />
              );
            })}
          </p>
        );
      })}
    </div>
  );
}

export function FlagLegend({ flags }) {
  const counts = { close: 0, skipped: 0, unclear: 0, difficult: 0 };
  for (const flag of flags?.values?.() || []) {
    if (counts[flag.type] !== undefined) counts[flag.type] += 1;
  }
  const rows = [
    { type: 'close', label: 'sounded close', cls: 'border-b-2 border-dotted border-[var(--lr-flag-close)]', count: counts.close },
    { type: 'skipped', label: 'missed word', cls: 'border-b-2 border-dashed border-[var(--lr-flag-skip)]', count: counts.skipped },
    { type: 'unclear', label: 'not clear', cls: 'border-b-2 border-dashed border-[var(--lr-flag-skip)]', count: counts.unclear },
    { type: 'difficult', label: 'you marked tricky', cls: 'border-b-2 border-solid border-[var(--lr-flag-hard)]', count: counts.difficult },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--lr-ink-soft)]">
      {rows.map((row) => (
        <li key={row.type} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cx('inline-block h-4 w-6 rounded-sm', row.cls)} />
          <span>
            {row.label}
            {row.count ? ` (${row.count})` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}
