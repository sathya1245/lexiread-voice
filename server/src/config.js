import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, '..', '..');

export const config = {
  port: Number(process.env.PORT || 8787),
  host: process.env.HOST || '0.0.0.0',
  dataDir: process.env.DATA_DIR || path.join(ROOT, 'server', 'data'),
  clientDist: process.env.CLIENT_DIST || path.join(ROOT, 'client', 'dist'),
  /** Set to '0' to disable cross-origin requests (production same-origin). */
  corsOrigin: process.env.CORS_ORIGIN || '*',
  /** OCR languages, comma separated — swap for 'eng,hin,kan' style values later. */
  ocrLangs: (process.env.OCR_LANGS || 'eng').split(',').map((s) => s.trim()).filter(Boolean),
  /** Pages with fewer characters than this are treated as scanned images. */
  pdfScanCharsPerPage: Number(process.env.PDF_SCAN_CHARS_PER_PAGE || 10),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 15 * 1024 * 1024),
  dictionaryTimeoutMs: Number(process.env.DICTIONARY_TIMEOUT_MS || 6000),
  handoffTtlMs: Number(process.env.HANDOFF_TTL_MS || 1000 * 60 * 60 * 6),
  /** Anonymous demo mode: uploads + sessions work without an account. */
  allowAnonymous: process.env.ALLOW_ANONYMOUS !== '0',
  isProd: process.env.NODE_ENV === 'production',
};
