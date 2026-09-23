/**
 * Home: add content, or pick something from the library and choose how to read
 * it. The three reading modes are explained here in one line each, because the
 * difference between voice-following and narrated reading is the whole point of
 * the app.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Pill, SectionTitle, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { cx, formatRelative } from '../../lib/format.js';
import { useAuth } from '../../state/AuthContext.jsx';
import { UploadCard } from './UploadCard.jsx';

const KIND_LABEL = {
  text: 'Pasted text',
  pdf: 'PDF',
  'pdf+ocr': 'Scanned PDF',
  image: 'Photo (OCR)',
};

function DocumentRow({ doc, onOpen, onDelete }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--lr-rule)] bg-[var(--lr-surface)] p-3">
      <div className="min-w-0">
        <p className="truncate font-bold">{doc.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--lr-ink-soft)]">
          <Pill>{KIND_LABEL[doc.kind] || doc.kind}</Pill>
          <span>{doc.wordCount} words</span>
          {doc.pages ? <span>{doc.pages} page{doc.pages === 1 ? '' : 's'}</span> : null}
          <span>{formatRelative(doc.createdAt)}</span>
          {doc.meta?.ocr ? <span>read with OCR{doc.meta.confidence ? ` (${Math.round(doc.meta.confidence)}%)` : ''}</span> : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={() => onOpen(doc)}>
          Open reader
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDelete(doc)} aria-label={`Delete ${doc.title}`}>
          Delete
        </Button>
      </div>
    </li>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { profile, isSignedIn } = useAuth();
  const [documents, setDocuments] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    try {
      const { documents: list } = await api.get('/content');
      setDocuments(list);
    } catch (err) {
      setError(err.message);
      setDocuments([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreated = useCallback(
    (doc) => {
      setDocuments((current) => [
        {
          id: doc.id,
          title: doc.title,
          kind: doc.kind,
          source: doc.source,
          wordCount: doc.wordCount,
          pages: doc.pages,
          meta: doc.meta,
          createdAt: doc.createdAt,
        },
        ...(current || []),
      ]);
      navigate(`/read/${doc.id}`);
    },
    [navigate]
  );

  const handleDelete = useCallback(
    async (doc) => {
      const previous = documents;
      setDocuments((current) => current.filter((d) => d.id !== doc.id));
      try {
        await api.del(`/content/${doc.id}`);
      } catch (err) {
        setDocuments(previous);
        setError(err.message);
      }
    },
    [documents]
  );

  return (
    <div className="mx-auto max-w-5xl px-3 py-6 sm:px-4">
      <section className="mb-6">
        <p className="text-sm font-bold uppercase tracking-wide text-[var(--lr-ink-soft)]">
          Read it your way
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {isSignedIn ? `Hello, ${profile.displayName}` : 'LexiRead'}
        </h1>
        <p className="mt-2 max-w-2xl text-[1.05rem] leading-relaxed text-[var(--lr-ink-soft)]">
          Bring any study text — a PDF, a photo of the page, or something you paste. LexiRead makes it easier to
          read, listen to, and write about. In voice-following mode the app listens to <em>you</em> read and keeps
          your place as you go.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill tone="accent">🎙️ You read — the app follows</Pill>
          <Pill>🔊 Or it reads to you</Pill>
          <Pill>👆 Or tap word by word</Pill>
        </div>
      </section>

      {error ? (
        <div className="mb-4">
          <Alert tone="gentle" title="Connection problem">
            {error}
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div className="space-y-6">
          <UploadCard onCreated={handleCreated} onNotice={setNotice} />
          {notice ? (
            <Alert tone="gentle" title={`Added “${notice.title}”`}>
              {(notice.meta?.warnings || []).map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </Alert>
          ) : null}

          <Card>
            <SectionTitle hint="Everything you add stays on your device's profile until you delete it.">
              My library
            </SectionTitle>
            {documents === null ? (
              <Spinner label="Loading your texts…" />
            ) : documents.length === 0 ? (
              <p className="text-sm text-[var(--lr-ink-soft)]">
                Nothing here yet. Add a file, paste some text, or try one of the sample passages.
              </p>
            ) : (
              <ul className="space-y-2">
                {documents.map((doc) => (
                  <DocumentRow key={doc.id} doc={doc} onOpen={(d) => navigate(`/read/${d.id}`)} onDelete={handleDelete} />
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <SectionTitle hint="Three ways to read the same text — switch any time, your place is kept." level={2}>
              How reading works here
            </SectionTitle>
            <ul className="space-y-3 text-sm leading-relaxed">
              <li>
                <strong>🎙️ I read aloud.</strong> You read out loud and the highlight follows your voice. Words that
                sound close get a dotted line, missed words a dashed line — quietly, without stopping you.
              </li>
              <li>
                <strong>🔊 Listen to it.</strong> The app reads aloud and highlights each word as it is spoken. Good
                for tired days or very new text.
              </li>
              <li>
                <strong>👆 Tap to read.</strong> No microphone needed: tap or press Enter as you read, and everything
                else works exactly the same.
              </li>
            </ul>
          </Card>

          <Card>
            <SectionTitle level={2} hint="Built from your own reading — never a generic word list.">
              After you read
            </SectionTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="soft" onClick={() => navigate('/progress')}>
                My progress
              </Button>
              <Button variant="soft" onClick={() => navigate('/write')}>
                Writing helper
              </Button>
            </div>
            <p className="mt-3 text-sm text-[var(--lr-ink-soft)]">
              The dashboard shows a plain-language summary of the week, gentle practice patterns (never a diagnosis),
              and a word game made from the words you found tricky.
            </p>
          </Card>

          <Card>
            <SectionTitle level={2}>Reading together</SectionTitle>
            <p className="text-sm leading-relaxed text-[var(--lr-ink-soft)]">
              Open a shared reading room and a teacher or parent can see which word you are on, live, and send a quiet
              note. You can also hand a session to another device with a QR code — no login needed.
            </p>
            <p className="mt-2 text-xs text-[var(--lr-ink-soft)]">
              Only the current word and pace are shared while a room is open. Nothing is recorded.
            </p>
          </Card>

          {!isSignedIn ? (
            <Card className={cx('border-[var(--lr-accent)]')}>
              <SectionTitle level={2}>Save preferences for each reader</SectionTitle>
              <p className="text-sm text-[var(--lr-ink-soft)]">
                Right now everything is stored on this device. Create a profile for each family member or pupil and
                their font, colours, spacing and practice history stay separate.
              </p>
              <div className="mt-3">
                <Link
                  className="inline-flex items-center rounded-xl bg-[var(--lr-accent)] px-4 py-2.5 font-semibold text-[var(--lr-accent-ink)]"
                  to="/signin"
                >
                  Create a profile
                </Link>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
