/**
 * The reading page.
 *
 * Hosts the three ways in — voice-following, narrated (TTS) and tap-to-read —
 * on top of one document, one position and one flag history, so switching
 * modes never loses the student's place. It also owns the reading session
 * (progress heartbeat, flag upload) and the shared reading room publication.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { analyzeWord, tokenize } from '@lexiread/core';
import { api } from '../../lib/api.js';
import { buildWordOffsets } from '../../lib/wordOffsets.js';
import { Button, Drawer, Pill, ProgressBar, SegmentedControl, Spinner, Toast } from '../../components/ui.jsx';
import { cx, formatDuration, percent } from '../../lib/format.js';
import { useAuth } from '../../state/AuthContext.jsx';
import { usePrefs } from '../../state/PrefsContext.jsx';
import { ComprehensionPanel } from '../comprehension/ComprehensionPanel.jsx';
import { WordPopover } from '../comprehension/WordPopover.jsx';
import { HandoffPanel, NudgeToasts, RoomPanel } from '../room/RoomPanel.jsx';
import { useRoomSocket } from '../room/useRoomSocket.js';
import { ListenBar } from '../tts/ListenBar.jsx';
import { speakWord, useTts } from '../tts/useTts.js';
import { FlagLegend, TextSurface } from './TextSurface.jsx';
import { ReaderSettingsPanel } from './ReaderSettingsPanel.jsx';
import { useVoiceFollow } from '../voice/useVoiceFollow.js';
import { VoicePanel } from '../voice/VoicePanel.jsx';

const MODES = [
  { value: 'voice', label: '🎙️ I read aloud', hint: 'LexiRead listens and follows your voice' },
  { value: 'narrated', label: '🔊 Listen to it', hint: 'The app reads aloud and highlights the words' },
  { value: 'read', label: '👆 Tap to read', hint: 'No microphone: tap or press Enter as you read' },
];

export function ReadPage() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { prefs, setPref, setMany, resetPrefs, syncState } = usePrefs();
  const { profile } = useAuth();

  const [doc, setDoc] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(prefs.mode === 'narrated' ? 'narrated' : prefs.mode === 'read' ? 'read' : 'voice');
  const [drawer, setDrawer] = useState(null);
  const [wordCard, setWordCard] = useState(null);
  const [focusWi, setFocusWi] = useState(0);
  const [toast, setToast] = useState(null);
  const [resumeOffer, setResumeOffer] = useState(null);
  const [roomCode, setRoomCode] = useState(null);
  const [sessionMeta, setSessionMeta] = useState({ wordsRead: 0, durationMs: 0, avg: null, peak: null });
  const sessionRef = useRef(null);
  const lastHardCelebration = useRef(0);
  const lastPublish = useRef(0);

  const tokenized = useMemo(() => (doc?.text ? tokenize(doc.text) : null), [doc]);
  const words = tokenized?.words ?? [];
  const wordOffsets = useMemo(() => (tokenized ? buildWordOffsets(tokenized) : []), [tokenized]);
  const totalWords = words.length;

  /* ----------------------------------------------------------------- */
  /* Document + session bootstrap                                      */
  /* ----------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    api
      .get(`/content/${documentId}`)
      .then(({ document }) => {
        if (cancelled) return;
        setDoc(document);
        setLoadState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    if (!doc) return;
    setPref('mode', mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, doc]);

  const startSession = useCallback(
    async ({ resumeCursor = 0 } = {}) => {
      try {
        const { session } = await api.post('/sessions', { documentId, mode, roomCode: null });
        sessionRef.current = session;
        if (resumeCursor) voiceRef.current?.setCursorTo(resumeCursor);
        return session;
      } catch {
        return null;
      }
    },
    [documentId, mode]
  );

  /* ----------------------------------------------------------------- */
  /* Voice-following                                                   */
  /* ----------------------------------------------------------------- */

  const handleProgress = useCallback(() => {}, []);

  const voice = useVoiceFollow({
    words,
    sentences: tokenized?.sentences ?? [],
    enabled: mode === 'voice' || mode === 'read',
    stuckMs: prefs.stuckMs,
    haptics: prefs.haptics,
    onProgress: handleProgress,
  });
  const voiceRef = useRef(null);
  voiceRef.current = voice;

  /** Move the reading cursor (used by handoffs and the Ideas panel). */
  const voiceRetarget = useCallback((wi) => {
    voiceRef.current?.setCursorTo(wi);
    setFocusWi(wi);
  }, []);

  /* ----------------------------------------------------------------- */
  /* Narrated mode                                                     */
  /* ----------------------------------------------------------------- */

  const tts = useTts({
    text: doc?.text ?? '',
    wordOffsets,
    rate: prefs.speechRate,
    pitch: prefs.speechPitch,
    voiceURI: prefs.voiceURI,
    onChangeWord: (wi) => setFocusWi(wi),
    onFinish: () => setToast({ text: 'All done — nice reading!' }),
  });

  /* ----------------------------------------------------------------- */
  /* Shared reading room                                               */
  /* ----------------------------------------------------------------- */

  const room = useRoomSocket({
    roomCode,
    role: 'student',
    name: profile?.displayName || 'Reader',
    enabled: Boolean(roomCode),
    onNudge: () => {},
  });

  const currentSentence = useMemo(() => {
    if (!tokenized || !prefs.highlightSentence) return null;
    const wi = mode === 'narrated' ? tts.currentWord ?? 0 : voice.cursor;
    return tokenized.sentences.find((s) => wi >= s.wStart && wi <= s.wEnd) || null;
  }, [tokenized, prefs.highlightSentence, mode, tts.currentWord, voice.cursor]);

  useEffect(() => {
    if (!roomCode) return;
    const now = Date.now();
    if (now - lastPublish.current < 600) return;
    lastPublish.current = now;
    const wi = mode === 'narrated' ? tts.currentWord ?? 0 : voice.cursor;
    const upcoming = words.slice(wi, wi + 10).map((w) => w.text);
    room.sendState({
      title: doc?.title,
      mode,
      cursor: wi,
      totalWords,
      word: words[wi]?.text ?? null,
      sentence: tokenized?.sentences.find((s) => wi >= s.wStart && wi <= s.wEnd)?.text ?? null,
      nextWords: upcoming,
      stuck: Boolean(voice.helpWord),
      stuckFor: voice.helpWord?.idle ?? 0,
      wpm: voice.wpm,
      flagged: [...voice.flags.values()].map((f) => f.word),
      percent: percent(wi, totalWords),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, voice.cursor, voice.helpWord, tts.currentWord, mode]);

  const readWords = useMemo(() => {
    const upto = mode === 'narrated' ? tts.currentWord ?? 0 : voice.cursor;
    const set = new Set();
    for (let i = 0; i < Math.min(upto, totalWords); i += 1) set.add(i);
    return set;
  }, [mode, tts.currentWord, voice.cursor, totalWords]);

  /* ----------------------------------------------------------------- */
  /* Session progress heartbeat                                        */
  /* ----------------------------------------------------------------- */

  /**
   * Persist the session. `beacon` is used on page hide, where a normal fetch
   * would be cancelled (sendBeacon only issues POST, hence the /finish alias).
   */
  const flushProgress = useCallback(({ ended = false, beacon = false } = {}) => {
    const session = sessionRef.current;
    if (!session) return;
    const v = voiceRef.current;
    if (!v) return;
    const events = v.drainFlags();
    const intervals = v.drainIntervals();
    // A reader that was opened and closed again leaves nothing behind: no
    // empty row in the history, no confusing "0 words" session.
    if (ended && v.wordsRead === 0 && v.cursor === 0) {
      api.del(`/sessions/${session.id}`).catch(() => {});
      sessionRef.current = null;
      return;
    }

    const patch = {
      cursor: v.cursor,
      wordsRead: v.wordsRead,
      durationMs: v.elapsedMs,
      wpmAvg: v.wpm,
      wpmPeak: v.peakWpm,
      mode,
      ended,
    };

    if (beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        if (events.length || intervals.length) {
          navigator.sendBeacon(
            `/api/sessions/${session.id}/events`,
            new Blob([JSON.stringify({ events, intervals })], { type: 'application/json' })
          );
        }
        navigator.sendBeacon(
          `/api/sessions/${session.id}/finish`,
          new Blob([JSON.stringify(patch)], { type: 'application/json' })
        );
      } catch {
        /* nothing more we can do while the page is closing */
      }
      return;
    }

    if (events.length || intervals.length) {
      api.post(`/sessions/${session.id}/events`, { events, intervals }).catch(() => {});
    }
    api.patch(`/sessions/${session.id}`, patch).catch(() => {});
    setSessionMeta({ wordsRead: v.wordsRead, durationMs: v.elapsedMs, avg: v.wpm, peak: v.peakWpm });
  }, [mode]);

  useEffect(() => {
    if (!doc) return undefined;
    startSession();
    return () => flushProgress({ ended: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, documentId]);

  useEffect(() => {
    if (!doc) return undefined;
    const id = setInterval(() => flushProgress(), 8000);
    return () => clearInterval(id);
  }, [doc, flushProgress]);

  useEffect(() => {
    const onHide = () => flushProgress({ ended: true, beacon: true });
    window.addEventListener('pagehide', onHide);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [flushProgress]);

  /* A QR handoff (or a dashboard jump) can ask to open at a specific word. */
  useEffect(() => {
    const target = location.state?.cursor;
    if (!doc || !Number.isFinite(target) || target <= 0) return;
    voiceRetarget(target);
    setToast({
      text: location.state?.fromHandoff
        ? `Carried on from word ${target} on this device.`
        : 'Jumped to that part of the text.',
    });
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, location.state]);

  /* Resume offer: continue where the last session on this document stopped. */
  useEffect(() => {
    if (!doc) return;
    api
      .get(`/sessions?limit=10`)
      .then(({ sessions }) => {
        const match = (sessions || []).find((s) => s.document_id === documentId && s.cursor > 12);
        if (match) setResumeOffer({ sessionId: match.id, cursor: match.cursor });
      })
      .catch(() => {});
  }, [doc, documentId]);

  /* ----------------------------------------------------------------- */
  /* Encouraging feedback for hard words                               */
  /* ----------------------------------------------------------------- */

  useEffect(() => {
    if (!voice.recentFlash || mode === 'narrated') return;
    const word = words[voice.recentFlash.wi];
    if (!word) return;
    const info = analyzeWord(word.text);
    if (!info.isHard) return;
    const now = Date.now();
    if (now - lastHardCelebration.current < 12000) return;
    lastHardCelebration.current = now;
    const detail =
      info.syllables >= 3
        ? `${info.syllables} beats — nice work`
        : info.digraphs?.length
          ? `that “${info.digraphs[0]}” sound was spot on`
          : 'great reading';
    setToast({ text: `“${word.text}” — ${detail}!` });
  }, [voice.recentFlash, words, mode]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(id);
  }, [toast]);

  /* ----------------------------------------------------------------- */
  /* Keyboard reading cursor                                           */
  /* ----------------------------------------------------------------- */

  useEffect(() => {
    const onKey = (event) => {
      const el = event.target instanceof HTMLElement ? event.target : null;
      if (el) {
        const tag = el.tagName;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || el.isContentEditable) return;
        // Never steal keys from a control the student is using: Enter and
        // Space must still work on buttons, links and disclosure widgets.
        if (['BUTTON', 'A', 'SUMMARY'].includes(tag) && (event.key === 'Enter' || event.key === ' ')) return;
        if (el.closest('button, a, summary, [role="switch"]') && (event.key === 'Enter' || event.key === ' ')) return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setFocusWi((wi) => Math.min(totalWords - 1, wi + 1));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setFocusWi((wi) => Math.max(0, wi - 1));
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setFocusWi((wi) => Math.min(totalWords - 1, wi + 12));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setFocusWi((wi) => Math.max(0, wi - 12));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const word = words[focusWi];
        if (!word) return;
        if (mode === 'read') voice.markWordRead(focusWi, { word: word.text });
        else setWordCard({ wi: focusWi, word: word.text });
      } else if (event.key.toLowerCase() === 'h') {
        const word = words[focusWi] || words[voice.helpWord?.wi ?? voice.cursor];
        if (word) speakWord(word.text, { rate: prefs.speechRate, pitch: prefs.speechPitch, voiceURI: prefs.voiceURI });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusWi, words, mode, voice, prefs.speechRate, prefs.speechPitch, prefs.voiceURI, totalWords]);

  /* ----------------------------------------------------------------- */
  /* Mode switching                                                    */
  /* ----------------------------------------------------------------- */

  const switchMode = useCallback(
    (next) => {
      if (next !== 'narrated') tts.stop();
      if (next === 'narrated') voice.stop();
      if (next === 'narrated') {
        // Keep the narrated reading in the same place as the voice session.
        setFocusWi(voice.cursor);
      }
      setMode(next);
    },
    [tts, voice]
  );

  const hearWord = useCallback(
    (word) => {
      speakWord(word, { rate: prefs.speechRate * 0.95, pitch: prefs.speechPitch, voiceURI: prefs.voiceURI });
    },
    [prefs.speechRate, prefs.speechPitch, prefs.voiceURI]
  );

  if (loadState === 'loading') {
    return (
      <div className="p-6">
        <Spinner label="Opening your text…" />
      </div>
    );
  }
  if (loadState === 'error') {
    return (
      <div className="mx-auto max-w-xl p-6">
        <h1 className="text-xl font-bold">That text is not available</h1>
        <p className="mt-2 text-sm text-[var(--lr-ink-soft)]">{error}</p>
        <Link className="mt-4 inline-block font-semibold underline" to="/">
          Back to my library
        </Link>
      </div>
    );
  }

  const cursorWord = words[mode === 'narrated' ? tts.currentWord ?? 0 : voice.cursor];
  const progressPercent =
    mode === 'narrated' ? percent(tts.currentWord ?? 0, totalWords) : percent(voice.cursor, totalWords);

  return (
    <div className="min-h-screen">
      {/* Toolbar ------------------------------------------------------ */}
      <header className="sticky top-0 z-20 border-b border-[var(--lr-rule)] bg-[var(--lr-bg)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
          <Link to="/" className="text-sm font-bold underline decoration-dotted">
            ← Library
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-base font-bold sm:text-lg" title={doc.title}>
            {doc.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <div className="order-last w-full sm:order-none sm:w-auto">
              <SegmentedControl
                label="Reading mode"
                options={MODES}
                value={mode}
                onChange={switchMode}
                size="sm"
                full
              />
            </div>
            <Button variant="secondary" size="sm" onClick={() => setDrawer('ideas')}>
              💡 Ideas
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDrawer('settings')} aria-label="Reading settings">
              ⚙️ Settings
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDrawer('together')}>
              🤝 Read together
            </Button>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-3 pb-2 sm:px-4">
          <ProgressBar value={progressPercent} label="Reading progress" />
        </div>
      </header>

      {/* Resume banner ------------------------------------------------ */}
      {resumeOffer ? (
        <div className="mx-auto max-w-5xl px-3 pt-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--lr-rule)] bg-[var(--lr-surface-2)] p-3 text-sm">
            <span>
              You stopped at word {resumeOffer.cursor} last time. Carry on from there?
            </span>
            <Button
              size="sm"
              onClick={() => {
                voice.setCursorTo(resumeOffer.cursor);
                setFocusWi(resumeOffer.cursor);
                setResumeOffer(null);
              }}
            >
              Yes, carry on
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setResumeOffer(null)}>
              Start from the beginning
            </Button>
          </div>
        </div>
      ) : null}

      {/* Reading surface --------------------------------------------- */}
      <main className="mx-auto max-w-5xl px-3 pb-56 pt-4 sm:px-4">
        <div className="mx-auto" style={{ maxWidth: 'var(--lr-measure)' }}>
          <TextSurface
            doc={tokenized}
            bionic={prefs.bionic}
            readWords={readWords}
            cursor={mode === 'narrated' ? -1 : voice.cursor}
            flags={mode === 'narrated' ? new Map() : voice.flags}
            helpWi={voice.helpWord?.wi ?? null}
            activeWi={mode === 'narrated' ? tts.currentWord : null}
            focusWi={focusWi}
            highlightSentence={prefs.highlightSentence}
            currentSentence={currentSentence}
            autoScroll={prefs.autoScroll}
            onWordClick={(wi) => {
              setFocusWi(wi);
              setWordCard({ wi, word: words[wi]?.text ?? '' });
            }}
            onFocusWord={setFocusWi}
          />
        </div>
      </main>

      {/* Bottom control bar ------------------------------------------ */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lr-rule)] bg-[var(--lr-surface)]/97 backdrop-blur">
        <div className="mx-auto max-w-5xl space-y-2.5 px-3 py-2.5 sm:space-y-3 sm:px-4 sm:py-3">
          {mode === 'narrated' ? (
            <ListenBar
              supported={tts.supported}
              speaking={tts.speaking}
              paused={tts.paused}
              voices={tts.voices}
              prefs={prefs}
              setPref={setPref}
              onPlay={() => tts.speakFrom(voice.cursor)}
              onPause={tts.pause}
              onResume={tts.resume}
              onStop={tts.stop}
              onRestartFromCursor={() => tts.speakFrom(tts.currentWord ?? voice.cursor)}
              cursorWord={cursorWord?.text}
              progress={progressPercent}
            />
          ) : (
            <>
              <VoicePanel
                supported={voice.supported}
                listening={voice.listening}
                onStart={() => {
                  voice.start();
                  setToast({ text: 'Listening… read at your own pace. You can start anywhere.' });
                }}
                onStop={voice.stop}
                onTapMode={() => switchMode('read')}
                wpm={voice.wpm}
                peakWpm={voice.peakWpm}
                wordsRead={voice.wordsRead}
                elapsedMs={voice.elapsedMs}
                progress={voice.progress}
                totalWords={totalWords}
                statusText={voice.statusText}
                helpWord={voice.helpWord}
                onHearHelp={(offer) => {
                  hearWord(offer.word);
                  voice.markDifficult(offer.wi, offer.word);
                }}
                onDismissHelp={voice.dismissHelp}
                micError={voice.micError}
                showLegend={prefs.showLegend}
                flags={voice.flags}
                haptics={prefs.haptics}
                stuckMs={prefs.stuckMs}
              />
              {mode === 'read' ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    onClick={() => {
                      const wi = focusWi ?? voice.cursor;
                      voice.markWordRead(wi, { word: words[wi]?.text, type: 'read' });
                      setFocusWi(Math.min(totalWords - 1, wi + 1));
                    }}
                  >
                    ✓ I read “{words[focusWi]?.text || words[voice.cursor]?.text || 'this word'}”
                  </Button>
                  <p className="hidden text-xs text-[var(--lr-ink-soft)] sm:block">
                    Use ← → to move, Enter or this button to mark words read. Everything else works exactly the same.
                  </p>
                </div>
              ) : null}
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[var(--lr-rule)] pt-2 text-xs text-[var(--lr-ink-soft)]">
            <span>
              Word {Math.max(0, (mode === 'narrated' ? tts.currentWord ?? 0 : voice.cursor) + 1)} of {totalWords}
              {cursorWord ? ` · “${cursorWord.text}”` : ''} · <span className="tabular-nums">{formatDuration(voice.elapsedMs)}</span>
            </span>
            <button
              type="button"
              className="font-semibold underline decoration-dotted"
              onClick={() => {
                const wi = mode === 'narrated' ? tts.currentWord ?? 0 : voice.cursor;
                voice.markDifficult(wi, words[wi]?.text);
                setToast({ text: 'Marked as tricky — it will show up in your practice words.' });
              }}
            >
              🔖 Mark this word as tricky
            </button>
            {prefs.showLegend && mode !== 'narrated' ? (
              <details className="w-full">
                <summary className="cursor-pointer font-semibold">What the marks mean</summary>
                <div className="pt-1.5">
                  <FlagLegend flags={voice.flags} />
                </div>
              </details>
            ) : null}
          </div>
        </div>
      </div>

      {/* Word card ---------------------------------------------------- */}
      {wordCard ? (
        <WordPopover
          word={wordCard.word}
          speech={{ rate: prefs.speechRate, pitch: prefs.speechPitch, voiceURI: prefs.voiceURI }}
          onClose={() => setWordCard(null)}
          onMarkDifficult={(word) => {
            voice.markDifficult(wordCard.wi, word);
            setToast({ text: `“${word}” added to your practice words.` });
          }}
        />
      ) : null}

      {/* Drawers ------------------------------------------------------ */}
      <Drawer open={drawer === 'settings'} onClose={() => setDrawer(null)} title="Reading settings">
        <ReaderSettingsPanel
          prefs={prefs}
          setPref={setPref}
          setMany={setMany}
          resetPrefs={resetPrefs}
          syncState={syncState}
          voices={tts.voices}
        />
      </Drawer>

      <Drawer open={drawer === 'ideas'} onClose={() => setDrawer(null)} title="Ideas in this text">
        <ComprehensionPanel
          documentId={doc.id}
          speech={{ rate: prefs.speechRate, pitch: prefs.speechPitch, voiceURI: prefs.voiceURI }}
          onJumpTo={(wi) => {
            voice.setCursorTo(wi);
            setFocusWi(wi);
            setDrawer(null);
            setToast({ text: 'Jumped there — carry on reading from this line.' });
          }}
          onHearWord={() => {}}
        />
      </Drawer>

      <Drawer open={drawer === 'together'} onClose={() => setDrawer(null)} title="Read together & move device">
        <div className="space-y-6">
          <RoomPanel
            roomCode={roomCode}
            onStartRoom={() => {
              const code = `R${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
              setRoomCode(code);
              setToast({ text: `Room ${code} is open. Share the link with a grown-up helper.` });
            }}
            presence={room.presence}
            connected={room.connected}
            helperCount={room.presence?.helpers?.length || 0}
          />
          <HandoffPanel
            disabled={loadState !== 'ready'}
            payload={{
              documentId: doc.id,
              title: doc.title,
              // The text travels with the code so the second device needs no
              // account and no copy of the original file.
              text: doc.text.slice(0, 200000),
              cursor: voice.cursor,
              mode,
              prefs,
              word: words[voice.cursor]?.text ?? null,
            }}
          />
        </div>
      </Drawer>

      <NudgeToasts nudges={room.nudges} onDismiss={() => {}} />

      {toast ? (
        <div className="pointer-events-none fixed inset-x-3 top-20 z-40 mx-auto max-w-md">
          <div className="pointer-events-auto">
            <Toast onDismiss={() => setToast(null)}>{toast.text}</Toast>
          </div>
        </div>
      ) : null}

      <div className="sr-only" aria-live="polite">
        {voice.helpWord ? `You have paused on the word ${voice.helpWord.word}. Tap to hear this word.` : ''}
      </div>

      <div className={cx('mx-auto max-w-5xl px-4 pb-4 text-center text-xs text-[var(--lr-ink-soft)]')}>
        <button type="button" className="underline decoration-dotted" onClick={() => navigate('/progress')}>
          See my reading progress
        </button>
      </div>
    </div>
  );
}
