/**
 * Extraction dispatcher.
 *
 * One entry point for every kind of study content, so the API route stays thin
 * and new formats (docx, epub, Indic-language worksheets) plug in here.
 */

import path from 'node:path';
import { createOcr, extractImage } from './image.js';
import { extractPdf } from './pdf.js';
import { extractText } from './text.js';

export { extractText, extractPdf, extractImage, createOcr };
export { cleanExtractedText, textStats, stripRepeatedLines } from './text.js';

export function detectKind({ mimetype = '', filename = '' }) {
  const ext = path.extname(filename).toLowerCase();
  if (mimetype === 'application/pdf' || ext === '.pdf') return 'pdf';
  if (mimetype.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.heic'].includes(ext)) {
    return 'image';
  }
  if (mimetype.startsWith('text/') || ['.txt', '.md', '.csv'].includes(ext)) return 'text';
  return 'unknown';
}

export function titleFromFilename(filename, fallback = 'Untitled') {
  if (!filename) return fallback;
  const base = path.basename(filename, path.extname(filename)).replace(/[_-]+/g, ' ').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : fallback;
}

/**
 * @param {object} args
 * @param {Buffer} [args.buffer] file bytes
 * @param {string} [args.mimetype]
 * @param {string} [args.filename]
 * @param {string} [args.text]  already-typed text
 */
export async function extractContent({ buffer, mimetype, filename, text }) {
  if (typeof text === 'string' && text.trim()) {
    return extractText(text, { title: titleFromFilename(filename, 'Pasted text') });
  }
  if (!buffer || !buffer.length) {
    const err = new Error('Nothing to read — upload a file or paste some text.');
    err.status = 400;
    throw err;
  }

  const kind = detectKind({ mimetype, filename });
  const title = titleFromFilename(filename, 'Upload');

  if (kind === 'pdf') {
    const ocrFn = createOcr();
    return extractPdf(buffer, { title, ocrFn });
  }
  if (kind === 'image') return extractImage(buffer, { title });
  if (kind === 'text') return extractText(buffer.toString('utf8'), { title });

  const err = new Error(
    'That file type is not supported yet. Try a PDF, a photo of the page, or paste the text.'
  );
  err.status = 415;
  throw err;
}
