/**
 * Resume page (the QR handoff target).
 *
 * The handoff payload carries the text itself, so the second device does not
 * need an account, does not need the original file, and works even on a
 * different network: it creates its own copy of the text and re-opens the
 * reader at the same word with the same preferences.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Pill, SectionTitle, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { usePrefs } from '../../state/PrefsContext.jsx';

export function ResumePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { setMany } = usePrefs();
  const [state, setState] = useState({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/handoff/${encodeURIComponent(code)}`)
      .then(({ payload }) => {
        if (!cancelled) setState({ status: 'ready', payload });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const continueReading = async () => {
    const payload = state.payload;
    if (!payload) return;
    setBusy(true);
    setError(null);
    try {
      if (payload.prefs) setMany(payload.prefs);
      // Prefer the original document when this device already has it.
      let documentId = payload.documentId;
      try {
        await api.get(`/content/${payload.documentId}`);
      } catch {
        if (!payload.text) throw new Error('This code did not include the text — ask for a new one.');
        const { document } = await api.post('/content', {
          text: payload.text,
          title: payload.title || 'Continued reading',
        });
        documentId = document.id;
      }
      navigate(`/read/${documentId}`, { state: { cursor: payload.cursor || 0, fromHandoff: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-3 py-8 sm:px-4">
      <SectionTitle level={1} hint="Scanning a QR code from another device brings you straight back to the same word.">
        Continue reading
      </SectionTitle>

      {state.status === 'loading' ? <Spinner label="Reading the code…" /> : null}

      {state.status === 'error' ? (
        <Alert tone="warning" title="This code cannot be used" role="alert">
          <p>{state.error}</p>
          <p className="mt-2">
            Codes last a few hours. Ask the reader to open <strong>Read together → Continue on another device</strong> and
            make a fresh one.
          </p>
        </Alert>
      ) : null}

      {state.status === 'ready' ? (
        <Card className="space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--lr-ink-soft)]">Text</p>
            <p className="text-lg font-bold">{state.payload.title || 'Untitled'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill tone="accent">Word {state.payload.cursor || 0}</Pill>
            <Pill>{state.payload.mode === 'narrated' ? '🔊 listen mode' : state.payload.mode === 'read' ? '👆 tap to read' : '🎙️ reading aloud'}</Pill>
            {state.payload.word ? <Pill>next: {state.payload.word}</Pill> : null}
            {state.payload.prefs?.font ? <Pill>{state.payload.prefs.font} font</Pill> : null}
            {state.payload.prefs?.theme ? <Pill>{state.payload.prefs.theme} theme</Pill> : null}
          </div>
          <p className="text-sm text-[var(--lr-ink-soft)]">
            Your font, colours, spacing and voice settings travel with the code too, so the text looks the same here.
          </p>
          {error ? <Alert tone="warning">{error}</Alert> : null}
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={continueReading} disabled={busy}>
              {busy ? 'Opening…' : 'Carry on from here'}
            </Button>
            <Link className="inline-flex items-center rounded-xl border border-[var(--lr-rule)] px-4 py-2.5 font-semibold" to="/">
              Back to the library
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
