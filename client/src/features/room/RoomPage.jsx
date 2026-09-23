/**
 * Helper view (teacher or parent).
 *
 * Shows the live reading position of the student: the word they are on, the
 * sentence around it, how long they have paused and their pace. The helper can
 * send a short note which appears gently in the student's reader.
 *
 * Privacy: only the current position, pace and the words already read aloud
 * within this session are shared, and only while both sides have the room open.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Field, Pill, ProgressBar, SectionTitle, Spinner, TextArea, TextInput } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { cx, formatRelative } from '../../lib/format.js';
import { useRoomSocket } from './useRoomSocket.js';

const QUICK_NOTES = [
  { text: 'You are doing great — keep going.', kind: 'encourage' },
  { text: 'Take a breath, then try the next word slowly.', kind: 'hint' },
  { text: 'Sound it out in beats, like we practised.', kind: 'hint' },
  { text: 'Nearly there — two more lines and we can take a break.', kind: 'encourage' },
];

function highlightSentence(sentence, word) {
  if (!sentence) return null;
  if (!word) return sentence;
  const index = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (index < 0) return sentence;
  return (
    <>
      {sentence.slice(0, index)}
      <mark className="rounded bg-[var(--lr-current)] px-1 text-[var(--lr-current-ink)]">{sentence.slice(index, index + word.length)}</mark>
      {sentence.slice(index + word.length)}
    </>
  );
}

export function RoomPage() {
  const { roomCode: codeParam } = useParams();
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState(codeParam || '');
  const [joinedCode, setJoinedCode] = useState(codeParam || null);
  const [name, setName] = useState(() => (typeof localStorage !== 'undefined' ? localStorage.getItem('lexiread.helperName') || '' : ''));
  const [note, setNote] = useState('');
  const [sent, setSent] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);

  const room = useRoomSocket({
    roomCode: joinedCode,
    role: 'helper',
    name: name || 'Helper',
    enabled: Boolean(joinedCode),
  });

  useEffect(() => {
    if (name) {
      try {
        localStorage.setItem('lexiread.helperName', name);
      } catch {
        /* ignore */
      }
    }
  }, [name]);

  useEffect(() => {
    if (room.state) setActiveRoom(room.state);
  }, [room.state]);

  const studentNames = useMemo(() => (room.presence?.students || []).map((s) => s.name), [room.presence]);

  const sendNote = async (text, kind = 'encourage') => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const result = await room.sendNudge(trimmed, kind);
    if (result?.ok) {
      setSent((current) => [...current, { text: trimmed, at: new Date().toISOString() }].slice(-6));
      setNote('');
    }
  };

  const stuckSeconds = activeRoom?.stuck ? Math.round((activeRoom.stuckFor || 0) / 1000) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-3 py-6 sm:px-4">
      <SectionTitle
        level={1}
        hint="Follow the reader's position live and send a short note. Nothing is recorded; only the current word and pace are shared."
      >
        Shared reading room
      </SectionTitle>

      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <Field label="Room code" hint="Six characters — ask the reader or scan their QR code.">
            {(props) => (
              <TextInput
                {...props}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="R7K2QX"
                autoCapitalize="characters"
              />
            )}
          </Field>
          <Field label="Your name" hint="Shown on the note you send.">
            {(props) => <TextInput {...props} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ms Rao" />}
          </Field>
          <Button
            size="lg"
            onClick={() => {
              setJoinedCode(roomCode.trim().toUpperCase());
              setActiveRoom(null);
            }}
            disabled={!roomCode.trim()}
          >
            Join room
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={room.connected ? 'accent' : 'neutral'}>{room.connected ? 'Connected live' : joinedCode ? 'Connecting…' : 'Not connected'}</Pill>
          {studentNames.length ? <Pill>{studentNames.join(', ')} reading</Pill> : joinedCode ? <Pill>Waiting for the reader…</Pill> : null}
          {room.presence?.helpers?.length ? <Pill>{room.presence.helpers.length} helper(s) in the room</Pill> : null}
        </div>
        {room.error ? <Alert tone="gentle">{room.error}</Alert> : null}
      </Card>

      {joinedCode && !activeRoom ? (
        <Card>
          <Spinner label="Waiting for the reader to start…" />
          <p className="mt-2 text-sm text-[var(--lr-ink-soft)]">
            The reader needs the same room code open. In their reader, “Read together” shows the code.
          </p>
        </Card>
      ) : null}

      {activeRoom ? (
        <>
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--lr-ink-soft)]">Now reading</p>
                <p className="text-lg font-bold">{activeRoom.title || 'Untitled'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Pill>{activeRoom.mode === 'narrated' ? '🔊 listening mode' : '🎙️ reading aloud'}</Pill>
                {activeRoom.wpm ? <Pill tone="accent">{activeRoom.wpm} wpm</Pill> : null}
                <Pill>{formatRelative(new Date(activeRoom.at).toISOString())}</Pill>
              </div>
            </div>

            <div>
              <p className="text-sm text-[var(--lr-ink-soft)]">Current word</p>
              <p className="text-2xl font-extrabold">{activeRoom.word || '—'}</p>
            </div>

            {activeRoom.sentence ? (
              <p className="rounded-xl border border-[var(--lr-rule)] bg-[var(--lr-surface-2)] p-3 text-[1.05rem] leading-relaxed">
                {highlightSentence(activeRoom.sentence, activeRoom.word)}
              </p>
            ) : null}

            {activeRoom.nextWords?.length ? (
              <p className="text-sm text-[var(--lr-ink-soft)]">Coming up: {activeRoom.nextWords.join(' ')}</p>
            ) : null}

            <ProgressBar value={activeRoom.percent || 0} label="Reader progress" />
            <p className="text-xs text-[var(--lr-ink-soft)]">
              Word {activeRoom.cursor} of {activeRoom.totalWords || '?'}
            </p>

            {activeRoom.stuck ? (
              <Alert tone="gentle" title={`Paused here for about ${stuckSeconds}s`}>
                <p>
                  They may be stuck on “{activeRoom.word}”. A short hint often helps more than the answer — try “sound it
                  out in beats”.
                </p>
              </Alert>
            ) : null}

            {activeRoom.flagged?.length ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--lr-ink-soft)]">Flagged so far</p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {[...new Set(activeRoom.flagged)].slice(-8).map((word) => (
                    <li key={word}>
                      <Pill>{word}</Pill>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <Card className="space-y-3">
            <SectionTitle level={2} hint="Notes appear quietly in the reader's view and never interrupt the reading.">
              Send encouragement
            </SectionTitle>
            <ul className="flex flex-wrap gap-2">
              {QUICK_NOTES.map((quick) => (
                <li key={quick.text}>
                  <Button size="sm" variant="soft" onClick={() => sendNote(quick.text, quick.kind)}>
                    {quick.text}
                  </Button>
                </li>
              ))}
            </ul>
            <Field label="Or write your own" hint="Short is better — one sentence.">
              {(props) => (
                <TextArea
                  {...props}
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="You remembered “chlorophyll” — brilliant!"
                />
              )}
            </Field>
            <Button onClick={() => sendNote(note)} disabled={!note.trim()}>
              Send quietly
            </Button>
            {sent.length ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--lr-ink-soft)]">Sent</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {sent.map((entry) => (
                    <li key={entry.at} className={cx('text-[var(--lr-ink-soft)]')}>
                      ✓ {entry.text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        </>
      ) : null}

      <Card>
        <SectionTitle level={2}>Other ways to help</SectionTitle>
        <ul className="space-y-2 text-sm text-[var(--lr-ink-soft)]">
          <li>
            Ask the reader to open <strong>Ideas</strong> in the reader for key points and a glossary — the same list you
            can see from the reading room.
          </li>
          <li>
            Words flagged here also appear in the reader's dashboard, and the practice game is built from them.
          </li>
          <li>Nothing in this view is stored: if nobody is watching, nothing is shared.</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate('/progress')}>
            Open dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default RoomPage;
