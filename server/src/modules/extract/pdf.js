/**
 * PDF extraction.
 *
 * 1. Try the embedded text layer (fast, exact).
 * 2. If a page yields almost no text it is a scan: render it to a bitmap with
 *    `@napi-rs/canvas` and run it through the OCR module.
 *
 * Both heavy dependencies (pdfjs, canvas, tesseract) are imported lazily so the
 * server boots fast and the API works on machines where OCR is unavailable.
 */

import { config } from '../../config.js';
import { cleanExtractedText, stripRepeatedLines, textStats } from './text.js';

let pdfjsPromise;

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      await ensureCanvasGlobals();
      return import('pdfjs-dist/legacy/build/pdf.mjs');
    })();
  }
  return pdfjsPromise;
}

/** pdf.js needs a few DOM globals when rendering in Node. */
export async function loadCanvas() {
  try {
    return await import('@napi-rs/canvas');
  } catch {
    return null;
  }
}

async function ensureCanvasGlobals() {
  const canvasLib = await loadCanvas();
  if (!canvasLib) return null;
  const g = globalThis;
  for (const key of ['DOMMatrix', 'DOMMatrixReadOnly', 'Path2D', 'ImageData']) {
    if (!g[key] && canvasLib[key]) g[key] = canvasLib[key];
  }
  return canvasLib;
}

/** Rebuild readable lines from pdf.js text items using their positions. */
export function itemsToText(items) {
  const lines = [];
  let current = '';
  let lastY = null;
  let lastX = null;
  let lastHeight = 10;

  for (const item of items) {
    const str = item.str ?? '';
    const [a, , , d, e, f] = item.transform ?? [];
    const height = Math.abs(d) || Math.abs(a) || 10;
    const y = Math.round(f);
    if (lastY === null || Math.abs(y - lastY) > Math.max(2, height * 0.5)) {
      if (current.trim()) lines.push(current.replace(/\s+$/, ''));
      current = '';
      lastX = null;
    }
    const gap = lastX === null ? 0 : e - lastX;
    if (current && gap > Math.max(1, lastHeight * 0.28) && !current.endsWith(' ')) current += ' ';
    current += str;
    if (item.hasEOL) {
      lines.push(current.replace(/\s+$/, ''));
      current = '';
      lastX = null;
    } else {
      lastX = e + (item.width ?? 0);
    }
    lastY = y;
    lastHeight = height;
  }
  if (current.trim()) lines.push(current.replace(/\s+$/, ''));
  return lines.join('\n');
}

export async function extractPdf(buffer, { title = 'Document', ocrFn = null, maxOcrPages = 8 } = {}) {
  const pdfjs = await loadPdfjs();
  const warnings = [];
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  }).promise;

  const pages = [];
  const blankPages = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = itemsToText(content.items);
    pages.push(text);
    if (text.replace(/\s/g, '').length < config.pdfScanCharsPerPage) blankPages.push(p);
  }

  let ocrUsed = false;
  const totalChars = pages.join('').replace(/\s/g, '').length;
  // Only OCR when the document really has no usable text layer: a text PDF
  // with one image-only cover page should not pay for OCR on every page.
  const looksScanned = blankPages.length > 0 && totalChars < doc.numPages * 40;

  if (looksScanned && ocrFn) {
    warnings.push(
      'This PDF has no text layer, so LexiRead is reading the page images. The first OCR run downloads language data and can take a minute.'
    );
    const canvasLib = await ensureCanvasGlobals();
    if (!canvasLib) {
      warnings.push(
        'This PDF looks like a scan, but the image renderer is unavailable. Upload the pages as images instead.'
      );
    } else {
      const targets = blankPages.slice(0, maxOcrPages);
      for (const p of targets) {
        try {
          const page = await doc.getPage(p);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = canvasLib.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
          const ctx = canvas.getContext('2d');
          const renderTask = page.render({ canvasContext: ctx, viewport, canvas });
          await renderTask.promise;
          const png = canvas.toBuffer('image/png');
          const result = await ocrFn(png);
          pages[p - 1] = result.text || '';
          ocrUsed = true;
        } catch (err) {
          warnings.push(`Could not OCR page ${p}: ${err.message}`);
        }
      }
      if (blankPages.length > targets.length) {
        warnings.push(`Only the first ${targets.length} scanned pages were read.`);
      }
    }
  }

  const text = cleanExtractedText(stripRepeatedLines(pages.filter(Boolean).join('\n\n')));
  if (!text.trim()) {
    warnings.push(
      looksScanned
        ? 'No text could be read from this scan. Try photographing the page with good lighting.'
        : 'This PDF has no readable text.'
    );
  }
  if (doc.numPages > 0 && text.split(/\s+/).length / doc.numPages > 400) {
    warnings.push('This is a long document — reading sessions are easier one chapter at a time.');
  }

  return {
    kind: ocrUsed ? 'pdf+ocr' : 'pdf',
    title,
    text,
    pages: doc.numPages,
    stats: textStats(text),
    meta: {
      engine: 'pdfjs',
      ocr: ocrUsed,
      warnings,
      emptyPages: blankPages,
      pages: doc.numPages,
    },
  };
}
