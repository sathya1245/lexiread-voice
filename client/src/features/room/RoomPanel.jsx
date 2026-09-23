/**
 * Student-side "read together" panel.
 *
 * Starts a Shared Reading Room (a teacher or parent can watch the live
 * position) and produces the QR handoff so the same reading session can be
 * continued on another device with no login.
 */

import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Alert, Button, Pill, SectionTitle } from '../../components/ui.jsx';
import { cx } from '../../lib/format.js';

/** Renders a QR code without pulling the QR library into the main bundle. */
export function QrCode({ value, size = 168, label = 'QR code' }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!value) return undefined;
    (async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const url = await QRCode.toDataURL(value, {
          width: size,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#1f2933', light: '#ffffff' },
        });
        if (!cancelled) setDataUrl(url);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!value) return null;
  if (failed) {
    return (
      <p className="text-sm text-[var(--lr-ink-soft)]">
        QR codes are not available here — open the link instead.
      </p>
    );
  }
  if (!dataUrl) return <div className="h-40 w-40 animate-pulse rounded-xl bg-[var(--lr-surface-2)]" aria-hidden="true" />;
  return <img src={dataUrl} alt={label} width={size} height={size} className="rounded-xl border border-[var(--lr-rule)]" />;
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = (text) => {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => setCopied(false));
    } else {
      setCopied(false);
    }
  };
  return { copied, copy };
}

export function RoomPanel({ roomCode, onStartRoom, presence, connected, helperCount }) {
  const { copied, copy } = useCopy();
  const link = roomCode ? `${window.location.origin}/room/${roomCode}` : '';

  return (
    <div className="space-y-3">
      <SectionTitle
        hint="A teacher or parent opens the link and sees which word you are on, in real time. They can send you a quiet note."
      >
        Read together
      </SectionTitle>

      {!roomCode ? (
        <Button onClick={onStartRoom}>Open a shared reading room</Button>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="accent">Room {roomCode}</Pill>
            <Pill>{connected ? 'Live' : 'Connecting…'}</Pill>
            <Pill>
              {helperCount ? `${helperCount} helper${helperCount === 1 ? '' : 's'} watching` : 'Nobody watching yet'}
            </Pill>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => copy(link)}>
              {copied ? 'Link copied' : 'Copy link'}
            </Button>
            <a
              className="inline-flex items-center rounded-xl border border-[var(--lr-rule)] px-3 py-1.5 text-sm font-semibold"
              href={link}
              target="_blank"
              rel="noreferrer"
            >
              Open helper view
            </a>
          </div>
          <p className="text-xs text-[var(--lr-ink-soft)]">
            Share this room code: <strong>{roomCode}</strong>
          </p>
        </div>
      )}
      {presence?.helpers?.length ? (
        <p className="text-sm">
          {presence.helpers.map((h) => h.name).join(', ')} {presence.helpers.length === 1 ? 'is' : 'are'} reading with you.
        </p>
      ) : null}
    </div>
  );
}

export function HandoffPanel({ payload, disabled }) {
  const [code, setCode] = useState(null);
  const [status, setStatus] = useState('idle');
  const { copied, copy } = useCopy();

  const create = async () => {
    setStatus('creating');
    try {
      const res = await api.post('/handoff', { payload });
      setCode(res.code);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  const resumeUrl = code ? `${window.location.origin}/resume/${code}` : '';

  return (
    <div className="space-y-3">
      <SectionTitle hint="Scan the code on another phone or tablet and carry on at the same word, with the same settings. No login needed.">
        Continue on another device
      </SectionTitle>
      {!code ? (
        <>
          <Button onClick={create} disabled={disabled || status === 'creating'}>
            {status === 'creating' ? 'Making code…' : 'Make a QR code'}
          </Button>
          {status === 'error' ? <Alert tone="gentle">Could not create a code. Check the connection and try again.</Alert> : null}
        </>
      ) : (
        <div className="flex flex-wrap items-start gap-4">
          <QrCode value={resumeUrl} label="QR code to continue reading on another device" />
          <div className="space-y-2">
            <p className="text-sm">
              Code: <strong className="text-base tracking-widest">{code}</strong>
            </p>
            <p className="text-xs text-[var(--lr-ink-soft)]">
              Valid for a few hours. Anyone with this code can open this reading position — keep it within the family or
              classroom.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => copy(resumeUrl)}>
                {copied ? 'Link copied' : 'Copy link'}
              </Button>
              <a
                className="inline-flex items-center rounded-xl border border-[var(--lr-rule)] px-3 py-1.5 text-sm font-semibold"
                href={resumeUrl}
              >
                Test it here
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function NudgeToasts({ nudges, onDismiss, className }) {
  const recent = nudges.slice(-2);
  if (!recent.length) return null;
  return (
    <div className={cx('pointer-events-none fixed inset-x-3 bottom-24 z-40 mx-auto max-w-md space-y-2', className)}>
      {recent.map((nudge, index) => (
        <div
          key={`${nudge.at}-${index}`}
          role="status"
          aria-live="polite"
          className="lr-rise pointer-events-auto rounded-2xl border border-[var(--lr-accent)] bg-[var(--lr-surface)] p-3 shadow-lg"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--lr-ink-soft)]">
            {nudge.from} · quiet note
          </p>
          <p className="mt-1 text-sm leading-relaxed">{nudge.text}</p>
          {onDismiss ? (
            <button type="button" className="mt-2 text-xs font-semibold underline" onClick={() => onDismiss(nudge)}>
              Thanks!
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
