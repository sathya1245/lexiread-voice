/**
 * Image OCR module (tesseract.js).
 *
 * Kept behind a single `createOcr()` factory so swapping in a stronger engine
 * — or an Indic-language model set — is a one-line change: pass a different
 * `langs` array (see OCR_LANGS in config).
 */

import { config } from '../../config.js';
import { cleanExtractedText, textStats } from './text.js';

let workerPromise;

export async function getOcrWorker(langs = config.ocrLangs) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker(langs.join('+'));
      return worker;
    })();
  }
  return workerPromise;
}

/** Returns a function that OCRs an image buffer to `{ text, confidence }`. */
export function createOcr(langs = config.ocrLangs) {
  return async function recognize(buffer) {
    const worker = await getOcrWorker(langs);
    const { data } = await worker.recognize(Buffer.from(buffer));
    return {
      text: data.text || '',
      confidence: data.confidence ?? null,
      langs,
    };
  };
}

export async function extractImage(buffer, { title = 'Scan', langs = config.ocrLangs } = {}) {
  const warnings = [];
  let result;
  try {
    result = await createOcr(langs)(buffer);
  } catch (err) {
    return {
      kind: 'image',
      title,
      text: '',
      pages: 1,
      stats: textStats(''),
      meta: {
        engine: 'tesseract',
        ocr: true,
        warnings: [
          `OCR could not run: ${err.message}. The engine downloads its language data on first use, so check the internet connection.`,
        ],
      },
    };
  }

  const text = cleanExtractedText(result.text);
  const words = text.split(/\s+/).filter(Boolean).length;
  if (result.confidence !== null && result.confidence < 70) {
    warnings.push(
      'The photo was hard to read. More light, a flatter page and less shadow usually fixes it.'
    );
  }
  if (words < 3) warnings.push('Almost no text was found in this image.');

  return {
    kind: 'image',
    title,
    text,
    pages: 1,
    stats: textStats(text),
    meta: {
      engine: 'tesseract',
      ocr: true,
      languages: result.langs,
      confidence: result.confidence,
      warnings,
    },
  };
}
