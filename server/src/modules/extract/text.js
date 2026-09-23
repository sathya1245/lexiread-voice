/**
 * Plain-text extraction / clean-up.
 *
 * Extracted text from PDFs and OCR is noisy: hard-wrapped lines, hyphenated
 * word breaks, stray control characters, repeated blank lines. This module
 * performs the language-agnostic clean-up pass shared by every extractor.
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanExtractedText(input) {
  let text = String(input ?? '');
  text = text.replace(/\r\n?/g, '\n');
  text = text.replace(CONTROL_CHARS, '');
  // Re-join words broken across line ends ("photo-\nsynthesis" => "photosynthesis")
  text = text.replace(/([A-Za-z\u00C0-\u024F])-\n([a-z\u00E0-\u024F])/g, '$1$2');
  // A single newline inside a paragraph is usually a wrap, not a break.
  text = text.replace(/([^\n])\n(?!\n)/g, '$1 ');
  text = text.replace(/[ \t\u00A0]+/g, ' ');
  text = text.replace(/ ?\n ?/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

/** Drop repeated running headers/footers that OCR and PDFs love to repeat. */
export function stripRepeatedLines(text, minRepeats = 3) {
  const lines = String(text).split('\n');
  if (lines.length < 12) return text;
  const counts = new Map();
  for (const line of lines) {
    const key = line.trim();
    if (!key || key.length > 80) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const repeated = new Set([...counts.entries()].filter(([, n]) => n >= minRepeats).map(([k]) => k));
  if (!repeated.size) return text;
  return lines
    .filter((line) => !repeated.has(line.trim()) || line.trim().length > 60)
    .join('\n');
}

export function textStats(text) {
  const words = String(text).match(/[A-Za-z0-9\u00C0-\u024F'\u2019]+/g) || [];
  const sentences = String(text).split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  return {
    characters: text.length,
    words: words.length,
    sentences: sentences.length,
    paragraphs: String(text).split(/\n{2,}/).filter((p) => p.trim()).length,
    readingMinutes: Math.max(1, Math.round(words.length / 110)),
  };
}

export function extractText(rawText, { title = 'Pasted text' } = {}) {
  const text = cleanExtractedText(stripRepeatedLines(rawText));
  return {
    kind: 'text',
    title,
    text,
    pages: null,
    stats: textStats(text),
    meta: { engine: 'text', ocr: false, warnings: [] },
  };
}
