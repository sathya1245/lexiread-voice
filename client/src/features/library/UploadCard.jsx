/**
 * Content intake: file upload (PDF or photo, OCR'd on the server), pasted text
 * and one-tap sample passages. Warnings from extraction (blurry photo, scanned
 * PDF, no text found) are shown in plain language.
 */

import { useCallback, useRef, useState } from 'react';
import { Alert, Button, Card, Field, Pill, SegmentedControl, Spinner, TextArea, TextInput } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { cx } from '../../lib/format.js';
import { SAMPLES } from './samples.js';

export function UploadCard({ onCreated, onNotice }) {
  const [tab, setTab] = useState('file');
  const [title, setTitle] = useState('');
  const [pasted, setPasted] = useState('');
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const inputRef = useRef(null);

  const pickFile = (candidate) => {
    if (!candidate) return;
    setFile(candidate);
    if (!title) setTitle(candidate.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
    setWarnings([]);
  };

  const createFromText = useCallback(
    async (text, name) => {
      setBusy(true);
      setError(null);
      setWarnings([]);
      try {
        const { document } = await api.post('/content', { text, title: name });
        onCreated?.(document);
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [onCreated]
  );

  const submit = async () => {
    setBusy(true);
    setError(null);
    setWarnings([]);
    try {
      if (tab === 'paste') {
        if (!pasted.trim()) throw new Error('Paste or type some text first.');
        const { document } = await api.post('/content', { text: pasted, title: title || 'Pasted text' });
        onCreated?.(document);
        setPasted('');
        return;
      }
      if (!file) throw new Error('Choose a PDF, an image, or a text file.');
      const form = new FormData();
      form.append('file', file);
      if (title) form.append('title', title);
      const { document } = await api.upload(form);
      if (document.meta?.warnings?.length) {
        setWarnings(document.meta.warnings);
        onNotice?.(document);
      }
      onCreated?.(document);
      setFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          label="How would you like to add content"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'file', label: 'Upload a file' },
            { value: 'paste', label: 'Paste text' },
          ]}
        />
        <Pill>{tab === 'file' ? 'PDF · photo · text file' : 'anything you can copy'}</Pill>
      </div>

      {tab === 'file' ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pickFile(e.dataTransfer?.files?.[0]);
          }}
          className={cx(
            'rounded-2xl border-2 border-dashed p-5 text-center transition-colors',
            dragOver ? 'border-[var(--lr-accent)] bg-[var(--lr-accent-soft)]' : 'border-[var(--lr-rule)] bg-[var(--lr-surface-2)]'
          )}
        >
          <p className="text-sm font-semibold">Drop a PDF, a photo of a page, or a text file here</p>
          <p className="mt-1 text-xs text-[var(--lr-ink-soft)]">
            Photos and scans are read with OCR. The first scan can take a minute while the reader loads.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={() => inputRef.current?.click()} type="button">
              Choose a file
            </Button>
            {file ? (
              <Button variant="ghost" type="button" onClick={() => setFile(null)}>
                Clear "{file.name}"
              </Button>
            ) : null}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.txt,.md"
            className="sr-only"
            aria-label="Choose a file to read"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          {file ? (
            <p className="mt-2 text-sm">
              Ready: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(0)} KB)
            </p>
          ) : null}
        </div>
      ) : (
        <Field label="Paste the text you need to read" hint="A paragraph, a worksheet page or a whole chapter.">
          {(props) => (
            <TextArea
              {...props}
              rows={7}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="Paste your study text here…"
            />
          )}
        </Field>
      )}

      <Field label="Call it something" hint="Optional — a title helps you find it in your library.">
        {(props) => (
          <TextInput
            {...props}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tab === 'file' ? 'Chapter 3 — Plants' : 'My science notes'}
          />
        )}
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={submit} disabled={busy} size="lg">
          {busy ? 'Reading it…' : 'Add it to my library'}
        </Button>
        {busy ? <Spinner label="Extracting text" /> : null}
      </div>

      {error ? (
        <Alert tone="warning" title="That did not work" role="alert">
          {error}
        </Alert>
      ) : null}

      {warnings.length ? (
        <Alert tone="gentle" title="A note about this file">
          <ul className="list-disc space-y-1 pl-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="border-t border-[var(--lr-rule)] pt-3">
        <p className="text-sm font-semibold">Or try a sample passage</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SAMPLES.map((sample) => (
            <Button
              key={sample.id}
              variant="soft"
              size="sm"
              disabled={busy}
              onClick={() => createFromText(sample.text, sample.title)}
              title={sample.subject}
            >
              {sample.title}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}
