/**
 * LexiRead text tokenizer.
 *
 * Turns extracted text into a rendering-friendly structure. It keeps the
 * original characters (so the reading view looks like the source document:
 * same spacing, punctuation and line structure) while giving every word a
 * stable index that the voice-following engine and TTS word-sync highlighting
 * can point at.
 *
 * Strategy: split the text into alternating word / non-word chunks, then scan
 * the non-word chunks for sentence and paragraph boundaries. Abbreviations and
 * decimals are handled so "U.S." and "3.5" do not create fake sentences.
 */

/** Latin-1 / Latin-Extended letters, digits, apostrophes. */
export const WORD_SOURCE = "[A-Za-z0-9\\u00C0-\\u024F'\u2019]+";
const WORD_ONLY_RE = new RegExp(`^${WORD_SOURCE}$`, 'u');
const CHUNK_RE = () => new RegExp(`[^\\S\\n]*${WORD_SOURCE}[^\\S\\n]*|\\n+|[^\\S\\n]+|.`, 'gs');

const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'st', 'mt', 'jr', 'sr', 'vs', 'etc', 'fig', 'no',
  'prof', 'eg', 'ie', 'approx', 'dept', 'est', 'vol', 'ch', 'sec', 'p', 'pp',
]);

export function isWordChunk(text) {
  return WORD_ONLY_RE.test(String(text ?? ''));
}

/** Normalize a word for comparison/matching (lowercase, curly apostrophes). */
export function cleanWord(raw) {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/^[']+|[']+$/g, '');
}

/**
 * @param {string} text
 * @returns {{
 *   text: string,
 *   words: Array<{wi:number,seg:number,text:string,clean:string,sentence:number,paragraph:number}>,
 *   segments: Array<{type:'word'|'gap',text:string,wi?:number}>,
 *   sentences: Array<{si:number,text:string,wStart:number,wEnd:number,pStart:number,pEnd:number}>,
 *   paragraphs: Array<{pi:number,segStart:number,segEnd:number,wStart:number,wEnd:number}>
 * }}
 */
export function tokenize(text) {
  const source = String(text ?? '').replace(/\r\n?/g, '\n');
  const segments = [];
  const words = [];
  const sentences = [];
  const paragraphs = [];

  let si = 0;
  let pi = 0;
  let sentenceStartWord = 0;
  let paragraphStartWord = 0;
  let sectionStartSeg = 0;
  let paragraphStartSeg = 0;

  const pushGap = (gap) => {
    if (!gap) return;
    const last = segments[segments.length - 1];
    if (last && last.type === 'gap') last.text += gap;
    else segments.push({ type: 'gap', text: gap });
  };

  const pushWord = (raw) => {
    segments.push({ type: 'word', text: raw, wi: words.length });
    words.push({
      wi: words.length,
      seg: segments.length - 1,
      text: raw,
      clean: cleanWord(raw),
      sentence: si,
      paragraph: pi,
    });
  };

  const flushSentence = (endSeg) => {
    if (words.length > sentenceStartWord) {
      const from = Math.min(sectionStartSeg, endSeg);
      const text = segments
        .slice(from, endSeg + 1)
        .map((s) => s.text)
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      sentences.push({
        si,
        text,
        wStart: sentenceStartWord,
        wEnd: words.length - 1,
        pStart: from,
        pEnd: endSeg,
      });
      si += 1;
    }
    sectionStartSeg = endSeg + 1;
    sentenceStartWord = words.length;
  };

  const flushParagraph = (endSeg) => {
    if (words.length > paragraphStartWord) {
      paragraphs.push({
        pi,
        segStart: paragraphStartSeg,
        segEnd: endSeg,
        wStart: paragraphStartWord,
        wEnd: words.length - 1,
      });
      pi += 1;
    }
    paragraphStartSeg = endSeg + 1;
    paragraphStartWord = words.length;
  };

  const re = CHUNK_RE();
  let m;
  while ((m = re.exec(source)) !== null) {
    const raw = m[0];
    const trimmed = raw.trim();
    if (isWordChunk(trimmed)) {
      const at = raw.indexOf(trimmed);
      pushGap(raw.slice(0, at));
      pushWord(trimmed);
      pushGap(raw.slice(at + trimmed.length));
      continue;
    }

    pushGap(raw);

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '\n') {
        const restOfGap = raw.slice(i + 1);
        const blankLine = restOfGap.startsWith('\n') || restOfGap.trim() === '';
        if (blankLine) {
          flushSentence(segments.length - 1);
          flushParagraph(segments.length - 1);
        }
        continue;
      }
      if (ch === '.' || ch === '!' || ch === '?') {
        const after = raw[i + 1] ?? source[m.index + raw.length] ?? '';
        const nextIsBoundary = after === '' || /\s/.test(after);
        const prevWord = words[words.length - 1]?.text ?? '';
        const prevClean = (words[words.length - 1]?.clean ?? '').replace(/\./g, '');
        const isDecimal = ch === '.' && /[0-9]$/.test(prevWord) && /^[0-9]/.test(after);
        const isInitial = ch === '.' && /^[A-Z]$/.test(prevWord);
        const isAbbrev = ch === '.' && ABBREVIATIONS.has(prevClean);
        if (nextIsBoundary && !isDecimal && !isInitial && !isAbbrev) {
          flushSentence(segments.length - 1);
        }
      }
    }
  }
  flushSentence(segments.length - 1);
  flushParagraph(segments.length - 1);

  return { text: source, words, segments, sentences, paragraphs };
}

/** Plain-text rebuild of a word range (used by the reading-room live view). */
export function wordsToText(words, from, to) {
  if (!words?.length) return '';
  const start = Math.max(0, from ?? 0);
  const end = Math.min(words.length - 1, to ?? words.length - 1);
  return words
    .slice(start, end + 1)
    .map((w) => w.text)
    .join(' ');
}

/** The sentence that contains (or follows) a word index. */
export function sentenceAt(sentences, wi) {
  if (!sentences?.length) return null;
  const last = sentences[sentences.length - 1];
  if (wi > last.wEnd) return last;
  let lo = 0;
  let hi = sentences.length - 1;
  let best = sentences[0];
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = sentences[mid];
    if (s.wEnd < wi) lo = mid + 1;
    else {
      best = s;
      hi = mid - 1;
    }
  }
  return best;
}

/** Split text into sentence strings (used by summarizer / writing checks). */
export function splitSentences(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export { ABBREVIATIONS };
